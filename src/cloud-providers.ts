import { requestUrl } from 'obsidian';
import { fsp } from './fs-utils';
import {
	CloudUploadResult,
	R2ProviderConfig,
	S3ProviderConfig,
	WebDAVProviderConfig,
	ImgHippoProviderConfig,
	CustomProviderConfig,
	AnyCloudProviderConfig,
} from './types';

export interface CloudUploadOptions {
	/**
	 * Store the file under exactly this name (no timestamp prefix), replacing any file already
	 * there, so the same source always maps to the same URL. Ignored by providers that
	 * choose their own file names.
	 */
	stableName?: string;
}

export interface CloudProvider {
	upload(filePath: string, filename: string, mimeType: string, options?: CloudUploadOptions): Promise<CloudUploadResult>;
	testConnection(): Promise<boolean>;
	getPublicUrl(key: string): string;
	/** Public URL for `sourceUrl` if that file already lives with this provider, else null. */
	findExistingPublicUrl?(sourceUrl: string): Promise<string | null>;
	/** Public URL of a file previously uploaded with this `stableName`, else null. */
	findExistingUpload?(stableName: string): Promise<string | null>;
}

/** True only when the server positively says the file is gone; unreachable servers don't count. */
export async function isPublicUrlGone(url: string): Promise<boolean> {
	try {
		const response = await requestUrl({
			url,
			method: 'HEAD',
			headers: { 'X-Requested-With': 'XMLHttpRequest' },
			throw: false,
		});
		return response.status === 404 || response.status === 410;
	} catch {
		return false;
	}
}

function getMimeType(ext: string): string {
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
		'pdf': 'application/pdf',
	};
	return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

export class R2Provider implements CloudProvider {
	constructor(private config: R2ProviderConfig) {}

	async upload(filePath: string, filename: string, mimeType: string): Promise<CloudUploadResult> {
		if (!this.config.workerUrl || !this.config.apiKey) {
			return { success: false, error: 'R2 not configured' };
		}

		try {
			const fileBuffer = await fsp.readFile(filePath);
			const blob = new Blob([fileBuffer], { type: mimeType });

			const formData = new FormData();
			formData.append('file', blob, filename);
			formData.append('filename', filename);
			formData.append('content_type', mimeType);

			const response = await window.fetch(`${this.config.workerUrl}/upload`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`,
				},
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				return { success: false, error: `Upload failed (${response.status}): ${errorText}` };
			}

			const result = await response.json() as { success: boolean; key: string; filename: string };
			return {
				success: true,
				key: result.key,
				filename: result.filename,
				publicUrl: this.getPublicUrl(result.key),
			};
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Unknown error' 
			};
		}
	}

	async testConnection(): Promise<boolean> {
		if (!this.config.workerUrl || !this.config.apiKey) {
			return false;
		}
		try {
			const response = await window.fetch(`${this.config.workerUrl}/health`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`,
				},
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}

	getPublicUrl(key: string): string {
		return `${this.config.publicUrl}/${key}`;
	}
}

export class S3Provider implements CloudProvider {
	constructor(private config: S3ProviderConfig) {}

	async upload(filePath: string, filename: string, mimeType: string): Promise<CloudUploadResult> {
		if (!this.config.endpoint || !this.config.accessKeyId || !this.config.secretAccessKey) {
			return { success: false, error: 'S3 not configured' };
		}

		try {
			const fileBuffer = await fsp.readFile(filePath);
			const key = `eagle/${Date.now()}-${filename}`;
			
			const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
			const dateStamp = date.slice(0, 8);
			
			const host = new URL(this.config.endpoint).host;
			const canonicalUri = `/${this.config.bucket}/${key}`;
			const canonicalQueryString = '';
			const payloadHash = await this.sha256(fileBuffer);
			
			const canonicalHeaders = [
				`content-type:${mimeType}`,
				`host:${host}`,
				`x-amz-content-sha256:${payloadHash}`,
				`x-amz-date:${date}`,
			].join('\n') + '\n';
			
			const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
			
			const canonicalRequest = [
				'PUT',
				canonicalUri,
				canonicalQueryString,
				canonicalHeaders,
				signedHeaders,
				payloadHash,
			].join('\n');
			
			const algorithm = 'AWS4-HMAC-SHA256';
			const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
			const stringToSign = [
				algorithm,
				date,
				credentialScope,
				await this.sha256(new TextEncoder().encode(canonicalRequest)),
			].join('\n');
			
			const signingKey = await this.getSignatureKey(
				this.config.secretAccessKey,
				dateStamp,
				this.config.region,
				's3'
			);
			const signature = await this.hmacHex(signingKey, stringToSign);
			
			const authorizationHeader = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
			
			const response = await window.fetch(`${this.config.endpoint}/${this.config.bucket}/${key}`, {
				method: 'PUT',
				headers: {
					'Content-Type': mimeType,
					'x-amz-content-sha256': payloadHash,
					'x-amz-date': date,
					'Authorization': authorizationHeader,
				},
				body: fileBuffer,
			});

			if (!response.ok) {
				const errorText = await response.text();
				return { success: false, error: `S3 upload failed (${response.status}): ${errorText}` };
			}

			return {
				success: true,
				key: key,
				filename: filename,
				publicUrl: this.getPublicUrl(key),
			};
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Unknown error' 
			};
		}
	}

	async testConnection(): Promise<boolean> {
		if (!this.config.endpoint || !this.config.accessKeyId) {
			return false;
		}
		try {
			const response = await window.fetch(`${this.config.endpoint}/${this.config.bucket}`, {
				method: 'HEAD',
			});
			return response.status < 500;
		} catch {
			return false;
		}
	}

	getPublicUrl(key: string): string {
		if (this.config.publicUrl) {
			return `${this.config.publicUrl}/${key}`;
		}
		return `${this.config.endpoint}/${this.config.bucket}/${key}`;
	}

	private async sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		return Array.from(new Uint8Array(hashBuffer))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');
	}

	private async hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			key,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
	}

	private async hmacHex(key: ArrayBuffer, data: string): Promise<string> {
		const sig = await this.hmac(key, data);
		return Array.from(new Uint8Array(sig))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');
	}

	private async getSignatureKey(
		key: string,
		dateStamp: string,
		region: string,
		service: string
	): Promise<ArrayBuffer> {
		const kDate = await this.hmac(new TextEncoder().encode('AWS4' + key), dateStamp);
		const kRegion = await this.hmac(kDate, region);
		const kService = await this.hmac(kRegion, service);
		return await this.hmac(kService, 'aws4_request');
	}
}

export class WebDAVProvider implements CloudProvider {
	constructor(private config: WebDAVProviderConfig) {}

	// Upload directory as '' or '/dir[/sub]', without a trailing slash
	private getUploadDir(): string {
		let path = this.config.uploadPath || '';
		if (path && !path.startsWith('/')) path = '/' + path;
		if (path && path.endsWith('/')) path = path.slice(0, -1);
		return path;
	}

	async findExistingUpload(stableName: string): Promise<string | null> {
		const url = this.getPublicUrl(`${this.getUploadDir()}/${stableName}`);
		try {
			// Nextcloud rejects non-GET requests to public shares without this header
			const response = await requestUrl({
				url,
				method: 'HEAD',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
				throw: false,
			});
			return response.status >= 200 && response.status < 300 ? url : null;
		} catch {
			return null;
		}
	}

	async upload(filePath: string, filename: string, mimeType: string, options?: CloudUploadOptions): Promise<CloudUploadResult> {
		if (!this.config.serverUrl || !this.config.username) {
			return { success: false, error: 'WebDAV not configured' };
		}

		try {
			const fileBuffer = await fsp.readFile(filePath);

			const path = this.getUploadDir();

			const key = options?.stableName
				? `${path}/${options.stableName}`
				: `${path}/${Date.now()}-${filename}`;

			let server = this.config.serverUrl;
			if (server.endsWith('/')) server = server.slice(0, -1);
			
			const uploadUrl = `${server}${key}`;

			const auth = btoa(`${this.config.username}:${this.config.password}`);

			const put = () => requestUrl({
				url: uploadUrl,
				method: 'PUT',
				headers: {
					'Authorization': `Basic ${auth}`,
					'Content-Type': mimeType,
				},
				body: new Uint8Array(fileBuffer).buffer as ArrayBuffer,
				throw: false,
			});

			let response = await put();

			// A missing target directory surfaces as 409 Conflict on most servers and as
			// 404 Not Found on Nextcloud (sabre/dav). Create each level of the upload path
			// with MKCOL (already-existing levels are ignored), then retry the PUT.
			if ((response.status === 409 || response.status === 404) && path) {
				let dir = '';
				for (const segment of path.split('/').filter(s => s.length > 0)) {
					dir += `/${segment}`;
					await requestUrl({
						url: `${server}${dir}`,
						method: 'MKCOL',
						headers: {
							'Authorization': `Basic ${auth}`,
						},
						throw: false,
					});
				}

				response = await put();
			}

			if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
				if (response.status === 409 || response.status === 404) {
					return { success: false, error: `WebDAV upload failed (${response.status}). Check the server URL and ensure the upload path '${this.config.uploadPath}' exists on your server.` };
				}
				return { success: false, error: `WebDAV upload failed (${response.status})` };
			}

			return {
				success: true,
				key: key,
				filename: filename,
				publicUrl: this.getPublicUrl(key),
			};
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Unknown error' 
			};
		}
	}

	async testConnection(): Promise<boolean> {
		if (!this.config.serverUrl || !this.config.username) {
			return false;
		}
		try {
			const auth = btoa(`${this.config.username}:${this.config.password}`);
			const response = await requestUrl({
				url: this.config.serverUrl,
				method: 'PROPFIND',
				headers: {
					'Authorization': `Basic ${auth}`,
					'Depth': '0',
				},
				throw: false,
			});
			return response.status === 207 || response.status === 200;
		} catch {
			return false;
		}
	}

	/**
	 * Checks the server login and, when the Public URL is a Nextcloud public share,
	 * that the share serves files without a login. Read-only: nothing is uploaded.
	 */
	async checkConnection(): Promise<{ ok: boolean; message: string }> {
		const serverUrl = this.config.serverUrl;
		if (!serverUrl || !this.config.username) {
			return { ok: false, message: 'Enter the Server URL and username first.' };
		}
		if (!/^https?:\/\//.test(serverUrl) || serverUrl.split('://').length > 2) {
			return { ok: false, message: 'Server URL looks malformed. It should be a single address starting with http:// or https://.' };
		}

		try {
			const auth = btoa(`${this.config.username}:${this.config.password}`);
			const response = await requestUrl({
				url: serverUrl,
				method: 'PROPFIND',
				headers: {
					'Authorization': `Basic ${auth}`,
					'Depth': '0',
				},
				throw: false,
			});
			if (response.status === 401) {
				return { ok: false, message: 'Login rejected (401). Check the username and password.' };
			}
			if (response.status === 404) {
				return { ok: false, message: 'Server URL not found (404). Check the address and that the folder exists.' };
			}
			if (response.status !== 207 && response.status !== 200) {
				return { ok: false, message: `Server responded with ${response.status}. Check that the Server URL is a WebDAV address.` };
			}
		} catch (error) {
			return { ok: false, message: `Could not reach the server: ${error instanceof Error ? error.message : 'unknown error'}` };
		}

		if (!this.config.publicUrl) {
			return { ok: true, message: 'Connected. No Public URL is set, so image links will use the Server URL.' };
		}

		const publicUrl = resolveWebDAVPublicUrl(this.config.publicUrl, !this.config.disableShareLinkConversion);
		if (!publicUrl.includes('/public.php/dav/files/')) {
			return { ok: true, message: 'Connected.' };
		}

		try {
			// Nextcloud rejects non-GET requests to public shares without this header
			const response = await requestUrl({
				url: publicUrl,
				method: 'PROPFIND',
				headers: {
					'Depth': '0',
					'X-Requested-With': 'XMLHttpRequest',
				},
				throw: false,
			});
			if (response.status === 207 || response.status === 200) {
				return { ok: true, message: 'Connected, and the public share is reachable without a login.' };
			}
			if (response.status === 401) {
				return { ok: false, message: 'Connected, but the public share asks for a password, so embedded images will not display.' };
			}
			return { ok: false, message: `Connected, but the public share was not found (${response.status}). Check the share link.` };
		} catch (error) {
			return { ok: false, message: `Connected, but the public share could not be reached: ${error instanceof Error ? error.message : 'unknown error'}` };
		}
	}

	/**
	 * If `sourceUrl` is a file that already lives on this server (under the Public URL or the
	 * Server URL), returns its public URL so it can be embedded without uploading another copy.
	 * Returns null when the file is elsewhere or the public URL does not serve it.
	 */
	async findExistingPublicUrl(sourceUrl: string): Promise<string | null> {
		const publicBase = this.normalizeBase(resolveWebDAVPublicUrl(
			this.config.publicUrl || this.config.serverUrl,
			!this.config.disableShareLinkConversion
		));
		const serverBase = this.normalizeBase(this.config.serverUrl);
		if (!publicBase) return null;

		let source: string;
		try {
			const parsed = new URL(sourceUrl);
			// Ignore query and fragment; only a path ending in a file name can be a stored file
			if (!/\/[^/]+\.[A-Za-z0-9]+$/.test(parsed.pathname)) return null;
			source = `${parsed.origin}${parsed.pathname}`;
		} catch {
			return null;
		}

		const base = [publicBase, serverBase].find(b => b && source.startsWith(`${b}/`));
		if (!base) return null;
		const candidate = `${publicBase}${source.slice(base.length)}`;

		try {
			// Nextcloud rejects non-GET requests to public shares without this header
			const response = await requestUrl({
				url: candidate,
				method: 'HEAD',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
				throw: false,
			});
			return response.status >= 200 && response.status < 300 ? candidate : null;
		} catch {
			return null;
		}
	}

	// Origin + path without trailing slashes, with the host lower-cased by URL parsing
	private normalizeBase(url: string): string | null {
		try {
			const parsed = new URL(url.trim());
			return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
		} catch {
			return null;
		}
	}

	getPublicUrl(key: string): string {
		// `key` starts with '/', and the resolved base has no trailing slash
		const base = resolveWebDAVPublicUrl(
			this.config.publicUrl || this.config.serverUrl,
			!this.config.disableShareLinkConversion
		);
		return `${base}${key}`;
	}
}

/**
 * Nextcloud hands out public share links as `https://host/s/TOKEN` (or `/index.php/s/TOKEN`),
 * which open a web page. The files in the share are served from `/public.php/dav/files/TOKEN`,
 * so convert a pasted share link to that form unless `convertShareLinks` is off.
 * Other URLs only lose their trailing slashes.
 */
export function resolveWebDAVPublicUrl(url: string, convertShareLinks = true): string {
	const trimmed = url.trim().replace(/\/+$/, '');
	const share = convertShareLinks && trimmed.match(/^(https?:\/\/.+?)(?:\/index\.php)?\/s\/([A-Za-z0-9]+)$/);
	if (share) {
		return `${share[1]}/public.php/dav/files/${share[2]}`;
	}
	return trimmed;
}

export class ImgHippoProvider implements CloudProvider {
	private readonly API_URL = 'https://api.imghippo.com/v1/upload';
	
	constructor(private config: ImgHippoProviderConfig) {}

	async upload(filePath: string, filename: string, mimeType: string): Promise<CloudUploadResult> {
		if (!this.config.apiKey) {
			return { success: false, error: 'ImgHippo API key not configured' };
		}

		try {
			const fileBuffer = await fsp.readFile(filePath);

			// Obsidian blocks cross-origin window.fetch (CORS), so use requestUrl with a
			// manually-built multipart/form-data body (requestUrl bypasses CORS).
			const boundary = `----CmdsEagleBoundary${Date.now().toString(16)}`;
			const encoder = new TextEncoder();
			const head = encoder.encode(
				`--${boundary}\r\nContent-Disposition: form-data; name="api_key"\r\n\r\n${this.config.apiKey}\r\n` +
				`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${filename}\r\n` +
				`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
			);
			const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
			const body = new Uint8Array(head.length + fileBuffer.length + tail.length);
			body.set(head, 0);
			body.set(fileBuffer, head.length);
			body.set(tail, head.length + fileBuffer.length);

			const response = await requestUrl({
				url: this.API_URL,
				method: 'POST',
				contentType: `multipart/form-data; boundary=${boundary}`,
				body: body.buffer as ArrayBuffer,
				throw: false,
			});

			if (response.status < 200 || response.status >= 300) {
				return { success: false, error: `ImgHippo upload failed (${response.status}): ${(response.text || '').slice(0, 200)}` };
			}

			const result = response.json as {
				success: boolean;
				status: number;
				message?: string;
				data?: {
					id: string;
					title: string;
					url_viewer: string;
					url: string;
					display_url: string;
					width: string;
					height: string;
					size: string;
					time: string;
					expiration: string;
					image: {
						filename: string;
						name: string;
						mime: string;
						extension: string;
						url: string;
					};
					thumb: {
						filename: string;
						name: string;
						mime: string;
						extension: string;
						url: string;
					};
					delete_url: string;
				};
			};

			if (!result.success || !result.data) {
				return { success: false, error: result.message || 'Upload failed' };
			}

			const publicUrl = result.data.url || result.data.display_url || result.data.image?.url;
			const resultFilename = result.data.image?.filename || result.data.title || filename;

			if (!publicUrl) {
				return { success: false, error: 'No URL returned from ImgHippo' };
			}

			return {
				success: true,
				key: result.data.id,
				filename: resultFilename,
				publicUrl: publicUrl,
			};
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Unknown error' 
			};
		}
	}

	async testConnection(): Promise<boolean> {
		return !!this.config.apiKey;
	}

	getPublicUrl(key: string): string {
		return key;
	}
}

export class CustomProvider implements CloudProvider {
	constructor(private config: CustomProviderConfig) {}

	async upload(filePath: string, filename: string, mimeType: string): Promise<CloudUploadResult> {
		if (!this.config.uploadUrl) {
			return { success: false, error: 'Custom provider not configured' };
		}

		try {
			const fileBuffer = await fsp.readFile(filePath);
			const blob = new Blob([fileBuffer], { type: mimeType });

			const formData = new FormData();
			formData.append('file', blob, filename);
			formData.append('filename', filename);

			const response = await window.fetch(this.config.uploadUrl, {
				method: 'POST',
				headers: this.config.headers,
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				return { success: false, error: `Upload failed (${response.status}): ${errorText}` };
			}

			const result = await response.json() as { key?: string; url?: string; filename?: string };
			const key = result.key || result.url || filename;
			
			return {
				success: true,
				key: key,
				filename: result.filename || filename,
				publicUrl: this.getPublicUrl(key),
			};
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Unknown error' 
			};
		}
	}

	async testConnection(): Promise<boolean> {
		if (!this.config.uploadUrl) {
			return false;
		}
		try {
			const response = await window.fetch(this.config.uploadUrl, {
				method: 'HEAD',
				headers: this.config.headers,
			});
			return response.status < 500;
		} catch {
			return false;
		}
	}

	getPublicUrl(key: string): string {
		if (this.config.publicUrl) {
			return key.startsWith('http') ? key : `${this.config.publicUrl}/${key}`;
		}
		return key;
	}
}

export function createCloudProvider(config: AnyCloudProviderConfig): CloudProvider | null {
	switch (config.type) {
		case 'r2':
			return new R2Provider(config);
		case 's3':
			return new S3Provider(config);
		case 'webdav':
			return new WebDAVProvider(config);
		case 'imghippo':
			return new ImgHippoProvider(config);
		case 'custom':
			return new CustomProvider(config);
		default:
			return null;
	}
}

export function isCloudProviderConfigured(config: AnyCloudProviderConfig): boolean {
	switch (config.type) {
		case 'r2':
			return !!(config.workerUrl && config.apiKey);
		case 's3':
			return !!(config.endpoint && config.accessKeyId && config.secretAccessKey);
		case 'webdav':
			return !!(config.serverUrl && config.username && config.password);
		case 'imghippo':
			return !!config.apiKey;
		case 'custom':
			return !!config.uploadUrl;
		default:
			return false;
	}
}

export function getExtFromFilename(filename: string): string {
	const parts = filename.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export { getMimeType };
