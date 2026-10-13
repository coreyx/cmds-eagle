import {
	App,
	FuzzySuggestModal,
	FuzzyMatch,
	SuggestModal,
	prepareFuzzySearch,
	Notice,
	MarkdownView,
	Modal,
	Setting,
	TFolder,
	setIcon,
} from 'obsidian';
import { 
	EagleItem,
	EagleFolder,
	EagleFolderMapping,
	EagleFolderPickerItem,
	EagleTag,
	EagleFolderPickerResult,
	EagleFolderPickerContext,
	EagleAiAssistant,
	CMDSPACEEagleSettings,
	SearchScope,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
	SUPPORTED_DOCUMENT_EXTENSIONS,
} from './types';
import { EagleApiService, buildEagleItemUrl, toObsidianTag } from './api';

type FileTypeCategory = 'images' | 'videos' | 'documents' | 'all';

export class EagleSearchModal extends FuzzySuggestModal<EagleItem> {
	private api: EagleApiService;
	private settings: CMDSPACEEagleSettings;
	private allItems: EagleItem[] = [];
	private isLoading = false;
	private activeScopes: Set<SearchScope>;
	private activeFileTypes: Set<string>;
	private filterContainer: HTMLElement | null = null;
	private libraryNameEl: HTMLElement | null = null;

	constructor(
		app: App,
		api: EagleApiService,
		settings: CMDSPACEEagleSettings,
		// The link an embed should use (cloud copy or Custom URL prefix), or null for the local file
		private resolveEmbedUrl?: (item: EagleItem) => Promise<string | null>
	) {
		super(app);
		this.api = api;
		this.settings = settings;
		this.activeScopes = new Set(settings.searchScope);
		this.activeFileTypes = new Set(settings.searchFileTypes);
		this.setPlaceholder('Search Eagle items...');
		this.setInstructions([
			{ command: '↑↓', purpose: 'navigate' },
			{ command: '↵', purpose: 'insert link' },
			{ command: 'esc', purpose: 'dismiss' },
		]);
	}

	async onOpen(): Promise<void> {
		void super.onOpen();
		this.buildFilterUI();
		await this.loadItems();
	}

	private buildFilterUI(): void {
		const promptEl = this.modalEl.querySelector('.prompt');
		if (!promptEl) return;

		this.filterContainer = createDiv({ cls: 'cmdspace-eagle-filters' });
		promptEl.insertBefore(this.filterContainer, promptEl.firstChild);

		const headerRow = this.filterContainer.createDiv({ cls: 'cmdspace-eagle-filter-header' });
		this.libraryNameEl = headerRow.createSpan({ cls: 'cmdspace-eagle-library-name', text: 'Loading...' });

		const scopeRow = this.filterContainer.createDiv({ cls: 'cmdspace-eagle-filter-row' });
		scopeRow.createSpan({ text: 'Search in:', cls: 'cmdspace-eagle-filter-label' });
		
		const scopeButtons = scopeRow.createDiv({ cls: 'cmdspace-eagle-filter-buttons' });
		this.createScopeButton(scopeButtons, 'name', 'Name');
		this.createScopeButton(scopeButtons, 'tags', 'Tags');
		this.createScopeButton(scopeButtons, 'annotation', 'Notes');
		this.createScopeButton(scopeButtons, 'folders', 'Folders');

		const typeRow = this.filterContainer.createDiv({ cls: 'cmdspace-eagle-filter-row' });
		typeRow.createSpan({ text: 'File types:', cls: 'cmdspace-eagle-filter-label' });
		
		const typeButtons = typeRow.createDiv({ cls: 'cmdspace-eagle-filter-buttons' });
		this.createTypeButton(typeButtons, 'images', 'Images');
		this.createTypeButton(typeButtons, 'videos', 'Videos');
		this.createTypeButton(typeButtons, 'documents', 'Docs');
		this.createTypeButton(typeButtons, 'all', 'All');
	}

	private createScopeButton(container: HTMLElement, scope: SearchScope, label: string): void {
		const btn = container.createEl('button', { 
			text: label,
			cls: `cmdspace-eagle-filter-btn ${this.activeScopes.has(scope) ? 'is-active' : ''}`
		});
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (this.activeScopes.has(scope)) {
				if (this.activeScopes.size > 1) {
					this.activeScopes.delete(scope);
					btn.removeClass('is-active');
				}
			} else {
				this.activeScopes.add(scope);
				btn.addClass('is-active');
			}
			this.inputEl.dispatchEvent(new Event('input'));
		});
	}

	private createTypeButton(container: HTMLElement, category: FileTypeCategory, label: string): void {
		const isActive = this.isTypeCategoryActive(category);
		const btn = container.createEl('button', { 
			text: label,
			cls: `cmdspace-eagle-filter-btn ${isActive ? 'is-active' : ''}`
		});
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleTypeCategory(category);
			this.updateTypeButtonStates(container.parentElement!);
			this.inputEl.dispatchEvent(new Event('input'));
		});
	}

	private isTypeCategoryActive(category: FileTypeCategory): boolean {
		const extensions = this.getExtensionsForCategory(category);
		return extensions.some(ext => this.activeFileTypes.has(ext));
	}

	private getExtensionsForCategory(category: FileTypeCategory): readonly string[] {
		switch (category) {
			case 'images': return SUPPORTED_IMAGE_EXTENSIONS;
			case 'videos': return SUPPORTED_VIDEO_EXTENSIONS;
			case 'documents': return SUPPORTED_DOCUMENT_EXTENSIONS;
			case 'all': return [...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_VIDEO_EXTENSIONS, ...SUPPORTED_DOCUMENT_EXTENSIONS];
		}
	}

	private toggleTypeCategory(category: FileTypeCategory): void {
		const extensions = this.getExtensionsForCategory(category);
		const isCurrentlyActive = this.isTypeCategoryActive(category);

		if (category === 'all') {
			if (isCurrentlyActive) {
				this.activeFileTypes = new Set(SUPPORTED_IMAGE_EXTENSIONS);
			} else {
				this.activeFileTypes = new Set([
					...SUPPORTED_IMAGE_EXTENSIONS,
					...SUPPORTED_VIDEO_EXTENSIONS,
					...SUPPORTED_DOCUMENT_EXTENSIONS
				]);
			}
		} else {
			if (isCurrentlyActive) {
				extensions.forEach(ext => this.activeFileTypes.delete(ext));
				if (this.activeFileTypes.size === 0) {
					SUPPORTED_IMAGE_EXTENSIONS.forEach(ext => this.activeFileTypes.add(ext));
				}
			} else {
				extensions.forEach(ext => this.activeFileTypes.add(ext));
			}
		}
	}

	private updateTypeButtonStates(typeRow: HTMLElement): void {
		const buttons = typeRow.querySelectorAll('.cmdspace-eagle-filter-btn');
		const categories: FileTypeCategory[] = ['images', 'videos', 'documents', 'all'];
		buttons.forEach((btn, idx) => {
			if (this.isTypeCategoryActive(categories[idx])) {
				btn.addClass('is-active');
			} else {
				btn.removeClass('is-active');
			}
		});
	}

	private async loadItems(): Promise<void> {
		if (this.isLoading) return;
		
		this.isLoading = true;
		try {
			const connected = await this.api.isConnected();
			if (!connected) {
				new Notice('Eagle is not running. Please start Eagle and try again.');
				this.close();
				return;
			}

			const libraryName = await this.api.getLibraryName();
			if (this.libraryNameEl && libraryName) {
				this.libraryNameEl.setText(`📚 ${libraryName}`);
			}

			this.allItems = await this.api.listItems();
			
			if (this.libraryNameEl) {
				const count = this.allItems.length;
				const libraryText = libraryName ? `📚 ${libraryName}` : '📚 Eagle';
				this.libraryNameEl.setText(`${libraryText} (${count.toLocaleString()} items)`);
			}
			
			this.inputEl.dispatchEvent(new Event('input'));
		} catch (error) {
			console.error('Failed to load Eagle items:', error);
			new Notice('Failed to load Eagle items. Check console for details.');
		} finally {
			this.isLoading = false;
		}
	}

	getItems(): EagleItem[] {
		return this.allItems.filter(item => 
			this.activeFileTypes.has(item.ext.toLowerCase())
		);
	}

	getItemText(item: EagleItem): string {
		const parts: string[] = [];
		
		if (this.activeScopes.has('name')) {
			parts.push(item.name);
		}
		if (this.activeScopes.has('tags') && item.tags.length > 0) {
			parts.push(item.tags.join(' '));
		}
		if (this.activeScopes.has('annotation') && item.annotation) {
			parts.push(item.annotation);
		}
		if (this.activeScopes.has('folders') && item.folders.length > 0) {
			parts.push(item.folders.join('/'));
		}
		
		return parts.join(' ') || item.name;
	}

	renderSuggestion(match: FuzzyMatch<EagleItem>, el: HTMLElement): void {
		const item = match.item;
		
		const container = el.createDiv({ cls: 'cmdspace-eagle-suggestion' });
		const infoDiv = container.createDiv({ cls: 'cmdspace-eagle-suggestion-info' });
		infoDiv.createDiv({ cls: 'cmdspace-eagle-suggestion-name', text: item.name });
		
		const metaDiv = infoDiv.createDiv({ cls: 'cmdspace-eagle-suggestion-meta' });
		metaDiv.createSpan({ text: item.ext.toUpperCase() });
		metaDiv.createSpan({ text: ' • ' });
		metaDiv.createSpan({ text: this.formatFileSize(item.size) });
		if (item.width && item.height) {
			metaDiv.createSpan({ text: ' • ' });
			metaDiv.createSpan({ text: `${item.width}×${item.height}` });
		}
		
		if (item.tags.length > 0) {
			const tagsDiv = infoDiv.createDiv({ cls: 'cmdspace-eagle-suggestion-tags' });
			item.tags.slice(0, 5).forEach(tag => {
				tagsDiv.createSpan({ cls: 'cmdspace-eagle-tag', text: tag });
			});
			if (item.tags.length > 5) {
				tagsDiv.createSpan({ cls: 'cmdspace-eagle-tag-more', text: `+${item.tags.length - 5}` });
			}
		}
	}

	onChooseItem(item: EagleItem, evt: MouseEvent | KeyboardEvent): void {
		void this.insertItemLink(item);
	}

	private async insertItemLink(item: EagleItem): Promise<void> {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active markdown editor');
			return;
		}

		const editor = activeView.editor;
		
		if (this.settings.insertAsEmbed) {
			const filename = `${item.name}.${item.ext}`;
			const embedUrl = this.resolveEmbedUrl ? await this.resolveEmbedUrl(item) : null;
			if (embedUrl) {
				let output = `![${filename}](${embedUrl})`;
				if (this.settings.insertThumbnail) {
					output += '\n\n' + this.buildMetadataLine(item);
				}
				editor.replaceSelection(output);
				new Notice(`Embedded: ${item.name}`);
				return;
			}

			// The local file: its thumbnail when the "Embedded image size" setting asks for one
			const thumbnailPath = this.settings.eagleEmbedThumbnail && item.noThumbnail !== true
				? await this.api.getThumbnailPath(item.id)
				: null;
			const filePath = thumbnailPath || await this.api.getOriginalFilePath(item);
			if (filePath) {
				const fileUrl = this.pathToFileUrl(filePath);
				let output = `![${filename}](${fileUrl})`;
				
				if (this.settings.insertThumbnail) {
					output += '\n\n' + this.buildMetadataLine(item);
				}
				
				editor.replaceSelection(output);
				new Notice(`Embedded: ${item.name}`);
				return;
			}
		}

		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		let linkText: string;
		if (this.settings.linkFormat === 'wikilink') {
			linkText = `[[${linkUrl}|${item.name}]]`;
		} else {
			linkText = `[${item.name}](${linkUrl})`;
		}

		if (this.settings.insertThumbnail) {
			const card = this.buildLinkCard(item);
			editor.replaceSelection(card);
		} else {
			editor.replaceSelection(linkText);
		}

		new Notice(`Inserted link to: ${item.name}`);
	}

	private pathToFileUrl(path: string): string {
		let decodedPath = path;
		try {
			while (decodedPath.includes('%')) {
				const decoded = decodeURIComponent(decodedPath);
				if (decoded === decodedPath) break;
				decodedPath = decoded;
			}
		} catch {
			decodedPath = path;
		}

		const normalizedPath = decodedPath.replace(/\\/g, '/');
		const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
		
		if (process.platform === 'win32' && /^[A-Za-z]:/.test(normalizedPath)) {
			const fixedPath = encodedPath.replace(/^([A-Za-z])%3A/, '$1:');
			return `file:///${fixedPath}`;
		}
		return `file://${encodedPath}`;
	}

	private buildMetadataLine(item: EagleItem): string {
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		const tags = item.tags
			.filter(t => !t.startsWith('r2:') && t !== 'r2-cloud' && t !== 'cloud-upload')
			.map(t => this.normalizeTag(t))
			.filter(t => t.length > 0)
			.map(t => `#${t}`)
			.join(' ');
		const dimensions = item.width && item.height ? `${item.width}×${item.height}` : '';

		const tagSection = this.settings.includeTagsInMetadataCard ? ` | ${tags || 'No tags'}` : '';

		return `> **${item.ext.toUpperCase()}** | ${this.formatFileSize(item.size)}${dimensions ? ` | ${dimensions}` : ''}${tagSection} | [Eagle](${linkUrl})`;
	}

	private buildLinkCard(item: EagleItem): string {
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		const tags = item.tags
			.map(t => this.normalizeTag(t))
			.filter(t => t.length > 0)
			.map(t => `#${t}`)
			.join(' ');
		const dimensions = item.width && item.height ? `${item.width}×${item.height}` : 'N/A';
		
		return `> [!cmdspace-eagle] ${item.name}
> 
> | Property | Value |
> |----------|-------|
> | **Type** | ${item.ext.toUpperCase()} |
> | **Size** | ${this.formatFileSize(item.size)} |
> | **Dimensions** | ${dimensions} |
${this.settings.includeTagsInMetadataCard ? `> | **Tags** | ${tags || 'None'} |\n` : ''}> ${item.annotation ? `> **Annotation**: ${item.annotation}\n` : ''}
> [Open in Eagle](${linkUrl})

`;
	}

	// The Eagle tag as an Obsidian tag without its #, or '' if no valid tag can be made of it
	private normalizeTag(tag: string): string {
		return toObsidianTag(tag, this.settings.tagNormalization === 'lowercase', this.settings.tagPrefix);
	}

	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
}

export function flattenEagleFolders(
	items: EagleFolder[],
	parentPath = ''
): { id: string; name: string; path: string }[] {
	const flattened: { id: string; name: string; path: string }[] = [];
	for (const item of items) {
		const currentPath = parentPath ? `${parentPath} / ${item.name}` : item.name;
		flattened.push({ id: item.id, name: item.name, path: currentPath });
		if (item.children && item.children.length > 0) {
			flattened.push(...flattenEagleFolders(item.children, currentPath));
		}
	}
	return flattened;
}

export class EagleFolderModal extends FuzzySuggestModal<{ id: string; name: string; path: string }> {
	private folders: { id: string; name: string; path: string }[] = [];
	private onSelect: (folderId: string) => void;

	constructor(
		app: App,
		folders: { id: string; name: string; path: string }[],
		onSelect: (folderId: string) => void
	) {
		super(app);
		this.folders = folders;
		this.onSelect = onSelect;
		this.setPlaceholder('Select Eagle folder...');
	}

	getItems(): { id: string; name: string; path: string }[] {
		return this.folders;
	}

	getItemText(item: { id: string; name: string; path: string }): string {
		return item.path;
	}

	onChooseItem(item: { id: string; name: string; path: string }): void {
		this.onSelect(item.id);
	}
}

export class EagleTagPickerModal extends Modal {
	private api: EagleApiService;
	private selectedTags: Set<string>;
	private onSelectTag: (tag: string) => void;
	private allTags: EagleTag[] = [];
	private filteredTags: EagleTag[] = [];
	private searchQuery = '';
	private selectedIndex = 0;

	private searchInputEl!: HTMLInputElement;
	private listContainerEl!: HTMLElement;
	private itemElements: HTMLElement[] = [];

	constructor(
		app: App,
		api: EagleApiService,
		selectedTags: string[],
		onSelectTag: (tag: string) => void
	) {
		super(app);
		this.api = api;
		this.selectedTags = new Set(selectedTags);
		this.onSelectTag = onSelectTag;
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass('cmdspace-eagle-tag-picker-window');
		contentEl.empty();
		contentEl.addClass('cmdspace-eagle-tag-picker-modal');

		contentEl.createEl('h3', { text: 'Add Tag', cls: 'cmdspace-eagle-tag-picker-title' });

		const searchContainer = contentEl.createDiv({ cls: 'cmdspace-eagle-tag-search-container' });
		this.searchInputEl = searchContainer.createEl('input', {
			type: 'text',
			cls: 'cmdspace-eagle-tag-search-input',
			placeholder: 'Search tags or type new tag...',
		});

		this.searchInputEl.addEventListener('input', () => {
			this.searchQuery = this.searchInputEl.value;
			this.selectedIndex = 0;
			this.renderTagList();
		});

		this.searchInputEl.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				this.selectedIndex = Math.min(this.selectedIndex + 1, this.getSelectableCount() - 1);
				this.updateSelection(true);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.updateSelection(true);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				this.chooseCurrent();
			}
		});

		this.listContainerEl = contentEl.createDiv({ cls: 'cmdspace-eagle-tag-list-container' });
		this.listContainerEl.createDiv({ cls: 'cmdspace-eagle-loading', text: 'Loading tags...' });

		try {
			const tags = await this.api.listTags();
			this.allTags = tags.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
			this.renderTagList();
		} catch (err) {
			console.error('[Eagle Bridge] Failed to load tags:', err);
			this.listContainerEl.empty();
			this.listContainerEl.createDiv({ cls: 'cmdspace-eagle-picker-empty', text: 'Failed to load tags.' });
		}

		setTimeout(() => {
			this.searchInputEl.focus();
		}, 20);
	}

	private getSelectableCount(): number {
		let count = this.filteredTags.length;
		const query = this.searchQuery.trim();
		if (query && !this.allTags.some(t => t.name.toLowerCase() === query.toLowerCase())) {
			count += 1;
		}
		return Math.max(count, 0);
	}

	private chooseCurrent(): void {
		const query = this.searchQuery.trim();
		const hasCreate = Boolean(query && !this.allTags.some(t => t.name.toLowerCase() === query.toLowerCase()));

		if (hasCreate && this.selectedIndex === 0) {
			this.onSelectTag(query);
			this.close();
			return;
		}

		const tagIndex = hasCreate ? this.selectedIndex - 1 : this.selectedIndex;
		const tag = this.filteredTags[tagIndex];
		if (tag) {
			this.onSelectTag(tag.name);
			this.close();
		} else if (query) {
			this.onSelectTag(query);
			this.close();
		}
	}

	private renderTagList(): void {
		this.listContainerEl.empty();
		this.itemElements = [];

		const query = this.searchQuery.trim().toLowerCase();
		this.filteredTags = this.allTags.filter(t => t.name.toLowerCase().includes(query));

		const hasExactMatch = this.allTags.some(t => t.name.toLowerCase() === query);
		if (query && !hasExactMatch) {
			const createRow = this.listContainerEl.createDiv({ cls: 'cmdspace-eagle-tag-create-row' });
			this.itemElements.push(createRow);
			createRow.createSpan({ text: `+ Create "${this.searchQuery.trim()}"` });
			createRow.addEventListener('click', () => {
				this.onSelectTag(this.searchQuery.trim());
				this.close();
			});
		}

		if (this.filteredTags.length === 0 && (!query || hasExactMatch)) {
			this.listContainerEl.createDiv({ cls: 'cmdspace-eagle-picker-empty', text: 'No tags found.' });
			return;
		}

		const gridEl = this.listContainerEl.createDiv({ cls: 'cmdspace-eagle-tag-grid' });
		for (let i = 0; i < this.filteredTags.length; i++) {
			const tag = this.filteredTags[i];
			const tagRow = gridEl.createDiv({ cls: 'cmdspace-eagle-tag-item' });
			this.itemElements.push(tagRow);
			// Long names are cut short in the two-column list, so the tooltip gives the whole tag
			tagRow.setAttr('aria-label', tag.name);

			tagRow.createSpan({ cls: 'cmdspace-eagle-tag-bullet', text: '• ' });
			tagRow.createSpan({ cls: 'cmdspace-eagle-tag-name', text: tag.name });
			const count = typeof tag.imageCount === 'number' ? tag.imageCount : 0;
			tagRow.createSpan({ cls: 'cmdspace-eagle-tag-count', text: ` (${count})` });

			if (this.selectedTags.has(tag.name)) {
				tagRow.addClass('is-selected-tag');
			}

			tagRow.addEventListener('click', () => {
				this.onSelectTag(tag.name);
				this.close();
			});

			tagRow.addEventListener('mouseenter', () => {
				const hasCreate = Boolean(query && !hasExactMatch);
				this.selectedIndex = hasCreate ? i + 1 : i;
				this.updateSelection(false);
			});
		}

		this.updateSelection(false);
	}

	private updateSelection(scroll = true): void {
		for (let i = 0; i < this.itemElements.length; i++) {
			const el = this.itemElements[i];
			if (i === this.selectedIndex) {
				el.addClass('is-focused');
				if (scroll) el.scrollIntoView({ block: 'nearest' });
			} else {
				el.removeClass('is-focused');
			}
		}
	}
}

export class EagleFolderPickerModal extends Modal {
	private api: EagleApiService;
	private folders: EagleFolder[];
	private recentFolders: { id: string; name: string; path: string }[];
	private flattenedFolders: { id: string; name: string; path: string }[];
	private onSelect: (result: EagleFolderPickerResult) => void;
	private resolved = false;

	// Upload metadata context
	private context?: EagleFolderPickerContext;
	private previewUrl?: string;
	private initialFileName: string;
	private itemName: string;
	private itemDescription: string;
	private itemTags: string[];
	// Tags suggested by the AI wand that do not exist in the Eagle library yet
	private aiNewTags = new Set<string>();
	// What the user typed in the Hints box, passed to the AI wands and not saved to Eagle
	private aiUserHints = '';
	private starRating = 0;

	// Folder tree state
	private searchQuery = '';
	private expandedFolderIds: Set<string> = new Set();
	private selectedIndex = 0;
	private visibleItems: EagleFolderPickerItem[] = [];

	private searchInputEl!: HTMLInputElement;
	private listContainerEl!: HTMLElement;
	private rowElements: HTMLElement[] = [];
	private executeMirror?: () => Promise<void>;

	constructor(
		app: App,
		api: EagleApiService,
		folders: EagleFolder[],
		recentFolders: { id: string; name: string; path: string }[],
		flattenedFolders: { id: string; name: string; path: string }[],
		onSelect: (result: EagleFolderPickerResult) => void,
		context?: EagleFolderPickerContext
	) {
		super(app);
		this.api = api;
		this.folders = folders;
		this.recentFolders = recentFolders;
		this.flattenedFolders = flattenedFolders;
		this.onSelect = onSelect;
		this.context = context;

		this.previewUrl = context?.previewUrl;
		this.initialFileName = context?.fileName ? context.fileName.replace(/\.[^.]+$/, '') : 'Image';
		this.itemName = this.initialFileName;
		this.itemDescription = context?.initialAltText || '';
		this.itemTags = [...(context?.initialTags || [])];
	}

	/**
	 * A field label with an AI wand button beside it. `run` asks the assistant and fills the
	 * field. While it runs the wand is animated and ignores clicks; a failure is shown as a
	 * notice, using the assistant's own message.
	 */
	private createFieldLabel(
		groupEl: HTMLElement,
		label: string,
		tooltip: string,
		run: (ai: EagleAiAssistant, imageUrl: string) => Promise<void>
	): void {
		const rowEl = groupEl.createDiv({ cls: 'cmdspace-eagle-field-label-row' });
		rowEl.createEl('label', { text: label, cls: 'cmdspace-eagle-field-label' });

		const ai = this.context?.ai;
		if (!ai) return;

		const wandBtn = rowEl.createEl('button', { cls: 'cmdspace-eagle-ai-wand clickable-icon', type: 'button' });
		setIcon(wandBtn, 'wand-2');
		if (wandBtn.childElementCount === 0) wandBtn.setText('🪄');
		wandBtn.setAttr('aria-label', tooltip);

		wandBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (wandBtn.hasClass('is-loading')) return;

			const imageUrl = this.previewUrl;
			if (!imageUrl) {
				new Notice('There is no image here to send to the AI provider.');
				return;
			}

			wandBtn.addClass('is-loading');
			void (async () => {
				try {
					await run(ai, imageUrl);
				} catch (error) {
					console.error('[Eagle Bridge] AI suggestion failed:', error);
					new Notice(error instanceof Error && error.message ? error.message : 'The AI request failed.', 8000);
				} finally {
					wandBtn.removeClass('is-loading');
				}
			})();
		});
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('cmdspace-eagle-picker-modal-window');
		contentEl.empty();
		contentEl.addClass('cmdspace-eagle-folder-picker-modal');

		// Two-pane split container
		const splitContainer = contentEl.createDiv({ cls: 'cmdspace-eagle-picker-split' });

		// --- LEFT PANE: Preview, Rating, Name, Description, Tags ---
		const leftPane = splitContainer.createDiv({ cls: 'cmdspace-eagle-picker-left-pane' });

		// 1. Thumbnail Preview with centered inset dimensions badge
		const previewBox = leftPane.createDiv({ cls: 'cmdspace-eagle-preview-container' });
		if (this.previewUrl) {
			const img = previewBox.createEl('img', { cls: 'cmdspace-eagle-preview-image' });
			img.src = this.previewUrl;
			const dimensionBadge = previewBox.createDiv({ cls: 'cmdspace-eagle-dimension-badge' });
			const updateDimensions = () => {
				if (img.naturalWidth && img.naturalHeight) {
					dimensionBadge.setText(`${img.naturalWidth}x${img.naturalHeight}`);
					dimensionBadge.style.display = 'block';
				} else {
					dimensionBadge.style.display = 'none';
				}
			};
			if (img.complete && img.naturalWidth) {
				updateDimensions();
			} else {
				img.onload = updateDimensions;
			}
		} else {
			const placeholder = previewBox.createDiv({ cls: 'cmdspace-eagle-preview-placeholder' });
			placeholder.createSpan({ text: '🖼️', cls: 'cmdspace-eagle-placeholder-icon' });
		}

		// 2. Ratings Picker (5 stars)
		const ratingContainer = leftPane.createDiv({ cls: 'cmdspace-eagle-rating-container' });
		const starContainer = ratingContainer.createDiv({ cls: 'cmdspace-eagle-stars-row' });
		const starEls: HTMLElement[] = [];

		const updateStars = (val: number) => {
			for (let s = 1; s <= 5; s++) {
				if (s <= val) {
					starEls[s - 1].addClass('is-active');
					starEls[s - 1].setText('★');
				} else {
					starEls[s - 1].removeClass('is-active');
					starEls[s - 1].setText('☆');
				}
			}
		};

		for (let s = 1; s <= 5; s++) {
			const star = starContainer.createSpan({
				cls: 'cmdspace-eagle-star-btn',
				text: s <= this.starRating ? '★' : '☆',
			});
			starEls.push(star);
			star.addEventListener('mouseenter', () => updateStars(s));
			star.addEventListener('click', (e) => {
				e.stopPropagation();
				this.starRating = (this.starRating === s ? 0 : s);
				updateStars(this.starRating);
			});
		}

		starContainer.addEventListener('mouseleave', () => updateStars(this.starRating));

		// 3. Name Field
		// Read at click time, so the wands see whatever is in the Hints box at that moment
		const aiHints = () => ({
			fileName: this.initialFileName,
			altText: this.context?.initialAltText,
			sourcePageUrl: this.context?.sourcePageUrl,
			userHints: this.aiUserHints.trim() || undefined,
		});

		const nameGroup = leftPane.createDiv({ cls: 'cmdspace-eagle-field-group' });
		this.createFieldLabel(nameGroup, 'Name', 'Suggest a name with AI', async (ai, imageUrl) => {
			const name = await ai.suggestName(imageUrl, aiHints());
			nameInput.value = name;
			this.itemName = name;
		});
		const nameInput = nameGroup.createEl('input', {
			type: 'text',
			cls: 'cmdspace-eagle-input',
			value: this.itemName,
			placeholder: 'Add Name',
		});
		nameInput.addEventListener('input', () => {
			this.itemName = nameInput.value;
		});
		nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				if (this.visibleItems[this.selectedIndex]) {
					this.selectItem(this.visibleItems[this.selectedIndex]);
				}
			}
		});

		// 4. Description Field
		const descGroup = leftPane.createDiv({ cls: 'cmdspace-eagle-field-group' });
		this.createFieldLabel(descGroup, 'Description', 'Suggest a description with AI', async (ai, imageUrl) => {
			const description = await ai.suggestDescription(imageUrl, aiHints());
			descTextarea.value = description;
			this.itemDescription = description;
		});
		const descTextarea = descGroup.createEl('textarea', {
			cls: 'cmdspace-eagle-textarea',
			placeholder: 'Add Description',
		});
		descTextarea.value = this.itemDescription;
		descTextarea.rows = 2;
		descTextarea.addEventListener('input', () => {
			this.itemDescription = descTextarea.value;
		});
		descTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault();
				if (this.visibleItems[this.selectedIndex]) {
					this.selectItem(this.visibleItems[this.selectedIndex]);
				}
			}
		});

		// 5. Tags Section with Pills & "+ Add Tag" / "+" Button
		const tagsGroup = leftPane.createDiv({ cls: 'cmdspace-eagle-field-group' });
		this.createFieldLabel(tagsGroup, 'Tags', 'Suggest tags with AI', async (ai, imageUrl) => {
			const suggestions = await ai.suggestTags(imageUrl, aiHints(), this.itemTags);
			for (const tag of suggestions.tags) {
				if (this.itemTags.includes(tag.name)) continue;
				this.itemTags.push(tag.name);
				if (tag.isNew) this.aiNewTags.add(tag.name);
			}
			renderTags();

			if (suggestions.tags.length === 0) {
				new Notice('No further tags were suggested.');
			}
			if (suggestions.truncatedTo) {
				new Notice(`Your library has ${suggestions.truncatedTo.total} tags; the ${suggestions.truncatedTo.sent} most used were sent to the AI provider.`, 8000);
			}
		});
		const tagsWrapper = tagsGroup.createDiv({ cls: 'cmdspace-eagle-tags-wrapper' });

		const renderTags = () => {
			tagsWrapper.empty();
			for (const tag of this.itemTags) {
				const isNewTag = this.aiNewTags.has(tag);
				const pill = tagsWrapper.createDiv({
					cls: isNewTag ? 'cmdspace-eagle-tag-pill is-new' : 'cmdspace-eagle-tag-pill',
				});
				// Long tags are cut short in the pill, so the tooltip always gives the whole tag
				pill.setAttr('aria-label', isNewTag ? `${tag} (new tag: not in your Eagle library yet)` : tag);
				pill.createSpan({ cls: 'cmdspace-eagle-tag-pill-text', text: tag });
				const removeBtn = pill.createSpan({ cls: 'cmdspace-eagle-tag-pill-remove', text: '✕' });
				removeBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.itemTags = this.itemTags.filter((t) => t !== tag);
					this.aiNewTags.delete(tag);
					renderTags();
				});
			}

			const hasTags = this.itemTags.length > 0;
			const addTagBtn = tagsWrapper.createEl('button', {
				cls: hasTags ? 'cmdspace-eagle-add-tag-btn is-collapsed' : 'cmdspace-eagle-add-tag-btn',
				text: hasTags ? '+' : '+ Add Tag',
			});
			addTagBtn.title = 'Add tag';

			addTagBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				new EagleTagPickerModal(this.app, this.api, this.itemTags, (chosenTag) => {
					if (!this.itemTags.includes(chosenTag)) {
						this.itemTags.push(chosenTag);
						renderTags();
					}
				}).open();
			});
		};

		renderTags();

		// 6. Hints for the AI wands (only shown with them, and not saved to Eagle)
		if (this.context?.ai) {
			const hintsTooltip = 'Optional. Tell the AI what this image is, as briefly as you like, for example "WoW Dalaran fan art". You can also say what you want, such as "tag the characters, not the art style". The wand buttons use it for the name, description and tags. Hints are not saved to Eagle.';

			const hintsGroup = leftPane.createDiv({ cls: 'cmdspace-eagle-field-group' });
			const hintsLabelRow = hintsGroup.createDiv({ cls: 'cmdspace-eagle-field-label-row' });
			hintsLabelRow.createEl('label', { text: 'AI hints', cls: 'cmdspace-eagle-field-label' });
			const hintsTools = hintsLabelRow.createDiv({ cls: 'cmdspace-eagle-field-tools' });

			// Ready-made hints. Choosing one adds its text to the box, where it can still be edited.
			const templates = (this.context?.hintTemplates || []).filter(template => template.name && template.text);
			if (templates.length > 0) {
				const templateSelect = hintsTools.createEl('select', { cls: 'dropdown cmdspace-eagle-hint-templates' });
				templateSelect.setAttr('aria-label', 'Add a ready-made hint to the box. Edit the list under Settings → AI → Hint templates.');
				templateSelect.createEl('option', { text: 'Templates…', value: '' });
				templates.forEach((template, index) => {
					templateSelect.createEl('option', { text: template.name, value: String(index) });
				});
				templateSelect.addEventListener('change', () => {
					const template = templates[Number(templateSelect.value)];
					// Back to the placeholder, so the same template can be chosen again later
					templateSelect.value = '';
					if (!template) return;

					const current = hintsTextarea.value.trim();
					if (current.includes(template.text)) return;
					hintsTextarea.value = current ? `${current}\n${template.text}` : template.text;
					this.aiUserHints = hintsTextarea.value;
					hintsTextarea.focus();
				});
			}

			const hintsHelp = hintsTools.createSpan({ cls: 'cmdspace-eagle-field-help' });
			setIcon(hintsHelp, 'help-circle');
			if (hintsHelp.childElementCount === 0) hintsHelp.setText('?');
			hintsHelp.setAttr('aria-label', hintsTooltip);

			const hintsTextarea = hintsGroup.createEl('textarea', {
				cls: 'cmdspace-eagle-textarea',
				placeholder: 'Optional: what is this?',
			});
			hintsTextarea.rows = 2;
			hintsTextarea.setAttr('aria-label', hintsTooltip);
			hintsTextarea.addEventListener('input', () => {
				this.aiUserHints = hintsTextarea.value;
			});
		}

		// --- RIGHT PANE: Folder Tree, Search, Recents ---
		const rightPane = splitContainer.createDiv({ cls: 'cmdspace-eagle-picker-right-pane' });

		// Header
		const headerEl = rightPane.createDiv({ cls: 'cmdspace-eagle-picker-header' });
		headerEl.createDiv({ cls: 'cmdspace-eagle-picker-title', text: 'Select Eagle Folder' });

		// Mirror button action bar
		const activePath = this.context?.activeFolderPath?.trim();
		const rootName = this.context?.mirrorRootFolderName?.trim();
		let pathDisplay: string;
		if (rootName) {
			pathDisplay = activePath ? `${rootName} / ${activePath.replace(/\//g, ' / ')}` : rootName;
		} else {
			pathDisplay = activePath ? activePath.replace(/\//g, ' / ') : 'Library Root';
		}

		const mirrorBar = headerEl.createDiv({ cls: 'cmdspace-eagle-picker-mirror-bar' });
		const mirrorBtn = mirrorBar.createEl('button', {
			cls: 'cmdspace-eagle-picker-mirror-btn',
			type: 'button',
		});
		mirrorBtn.createSpan({ cls: 'cmdspace-eagle-picker-mirror-icon', text: '🪞' });
		const mirrorBtnText = mirrorBtn.createSpan({ cls: 'cmdspace-eagle-picker-mirror-btn-text', text: 'Mirror' });
		mirrorBtn.title = `Mirror to Eagle folder: ${pathDisplay} (Alt+M)`;

		mirrorBar.createDiv({
			cls: 'cmdspace-eagle-picker-mirror-path',
			text: pathDisplay,
			title: `Mirror to Eagle folder: ${pathDisplay} (Alt+M)`,
		});

		let isMirroring = false;
		const executeMirror = async () => {
			if (this.resolved || isMirroring) return;
			if (!this.context?.onMirror) {
				this.selectItem({
					type: 'root',
					name: 'Library Root',
					path: 'Library Root',
				});
				return;
			}

			isMirroring = true;
			mirrorBtn.addClass('is-loading');
			mirrorBtnText.setText('Mirroring...');
			mirrorBtn.disabled = true;

			try {
				const folderId = await this.context.onMirror();
				this.resolved = true;
				this.onSelect({
					folderId,
					folderName: pathDisplay,
					cancelled: false,
					name: this.itemName.trim() || this.initialFileName,
					annotation: this.itemDescription.trim() || undefined,
					tags: this.itemTags.length > 0 ? this.itemTags : undefined,
					star: this.starRating > 0 ? this.starRating : undefined,
					mirrored: true,
				});
				this.close();
			} catch (err) {
				console.error('[Eagle Bridge] Error executing mirror from picker:', err);
				new Notice('Failed to mirror folder hierarchy in Eagle.');
				isMirroring = false;
				mirrorBtn.removeClass('is-loading');
				mirrorBtnText.setText('Mirror');
				mirrorBtn.disabled = false;
			}
		};

		this.executeMirror = executeMirror;

		mirrorBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			void executeMirror();
		});

		const searchContainer = headerEl.createDiv({ cls: 'cmdspace-eagle-picker-search-container' });
		this.searchInputEl = searchContainer.createEl('input', {
			type: 'text',
			cls: 'cmdspace-eagle-picker-search-input',
			placeholder: 'Type to search or browse tree... (Esc to cancel)',
		});

		this.searchInputEl.addEventListener('input', () => {
			this.searchQuery = this.searchInputEl.value;
			this.selectedIndex = 0;
			this.renderList();
		});

		this.searchInputEl.addEventListener('keydown', (e: KeyboardEvent) => {
			this.handleKeydown(e);
		});

		// Modal-wide shortcut for Alt+M / Cmd+M
		modalEl.addEventListener('keydown', (e: KeyboardEvent) => {
			if ((e.altKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
				e.preventDefault();
				e.stopPropagation();
				void executeMirror();
			}
		});

		// Scrollable List container
		this.listContainerEl = rightPane.createDiv({ cls: 'cmdspace-eagle-picker-list-container' });

		// Footer instructions
		const footerEl = contentEl.createDiv({ cls: 'cmdspace-eagle-picker-footer' });
		const instructionsEl = footerEl.createDiv({ cls: 'cmdspace-eagle-picker-instructions' });

		const addInstruction = (key: string, label: string) => {
			const item = instructionsEl.createDiv({ cls: 'cmdspace-eagle-picker-instruction' });
			item.createEl('kbd', { text: key });
			item.createSpan({ text: label });
		};

		addInstruction('↑↓', 'navigate');
		addInstruction('→', 'expand');
		addInstruction('←', 'collapse');
		addInstruction('↵', 'select folder & save');
		addInstruction('alt+m', 'mirror folder');
		addInstruction('esc', 'cancel');

		// Initial render
		this.renderList();

		// Auto focus search input
		setTimeout(() => {
			this.searchInputEl.focus();
		}, 20);
	}

	private renderList(): void {
		this.listContainerEl.empty();
		this.visibleItems = [];
		this.rowElements = [];

		const query = this.searchQuery.trim().toLowerCase();

		if (query.length > 0) {
			this.renderSearchResults(query);
		} else {
			this.renderTreeView();
		}

		if (this.visibleItems.length === 0) {
			this.listContainerEl.createDiv({
				cls: 'cmdspace-eagle-picker-empty',
				text: 'No matching folders found.',
			});
			return;
		}

		if (this.selectedIndex < 0) this.selectedIndex = 0;
		if (this.selectedIndex >= this.visibleItems.length) {
			this.selectedIndex = this.visibleItems.length - 1;
		}

		this.updateSelection(false);
	}

	private renderTreeView(): void {
		// 1. Library Root Option
		const rootItem: EagleFolderPickerItem = {
			type: 'root',
			name: 'Library Root (Uncategorized)',
			path: 'Library Root',
		};
		this.visibleItems.push(rootItem);
		this.createRowEl(rootItem, this.visibleItems.length - 1);

		// 2. Recent Folders Section
		if (this.recentFolders.length > 0) {
			this.listContainerEl.createDiv({
				cls: 'cmdspace-eagle-picker-section-header',
				text: 'RECENT FOLDERS',
			});

			for (const rf of this.recentFolders) {
				const recentItem: EagleFolderPickerItem = {
					type: 'recent',
					id: rf.id,
					name: rf.name,
					path: rf.path,
				};
				this.visibleItems.push(recentItem);
				this.createRowEl(recentItem, this.visibleItems.length - 1);
			}
		}

		// 3. Tree Folders Section
		const allHeader = this.listContainerEl.createDiv({
			cls: 'cmdspace-eagle-picker-section-header',
		});
		allHeader.createSpan({ text: 'ALL FOLDERS' });

		const actionContainer = allHeader.createDiv({ cls: 'cmdspace-eagle-picker-section-actions' });
		const expandAllBtn = actionContainer.createEl('button', {
			cls: 'cmdspace-eagle-picker-action-btn',
			text: 'Expand all',
		});
		expandAllBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.expandAll();
		});

		const collapseAllBtn = actionContainer.createEl('button', {
			cls: 'cmdspace-eagle-picker-action-btn',
			text: 'Collapse all',
		});
		collapseAllBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.collapseAll();
		});

		const addNodes = (folderList: EagleFolder[], depth: number, parentId?: string, parentPath = '') => {
			for (const f of folderList) {
				const currentPath = parentPath ? `${parentPath} / ${f.name}` : f.name;
				const hasChildren = Array.isArray(f.children) && f.children.length > 0;
				const isExpanded = this.expandedFolderIds.has(f.id);

				const treeItem: EagleFolderPickerItem = {
					type: 'tree-folder',
					id: f.id,
					name: f.name,
					path: currentPath,
					depth,
					hasChildren,
					isExpanded,
					parentId,
				};

				this.visibleItems.push(treeItem);
				this.createRowEl(treeItem, this.visibleItems.length - 1, f);

				if (hasChildren && isExpanded) {
					addNodes(f.children, depth + 1, f.id, currentPath);
				}
			}
		};

		addNodes(this.folders, 0);
	}

	private renderSearchResults(query: string): void {
		this.listContainerEl.createDiv({
			cls: 'cmdspace-eagle-picker-section-header',
			text: 'SEARCH RESULTS',
		});

		if ('library root uncategorized'.includes(query)) {
			const rootItem: EagleFolderPickerItem = {
				type: 'root',
				name: 'Library Root (Uncategorized)',
				path: 'Library Root',
			};
			this.visibleItems.push(rootItem);
			this.createRowEl(rootItem, this.visibleItems.length - 1);
		}

		for (const f of this.flattenedFolders) {
			if (f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query)) {
				const searchItem: EagleFolderPickerItem = {
					type: 'search-folder',
					id: f.id,
					name: f.name,
					path: f.path,
				};
				this.visibleItems.push(searchItem);
				this.createRowEl(searchItem, this.visibleItems.length - 1);
			}
		}
	}

	private createRowEl(item: EagleFolderPickerItem, index: number, folderData?: EagleFolder): HTMLElement {
		const row = this.listContainerEl.createDiv({ cls: 'cmdspace-eagle-tree-row' });
		this.rowElements.push(row);

		if (item.type === 'tree-folder' && item.depth !== undefined) {
			row.style.paddingLeft = `${item.depth * 20 + 8}px`;
		}

		// Chevron / spacer for tree-folder
		if (item.type === 'tree-folder') {
			if (item.hasChildren) {
				const chevron = row.createSpan({
					cls: 'cmdspace-eagle-tree-chevron',
					text: item.isExpanded ? '▼' : '▶',
				});
				chevron.addEventListener('click', (e) => {
					e.stopPropagation();
					if (this.expandedFolderIds.has(item.id!)) {
						this.expandedFolderIds.delete(item.id!);
					} else {
						this.expandedFolderIds.add(item.id!);
					}
					this.renderList();
				});
			} else {
				row.createSpan({ cls: 'cmdspace-eagle-tree-chevron-spacer' });
			}
		}

		// Icon
		const iconEl = row.createSpan({ cls: 'cmdspace-eagle-tree-icon' });
		if (item.type === 'root') {
			iconEl.setText('📚');
		} else if (item.type === 'recent') {
			iconEl.setText('🕒');
		} else if (item.type === 'tree-folder') {
			iconEl.setText(item.isExpanded ? '📂' : '📁');
		} else {
			iconEl.setText('📁');
		}

		// Name and badges
		const nameEl = row.createSpan({ cls: 'cmdspace-eagle-tree-name' });
		nameEl.createSpan({ text: item.name });

		if (item.type === 'root') {
			nameEl.createSpan({ cls: 'cmdspace-eagle-badge cmdspace-eagle-badge-root', text: 'Root' });
		} else if (item.type === 'recent') {
			nameEl.createSpan({ cls: 'cmdspace-eagle-badge cmdspace-eagle-badge-recent', text: 'Recent' });
		}

		if (item.type === 'tree-folder' && item.hasChildren && folderData?.children) {
			nameEl.createSpan({
				cls: 'cmdspace-eagle-tree-child-count',
				text: `(${folderData.children.length})`,
			});
		}

		// Path info for search or recent items
		if ((item.type === 'recent' || item.type === 'search-folder') && item.path !== item.name) {
			row.createSpan({ cls: 'cmdspace-eagle-tree-path', text: item.path });
		}

		// Hover and Click handling
		row.addEventListener('mouseenter', () => {
			this.selectedIndex = index;
			this.updateSelection(false);
		});

		row.addEventListener('click', () => {
			this.selectItem(item);
		});

		return row;
	}

	private updateSelection(scrollIntoView = true): void {
		for (let i = 0; i < this.rowElements.length; i++) {
			const el = this.rowElements[i];
			if (i === this.selectedIndex) {
				el.addClass('is-selected');
				if (scrollIntoView) {
					el.scrollIntoView({ block: 'nearest' });
				}
			} else {
				el.removeClass('is-selected');
			}
		}
	}

	private expandAll(): void {
		const collectIds = (folders: EagleFolder[]) => {
			for (const f of folders) {
				if (Array.isArray(f.children) && f.children.length > 0) {
					this.expandedFolderIds.add(f.id);
					collectIds(f.children);
				}
			}
		};
		collectIds(this.folders);
		this.renderList();
	}

	private collapseAll(): void {
		this.expandedFolderIds.clear();
		this.renderList();
	}

	private handleKeydown(e: KeyboardEvent): void {
		if ((e.altKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
			e.preventDefault();
			e.stopPropagation();
			if (this.executeMirror) {
				void this.executeMirror();
			}
			return;
		}

		if (this.visibleItems.length === 0) return;

		switch (e.key) {
			case 'ArrowDown': {
				e.preventDefault();
				this.selectedIndex = Math.min(this.selectedIndex + 1, this.visibleItems.length - 1);
				this.updateSelection(true);
				break;
			}
			case 'ArrowUp': {
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.updateSelection(true);
				break;
			}
			case 'ArrowRight': {
				const current = this.visibleItems[this.selectedIndex];
				if (current?.type === 'tree-folder' && current.hasChildren) {
					e.preventDefault();
					if (!current.isExpanded) {
						this.expandedFolderIds.add(current.id!);
						this.renderList();
					} else {
						this.selectedIndex = Math.min(this.selectedIndex + 1, this.visibleItems.length - 1);
						this.updateSelection(true);
					}
				}
				break;
			}
			case 'ArrowLeft': {
				const current = this.visibleItems[this.selectedIndex];
				if (current?.type === 'tree-folder') {
					e.preventDefault();
					if (current.isExpanded) {
						this.expandedFolderIds.delete(current.id!);
						this.renderList();
					} else if (current.parentId) {
						const parentIdx = this.visibleItems.findIndex((v) => v.id === current.parentId);
						if (parentIdx !== -1) {
							this.selectedIndex = parentIdx;
							this.updateSelection(true);
						}
					}
				}
				break;
			}
			case 'Enter': {
				e.preventDefault();
				const current = this.visibleItems[this.selectedIndex];
				if (current) {
					this.selectItem(current);
				}
				break;
			}
		}
	}

	private selectItem(item: EagleFolderPickerItem): void {
		if (this.resolved) return;
		this.resolved = true;
		const folderId = item.type === 'root' ? undefined : item.id;
		const folderName = item.type === 'root' ? 'Library Root' : item.path;

		this.onSelect({
			folderId,
			folderName,
			cancelled: false,
			name: this.itemName.trim() || this.initialFileName,
			annotation: this.itemDescription.trim() || undefined,
			tags: this.itemTags.length > 0 ? this.itemTags : undefined,
			star: this.starRating > 0 ? this.starRating : undefined,
		});
		this.close();
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolved = true;
			this.onSelect({ cancelled: true });
		}
	}

	static async pickFolder(
		app: App,
		api: EagleApiService,
		recentFolderIds: string[] = [],
		context?: EagleFolderPickerContext
	): Promise<EagleFolderPickerResult> {
		const connected = await api.isConnected();
		if (!connected) {
			new Notice('Eagle is not running. Please start Eagle and try again.');
			return { cancelled: true };
		}

		const [folders, recentFolders] = await Promise.all([
			api.listFolders(),
			api.listRecentFolders(),
		]);

		const flattened = flattenEagleFolders(folders);
		const folderMap = new Map<string, { id: string; name: string; path: string }>();
		for (const f of flattened) {
			folderMap.set(f.id, f);
		}

		// Combine plugin recentFolderIds + API recent folders
		const combinedRecentIds: string[] = [];
		const seenRecent = new Set<string>();

		for (const id of recentFolderIds) {
			if (id && folderMap.has(id) && !seenRecent.has(id)) {
				seenRecent.add(id);
				combinedRecentIds.push(id);
			}
		}

		for (const rf of recentFolders) {
			if (rf?.id && folderMap.has(rf.id) && !seenRecent.has(rf.id)) {
				seenRecent.add(rf.id);
				combinedRecentIds.push(rf.id);
			}
		}

		const resolvedRecents: { id: string; name: string; path: string }[] = [];
		for (const id of combinedRecentIds) {
			const f = folderMap.get(id);
			if (f) {
				resolvedRecents.push(f);
			}
		}

		return new Promise<EagleFolderPickerResult>((resolve) => {
			const modal = new EagleFolderPickerModal(
				app,
				api,
				folders,
				resolvedRecents,
				flattened,
				(result) => {
					resolve(result);
				},
				context
			);
			modal.open();
		});
	}
}

export class AddFolderMappingModal extends Modal {
	private api: EagleApiService;
	private onSave: (mapping: EagleFolderMapping) => void;
	private obsidianFolder = '';
	private selectedEagleFolderId = '';
	private selectedEagleFolderName = '';

	constructor(app: App, api: EagleApiService, onSave: (mapping: EagleFolderMapping) => void) {
		super(app);
		this.api = api;
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Add Folder Mapping' });

		const folders = this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.map(f => f.path)
			.filter(p => p && p !== '/');

		new Setting(contentEl)
			.setName('Obsidian folder')
			.setDesc('Path of the folder in your Obsidian vault (e.g. Work/Projects).')
			.addText(text => {
				text.setPlaceholder('Obsidian/Folder/Path')
					.setValue(this.obsidianFolder)
					.onChange(val => {
						this.obsidianFolder = val.trim().replace(/^\/+|\/+$/g, '');
					});
				if (folders.length > 0) {
					const datalistId = 'obsidian-vault-folders-list';
					let datalist = document.getElementById(datalistId) as HTMLDataListElement | null;
					if (!datalist) {
						datalist = document.createElement('datalist');
						datalist.id = datalistId;
						document.body.appendChild(datalist);
					}
					datalist.empty();
					folders.forEach(f => {
						const option = document.createElement('option');
						option.value = f;
						datalist?.appendChild(option);
					});
					text.inputEl.setAttribute('list', datalistId);
				}
			});

		const eagleFolderSetting = new Setting(contentEl)
			.setName('Eagle folder')
			.setDesc(this.selectedEagleFolderName || 'No Eagle folder selected')
			.addButton(btn => {
				btn.setButtonText('Select Folder').onClick(async () => {
					const folders = await this.api.listFolders();
					if (!folders || folders.length === 0) {
						new Notice('No folders found in Eagle or Eagle is not running.');
						return;
					}
					const flattened = flattenEagleFolders(folders);
					const folderModal = new EagleFolderModal(this.app, flattened, (folderId) => {
						const chosen = flattened.find(f => f.id === folderId);
						if (chosen) {
							this.selectedEagleFolderId = chosen.id;
							this.selectedEagleFolderName = chosen.path;
							eagleFolderSetting.setDesc(chosen.path);
						}
					});
					folderModal.open();
				});
			});

		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText('Save Mapping')
					.setCta()
					.onClick(() => {
						if (!this.obsidianFolder) {
							new Notice('Please specify an Obsidian folder path.');
							return;
						}
						if (!this.selectedEagleFolderId) {
							new Notice('Please select a target Eagle folder.');
							return;
						}
						this.onSave({
							id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
							obsidianFolder: this.obsidianFolder,
							eagleFolderId: this.selectedEagleFolderId,
							eagleFolderName: this.selectedEagleFolderName,
						});
						this.close();
					});
			})
			.addButton(btn => {
				btn.setButtonText('Cancel').onClick(() => this.close());
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export interface CanvasNodeChoiceResponse {
	choice: 'text' | 'link' | 'cancel';
	rememberChoice: boolean;
}

export class CanvasNodeChoiceModal extends Modal {
	private response: Partial<CanvasNodeChoiceResponse> = { rememberChoice: false };
	private resolvePromise?: (value: CanvasNodeChoiceResponse) => void;

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cmdspace-paste-choice-modal');

		contentEl.createEl('h2', { text: 'Add image to canvas as' });

		const optionContainer = contentEl.createDiv({ cls: 'cmdspace-paste-options' });

		this.addOption(optionContainer, 'text', 'Text card', 'A card containing the image, with its metadata card when that is enabled.', true);
		this.addOption(optionContainer, 'link', 'Link card', 'A web card that loads the image address directly.');

		new Setting(contentEl)
			.setName('Remember this choice')
			.setDesc('You can change this later in plugin settings')
			.addToggle((toggle) => {
				toggle.setValue(false).onChange((value) => {
					this.response.rememberChoice = value;
				});
			});
	}

	private addOption(
		containerEl: HTMLElement,
		choice: 'text' | 'link',
		title: string,
		description: string,
		primary = false
	): void {
		const optionBtn = containerEl.createEl('button', {
			cls: primary ? 'cmdspace-paste-option mod-cta' : 'cmdspace-paste-option'
		});
		optionBtn.createDiv({ cls: 'cmdspace-paste-option-title', text: title });
		optionBtn.createDiv({ cls: 'cmdspace-paste-option-desc', text: description });
		optionBtn.addEventListener('click', () => {
			this.response.choice = choice;
			this.close();
		});
	}

	onClose(): void {
		if (this.resolvePromise) {
			this.resolvePromise({
				choice: this.response.choice ?? 'cancel',
				rememberChoice: this.response.rememberChoice ?? false,
			});
		}
	}

	getResponse(): Promise<CanvasNodeChoiceResponse> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}
}

export interface ImagePasteChoiceResponse {
	choice: 'eagle' | 'local' | 'cloud' | 'cancel';
	// State of "Also upload to the cloud", which applies to the Eagle choice
	alsoCloud: boolean;
	rememberChoice: boolean;
}

export interface ImagePasteChoiceOptions {
	// Name of the cloud provider, or null when none is set up (the cloud toggle is then left out)
	providerName: string | null;
	// Starting state of "Also upload to the cloud"
	alsoCloud: boolean;
	showVault: boolean;
	// What choosing Eagle does, with the cloud toggle on or off
	describeEagle: (alsoCloud: boolean) => string;
	cloudDescription: string;
}

export class ImagePasteChoiceModal extends Modal {
	private response: Partial<ImagePasteChoiceResponse> = { rememberChoice: false };
	private resolvePromise?: (value: ImagePasteChoiceResponse) => void;
	private options: ImagePasteChoiceOptions;

	constructor(app: App, options: ImagePasteChoiceOptions) {
		super(app);
		this.options = options;
		this.response.alsoCloud = options.providerName !== null && options.alsoCloud;
	}

	onOpen(): void {
		const { contentEl } = this;
		const { providerName } = this.options;
		contentEl.empty();
		contentEl.addClass('cmdspace-paste-choice-modal');

		contentEl.createEl('h2', { text: 'Where to save image?' });

		const optionContainer = contentEl.createDiv({ cls: 'cmdspace-paste-options' });

		// The Eagle button says what it will do with the cloud toggle as it stands
		const eagleTitle = () => this.response.alsoCloud && providerName ? `Eagle + ${providerName}` : 'Eagle';
		const eagle = this.addOption(optionContainer, 'eagle', eagleTitle(), this.options.describeEagle(!!this.response.alsoCloud), true);
		if (this.options.showVault) {
			this.addOption(optionContainer, 'local', 'Vault', 'Saved as an attachment in this vault.');
		}
		this.addOption(optionContainer, 'cloud', 'Cloud only', this.options.cloudDescription);

		if (providerName) {
			new Setting(contentEl)
				.setName(`Also upload to ${providerName}`)
				.setDesc('For an image saved to Eagle: also upload a copy, and link the note to it.')
				.addToggle((toggle) => {
					toggle.setValue(!!this.response.alsoCloud).onChange((value) => {
						this.response.alsoCloud = value;
						eagle.titleEl.setText(eagleTitle());
						eagle.descEl.setText(this.options.describeEagle(value));
					});
				});
		}

		new Setting(contentEl)
			.setName('Remember this choice')
			.setDesc('You can change this later in plugin settings')
			.addToggle((toggle) => {
				toggle.setValue(false).onChange((value) => {
					this.response.rememberChoice = value;
				});
			});
	}

	private addOption(
		containerEl: HTMLElement,
		choice: 'eagle' | 'local' | 'cloud',
		title: string,
		description: string,
		primary = false
	): { titleEl: HTMLElement; descEl: HTMLElement } {
		const optionBtn = containerEl.createEl('button', {
			cls: primary ? 'cmdspace-paste-option mod-cta' : 'cmdspace-paste-option'
		});
		const titleEl = optionBtn.createDiv({ cls: 'cmdspace-paste-option-title', text: title });
		const descEl = optionBtn.createDiv({ cls: 'cmdspace-paste-option-desc', text: description });
		optionBtn.addEventListener('click', () => {
			this.response.choice = choice;
			this.close();
		});
		return { titleEl, descEl };
	}

	onClose(): void {
		if (this.resolvePromise) {
			this.resolvePromise({
				choice: this.response.choice ?? 'cancel',
				alsoCloud: this.response.alsoCloud ?? false,
				rememberChoice: this.response.rememberChoice ?? false,
			});
		}
	}

	getResponse(): Promise<ImagePasteChoiceResponse> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}
}

export interface EagleLinkChoiceResponse {
	choice: 'embed' | 'inline' | 'cancel';
	useThumbnail: boolean;
	// State of "Also upload to the cloud", which applies to Embed
	alsoCloud: boolean;
	rememberChoice: boolean;
}

export class EagleLinkChoiceModal extends Modal {
	private item: EagleItem;
	private response: EagleLinkChoiceResponse = {
		choice: 'embed',
		useThumbnail: false,
		alsoCloud: false,
		rememberChoice: false,
	};
	private resolvePromise?: (value: EagleLinkChoiceResponse) => void;
	private thumbnailSettingEl: HTMLElement | null = null;
	private cloudSettingEl: HTMLElement | null = null;
	// The cloud provider and the starting state of "Also upload to the cloud", or null when
	// no provider is set up (the toggle is then left out)
	private cloud: { providerName: string; alsoCloud: boolean } | null;

	constructor(
		app: App,
		item: EagleItem,
		cloud: { providerName: string; alsoCloud: boolean } | null = null,
		// Starting state of "Embed thumbnail"
		useThumbnail = false
	) {
		super(app);
		this.item = item;
		this.cloud = cloud;
		this.response.useThumbnail = useThumbnail;
		this.response.alsoCloud = !!cloud && cloud.alsoCloud;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cmdspace-paste-choice-modal');

		contentEl.createEl('h2', { text: 'Paste Eagle item' });
		const desc = contentEl.createEl('p', {
			cls: 'cmdspace-eagle-suggestion-meta',
		});
		desc.setText(`${this.item.name}.${this.item.ext} (${this.item.ext.toUpperCase()})`);

		const buttonContainer = contentEl.createDiv({ cls: 'cmdspace-paste-buttons' });

		const embedBtn = buttonContainer.createEl('button', {
			text: 'Embed',
			cls: 'mod-cta',
		});

		const inlineBtn = buttonContainer.createEl('button', {
			text: 'Inline Link',
		});

		const optionsContainer = contentEl.createDiv();

		// Eagle sets noThumbnail to true for an item it made no thumbnail for, and leaves the
		// field out otherwise
		const hasThumbnail = this.item.noThumbnail !== true;

		if (hasThumbnail) {
			const thumbnailSetting = new Setting(optionsContainer)
				.setName('Embed thumbnail')
				.setDesc('Embed the small preview instead of the full-size image. A cloud copy is always full size.')
				.addToggle((toggle) => {
					toggle.setValue(this.response.useThumbnail).onChange((value) => {
						this.response.useThumbnail = value;
					});
				});
			this.thumbnailSettingEl = thumbnailSetting.settingEl;
		}

		if (this.cloud) {
			const cloudSetting = new Setting(optionsContainer)
				.setName(`Also upload to ${this.cloud.providerName}`)
				.setDesc('Upload a copy if the item does not have one yet, and link the note to it.')
				.addToggle((toggle) => {
					toggle.setValue(this.response.alsoCloud).onChange((value) => {
						this.response.alsoCloud = value;
					});
				});
			this.cloudSettingEl = cloudSetting.settingEl;
		}

		const updateUI = (mode: 'embed' | 'inline') => {
			this.response.choice = mode;
			if (mode === 'embed') {
				embedBtn.addClass('mod-cta');
				inlineBtn.removeClass('mod-cta');
				if (this.thumbnailSettingEl) {
					this.thumbnailSettingEl.style.display = '';
				}
				if (this.cloudSettingEl) {
					this.cloudSettingEl.style.display = '';
				}
			} else {
				embedBtn.removeClass('mod-cta');
				inlineBtn.addClass('mod-cta');
				if (this.thumbnailSettingEl) {
					this.thumbnailSettingEl.style.display = 'none';
				}
				if (this.cloudSettingEl) {
					this.cloudSettingEl.style.display = 'none';
				}
			}
		};

		embedBtn.addEventListener('click', () => {
			updateUI('embed');
		});

		inlineBtn.addEventListener('click', () => {
			updateUI('inline');
		});

		new Setting(optionsContainer)
			.setName('Remember this choice')
			.setDesc('You can change this later in plugin settings')
			.addToggle((toggle) => {
				toggle.setValue(false).onChange((value) => {
					this.response.rememberChoice = value;
				});
			});

		const actionRow = contentEl.createDiv({
			cls: 'cmdspace-paste-buttons',
			attr: { style: 'margin-top: 16px;' },
		});

		const confirmBtn = actionRow.createEl('button', {
			text: 'Insert',
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', () => {
			this.close();
		});

		const cancelBtn = actionRow.createEl('button', {
			text: 'Cancel',
		});
		cancelBtn.addEventListener('click', () => {
			this.response.choice = 'cancel';
			this.close();
		});

		updateUI('embed');
	}

	onClose(): void {
		if (this.resolvePromise) {
			this.resolvePromise({
				choice: this.response.choice ?? 'cancel',
				useThumbnail: this.response.useThumbnail ?? false,
				alsoCloud: this.response.alsoCloud ?? false,
				rememberChoice: this.response.rememberChoice ?? false,
			});
		}
	}

	getResponse(): Promise<EagleLinkChoiceResponse> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}
}

