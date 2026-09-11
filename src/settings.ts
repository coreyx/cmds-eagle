import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import CMDSPACELinkEagle from './main';
import { EagleApiService } from './api';
import { 
	CloudProviderType, 
	ImagePasteBehavior,
	BacklinkMode,
	EagleLinkPasteMode,
	EagleEmbedUrlMode,
	EagleItemLinkFormat,
	ImageSourceUrlPriority,
	ExtraLinksImageSource,
	SearchScope,
	SUPPORTED_IMAGE_EXTENSIONS,
	SUPPORTED_VIDEO_EXTENSIONS,
	SUPPORTED_DOCUMENT_EXTENSIONS,
	ComputerProfile,
	PlatformType,
} from './types';

export class CMDSPACEEagleSettingTab extends PluginSettingTab {
	plugin: CMDSPACELinkEagle;

	constructor(app: App, plugin: CMDSPACELinkEagle) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Connection').setHeading();

		new Setting(containerEl)
			.setName('Eagle API Base URL')
			.setDesc('The base URL for Eagle\'s local API (default: http://localhost:41595)')
			.addText(text => text
				.setPlaceholder('http://localhost:41595')
				.setValue(this.plugin.settings.eagleApiBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.eagleApiBaseUrl = value || 'http://localhost:41595';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Connection Timeout')
			.setDesc('Timeout in milliseconds for API requests')
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
			.setName('Test Connection')
			.setDesc('Check if Eagle is running and accessible')
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

		new Setting(containerEl).setName('Image paste/drop behavior').setHeading();

		new Setting(containerEl)
			.setName('Default image behavior')
			.setDesc('What to do when pasting or dropping images')
			.addDropdown(dropdown => dropdown
				.addOption('ask', 'Ask every time')
				.addOption('eagle', 'Always upload to Eagle (local)')
				.addOption('local', 'Always save to vault (local)')
				.addOption('cloud', 'Always upload to cloud')
				.setValue(this.plugin.settings.imagePasteBehavior)
				.onChange(async (value: ImagePasteBehavior) => {
					this.plugin.settings.imagePasteBehavior = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Image source URL capture').setHeading();

		new Setting(containerEl)
			.setName('Capture image source URL on paste')
			.setDesc('When an image copied from a web browser is pasted into Obsidian, automatically extract its origin URL and pass it to Eagle.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableImageSourceUrl)
				.onChange(async (value) => {
					this.plugin.settings.enableImageSourceUrl = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableImageSourceUrl) {
			new Setting(containerEl)
				.setName('Source URL priority (Eagle website field)')
				.setDesc('Choose which URL is pushed to Eagle\'s primary website / origin link field.')
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
				.setName('Add image source to Extra Links')
				.setDesc('Push the captured image source URLs into Eagle\'s Extra Links panel alongside any Obsidian backlinks.')
				.addDropdown(dropdown => dropdown
					.addOption('none', 'None (do not add to Extra Links)')
					.addOption('page', 'Page URL only')
					.addOption('image', 'Image src URL only')
					.addOption('both', 'Both Page URL and Image src')
					.setValue(this.plugin.settings.extraLinksImageSource)
					.onChange(async (value: ExtraLinksImageSource) => {
						this.plugin.settings.extraLinksImageSource = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Include source in metadata card')
				.setDesc('When embedding an image with metadata card enabled, include a clickable markdown link to the captured source URL.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.includeSourceInMetadataCard)
					.onChange(async (value) => {
						this.plugin.settings.includeSourceInMetadataCard = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl).setName('Eagle link paste').setHeading();

		new Setting(containerEl)
			.setName('Eagle link paste behavior')
			.setDesc('What to do when pasting an Eagle item link into a note')
			.addDropdown(dropdown => dropdown
				.addOption('ask', 'Always ask')
				.addOption('embed', 'Embed image')
				.addOption('inline', 'Inline link')
				.setValue(this.plugin.settings.eagleLinkPasteMode)
				.onChange(async (value: EagleLinkPasteMode) => {
					this.plugin.settings.eagleLinkPasteMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Eagle embed URL mode')
			.setDesc('How to reference the Eagle image when embedding')
			.addDropdown(dropdown => dropdown
				.addOption('file', 'Local file path (file://)')
				.addOption('custom-url', 'Custom URL prefix (HTTP / WebDAV)')
				.setValue(this.plugin.settings.eagleEmbedUrlMode)
				.onChange(async (value: EagleEmbedUrlMode) => {
					this.plugin.settings.eagleEmbedUrlMode = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.eagleEmbedUrlMode === 'custom-url') {
			new Setting(containerEl)
				.setName('Custom URL prefix')
				.setDesc('Base URL for serving Eagle library files over HTTP/WebDAV (e.g. https://localhost:8080)')
				.addText(text => text
					.setPlaceholder('https://localhost:8080')
					.setValue(this.plugin.settings.eagleCustomUrlPrefix)
					.onChange(async (value) => {
						this.plugin.settings.eagleCustomUrlPrefix = value.trim() || 'https://localhost:8080';
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl).setName('Eagle target folder').setHeading();

		new Setting(containerEl)
			.setName('Save new attachments to a specific Eagle folder')
			.setDesc('When pasting or dropping images into Eagle, save them to a designated folder instead of the root library.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDefaultFolder)
				.onChange(async (value) => {
					this.plugin.settings.enableDefaultFolder = value;
					await this.plugin.saveSettings();
					this.display(); // re-render to show/hide the folder selection
				}));

		if (this.plugin.settings.enableDefaultFolder) {
			new Setting(containerEl)
				.setName('Target Folder')
				.setDesc(this.plugin.settings.defaultFolderName || 'No folder selected')
				.addButton(button => button
					.setButtonText('Select Folder')
					.onClick(async () => {
						const api = new EagleApiService(this.plugin.settings);
						const folders = await api.listFolders();
						
						if (!folders || folders.length === 0) {
							new Notice('No folders found or Eagle is not connected.');
							return;
						}

						// Flatten the folder hierarchy
						const flattened: { id: string, name: string, path: string }[] = [];
						const flatten = (items: import('./types').EagleFolder[], parentPath = '') => {
							for (const item of items) {
								const currentPath = parentPath ? `${parentPath} / ${item.name}` : item.name;
								flattened.push({ id: item.id, name: item.name, path: currentPath });
								if (item.children && item.children.length > 0) {
									flatten(item.children, currentPath);
								}
							}
						};
						flatten(folders);

						const { EagleFolderModal } = await import('./modals');
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
					}));
		}

		new Setting(containerEl).setName('Eagle tags').setHeading();

		new Setting(containerEl)
			.setName('Add default tags to new Eagle attachments')
			.setDesc('Automatically append specific tags to images you paste or drop into Eagle.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDefaultTags)
				.onChange(async (value) => {
					this.plugin.settings.enableDefaultTags = value;
					await this.plugin.saveSettings();
					this.display(); // re-render to show/hide the tags input
				}));

		if (this.plugin.settings.enableDefaultTags) {
			new Setting(containerEl)
				.setName('Default Tags')
				.setDesc('Comma-separated list of tags to add (e.g. obsidian, reference)')
				.addText(text => text
					.setPlaceholder('obsidian, reference')
					.setValue(this.plugin.settings.defaultTags)
					.onChange(async (value) => {
						this.plugin.settings.defaultTags = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl).setName('Obsidian Backlinks').setHeading();

		new Setting(containerEl)
			.setName('Add Obsidian backlink to Eagle attachments')
			.setDesc('Automatically generate an Advanced URI backlink to the current note when adding or pasting Eagle items.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBacklinks)
				.onChange(async (value) => {
					this.plugin.settings.enableBacklinks = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.enableBacklinks) {
			new Setting(containerEl)
				.setName('UID field in frontmatter')
				.setDesc('Frontmatter property used to identify the note for Advanced URI linking (matches Advanced URI\'s "UID field"). Defaults to "id".')
				.addText(text => text
					.setPlaceholder('id')
					.setValue(this.plugin.settings.frontmatterIdField)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterIdField = value.trim() || 'id';
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Backlink Mode')
				.setDesc('Choose how backlinks are registered with Eagle')
				.addDropdown(dropdown => dropdown
					.addOption('extra-links', 'Eagle Extra Links Plugin (REST API)')
					.addOption('legacy', 'Eagle Native Fields (Website / Note)')
					.setValue(this.plugin.settings.backlinkMode)
					.onChange(async (value: BacklinkMode) => {
						this.plugin.settings.backlinkMode = value;
						await this.plugin.saveSettings();
						this.display();
					}));

			if (this.plugin.settings.backlinkMode === 'extra-links') {
				new Setting(containerEl)
					.setName('Eagle Extra Links Base URL')
					.setDesc('REST endpoint URL for the eagle-extra-links plugin in Eagle')
					.addText(text => text
						.setPlaceholder('http://127.0.0.1:41598')
						.setValue(this.plugin.settings.extraLinksBaseUrl)
						.onChange(async (value) => {
							this.plugin.settings.extraLinksBaseUrl = value.trim() || 'http://127.0.0.1:41598';
							await this.plugin.saveSettings();
						}));
			} else {
				new Setting(containerEl)
					.setName('Backlink Destination')
					.setDesc('Where should the backlink be saved in Eagle?')
					.addDropdown(dropdown => dropdown
						.addOption('url', 'URL/Link Field')
						.addOption('note', 'Note/Annotation Field')
						.addOption('both', 'Both')
						.setValue(this.plugin.settings.backlinkDestination)
						.onChange(async (value: 'url' | 'note' | 'both') => {
							this.plugin.settings.backlinkDestination = value;
							await this.plugin.saveSettings();
						}));
			}
		}

		new Setting(containerEl).setName('Excalidraw integration').setHeading();

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

		new Setting(containerEl).setName('Search & embed').setHeading();

		new Setting(containerEl)
			.setName('Include metadata card')
			.setDesc('Add metadata (type, size, tags, Eagle link) below the image when embedding')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.insertThumbnail)
				.onChange(async (value) => {
					this.plugin.settings.insertThumbnail = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Eagle item link format')
			.setDesc('Choose the link format for opening items in Eagle (used in metadata cards, link cards, and inline links). Default is HTTP localhost URL (e.g. http://localhost:41595/item?id=UUID); "eagle://" protocol remains available.')
			.addDropdown(dropdown => dropdown
				.addOption('http', 'HTTP URL (http://localhost:41595/item?id=UUID)')
				.addOption('eagle', 'Eagle Protocol (eagle://item/UUID)')
				.setValue(this.plugin.settings.eagleItemLinkFormat)
				.onChange(async (value: EagleItemLinkFormat) => {
					this.plugin.settings.eagleItemLinkFormat = value;
					await this.plugin.saveSettings();
				}));

		this.renderSearchFiltersSettings(containerEl);

		new Setting(containerEl).setName('Cloud storage provider').setHeading();

		new Setting(containerEl)
			.setName('Active Cloud Provider')
			.setDesc('Select which cloud storage to use for image uploads')
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

		new Setting(containerEl).setName('Cross-platform sync').setHeading();
		this.renderCrossPlatformSettings(containerEl);

		containerEl.createEl('hr', { attr: { style: 'margin: 24px 0; border: none; border-top: 1px solid var(--background-modifier-border);' } });
		
		const footerEl = containerEl.createEl('div', { attr: { style: 'text-align: center; color: var(--text-muted); font-size: 12px;' } });
		footerEl.createEl('div', { text: `CMDS Eagle v${this.plugin.manifest.version}`, attr: { style: 'margin-bottom: 8px;' } });
		
		const linksEl = footerEl.createEl('div');
		linksEl.createSpan({ text: 'CMDSPACE ' });
		const eduLink = linksEl.createEl('a', { text: 'Education', href: 'https://class.cmdspace.kr/' });
		eduLink.setAttr('target', '_blank');
		linksEl.createSpan({ text: ' · ' });
		const ytLink = linksEl.createEl('a', { text: 'YouTube', href: 'https://www.youtube.com/@cmdspace' });
		ytLink.setAttr('target', '_blank');
		linksEl.createSpan({ text: ' · ' });
		const ghLink = linksEl.createEl('a', { text: 'GitHub', href: 'https://github.com/johnfkoo951/cmds-eagle' });
		ghLink.setAttr('target', '_blank');
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
					this.plugin.settings.cloudProviders.r2.enabled = !!(url && this.plugin.settings.cloudProviders.r2.apiKey);
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
					this.plugin.settings.cloudProviders.r2.enabled = !!(this.plugin.settings.cloudProviders.r2.workerUrl && value.trim());
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
					this.plugin.settings.cloudProviders.imghippo.enabled = !!value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Verify API key is valid')
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
					this.plugin.settings.cloudProviders.s3.enabled = !!(
						this.plugin.settings.cloudProviders.s3.endpoint &&
						this.plugin.settings.cloudProviders.s3.accessKeyId &&
						value.trim()
					);
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
			.addText(text => text
				.setValue(this.plugin.settings.cloudProviders.webdav.password)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.password = value;
					this.plugin.settings.cloudProviders.webdav.enabled = !!(
						this.plugin.settings.cloudProviders.webdav.serverUrl &&
						this.plugin.settings.cloudProviders.webdav.username &&
						value
					);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Upload Path')
			.setDesc('Directory path for uploads')
			.addText(text => text
				.setPlaceholder('/eagle-uploads')
				.setValue(this.plugin.settings.cloudProviders.webdav.uploadPath)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.uploadPath = value.trim() || '/eagle-uploads';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Public URL')
			.setDesc('Public URL prefix for accessing uploaded files')
			.addText(text => text
				.setPlaceholder('https://public.example.com')
				.setValue(this.plugin.settings.cloudProviders.webdav.publicUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudProviders.webdav.publicUrl = value.trim();
					await this.plugin.saveSettings();
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
					this.plugin.settings.cloudProviders.custom.enabled = !!value.trim();
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
		infoEl.createEl('p', { text: 'Enable this to use the same vault on multiple computers (macOS/Windows).' });
		infoEl.createEl('p', { text: 'File paths will be automatically converted based on the current computer.', cls: 'cmds-eagle-muted' });

		new Setting(containerEl)
			.setName('Enable cross-platform path conversion')
			.setDesc('Convert file:// paths between registered computers')
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
			.setName('Auto-convert paths on file open')
			.setDesc('Automatically convert cross-platform paths when opening a note')
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
}
