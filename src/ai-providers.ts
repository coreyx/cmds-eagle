import { requestUrl } from 'obsidian';
import {
	AiEffort,
	AiImageHints,
	AiProviderConfig,
	AiProviderType,
	AiTagSuggestions,
	CMDSPACEEagleSettings,
	EagleAiAssistant,
	EagleTag,
} from './types';

export const AI_PROVIDER_LABELS: Record<AiProviderType, string> = {
	none: 'None',
	anthropic: 'Anthropic',
	openai: 'OpenAI',
	gemini: 'Gemini',
	'openai-compatible': 'OpenAI-compatible',
	lmstudio: 'LM Studio',
};

export const LM_STUDIO_DEFAULT_URL = 'http://localhost:1234/v1';

// Addresses of the providers whose API follows the OpenAI chat-completions format
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

// Longest image edge sent to a model. Larger images are scaled down first.
const MAX_IMAGE_EDGE = 1568;
// At most this many library tags are listed in a tag request, most used first
const MAX_TAGS_IN_PROMPT = 1000;

// Bounds for the two tag-wand settings: tags added per click, and how many may be new
export const AI_MAX_TAGS_LIMIT = 20;
const DEFAULT_MAX_TAGS = 6;
const DEFAULT_MAX_NEW_TAGS = 2;

/** The tag-wand limits from settings, made safe: whole numbers within bounds, new ≤ total. */
export function resolveAiTagLimits(settings: { aiMaxTags?: number; aiMaxNewTags?: number }): { maxTags: number; maxNewTags: number } {
	const whole = (value: number | undefined, fallback: number) =>
		typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
	const maxTags = Math.min(AI_MAX_TAGS_LIMIT, Math.max(1, whole(settings.aiMaxTags, DEFAULT_MAX_TAGS)));
	const maxNewTags = Math.min(maxTags, Math.max(0, whole(settings.aiMaxNewTags, DEFAULT_MAX_NEW_TAGS)));
	return { maxTags, maxNewTags };
}

/** An error whose message is written for the user and can be shown as is. */
export class AiError extends Error {
	constructor(
		message: string,
		// HTTP status of the provider's answer, when there was one
		public status?: number,
		// The model's context was too small for the request
		public outOfContext = false
	) {
		super(message);
	}
}

// Thinking settings (an effort level, or "none") that a server or model turned down, so
// they are not sent to it again
const rejectedThinkingOptions = new Set<string>();

/**
 * Sends a request that may carry a thinking setting. Models differ in which settings they
 * accept, and say so with a "bad request" answer. When that happens the setting is the
 * likeliest cause, so the request is sent once more without it; if that works, the
 * rejection is remembered. `key` names the server, model and setting, or is null for none.
 */
async function withOptionalThinking<T>(key: string | null, send: (withSetting: boolean) => Promise<T>): Promise<T> {
	const useSetting = key !== null && !rejectedThinkingOptions.has(key);
	try {
		return await send(useSetting);
	} catch (error) {
		const settingMayBeAtFault = useSetting
			&& error instanceof AiError
			&& error.status === 400
			&& !error.outOfContext;
		if (!settingMayBeAtFault) throw error;

		const result = await send(false);
		rejectedThinkingOptions.add(key as string);
		return result;
	}
}

// Requests to a local server run one at a time. A model loaded there shares one context
// between simultaneous requests, and three image prompts at once overflow it.
let localRequestQueue: Promise<unknown> = Promise.resolve();

interface AiImage {
	base64: string;
	mediaType: 'image/jpeg';
}

interface AiClient {
	listModels(): Promise<string[]>;
	complete(system: string, prompt: string, image: AiImage): Promise<string>;
}

// ── Anthropic (Messages API over HTTP) ───────────────────────────────────
// Called directly rather than through Anthropic's SDK: bundling the SDK more than tripled
// the size of the plugin for the two requests made here.

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

class AnthropicClient implements AiClient {
	constructor(private config: AiProviderConfig) {}

	async listModels(): Promise<string[]> {
		const ids: string[] = [];
		let afterId: string | null = null;
		// The list is paged. Ten pages is far more than the API has models.
		for (let page = 0; page < 10; page++) {
			const query: string = afterId ? `?limit=100&after_id=${encodeURIComponent(afterId)}` : '?limit=100';
			const json = await this.request('GET', `/models${query}`) as {
				data?: Array<{ id?: unknown }>;
				has_more?: boolean;
				last_id?: string | null;
			};
			for (const model of json.data ?? []) {
				if (typeof model?.id === 'string') ids.push(model.id);
			}
			if (!json.has_more || !json.last_id) break;
			afterId = json.last_id;
		}
		return ids;
	}

	async complete(system: string, prompt: string, image: AiImage): Promise<string> {
		// No thinking setting by default: the model's own default is valid on every model
		// the user can pick here, which an explicit value is not.
		const body: Record<string, unknown> = {
			model: this.config.model,
			max_tokens: 16000,
			system,
			messages: [{
				role: 'user',
				content: [
					{ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
					{ type: 'text', text: prompt },
				],
			}],
		};

		// Anthropic has effort levels but no "none": thinking cannot be switched off this way
		const effort = this.config.effort && this.config.effort !== 'default' && this.config.effort !== 'none'
			? this.config.effort
			: null;
		const json = await withOptionalThinking(
			effort ? `anthropic|${this.config.model}|${effort}` : null,
			(withEffort) => this.request('POST', '/messages', withEffort ? { ...body, output_config: { effort } } : body)
		) as { content?: Array<{ type?: string; text?: string }>; stop_reason?: string };

		if (json.stop_reason === 'refusal') {
			throw new AiError('The model declined to work on this image.');
		}

		let text = '';
		for (const block of json.content ?? []) {
			if (block?.type === 'text' && typeof block.text === 'string') text += block.text;
		}
		return text;
	}

	private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
		// Rate limits and overloads are usually momentary, so try those once more
		for (let attempt = 0; ; attempt++) {
			let response;
			try {
				response = await requestUrl({
					url: `${ANTHROPIC_BASE_URL}${path}`,
					method,
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': this.config.apiKey,
						'anthropic-version': ANTHROPIC_VERSION,
					},
					body: body === undefined ? undefined : JSON.stringify(body),
					throw: false,
				});
			} catch {
				throw new AiError('Could not reach Anthropic. Check your internet connection.');
			}

			let json: unknown = null;
			try {
				json = response.json;
			} catch {
				// Not JSON; handled by the status checks below
			}

			if (response.status >= 200 && response.status < 300 && json !== null) {
				return json;
			}

			const retryable = response.status === 429 || response.status >= 500;
			if (retryable && attempt === 0) {
				await new Promise(resolve => setTimeout(resolve, 1500));
				continue;
			}

			throw this.describe(response.status, json);
		}
	}

	private describe(status: number, json: unknown): AiError {
		const message = (json as { error?: { message?: unknown } })?.error?.message;
		const detail = typeof message === 'string' && message ? message : '';

		switch (status) {
			case 401:
				return new AiError('Anthropic rejected the API key. Check it in the AI settings.', status);
			case 402:
				return new AiError(`Anthropic reported a billing problem with this account.${detail ? ` ${detail}` : ''}`, status);
			case 403:
				return new AiError('This Anthropic API key is not allowed to do that.', status);
			case 404:
				return new AiError(`Anthropic does not have a model named "${this.config.model}" available to this key.`, status);
			case 413:
				return new AiError('The image is too large for Anthropic to accept.', status);
			case 429:
				return new AiError('Anthropic rate limit reached. Try again in a moment.', status);
			case 529:
				return new AiError('Anthropic is overloaded right now. Try again in a moment.', status);
			case 400:
				return new AiError(`Anthropic rejected the request${detail ? `: ${detail}` : '.'}`, status);
			default:
				return new AiError(`Anthropic error ${status}${detail ? `: ${detail}` : '.'}`, status);
		}
	}
}

// ── OpenAI chat-completions format (OpenAI, Gemini, OpenAI-compatible, LM Studio) ──

class OpenAiStyleClient implements AiClient {
	private baseUrl: string;

	constructor(
		private label: string,
		baseUrl: string,
		private apiKey: string,
		private model: string,
		// How much the model should think first; 'default' sends no setting at all
		private effort: AiEffort = 'default'
	) {
		this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
	}

	async listModels(): Promise<string[]> {
		const json = await this.request('GET', '/models');
		const data = (json as { data?: Array<{ id?: unknown }> })?.data;
		if (!Array.isArray(data)) return [];
		return data
			.map(model => (typeof model?.id === 'string' ? model.id.replace(/^models\//, '') : ''))
			.filter(id => id.length > 0);
	}

	async complete(system: string, prompt: string, image: AiImage): Promise<string> {
		if (!this.model) {
			throw new AiError(`Choose a model for ${this.label} in the AI settings.`);
		}

		// Only the fields every server accepts. Token limits and sampling settings are
		// named differently, or rejected outright, across models and servers.
		const body: Record<string, unknown> = {
			model: this.model,
			messages: [
				{ role: 'system', content: system },
				{
					role: 'user',
					content: [
						{ type: 'text', text: prompt },
						{ type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
					],
				},
			],
		};

		// Left to itself, a local reasoning model was measured thinking for 25 to 50 seconds
		// before a ten-word title; with "none" it answered in about one.
		const effort = this.effort !== 'default' ? this.effort : null;
		const json = await withOptionalThinking(
			effort ? `${this.baseUrl}|${this.model}|${effort}` : null,
			(withEffort) => this.request('POST', '/chat/completions', withEffort ? { ...body, reasoning_effort: effort } : body)
		);

		const content = (json as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			return content
				.map(part => (typeof (part as { text?: unknown })?.text === 'string' ? (part as { text: string }).text : ''))
				.join('');
		}
		throw new AiError(`${this.label} returned an answer in a format Eagle Bridge does not understand.`);
	}

	private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
		if (!/^https?:\/\//.test(this.baseUrl)) {
			throw new AiError(`Enter the ${this.label} address in the AI settings. It should start with http:// or https://.`);
		}

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

		let response;
		try {
			response = await requestUrl({
				url: `${this.baseUrl}${path}`,
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
				throw: false,
			});
		} catch {
			throw new AiError(`Could not reach ${this.label} at ${this.baseUrl}.`);
		}

		let json: unknown = null;
		try {
			json = response.json;
		} catch {
			// Not JSON; handled by the status checks below
		}

		if (response.status >= 200 && response.status < 300) {
			if (json === null) {
				throw new AiError(`${this.label} at ${this.baseUrl} did not answer like an OpenAI-style API. Check the address.`);
			}
			return json;
		}

		const detail = this.errorDetail(json);
		const status = response.status;
		if (status === 401 || status === 403) {
			throw new AiError(this.apiKey
				? `${this.label} rejected the API key. Check it in the AI settings.`
				: `${this.label} needs an API key. Add it in the AI settings.`, status);
		}
		if (status === 404) {
			throw new AiError(`${this.label} could not find ${path === '/models' ? 'its model list' : `the model "${this.model}"`} at ${this.baseUrl}.${detail}`, status);
		}
		if (status === 429) {
			throw new AiError(`${this.label} rate limit reached. Try again in a moment.`, status);
		}
		// llama.cpp, which LM Studio and others run on, reports a full context this way
		if (/failed to decode|context (length|window|size)|n_ctx|exceeds? the (available )?context/i.test(detail)) {
			throw new AiError(`${this.label} ran out of context for this request. Load the model with a larger context length (16,000 tokens or more) and try again.`, status, true);
		}
		throw new AiError(`${this.label} error ${status}.${detail}`, status);
	}

	private errorDetail(json: unknown): string {
		const error = (json as { error?: unknown })?.error;
		const message = typeof error === 'string'
			? error
			: (error as { message?: unknown })?.message;
		return typeof message === 'string' && message ? ` ${message}` : '';
	}
}

// ── LM Studio detection ──────────────────────────────────────────────────

export type LmStudioStatus =
	| { state: 'ready'; models: string[] }
	| { state: 'needs-key' }
	| { state: 'not-found' };

/** Looks for a running LM Studio server. Read-only: it only asks for the model list. */
export async function detectLmStudio(baseUrl: string, apiKey: string): Promise<LmStudioStatus> {
	const base = (baseUrl || LM_STUDIO_DEFAULT_URL).trim().replace(/\/+$/, '');
	const headers: Record<string, string> = {};
	if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

	try {
		const response = await requestUrl({ url: `${base}/models`, method: 'GET', headers, throw: false });
		if (response.status === 401 || response.status === 403) {
			return { state: 'needs-key' };
		}
		if (response.status === 200) {
			const data = (response.json as { data?: Array<{ id?: unknown }> })?.data;
			if (Array.isArray(data)) {
				return { state: 'ready', models: data.map(m => String(m?.id ?? '')).filter(Boolean) };
			}
		}
	} catch {
		// Nothing is listening there
	}
	return { state: 'not-found' };
}

/**
 * The model LM Studio should use when none is chosen: a loaded vision model if LM Studio
 * says it has one, otherwise the first model it lists.
 */
async function pickLmStudioModel(baseUrl: string, apiKey: string): Promise<string> {
	const base = (baseUrl || LM_STUDIO_DEFAULT_URL).trim().replace(/\/+$/, '');
	const headers: Record<string, string> = {};
	if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

	// LM Studio's own model list says which models can see images and which are loaded.
	// It is not part of the OpenAI format, so its absence is not an error.
	try {
		const origin = base.replace(/\/v1$/, '');
		const response = await requestUrl({ url: `${origin}/api/v0/models`, method: 'GET', headers, throw: false });
		if (response.status === 200) {
			const data = (response.json as { data?: Array<{ id?: unknown; type?: unknown; state?: unknown }> })?.data;
			if (Array.isArray(data)) {
				const vision = data.filter(m => m?.type === 'vlm' && typeof m?.id === 'string');
				const chosen = vision.find(m => m.state === 'loaded') ?? vision[0];
				if (chosen) return chosen.id as string;
			}
		}
	} catch {
		// Fall through to the OpenAI-style list
	}

	const status = await detectLmStudio(base, apiKey);
	if (status.state === 'needs-key') {
		throw new AiError('LM Studio needs an API key. Add it in the AI settings.');
	}
	if (status.state === 'not-found') {
		throw new AiError(`LM Studio was not found at ${base}. Start its server, or check the address in the AI settings.`);
	}
	if (status.models.length === 0) {
		throw new AiError('LM Studio has no models available. Download a vision model in LM Studio first.');
	}
	return status.models[0];
}

// ── Client selection ─────────────────────────────────────────────────────

async function createClient(provider: AiProviderType, config: AiProviderConfig | undefined): Promise<AiClient> {
	if (provider === 'none' || !config) {
		throw new AiError('No AI provider is selected. Choose one in Settings → Eagle Bridge → AI.');
	}
	const label = AI_PROVIDER_LABELS[provider];

	switch (provider) {
		case 'anthropic':
			if (!config.apiKey) throw new AiError('Add your Anthropic API key in the AI settings.');
			if (!config.model) throw new AiError('Choose an Anthropic model in the AI settings.');
			return new AnthropicClient(config);
		case 'openai':
			if (!config.apiKey) throw new AiError('Add your OpenAI API key in the AI settings.');
			return new OpenAiStyleClient(label, OPENAI_BASE_URL, config.apiKey, config.model, config.effort);
		case 'gemini':
			if (!config.apiKey) throw new AiError('Add your Gemini API key in the AI settings.');
			return new OpenAiStyleClient(label, GEMINI_BASE_URL, config.apiKey, config.model, config.effort);
		case 'openai-compatible':
			if (!config.baseUrl) throw new AiError('Enter the address of your OpenAI-compatible server in the AI settings.');
			return new OpenAiStyleClient(label, config.baseUrl, config.apiKey, config.model, config.effort);
		case 'lmstudio': {
			const baseUrl = config.baseUrl || LM_STUDIO_DEFAULT_URL;
			const model = config.model || await pickLmStudioModel(baseUrl, config.apiKey);
			return new OpenAiStyleClient(label, baseUrl, config.apiKey, model, config.effort);
		}
	}
}

/** Model names offered by a provider, for the settings tab. Also proves the key works. */
export async function listAiModels(provider: AiProviderType, config: AiProviderConfig): Promise<string[]> {
	// Listing models does not need one to be chosen yet
	const client = provider === 'lmstudio'
		? new OpenAiStyleClient(AI_PROVIDER_LABELS.lmstudio, config.baseUrl || LM_STUDIO_DEFAULT_URL, config.apiKey, config.model)
		: await createClient(provider, { ...config, model: config.model || 'unset' });
	return client.listModels();
}

// ── Image preparation ────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new AiError('This image could not be read, so it cannot be sent to the AI provider.'));
		img.src = url;
	});
}

/**
 * Loads an image and re-encodes it as a JPEG no larger than MAX_IMAGE_EDGE on its long
 * side. This keeps requests small and turns formats providers reject (SVG, AVIF, BMP…)
 * into one they all accept. Transparent areas become white.
 */
async function prepareImage(imageUrl: string): Promise<AiImage> {
	const img = await loadImage(imageUrl);
	// Vector images report no size of their own
	const sourceWidth = img.naturalWidth || 1024;
	const sourceHeight = img.naturalHeight || 1024;
	const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
	const width = Math.max(1, Math.round(sourceWidth * scale));
	const height = Math.max(1, Math.round(sourceHeight * scale));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new AiError('This image could not be prepared for the AI provider.');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(img, 0, 0, width, height);

	let dataUrl: string;
	try {
		dataUrl = canvas.toDataURL('image/jpeg', 0.85);
	} catch {
		throw new AiError('This image could not be prepared for the AI provider.');
	}
	return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' };
}

// ── Prompts and answer clean-up ──────────────────────────────────────────

const SYSTEM_PROMPT = 'You help someone catalogue images in Eagle, a personal asset library, so they can find each image again later. Answer with exactly what is asked for and nothing else: no preamble, no explanation, no quotation marks, no Markdown.';

function describeHints(hints: AiImageHints): string {
	let text = '';

	// What the person typed in the Hints box. Unlike the details below, they know what the
	// image is, and are counting on the model to fill in the rest.
	const userHints = hints.userHints?.trim();
	if (userHints) {
		text += `\n\nThe person adding this image says this about it:\n${userHints}\n\nTake that as true even where the image alone would not tell you, and build on it. It may be only a few words: work out what it refers to and bring in what you know about that subject, such as proper names, the work or series it belongs to, the people or places shown, and the right terms for them.`;
	}

	const lines: string[] = [];
	if (hints.fileName) lines.push(`File name: ${hints.fileName} (often meaningless, such as "image" or a random ID)`);
	if (hints.altText) lines.push(`Alt text from the page it came from: ${hints.altText}`);
	if (hints.sourcePageUrl) lines.push(`Page it came from: ${hints.sourcePageUrl}`);
	if (lines.length > 0) {
		text += `\n\nWhat is already known about this image. Use it only where it agrees with what you can see:\n${lines.join('\n')}`;
	}
	return text;
}

/** Removes the wrappers models add around a short answer: reasoning tags, fences, quotes, labels. */
export function cleanAiText(text: string): string {
	let cleaned = text
		.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
		.replace(/```[a-z]*\n?/gi, '')
		.trim();
	cleaned = cleaned.replace(/^(title|name|description|caption)\s*:\s*/i, '');
	cleaned = cleaned.replace(/^["'“”‘’`*_]+|["'“”‘’`*_]+$/g, '').trim();
	return cleaned;
}

/** A single-line title: no line breaks, no extension, no trailing full stop. */
export function cleanAiName(text: string): string {
	const firstLine = cleanAiText(text).split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0) || '';
	return cleanAiText(firstLine)
		.replace(/\.(png|jpe?g|gif|webp|svg|bmp|avif|tiff?|heic)$/i, '')
		.replace(/[\\/:*?"<>|]/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/[.。]+$/, '')
		.trim();
}

/** Turns a model's tag answer into a clean, de-duplicated list of tag names. */
export function parseAiTags(text: string): string[] {
	let lines = cleanAiText(text).split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
	// Some models answer on one line, separated by commas
	if (lines.length === 1 && lines[0].includes(',')) {
		lines = lines[0].split(',');
	}

	const seen = new Set<string>();
	const tags: string[] = [];
	for (const line of lines) {
		const tag = line
			.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
			.replace(/^#/, '')
			.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		const key = tag.toLowerCase();
		if (tag && tag.length <= 60 && !seen.has(key)) {
			seen.add(key);
			tags.push(tag);
		}
	}
	return tags;
}

/**
 * Sorts a model's tag answer into tags the library already has (returned with the
 * library's own spelling) and new ones, and applies the limits. What counts as existing
 * is decided here from the real tag list, never by the model.
 */
export function classifyAiTags(
	suggested: string[],
	existingTags: string[],
	appliedTags: string[],
	maxTags: number,
	maxNewTags: number
): Array<{ name: string; isNew: boolean }> {
	const existingByKey = new Map(existingTags.map(tag => [tag.toLowerCase(), tag]));
	const applied = new Set(appliedTags.map(tag => tag.toLowerCase()));

	const result: Array<{ name: string; isNew: boolean }> = [];
	let newCount = 0;
	for (const tag of suggested) {
		if (result.length >= maxTags) break;
		const key = tag.toLowerCase();
		if (applied.has(key)) continue;

		const existing = existingByKey.get(key);
		if (existing) {
			result.push({ name: existing, isNew: false });
		} else if (newCount < maxNewTags) {
			newCount++;
			result.push({ name: tag, isNew: true });
		}
	}
	return result;
}

function buildTagPrompt(
	tags: EagleTag[],
	totalTags: number,
	appliedTags: string[],
	hints: AiImageHints,
	maxTags: number,
	maxNewTags: number
): string {
	const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
	const parts: string[] = [
		`Suggest up to ${count(maxTags, 'tag')} for this image, most fitting first.`,
	];
	let answerFormat = 'Answer with one tag per line and nothing else.';

	// What is known about the image goes before the rules, so the rules are read last
	const hintText = describeHints(hints).trim();
	if (hintText) parts.push(hintText);

	if (tags.length > 0) {
		const listed = tags.map(tag => `${tag.name} (${tag.imageCount})`).join('\n');
		const scope = tags.length < totalTags
			? `The ${tags.length} most used of the library's ${totalTags} tags`
			: 'Every tag in the library';
		parts.push(`${scope}, each followed by how many items carry it:\n${listed}`);

		const rules: string[] = [
			'Use a tag from that list only when it clearly fits this image, and copy it exactly. Leave out any that do not fit: fewer tags is fine.',
		];
		if (maxNewTags > 0) {
			rules.push(`When something important about the image has no fitting tag in the list, add at most ${count(maxNewTags, 'new tag')}.`);
			rules.push('Write a new tag the way the library writes its tags: the same capitalization and the same language.');
			const prefixes = findTagPrefixes(tags);
			if (prefixes.length > 0) {
				rules.push(`This library files its tags under a prefix followed by a colon. The prefixes in use are: ${prefixes.join(', ')}. So write every new tag as "<prefix>: <value>", choosing the prefix that says what kind of thing the value is. A bare value with no prefix is wrong, unless none of those prefixes could describe it.`);
				// Repeated as the last thing the model reads: without it, a model that is not
				// reasoning tends to drop the prefix once hints give it names to use
				answerFormat = `Answer with one tag per line and nothing else. Every new tag starts with one of these prefixes and a colon: ${prefixes.join(', ')}.`;
			}
		} else {
			rules.push('Do not make up new tags.');
		}
		parts.push(rules.map(rule => `- ${rule}`).join('\n'));
	} else {
		parts.push(`The library has no tags yet, so propose at most ${count(maxNewTags, 'short, general tag')}.`);
	}

	if (appliedTags.length > 0) {
		parts.push(`Already applied, so leave these out: ${appliedTags.join(', ')}`);
	}

	parts.push(answerFormat);
	return parts.join('\n\n');
}

/** The "Prefix" parts of library tags written "Prefix: Value", most common first. */
function findTagPrefixes(tags: EagleTag[]): string[] {
	const counts = new Map<string, number>();
	for (const tag of tags) {
		const match = tag.name.match(/^([^:]{1,30}):\s*\S/);
		if (match) {
			const prefix = match[1].trim();
			counts.set(prefix, (counts.get(prefix) || 0) + 1);
		}
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 12)
		.map(([prefix]) => prefix);
}

// ── The assistant used by the folder picker's wands ──────────────────────

export class AiAssistant implements EagleAiAssistant {
	// The picker asks for a name, a description and tags about the same image
	private preparedImages = new Map<string, Promise<AiImage>>();

	constructor(
		private getSettings: () => CMDSPACEEagleSettings,
		private listTags: () => Promise<EagleTag[]>
	) {}

	async suggestName(imageUrl: string, hints: AiImageHints): Promise<string> {
		const answer = await this.ask(
			imageUrl,
			'Write a title for this image: 3 to 8 words that say what it shows, specific enough to tell it apart from similar images. No file extension and no full stop at the end.' + describeHints(hints)
		);
		const name = cleanAiName(answer);
		if (!name) throw new AiError('The model did not return a name.');
		return name;
	}

	async suggestDescription(imageUrl: string, hints: AiImageHints): Promise<string> {
		const answer = await this.ask(
			imageUrl,
			'Describe this image in one or two sentences: what it shows, any text that matters, and its style or medium if that is notable. Write it so a search for the subject would find it.' + describeHints(hints)
		);
		const description = cleanAiText(answer).replace(/\s*\n+\s*/g, ' ').trim();
		if (!description) throw new AiError('The model did not return a description.');
		return description;
	}

	async suggestTags(imageUrl: string, hints: AiImageHints, appliedTags: string[]): Promise<AiTagSuggestions> {
		const allTags = (await this.listTags())
			.filter(tag => tag?.name)
			.sort((a, b) => (b.imageCount || 0) - (a.imageCount || 0));
		const sentTags = allTags.slice(0, MAX_TAGS_IN_PROMPT);

		const { maxTags, maxNewTags } = resolveAiTagLimits(this.getSettings());
		if (allTags.length === 0 && maxNewTags === 0) {
			throw new AiError('Your Eagle library has no tags yet and new tags are set to 0, so there is nothing to suggest. Allow new tags in the AI settings.');
		}

		const answer = await this.ask(
			imageUrl,
			buildTagPrompt(sentTags, allTags.length, appliedTags, hints, maxTags, maxNewTags)
		);
		const tags = classifyAiTags(parseAiTags(answer), allTags.map(tag => tag.name), appliedTags, maxTags, maxNewTags);

		return {
			tags,
			truncatedTo: sentTags.length < allTags.length
				? { sent: sentTags.length, total: allTags.length }
				: undefined,
		};
	}

	private async ask(imageUrl: string, prompt: string): Promise<string> {
		const settings = this.getSettings();
		const provider = settings.aiProvider;
		const isLocalServer = provider === 'lmstudio' || provider === 'openai-compatible';
		const client = await createClient(provider, provider === 'none' ? undefined : settings.aiProviders[provider]);

		let prepared = this.preparedImages.get(imageUrl);
		if (!prepared) {
			prepared = prepareImage(imageUrl);
			this.preparedImages.set(imageUrl, prepared);
			// A failed load should be retried on the next click, not remembered
			prepared.catch(() => this.preparedImages.delete(imageUrl));
		}
		const image = await prepared;

		if (!isLocalServer) {
			return client.complete(SYSTEM_PROMPT, prompt, image);
		}

		const result = localRequestQueue.then(() => client.complete(SYSTEM_PROMPT, prompt, image));
		localRequestQueue = result.catch(() => undefined);
		return result;
	}
}
