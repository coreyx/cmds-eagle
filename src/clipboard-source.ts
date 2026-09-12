import { ImageSourceInfo, ImageSourceUrlPriority } from './types';

/**
 * Executes a clipboard read operation while suppressing Electron's renderer-process
 * deprecation warnings in the DevTools console.
 */
function safelyReadClipboard<T>(fn: () => T): T {
	const proc = typeof process !== 'undefined' ? (process as any) : null;
	const prevNoDeprecation = proc ? proc.noDeprecation : undefined;
	const originalWarn = console.warn;

	try {
		if (proc) {
			proc.noDeprecation = true;
		}
		console.warn = (...args: any[]) => {
			if (
				args.length > 0 &&
				typeof args[0] === 'string' &&
				(args[0].includes('clipboard') || args[0].includes('contextBridge'))
			) {
				return;
			}
			originalWarn.apply(console, args);
		};
		return fn();
	} finally {
		console.warn = originalWarn;
		if (proc) {
			proc.noDeprecation = prevNoDeprecation;
		}
	}
}

/**
 * Strips null bytes and trims whitespace from a URL string.
 */
export function cleanUrl(urlStr?: string | null): string {
	if (!urlStr) return '';
	return urlStr.replace(/\0/g, '').trim();
}

/**
 * Extracts clean domain name from a URL string.
 */
export function extractDomain(urlStr: string): string {
	const cleaned = cleanUrl(urlStr);
	try {
		const parsed = new URL(cleaned);
		return parsed.hostname.replace(/^www\./i, '');
	} catch {
		return cleaned.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');
	}
}

/**
 * Validates that a string is a valid HTTP or HTTPS URL (and not a data URL).
 */
export function isValidHttpUrl(urlStr?: string | null): boolean {
	if (!urlStr) return false;
	const trimmed = cleanUrl(urlStr);
	return /^https?:\/\/[^\s<>"'\0\x01-\x1f]+$/i.test(trimmed);
}

/**
 * Lightweight in-memory Apple Binary Property List (bplist00) decoder
 * specialized for extracting WebResourceURL from Safari com.apple.webarchive buffers.
 */
export class BplistParser {
	static extractSourceUrl(buf: Buffer): string {
		try {
			if (!buf || buf.length < 40) return '';
			if (buf.subarray(0, 8).toString('ascii') !== 'bplist00') {
				return this.fallbackRegexUrl(buf);
			}

			const trailerOffset = buf.length - 32;
			const offsetIntSize = buf.readUInt8(trailerOffset + 6);
			const objectRefSize = buf.readUInt8(trailerOffset + 7);
			const numObjects = Number(buf.readBigUInt64BE(trailerOffset + 8));
			const topObject = Number(buf.readBigUInt64BE(trailerOffset + 16));
			const offsetTableOffset = Number(buf.readBigUInt64BE(trailerOffset + 24));

			if (offsetIntSize === 0 || objectRefSize === 0 || numObjects === 0) {
				return this.fallbackRegexUrl(buf);
			}

			const getOffset = (objIndex: number): number => {
				const ptr = offsetTableOffset + objIndex * offsetIntSize;
				if (ptr + offsetIntSize > trailerOffset) return -1;
				if (offsetIntSize === 1) return buf.readUInt8(ptr);
				if (offsetIntSize === 2) return buf.readUInt16BE(ptr);
				if (offsetIntSize === 4) return buf.readUInt32BE(ptr);
				return Number(buf.readBigUInt64BE(ptr));
			};

			const parseObject = (objIndex: number, depth = 0): any => {
				if (depth > 10) return null; // recursion guard
				const offset = getOffset(objIndex);
				if (offset < 8 || offset >= offsetTableOffset) return null;

				const marker = buf.readUInt8(offset);
				const objType = marker & 0xf0;
				let count = marker & 0x0f;
				let dataStart = offset + 1;

				if (count === 0x0f) {
					const intMarker = buf.readUInt8(dataStart);
					const intBytes = 1 << (intMarker & 0x0f);
					dataStart += 1;
					if (intBytes === 1) count = buf.readUInt8(dataStart);
					else if (intBytes === 2) count = buf.readUInt16BE(dataStart);
					else if (intBytes === 4) count = buf.readUInt32BE(dataStart);
					dataStart += intBytes;
				}

				// ASCII String (0x50)
				if (objType === 0x50) {
					if (dataStart + count > buf.length) return null;
					return buf.subarray(dataStart, dataStart + count).toString('ascii');
				}

				// UTF-16BE String (0x60)
				if (objType === 0x60) {
					const byteLen = count * 2;
					if (dataStart + byteLen > buf.length) return null;
					return buf.subarray(dataStart, dataStart + byteLen).swap16().toString('utf16le');
				}

				// Dictionary (0xD0)
				if (objType === 0xd0) {
					const dict: Record<string, any> = {};
					const keysStart = dataStart;
					const valsStart = dataStart + count * objectRefSize;

					const readRef = (pos: number) => {
						if (objectRefSize === 1) return buf.readUInt8(pos);
						if (objectRefSize === 2) return buf.readUInt16BE(pos);
						return buf.readUInt32BE(pos);
					};

					for (let i = 0; i < count; i++) {
						const keyIndex = readRef(keysStart + i * objectRefSize);
						const valIndex = readRef(valsStart + i * objectRefSize);
						const key = parseObject(keyIndex, depth + 1);
						if (typeof key === 'string') {
							if (key === 'WebMainResource' || key === 'WebResourceURL') {
								dict[key] = parseObject(valIndex, depth + 1);
							}
						}
					}
					return dict;
				}

				return null;
			};

			const root = parseObject(topObject);
			const url = root?.WebMainResource?.WebResourceURL ?? root?.WebResourceURL;
			if (typeof url === 'string' && url.trim().startsWith('http')) {
				return url.trim();
			}
		} catch (e) {
			console.warn('[CMDS Eagle] BplistParser exception, falling back to regex:', e);
		}

		return this.fallbackRegexUrl(buf);
	}

	private static fallbackRegexUrl(buf: Buffer): string {
		try {
			const text = buf.toString('latin1');
			const keyPos = text.indexOf('WebResourceURL');
			if (keyPos !== -1) {
				const slice = text.substring(keyPos, keyPos + 1000);
				const match = slice.match(/https?:\/\/[^\s<>"'\0\x01-\x1f]+/);
				if (match) return match[0].trim();
			}
			const generalMatch = text.match(/https?:\/\/[^\s<>"'\0\x01-\x1f]+/);
			if (generalMatch) return generalMatch[0].trim();
		} catch {
			// ignore
		}
		return '';
	}
}

export interface IClipboardSourceProvider {
	getImageSourceInfo(): Promise<ImageSourceInfo | null>;
}

/**
 * Windows In-Process Clipboard Provider.
 * Reads Win32 CF_HTML ("HTML Format") to extract SourceURL (page) and <img> src (image).
 */
export class WindowsClipboardProvider implements IClipboardSourceProvider {
	async getImageSourceInfo(): Promise<ImageSourceInfo | null> {
		try {
			const electron = (window as any).require
				? (window as any).require('electron')
				: require('electron');

			if (!electron || !electron.clipboard) {
				return null;
			}

			const clipboard = electron.clipboard;

			// 1. Read raw CF_HTML buffer
			const buf: Buffer = safelyReadClipboard(() => {
				let b = clipboard.readBuffer('HTML Format');
				if (!b || b.length === 0) {
					b = clipboard.readBuffer('electron application/osclipboard;format="HTML Format"');
				}
				return b;
			});

			let pageUrl: string | undefined;
			let imageUrl: string | undefined;
			let altText: string | undefined;

			if (buf && buf.length > 0) {
				const text = buf.toString('utf8');

				// Extract SourceURL header
				const pageMatch = text.match(/SourceURL:(https?:\/\/[^\r\n]+)/i);
				if (pageMatch && pageMatch[1] && isValidHttpUrl(pageMatch[1])) {
					pageUrl = cleanUrl(pageMatch[1]);
				}

				// Extract <img src="..." alt="...">
				const imgMatch = text.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i) ||
					text.match(/<img[^>]+src=([^\s>]+)/i);
				if (imgMatch && imgMatch[1]) {
					const decoded = imgMatch[1].replace(/&amp;/g, '&');
					if (isValidHttpUrl(decoded)) {
						imageUrl = cleanUrl(decoded);
					}
				}

				const altMatch = text.match(/<img[^>]+alt=["']([^"']*)["']/i);
				if (altMatch && altMatch[1]) {
					altText = altMatch[1].trim();
				}
			}

			// 2. Check "Chromium internal source URL" if page URL wasn't found in CF_HTML
			if (!pageUrl) {
				const chromiumSource = safelyReadClipboard(() => {
					return clipboard.read('Chromium internal source URL');
				});
				if (isValidHttpUrl(chromiumSource)) {
					pageUrl = cleanUrl(chromiumSource);
				}
			}

			// 3. Check for local file path from Windows File Explorer
			let localFilePath: string | undefined;
			const rawFilePath = safelyReadClipboard(() => {
				return clipboard.read('FileNameW') || clipboard.read('FileName');
			});
			if (rawFilePath && typeof rawFilePath === 'string') {
				const cleaned = cleanUrl(rawFilePath);
				if (/^[A-Za-z]:[\\/]/.test(cleaned) || cleaned.startsWith('\\\\')) {
					localFilePath = cleaned;
				}
			}

			if (pageUrl || imageUrl || localFilePath || altText) {
				return { pageUrl, imageUrl, localFilePath, altText };
			}
		} catch (err) {
			console.warn('[CMDS Eagle] Error reading Windows clipboard source:', err);
		}

		return null;
	}
}

/**
 * macOS In-Process Clipboard Provider.
 * Reads org.chromium.source-url, com.apple.webarchive, and public.html.
 */
export class MacOSClipboardProvider implements IClipboardSourceProvider {
	async getImageSourceInfo(): Promise<ImageSourceInfo | null> {
		try {
			const electron = (window as any).require
				? (window as any).require('electron')
				: require('electron');

			if (!electron || !electron.clipboard) {
				return null;
			}

			const clipboard = electron.clipboard;
			let pageUrl: string | undefined;
			let imageUrl: string | undefined;
			let altText: string | undefined;

			// 1. Chromium family: org.chromium.source-url
			const chromiumUrl = safelyReadClipboard(() => clipboard.read('org.chromium.source-url'));
			if (isValidHttpUrl(chromiumUrl)) {
				pageUrl = cleanUrl(chromiumUrl);
			}

			// 2. Read public.html for <img src="..." alt="..."> and possible SourceURL
			const html = safelyReadClipboard(() => clipboard.read('public.html'));
			if (html && typeof html === 'string') {
				const imgMatch = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i) ||
					html.match(/<img[^>]+src=([^\s>]+)/i);
				if (imgMatch && imgMatch[1]) {
					const decoded = imgMatch[1].replace(/&amp;/g, '&');
					if (isValidHttpUrl(decoded)) {
						imageUrl = cleanUrl(decoded);
					}
				}

				const altMatch = html.match(/<img[^>]+alt=["']([^"']*)["']/i);
				if (altMatch && altMatch[1]) {
					altText = altMatch[1].trim();
				}

				if (!pageUrl) {
					const pageMatch = html.match(/SourceURL:(https?:\/\/[^\r\n]+)/i);
					if (pageMatch && pageMatch[1] && isValidHttpUrl(pageMatch[1])) {
						pageUrl = cleanUrl(pageMatch[1]);
					}
				}
			}

			// 3. Safari: com.apple.webarchive
			if (!pageUrl || !imageUrl) {
				const webArchiveBuf: Buffer = safelyReadClipboard(() => clipboard.readBuffer('com.apple.webarchive'));
				if (webArchiveBuf && webArchiveBuf.length > 8) {
					const safariUrl = BplistParser.extractSourceUrl(webArchiveBuf);
					if (isValidHttpUrl(safariUrl)) {
						const cleanedSafari = cleanUrl(safariUrl);
						if (!imageUrl && /\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)(\?.*)?$/i.test(cleanedSafari)) {
							imageUrl = cleanedSafari;
						} else if (!pageUrl) {
							pageUrl = cleanedSafari;
						}
					}
				}
			}

			// 4. Fallback: public.url
			if (!pageUrl && !imageUrl) {
				const publicUrl = safelyReadClipboard(() => clipboard.read('public.url'));
				if (isValidHttpUrl(publicUrl)) {
					const cleanedPublic = cleanUrl(publicUrl);
					if (/\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)(\?.*)?$/i.test(cleanedPublic)) {
						imageUrl = cleanedPublic;
					} else {
						pageUrl = cleanedPublic;
					}
				}
			}

			// 5. Check for local file path from macOS Finder
			let localFilePath: string | undefined;
			const fileUrl = safelyReadClipboard(() => {
				return clipboard.read('public.file-url');
			});
			if (fileUrl && typeof fileUrl === 'string') {
				const cleaned = cleanUrl(fileUrl);
				if (cleaned.startsWith('file://')) {
					try {
						localFilePath = decodeURIComponent(new URL(cleaned).pathname);
					} catch {
						localFilePath = cleaned.replace(/^file:\/\//, '');
					}
				}
			}

			if (pageUrl || imageUrl || localFilePath || altText) {
				return { pageUrl, imageUrl, localFilePath, altText };
			}
		} catch (err) {
			console.warn('[CMDS Eagle] Error reading macOS clipboard source:', err);
		}

		return null;
	}
}

/**
 * Fallback provider for mobile or unsupported platforms.
 */
export class NullClipboardProvider implements IClipboardSourceProvider {
	async getImageSourceInfo(): Promise<ImageSourceInfo | null> {
		return null;
	}
}

export function createClipboardProvider(): IClipboardSourceProvider {
	if (typeof process !== 'undefined' && process.platform === 'win32') {
		return new WindowsClipboardProvider();
	} else if (typeof process !== 'undefined' && process.platform === 'darwin') {
		return new MacOSClipboardProvider();
	}
	return new NullClipboardProvider();
}

/**
 * High-level service orchestrating clipboard inspection and URL resolution.
 */
export class ClipboardSourceService {
	private provider: IClipboardSourceProvider;

	constructor() {
		this.provider = createClipboardProvider();
	}

	async getSourceInfo(): Promise<ImageSourceInfo | null> {
		try {
			return await this.provider.getImageSourceInfo();
		} catch (error) {
			console.warn('[CMDS Eagle] Error extracting clipboard source info:', error);
			return null;
		}
	}

	resolvePrimaryUrl(info: ImageSourceInfo | null, priority: ImageSourceUrlPriority): string | null {
		if (!info) return null;

		switch (priority) {
			case 'page-first':
				return info.pageUrl || info.imageUrl || null;
			case 'image-first':
				return info.imageUrl || info.pageUrl || null;
			case 'page-only':
				return info.pageUrl || null;
			case 'image-only':
				return info.imageUrl || null;
			default:
				return info.pageUrl || info.imageUrl || null;
		}
	}
}
