import {
	Plugin,
	MarkdownView,
	Notice,
	Editor,
	TFile,
	Menu,
	EditorPosition,
	TAbstractFile,
} from 'obsidian';
import {
	CMDSPACEEagleSettings,
	DEFAULT_SETTINGS,
	EagleItem,
	EagleFolder,
	EagleAddFolderMode,
	ImageSourceInfo,
	MetadataCardImageSource,
	ComputerProfile,
	PlatformType,
	EagleFolderPickerResult,
} from './types';
import { 
	EagleApiService, 
	buildEagleItemUrl, 
	parseEagleUrl, 
	hasR2Upload,
	parseEagleLocalhostUrl,
	isEagleLocalhostUrl,
	extractEagleItemId,
	buildEagleCustomEmbedUrl,
	resolveImageFileName,
} from './api';
import { EagleSearchModal, ImagePasteChoiceModal, EagleLinkChoiceModal, EagleFolderPickerModal } from './modals';
import { CMDSPACEEagleSettingTab } from './settings';
import { createCloudProvider, getMimeType, getExtFromFilename, CloudProvider } from './cloud-providers';
import { ClipboardSourceService, extractDomain, cleanUrl, isValidHttpUrl, isDirectImageUrl } from './clipboard-source';

// Minimal shape of the Excalidraw plugin's view that we drive.
// (The Excalidraw plugin is an optional peer, so we don't import its types.)
interface ExcalidrawViewLike {
	containerEl: HTMLElement;
	addImageWithURL(url: string): Promise<unknown>;
}

export default class CMDSPACELinkEagle extends Plugin {
	settings: CMDSPACEEagleSettings;
	api: EagleApiService;
	clipboardSourceService: ClipboardSourceService;
	private lastModifiedFile: string | null = null;
	private attachedExcalidrawContainers = new WeakSet<HTMLElement>();

	async onload(): Promise<void> {
		console.log('[CMDS Eagle] Loading plugin v1.6.0');

		await this.loadSettings();
		this.api = new EagleApiService(this.settings);
		this.clipboardSourceService = new ClipboardSourceService();

		this.addCommand({
			id: 'search-eagle',
			name: 'Search Eagle library and embed',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new EagleSearchModal(this.app, this.api, this.settings).open();
			},
		});

		this.addCommand({
			id: 'upload-clipboard-to-cloud',
			name: 'Upload clipboard Eagle image to cloud',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.uploadClipboardToCloud(editor);
			},
		});

		this.addCommand({
			id: 'embed-and-upload',
			name: 'Embed Eagle image and upload to cloud',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.embedAndUploadToCloud(editor);
			},
		});

		this.addCommand({
			id: 'convert-all-to-cloud',
			name: 'Convert all images in note to cloud URLs',
			callback: async () => {
				await this.uploadAllImagesToCloud();
			},
		});

		this.addCommand({
			id: 'convert-cross-platform-paths',
			name: 'Convert cross-platform image paths in current note',
			callback: async () => {
				await this.convertCrossPlatformPaths();
			},
		});



		this.registerEvent(
			this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor) => {
				if (evt.defaultPrevented) return;
				if (!this.willHandlePaste(evt)) return;
				evt.preventDefault();
				void this.handlePaste(evt, editor);
			})
		);

		this.registerEvent(
			this.app.workspace.on('editor-drop', (evt: DragEvent, editor: Editor) => {
				if (evt.defaultPrevented) return;
				if (!this.willHandleDrop(evt)) return;
				evt.preventDefault();
				void this.handleDrop(evt, editor);
			})
		);

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
				const localImage = this.getLocalImageUnderCursor(editor);
				if (localImage) {
					menu.addItem((item) => {
						item.setTitle('Upload to Eagle')
							.setIcon('upload')
							.onClick(() => this.uploadLocalImageToEagle(editor, localImage));
					});
				}
			})
		);

		this.addSettingTab(new CMDSPACEEagleSettingTab(this.app, this));

		this.registerMarkdownPostProcessor((el, ctx) => {
			this.processEagleLinks(el);
		});

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				window.setTimeout(() => this.processActiveView(), 100);
			})
		);

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				window.setTimeout(() => this.processActiveView(), 100);
			})
		);

		this.registerEvent(
			this.app.vault.on('modify', (file: TAbstractFile) => {
				this.lastModifiedFile = file.path;
			})
		);

		this.registerEvent(
			this.app.workspace.on('file-open', (file: TFile | null) => {
				console.log(`[CMDS Eagle] file-open event: ${file?.path}`);
				console.log(`[CMDS Eagle] enableCrossPlatform: ${this.settings.enableCrossPlatform}`);
				console.log(`[CMDS Eagle] autoConvertCrossPlatformPaths: ${this.settings.autoConvertCrossPlatformPaths}`);
				console.log(`[CMDS Eagle] conversionMode: ${this.settings.crossPlatformConversionMode}`);
				console.log(`[CMDS Eagle] lastModifiedFile: ${this.lastModifiedFile}`);
				
				if (file && this.settings.enableCrossPlatform && this.settings.autoConvertCrossPlatformPaths) {
					if (this.lastModifiedFile !== file.path) {
						console.log(`[CMDS Eagle] Triggering auto-conversion for: ${file.path}`);
						window.setTimeout(() => { void this.autoConvertOnFileOpen(file); }, 300);
					} else {
						console.log(`[CMDS Eagle] Skipping - file was just modified by us`);
					}
				}
				this.lastModifiedFile = null;
			})
		);

		this.addRibbonIcon('image', 'CMDSPACE: Eagle', () => {
			new EagleSearchModal(this.app, this.api, this.settings).open();
		});

		this.registerExcalidrawIntegration();
	}

	onunload(): void {
		console.log('[CMDS Eagle] Unloading plugin');
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<CMDSPACEEagleSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
		// Auto-migrate from deprecated port 41596 (conflicted with Eagle MCP server) to 41598
		if (
			this.settings.extraLinksBaseUrl === 'http://127.0.0.1:41596' ||
			this.settings.extraLinksBaseUrl === 'http://localhost:41596'
		) {
			this.settings.extraLinksBaseUrl = 'http://127.0.0.1:41598';
			await this.saveSettings();
		}
		// Auto-migrate boolean includeSourceInMetadataCard to 'page' | 'none'
		if (typeof (this.settings as any).includeSourceInMetadataCard === 'boolean') {
			this.settings.includeSourceInMetadataCard = (this.settings as any).includeSourceInMetadataCard ? 'page' : 'none';
			await this.saveSettings();
		}
		// Auto-migrate Target Folder 2.0: enableDefaultFolder -> addFolderMode
		if (!(saved as any)?.addFolderMode) {
			this.settings.addFolderMode = this.settings.enableDefaultFolder ? 'target' : 'target';
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		if (this.api) {
			this.api.updateSettings(this.settings);
		}
	}

	private async insertFromClipboard(editor: Editor): Promise<void> {
		const clipboardText = await navigator.clipboard.readText();
		const parsed = parseEagleUrl(clipboardText.trim());

		if (!parsed || parsed.type !== 'item') {
			new Notice('Clipboard does not contain a valid Eagle item URL');
			return;
		}

		const item = await this.api.getItemInfo(parsed.id);
		if (!item) {
			new Notice('Could not fetch item info from Eagle');
			return;
		}

		void this.insertItemLink(editor, item);
		new Notice(`Inserted link to: ${item.name}`);
	}

	private async insertItemLink(editor: Editor, item: EagleItem): Promise<void> {
		const sources = await this.resolveMetadataSources(item);
		if (this.settings.insertAsEmbed) {
			const filePath = await this.api.getOriginalFilePath(item);
			if (filePath) {
				const fileUrl = this.pathToFileUrl(filePath);
				const filename = `${item.name}.${item.ext}`;
				let output = `![${filename}](${fileUrl})`;
				
				if (this.settings.insertThumbnail) {
					output += '\n\n' + this.buildMetadataCard(item, sources);
				}
				
				editor.replaceSelection(output);
				return;
			}
		}
		
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		if (this.settings.insertThumbnail) {
			const card = this.buildLinkCard(item, sources);
			editor.replaceSelection(card);
		} else {
			const link = this.settings.linkFormat === 'wikilink'
				? `[[${linkUrl}|${item.name}]]`
				: `[${item.name}](${linkUrl})`;
			editor.replaceSelection(link);
		}
	}

	private extractLocalFilePath(file: File, sourceInfo?: ImageSourceInfo | null): string | null {
		// 1. Try webUtils.getPathForFile (modern Electron 28+)
		try {
			const electron = (window as any).electron ||
				((window as any).require ? (window as any).require('electron') : null) ||
				(typeof require !== 'undefined' ? require('electron') : null);

			const webUtils = electron?.webUtils || (window as any).webUtils;
			if (webUtils?.getPathForFile) {
				const p = webUtils.getPathForFile(file);
				if (p && typeof p === 'string' && p.trim().length > 0) {
					console.log('[CMDS Eagle] Resolved local path via webUtils.getPathForFile:', p.trim());
					return p.trim();
				}
			}
		} catch (err) {
			console.warn('[CMDS Eagle] Failed to get path via webUtils.getPathForFile:', err);
		}

		// 2. Try direct (file as any).path (older Electron <28)
		try {
			const directPath = (file as any).path;
			if (directPath && typeof directPath === 'string' && directPath.trim().length > 0) {
				console.log('[CMDS Eagle] Resolved local path via file.path:', directPath.trim());
				return directPath.trim();
			}
		} catch (err) {
			console.warn('[CMDS Eagle] Failed to get path via file.path:', err);
		}

		// 3. Fallback to sourceInfo (e.g. from clipboard provider or dataTransfer uri-list)
		if (sourceInfo?.localFilePath && typeof sourceInfo.localFilePath === 'string' && sourceInfo.localFilePath.trim().length > 0) {
			console.log('[CMDS Eagle] Resolved local path via sourceInfo:', sourceInfo.localFilePath.trim());
			return sourceInfo.localFilePath.trim();
		}

		console.warn('[CMDS Eagle] Could not extract local file path for file:', file?.name);
		return null;
	}

	private async resolveMetadataSources(
		item: EagleItem,
		sourceInfoOrUrl?: ImageSourceInfo | string | null,
		localFilePath?: string | null
	): Promise<{ pageUrl: string | null; imageUrl: string | null; webUrl: string | null; localFileUrl: string | null }> {
		let pageUrl: string | null = null;
		let imageUrl: string | null = null;
		let webUrl: string | null = null;
		let localFileUrl: string | null = null;

		// 1. Check sourceInfo if provided as object
		if (sourceInfoOrUrl && typeof sourceInfoOrUrl === 'object') {
			if (sourceInfoOrUrl.pageUrl) {
				const cleaned = cleanUrl(sourceInfoOrUrl.pageUrl);
				if (!isDirectImageUrl(cleaned) && cleaned !== sourceInfoOrUrl.imageUrl) {
					pageUrl = cleaned;
				} else if (!imageUrl) {
					imageUrl = cleaned;
				}
			}
			if (sourceInfoOrUrl.imageUrl) {
				imageUrl = cleanUrl(sourceInfoOrUrl.imageUrl);
			}
			if (sourceInfoOrUrl.localFilePath && !localFilePath) {
				localFilePath = sourceInfoOrUrl.localFilePath;
			}
		} else if (typeof sourceInfoOrUrl === 'string') {
			const clean = cleanUrl(sourceInfoOrUrl);
			if (/^https?:\/\//i.test(clean)) {
				webUrl = clean;
			}
		}

		// 2. Check item.url
		if (item.url) {
			const clean = cleanUrl(item.url);
			if (/^https?:\/\//i.test(clean)) {
				if (!webUrl) webUrl = clean;
				if (/\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)(\?.*)?$/i.test(clean)) {
					if (!imageUrl) imageUrl = clean;
				} else {
					if (!pageUrl) pageUrl = clean;
				}
			} else if (/^file:\/\//i.test(clean) && !localFilePath) {
				localFileUrl = clean;
			}
		}

		// 3. Fallback: check Extra Links on disk if pageUrl or imageUrl missing
		if (!pageUrl || !imageUrl) {
			const extraSources = await this.api.getExtraLinkWebSources(item.id);
			if (!pageUrl && extraSources.pageUrl) {
				pageUrl = extraSources.pageUrl;
			}
			if (!imageUrl && extraSources.imageUrl) {
				imageUrl = extraSources.imageUrl;
			}
			if (!webUrl) {
				webUrl = pageUrl || imageUrl;
			}
		}

		// 4. Resolve localFilePath to file:// URL
		if (localFilePath) {
			try {
				if (localFilePath.startsWith('file://')) {
					localFileUrl = cleanUrl(localFilePath);
				} else {
					localFileUrl = this.pathToFileUrl(localFilePath);
				}
			} catch (e) {
				console.warn('[CMDS Eagle] Failed to convert local file path to file URL:', e);
			}
		}

		return { pageUrl, imageUrl, webUrl, localFileUrl };
	}

	private async resolveMetadataSourceUrl(item: EagleItem, fallbackSourceUrl?: string | null): Promise<string | null> {
		const sources = await this.resolveMetadataSources(item, fallbackSourceUrl);
		return sources.pageUrl || sources.imageUrl || sources.webUrl;
	}

	private buildMetadataCard(
		item: EagleItem,
		resolvedSources?: { pageUrl?: string | null; imageUrl?: string | null; webUrl?: string | null; localFileUrl?: string | null } | string | null
	): string {
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		const tags = item.tags
			.filter(t => !t.startsWith('r2:') && t !== 'r2-cloud' && t !== 'cloud-upload')
			.map(t => `#${this.normalizeTag(t)}`)
			.join(' ');
		const dimensions = item.width && item.height ? `${item.width}×${item.height}` : 'N/A';
		const isUploaded = hasR2Upload(item);
		const cloudUrl = this.api.getCloudUrl(item);

		let linkSection = `[Open in Eagle](${linkUrl})`;
		if (cloudUrl) {
			linkSection += ` | [Cloud](${cloudUrl})`;
		}

		const sources: { pageUrl?: string | null; imageUrl?: string | null; webUrl?: string | null; localFileUrl?: string | null } =
			typeof resolvedSources === 'string'
				? { webUrl: resolvedSources, pageUrl: resolvedSources }
				: (resolvedSources || {});

		const mode = typeof this.settings.includeSourceInMetadataCard === 'boolean'
			? (this.settings.includeSourceInMetadataCard ? 'page' : 'none')
			: (this.settings.includeSourceInMetadataCard || 'page');

		const effectivePageUrl = sources.pageUrl || (!sources.imageUrl ? sources.webUrl : null);
		const effectiveImageUrl = sources.imageUrl || (sources.webUrl && /\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)(\?.*)?$/i.test(sources.webUrl) ? sources.webUrl : null);

		const localFileUrl = sources.localFileUrl
			? cleanUrl(sources.localFileUrl)
			: (item.url && /^file:\/\//i.test(cleanUrl(item.url)) ? cleanUrl(item.url) : null);

		if (mode === 'page' || mode === 'both') {
			if (effectivePageUrl) {
				const domain = extractDomain(effectivePageUrl);
				linkSection += ` | [Source: ${domain || 'Web'}](${effectivePageUrl})`;
			} else if (mode === 'page' && sources.webUrl) {
				const domain = extractDomain(sources.webUrl);
				linkSection += ` | [Source: ${domain || 'Web'}](${sources.webUrl})`;
			}
		}

		if (mode === 'image' || mode === 'both') {
			if (effectiveImageUrl && (mode === 'image' || effectiveImageUrl !== effectivePageUrl)) {
				const domain = extractDomain(effectiveImageUrl);
				linkSection += ` | [Direct: ${domain || 'Image'}](${effectiveImageUrl})`;
			} else if (mode === 'image' && sources.webUrl) {
				const domain = extractDomain(sources.webUrl);
				linkSection += ` | [Direct: ${domain || 'Image'}](${sources.webUrl})`;
			}
		}

		if (this.settings.includeLocalSourceInMetadataCard && localFileUrl) {
			linkSection += ` | [Source: File](${localFileUrl})`;
		}

		return `> **${item.ext.toUpperCase()}** | ${this.formatFileSize(item.size)} | ${dimensions} | ${isUploaded ? '☁️' : '📁'} | ${tags || 'No tags'}
> ${linkSection}`;
	}

	private buildLinkCard(
		item: EagleItem,
		resolvedSources?: { pageUrl?: string | null; imageUrl?: string | null; webUrl?: string | null; localFileUrl?: string | null } | string | null
	): string {
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		const tags = item.tags
			.filter(t => !t.startsWith('r2:') && t !== 'r2-cloud')
			.map(t => `#${this.normalizeTag(t)}`)
			.join(' ');
		const dimensions = item.width && item.height ? `${item.width}×${item.height}` : 'N/A';
		
		const imageUrl = this.getImageUrl(item);
		const cloudUrl = this.api.getCloudUrl(item);
		const isUploaded = hasR2Upload(item);

		let imageSection = '';
		if (this.settings.embedImageInCard && imageUrl) {
			imageSection = `> ![${item.name}](${imageUrl})\n>\n`;
		}

		let linkSection = `> [Open in Eagle](${linkUrl})`;
		if (cloudUrl) {
			linkSection += ` | [Cloud URL](${cloudUrl})`;
		}

		const sources: { pageUrl?: string | null; imageUrl?: string | null; webUrl?: string | null; localFileUrl?: string | null } =
			typeof resolvedSources === 'string'
				? { webUrl: resolvedSources, pageUrl: resolvedSources }
				: (resolvedSources || {});

		const mode = typeof this.settings.includeSourceInMetadataCard === 'boolean'
			? (this.settings.includeSourceInMetadataCard ? 'page' : 'none')
			: (this.settings.includeSourceInMetadataCard || 'page');

		const effectivePageUrl = sources.pageUrl || (!sources.imageUrl ? sources.webUrl : null);
		const effectiveImageUrl = sources.imageUrl || (sources.webUrl && /\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)(\?.*)?$/i.test(sources.webUrl) ? sources.webUrl : null);

		const localFileUrl = sources.localFileUrl
			? cleanUrl(sources.localFileUrl)
			: (item.url && /^file:\/\//i.test(cleanUrl(item.url)) ? cleanUrl(item.url) : null);

		if (mode === 'page' || mode === 'both') {
			if (effectivePageUrl) {
				const domain = extractDomain(effectivePageUrl);
				linkSection += ` | [Source: ${domain || 'Web'}](${effectivePageUrl})`;
			} else if (mode === 'page' && sources.webUrl) {
				const domain = extractDomain(sources.webUrl);
				linkSection += ` | [Source: ${domain || 'Web'}](${sources.webUrl})`;
			}
		}

		if (mode === 'image' || mode === 'both') {
			if (effectiveImageUrl && (mode === 'image' || effectiveImageUrl !== effectivePageUrl)) {
				const domain = extractDomain(effectiveImageUrl);
				linkSection += ` | [Direct: ${domain || 'Image'}](${effectiveImageUrl})`;
			} else if (mode === 'image' && sources.webUrl) {
				const domain = extractDomain(sources.webUrl);
				linkSection += ` | [Direct: ${domain || 'Image'}](${sources.webUrl})`;
			}
		}

		if (this.settings.includeLocalSourceInMetadataCard && localFileUrl) {
			linkSection += ` | [Source: File](${localFileUrl})`;
		}

		return `> [!cmdspace-eagle] ${item.name}
> 
${imageSection}> | Property | Value |
> |----------|-------|
> | **Type** | ${item.ext.toUpperCase()} |
> | **Size** | ${this.formatFileSize(item.size)} |
> | **Dimensions** | ${dimensions} |
> | **R2 Status** | ${isUploaded ? '☁️ Uploaded' : '📁 Local only'} |
> | **Tags** | ${tags || 'None'} |
${item.annotation ? `> | **Annotation** | ${item.annotation} |\n` : ''}${linkSection}

`;
	}

	private getImageUrl(item: EagleItem): string | null {
		const cloudUrl = this.api.getCloudUrl(item);
		const localUrl = this.api.getLocalThumbnailUrl(item.id);

		switch (this.settings.imageDisplayMode) {
			case 'cloud':
				return cloudUrl || localUrl;
			case 'local':
				return localUrl;
			case 'both':
				return cloudUrl || localUrl;
			default:
				return cloudUrl || localUrl;
		}
	}

	private async refreshCurrentNoteMetadata(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const content = await this.app.vault.read(activeFile);
		const eagleLinks = this.extractEagleLinks(content);

		if (eagleLinks.length === 0) {
			new Notice('No Eagle links found in current note');
			return;
		}

		new Notice(`Found ${eagleLinks.length} Eagle links. Refreshing...`);

		for (const id of eagleLinks) {
			const item = await this.api.getItemInfo(id);
			if (item) {
				console.log(`Refreshed: ${item.name}`);
			}
		}

		new Notice('Eagle metadata refreshed');
	}

	private extractEagleLinks(content: string): string[] {
		const regex = /eagle:\/\/item\/([A-Z0-9]+)/gi;
		const matches: string[] = [];
		let match;
		while ((match = regex.exec(content)) !== null) {
			matches.push(match[1]);
		}
		return [...new Set(matches)];
	}

	private async syncTagsToEagle(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const metadata = this.app.metadataCache.getFileCache(activeFile);
		const tags = metadata?.tags?.map(t => t.tag.replace('#', '')) || [];

		const content = await this.app.vault.read(activeFile);
		const eagleLinks = this.extractEagleLinks(content);

		if (eagleLinks.length === 0) {
			new Notice('No Eagle links found in current note');
			return;
		}

		let updated = 0;
		for (const id of eagleLinks) {
			const success = await this.api.updateItem(id, { tags });
			if (success) updated++;
		}

		new Notice(`Synced tags to ${updated}/${eagleLinks.length} Eagle items`);
	}

	private async syncTagsFromEagle(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const content = await this.app.vault.read(activeFile);
		const eagleLinks = this.extractEagleLinks(content);

		if (eagleLinks.length === 0) {
			new Notice('No Eagle links found in current note');
			return;
		}

		const allTags = new Set<string>();
		for (const id of eagleLinks) {
			const item = await this.api.getItemInfo(id);
			if (item) {
				item.tags.forEach(t => allTags.add(this.normalizeTag(t)));
			}
		}

		if (allTags.size === 0) {
			new Notice('No tags found in linked Eagle items');
			return;
		}

		await this.app.fileManager.processFrontMatter(activeFile, (frontmatter: { tags?: string[] }) => {
			const existingTags = frontmatter.tags || [];
			frontmatter.tags = [...new Set([...existingTags, ...allTags])];
		});

		new Notice(`Added ${allTags.size} tags from Eagle items`);
	}

	private async captureUrlToEagle(editor: Editor): Promise<void> {
		const clipboardText = await navigator.clipboard.readText();
		
		if (!clipboardText.startsWith('http://') && !clipboardText.startsWith('https://')) {
			new Notice('Clipboard does not contain a valid URL');
			return;
		}

		const connected = await this.api.isConnected();
		if (!connected) {
			new Notice('Eagle is not running');
			return;
		}

		const defaultName = `Captured from Obsidian - ${new Date().toISOString()}`;
		const backlinkData = await this.getEagleBacklinkPayload();

		const folderResolution = await this.resolveEagleFolderForUpload({
			fileName: defaultName,
		});
		if (folderResolution.cancelled) {
			new Notice('Capture to Eagle cancelled');
			return;
		}

		const finalName = folderResolution.name || defaultName;
		const finalTags = folderResolution.tags !== undefined ? folderResolution.tags : this.getDefaultTags();
		const finalAnnotation = [folderResolution.annotation, backlinkData.annotation].filter(Boolean).join('\n\n') || undefined;

		const success = await this.api.addFromUrl({
			url: clipboardText,
			name: finalName,
			tags: finalTags,
			folderId: folderResolution.folderId,
			star: folderResolution.star,
			...backlinkData,
			annotation: finalAnnotation,
		});

		if (success) {
			new Notice('URL captured to Eagle');
			editor.replaceSelection(`[Captured: ${clipboardText}]`);
		} else {
			new Notice('Failed to capture URL to Eagle');
		}
	}

	private async openEagleItemUnderCursor(editor: Editor): Promise<void> {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		
		const match = line.match(/eagle:\/\/item\/([A-Za-z0-9]+)/i) ||
			line.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/item\?id=([A-Za-z0-9]+)/i);
		if (!match) {
			new Notice('No Eagle link found on current line');
			return;
		}

		const url = buildEagleItemUrl(match[1], this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		window.open(url);
	}

	private async uploadClipboardToCloud(editor: Editor): Promise<void> {
		const clipboardText = (await navigator.clipboard.readText()).trim();
		
		let itemId: string | null = null;
		let directFilePath: string | null = null;
		
		const eagleParsed = parseEagleUrl(clipboardText);
		if (eagleParsed && eagleParsed.type === 'item') {
			itemId = eagleParsed.id;
		}
		
		if (!itemId) {
			const localhostId = parseEagleLocalhostUrl(clipboardText);
			if (localhostId) {
				itemId = localhostId;
			}
		}
		
		if (!itemId && this.isEagleLibraryPath(clipboardText)) {
			directFilePath = clipboardText;
			const idMatch = clipboardText.match(/images\/([A-Z0-9]+)\.info/i);
			if (idMatch) {
				itemId = idMatch[1];
			}
		}

		if (!itemId && !directFilePath) {
			new Notice('Clipboard does not contain a valid Eagle URL or file path.\nSupported: eagle://item/ID, localhost URL, or Eagle library path');
			return;
		}

		const provider = this.getActiveCloudProvider();
		if (!provider) {
			new Notice('No cloud provider configured. Check settings.');
			return;
		}

		if (itemId) {
			const item = await this.api.getItemInfo(itemId);
			if (!item) {
				new Notice('Could not fetch item info from Eagle');
				return;
			}

			if (hasR2Upload(item)) {
				const cloudUrl = this.api.getCloudUrl(item);
				new Notice(`Already uploaded: ${cloudUrl}`);
				if (cloudUrl) {
					await navigator.clipboard.writeText(cloudUrl);
				}
				return;
			}

			new Notice(`Uploading ${item.name} to cloud...`);
			
			const filePath = await this.api.getOriginalFilePath(item);
			if (!filePath) {
				new Notice('Could not get file path from Eagle');
				return;
			}

			const filename = `${item.name}.${item.ext}`;
			const mimeType = getMimeType(item.ext);
			const result = await provider.upload(filePath, filename, mimeType);

			if (result.success && result.publicUrl) {
				new Notice(`Uploaded! Cloud URL copied to clipboard`);
				await navigator.clipboard.writeText(result.publicUrl);
				
				const markdown = `![${filename}](${result.publicUrl})`;
				editor.replaceSelection(markdown);
				
				const r2Tag = `r2:${result.key}`;
				const newTags = [...item.tags];
				if (!newTags.includes(r2Tag) && result.key) {
					newTags.push(r2Tag);
				}
				if (!newTags.includes('cloud-upload')) {
					newTags.push('cloud-upload');
				}
				await this.api.updateItem(item.id, { tags: newTags });
			} else {
				new Notice(`Upload failed: ${result.error}`);
			}
		} else if (directFilePath) {
			const filename = directFilePath.split('/').pop() || 'image';
			const ext = getExtFromFilename(filename);
			const mimeType = getMimeType(ext);

			new Notice(`Uploading ${filename} to cloud...`);
			const result = await provider.upload(directFilePath, filename, mimeType);

			if (result.success && result.publicUrl) {
				new Notice(`Uploaded! Cloud URL copied to clipboard`);
				await navigator.clipboard.writeText(result.publicUrl);
				
				const markdown = `![${filename}](${result.publicUrl})`;
				editor.replaceSelection(markdown);
			} else {
				new Notice(`Upload failed: ${result.error}`);
			}
		}
	}

	private async embedAndUploadToCloud(editor: Editor): Promise<void> {
		const clipboardText = (await navigator.clipboard.readText()).trim();
		
		let itemId: string | null = null;
		let directFilePath: string | null = null;
		
		const eagleParsed = parseEagleUrl(clipboardText);
		if (eagleParsed && eagleParsed.type === 'item') {
			itemId = eagleParsed.id;
		}
		
		if (!itemId) {
			const localhostId = parseEagleLocalhostUrl(clipboardText);
			if (localhostId) {
				itemId = localhostId;
			}
		}
		
		if (!itemId && this.isEagleLibraryPath(clipboardText)) {
			directFilePath = clipboardText;
			const idMatch = clipboardText.match(/images\/([A-Z0-9]+)\.info/i);
			if (idMatch) {
				itemId = idMatch[1];
			}
		}

		if (!itemId && !directFilePath) {
			new Notice('Clipboard does not contain a valid Eagle URL or file path');
			return;
		}

		const provider = this.getActiveCloudProvider();
		if (!provider) {
			new Notice('No cloud provider configured. Check settings.');
			return;
		}

		const providerName = this.getActiveCloudProviderName();

		if (itemId) {
			const item = await this.api.getItemInfo(itemId);
			if (!item) {
				new Notice('Could not fetch item info from Eagle');
				return;
			}

			const filePath = await this.api.getOriginalFilePath(item);
			if (!filePath) {
				new Notice('Could not get file path from Eagle');
				return;
			}

			new Notice(`Uploading ${item.name} to ${providerName}...`);
			
			const filename = `${item.name}.${item.ext}`;
			const mimeType = getMimeType(item.ext);
			const result = await provider.upload(filePath, filename, mimeType);

			if (result.success && result.publicUrl) {
				const markdown = `![${filename}](${result.publicUrl})`;
				editor.replaceSelection(markdown);
				new Notice(`Embedded and uploaded to ${providerName}!`);
				
				if (result.key) {
					const cloudTag = `cloud:${result.key}`;
					const newTags = [...item.tags];
					if (!newTags.includes(cloudTag)) {
						newTags.push(cloudTag);
					}
					if (!newTags.includes('cloud-upload')) {
						newTags.push('cloud-upload');
					}
					await this.api.updateItem(item.id, { tags: newTags });
				}
			} else {
				new Notice(`Upload failed: ${result.error}`);
			}
		} else if (directFilePath) {
			const filename = directFilePath.split('/').pop() || 'image';
			const ext = getExtFromFilename(filename);
			const mimeType = getMimeType(ext);

			new Notice(`Uploading ${filename} to ${providerName}...`);
			const result = await provider.upload(directFilePath, filename, mimeType);

			if (result.success && result.publicUrl) {
				const markdown = `![${filename}](${result.publicUrl})`;
				editor.replaceSelection(markdown);
				new Notice(`Embedded and uploaded to ${providerName}!`);
			} else {
				new Notice(`Upload failed: ${result.error}`);
			}
		}
	}

	private processActiveView(): void {
		return;
	}

	private tryConvertImagePath(img: HTMLImageElement): void {
		const src = img.getAttribute('src');
		if (!src) return;
		
		const alreadyConverted = img.getAttribute('data-original-src');
		if (alreadyConverted) return;

		console.log(`[CMDS Eagle] Checking image src: ${src}`);

		let extractedPath: string | null = null;
		
		if (src.startsWith('file://')) {
			extractedPath = this.fullyDecodeUri(src.replace(/^file:\/\/\/?/, ''));
		} else if (src.startsWith('app://')) {
			const appMatch = src.match(/^app:\/\/[^/]+\/(.+)$/);
			if (appMatch) {
				extractedPath = this.fullyDecodeUri(appMatch[1]);
			}
		}

		if (!extractedPath) {
			console.log(`[CMDS Eagle] No extractable path`);
			return;
		}

		console.log(`[CMDS Eagle] Extracted: ${extractedPath}`);

		if (extractedPath.startsWith('Users/') && !extractedPath.startsWith('/')) {
			extractedPath = '/' + extractedPath;
		}

		const isDifferent = this.isPathFromDifferentPlatform(extractedPath);
		console.log(`[CMDS Eagle] Is from different platform: ${isDifferent}`);
		
		if (!isDifferent) return;

		const convertedPath = this.convertPathForCurrentPlatform(extractedPath);
		
		if (convertedPath !== extractedPath) {
			const newSrc = this.pathToFileUrl(convertedPath);
			console.log(`[CMDS Eagle] Setting new src: ${newSrc}`);
			
			const newImg = activeDocument.createElement('img');
			newImg.src = newSrc;
			newImg.alt = img.alt;
			newImg.className = img.className;
			newImg.setAttribute('data-original-src', src);
			newImg.setAttribute('data-xplatform-replaced', 'true');
			
			if (img.parentNode) {
				img.parentNode.replaceChild(newImg, img);
				console.log(`[CMDS Eagle] Image element replaced`);
			}
		}
	}

	private isPathFromDifferentPlatform(path: string): boolean {
		const currentPlatform = this.getCurrentPlatform();
		const currentUsername = this.getCurrentUsername();
		
		for (const computer of this.settings.computers) {
			if (computer.platform === currentPlatform && computer.username === currentUsername) {
				continue;
			}
			
			if (computer.platform === 'darwin') {
				if (path.includes(`/Users/${computer.username}/`)) {
					return true;
				}
			} else if (computer.platform === 'win32') {
				const winPattern = new RegExp(`[A-Za-z]:[/\\\\]Users[/\\\\]${computer.username}[/\\\\]`, 'i');
				if (winPattern.test(path)) {
					return true;
				}
			}
		}
		return false;
	}

	private processEagleLinks(el: HTMLElement): void {
		const links = el.querySelectorAll('a[href^="eagle://"]');
		links.forEach((link) => {
			const href = link.getAttribute('href');
			if (href) {
				link.addEventListener('click', (e) => {
					e.preventDefault();
					window.open(href);
				});
				link.addClass('cmdspace-eagle-link');
			}
		});
	}

	private processFileUrls(el: HTMLElement): void {
		if (!this.settings.enableCrossPlatform) return;
		if (this.settings.crossPlatformConversionMode !== 'render-only') return;

		const images = el.querySelectorAll('img');
		images.forEach((img) => {
			this.convertImageSrcForRendering(img);
		});
	}

	private convertImageSrcForRendering(img: HTMLImageElement): void {
		const src = img.getAttribute('src');
		if (!src) return;

		if (img.getAttribute('data-xplatform-converted')) return;

		let extractedPath: string | null = null;
		
		if (src.startsWith('app://')) {
			const appMatch = src.match(/^app:\/\/[^/]+\/(.+)$/);
			if (appMatch) {
				extractedPath = this.fullyDecodeUri(appMatch[1]);
			}
		} else if (src.startsWith('file://')) {
			extractedPath = this.fullyDecodeUri(src.replace(/^file:\/\/\/?/, ''));
		}

		if (!extractedPath) return;

		if (extractedPath.startsWith('Users/') && !extractedPath.startsWith('/')) {
			extractedPath = '/' + extractedPath;
		}

		if (!this.isPathFromDifferentPlatform(extractedPath)) return;

		const convertedPath = this.convertPathForCurrentPlatform(extractedPath);
		
		if (convertedPath !== extractedPath) {
			const newSrc = this.pathToFileUrl(convertedPath);
			img.setAttribute('src', newSrc);
			img.setAttribute('data-xplatform-converted', 'true');
			img.setAttribute('data-original-src', src);
		}
	}

	private fullyDecodeUri(str: string): string {
		let decoded = str;
		try {
			while (decoded.includes('%')) {
				const next = decodeURIComponent(decoded);
				if (next === decoded) break;
				decoded = next;
			}
		} catch {
			return str;
		}
		return decoded;
	}

	private normalizeTag(tag: string): string {
		let normalized = tag.replace(/\s+/g, '-');
		if (this.settings.tagNormalization === 'lowercase') {
			normalized = normalized.toLowerCase();
		}
		if (this.settings.tagPrefix) {
			normalized = `${this.settings.tagPrefix}/${normalized}`;
		}
		return normalized;
	}

	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	// Synchronous gate for the editor-paste handler. preventDefault() must be
	// called synchronously, so detection happens here before delegating async work.
	private willHandlePaste(evt: ClipboardEvent): boolean {
		const clipboardData = evt.clipboardData;
		if (!clipboardData) return false;

		const text = clipboardData.getData('text/plain').trim();
		if (extractEagleItemId(text)) return true;
		if (isEagleLocalhostUrl(text)) return true;
		if (this.isEagleLibraryPath(text)) return true;

		const { files } = clipboardData;
		if (!files || !this.allFilesAreImages(files)) return false;
		return this.settings.imagePasteBehavior !== 'local';
	}

	private async handlePaste(evt: ClipboardEvent, editor: Editor): Promise<void> {
		const clipboardData = evt.clipboardData;
		if (!clipboardData) return;

		const text = clipboardData.getData('text/plain').trim();

		if (extractEagleItemId(text)) {
			await this.handleEagleLinkPaste(text, editor);
			return;
		}

		if (this.isEagleLibraryPath(text)) {
			await this.handleEagleLibraryPathPaste(text, editor);
			return;
		}

		const { files } = clipboardData;
		if (!files || !this.allFilesAreImages(files)) return;

		if (this.settings.imagePasteBehavior === 'local') {
			return;
		}

		let sourceInfo: ImageSourceInfo | null = null;
		try {
			sourceInfo = await this.clipboardSourceService.getSourceInfo();
		} catch (e) {
			console.warn('[CMDS Eagle] Error retrieving clipboard source info:', e);
		}

		const fileItems = Array.from(files).map(file => ({
			file,
			localPath: this.extractLocalFilePath(file, sourceInfo)
		}));

		if (this.settings.imagePasteBehavior === 'eagle') {
			for (const item of fileItems) {
				await this.uploadFileWithProgress(item.file, editor, sourceInfo, item.localPath);
			}
			return;
		}

		if (this.settings.imagePasteBehavior === 'cloud') {
			for (const item of fileItems) {
				await this.uploadToCloudWithProgress(item.file, editor);
			}
			return;
		}

		const cloudProviderName = this.getActiveCloudProviderName();
		const modal = new ImagePasteChoiceModal(this.app, cloudProviderName);
		modal.open();
		const response = await modal.getResponse();

		if (response.rememberChoice && response.choice !== 'cancel') {
			this.settings.imagePasteBehavior = response.choice;
			await this.saveSettings();
		}

		if (response.choice === 'eagle') {
			for (const item of fileItems) {
				await this.uploadFileWithProgress(item.file, editor, sourceInfo, item.localPath);
			}
		} else if (response.choice === 'local') {
			for (const item of fileItems) {
				await this.saveImageLocally(item.file, editor);
			}
		} else if (response.choice === 'cloud') {
			for (const item of fileItems) {
				await this.uploadToCloudWithProgress(item.file, editor);
			}
		}
	}

	// Synchronous gate for the editor-drop handler (see willHandlePaste).
	private willHandleDrop(evt: DragEvent): boolean {
		const { files } = evt.dataTransfer || { files: null };
		if (!files || !this.allFilesAreImages(files)) return false;
		return this.settings.imagePasteBehavior !== 'local';
	}

	private async handleDrop(evt: DragEvent, editor: Editor): Promise<void> {
		const { files } = evt.dataTransfer || { files: null };
		if (!files || !this.allFilesAreImages(files)) return;

		if (this.settings.imagePasteBehavior === 'local') {
			return;
		}

		let sourceInfo: ImageSourceInfo | null = null;
		if (evt.dataTransfer) {
			const dt = evt.dataTransfer;
			const uriList = dt.getData('text/uri-list');
			const html = dt.getData('text/html');
			const textPlain = dt.getData('text/plain')?.trim();
			let pageUrl: string | undefined;
			let imageUrl: string | undefined;
			let localFilePath: string | undefined;
			let altText: string | undefined;

			// 1. Process text/uri-list (RFC 2483 multi-line support)
			if (uriList) {
				const lines = uriList.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
				for (const line of lines) {
					if (isValidHttpUrl(line)) {
						const cleaned = cleanUrl(line);
						if (isDirectImageUrl(cleaned)) {
							if (!imageUrl) imageUrl = cleaned;
						} else if (!pageUrl) {
							pageUrl = cleaned;
						}
					} else if (line.startsWith('file://') && !localFilePath) {
						try {
							localFilePath = decodeURIComponent(new URL(line).pathname);
							if (/^\/[A-Za-z]:/.test(localFilePath)) {
								localFilePath = localFilePath.slice(1);
							}
						} catch {
							localFilePath = line.replace(/^file:\/\//, '');
						}
					}
				}
			}

			// 2. Process text/plain
			if (textPlain && !localFilePath) {
				if (/^[A-Za-z]:[\\/]/.test(textPlain) || textPlain.startsWith('\\\\') || textPlain.startsWith('/')) {
					localFilePath = textPlain;
				} else if (textPlain.startsWith('file://')) {
					try {
						localFilePath = decodeURIComponent(new URL(textPlain.split('\r\n')[0]).pathname);
						if (/^\/[A-Za-z]:/.test(localFilePath)) {
							localFilePath = localFilePath.slice(1);
						}
					} catch {
						localFilePath = textPlain.split('\r\n')[0].replace(/^file:\/\//, '');
					}
				} else if (isValidHttpUrl(textPlain)) {
					const cleaned = cleanUrl(textPlain);
					if (isDirectImageUrl(cleaned)) {
						if (!imageUrl) imageUrl = cleaned;
					} else if (!pageUrl) {
						pageUrl = cleaned;
					}
				}
			}

			// 3. Process additional dataTransfer types (e.g. text/x-moz-url)
			if (dt.types) {
				for (const type of dt.types) {
					if (type === 'text/x-moz-url') {
						const mozUrlData = dt.getData('text/x-moz-url');
						if (mozUrlData) {
							const mozFirstLine = mozUrlData.split(/\r?\n/)[0].trim();
							if (isValidHttpUrl(mozFirstLine)) {
								const cleaned = cleanUrl(mozFirstLine);
								if (isDirectImageUrl(cleaned)) {
									if (!imageUrl) imageUrl = cleaned;
								} else if (!pageUrl) {
									pageUrl = cleaned;
								}
							}
						}
					}
				}
			}

			// 4. Process text/html
			if (html) {
				// SourceURL header in HTML if present
				const sourceUrlMatch = html.match(/SourceURL:\s*(https?:\/\/[^\r\n<>"']+)/i);
				if (sourceUrlMatch && isValidHttpUrl(sourceUrlMatch[1])) {
					const cleaned = cleanUrl(sourceUrlMatch[1]);
					if (isDirectImageUrl(cleaned)) {
						if (!imageUrl) imageUrl = cleaned;
					} else if (!pageUrl) {
						pageUrl = cleaned;
					}
				}

				// <base href="...">
				const baseMatch = html.match(/<base\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/i);
				if (baseMatch && isValidHttpUrl(baseMatch[1])) {
					const cleaned = cleanUrl(baseMatch[1]);
					if (!isDirectImageUrl(cleaned) && !pageUrl) {
						pageUrl = cleaned;
					}
				}

				// <a href="...">
				const aMatch = html.match(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/i);
				if (aMatch && aMatch[1]) {
					const href = aMatch[1].replace(/&amp;/g, '&').trim();
					if (isValidHttpUrl(href)) {
						const cleaned = cleanUrl(href);
						if (isDirectImageUrl(cleaned)) {
							if (!imageUrl) imageUrl = cleaned;
						} else if (!pageUrl) {
							pageUrl = cleaned;
						}
					}
				}

				// Canonical / data-url / data-page-url
				const dataUrlMatch = html.match(/\b(?:data-url|data-page-url|data-source|data-origin)\s*=\s*["'](https?:\/\/[^"']+)["']/i);
				if (dataUrlMatch && isValidHttpUrl(dataUrlMatch[1])) {
					const cleaned = cleanUrl(dataUrlMatch[1]);
					if (!isDirectImageUrl(cleaned) && !pageUrl) {
						pageUrl = cleaned;
					}
				}

				// <img src="..." alt="...">
				const imgMatch = html.match(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i) ||
					html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i) ||
					html.match(/<img[^>]+src=([^\s>]+)/i);
				if (imgMatch && imgMatch[1]) {
					let decoded = imgMatch[1].replace(/&amp;/g, '&').trim();
					if (decoded.startsWith('//')) {
						decoded = 'https:' + decoded;
					}
					if (isValidHttpUrl(decoded)) {
						const cleaned = cleanUrl(decoded);
						if (!imageUrl) {
							imageUrl = cleaned;
						}
					}
				}

				const altMatch = html.match(/<img\b[^>]*?\balt\s*=\s*["']([^"']*)["']/i) ||
					html.match(/<img[^>]+alt=["']([^"']*)["']/i);
				if (altMatch && altMatch[1]) {
					altText = altMatch[1].trim();
				}
			}

			// 5. Fallback: check system clipboard for webpage URL if pageUrl is still missing
			if (!pageUrl) {
				try {
					const electron = (window as any).require
						? (window as any).require('electron')
						: require('electron');
					if (electron?.clipboard) {
						const clipText = cleanUrl(electron.clipboard.readText());
						if (isValidHttpUrl(clipText) && !isDirectImageUrl(clipText)) {
							pageUrl = clipText;
						}
					}
				} catch {
					// ignore
				}
			}

			// 6. Safeguard: direct image URLs must never masquerade as pageUrl
			if (pageUrl) {
				if (isDirectImageUrl(pageUrl) || pageUrl === imageUrl) {
					if (!imageUrl) imageUrl = pageUrl;
					pageUrl = undefined;
				}
			}

			if (pageUrl || imageUrl || localFilePath || altText) {
				sourceInfo = { pageUrl, imageUrl, localFilePath, altText };
			}
		}

		const fileItems = Array.from(files).map(file => ({
			file,
			localPath: this.extractLocalFilePath(file, sourceInfo)
		}));

		if (this.settings.imagePasteBehavior === 'eagle') {
			for (const item of fileItems) {
				await this.uploadFileWithProgress(item.file, editor, sourceInfo, item.localPath);
			}
			return;
		}

		if (this.settings.imagePasteBehavior === 'cloud') {
			for (const item of fileItems) {
				await this.uploadToCloudWithProgress(item.file, editor);
			}
			return;
		}

		const cloudProviderName = this.getActiveCloudProviderName();
		const modal = new ImagePasteChoiceModal(this.app, cloudProviderName);
		modal.open();
		const response = await modal.getResponse();

		if (response.rememberChoice && response.choice !== 'cancel') {
			this.settings.imagePasteBehavior = response.choice;
			await this.saveSettings();
		}

		if (response.choice === 'eagle') {
			for (const item of fileItems) {
				await this.uploadFileWithProgress(item.file, editor, sourceInfo, item.localPath);
			}
		} else if (response.choice === 'local') {
			for (const item of fileItems) {
				await this.saveImageLocally(item.file, editor);
			}
		} else if (response.choice === 'cloud') {
			for (const item of fileItems) {
				await this.uploadToCloudWithProgress(item.file, editor);
			}
		}
	}

	private async saveImageLocally(file: File, editor: Editor): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		try {
			const buffer = await file.arrayBuffer();
			const timestamp = Date.now();
			const filename = `${timestamp}-${file.name}`;
			
			const vault = this.app.vault as unknown as { getConfig: (key: string) => string | undefined };
			const attachmentFolder = vault.getConfig?.('attachmentFolderPath') || '';
			let targetPath: string;
			
			if (attachmentFolder === './') {
				const parentFolder = activeFile.parent?.path || '';
				targetPath = parentFolder ? `${parentFolder}/${filename}` : filename;
			} else if (attachmentFolder.startsWith('./')) {
				const parentFolder = activeFile.parent?.path || '';
				const relativeFolder = attachmentFolder.slice(2);
				targetPath = parentFolder ? `${parentFolder}/${relativeFolder}/${filename}` : `${relativeFolder}/${filename}`;
			} else if (attachmentFolder) {
				targetPath = `${attachmentFolder}/${filename}`;
			} else {
				targetPath = filename;
			}

			// Clean up any double slashes and strip leading slash if present
			targetPath = targetPath.replace(/\/+/g, '/');
			if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);

			const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
			if (folderPath) {
				const folderExists = await this.app.vault.adapter.exists(folderPath);
				if (!folderExists) {
					await this.app.vault.createFolder(folderPath);
				}
			}

			await this.app.vault.createBinary(targetPath, buffer);
			
			const markdownImage = `![${file.name}](${encodeURI(targetPath)})`;
			editor.replaceSelection(markdownImage);
			new Notice(`Saved locally: ${file.name}`);
		} catch (error) {
			console.error('Failed to save image locally:', error);
			new Notice(`Failed to save: ${file.name}`);
		}
	}

	private async uploadFileWithProgress(
		file: File,
		editor: Editor,
		sourceInfo?: ImageSourceInfo | null,
		localFilePath?: string | null
	): Promise<void> {
		const pasteId = this.generatePasteId();
		const placeholderText = `![Uploading ${file.name}...](${pasteId})`;
		
		editor.replaceSelection(placeholderText);

		try {
			const effectiveLocalPath = localFilePath || this.extractLocalFilePath(file, sourceInfo);
			const { url: imageUrl, item } = await this.uploadImageToEagle(file, sourceInfo);
			const displayName = item ? `${item.name}.${item.ext}` : file.name;
			let markdownImage = `![${displayName}](${imageUrl})`;
			
			if (item && this.settings.insertThumbnail) {
				const sources = await this.resolveMetadataSources(item, sourceInfo, effectiveLocalPath);
				markdownImage += '\n\n' + this.buildMetadataCard(item, sources);
			}

			this.replaceTextInDocument(editor, placeholderText, markdownImage);
			new Notice(`Uploaded to Eagle: ${displayName}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			if (errorMessage === 'Upload cancelled') {
				this.replaceTextInDocument(editor, placeholderText, '');
				new Notice('Upload cancelled');
				return;
			}
			const errorText = `<!-- Failed to upload ${file.name}: ${errorMessage} -->`;
			this.replaceTextInDocument(editor, placeholderText, errorText);
			console.error('Failed to upload image:', error);
			new Notice(`Failed to upload: ${file.name}`);
		}
	}

	private async uploadToCloudWithProgress(file: File, editor: Editor): Promise<void> {
		const provider = this.getActiveCloudProvider();
		if (!provider) {
			new Notice('No cloud provider configured');
			return;
		}

		const pasteId = this.generatePasteId();
		const providerName = this.getActiveCloudProviderName();
		const placeholderText = `![Uploading to ${providerName}...](${pasteId})`;
		
		editor.replaceSelection(placeholderText);

		try {
			const tempPath = await this.saveToTempLocation(file);
			const ext = getExtFromFilename(file.name);
			const mimeType = getMimeType(ext);
			
			const result = await provider.upload(tempPath, file.name, mimeType);
			
			if (result.success && result.publicUrl) {
				const markdownImage = `![${file.name}](${result.publicUrl})`;
				this.replaceTextInDocument(editor, placeholderText, markdownImage);
				new Notice(`Uploaded to ${providerName}: ${file.name}`);
			} else {
				throw new Error(result.error || 'Upload failed');
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const errorText = `<!-- Failed to upload ${file.name}: ${errorMessage} -->`;
			this.replaceTextInDocument(editor, placeholderText, errorText);
			console.error('Failed to upload to cloud:', error);
			new Notice(`Failed to upload: ${file.name}`);
		}
	}

	private getActiveCloudProvider(): CloudProvider | null {
		const providerType = this.settings.activeCloudProvider;
		const config = this.settings.cloudProviders[providerType];
		
		if (!config || !config.enabled) {
			if (this.settings.r2WorkerUrl && this.settings.r2ApiKey) {
				return createCloudProvider({
					type: 'r2',
					enabled: true,
					name: 'Cloudflare R2',
					workerUrl: this.settings.r2WorkerUrl,
					apiKey: this.settings.r2ApiKey,
					publicUrl: this.settings.r2PublicUrl,
				});
			}
			return null;
		}

		return createCloudProvider(config);
	}

	private getActiveCloudProviderName(): string {
		const providerType = this.settings.activeCloudProvider;
		const config = this.settings.cloudProviders[providerType];
		
		if (config?.enabled && config?.name) {
			return config.name;
		}
		
		if (this.settings.r2WorkerUrl) {
			return 'Cloudflare R2';
		}
		
		return 'Cloud';
	}

	private replaceTextInDocument(editor: Editor, searchText: string, replaceText: string): void {
		const content = editor.getValue();
		const index = content.indexOf(searchText);
		if (index === -1) return;

		const startPos = editor.offsetToPos(index);
		const endPos = editor.offsetToPos(index + searchText.length);
		editor.replaceRange(replaceText, startPos, endPos);
	}

	private generatePasteId(): string {
		return `paste-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	private getLocalImageUnderCursor(editor: Editor): { file: TFile; startPos: EditorPosition; endPos: EditorPosition; originalText: string } | null {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		
		const supportedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'tif', 'heic', 'heif', 'avif', 'ico'];
		const extensionPattern = supportedExtensions.join('|');
		const wikilinkPattern = new RegExp(`!\\[\\[([^\\]]+\\.(${extensionPattern}))\\]\\]`, 'gi');
		const markdownPattern = new RegExp(`!\\[([^\\]]*)\\]\\(([^)]+\\.(${extensionPattern}))\\)`, 'gi');
		
		let match: RegExpExecArray | null;
		
		wikilinkPattern.lastIndex = 0;
		while ((match = wikilinkPattern.exec(line)) !== null) {
			const start = match.index;
			const end = start + match[0].length;
			if (cursor.ch >= start && cursor.ch <= end) {
				const filename = match[1];
				const file = this.app.metadataCache.getFirstLinkpathDest(filename, '');
				if (file instanceof TFile) {
					return {
						file,
						startPos: { line: cursor.line, ch: start },
						endPos: { line: cursor.line, ch: end },
						originalText: match[0],
					};
				}
			}
		}
		
		markdownPattern.lastIndex = 0;
		while ((match = markdownPattern.exec(line)) !== null) {
			const start = match.index;
			const end = start + match[0].length;
			if (cursor.ch >= start && cursor.ch <= end) {
				const filepath = match[2];
				if (!filepath.startsWith('http') && !filepath.startsWith('file://') && !filepath.startsWith('eagle://')) {
					const file = this.app.metadataCache.getFirstLinkpathDest(filepath, '');
					if (file instanceof TFile) {
						return {
							file,
							startPos: { line: cursor.line, ch: start },
							endPos: { line: cursor.line, ch: end },
							originalText: match[0],
						};
					}
				}
			}
		}
		
		return null;
	}

	private async uploadLocalImageToEagle(
		editor: Editor,
		localImage: { file: TFile; startPos: EditorPosition; endPos: EditorPosition; originalText: string }
	): Promise<void> {
		const { file, startPos, endPos, originalText } = localImage;
		
		const placeholderText = `![Uploading ${file.name}...](uploading)`;
		editor.replaceRange(placeholderText, startPos, endPos);
		
		try {
			const connected = await this.api.isConnected();
			if (!connected) {
				throw new Error('Eagle is not running');
			}

			const absolutePath = this.getAbsolutePath(file.path);
			const filenameWithoutExt = file.basename;
			
			const backlinkData = await this.getEagleBacklinkPayload();

			const previewUrl = this.app.vault.getResourcePath(file);
			const folderResolution = await this.resolveEagleFolderForUpload({
				file,
				fileName: filenameWithoutExt,
				previewUrl,
			});
			if (folderResolution.cancelled) {
				this.replaceTextInDocument(editor, placeholderText, originalText);
				new Notice('Eagle import cancelled');
				return;
			}

			const finalName = folderResolution.name || filenameWithoutExt;
			const finalTags = folderResolution.tags !== undefined ? folderResolution.tags : this.getDefaultTags();
			const finalAnnotation = [folderResolution.annotation, backlinkData.annotation].filter(Boolean).join('\n\n') || undefined;

			const result = await this.api.addFromPath({
				path: absolutePath,
				name: finalName,
				tags: finalTags,
				folderId: folderResolution.folderId,
				star: folderResolution.star,
				...backlinkData,
				annotation: finalAnnotation,
			});

			if (!result.success || !result.itemId) {
				throw new Error('Failed to add image to Eagle');
			}

			await this.delay(1000);

			const thumbnailPath = await this.api.getThumbnailPath(result.itemId);
			const item = await this.api.getItemInfo(result.itemId);

			void this.applyObsidianBacklink(result.itemId);

			let imageUrl: string;
			if (this.settings.eagleEmbedUrlMode === 'custom-url') {
				const libraryName = (await this.api.getLibraryName()) || 'Main';
				const ext = item ? item.ext : file.extension;
				const name = item ? item.name : filenameWithoutExt;
				imageUrl = buildEagleCustomEmbedUrl(
					this.settings.eagleCustomUrlPrefix,
					libraryName,
					result.itemId,
					name,
					ext,
					false
				);
			} else if (thumbnailPath) {
				imageUrl = this.pathToFileUrl(thumbnailPath);
			} else {
				imageUrl = `eagle://item/${result.itemId}`;
			}
			
			const markdownImage = `![${file.basename}](${imageUrl})`;
			this.replaceTextInDocument(editor, placeholderText, markdownImage);
			
			new Notice(`Uploaded to Eagle: ${file.name}`);
			
			await this.offerToReplaceOtherReferences(file, imageUrl, { line: startPos.line, ch: startPos.ch });
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.replaceTextInDocument(editor, placeholderText, originalText);
			new Notice(`Failed to upload: ${errorMessage}`);
		}
	}

	private async offerToReplaceOtherReferences(
		originalFile: TFile,
		newUrl: string,
		excludePosition: { line: number; ch: number }
	): Promise<void> {
		const references = this.findAllReferencesToFile(originalFile);
		
		const filteredRefs: { notePath: string; positions: { line: number; ch: number; text: string }[] }[] = [];
		for (const ref of references) {
			const filteredPositions = ref.positions.filter(pos => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && ref.notePath === activeFile.path) {
					return !(pos.line === excludePosition.line && pos.ch === excludePosition.ch);
				}
				return true;
			});
			if (filteredPositions.length > 0) {
				filteredRefs.push({ notePath: ref.notePath, positions: filteredPositions });
			}
		}

		if (filteredRefs.length === 0) return;

		const totalCount = filteredRefs.reduce((sum, ref) => sum + ref.positions.length, 0);
		const fileCount = filteredRefs.length;

		const shouldReplace = await this.confirmReplaceReferences(totalCount, fileCount, originalFile.name);
		if (!shouldReplace) return;

		await this.replaceAllReferences(filteredRefs, originalFile, newUrl);
		new Notice(`Replaced ${totalCount} references in ${fileCount} files`);
	}

	private findAllReferencesToFile(targetFile: TFile): { notePath: string; positions: { line: number; ch: number; text: string }[] }[] {
		const results: { notePath: string; positions: { line: number; ch: number; text: string }[] }[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		for (const file of allFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.embeds) continue;

			const positions: { line: number; ch: number; text: string }[] = [];
			for (const embed of cache.embeds) {
				const linkedFile = this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
				if (linkedFile === targetFile) {
					positions.push({
						line: embed.position.start.line,
						ch: embed.position.start.col,
						text: embed.original,
					});
				}
			}

			if (positions.length > 0) {
				results.push({ notePath: file.path, positions });
			}
		}

		return results;
	}

	private async confirmReplaceReferences(count: number, fileCount: number, filename: string): Promise<boolean> {
		return new Promise((resolve) => {
			const notice = new Notice(
				`Found ${count} other references to "${filename}" in ${fileCount} files. Click to replace all with Eagle link.`,
				10000
			);
			
			const noticeEl = (notice as unknown as { noticeEl: HTMLElement }).noticeEl;
			noticeEl.addClass('cmds-eagle-clickable-notice');
			noticeEl.onclick = () => {
				notice.hide();
				resolve(true);
			};
			
			window.setTimeout(() => resolve(false), 10000);
		});
	}

	private async replaceAllReferences(
		references: { notePath: string; positions: { line: number; ch: number; text: string }[] }[],
		originalFile: TFile,
		newUrl: string
	): Promise<void> {
		for (const ref of references) {
			const file = this.app.vault.getAbstractFileByPath(ref.notePath);
			if (!(file instanceof TFile)) continue;

			let content = await this.app.vault.read(file);
			
			const sortedPositions = [...ref.positions].sort((a, b) => {
				if (a.line !== b.line) return b.line - a.line;
				return b.ch - a.ch;
			});

			for (const pos of sortedPositions) {
				const newMarkdown = `![${originalFile.basename}](${newUrl})`;
				const lines = content.split('\n');
				const line = lines[pos.line];
				if (line) {
					const index = line.indexOf(pos.text, pos.ch);
					if (index !== -1) {
						lines[pos.line] = line.substring(0, index) + newMarkdown + line.substring(index + pos.text.length);
						content = lines.join('\n');
					}
				}
			}

			await this.app.vault.modify(file, content);
		}
	}

	private async handleEagleLinkPaste(text: string, editor: Editor): Promise<void> {
		const itemId = extractEagleItemId(text);
		if (!itemId) {
			new Notice('Invalid Eagle URL');
			return;
		}

		const item = await this.api.getItemInfo(itemId);
		if (!item) {
			new Notice('Could not fetch item info from Eagle');
			return;
		}

		let action: 'embed' | 'inline' = 'embed';
		let useThumbnail = false;

		if (this.settings.eagleLinkPasteMode === 'ask') {
			const modal = new EagleLinkChoiceModal(this.app, item);
			modal.open();
			const response = await modal.getResponse();

			if (response.choice === 'cancel') {
				return;
			}

			if (response.rememberChoice) {
				this.settings.eagleLinkPasteMode = response.choice;
				await this.saveSettings();
			}

			action = response.choice;
			useThumbnail = response.useThumbnail;
		} else if (this.settings.eagleLinkPasteMode === 'embed') {
			action = 'embed';
			useThumbnail = false;
		} else if (this.settings.eagleLinkPasteMode === 'inline') {
			action = 'inline';
			useThumbnail = false;
		}

		if (action === 'embed') {
			await this.insertEagleEmbed(editor, item, useThumbnail);
		} else {
			this.insertEagleInlineLink(editor, item);
		}

		void this.applyObsidianBacklink(item.id);
	}

	private async insertEagleEmbed(editor: Editor, item: EagleItem, useThumbnail: boolean): Promise<void> {
		const filename = `${item.name}.${item.ext}`;
		const sources = await this.resolveMetadataSources(item);

		if (this.settings.eagleEmbedUrlMode === 'custom-url') {
			const libraryName = (await this.api.getLibraryName()) || 'Main';
			const embedUrl = buildEagleCustomEmbedUrl(
				this.settings.eagleCustomUrlPrefix,
				libraryName,
				item.id,
				item.name,
				item.ext,
				useThumbnail
			);
			let markdown = `![${filename}](${embedUrl})`;
			if (this.settings.insertThumbnail) {
				markdown += '\n\n' + this.buildMetadataCard(item, sources);
			}
			editor.replaceSelection(markdown);
			new Notice(`Embedded: ${filename}`);
			return;
		}

		// Local file:// mode
		let filePath: string | null = null;
		if (useThumbnail) {
			filePath = await this.api.getThumbnailPath(item.id);
		}
		if (!filePath) {
			filePath = await this.getEagleItemFilePath(item.id, item.name, item.ext);
		}

		if (filePath) {
			const fileUrl = this.pathToFileUrl(filePath);
			let markdown = `![${filename}](${fileUrl})`;
			if (this.settings.insertThumbnail) {
				markdown += '\n\n' + this.buildMetadataCard(item, sources);
			}
			editor.replaceSelection(markdown);
			new Notice(`Embedded: ${filename}`);
		} else {
			new Notice('Could not get file path from Eagle');
		}
	}

	private insertEagleInlineLink(editor: Editor, item: EagleItem): void {
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		const filename = `${item.name}.${item.ext}`;
		const markdown = `[${filename}](${linkUrl})`;
		editor.replaceSelection(markdown);
		new Notice(`Inserted link to: ${filename}`);
	}

	private isEagleLibraryPath(text: string): boolean {
		if (text.startsWith('![') || text.startsWith('](')) {
			return false;
		}
		const normalizedText = text.replace(/\\/g, '/');
		return normalizedText.includes('.library/images/') && normalizedText.includes('.info/');
	}

	private async handleEagleLibraryPathPaste(path: string, editor: Editor): Promise<void> {
		// pathToFileUrl expects a plain filesystem path, so strip any file:// scheme.
		const normalizedPath = this.safeDecodeUri(path.replace(/\\/g, '/')).replace(/^file:\/\/+/, '/');

		// Eagle puts the *thumbnail* file path on the clipboard. The enclosing
		// ".../<itemId>.info/" folder holds both the thumbnail and the original,
		// and its name is the Eagle item id — use it to resolve the original asset.
		const idMatch = normalizedPath.match(/\/([A-Za-z0-9]+)\.info\//);
		if (idMatch) {
			const item = await this.api.getItemInfo(idMatch[1]);
			if (item) {
				const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
				const originalPath = `${folderPath}/${item.name}.${item.ext}`;
				const filename = `${item.name}.${item.ext}`;
				let markdown = `![${filename}](${this.pathToFileUrl(originalPath)})`;
				if (this.settings.insertThumbnail) {
					const sources = await this.resolveMetadataSources(item);
					markdown += '\n\n' + this.buildMetadataCard(item, sources);
				}
				editor.replaceSelection(markdown);
				new Notice(`Embedded: ${filename}`);
				return;
			}
		}

		// Fallback (Eagle unreachable / unexpected path): drop a "_thumbnail" suffix
		// if present so we still prefer the original, otherwise embed verbatim.
		const fallbackPath = normalizedPath.replace(/_thumbnail(\.[A-Za-z0-9]+)$/, '$1');
		const filename = fallbackPath.split('/').pop() || 'image';
		editor.replaceSelection(`![${filename}](${this.pathToFileUrl(fallbackPath)})`);
		new Notice(`Embedded: ${filename}`);
	}

	private async getEagleItemFilePath(itemId: string, name: string, ext: string): Promise<string | null> {
		const thumbnailPath = await this.api.getThumbnailPath(itemId);
		if (!thumbnailPath) return null;

		const decodedPath = this.safeDecodeUri(thumbnailPath);
		const folderPath = decodedPath.substring(0, decodedPath.lastIndexOf('/'));
		const originalFileName = `${name}.${ext}`;
		return `${folderPath}/${originalFileName}`;
	}

	// ── Excalidraw integration ──────────────────────────────────────────────
	// Obsidian's editor-paste/editor-drop events only fire in the Markdown editor,
	// not in an Excalidraw canvas. And the Excalidraw plugin's onPasteHook receives
	// an already-consumed clipboard (no image bytes). So we attach capture-phase
	// paste/drop listeners on each Excalidraw view container: this intercepts BEFORE
	// Excalidraw, handles Eagle references (embed the ORIGINAL) and pasted image
	// files (upload to the cloud provider), and suppresses Excalidraw's default
	// handling — embedding a portable cloud URL instead of a vault attachment.

	private registerExcalidrawIntegration(): void {
		this.app.workspace.onLayoutReady(() => {
			this.scanAndAttachExcalidrawContainers();
			// Attach to canvases as they are opened / the layout changes.
			this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
				this.scanAndAttachExcalidrawContainers();
			}));
			this.registerEvent(this.app.workspace.on('layout-change', () => {
				this.scanAndAttachExcalidrawContainers();
			}));
		});
	}

	// Public so the settings toggle can attach to already-open canvases immediately.
	scanAndAttachExcalidrawContainers(): void {
		if (!this.settings.excalidrawIntegration) return;
		for (const leaf of this.app.workspace.getLeavesOfType('excalidraw')) {
			const view = leaf.view as unknown as ExcalidrawViewLike;
			const el = view?.containerEl;
			// Feature-detect the view API so an Excalidraw version drift fails soft.
			if (!el || this.attachedExcalidrawContainers.has(el) || typeof view.addImageWithURL !== 'function') continue;
			this.attachedExcalidrawContainers.add(el);
			this.registerDomEvent(el, 'paste', (evt) => this.onExcalidrawPasteOrDrop(evt, view), { capture: true });
			this.registerDomEvent(el, 'drop', (evt) => this.onExcalidrawPasteOrDrop(evt, view), { capture: true });
		}
	}

	private onExcalidrawPasteOrDrop(evt: ClipboardEvent | DragEvent, view: ExcalidrawViewLike): void {
		if (!this.settings.excalidrawIntegration) return;
		const dt = evt instanceof ClipboardEvent ? evt.clipboardData : evt.dataTransfer;
		if (!dt) return;

		const text = (dt.getData('text/plain') || '').trim();
		if (this.isEagleReference(text)) {
			evt.preventDefault();
			evt.stopImmediatePropagation();
			void this.addEagleRefToCanvas(view, text);
			return;
		}

		const images = Array.from(dt.files).filter((f) => f.type.startsWith('image/'));
		if (images.length > 0) {
			evt.preventDefault();
			evt.stopImmediatePropagation();
			void this.addImageFilesToCanvas(view, images);
			return;
		}
		// Neither an Eagle reference nor an image — let Excalidraw handle it natively.
	}

	private isEagleReference(text: string): boolean {
		return !!text && (isEagleLocalhostUrl(text) || this.isEagleLibraryPath(text));
	}

	private async resolveEagleItemFromReference(text: string): Promise<EagleItem | null> {
		if (isEagleLocalhostUrl(text)) {
			const id = parseEagleLocalhostUrl(text);
			return id ? this.api.getItemInfo(id) : null;
		}
		const idMatch = text.replace(/\\/g, '/').match(/\/([A-Za-z0-9]+)\.info\//);
		return idMatch ? this.api.getItemInfo(idMatch[1]) : null;
	}

	private async getEaglePublicUrl(item: EagleItem): Promise<string | null> {
		// Reuse an existing cloud (R2) upload if the item already has one.
		const existing = this.api.getCloudUrl(item);
		if (existing) return existing;

		const provider = this.getActiveCloudProvider();
		if (!provider) {
			new Notice('No cloud provider configured for Excalidraw embed');
			return null;
		}
		const originalPath = await this.api.getOriginalFilePath(item);
		if (!originalPath) return null;

		const result = await provider.upload(originalPath, `${item.name}.${item.ext}`, getMimeType(item.ext));
		return result.success && result.publicUrl ? result.publicUrl : null;
	}

	private async addEagleRefToCanvas(view: ExcalidrawViewLike, text: string): Promise<void> {
		try {
			const item = await this.resolveEagleItemFromReference(text);
			if (!item) {
				new Notice('Could not fetch item info from Eagle');
				return;
			}
			const url = await this.getEaglePublicUrl(item);
			if (!url) {
				new Notice(`Could not get a cloud URL for ${item.name}`);
				return;
			}
			await view.addImageWithURL(url);
			new Notice(`Added to canvas: ${item.name}.${item.ext}`);
		} catch (error) {
			console.error('[CMDS Eagle] Excalidraw Eagle-ref embed failed:', error);
			new Notice('Failed to add Eagle image to Excalidraw canvas');
		}
	}

	private async addImageFilesToCanvas(view: ExcalidrawViewLike, files: File[]): Promise<void> {
		const provider = this.getActiveCloudProvider();
		if (!provider) {
			new Notice('No cloud provider configured for Excalidraw embed');
			return;
		}
		const providerName = this.getActiveCloudProviderName();
		for (const file of files) {
			try {
				const tempPath = await this.saveToTempLocation(file);

				// Optionally catalogue the pasted screenshot in the Eagle library.
				let eagleNote = '';
				if (this.settings.excalidrawImportToEagle) {
					const backlinkData = await this.getEagleBacklinkPayload();
					const filenameWithoutExt = resolveImageFileName(file);
					const folderResolution = await this.resolveEagleFolderForUpload({
						file,
						fileName: filenameWithoutExt,
					});

					if (!folderResolution.cancelled) {
						const finalName = folderResolution.name || filenameWithoutExt;
						const finalTags = folderResolution.tags !== undefined ? folderResolution.tags : this.getDefaultTags();
						const finalAnnotation = [folderResolution.annotation, backlinkData.annotation].filter(Boolean).join('\n\n') || undefined;

						const added = await this.api.addFromPath({
							path: tempPath,
							name: finalName,
							tags: finalTags,
							folderId: folderResolution.folderId,
							star: folderResolution.star,
							...backlinkData,
							annotation: finalAnnotation,
						});
						if (added.success) {
							eagleNote = ' + Eagle';
							if (added.itemId) {
								void this.applyObsidianBacklink(added.itemId);
							}
						}
					}
				}

				const result = await provider.upload(tempPath, file.name, getMimeType(getExtFromFilename(file.name)));
				if (result.success && result.publicUrl) {
					await view.addImageWithURL(result.publicUrl);
					new Notice(`Uploaded to ${providerName}${eagleNote} & added to canvas: ${file.name}`);
				} else {
					new Notice(`Failed to upload ${file.name}`);
				}
			} catch (error) {
				console.error('[CMDS Eagle] Excalidraw image upload failed:', error);
				new Notice(`Failed to add image to Excalidraw canvas: ${file.name}`);
			}
		}
	}

	private safeDecodeUri(str: string): string {
		try {
			return decodeURIComponent(str);
		} catch {
			return str;
		}
	}

	private pathToFileUrl(path: string): string {
		let decodedPath = path.replace(/^file:\/\/+/, '');
		if (/^\/[A-Za-z]:/.test(decodedPath)) {
			decodedPath = decodedPath.slice(1);
		}
		try {
			while (decodedPath.includes('%')) {
				const decoded = decodeURIComponent(decodedPath);
				if (decoded === decodedPath) break;
				decodedPath = decoded;
			}
		} catch {
			// keep decodedPath
		}

		const convertedPath = this.convertPathForCurrentPlatform(decodedPath);
		const normalizedPath = convertedPath.replace(/\\/g, '/');
		const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
		
		if (this.getCurrentPlatform() === 'win32' && /^[A-Za-z]:/.test(normalizedPath)) {
			// Fix: restore drive letter colon that was encoded as %3A
			const fixedPath = encodedPath.replace(/^([A-Za-z])%3A/, '$1:');
			return `file:///${fixedPath}`;
		}
		return `file://${encodedPath}`;
	}

	private getCurrentPlatform(): PlatformType {
		return process.platform as PlatformType;
	}

	private getCurrentUsername(): string {
		const platform = this.getCurrentPlatform();
		const vaultPath = this.getVaultPath();
		
		if (platform === 'darwin') {
			const match = vaultPath.match(/^\/Users\/([^/]+)/);
			if (match) return match[1];
		} else if (platform === 'win32') {
			const match = vaultPath.match(/^[A-Za-z]:[/\\]Users[/\\]([^/\\]+)/i);
			if (match) return match[1];
		}
		
		return '';
	}

	private findMatchingComputer(path: string): ComputerProfile | null {
		if (!this.settings.enableCrossPlatform || this.settings.computers.length === 0) {
			return null;
		}

		for (const computer of this.settings.computers) {
			if (computer.platform === 'darwin') {
				const macPattern = `/Users/${computer.username}/`;
				if (path.includes(macPattern)) {
					return computer;
				}
			} else if (computer.platform === 'win32') {
				const winPattern = new RegExp(`^[A-Za-z]:[/\\\\]Users[/\\\\]${computer.username}[/\\\\]`, 'i');
				if (winPattern.test(path)) {
					return computer;
				}
			}
		}
		
		console.log('[CMDS Eagle] No computer matched path:', path.substring(0, 50));
		return null;
	}

	private convertPathForCurrentPlatform(path: string): string {
		if (!this.settings.enableCrossPlatform || this.settings.computers.length === 0) {
			return path;
		}

		const sourceComputer = this.findMatchingComputer(path);
		if (!sourceComputer) {
			console.log('[CMDS Eagle] No matching computer found for path');
			return path;
		}

		const currentPlatform = this.getCurrentPlatform();
		const currentUsername = this.getCurrentUsername();

		const currentComputer = this.settings.computers.find(
			c => c.platform === currentPlatform && c.username === currentUsername
		);

		if (!currentComputer || sourceComputer.id === currentComputer.id) {
			return path;
		}

		const sourceSubPath = sourceComputer.subPath || '';
		const currentSubPath = currentComputer.subPath || '';

		console.log(`[CMDS Eagle] Converting: ${sourceComputer.platform}/${sourceComputer.username}/${sourceSubPath} → ${currentComputer.platform}/${currentComputer.username}/${currentSubPath}`);

		let relativePath = '';
		if (sourceComputer.platform === 'darwin') {
			const sourceRoot = sourceSubPath 
				? `/Users/${sourceComputer.username}/${sourceSubPath}/`
				: `/Users/${sourceComputer.username}/`;
			relativePath = path.replace(sourceRoot, '');
		} else {
			const subPathPart = sourceSubPath ? `[/\\\\]${sourceSubPath.replace(/[/\\]/g, '[/\\\\]')}` : '';
			const winPattern = new RegExp(`[A-Za-z]:[/\\\\]Users[/\\\\]${sourceComputer.username}${subPathPart}[/\\\\]`, 'i');
			relativePath = path.replace(winPattern, '').replace(/\\/g, '/');
		}

		if (currentComputer.platform === 'darwin') {
			const targetRoot = currentSubPath 
				? `/Users/${currentComputer.username}/${currentSubPath}/`
				: `/Users/${currentComputer.username}/`;
			return `${targetRoot}${relativePath}`;
		} else {
			const targetRoot = currentSubPath 
				? `C:/Users/${currentComputer.username}/${currentSubPath}/`
				: `C:/Users/${currentComputer.username}/`;
			return `${targetRoot}${relativePath}`;
		}
	}

	private getDefaultTags(): string[] | undefined {
		if (!this.settings.enableDefaultTags || !this.settings.defaultTags) {
			return undefined;
		}
		
		const parsedTags = this.settings.defaultTags
			.split(',')
			.map(tag => tag.trim())
			.filter(tag => tag.length > 0);
			
		return parsedTags.length > 0 ? parsedTags : undefined;
	}

	private async resolveEagleFolderForUpload(
		contextOrFile?: {
			activeFile?: TFile | null;
			file?: File | TFile | null;
			fileName?: string;
			previewUrl?: string;
			sourceInfo?: ImageSourceInfo | null;
		} | TFile | null
	): Promise<EagleFolderPickerResult> {
		const context = (contextOrFile instanceof TFile)
			? { activeFile: contextOrFile }
			: (contextOrFile || {});

		const mode = this.settings.addFolderMode || (this.settings.enableDefaultFolder ? 'target' : 'target');

		switch (mode) {
			case 'ask': {
				let previewUrl = context.previewUrl;
				let createdBlobUrl = false;
				if (!previewUrl && context.file && typeof File !== 'undefined' && context.file instanceof File) {
					try {
						previewUrl = URL.createObjectURL(context.file);
						createdBlobUrl = true;
					} catch { }
				} else if (!previewUrl && context.file instanceof TFile) {
					previewUrl = this.app.vault.getResourcePath(context.file);
				}

				const fileName = context.fileName || resolveImageFileName(context.file, context.sourceInfo);
				const initialAltText = context.sourceInfo?.altText;
				const initialTags = this.getDefaultTags() || [];

				const result = await EagleFolderPickerModal.pickFolder(
					this.app,
					this.api,
					this.settings.recentEagleFolders || [],
					{
						previewUrl,
						fileName,
						initialAltText,
						initialTags,
					}
				);

				if (createdBlobUrl && previewUrl) {
					URL.revokeObjectURL(previewUrl);
				}

				if (result.cancelled) {
					return { cancelled: true };
				}
				if (result.folderId) {
					const existing = this.settings.recentEagleFolders || [];
					const updated = [result.folderId, ...existing.filter((id) => id !== result.folderId)].slice(0, 10);
					this.settings.recentEagleFolders = updated;
					void this.saveSettings();
				}
				return result;
			}

			case 'mirror': {
				const folderId = await this.resolveMirroredEagleFolder(
					context.activeFile || (context.file instanceof TFile ? context.file : undefined)
				);
				return { folderId, cancelled: false };
			}

			case 'map': {
				const folderId = this.resolveMappedEagleFolder(
					context.activeFile || (context.file instanceof TFile ? context.file : undefined)
				);
				return { folderId, cancelled: false };
			}

			case 'target':
			default: {
				const folderId = this.settings.defaultFolder || undefined;
				return { folderId, cancelled: false };
			}
		}
	}

	private async resolveMirroredEagleFolder(activeFile?: TFile | null): Promise<string | undefined> {
		const file = activeFile ?? this.app.workspace.getActiveFile();
		const folderPath = file?.parent?.path;
		if (!folderPath || folderPath === '/' || folderPath === '.') {
			return undefined;
		}

		const segments = folderPath.split('/').map(s => s.trim()).filter(s => s.length > 0);
		if (segments.length === 0) {
			return undefined;
		}

		try {
			const eagleFolders = await this.api.listFolders();
			let currentParentId: string | undefined = undefined;
			let currentLevelFolders = eagleFolders;

			for (const segment of segments) {
				const matchedFolder = currentLevelFolders.find(f => f.name.toLowerCase() === segment.toLowerCase());
				if (matchedFolder) {
					currentParentId = matchedFolder.id;
					currentLevelFolders = matchedFolder.children || [];
				} else {
					const created: EagleFolder | null = await this.api.createFolder({
						folderName: segment,
						parent: currentParentId
					});
					if (!created || !created.id) {
						console.warn(`[CMDS Eagle] Failed to create mirrored folder '${segment}' in Eagle`);
						break;
					}
					currentParentId = created.id;
					currentLevelFolders = [];
				}
			}

			return currentParentId;
		} catch (error) {
			console.error('[CMDS Eagle] Error during folder hierarchy mirroring:', error);
			return undefined;
		}
	}

	private resolveMappedEagleFolder(activeFile?: TFile | null): string | undefined {
		const file = activeFile ?? this.app.workspace.getActiveFile();
		const folderPath = file?.parent?.path?.replace(/^\/+|\/+$/g, '') || '';
		const mappings = this.settings.folderMappings || [];

		if (!folderPath) {
			const rootMapping = mappings.find(m => m.obsidianFolder === '' || m.obsidianFolder === '/');
			return rootMapping ? rootMapping.eagleFolderId : (this.settings.defaultFolder || undefined);
		}

		if (mappings.length === 0) {
			return this.settings.defaultFolder || undefined;
		}

		const normalizedNotePath = folderPath.toLowerCase();

		// 1. Exact match
		const exact = mappings.find(m => m.obsidianFolder.toLowerCase() === normalizedNotePath);
		if (exact) {
			return exact.eagleFolderId;
		}

		// 2. Longest prefix match for subfolders
		const sorted = [...mappings].sort((a, b) => b.obsidianFolder.length - a.obsidianFolder.length);
		for (const mapping of sorted) {
			const mapPath = mapping.obsidianFolder.toLowerCase();
			if (normalizedNotePath.startsWith(mapPath + '/')) {
				return mapping.eagleFolderId;
			}
		}

		// 3. Fallback to defaultFolder (or root)
		return this.settings.defaultFolder || undefined;
	}

	private async getOrCreateActiveNoteId(activeFile: TFile): Promise<string> {
		const cache = this.app.metadataCache.getFileCache(activeFile);
		const idField = this.settings.frontmatterIdField?.trim() || 'id';
		let id = '';

		if (cache?.frontmatter?.[idField]) {
			id = String(cache.frontmatter[idField]);
		} else if (idField !== 'id' && cache?.frontmatter?.id) {
			id = String(cache.frontmatter.id);
		} else if (idField !== 'uid' && cache?.frontmatter?.uid) {
			id = String(cache.frontmatter.uid);
		} else {
			id = crypto.randomUUID();
		}

		// Ensure frontmatter uses configured idField, and remove redundant 'uid' if idField is not 'uid'
		const hasTargetField = Boolean(cache?.frontmatter?.[idField]);
		const hasRedundantUid = idField !== 'uid' && Boolean(cache?.frontmatter?.uid);

		if (!hasTargetField || hasRedundantUid) {
			try {
				await this.app.fileManager.processFrontMatter(activeFile, (frontmatter: Record<string, any>) => {
					if (!frontmatter[idField]) {
						frontmatter[idField] = id;
					}
					if (idField !== 'uid' && 'uid' in frontmatter) {
						delete frontmatter.uid;
					}
				});
			} catch (err) {
				console.error(`[CMDS Eagle] Failed to update frontmatter ${idField}:`, err);
			}
		}

		return id;
	}

	private async getEagleBacklinkPayload(hasSourceUrl?: boolean): Promise<{ website?: string; annotation?: string }> {
		if (!this.settings.enableBacklinks || this.settings.backlinkMode !== 'legacy') {
			return {};
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return {};
		}

		const vaultName = encodeURIComponent(this.app.vault.getName());
		const filePath = encodeURIComponent(activeFile.path);
		const basename = activeFile.basename;
		const id = await this.getOrCreateActiveNoteId(activeFile);

		const advancedUri = `obsidian://adv-uri?vault=${vaultName}&uid=${id}&filepath=${filePath}`;
		const result: { website?: string; annotation?: string } = {};

		const dest = this.settings.backlinkDestination;
		if (dest === 'url' || dest === 'both') {
			if (!hasSourceUrl) {
				result.website = advancedUri;
			} else {
				result.annotation = `Linked From Obsidian: [${basename}](${advancedUri})`;
			}
		}
		if (dest === 'note' || dest === 'both') {
			result.annotation = `Linked From Obsidian: [${basename}](${advancedUri})`;
		}

		return result;
	}

	private async applyObsidianBacklink(itemId: string, hasSourceUrl?: boolean): Promise<void> {
		if (!this.settings.enableBacklinks) {
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return;
		}

		const vaultName = encodeURIComponent(this.app.vault.getName());
		const filePath = encodeURIComponent(activeFile.path);
		const basename = activeFile.basename;
		const id = await this.getOrCreateActiveNoteId(activeFile);

		const advancedUri = `obsidian://adv-uri?vault=${vaultName}&uid=${id}&filepath=${filePath}`;

		if (this.settings.backlinkMode === 'extra-links') {
			const res = await this.api.addExtraLinks(
				this.settings.extraLinksBaseUrl,
				itemId,
				{ title: basename, url: advancedUri }
			);
			if (!res.success) {
				new Notice('Eagle Extra Links plugin is unreachable. Please ensure the Extra Links plugin is installed in Eagle and its IPC server is toggled on.');
				console.warn('[CMDS Eagle] Failed to add extra link:', res.error);
			}
		} else {
			const updates: { url?: string; annotation?: string } = {};
			const dest = this.settings.backlinkDestination;
			if (dest === 'url' || dest === 'both') {
				if (!hasSourceUrl) {
					updates.url = advancedUri;
				} else {
					updates.annotation = `Linked From Obsidian: [${basename}](${advancedUri})`;
				}
			}
			if (dest === 'note' || dest === 'both') {
				updates.annotation = `Linked From Obsidian: [${basename}](${advancedUri})`;
			}
			if (updates.url || updates.annotation) {
				if (updates.annotation) {
					const existingItem = await this.api.getItemInfo(itemId);
					if (existingItem?.annotation && !existingItem.annotation.includes(updates.annotation)) {
						updates.annotation = `${existingItem.annotation}\n\n${updates.annotation}`;
					}
				}
				await this.api.updateItem(itemId, updates);
			}
		}
	}

	private async uploadImageToEagle(file: File, sourceInfo?: ImageSourceInfo | null): Promise<{ url: string, item: EagleItem | null }> {
		const tempPath = await this.saveToTempLocation(file);
		
		const connected = await this.api.isConnected();
		if (!connected) {
			throw new Error('Eagle is not running');
		}

		const primaryUrl = (sourceInfo && this.settings.enableImageSourceUrl)
			? this.clipboardSourceService.resolvePrimaryUrl(sourceInfo, this.settings.imageSourceUrlPriority)
			: null;

		const filenameWithoutExt = resolveImageFileName(file, sourceInfo);
		const backlinkData = await this.getEagleBacklinkPayload(!!primaryUrl);

		const folderResolution = await this.resolveEagleFolderForUpload({
			file,
			fileName: filenameWithoutExt,
			sourceInfo,
		});
		if (folderResolution.cancelled) {
			throw new Error('Upload cancelled');
		}

		const finalName = folderResolution.name || filenameWithoutExt;
		const finalTags = folderResolution.tags !== undefined ? folderResolution.tags : this.getDefaultTags();
		const finalAnnotation = [folderResolution.annotation, backlinkData.annotation].filter(Boolean).join('\n\n') || undefined;

		const result = await this.api.addFromPath({
			path: tempPath,
			name: finalName,
			website: primaryUrl || backlinkData.website,
			tags: finalTags,
			folderId: folderResolution.folderId,
			star: folderResolution.star,
			...backlinkData,
			annotation: finalAnnotation,
		});

		if (!result.success || !result.itemId) {
			throw new Error('Failed to add image to Eagle');
		}

		const itemId = result.itemId;

		await this.delay(1000);

		const thumbnailPath = await this.api.getThumbnailPath(itemId);
		let item = await this.api.getItemInfo(itemId);
		if (!item) {
			await this.delay(500);
			item = await this.api.getItemInfo(itemId);
		}

		if (item) {
			if (!item.url && primaryUrl) {
				item.url = primaryUrl;
				void this.api.updateItem(itemId, { url: primaryUrl });
			} else if (item.url) {
				item.url = cleanUrl(item.url);
			}
		} else {
			const ext = getExtFromFilename(file.name);
			item = {
				id: itemId,
				name: finalName,
				size: file.size,
				ext: ext,
				tags: finalTags || [],
				folders: folderResolution.folderId ? [folderResolution.folderId] : [],
				isDeleted: false,
				url: primaryUrl || '',
				annotation: finalAnnotation || '',
				modificationTime: Date.now(),
				lastModified: Date.now(),
				width: 0,
				height: 0,
				palettes: []
			};
		}

		void (async () => {
			await this.applyObsidianBacklink(itemId, !!primaryUrl);
			if (sourceInfo && this.settings.enableImageSourceUrl && this.settings.extraLinksImageSource !== 'none') {
				await this.pushImageSourcesToExtraLinks(itemId, sourceInfo);
			}
		})();

		let embedUrl: string;
		if (this.settings.eagleEmbedUrlMode === 'custom-url') {
			const libraryName = (await this.api.getLibraryName()) || 'Main';
			const ext = item ? item.ext : getExtFromFilename(file.name);
			const nameWithoutExt = item ? item.name : filenameWithoutExt;
			embedUrl = buildEagleCustomEmbedUrl(
				this.settings.eagleCustomUrlPrefix,
				libraryName,
				itemId,
				nameWithoutExt,
				ext,
				false
			);
		} else {
			const localPath = thumbnailPath || tempPath;
			embedUrl = this.pathToFileUrl(localPath);
		}
		
		return {
			url: embedUrl,
			item
		};
	}

	private async pushImageSourcesToExtraLinks(itemId: string, sourceInfo: ImageSourceInfo): Promise<void> {
		const mode = this.settings.extraLinksImageSource;
		if (mode === 'none') return;

		const linksToPush: Array<{ title: string; url: string }> = [];

		if ((mode === 'page' || mode === 'both') && sourceInfo.pageUrl) {
			if (!isDirectImageUrl(sourceInfo.pageUrl) && sourceInfo.pageUrl !== sourceInfo.imageUrl) {
				const domain = extractDomain(sourceInfo.pageUrl);
				linksToPush.push({
					title: domain ? `Source Page: ${domain}` : 'Source Page',
					url: sourceInfo.pageUrl
				});
			}
		}

		if ((mode === 'image' || mode === 'both') && sourceInfo.imageUrl) {
			if (sourceInfo.imageUrl !== sourceInfo.pageUrl) {
				const domain = extractDomain(sourceInfo.imageUrl);
				linksToPush.push({
					title: domain ? `Direct Image: ${domain}` : 'Direct Image',
					url: sourceInfo.imageUrl
				});
			}
		}

		for (const link of linksToPush) {
			try {
				const res = await this.api.addExtraLinks(
					this.settings.extraLinksBaseUrl,
					itemId,
					link
				);
				if (!res.success) {
					console.warn('[CMDS Eagle] Failed to push image source to Extra Links:', res.error);
				}
			} catch (err) {
				console.warn('[CMDS Eagle] Error pushing image source to Extra Links:', err);
			}
		}
	}

	private async saveToTempLocation(file: File): Promise<string> {
		const tempDir = '.eagle-temp';
		const tempDirPath = `${tempDir}`;

		const adapter = this.app.vault.adapter;
		const tempDirExists = await adapter.exists(tempDirPath);
		if (!tempDirExists) {
			await adapter.mkdir(tempDirPath);
		}

		const timestamp = Date.now();
		const filename = `${timestamp}-${file.name}`;
		const tempFilePath = `${tempDirPath}/${filename}`;

		const buffer = await file.arrayBuffer();
		const uint8Array = new Uint8Array(buffer);
		await adapter.writeBinary(tempFilePath, uint8Array);

		return this.getAbsolutePath(tempFilePath);
	}

	private getVaultPath(): string {
		const adapter = this.app.vault.adapter as { basePath?: string };
		if (adapter.basePath) {
			return adapter.basePath;
		}
		const configDir = this.app.vault.configDir;
		const sep = configDir.lastIndexOf('/');
		return sep > 0 ? configDir.slice(0, sep) : configDir;
	}

	private getAbsolutePath(relativePath: string): string {
		const vaultPath = this.getVaultPath();
		if (relativePath.startsWith('/')) {
			return relativePath;
		}
		return `${vaultPath}/${relativePath}`;
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => window.setTimeout(resolve, ms));
	}

	private allFilesAreImages(files: FileList): boolean {
		if (!files || files.length === 0) return false;
		
		const imageTypes = [
			'image/jpeg',
			'image/jpg',
			'image/png',
			'image/gif',
			'image/webp',
			'image/bmp',
			'image/svg+xml',
			'image/tiff',
			'image/heic',
			'image/heif',
			'image/avif',
		];
		
		for (const file of Array.from(files)) {
			if (!imageTypes.includes(file.type)) {
				return false;
			}
		}
		return true;
	}

	private async convertCrossPlatformPaths(): Promise<void> {
		if (!this.settings.enableCrossPlatform) {
			new Notice('Cross-platform sync is disabled in settings');
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const content = await this.app.vault.read(activeFile);
		let newContent = content;
		let convertedCount = 0;

		const fileUrlRegex = /!\[([^\]]*)\]\((file:\/\/[^)]+)\)/g;
		let match;
		
		while ((match = fileUrlRegex.exec(content)) !== null) {
			const originalUrl = match[2];
			let filePath = this.fullyDecodeUri(originalUrl.replace(/^file:\/\/\/?/, ''));
			
			if (filePath.startsWith('Users/') && !filePath.startsWith('/')) {
				filePath = '/' + filePath;
			}

			if (this.isPathFromDifferentPlatform(filePath)) {
				const convertedPath = this.convertPathForCurrentPlatform(filePath);
				const newUrl = this.pathToFileUrl(convertedPath);
				newContent = newContent.replace(originalUrl, newUrl);
				convertedCount++;
			}
		}

		if (convertedCount > 0) {
			await this.app.vault.modify(activeFile, newContent);
			new Notice(`Converted ${convertedCount} cross-platform image paths`);
		} else {
			new Notice('No cross-platform paths found to convert');
		}
	}

	private async autoConvertOnFileOpen(file: TFile): Promise<void> {
		const content = await this.app.vault.read(file);
		let newContent = content;
		let convertedCount = 0;

		const fileUrlRegex = /!\[([^\]]*)\]\((file:\/\/[^)]+)\)/g;
		let match;
		
		while ((match = fileUrlRegex.exec(content)) !== null) {
			const originalUrl = match[2];
			let filePath = this.fullyDecodeUri(originalUrl.replace(/^file:\/\/\/?/, ''));
			
			if (filePath.startsWith('Users/') && !filePath.startsWith('/')) {
				filePath = '/' + filePath;
			}

			if (this.isPathFromDifferentPlatform(filePath)) {
				const convertedPath = this.convertPathForCurrentPlatform(filePath);
				const newUrl = this.pathToFileUrl(convertedPath);
				newContent = newContent.replace(originalUrl, newUrl);
				convertedCount++;
			}
		}

		if (convertedCount > 0) {
			await this.app.vault.modify(file, newContent);
			new Notice(`Auto-converted ${convertedCount} cross-platform paths`);
		}
	}

	private async convertCrossPlatformRenderOnly(): Promise<void> {
		if (!this.settings.enableCrossPlatform) {
			new Notice('Cross-platform sync is disabled in settings');
			return;
		}

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice('No active markdown view');
			return;
		}

		const allContainers = [
			view.contentEl,
			view.containerEl,
			activeDocument.querySelector('.workspace-leaf.mod-active .view-content'),
			activeDocument.querySelector('.workspace-leaf.mod-active .markdown-preview-view'),
			activeDocument.querySelector('.workspace-leaf.mod-active .cm-content'),
		].filter(Boolean) as HTMLElement[];

		let convertedCount = 0;
		const processedSrcs = new Set<string>();

		for (const container of allContainers) {
			const images = container.querySelectorAll('img');
			console.log(`[CMDS Eagle] Found ${images.length} images in container`);

			images.forEach((img) => {
				const src = img.getAttribute('src');
				if (!src) return;
				if (processedSrcs.has(src)) return;
				if (img.getAttribute('data-xplatform-converted')) return;

				console.log(`[CMDS Eagle] Processing image src: ${src.substring(0, 80)}`);

				let extractedPath: string | null = null;
				
				if (src.startsWith('app://')) {
					const appMatch = src.match(/^app:\/\/[^/]+\/(.+)$/);
					if (appMatch) {
						extractedPath = this.fullyDecodeUri(appMatch[1]);
						console.log(`[CMDS Eagle] Extracted from app://: ${extractedPath?.substring(0, 60)}`);
					}
				} else if (src.startsWith('file://')) {
					extractedPath = this.fullyDecodeUri(src.replace(/^file:\/\/\/?/, ''));
					console.log(`[CMDS Eagle] Extracted from file://: ${extractedPath?.substring(0, 60)}`);
				}

				if (!extractedPath) {
					console.log(`[CMDS Eagle] Could not extract path from: ${src.substring(0, 50)}`);
					return;
				}

				if (extractedPath.startsWith('Users/') && !extractedPath.startsWith('/')) {
					extractedPath = '/' + extractedPath;
				}

				if (!this.isPathFromDifferentPlatform(extractedPath)) {
					console.log(`[CMDS Eagle] Path not from different platform`);
					return;
				}

				const convertedPath = this.convertPathForCurrentPlatform(extractedPath);
				
				if (convertedPath !== extractedPath) {
					const newSrc = this.pathToFileUrl(convertedPath);
					console.log(`[CMDS Eagle] Converting: ${src.substring(0, 40)} → ${newSrc.substring(0, 40)}`);
					
					img.setAttribute('src', newSrc);
					img.setAttribute('data-xplatform-converted', 'true');
					img.setAttribute('data-original-src', src);
					processedSrcs.add(src);
					convertedCount++;
				}
			});
		}

		if (convertedCount > 0) {
			new Notice(`Render-only: converted ${convertedCount} image paths (source unchanged)`);
		} else {
			new Notice('No cross-platform paths found to convert');
		}
	}

	private async autoConvertRenderOnlyOnFileOpen(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const contentEl = view.contentEl;
		const images = contentEl.querySelectorAll('img');
		let convertedCount = 0;

		images.forEach((img) => {
			const src = img.getAttribute('src');
			if (!src) return;

			if (img.getAttribute('data-xplatform-converted')) return;

			let extractedPath: string | null = null;
			
			if (src.startsWith('app://')) {
				const appMatch = src.match(/^app:\/\/[^/]+\/(.+)$/);
				if (appMatch) {
					extractedPath = this.fullyDecodeUri(appMatch[1]);
				}
			} else if (src.startsWith('file://')) {
				extractedPath = this.fullyDecodeUri(src.replace(/^file:\/\/\/?/, ''));
			}

			if (!extractedPath) return;

			if (extractedPath.startsWith('Users/') && !extractedPath.startsWith('/')) {
				extractedPath = '/' + extractedPath;
			}

			if (!this.isPathFromDifferentPlatform(extractedPath)) return;

			const convertedPath = this.convertPathForCurrentPlatform(extractedPath);
			
			if (convertedPath !== extractedPath) {
				const newSrc = this.pathToFileUrl(convertedPath);
				img.setAttribute('src', newSrc);
				img.setAttribute('data-xplatform-converted', 'true');
				img.setAttribute('data-original-src', src);
				convertedCount++;
			}
		});

		if (convertedCount > 0) {
			console.log(`[CMDS Eagle] Auto render-only: converted ${convertedCount} paths`);
		}
	}

	private async uploadAllImagesToCloud(): Promise<void> {
		const provider = this.getActiveCloudProvider();
		if (!provider) {
			new Notice('No cloud provider configured. Check settings.');
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		const content = await this.app.vault.read(activeFile);
		const providerName = this.getActiveCloudProviderName();
		
		const imageMatches: { full: string; alt: string; url: string; filePath?: string }[] = [];
		
		const fileUrlRegex = /!\[([^\]]*)\]\((file:\/\/[^)]+)\)/gi;
		let match;
		while ((match = fileUrlRegex.exec(content)) !== null) {
			const url = match[2];
			const filePath = decodeURIComponent(url.replace('file://', ''));
			imageMatches.push({
				full: match[0],
				alt: match[1],
				url: url,
				filePath: filePath,
			});
		}
		
		const localhostRegex = /!\[([^\]]*)\]\((https?:\/\/localhost:\d+\/api\/item\/thumbnail\?id=([A-Z0-9]+))\)/gi;
		while ((match = localhostRegex.exec(content)) !== null) {
			const itemId = match[3];
			const item = await this.api.getItemInfo(itemId);
			if (item) {
				const filePath = await this.api.getOriginalFilePath(item);
				if (filePath) {
					imageMatches.push({
						full: match[0],
						alt: match[1],
						url: match[2],
						filePath: filePath,
					});
				}
			}
		}
		
		const localImageRegex = /!\[([^\]]*)\]\((?!https?:\/\/|file:\/\/)([^)]+\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif|heic|heif|avif|ico|mp4|mov))\)/gi;
		while ((match = localImageRegex.exec(content)) !== null) {
			const relativePath = match[2];
			const absolutePath = this.getAbsolutePath(relativePath);
			imageMatches.push({
				full: match[0],
				alt: match[1],
				url: relativePath,
				filePath: absolutePath,
			});
		}

		if (imageMatches.length === 0) {
			new Notice('No local images found in current note');
			return;
		}

		new Notice(`Found ${imageMatches.length} images. Uploading to ${providerName}...`);

		let uploaded = 0;
		let newContent = content;

		for (const img of imageMatches) {
			if (!img.filePath) continue;
			
			if (img.url.startsWith('http://') || img.url.startsWith('https://')) {
				if (!img.url.includes('localhost')) continue;
			}
			
			const filename = img.filePath.split('/').pop() || 'image';
			const ext = getExtFromFilename(filename);
			const mimeType = getMimeType(ext);

			try {
				const result = await provider.upload(img.filePath, filename, mimeType);
				if (result.success && result.publicUrl) {
					newContent = newContent.replace(img.url, result.publicUrl);
					uploaded++;
				}
			} catch (error) {
				console.error(`Failed to upload ${filename}:`, error);
			}
		}

		if (newContent !== content) {
			await this.app.vault.modify(activeFile, newContent);
		}

		new Notice(`Uploaded ${uploaded}/${imageMatches.length} images to ${providerName}`);
	}
}
