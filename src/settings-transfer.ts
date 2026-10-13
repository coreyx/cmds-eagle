import { CMDSPACEEagleSettings, DEFAULT_SETTINGS } from './types';

// Exporting the settings to a file and importing them again, as a backup or to carry a setup
// to another vault or computer. Nothing here touches Obsidian, so it can be tested on its own.

export const SETTINGS_EXPORT_FORMAT = 'eagle-bridge-settings';

export interface SettingsExportFile {
	format: typeof SETTINGS_EXPORT_FORMAT;
	formatVersion: 1;
	pluginVersion: string;
	exportedAt: string;
	// False when passwords and API keys were left out
	includesSecrets: boolean;
	settings: Record<string, unknown>;
}

/** What importing a file would do, worked out before anything is changed. */
export interface SettingsImportPlan {
	// The settings as they would be after the import
	settings: CMDSPACEEagleSettings;
	// Each value that would change, as a dotted path such as "cloudProviders.webdav.serverUrl"
	changed: string[];
	// Entries in the file that are not settings this version has, or hold the wrong kind of value
	ignored: string[];
	// Whether the file carries any password or API key
	includesSecrets: boolean;
	pluginVersion: string | null;
	exportedAt: string | null;
}

type Json = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Json =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether a setting holds a credential, going by its name: anything called a key, secret,
 * password or token, and the custom upload provider's request headers, which usually carry
 * one. Matching by name means a credential added later is left out of exports without
 * anyone remembering to list it here.
 */
export function isSecretSettingName(name: string): boolean {
	return /key|secret|password|token/i.test(name) || name === 'headers';
}

function withoutSecrets(value: unknown): unknown {
	if (!isPlainObject(value)) return value;
	const result: Json = {};
	for (const [key, child] of Object.entries(value)) {
		if (isSecretSettingName(key)) continue;
		result[key] = withoutSecrets(child);
	}
	return result;
}

function hasSecret(value: unknown): boolean {
	if (!isPlainObject(value)) return false;
	return Object.entries(value).some(([key, child]) => {
		if (isSecretSettingName(key)) {
			return isPlainObject(child) ? Object.keys(child).length > 0 : child !== '' && child != null;
		}
		return hasSecret(child);
	});
}

/** The file written by an export. Only settings this version knows are included. */
export function buildSettingsExport(
	settings: CMDSPACEEagleSettings,
	pluginVersion: string,
	includeSecrets: boolean,
	now: Date = new Date()
): SettingsExportFile {
	const known: Json = {};
	for (const key of Object.keys(DEFAULT_SETTINGS)) {
		known[key] = (settings as unknown as Json)[key];
	}
	// A copy, so the caller's settings are never touched
	const copy = JSON.parse(JSON.stringify(known)) as Json;
	const exported = includeSecrets ? copy : withoutSecrets(copy) as Json;
	return {
		format: SETTINGS_EXPORT_FORMAT,
		formatVersion: 1,
		pluginVersion,
		exportedAt: now.toISOString(),
		includesSecrets: includeSecrets && hasSecret(exported),
		settings: exported,
	};
}

export function settingsExportFileName(now: Date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `eagle-bridge-settings-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

// Whether a value from a file is the same kind of thing as the setting it would replace
function sameKind(incoming: unknown, existing: unknown): boolean {
	if (Array.isArray(existing)) return Array.isArray(incoming);
	if (isPlainObject(existing)) return isPlainObject(incoming);
	return typeof incoming === typeof existing && !Array.isArray(incoming) && incoming !== null;
}

/**
 * `incoming` laid over `existing`. Objects are merged key by key, so a value the file leaves
 * out, such as a password, keeps what is already there. Lists and credentials' header sets
 * are replaced whole. `known`, when given, limits the keys to those it has.
 */
function mergeOver(existing: Json, incoming: Json, known: Json | null, path: string, ignored: string[]): Json {
	const result: Json = { ...existing };
	for (const [key, value] of Object.entries(incoming)) {
		const here = path ? `${path}.${key}` : key;
		if (known && !(key in known)) {
			ignored.push(here);
			continue;
		}
		const current = existing[key];
		const template = known ? known[key] : current;
		if (template !== undefined && !sameKind(value, template)) {
			ignored.push(here);
			continue;
		}
		// A top-level setting that is a map with built-in names (the cloud and AI providers)
		// only takes those names; anything deeper is merged as it comes
		const names = path === '' && isPlainObject(template) && Object.keys(template).length > 0 ? template : null;
		result[key] = isPlainObject(value) && isPlainObject(current) && key !== 'headers'
			? mergeOver(current, value, names, here, ignored)
			: value;
	}
	return result;
}

function listChanges(before: unknown, after: unknown, path: string, changed: string[]): void {
	if (isPlainObject(before) && isPlainObject(after) && !path.endsWith('.headers')) {
		for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
			listChanges(before[key], after[key], path ? `${path}.${key}` : key, changed);
		}
		return;
	}
	if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(path);
}

/**
 * Reads an exported settings file, or a plain copy of the plugin's data.json, and works out
 * what importing it over `current` would do. Throws an Error with a message for the user
 * when the text is not such a file.
 */
export function planSettingsImport(text: string, current: CMDSPACEEagleSettings): SettingsImportPlan {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text.replace(/^﻿/, ''));
	} catch {
		throw new Error('This is not a settings file: it could not be read as JSON.');
	}
	if (!isPlainObject(parsed)) {
		throw new Error('This is not an Eagle Bridge settings file.');
	}

	let source: Json;
	let pluginVersion: string | null = null;
	let exportedAt: string | null = null;
	if (parsed.format === SETTINGS_EXPORT_FORMAT) {
		if (!isPlainObject(parsed.settings)) {
			throw new Error('This settings file is damaged: it has no settings in it.');
		}
		source = parsed.settings;
		pluginVersion = typeof parsed.pluginVersion === 'string' ? parsed.pluginVersion : null;
		exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
	} else if (Object.keys(parsed).some(key => key in DEFAULT_SETTINGS)) {
		// A copy of data.json has the settings at the top level
		source = parsed;
	} else {
		throw new Error('This is not an Eagle Bridge settings file.');
	}

	const ignored: string[] = [];
	const before = JSON.parse(JSON.stringify(current)) as Json;
	const after = mergeOver(before, source, DEFAULT_SETTINGS as unknown as Json, '', ignored);
	const changed: string[] = [];
	listChanges(before, after, '', changed);

	return {
		settings: after as unknown as CMDSPACEEagleSettings,
		changed,
		ignored,
		includesSecrets: hasSecret(source),
		pluginVersion,
		exportedAt,
	};
}

/** Whether version `a` is newer than version `b`, comparing dotted numbers. */
export function isNewerVersion(a: string, b: string): boolean {
	const parts = (version: string) => version.split('.').map(part => parseInt(part, 10) || 0);
	const [x, y] = [parts(a), parts(b)];
	for (let i = 0; i < Math.max(x.length, y.length); i++) {
		if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
	}
	return false;
}
