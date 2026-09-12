import { requestUrl, RequestUrlResponse } from 'obsidian';
import { fsp } from './fs-utils';
import {
	EagleApiResponse,
	EagleItem,
	EagleFolder,
	EagleLibraryInfo,
	EagleApplicationInfo,
	CMDSPACEEagleSettings,
	R2UploadResult,
	EagleItemLinkFormat,
	EagleTag,
} from './types';

export class EagleApiService {
	private baseUrl: string;
	private timeout: number;
	private r2WorkerUrl: string;
	private r2ApiKey: string;
	private r2PublicUrl: string;

	constructor(settings: CMDSPACEEagleSettings) {
		this.baseUrl = settings.eagleApiBaseUrl;
		this.timeout = settings.connectionTimeout;
		this.r2WorkerUrl = settings.r2WorkerUrl;
		this.r2ApiKey = settings.r2ApiKey;
		this.r2PublicUrl = settings.r2PublicUrl;
	}

	updateSettings(settings: CMDSPACEEagleSettings): void {
		this.baseUrl = settings.eagleApiBaseUrl;
		this.timeout = settings.connectionTimeout;
		this.r2WorkerUrl = settings.r2WorkerUrl;
		this.r2ApiKey = settings.r2ApiKey;
		this.r2PublicUrl = settings.r2PublicUrl;
	}

	async isConnected(): Promise<boolean> {
		try {
			const info = await this.getApplicationInfo();
			return info !== null;
		} catch {
			return false;
		}
	}

	async getApplicationInfo(): Promise<EagleApplicationInfo | null> {
		try {
			const response = await this.get<EagleApplicationInfo>('/api/application/info');
			return response.data ?? null;
		} catch {
			return null;
		}
	}

	async listItems(options?: {
		keyword?: string;
		tags?: string[];
		folders?: string[];
		ext?: string;
		limit?: number;
		offset?: number;
		orderBy?: string;
	}): Promise<EagleItem[]> {
		const params = new URLSearchParams();
		
		if (options?.keyword) params.append('keyword', options.keyword);
		if (options?.tags?.length) params.append('tags', options.tags.join(','));
		if (options?.folders?.length) params.append('folders', options.folders.join(','));
		if (options?.ext) params.append('ext', options.ext);
		if (options?.limit) params.append('limit', options.limit.toString());
		if (options?.offset) params.append('offset', options.offset.toString());
		if (options?.orderBy) params.append('orderBy', options.orderBy);

		const queryString = params.toString();
		const endpoint = queryString ? `/api/item/list?${queryString}` : '/api/item/list';
		
		const response = await this.get<EagleItem[]>(endpoint);
		return response.data ?? [];
	}

	async getItemInfo(id: string): Promise<EagleItem | null> {
		try {
			const response = await this.get<EagleItem>(`/api/item/info?id=${id}`);
			return response.data ?? null;
		} catch {
			return null;
		}
	}

	async getThumbnailPath(id: string): Promise<string | null> {
		try {
			const response = await this.get<string>(`/api/item/thumbnail?id=${id}`);
			return response.data ?? null;
		} catch {
			return null;
		}
	}

	async updateItem(
		id: string,
		updates: {
			tags?: string[];
			annotation?: string;
			url?: string;
			star?: number;
		}
	): Promise<boolean> {
		try {
			const response = await this.post<null>('/api/item/update', {
				id,
				...updates,
			});
			return response.status === 'success';
		} catch {
			return false;
		}
	}

	async addFromUrl(options: {
		url: string;
		name: string;
		website?: string;
		tags?: string[];
		annotation?: string;
		folderId?: string;
		star?: number;
	}): Promise<boolean> {
		try {
			const response = await this.post<string>('/api/item/addFromURL', options);
			if (response.status === 'success') {
				if (response.data && typeof options.star === 'number' && options.star > 0) {
					await this.updateItem(response.data, { star: options.star });
				}
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	async addFromPath(options: {
		path: string;
		name: string;
		website?: string;
		tags?: string[];
		annotation?: string;
		folderId?: string;
		star?: number;
	}): Promise<{ success: boolean; itemId?: string }> {
		try {
			const response = await this.post<string>('/api/item/addFromPath', options);
			if (response.status === 'success' && response.data) {
				const itemId = response.data;
				if (typeof options.star === 'number' && options.star > 0) {
					await this.updateItem(itemId, { star: options.star });
				}
				return { success: true, itemId };
			}
			return { success: false };
		} catch {
			return { success: false };
		}
	}

	async listTags(): Promise<EagleTag[]> {
		try {
			const response = await this.get<EagleTag[]>('/api/tag/list');
			return response.data ?? [];
		} catch {
			return [];
		}
	}

	async listFolders(): Promise<EagleFolder[]> {
		try {
			const response = await this.get<EagleFolder[]>('/api/folder/list');
			return response.data ?? [];
		} catch {
			return [];
		}
	}

	async listRecentFolders(): Promise<EagleFolder[]> {
		try {
			const response = await this.get<EagleFolder[]>('/api/folder/listRecent');
			return response.data ?? [];
		} catch {
			return [];
		}
	}

	async createFolder(params: { folderName: string; parent?: string }): Promise<EagleFolder | null> {
		try {
			const response = await this.post<EagleFolder>('/api/folder/create', params);
			if (response.status === 'success' && response.data) {
				return response.data;
			}
			return null;
		} catch {
			return null;
		}
	}

	async getLibraryInfo(): Promise<EagleLibraryInfo | null> {
		try {
			const response = await this.get<EagleLibraryInfo>('/api/library/info');
			return response.data ?? null;
		} catch {
			return null;
		}
	}

	async getLibraryPath(): Promise<string | null> {
		try {
			const response = await requestUrl({
				url: `${this.baseUrl}/api/library/info`,
				method: 'GET',
			});
			const json = response.json as {
				status?: string;
				data?: { library?: string | { path?: string }; path?: string };
			};

			if (json?.status === 'success' && json?.data) {
				const data = json.data;
				if (typeof data.library === 'string') {
					return data.library;
				}
				if (typeof data.library?.path === 'string') {
					return data.library.path;
				}
				if (typeof data.path === 'string') {
					return data.path;
				}
			}
			return null;
		} catch (e) {
			console.error('[CMDS Eagle] getLibraryPath error:', e);
			return null;
		}
	}

	async getLibraryName(): Promise<string | null> {
		const path = await this.getLibraryPath();
		if (!path) return null;
		
		const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
		const match = normalized.match(/([^/]+)\.library$/i);
		if (match) {
			return match[1];
		}
		return normalized.split('/').filter(Boolean).pop()?.replace(/\.library$/i, '') || null;
	}

	async refreshThumbnail(id: string): Promise<boolean> {
		try {
			const response = await this.post<null>('/api/item/refreshThumbnail', { id });
			return response.status === 'success';
		} catch {
			return false;
		}
	}

	async testR2Connection(): Promise<boolean> {
		if (!this.r2WorkerUrl || !this.r2ApiKey) {
			return false;
		}
		try {
			const response = await requestUrl({
				url: `${this.r2WorkerUrl}/health`,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.r2ApiKey}`,
				},
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}

	async getOriginalFilePath(item: EagleItem): Promise<string | null> {
		const thumbnailPath = await this.getThumbnailPath(item.id);
		if (thumbnailPath) {
			console.log('[CMDS Eagle] thumbnailPath:', thumbnailPath);
			const decodedPath = this.safeDecodeUri(thumbnailPath);
			const folderPath = decodedPath.substring(0, decodedPath.lastIndexOf('/'));
			const originalPath = `${folderPath}/${item.name}.${item.ext}`;
			console.log('[CMDS Eagle] originalPath:', originalPath);
			return originalPath;
		}

		const libraryPath = await this.getLibraryPath();
		if (libraryPath && typeof libraryPath === 'string') {
			const originalPath = `${libraryPath}/images/${item.id}.info/${item.name}.${item.ext}`;
			console.log('[CMDS Eagle] originalPath (from library):', originalPath);
			return originalPath;
		}

		console.log('[CMDS Eagle] Could not get file path for item:', item.id);
		return null;
	}

	private safeDecodeUri(str: string): string {
		try {
			return decodeURIComponent(str);
		} catch {
			return str;
		}
	}

	async uploadToR2(item: EagleItem): Promise<R2UploadResult> {
		if (!this.r2WorkerUrl || !this.r2ApiKey || !this.r2PublicUrl) {
			return { success: false, error: 'R2 settings not configured' };
		}

		const existingKey = getR2KeyFromItem(item);
		if (existingKey) {
			return { 
				success: true, 
				key: existingKey,
				filename: item.name,
			};
		}

		try {
			const filePath = await this.getOriginalFilePath(item);
			if (!filePath) {
				return { success: false, error: 'Could not get file path from Eagle' };
			}

			let fileBuffer: Buffer;
			try {
				fileBuffer = await fsp.readFile(filePath);
			} catch {
				return {
					success: false, 
					error: `Could not read file: ${filePath}` 
				};
			}

			const mimeType = getMimeType(item.ext);
			const blob = new Blob([fileBuffer], { type: mimeType });
			const filename = `${item.name}.${item.ext}`;

			const formData = new FormData();
			formData.append('file', blob, filename);
			formData.append('filename', filename);
			formData.append('content_type', mimeType);
			formData.append('eagle_id', item.id);

			const response = await window.fetch(`${this.r2WorkerUrl}/upload`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.r2ApiKey}`,
				},
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				return { success: false, error: `Upload failed (${response.status}): ${errorText}` };
			}

			const result = await response.json() as { success: boolean; key: string; filename: string };
			
			const r2Tag = `r2:${result.key}`;
			const newTags = [...item.tags];
			if (!newTags.includes(r2Tag)) {
				newTags.push(r2Tag);
			}
			if (!newTags.includes('r2-cloud')) {
				newTags.push('r2-cloud');
			}
			await this.updateItem(item.id, { tags: newTags });

			return {
				success: true,
				key: result.key,
				filename: result.filename,
			};
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Unknown error' 
			};
		}
	}

	getCloudUrl(item: EagleItem): string | null {
		const key = getR2KeyFromItem(item);
		if (!key || !this.r2PublicUrl) {
			return null;
		}
		return `${this.r2PublicUrl}/${key}`;
	}

	getLocalThumbnailUrl(id: string): string {
		return `${this.baseUrl}/api/item/thumbnail?id=${id}`;
	}

	private async get<T>(endpoint: string): Promise<EagleApiResponse<T>> {
		const response: RequestUrlResponse = await requestUrl({
			url: `${this.baseUrl}${endpoint}`,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		return response.json as EagleApiResponse<T>;
	}

	private async post<T>(endpoint: string, body: unknown): Promise<EagleApiResponse<T>> {
		const response: RequestUrlResponse = await requestUrl({
			url: `${this.baseUrl}${endpoint}`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});
		return response.json as EagleApiResponse<T>;
	}

	async addExtraLinks(
		baseUrl: string,
		itemId: string,
		links: string | { title?: string; url: string } | Array<string | { title?: string; url: string }>,
		retries: number = 4
	): Promise<{ success: boolean; error?: string }> {
		const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
		let body: Record<string, any>;

		if (typeof links === 'string') {
			body = { url: links, allowDuplicates: false };
		} else if (Array.isArray(links)) {
			if (links.length === 1) {
				const first = links[0];
				if (typeof first === 'string') {
					body = { url: first, allowDuplicates: false };
				} else {
					body = {
						...(first.title ? { title: first.title } : {}),
						url: first.url,
						allowDuplicates: false,
					};
				}
			} else {
				const hasObjects = links.some(l => typeof l === 'object' && l !== null);
				if (hasObjects) {
					const linkObjects = links.map(l => (typeof l === 'string' ? { url: l } : { ...(l.title ? { title: l.title } : {}), url: l.url }));
					body = { links: linkObjects, allowDuplicates: false };
				} else {
					const urlStrings = links.map(l => (typeof l === 'string' ? l : l.url));
					body = { urls: urlStrings, allowDuplicates: false };
				}
			}
		} else if (typeof links === 'object' && links !== null) {
			body = {
				...(links.title ? { title: links.title } : {}),
				url: links.url,
				allowDuplicates: false,
			};
		} else {
			body = { url: String(links), allowDuplicates: false };
		}

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const response = await requestUrl({
					url: `${cleanBaseUrl}/api/item/${encodeURIComponent(itemId)}/links`,
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(body),
				});

				if (response.status >= 200 && response.status < 300) {
					const json = response.json as { status?: string; message?: string };
					if (json && json.status === 'error') {
						return { success: false, error: json.message || 'Error from Eagle Extra Links' };
					}
					return { success: true };
				}

				return {
					success: false,
					error: `HTTP ${response.status}`,
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				const isNotFound = errorMessage.includes('404') || (error as any)?.status === 404;
				if (isNotFound && attempt < retries) {
					const delayMs = 500 * (attempt + 1);
					await new Promise(resolve => setTimeout(resolve, delayMs));
					continue;
				}
				return {
					success: false,
					error: errorMessage,
				};
			}
		}

		return { success: false, error: 'Request failed after retries' };
	}

	async getExtraLinkWebSource(itemId: string): Promise<string | null> {
		const sources = await this.getExtraLinkWebSources(itemId);
		return sources.pageUrl || sources.imageUrl || null;
	}

	async getExtraLinkWebSources(itemId: string): Promise<{ pageUrl: string | null; imageUrl: string | null }> {
		try {
			const libraryPath = await this.getLibraryPath();
			if (!libraryPath) return { pageUrl: null, imageUrl: null };
			const extraPath = `${libraryPath}/images/${itemId}.info/extra-links.json`;
			const buffer = await fsp.readFile(extraPath);
			const data = JSON.parse(buffer.toString('utf8'));
			let pageUrl: string | null = null;
			let imageUrl: string | null = null;

			if (Array.isArray(data?.links)) {
				for (const link of data.links) {
					if (link && typeof link.url === 'string') {
						const clean = link.url.replace(/\0/g, '').trim();
						if (/^https?:\/\//i.test(clean)) {
							const title = typeof link.title === 'string' ? link.title : '';
							if (title.startsWith('Direct Image') || /\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)(\?.*)?$/i.test(clean)) {
								if (!imageUrl) imageUrl = clean;
							} else {
								if (!pageUrl) pageUrl = clean;
							}
						}
					}
				}
			}
			return { pageUrl, imageUrl };
		} catch {
			return { pageUrl: null, imageUrl: null };
		}
	}
}

export function buildEagleItemUrl(
	itemId: string,
	format: EagleItemLinkFormat = 'http',
	baseUrl: string = 'http://localhost:41595'
): string {
	if (format === 'eagle') {
		return `eagle://item/${itemId}`;
	}
	const cleanBase = (baseUrl || 'http://localhost:41595').replace(/\/+$/, '');
	return `${cleanBase}/item?id=${itemId}`;
}

export function buildEagleFolderUrl(folderId: string): string {
	return `eagle://folder/${folderId}`;
}

export function parseEagleUrl(url: string): { type: 'item' | 'folder'; id: string } | null {
	const itemMatch = url.match(/^eagle:\/\/item\/([A-Z0-9]+)$/i);
	if (itemMatch) {
		return { type: 'item', id: itemMatch[1] };
	}

	const folderMatch = url.match(/^eagle:\/\/folder\/([A-Z0-9]+)$/i);
	if (folderMatch) {
		return { type: 'folder', id: folderMatch[1] };
	}

	return null;
}

export function parseEagleLocalhostUrl(url: string): string | null {
	const match = url.match(/^https?:\/\/localhost:\d+\/item\?id=([A-Z0-9]+)$/i);
	if (match) {
		return match[1];
	}
	return null;
}

export function isEagleLocalhostUrl(url: string): boolean {
	return /^https?:\/\/localhost:\d+\/item\?id=[A-Z0-9]+$/i.test(url);
}

export function extractEagleItemId(text: string): string | null {
	if (!text) return null;
	const trimmed = text.trim();

	// eagle://item/{itemId}
	const itemMatch = trimmed.match(/^eagle:\/\/item\/([A-Za-z0-9]+)$/i);
	if (itemMatch) return itemMatch[1];

	// http(s)://localhost:{port}/item?id={itemId}
	const localhostMatch = trimmed.match(/^https?:\/\/localhost:\d+\/item\?id=([A-Za-z0-9]+)$/i);
	if (localhostMatch) return localhostMatch[1];

	// eagle://{itemId}.info/{filename}
	const legacyMatch = trimmed.match(/^eagle:\/\/([A-Za-z0-9]+)\.info\//i);
	if (legacyMatch) return legacyMatch[1];

	return null;
}

export function isEagleUrl(text: string): boolean {
	return extractEagleItemId(text) !== null;
}

export function buildEagleCustomEmbedUrl(
	prefix: string,
	libraryName: string,
	itemId: string,
	filenameWithoutExt: string,
	ext: string,
	isThumbnail: boolean
): string {
	const cleanPrefix = prefix.replace(/\/+$/, '');
	const normalizedLib = libraryName.replace(/\\/g, '/').replace(/\/+$/, '');
	const baseName = normalizedLib.split('/').filter(Boolean).pop()?.replace(/\.library$/i, '') || 'Main';
	const libDir = `${baseName}.library`;
	const cleanExt = ext.replace(/^\./, '');
	const targetFile = isThumbnail
		? `${encodeURIComponent(filenameWithoutExt)}_thumbnail.png`
		: `${encodeURIComponent(filenameWithoutExt)}.${cleanExt}`;
	return `${cleanPrefix}/${libDir}/images/${itemId}.info/${targetFile}`;
}

export function buildEagleLocalhostThumbnailUrl(baseUrl: string, id: string): string {
	return `${baseUrl}/api/item/thumbnail?id=${id}`;
}

export function getR2KeyFromItem(item: EagleItem): string | null {
	const r2Tag = item.tags.find(t => t.startsWith('r2:'));
	if (r2Tag) {
		return r2Tag.slice(3);
	}
	return null;
}

export function hasR2Upload(item: EagleItem): boolean {
	return item.tags.some(t => t.startsWith('r2:'));
}

const MIME_TYPES: Record<string, string> = {
	'jpg': 'image/jpeg',
	'jpeg': 'image/jpeg',
	'png': 'image/png',
	'gif': 'image/gif',
	'webp': 'image/webp',
	'svg': 'image/svg+xml',
	'bmp': 'image/bmp',
	'ico': 'image/x-icon',
	'tiff': 'image/tiff',
	'tif': 'image/tiff',
	'heic': 'image/heic',
	'heif': 'image/heif',
	'avif': 'image/avif',
};

function getMimeType(ext: string): string {
	return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}
