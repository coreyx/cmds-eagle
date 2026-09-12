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
} from 'obsidian';
import { 
	EagleItem,
	EagleFolder,
	EagleFolderMapping,
	EagleFolderPickerItem,
	CMDSPACEEagleSettings,
	SearchScope,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
	SUPPORTED_DOCUMENT_EXTENSIONS,
	ComputerProfile,
	PlatformType,
} from './types';
import { EagleApiService, buildEagleItemUrl, buildEagleCustomEmbedUrl } from './api';

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

	constructor(app: App, api: EagleApiService, settings: CMDSPACEEagleSettings) {
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
			if (this.settings.eagleEmbedUrlMode === 'custom-url') {
				const libraryName = (await this.api.getLibraryName()) || 'Main';
				const embedUrl = buildEagleCustomEmbedUrl(
					this.settings.eagleCustomUrlPrefix,
					libraryName,
					item.id,
					item.name,
					item.ext,
					false
				);
				let output = `![${filename}](${embedUrl})`;
				if (this.settings.insertThumbnail) {
					output += '\n\n' + this.buildMetadataLine(item);
				}
				editor.replaceSelection(output);
				new Notice(`Embedded: ${item.name}`);
				return;
			}

			const filePath = await this.api.getOriginalFilePath(item);
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

		const convertedPath = this.convertPathForCurrentPlatform(decodedPath);
		const normalizedPath = convertedPath.replace(/\\/g, '/');
		const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
		
		const platform = process.platform as PlatformType;
		if (platform === 'win32' && /^[A-Za-z]:/.test(normalizedPath)) {
			const fixedPath = encodedPath.replace(/^([A-Za-z])%3A/, '$1:');
			return `file:///${fixedPath}`;
		}
		return `file://${encodedPath}`;
	}

	private convertPathForCurrentPlatform(path: string): string {
		if (!this.settings.enableCrossPlatform || this.settings.computers.length === 0) {
			return path;
		}

		const sourceComputer = this.findMatchingComputer(path);
		if (!sourceComputer) {
			return path;
		}

		const currentPlatform = process.platform as PlatformType;
		const currentUsername = this.detectCurrentUsername();

		const currentComputer = this.settings.computers.find(
			c => c.platform === currentPlatform && c.username === currentUsername
		);

		if (!currentComputer || sourceComputer.id === currentComputer.id) {
			return path;
		}

		let relativePath = '';
		if (sourceComputer.platform === 'darwin') {
			relativePath = path.replace(`/Users/${sourceComputer.username}/`, '');
		} else {
			const winPattern = new RegExp(`[A-Za-z]:[/\\\\]Users[/\\\\]${sourceComputer.username}[/\\\\]`, 'i');
			relativePath = path.replace(winPattern, '').replace(/\\/g, '/');
		}

		if (currentComputer.platform === 'darwin') {
			return `/Users/${currentComputer.username}/${relativePath}`;
		} else {
			return `C:/Users/${currentComputer.username}/${relativePath}`;
		}
	}

	private findMatchingComputer(path: string): ComputerProfile | null {
		for (const computer of this.settings.computers) {
			if (computer.platform === 'darwin') {
				if (path.includes(`/Users/${computer.username}/`)) {
					return computer;
				}
			} else if (computer.platform === 'win32') {
				const winPattern = new RegExp(`[A-Za-z]:[/\\\\]Users[/\\\\]${computer.username}[/\\\\]`, 'i');
				if (winPattern.test(path)) {
					return computer;
				}
			}
		}
		return null;
	}

	private detectCurrentUsername(): string {
		const adapter = this.app.vault.adapter as { basePath?: string };
		const vaultPath = adapter.basePath || '';
		const platform = String(process.platform);

		if (platform === 'darwin') {
			const match = vaultPath.match(/^\/Users\/([^/]+)/);
			if (match) return match[1];
		} else if (platform === 'win32') {
			const match = vaultPath.match(/^[A-Za-z]:[/\\]Users[/\\]([^/\\]+)/i);
			if (match) return match[1];
		}

		return '';
	}

	private buildMetadataLine(item: EagleItem): string {
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		const tags = item.tags
			.filter(t => !t.startsWith('r2:') && t !== 'r2-cloud' && t !== 'cloud-upload')
			.map(t => `#${this.normalizeTag(t)}`)
			.join(' ');
		const dimensions = item.width && item.height ? `${item.width}×${item.height}` : '';

		return `> **${item.ext.toUpperCase()}** | ${this.formatFileSize(item.size)}${dimensions ? ` | ${dimensions}` : ''} | ${tags || 'No tags'} | [Eagle](${linkUrl})`;
	}

	private buildLinkCard(item: EagleItem): string {
		const linkUrl = buildEagleItemUrl(item.id, this.settings.eagleItemLinkFormat, this.settings.eagleApiBaseUrl);
		const tags = item.tags.map(t => `#${this.normalizeTag(t)}`).join(' ');
		const dimensions = item.width && item.height ? `${item.width}×${item.height}` : 'N/A';
		
		return `> [!cmdspace-eagle] ${item.name}
> 
> | Property | Value |
> |----------|-------|
> | **Type** | ${item.ext.toUpperCase()} |
> | **Size** | ${this.formatFileSize(item.size)} |
> | **Dimensions** | ${dimensions} |
> | **Tags** | ${tags || 'None'} |
> ${item.annotation ? `> **Annotation**: ${item.annotation}\n` : ''}
> [Open in Eagle](${linkUrl})

`;
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

export interface EagleFolderPickerResult {
	folderId?: string;
	folderName?: string;
	cancelled: boolean;
}

export class EagleFolderPickerModal extends FuzzySuggestModal<EagleFolderPickerItem> {
	private items: EagleFolderPickerItem[];
	private onSelect: (result: EagleFolderPickerResult) => void;
	private resolved = false;

	constructor(
		app: App,
		items: EagleFolderPickerItem[],
		onSelect: (result: EagleFolderPickerResult) => void
	) {
		super(app);
		this.items = items;
		this.onSelect = onSelect;
		this.setPlaceholder('Select Eagle folder... (Esc to cancel)');
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to select folder' },
			{ command: 'esc', purpose: 'to cancel upload' },
		]);
	}

	getItems(): EagleFolderPickerItem[] {
		return this.items;
	}

	getItemText(item: EagleFolderPickerItem): string {
		return `${item.name} ${item.path}`;
	}

	selectSuggestion(value: FuzzyMatch<EagleFolderPickerItem>, evt: MouseEvent | KeyboardEvent): void {
		this.resolved = true;
		super.selectSuggestion(value, evt);
	}

	onChooseItem(item: EagleFolderPickerItem, _evt: MouseEvent | KeyboardEvent): void {
		this.resolved = true;
		if (item.type === 'root') {
			this.onSelect({ folderId: undefined, folderName: 'Library Root', cancelled: false });
		} else {
			this.onSelect({ folderId: item.id, folderName: item.path, cancelled: false });
		}
	}

	renderSuggestion(match: FuzzyMatch<EagleFolderPickerItem>, el: HTMLElement): void {
		const item = match.item;
		const container = el.createDiv({ cls: 'cmdspace-eagle-picker-item' });

		const iconEl = container.createDiv({ cls: 'cmdspace-eagle-picker-icon' });
		if (item.type === 'root') {
			iconEl.setText('📚');
		} else if (item.type === 'recent') {
			iconEl.setText('🕒');
		} else {
			iconEl.setText('📁');
		}

		const infoEl = container.createDiv({ cls: 'cmdspace-eagle-picker-info' });
		const nameRow = infoEl.createDiv({ cls: 'cmdspace-eagle-picker-name' });
		nameRow.createSpan({ text: item.name });

		if (item.type === 'recent') {
			nameRow.createSpan({ cls: 'cmdspace-eagle-badge cmdspace-eagle-badge-recent', text: 'Recent' });
		} else if (item.type === 'root') {
			nameRow.createSpan({ cls: 'cmdspace-eagle-badge cmdspace-eagle-badge-root', text: 'Root' });
		}

		if (item.type !== 'root' && item.path !== item.name) {
			infoEl.createDiv({ cls: 'cmdspace-eagle-picker-path', text: item.path });
		}
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
		recentFolderIds: string[] = []
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

		const items: EagleFolderPickerItem[] = [
			{
				type: 'root',
				name: 'Library Root (Uncategorized)',
				path: 'Library Root',
			},
		];

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

		for (const id of combinedRecentIds) {
			const f = folderMap.get(id);
			if (f) {
				items.push({
					type: 'recent',
					id: f.id,
					name: f.name,
					path: f.path,
				});
			}
		}

		for (const f of flattened) {
			items.push({
				type: 'folder',
				id: f.id,
				name: f.name,
				path: f.path,
			});
		}

		return new Promise<EagleFolderPickerResult>((resolve) => {
			const modal = new EagleFolderPickerModal(app, items, (result) => {
				resolve(result);
			});
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

export interface ImagePasteChoiceResponse {
	choice: 'eagle' | 'local' | 'cloud' | 'cancel';
	rememberChoice: boolean;
}

export class ImagePasteChoiceModal extends Modal {
	private response: Partial<ImagePasteChoiceResponse> = { rememberChoice: false };
	private resolvePromise?: (value: ImagePasteChoiceResponse) => void;
	private cloudProviderName: string;

	constructor(app: App, cloudProviderName: string = 'Cloud') {
		super(app);
		this.cloudProviderName = cloudProviderName;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('cmdspace-paste-choice-modal');

		contentEl.createEl('h2', { text: 'Where to save image?' });

		const buttonContainer = contentEl.createDiv({ cls: 'cmdspace-paste-buttons' });

		const eagleBtn = buttonContainer.createEl('button', { 
			text: 'Eagle (Local)',
			cls: 'mod-cta'
		});
		eagleBtn.addEventListener('click', () => {
			this.response.choice = 'eagle';
			this.close();
		});

		const localBtn = buttonContainer.createEl('button', { text: 'Vault (Local)' });
		localBtn.addEventListener('click', () => {
			this.response.choice = 'local';
			this.close();
		});

		const cloudBtn = buttonContainer.createEl('button', { 
			text: `${this.cloudProviderName} (Cloud)`,
			cls: 'mod-warning'
		});
		cloudBtn.addEventListener('click', () => {
			this.response.choice = 'cloud';
			this.close();
		});

		new Setting(contentEl)
			.setName('Remember this choice')
			.setDesc('You can change this later in plugin settings')
			.addToggle((toggle) => {
				toggle.setValue(false).onChange((value) => {
					this.response.rememberChoice = value;
				});
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

	getResponse(): Promise<ImagePasteChoiceResponse> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}
}

export interface EagleLinkChoiceResponse {
	choice: 'embed' | 'inline' | 'cancel';
	useThumbnail: boolean;
	rememberChoice: boolean;
}

export class EagleLinkChoiceModal extends Modal {
	private item: EagleItem;
	private response: EagleLinkChoiceResponse = {
		choice: 'embed',
		useThumbnail: false,
		rememberChoice: false,
	};
	private resolvePromise?: (value: EagleLinkChoiceResponse) => void;
	private thumbnailSettingEl: HTMLElement | null = null;

	constructor(app: App, item: EagleItem) {
		super(app);
		this.item = item;
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

		const hasThumbnail = this.item.noThumbnail === false;

		if (hasThumbnail) {
			const thumbnailSetting = new Setting(optionsContainer)
				.setName('Embed thumbnail')
				.setDesc('Embed the thumbnail image instead of the original asset')
				.addToggle((toggle) => {
					toggle.setValue(this.response.useThumbnail).onChange((value) => {
						this.response.useThumbnail = value;
					});
				});
			this.thumbnailSettingEl = thumbnailSetting.settingEl;
		}

		const updateUI = (mode: 'embed' | 'inline') => {
			this.response.choice = mode;
			if (mode === 'embed') {
				embedBtn.addClass('mod-cta');
				inlineBtn.removeClass('mod-cta');
				if (this.thumbnailSettingEl) {
					this.thumbnailSettingEl.style.display = '';
				}
			} else {
				embedBtn.removeClass('mod-cta');
				inlineBtn.addClass('mod-cta');
				if (this.thumbnailSettingEl) {
					this.thumbnailSettingEl.style.display = 'none';
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

