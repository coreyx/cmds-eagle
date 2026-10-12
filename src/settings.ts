import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import CMDSPACELinkEagle from './main';
import { EagleApiService } from './api';
import { WebDAVProvider, isCloudProviderConfigured } from './cloud-providers';
import { 
	CloudProviderType, 
	ImagePasteBehavior,
	BacklinkMode,
	EagleLinkPasteMode,
	EagleEmbedUrlMode,
	EagleItemLinkFormat,
	ImageSourceUrlPriority,
	ExtraLinksImageSource,
	MetadataCardImageSource,
	EagleAddFolderMode,
	EagleFolderMapping,
	SearchScope,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
	SUPPORTED_DOCUMENT_EXTENSIONS,
	ComputerProfile,
	PlatformType,
} from './types';

type SettingsTabId = 'connections' | 'cloud' | 'adding' | 'embedding' | 'extras';

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; description: string }> = [
	{ id: 'connections', label: 'Connections', description: 'How Eagle Bridge reaches Eagle and its Extra Links plugin.' },
	{ id: 'cloud', label: 'Cloud storage', description: 'Where image copies are uploaded so they display on your other devices.' },
	{ id: 'adding', label: 'Adding images', description: 'What happens when you paste or drop a new image into a note.' },
	{ id: 'embedding', label: 'Embedding', description: 'How images that are in Eagle appear in your notes.' },
	{ id: 'extras', label: 'Extras', description: 'Excalidraw support, and using one vault on several computers.' },
];

export class CMDSPACEEagleSettingTab extends PluginSettingTab {
	plugin: CMDSPACELinkEagle;
	private activeTab: SettingsTabId = 'connections';

	constructor(app: App, plugin: CMDSPACELinkEagle) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		// Many settings re-render the page to show or hide dependent options; keep the scroll position
		const scrollTop = containerEl.scrollTop;
		containerEl.empty();

		this.renderTabBar(containerEl);

		switch (this.activeTab) {
			case 'connections':
				this.renderEagleConnectionSection(containerEl);
				this.renderExtraLinksSettings(containerEl);
				break;
			case 'cloud':
				this.renderCloudSection(containerEl);
				break;
			case 'adding':
				this.renderPasteDestinationSection(containerEl);
				this.renderEagleFolderSection(containerEl);
				this.renderEagleTagsSection(containerEl);
				this.renderSourceCaptureSection(containerEl);
				this.renderBacklinksSection(containerEl);
				break;
			case 'embedding':
				this.renderImageLinksSection(containerEl);
				this.renderMetadataCardSection(containerEl);
				this.renderSearchSection(containerEl);
				break;
			case 'extras':
				this.renderExcalidrawSection(containerEl);
				this.renderCrossPlatformSection(containerEl);
				break;
		}

		this.renderFooter(containerEl);
		containerEl.scrollTop = scrollTop;
	}

	private renderTabBar(containerEl: HTMLElement): void {
		const tabBar = containerEl.createDiv({ cls: 'cmdspace-eagle-settings-tabs' });
		for (const tab of SETTINGS_TABS) {
			const tabBtn = tabBar.createEl('button', {
				text: tab.label,
				cls: `cmdspace-eagle-settings-tab-btn ${tab.id === this.activeTab ? 'is-active' : ''}`,
			});
			tabBtn.addEventListener('click', () => {
				if (tab.id === this.activeTab) return;
				this.activeTab = tab.id;
				this.display();
				containerEl.scrollTop = 0;
			});
		}

		const activeTab = SETTINGS_TABS.find(tab => tab.id === this.activeTab);
		if (activeTab) {
			containerEl.createEl('p', {
				text: activeTab.description,
				cls: 'setting-item-description cmdspace-eagle-settings-tab-desc',
			});
		}
	}

	private renderEagleConnectionSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Eagle app').setHeading();

		new Setting(containerEl)
			.setName('Eagle API base URL')
			.setDesc('Address of Eagle\'s local API (default: http://localhost:41595)')
			.addText(text => text
				.setPlaceholder('http://localhost:41595')
				.setValue(this.plugin.settings.eagleApiBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.eagleApiBaseUrl = value || 'http://localhost:41595';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Connection timeout')
			.setDesc('How long to wait for Eagle to answer, in milliseconds')
			.addText(text => text
				.setPlaceholder('5000')
				.setValue(this.plugin.settings.connectionTimeout.toString())
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.connectionTimeout = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Check that Eagle is running and reachable')
			.addButton(button => button
				.setButtonText('Test')
				.onClick(async () => {
					const api = new EagleApiService(this.plugin.settings);
					const info = await api.getApplicationInfo();
					if (info) {
						new Notice(`✓ Connected to Eagle ${info.version} (${info.platform})`);
					} else {
						new Notice('✗ Failed to connect to Eagle. Make sure Eagle is running.');
					}
				}));

	}

	private renderPasteDestinationSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Destination').setHeading();

		new Setting(containerEl)
			.setName('When pasting or dropping an image')
			.setDesc('Where a new image is saved. "Ask every time" shows the choices with a description of what each one does.')
			.addDropdown(dropdown => dropdown
				.addOption('ask', 'Ask every time')
				.addOption('eagle', 'Save to Eagle')
				.addOption('local', 'Save to vault')
				.addOption('cloud', 'Upload to cloud only')
				.setValue(this.plugin.settings.imagePasteBehavior)
				.onChange(async (value: ImagePasteBehavior) => {
					this.plugin.settings.imagePasteBehavior = value;
					await this.plugin.saveSettings();
				}));

	}

	private renderSourceCaptureSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Image source').setHeading();

		new Setting(containerEl)
			.setName('Capture where an image came from')
			.setDesc('When you paste or drop an image from a web browser, record the page and image URLs it came from and pass them to Eagle.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableImageSourceUrl)
				.onChange(async (value) => {
					this.plugin.settings.enableImageSourceUrl = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableImageSourceUrl) {
			new Setting(containerEl)
				.setName('URL saved as the Eagle website')
				.setDesc('Which captured URL goes into the item\'s website field in Eagle.')
				.addDropdown(dropdown => dropdown
					.addOption('page-first', 'Webpage URL (fallback to image URL)')
					.addOption('image-first', 'Direct image URL (fallback to webpage URL)')
					.addOption('page-only', 'Webpage URL only')
					.addOption('image-only', 'Direct image URL only')
					.setValue(this.plugin.settings.imageSourceUrlPriority)
					.onChange(async (value: ImageSourceUrlPriority) => {
						this.plugin.settings.imageSourceUrlPriority = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Save source links to Extra Links')
				.setDesc('Also list the captured URLs in the item\'s Extra Links panel in Eagle.'
					+ (this.plugin.settings.enableExtraLinks ? '' : ' Eagle Extra Links is turned off (Connections tab), so nothing is saved.'))
				.addDropdown(dropdown => dropdown
					.addOption('none', 'None')
					.addOption('page', 'Page URL')
					.addOption('image', 'Image URL')
					.addOption('both', 'Page URL and image URL')
					.setValue(this.plugin.settings.extraLinksImageSource)
					.onChange(async (value: ExtraLinksImageSource) => {
						this.plugin.settings.extraLinksImageSource = value;
						await this.plugin.saveSettings();
					}));

		}
	}

	private renderImageLinksSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Image links').setHeading();

		new Setting(containerEl)
			.setName('Link embedded images to')
			.setDesc('What an embedded Eagle image points to. Cloud copy uploads a copy to your cloud provider so the image displays on your other devices. Custom URL prefix links into the Eagle library through your own web server. Local file path only works on this computer.')
			.addDropdown(dropdown => dropdown
				.addOption('cloud', 'Cloud copy')
				.addOption('custom-url', 'Custom URL prefix')
				.addOption('file', 'Local file path')
				.setValue(this.plugin.settings.eagleEmbedUrlMode)
				.onChange(async (value: EagleEmbedUrlMode) => {
					this.plugin.settings.eagleEmbedUrlMode = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.eagleEmbedUrlMode === 'cloud') {
			const activeProvider = this.plugin.settings.cloudProviders[this.plugin.settings.activeCloudProvider];
			if (!activeProvider || !isCloudProviderConfigured(activeProvider)) {
				containerEl.createEl('p', {
					text: 'No cloud provider is set up yet, so embeds link to the local file. Set one up in the Cloud storage tab.',
					cls: 'setting-item-description cmdspace-eagle-setting-required',
				});
			}
		}

		if (this.plugin.settings.eagleEmbedUrlMode === 'custom-url') {
			new Setting(containerEl)
				.setName('Custom URL prefix')
				.setDesc('Address of the web or WebDAV server that serves your Eagle library folder (e.g. https://localhost:8080)')
				.addText(text => text
					.setPlaceholder('https://localhost:8080')
					.setValue(this.plugin.settings.eagleCustomUrlPrefix)
					.onChange(async (value) => {
						this.plugin.settings.eagleCustomUrlPrefix = value.trim() || 'https://localhost:8080';
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName('When pasting an Eagle item')
			.setDesc('What to insert when you paste an Eagle item link, or an image copied inside Eagle.')
			.addDropdown(dropdown => dropdown
				.addOption('ask', 'Ask every time')
				.addOption('embed', 'Embed the image')
				.addOption('inline', 'Insert a link')
				.setValue(this.plugin.settings.eagleLinkPasteMode)
				.onChange(async (value: EagleLinkPasteMode) => {
					this.plugin.settings.eagleLinkPasteMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('"Open in Eagle" link format')
			.setDesc('Format of links that open an item in Eagle, used in metadata cards and inserted links.')
			.addDropdown(dropdown => dropdown
				.addOption('http', 'HTTP (http://localhost:41595/item?id=…)')
				.addOption('eagle', 'Eagle protocol (eagle://item/…)')
				.setValue(this.plugin.settings.eagleItemLinkFormat)
				.onChange(async (value: EagleItemLinkFormat) => {
					this.plugin.settings.eagleItemLinkFormat = value;
					await this.plugin.saveSettings();
				}));
	}

	private renderMetadataCardSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Metadata card').setHeading();

		new Setting(containerEl)
			.setName('Include metadata card')
			.setDesc('Add a short card below each embedded image with its type, size, dimensions, tags and links. Images uploaded straight to the cloud have no tags or Eagle link.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.insertThumbnail)
				.onChange(async (value) => {
					this.plugin.settings.insertThumbnail = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (!this.plugin.settings.insertThumbnail) return;

		new Setting(containerEl)
			.setName('Source links in the card')
			.setDesc('Link back to where the image came from: the web page, the image file on that page, or both.')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None')
				.addOption('page', 'Page URL')
				.addOption('image', 'Image URL')
				.addOption('both', 'Page URL and image URL')
				.setValue(this.plugin.settings.includeSourceInMetadataCard)
				.onChange(async (value: MetadataCardImageSource) => {
					this.plugin.settings.includeSourceInMetadataCard = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Local file link in the card')
			.setDesc('For images dragged or pasted from File Explorer or Finder, link to the original file on this computer.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeLocalSourceInMetadataCard)
				.onChange(async (value) => {
					this.plugin.settings.includeLocalSourceInMetadataCard = value;
					await this.plugin.saveSettings();
				}));
	}

	private renderEagleFolderSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Eagle folder').setHeading();

		new Setting(containerEl)
			.setName('When adding an item to Eagle')
			.setDesc('Which folder in your Eagle library new images go into.')
			.addDropdown(dropdown => dropdown
				.addOption('ask', 'Ask')
				.addOption('target', 'Add to Target Folder')
				.addOption('mirror', 'Mirror Obsidian Folder Hierarchy')
				.addOption('map', 'Use Folder Map')
				.setValue(this.plugin.settings.addFolderMode || (this.plugin.settings.enableDefaultFolder ? 'target' : 'target'))
				.onChange(async (value: EagleAddFolderMode) => {
					this.plugin.settings.addFolderMode = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.addFolderMode === 'target') {
			new Setting(containerEl)
				.setName('Target folder')
				.setDesc(this.plugin.settings.defaultFolderName || 'No folder selected (Root library)')
				.addButton(button => button
					.setButtonText('Select Folder')
					.onClick(async () => {
						const api = new EagleApiService(this.plugin.settings);
						const folders = await api.listFolders();
						
						if (!folders || folders.length === 0) {
							new Notice('No folders found or Eagle is not connected.');
							return;
						}

						const { flattenEagleFolders, EagleFolderModal } = await import('./modals');
						const flattened = flattenEagleFolders(folders);

						const modal = new EagleFolderModal(this.app, flattened, async (folderId) => {
							const selected = flattened.find(f => f.id === folderId);
							if (selected) {
								this.plugin.settings.defaultFolder = selected.id;
								this.plugin.settings.defaultFolderName = selected.path;
								await this.plugin.saveSettings();
								this.display();
							}
						});
						modal.open();
					}))
				.addButton(button => button
					.setButtonText('Clear')
					.onClick(async () => {
						this.plugin.settings.defaultFolder = '';
						this.plugin.settings.defaultFolderName = '';
						await this.plugin.saveSettings();
						this.display();
					}));
		} else if (this.plugin.settings.addFolderMode === 'ask') {
			const recentCount = (this.plugin.settings.recentEagleFolders || []).length;
			const desc = recentCount > 0
				? `Prompts you with a searchable folder picker before each upload, featuring ${recentCount} recently used folder(s).`
				: 'Prompts you with a searchable folder picker before each upload, featuring your recently used folders.';

			const askSetting = new Setting(containerEl)
				.setName('Folder prompt')
				.setDesc(desc);

			if (recentCount > 0) {
				askSetting.addButton(button => button
					.setButtonText('Clear Recent History')
					.onClick(async () => {
						this.plugin.settings.recentEagleFolders = [];
						await this.plugin.saveSettings();
						new Notice('Recent Eagle folders cleared.');
						this.display();
					}));
			}
			this.renderMirrorRootFolderSettings(containerEl, true);
		} else if (this.plugin.settings.addFolderMode === 'mirror') {
			new Setting(containerEl)
				.setName('Folder hierarchy mirroring')
				.setDesc('Automatically creates and mirrors the active note’s folder hierarchy inside Eagle relative to the vault and library roots. If the note is at the vault root, attachments are placed in the root library.');
			this.renderMirrorRootFolderSettings(containerEl, false);
		} else if (this.plugin.settings.addFolderMode === 'map') {
			new Setting(containerEl)
				.setName('Folder mappings')
				.setDesc('Map Obsidian vault folders to corresponding Eagle folders. Subfolders automatically inherit their parent folder mapping unless specifically mapped.')
				.addButton(button => button
					.setButtonText('Add Folder Mapping')
					.setCta()
					.onClick(async () => {
						const api = new EagleApiService(this.plugin.settings);
						const connected = await api.isConnected();
						if (!connected) {
							new Notice('Eagle is not running. Please start Eagle and try again.');
							return;
						}
						const { AddFolderMappingModal } = await import('./modals');
						const modal = new AddFolderMappingModal(this.app, api, async (newMapping) => {
							this.plugin.settings.folderMappings = this.plugin.settings.folderMappings || [];
							const existingIndex = this.plugin.settings.folderMappings.findIndex(
								m => m.obsidianFolder.toLowerCase() === newMapping.obsidianFolder.toLowerCase()
							);
							if (existingIndex >= 0) {
								this.plugin.settings.folderMappings[existingIndex] = newMapping;
							} else {
								this.plugin.settings.folderMappings.push(newMapping);
							}
							await this.plugin.saveSettings();
							this.display();
						});
						modal.open();
					}));

			const mappings = this.plugin.settings.folderMappings || [];
			if (mappings.length > 0) {
				const listEl = containerEl.createDiv({ cls: 'cmdspace-eagle-mapping-list' });
				for (const mapping of mappings) {
					const rowEl = listEl.createDiv({ cls: 'cmdspace-eagle-mapping-row' });
					const pathsEl = rowEl.createDiv({ cls: 'cmdspace-eagle-mapping-paths' });
					pathsEl.createSpan({ cls: 'cmdspace-eagle-mapping-vault', text: mapping.obsidianFolder || '/' });
					pathsEl.createSpan({ cls: 'cmdspace-eagle-mapping-arrow', text: ' ➔ ' });
					pathsEl.createSpan({ cls: 'cmdspace-eagle-mapping-eagle', text: mapping.eagleFolderName || mapping.eagleFolderId });

					const btn = rowEl.createEl('button', { text: 'Delete', cls: 'mod-warning' });
					btn.onclick = async () => {
						this.plugin.settings.folderMappings = (this.plugin.settings.folderMappings || []).filter(m => m.id !== mapping.id);
						await this.plugin.saveSettings();
						this.display();
					};
				}
			} else {
				const emptyEl = containerEl.createDiv({ cls: 'cmdspace-eagle-mapping-empty' });
				emptyEl.createEl('p', { text: 'No folder mappings configured yet. Click "Add Folder Mapping" to create one.', cls: 'cmds-eagle-muted' });
			}
		}

	}

	private renderEagleTagsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Eagle tags').setHeading();

		new Setting(containerEl)
			.setName('Add default tags')
			.setDesc('Tag every image you paste or drop into Eagle with the tags below.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDefaultTags)
				.onChange(async (value) => {
					this.plugin.settings.enableDefaultTags = value;
					await this.plugin.saveSettings();
					this.display(); // re-render to show/hide the tags input
				}));

		if (this.plugin.settings.enableDefaultTags) {
			new Setting(containerEl)
				.setName('Default tags')
				.setDesc('Comma-separated list of tags to add (e.g. obsidian, reference)')
				.addText(text => text
					.setPlaceholder('obsidian, reference')
					.setValue(this.plugin.settings.defaultTags)
					.onChange(async (value) => {
						this.plugin.settings.defaultTags = value;
						await this.plugin.saveSettings();
					}));
		}

	}

	private renderBacklinksSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Backlinks to your notes').setHeading();

		new Setting(containerEl)
			.setName('Add a backlink to the note')
			.setDesc('When an image is added to Eagle or an Eagle item is pasted, save a link on the item that opens the note it was used in. Uses the Advanced URI plugin.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBacklinks)
				.onChange(async (value) => {
					this.plugin.settings.enableBacklinks = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableBacklinks) {
			new Setting(containerEl)
				.setName('Note ID property')
				.setDesc('Frontmatter property that identifies the note, so the link survives renames. Must match the "UID field" setting in Advanced URI. Created on the note if missing. Defaults to "id".')
				.addText(text => text
					.setPlaceholder('id')
					.setValue(this.plugin.settings.frontmatterIdField)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterIdField = value.trim() || 'id';
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Save backlinks to')
				.setDesc('Extra Links keeps backlinks in their own panel in Eagle. Eagle\'s own fields puts them in the item\'s website or notes field instead.')
				.addDropdown(dropdown => dropdown
					.addOption('extra-links', 'Eagle Extra Links')
					.addOption('legacy', 'Eagle\'s own fields')
					.setValue(this.plugin.settings.backlinkMode)
					.onChange(async (value: BacklinkMode) => {
						this.plugin.settings.backlinkMode = value;
						await this.plugin.saveSettings();
						this.display();
					}));

			if (this.plugin.settings.backlinkMode === 'extra-links') {
				if (!this.plugin.settings.enableExtraLinks) {
					const pausedEl = containerEl.createEl('p', {
						text: 'Eagle Extra Links is turned off, so no backlinks are being saved. Turn it on in the Connections tab, or save backlinks to Eagle\'s own fields.',
						cls: 'setting-item-description cmdspace-eagle-setting-required',
					});
					pausedEl.style.marginTop = '0';
				}
			} else {
				new Setting(containerEl)
					.setName('Eagle field')
					.setDesc('Which of the item\'s fields in Eagle receives the backlink.')
					.addDropdown(dropdown => dropdown
						.addOption('url', 'Website (URL)')
						.addOption('note', 'Notes')
						.addOption('both', 'Both')
						.setValue(this.plugin.settings.backlinkDestination)
						.onChange(async (value: 'url' | 'note' | 'both') => {
							this.plugin.settings.backlinkDestination = value;
							await this.plugin.saveSettings();
						}));
			}
		}

	}

	private renderExcalidrawSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Excalidraw').setHeading();

		new Setting(containerEl)
			.setName('Embed images in Excalidraw via cloud')
			.setDesc('When you paste or drop an image onto an Excalidraw canvas, upload it to your cloud provider and embed the URL instead of saving a vault attachment. Eagle assets are resolved to the original; screenshots are uploaded as-is. Requires the Excalidraw plugin and a configured cloud provider.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.excalidrawIntegration)
				.onChange(async (value) => {
					this.plugin.settings.excalidrawIntegration = value;
					await this.plugin.saveSettings();
					// Attach to any open canvases now; disabling takes effect immediately
					// because the paste/drop handlers no-op when the setting is off.
					if (value) this.plugin.scanAndAttachExcalidrawContainers();
				}));

		new Setting(containerEl)
			.setName('Also add pasted screenshots to Eagle')
			.setDesc('When pasting a clipboard image (not already in Eagle) onto a canvas, also import it into your Eagle library (into the default folder, if set).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.excalidrawImportToEagle)
				.onChange(async (value) => {
					this.plugin.settings.excalidrawImportToEagle = value;
					await this.plugin.saveSettings();
				}));

	}

	private renderSearchSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Search')
			.setDesc('Defaults for the "Search Eagle library and embed" command. You can still change them in the search window.')
			.setHeading();

		this.renderSearchFiltersSettings(containerEl);
	}

	private renderCloudSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Provider').setHeading();

		new Setting(containerEl)
			.setName('Cloud provider')
			.setDesc('The service images are uploaded to. Only the selected provider is used; its settings appear below.')
			.addDropdown(dropdown => dropdown
				.addOption('r2', 'Cloudflare R2')
				.addOption('imghippo', 'ImgHippo (Free)')
				.addOption('s3', 'Amazon S3')
				.addOption('webdav', 'WebDAV (Synology/NAS)')
				.addOption('custom', 'Custom Server')
				.setValue(this.plugin.settings.activeCloudProvider)
				.onChange(async (value: CloudProviderType) => {
					this.plugin.settings.activeCloudProvider = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		this.renderCloudProviderSettings(containerEl);
	}

	private renderCrossPlatformSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Cross-platform paths').setHeading();
		this.renderCrossPlatformSettings(containerEl);
	}

	private renderFooter(containerEl: HTMLElement): void {
		containerEl.createEl('hr', { attr: { style: 'margin: 24px 0; border: none; border-top: 1px solid var(--background-modifier-border);' } });
		
		const footerEl = containerEl.createEl('div', { attr: { style: 'text-align: center; color: var(--text-muted); font-size: 12px;' } });
		footerEl.createEl('div', { text: `Eagle Bridge v${this.plugin.manifest.version}`, attr: { style: 'margin-bottom: 8px;' } });
		
		const linksEl = footerEl.createEl('div');
		linksEl.createSpan({ text: 'Corey Struzan · ' });
		const ghLink = linksEl.createEl('a', { text: 'GitHub', href: 'https://github.com/coreyx/obsidian-eagle-bridge' });
		ghLink.setAttr('target', '_blank');

		const creditEl = footerEl.createEl('div', { attr: { style: 'margin-top: 4px;' } });
		creditEl.createSpan({ text: 'Based on ' });
		const upstreamLink = creditEl.createEl('a', { text: 'CMDS Eagle', href: 'https://github.com/johnfkoo951/cmds-eagle' });
		upstreamLink.setAttr('target', '_blank');
		creditEl.createSpan({ text: ' by Yohan Koo' });
	}

	private renderCloudProviderSettings(containerEl: HTMLElement): void {
		const provider = this.plugin.settings.activeCloudProvider;
		const providerContainer = containerEl.createDiv({ cls: 'cloud-provider-settings' });

		switch (provider) {
			case 'imghippo':
				this.renderImgHippoSettings(providerContainer);
				break;
			case 'r2':
				this.renderR2Settings(providerContainer);
				break;
			case 's3':
				this.renderS3Settings(providerContainer);
				break;
			case 'webdav':
				this.renderWebDAVSettings(providerContainer);
				break;
			case 'custom':
				this.renderCustomSettings(providerContainer);
				break;
		}
	}

	private renderR2Settings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Cloudflare R2').setHeading();

		const infoEl = containerEl.createEl('div', { cls: 'setting-item-description cmds-eagle-info-block' });
		infoEl.createEl('p', { text: 'Cloudflare R2 requires a Worker for uploads. Setup:' });
		const r2List = infoEl.createEl('ol');
		r2List.createEl('li', { text: 'Create an R2 bucket in Cloudflare dashboard' });
		r2List.createEl('li', { text: 'Deploy the Eagle Cloud Worker (see plugin docs)' });
		r2List.createEl('li', { text: 'Copy Worker URL and API Key below' });

		new Setting(containerEl)
			.setName('Worker URL')
			.setDesc('Cloudflare Worker URL (must end with .workers.dev)')
			.addText(text => text
				.setPlaceholder('https://eagle-uploader.xxx.workers.dev')
				.setValue(this.plugin.settings.cloudProviders.r2.workerUrl)
				.onChange(async (value) => {
					let url = value.trim();
					if (url && !url.startsWith('http')) {
						url = 'https://' + url;
					}
					url = url.replace(/\/$/, '');
					this.plugin.settings.cloudProviders.r2.workerUrl = url;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('API_KEY from Cloudflare Worker Variables')
			.addText(text => text
				.setPlaceholder('your-api-key-here')
				.setValue(this.plugin.settings.cloudProviders.r2.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.r2.apiKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Public URL')
			.setDesc('R2 bucket public URL (starts with pub-)')
			.addText(text => text
				.setPlaceholder('https://pub-xxx.r2.dev')
				.setValue(this.plugin.settings.cloudProviders.r2.publicUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.r2.publicUrl = value.trim().replace(/\/$/, '');
					await this.plugin.saveSettings();
				}));
	}

	private renderImgHippoSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('ImgHippo (free image hosting)').setHeading();

		const infoEl = containerEl.createEl('div', { cls: 'setting-item-description cmds-eagle-info-block' });
		infoEl.createEl('p', { text: 'ImgHippo is a free image hosting service. To get your API key:' });
		const ihList = infoEl.createEl('ol');
		const ihLi1 = ihList.createEl('li');
		ihLi1.appendText('Visit ');
		ihLi1.createEl('a', { text: 'imghippo.com', href: 'https://www.imghippo.com/' });
		ihLi1.appendText(' and sign up/login');
		const ihLi2 = ihList.createEl('li');
		ihLi2.appendText('Go to ');
		ihLi2.createEl('a', { text: 'Settings page', href: 'https://www.imghippo.com/settings' });
		ihList.createEl('li', { text: 'Copy your API key and paste it below' });

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Your ImgHippo API key from the settings page')
			.addText(text => text
				.setPlaceholder('Your ImgHippo API key')
				.setValue(this.plugin.settings.cloudProviders.imghippo.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.imghippo.apiKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Check that an API key has been entered')
			.addButton(button => button
				.setButtonText('Test')
				.onClick(async () => {
					const config = this.plugin.settings.cloudProviders.imghippo;
					if (!config.apiKey) {
						new Notice('✗ Please enter an API key first');
						return;
					}
					new Notice('✓ ImgHippo API key configured');
				}));
	}

	private renderS3Settings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Amazon S3').setHeading();
		
		new Setting(containerEl)
			.setName('Endpoint')
			.setDesc('S3-compatible endpoint URL')
			.addText(text => text
				.setPlaceholder('https://s3.amazonaws.com')
				.setValue(this.plugin.settings.cloudProviders.s3.endpoint)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.s3.endpoint = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Region')
			.addText(text => text
				.setPlaceholder('us-east-1')
				.setValue(this.plugin.settings.cloudProviders.s3.region)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.s3.region = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bucket')
			.addText(text => text
				.setPlaceholder('my-bucket')
				.setValue(this.plugin.settings.cloudProviders.s3.bucket)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.s3.bucket = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Access Key ID')
			.addText(text => text
				.setValue(this.plugin.settings.cloudProviders.s3.accessKeyId)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.s3.accessKeyId = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Secret Access Key')
			.addText(text => text
				.setValue(this.plugin.settings.cloudProviders.s3.secretAccessKey)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.s3.secretAccessKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Public URL (optional)')
			.setDesc('Custom public URL for accessing uploaded files')
			.addText(text => text
				.setPlaceholder('https://cdn.example.com')
				.setValue(this.plugin.settings.cloudProviders.s3.publicUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.s3.publicUrl = value.trim();
					await this.plugin.saveSettings();
				}));
	}

	private renderWebDAVSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('WebDAV').setHeading();
		containerEl.createEl('p', { 
			text: 'Works with Synology NAS, Nextcloud, ownCloud, or any WebDAV server.',
			cls: 'setting-item-description'
		});
		
		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('WebDAV address that uploads are sent to. It requires your login.')
			.addText(text => text
				.setPlaceholder('https://nas.example.com/webdav')
				.setValue(this.plugin.settings.cloudProviders.webdav.serverUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.serverUrl = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Username')
			.addText(text => text
				.setValue(this.plugin.settings.cloudProviders.webdav.username)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.username = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Password')
			.addText(text => {
				text.inputEl.type = 'password';
				text
					.setValue(this.plugin.settings.cloudProviders.webdav.password)
					.onChange(async (value) => {
						this.plugin.settings.cloudProviders.webdav.password = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Upload path')
			.setDesc('Folder under the Server URL that uploads go into. Created if it does not exist.')
			.addText(text => text
				.setPlaceholder('/eagle-uploads')
				.setValue(this.plugin.settings.cloudProviders.webdav.uploadPath)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.uploadPath = value.trim() || '/eagle-uploads';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Public URL')
			.setDesc('Address that notes use to display uploaded files. It must work without a login. A Nextcloud public share link (https://host/s/TOKEN) is converted automatically.')
			.addText(text => text
				.setPlaceholder('https://public.example.com')
				.setValue(this.plugin.settings.cloudProviders.webdav.publicUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.publicUrl = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Disable Nextcloud share link conversion')
			.setDesc('Use the Public URL exactly as entered, even when it looks like a Nextcloud share link (https://host/s/TOKEN).')
			.addToggle(toggle => toggle
				.setValue(!!this.plugin.settings.cloudProviders.webdav.disableShareLinkConversion)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.disableShareLinkConversion = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Check the server login and, for a Nextcloud share, that the Public URL works without a login. Nothing is uploaded.')
			.addButton(button => button
				.setButtonText('Test')
				.onClick(async () => {
					button.setDisabled(true);
					try {
						const provider = new WebDAVProvider(this.plugin.settings.cloudProviders.webdav);
						const result = await provider.checkConnection();
						new Notice(`${result.ok ? '✓' : '✗'} ${result.message}`, 8000);
					} finally {
						button.setDisabled(false);
					}
				}));
	}

	private renderCustomSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Custom server').setHeading();
		containerEl.createEl('p', { 
			text: 'Configure a custom upload endpoint. Server should accept multipart/form-data with "file" field.',
			cls: 'setting-item-description'
		});
		
		new Setting(containerEl)
			.setName('Upload URL')
			.addText(text => text
				.setPlaceholder('https://your-server.com/upload')
				.setValue(this.plugin.settings.cloudProviders.custom.uploadUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.custom.uploadUrl = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Public URL')
			.setDesc('Base URL for accessing uploaded files')
			.addText(text => text
				.setPlaceholder('https://cdn.your-server.com')
				.setValue(this.plugin.settings.cloudProviders.custom.publicUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.custom.publicUrl = value.trim();
					await this.plugin.saveSettings();
				}));
	}

	private renderSearchFiltersSettings(containerEl: HTMLElement): void {
		const filterContainer = containerEl.createDiv({ cls: 'cmdspace-eagle-settings-filters' });
		
		const scopeSection = filterContainer.createDiv({ cls: 'cmdspace-eagle-settings-filter-section' });
		scopeSection.createEl('div', { text: 'Default search scope', cls: 'cmdspace-eagle-settings-filter-title' });
		const scopeButtons = scopeSection.createDiv({ cls: 'cmdspace-eagle-settings-filter-buttons' });
		
		const scopes: { key: SearchScope; label: string }[] = [
			{ key: 'name', label: 'Name' },
			{ key: 'tags', label: 'Tags' },
			{ key: 'annotation', label: 'Notes' },
			{ key: 'folders', label: 'Folders' },
		];
		
		scopes.forEach(({ key, label }) => {
			const btn = scopeButtons.createEl('button', {
				text: label,
				cls: `cmdspace-eagle-settings-filter-btn ${this.plugin.settings.searchScope.includes(key) ? 'is-active' : ''}`
			});
			btn.addEventListener('click', () => { void (async () => {
				if (this.plugin.settings.searchScope.includes(key)) {
					if (this.plugin.settings.searchScope.length > 1) {
						this.plugin.settings.searchScope = this.plugin.settings.searchScope.filter(s => s !== key);
						btn.removeClass('is-active');
					}
				} else {
					this.plugin.settings.searchScope.push(key);
					btn.addClass('is-active');
				}
				await this.plugin.saveSettings();
			})(); });
		});

		const typeSection = filterContainer.createDiv({ cls: 'cmdspace-eagle-settings-filter-section' });
		typeSection.createEl('div', { text: 'Default file types', cls: 'cmdspace-eagle-settings-filter-title' });
		const typeButtons = typeSection.createDiv({ cls: 'cmdspace-eagle-settings-filter-buttons' });
		
		const hasAllImages = () => SUPPORTED_IMAGE_EXTENSIONS.every(ext => 
			this.plugin.settings.searchFileTypes.includes(ext)
		);
		const hasAllVideos = () => SUPPORTED_VIDEO_EXTENSIONS.every(ext => 
			this.plugin.settings.searchFileTypes.includes(ext)
		);
		const hasAllDocs = () => SUPPORTED_DOCUMENT_EXTENSIONS.every(ext => 
			this.plugin.settings.searchFileTypes.includes(ext)
		);

		const imgBtn = typeButtons.createEl('button', {
			text: 'Images',
			cls: `cmdspace-eagle-settings-filter-btn ${hasAllImages() ? 'is-active' : ''}`
		});
		imgBtn.addEventListener('click', () => { void (async () => {
			if (hasAllImages()) {
				this.plugin.settings.searchFileTypes = this.plugin.settings.searchFileTypes.filter(
					ext => !SUPPORTED_IMAGE_EXTENSIONS.includes(ext as typeof SUPPORTED_IMAGE_EXTENSIONS[number])
				);
				imgBtn.removeClass('is-active');
			} else {
				SUPPORTED_IMAGE_EXTENSIONS.forEach(ext => {
					if (!this.plugin.settings.searchFileTypes.includes(ext)) {
						this.plugin.settings.searchFileTypes.push(ext);
					}
				});
				imgBtn.addClass('is-active');
			}
			if (this.plugin.settings.searchFileTypes.length === 0) {
				this.plugin.settings.searchFileTypes = [...SUPPORTED_IMAGE_EXTENSIONS];
				imgBtn.addClass('is-active');
			}
			await this.plugin.saveSettings();
		})(); });

		const vidBtn = typeButtons.createEl('button', {
			text: 'Videos',
			cls: `cmdspace-eagle-settings-filter-btn ${hasAllVideos() ? 'is-active' : ''}`
		});
		vidBtn.addEventListener('click', () => { void (async () => {
			if (hasAllVideos()) {
				this.plugin.settings.searchFileTypes = this.plugin.settings.searchFileTypes.filter(
					ext => !SUPPORTED_VIDEO_EXTENSIONS.includes(ext as typeof SUPPORTED_VIDEO_EXTENSIONS[number])
				);
				vidBtn.removeClass('is-active');
			} else {
				SUPPORTED_VIDEO_EXTENSIONS.forEach(ext => {
					if (!this.plugin.settings.searchFileTypes.includes(ext)) {
						this.plugin.settings.searchFileTypes.push(ext);
					}
				});
				vidBtn.addClass('is-active');
			}
			if (this.plugin.settings.searchFileTypes.length === 0) {
				this.plugin.settings.searchFileTypes = [...SUPPORTED_IMAGE_EXTENSIONS];
				imgBtn.addClass('is-active');
			}
			await this.plugin.saveSettings();
		})(); });

		const docBtn = typeButtons.createEl('button', {
			text: 'Documents',
			cls: `cmdspace-eagle-settings-filter-btn ${hasAllDocs() ? 'is-active' : ''}`
		});
		docBtn.addEventListener('click', () => { void (async () => {
			if (hasAllDocs()) {
				this.plugin.settings.searchFileTypes = this.plugin.settings.searchFileTypes.filter(
					ext => !SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext as typeof SUPPORTED_DOCUMENT_EXTENSIONS[number])
				);
				docBtn.removeClass('is-active');
			} else {
				SUPPORTED_DOCUMENT_EXTENSIONS.forEach(ext => {
					if (!this.plugin.settings.searchFileTypes.includes(ext)) {
						this.plugin.settings.searchFileTypes.push(ext);
					}
				});
				docBtn.addClass('is-active');
			}
			if (this.plugin.settings.searchFileTypes.length === 0) {
				this.plugin.settings.searchFileTypes = [...SUPPORTED_IMAGE_EXTENSIONS];
				imgBtn.addClass('is-active');
			}
			await this.plugin.saveSettings();
		})(); });
	}

	private renderCrossPlatformSettings(containerEl: HTMLElement): void {
		const infoEl = containerEl.createEl('div', { cls: 'setting-item-description cmds-eagle-info-block' });
		infoEl.createEl('p', { text: 'For notes that link to local files (the "Local file path" image link type) in a vault you open on more than one computer.' });
		infoEl.createEl('p', { text: 'Local file links written on one computer are rewritten to match the computer you are on.', cls: 'cmds-eagle-muted' });

		new Setting(containerEl)
			.setName('Convert file paths between computers')
			.setDesc('Rewrite file:// links between the computers registered below')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCrossPlatform)
				.onChange(async (value) => {
					this.plugin.settings.enableCrossPlatform = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (!this.plugin.settings.enableCrossPlatform) {
			return;
		}

		new Setting(containerEl)
			.setName('Convert when a note is opened')
			.setDesc('Convert paths automatically each time you open a note, instead of only when you run the convert command')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoConvertCrossPlatformPaths)
				.onChange(async (value) => {
					this.plugin.settings.autoConvertCrossPlatformPaths = value;
					await this.plugin.saveSettings();
				}));



		const currentPlatform = process.platform as PlatformType;
		const currentUsername = this.detectCurrentUsername();

		new Setting(containerEl)
			.setName('Add current computer')
			.setDesc(`Detected: ${currentPlatform === 'darwin' ? 'macOS' : 'Windows'} / ${currentUsername}`)
			.addButton(button => button
				.setButtonText('Add')
				.onClick(async () => {
					const existingIndex = this.plugin.settings.computers.findIndex(
						c => c.platform === currentPlatform && c.username === currentUsername
					);
					
					if (existingIndex >= 0) {
						new Notice('This computer is already registered');
						return;
					}

					const newProfile: ComputerProfile = {
						id: `${currentPlatform}-${currentUsername}-${Date.now()}`,
						name: currentPlatform === 'darwin' ? `Mac (${currentUsername})` : `Windows (${currentUsername})`,
						platform: currentPlatform,
						username: currentUsername,
						subPath: '',
						eagleLibraryPath: '',
						isCurrentComputer: true,
					};

					this.plugin.settings.computers.push(newProfile);
					await this.plugin.saveSettings();
					this.display();
					new Notice('Current computer added');
				}));

		if (this.plugin.settings.computers.length > 0) {
			const listContainer = containerEl.createDiv({ cls: 'cmdspace-eagle-computer-list' });

			listContainer.createEl('div', {
				text: 'Registered Computers',
				cls: 'cmdspace-eagle-computer-list-title'
			});

			for (const computer of this.plugin.settings.computers) {
				const isCurrentComputer = computer.platform === currentPlatform && computer.username === currentUsername;
				
				const computerEl = listContainer.createDiv({ cls: 'cmdspace-eagle-computer-item' });
				if (isCurrentComputer) {
					computerEl.addClass('is-current');
				}

				const headerRow = computerEl.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; width: 100%;' } });

				const infoDiv = headerRow.createDiv({ attr: { style: 'flex: 1;' } });
				const platformIcon = computer.platform === 'darwin' ? '🍎' : '🪟';
				infoDiv.createEl('div', { 
					text: `${platformIcon} ${computer.name}`,
					attr: { style: 'font-weight: 500;' }
				});
				infoDiv.createEl('div', { 
					text: `${computer.platform === 'darwin' ? 'macOS' : 'Windows'} • ${computer.username}${isCurrentComputer ? ' (current)' : ''}`,
					attr: { style: 'font-size: 12px; color: var(--text-muted);' }
				});

				const deleteBtn = headerRow.createEl('button', { text: '×', cls: 'cmdspace-eagle-computer-delete' });

				const subPathContainer = computerEl.createDiv({ attr: { style: 'margin-top: 8px; width: 100%;' } });
				subPathContainer.createEl('label', { 
					text: 'Sub-path (folders between /Users/name/ and sync folder)',
					attr: { style: 'font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;' }
				});
				const subPathInput = subPathContainer.createEl('input', {
					type: 'text',
					value: computer.subPath || '',
					placeholder: 'e.g., OneDrive or Dropbox/Work',
					attr: { style: 'width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--background-modifier-border);' }
				});
				subPathInput.addEventListener('change', () => { void (async () => {
					const idx = this.plugin.settings.computers.findIndex(c => c.id === computer.id);
					if (idx >= 0) {
						this.plugin.settings.computers[idx].subPath = subPathInput.value.trim();
						await this.plugin.saveSettings();
					}
				})(); });
				deleteBtn.addEventListener('click', () => { void (async () => {
					this.plugin.settings.computers = this.plugin.settings.computers.filter(c => c.id !== computer.id);
					await this.plugin.saveSettings();
					this.display();
					new Notice('Computer removed');
				})(); });
			}
		}
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

		return 'unknown';
	}

	private renderExtraLinksSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Eagle Extra Links').setHeading();

		new Setting(containerEl)
			.setName('Use Eagle Extra Links')
			.setDesc('Save Obsidian backlinks, image source links and cloud copy links to the Extra Links plugin in Eagle. When off, Eagle Bridge never contacts it and those links are not saved.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableExtraLinks)
				.onChange(async (value) => {
					this.plugin.settings.enableExtraLinks = value;
					this.plugin.extraLinksWarningShown = false;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (!this.plugin.settings.enableExtraLinks) return;

		new Setting(containerEl)
			.setName('Extra Links base URL')
			.setDesc('Address of the Extra Links plugin\'s server in Eagle (default: http://127.0.0.1:41598)')
			.addText(text => text
				.setPlaceholder('http://127.0.0.1:41598')
				.setValue(this.plugin.settings.extraLinksBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.extraLinksBaseUrl = value.trim() || 'http://127.0.0.1:41598';
					this.plugin.extraLinksWarningShown = false;
					await this.plugin.saveSettings();
				}));

		const statusSetting = new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Checking for the Extra Links plugin…');

		// Shown inline every time the settings open, so a missing plugin is visible without a click
		const check = async (notify: boolean): Promise<void> => {
			const api = new EagleApiService(this.plugin.settings);
			const health = await api.checkExtraLinks(this.plugin.settings.extraLinksBaseUrl);
			statusSetting.setDesc(`${health.ok ? '✓' : '⚠'} ${health.message}`);
			statusSetting.descEl.toggleClass('cmdspace-eagle-setting-required', !health.ok);
			if (notify) {
				new Notice(`${health.ok ? '✓' : '⚠'} ${health.message}`, 8000);
			}
		};

		statusSetting.addButton(button => button
			.setButtonText('Test')
			.onClick(async () => {
				button.setDisabled(true);
				try {
					await check(true);
				} finally {
					button.setDisabled(false);
				}
			}));

		void check(false);
	}

	private renderMirrorRootFolderSettings(containerEl: HTMLElement, isAskMode: boolean = false): void {
		const toggleDesc = isAskMode
			? 'When using the "Mirror" button in the folder picker, nest the mirrored folder hierarchy under a designated Eagle root folder instead of the library root.'
			: 'Nest the mirrored folder hierarchy under a designated Eagle root folder instead of the library root.';

		new Setting(containerEl)
			.setName('Place mirrored folders under a root folder')
			.setDesc(toggleDesc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableMirrorRootFolder)
				.onChange(async (value) => {
					this.plugin.settings.enableMirrorRootFolder = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableMirrorRootFolder) {
			const isConfigured = !!this.plugin.settings.mirrorRootFolder && !!this.plugin.settings.mirrorRootFolderName;
			const descText = isConfigured
				? this.plugin.settings.mirrorRootFolderName
				: 'No folder selected (Required)';

			const rootSetting = new Setting(containerEl)
				.setName('Mirrored root folder')
				.setDesc(descText);

			if (!isConfigured) {
				rootSetting.descEl.addClass('cmdspace-eagle-setting-required');
			}

			rootSetting
				.addButton(button => button
					.setButtonText('Select Folder')
					.onClick(async () => {
						const api = new EagleApiService(this.plugin.settings);
						const connected = await api.isConnected();
						if (!connected) {
							new Notice('Eagle is not running. Please start Eagle and try again.');
							return;
						}

						const folders = await api.listFolders();
						if (!folders || folders.length === 0) {
							new Notice('No folders found in your Eagle library.');
							return;
						}

						const { flattenEagleFolders, EagleFolderModal } = await import('./modals');
						const flattened = flattenEagleFolders(folders);

						const modal = new EagleFolderModal(this.app, flattened, async (folderId) => {
							const selected = flattened.find(f => f.id === folderId);
							if (selected) {
								this.plugin.settings.mirrorRootFolder = selected.id;
								this.plugin.settings.mirrorRootFolderName = selected.path;
								await this.plugin.saveSettings();
								this.display();
							}
						});
						modal.open();
					}))
				.addButton(button => button
					.setButtonText('Clear')
					.onClick(async () => {
						this.plugin.settings.mirrorRootFolder = '';
						this.plugin.settings.mirrorRootFolderName = '';
						await this.plugin.saveSettings();
						this.display();
					}));
		}
	}
}
