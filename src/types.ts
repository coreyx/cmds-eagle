export interface EagleApiResponse<T> {
	status: 'success' | 'error';
	data?: T;
	message?: string;
}

export interface EagleItem {
	id: string;
	name: string;
	size: number;
	ext: string;
	tags: string[];
	folders: string[];
	isDeleted: boolean;
	url: string;
	annotation: string;
	modificationTime: number;
	lastModified: number;
	width: number;
	height: number;
	// True when Eagle made no thumbnail (the image is already small); absent otherwise
	noThumbnail?: boolean;
	palettes: EaglePalette[];
	star?: number;
}

export interface EaglePalette {
	color: [number, number, number];
	ratio: number;
}

export interface EagleFolder {
	id: string;
	name: string;
	description: string;
	children: EagleFolder[];
	modificationTime: number;
	tags: string[];
	imageCount: number;
	descendantImageCount: number;
	iconColor?: string;
}

export interface EagleLibraryInfo {
	folders: EagleFolder[];
	smartFolders: EagleSmartFolder[];
	quickAccess: { type: string; id: string }[];
	tagsGroups: EagleTagGroup[];
	modificationTime: number;
	applicationVersion: string;
}

export interface EagleSmartFolder {
	id: string;
	icon: string;
	name: string;
	description?: string;
	conditions: EagleCondition[];
	orderBy?: string;
}

export interface EagleCondition {
	match: 'AND' | 'OR';
	rules: EagleRule[];
}

export interface EagleRule {
	method: string;
	property: string;
	value: unknown;
}

export interface EagleTagGroup {
	id: string;
	name: string;
	tags: string[];
	color?: string;
}

export interface EagleApplicationInfo {
	version: string;
	prereleaseVersion: string | null;
	buildVersion: string;
	execPath: string;
	platform: string;
}

export type ImagePasteBehavior = 'eagle' | 'local' | 'cloud' | 'ask';

export type BacklinkMode = 'extra-links' | 'legacy';

export type EagleLinkPasteMode = 'ask' | 'embed' | 'inline';

// How an item's address under the Custom URL prefix is written: by its ID (the default; it
// survives renames, and needs a server that looks items up, such as Eagle Serve), or by its
// place in the library folder (any web or WebDAV server)
export type EagleCustomUrlFormat = 'item-id' | 'library-path';

export type CanvasNodeType = 'text' | 'link' | 'ask';

export type AiProviderType = 'none' | 'anthropic' | 'openai' | 'gemini' | 'openai-compatible' | 'lmstudio';

// How much a model should think before answering. 'default' sends no setting and leaves it
// to the model; 'none' (offered for local servers) asks it not to think at all.
export type AiEffort = 'default' | 'none' | 'low' | 'medium' | 'high';

// How a new tag is written. 'mix', 'always' and 'never' apply to a library that files tags
// under prefixes; 'custom' copies the form of examples the user typed, whatever the library does
export type AiNewTagFormat = 'mix' | 'always' | 'never' | 'custom';

export interface AiProviderConfig {
	apiKey: string;
	model: string;
	// Only for providers whose address the user sets (OpenAI-compatible, LM Studio)
	baseUrl?: string;
	effort?: AiEffort;
}

export type AiProviderConfigs = Record<Exclude<AiProviderType, 'none'>, AiProviderConfig>;

// A ready-made hint offered in the Templates list beside the AI hints box
export interface AiHintTemplate {
	name: string;
	text: string;
}

export const DEFAULT_AI_HINT_TEMPLATES: AiHintTemplate[] = [
	{ name: 'Subjects', text: 'Tag the main subjects: who or what is shown.' },
	{ name: 'Art style and medium', text: 'Focus on the art style and medium, not the subject.' },
	{ name: 'Characters and people', text: 'Only tag the characters or people shown. Name someone only if you are certain who it is; otherwise say what kind of character or person they are.' },
	{ name: 'Places and setting', text: 'Tag the location and setting, not the art style.' },
	{ name: 'Series and franchise', text: 'Focus on the series or franchise this comes from, and the factions or groups in it.' },
	{ name: 'Colors and mood', text: 'Tag the dominant colors, the lighting and the mood.' },
	{ name: 'Screenshot', text: 'This is a screenshot. Tag the app, game or site it shows and what is on screen.' },
];

export type EagleItemLinkFormat = 'http' | 'eagle';

export type ImageSourceUrlPriority = 'page-first' | 'image-first' | 'page-only' | 'image-only';

export type ExtraLinksImageSource = 'none' | 'page' | 'image' | 'both';

export type MetadataCardImageSource = 'none' | 'page' | 'image' | 'both';

export type EagleAddFolderMode = 'ask' | 'target' | 'mirror' | 'map';

export interface EagleFolderMapping {
	id: string;
	obsidianFolder: string;
	eagleFolderId: string;
	eagleFolderName: string;
}

export interface EagleFolderPickerItem {
	type: 'root' | 'recent' | 'folder' | 'tree-folder' | 'search-folder';
	id?: string;
	name: string;
	path: string;
	depth?: number;
	hasChildren?: boolean;
	isExpanded?: boolean;
	parentId?: string;
}

export interface ImageSourceInfo {
	pageUrl?: string;
	imageUrl?: string;
	localFilePath?: string;
	altText?: string;
}

export interface EagleTag {
	name: string;
	imageCount: number;
	groups?: string[];
	pinyin?: string;
}

export interface EagleFolderPickerResult {
	folderId?: string;
	folderName?: string;
	cancelled: boolean;
	name?: string;
	annotation?: string;
	tags?: string[];
	star?: number;
	mirrored?: boolean;
}

export interface EagleFolderPickerContext {
	file?: File;
	fileName?: string;
	initialAltText?: string;
	initialTags?: string[];
	previewUrl?: string;
	activeFolderPath?: string;
	mirrorRootFolderName?: string;
	onMirror?: () => Promise<string | undefined>;
	// Where the image came from, passed to the AI wands as a hint
	sourcePageUrl?: string;
	ai?: EagleAiAssistant;
	// Ready-made hints for the Templates list beside the AI hints box
	hintTemplates?: AiHintTemplate[];
}

// What the AI wands in the folder picker call. Implemented in ai-providers.ts; every
// method rejects with an Error whose message can be shown to the user as is.
export interface EagleAiAssistant {
	suggestName(imageUrl: string, hints: AiImageHints): Promise<string>;
	suggestDescription(imageUrl: string, hints: AiImageHints): Promise<string>;
	suggestTags(imageUrl: string, hints: AiImageHints, appliedTags: string[]): Promise<AiTagSuggestions>;
}

export interface AiImageHints {
	fileName?: string;
	altText?: string;
	sourcePageUrl?: string;
	// What the user typed in the dialog's Hints box
	userHints?: string;
}

export interface AiTagSuggestions {
	// Tags to add, each flagged if it does not exist in the Eagle library yet
	tags: Array<{ name: string; isNew: boolean }>;
	// Set when the library has more tags than were sent to the model
	truncatedTo?: { sent: number; total: number };
}

export interface EagleExtraLink {
	title: string;
	url: string;
}

export type SearchScope = 'name' | 'tags' | 'annotation' | 'folders';

export const SUPPORTED_IMAGE_EXTENSIONS = [
	'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 
	'tiff', 'tif', 'heic', 'heif', 'avif', 'ico'
] as const;

export const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv'] as const;

export const SUPPORTED_DOCUMENT_EXTENSIONS = ['pdf', 'psd', 'ai', 'sketch'] as const;

export type SupportedExtension = 
	| typeof SUPPORTED_IMAGE_EXTENSIONS[number] 
	| typeof SUPPORTED_VIDEO_EXTENSIONS[number]
	| typeof SUPPORTED_DOCUMENT_EXTENSIONS[number];

export type CloudProviderType = 'r2' | 's3' | 'webdav' | 'imghippo' | 'custom';

export interface CloudProviderConfig {
	type: CloudProviderType;
	enabled: boolean;
	name: string;
}

export interface R2ProviderConfig extends CloudProviderConfig {
	type: 'r2';
	workerUrl: string;
	apiKey: string;
	publicUrl: string;
}

export interface S3ProviderConfig extends CloudProviderConfig {
	type: 's3';
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicUrl: string;
}

export interface WebDAVProviderConfig extends CloudProviderConfig {
	type: 'webdav';
	serverUrl: string;
	username: string;
	password: string;
	uploadPath: string;
	publicUrl: string;
	disableShareLinkConversion: boolean;
}

export interface ImgHippoProviderConfig extends CloudProviderConfig {
	type: 'imghippo';
	apiKey: string;
}

export interface CustomProviderConfig extends CloudProviderConfig {
	type: 'custom';
	uploadUrl: string;
	headers: Record<string, string>;
	publicUrl: string;
}

export type AnyCloudProviderConfig = R2ProviderConfig | S3ProviderConfig | WebDAVProviderConfig | ImgHippoProviderConfig | CustomProviderConfig;

export interface CloudUploadResult {
	success: boolean;
	publicUrl?: string;
	key?: string;
	filename?: string;
	error?: string;
}

export interface CMDSPACEEagleSettings {
	eagleApiBaseUrl: string;
	connectionTimeout: number;
	thumbnailCacheTTL: number;
	autoSyncOnOpen: boolean;
	tagPrefix: string;
	tagNormalization: 'lowercase' | 'preserve';
	linkFormat: 'markdown' | 'wikilink';
	insertThumbnail: boolean;
	thumbnailSize: 'small' | 'medium' | 'large';
	enableDefaultFolder: boolean;
	defaultFolder: string;
	defaultFolderName: string;
	addFolderMode: EagleAddFolderMode;
	enableMirrorRootFolder: boolean;
	mirrorRootFolder: string;
	mirrorRootFolderName: string;
	folderMappings: EagleFolderMapping[];
	recentEagleFolders: string[];
	enableDefaultTags: boolean;
	defaultTags: string;
	enableBacklinks: boolean;
	frontmatterIdField: string;
	backlinkMode: BacklinkMode;
	enableExtraLinks: boolean;
	extraLinksBaseUrl: string;
	backlinkDestination: 'url' | 'note' | 'both';
	eagleLinkPasteMode: EagleLinkPasteMode;
	// An embedded Eagle image links to its cloud copy when it has one, otherwise to the Custom
	// URL prefix, and failing that to the file on this computer.
	// Whether saving to Eagle, or embedding from it, also uploads a cloud copy. The paste
	// dialogs can override this for one image.
	eagleAlsoUploadToCloud: boolean;
	// Address of the user's own server for the Eagle library folder; empty when not set up
	eagleCustomUrlPrefix: string;
	// Link to the Custom URL prefix even for an image that has a cloud copy
	eagleAlwaysUseCustomUrl: boolean;
	eagleCustomUrlFormat: EagleCustomUrlFormat;
	// For the item ID format: end the address with the item's file name
	eagleCustomUrlIncludeName: boolean;
	// Embed the small preview Eagle keeps beside an item instead of the full-size image.
	// Applies to Custom URL prefix and file path links; a cloud copy is always full size.
	eagleEmbedThumbnail: boolean;
	eagleItemLinkFormat: EagleItemLinkFormat;
	enableImageSourceUrl: boolean;
	imageSourceUrlPriority: ImageSourceUrlPriority;
	extraLinksImageSource: ExtraLinksImageSource;
	// One setting per part of the metadata card
	includeTypeInMetadataCard: boolean;
	includeSizeInMetadataCard: boolean;
	includeDimensionsInMetadataCard: boolean;
	// The cloud or folder icon saying whether the image has a cloud copy
	includeStorageInMetadataCard: boolean;
	includeTagsInMetadataCard: boolean;
	includeEagleLinkInMetadataCard: boolean;
	includeCloudLinkInMetadataCard: boolean;
	includeSourceInMetadataCard: MetadataCardImageSource;
	includeLocalSourceInMetadataCard: boolean;
	r2WorkerUrl: string;
	r2ApiKey: string;
	r2PublicUrl: string;
	imageDisplayMode: 'local' | 'cloud' | 'both';
	embedImageInCard: boolean;
	insertAsEmbed: boolean;
	imagePasteBehavior: ImagePasteBehavior;
	// Whether the vault is offered as a destination for a pasted or dropped image
	enableVaultDestination: boolean;
	excalidrawIntegration: boolean;
	excalidrawImportToEagle: boolean;
	canvasIntegration: boolean;
	canvasImportToEagle: boolean;
	canvasNodeType: CanvasNodeType;
	aiProvider: AiProviderType;
	aiProviders: AiProviderConfigs;
	// Limits for the tag wand: tags added per click, and how many of those may be new
	aiMaxTags: number;
	aiMaxNewTags: number;
	aiHintTemplates: AiHintTemplate[];
	// In a library that files tags under prefixes: whether a new tag follows the library's
	// mix of prefixed and plain tags, always takes a prefix, or never does. Or 'custom':
	// new tags copy the form of the comma-separated examples in aiNewTagExamples
	aiNewTagFormat: AiNewTagFormat;
	aiNewTagExamples: string;
	activeCloudProvider: CloudProviderType;
	searchScope: SearchScope[];
	searchFileTypes: string[];
	cloudProviders: {
		r2: R2ProviderConfig;
		s3: S3ProviderConfig;
		webdav: WebDAVProviderConfig;
		imghippo: ImgHippoProviderConfig;
		custom: CustomProviderConfig;
	};
}

export const DEFAULT_SETTINGS: CMDSPACEEagleSettings = {
	eagleApiBaseUrl: 'http://localhost:41595',
	connectionTimeout: 5000,
	thumbnailCacheTTL: 3600000,
	autoSyncOnOpen: false,
	tagPrefix: '',
	tagNormalization: 'lowercase',
	linkFormat: 'markdown',
	insertThumbnail: true,
	thumbnailSize: 'medium',
	enableDefaultFolder: false,
	defaultFolder: '',
	defaultFolderName: '',
	addFolderMode: 'target',
	enableMirrorRootFolder: false,
	mirrorRootFolder: '',
	mirrorRootFolderName: '',
	folderMappings: [],
	recentEagleFolders: [],
	enableDefaultTags: false,
	defaultTags: '',
	enableBacklinks: false,
	frontmatterIdField: 'id',
	backlinkMode: 'extra-links',
	enableExtraLinks: true,
	extraLinksBaseUrl: 'http://127.0.0.1:41598',
	backlinkDestination: 'both',
	eagleLinkPasteMode: 'ask',
	eagleAlsoUploadToCloud: true,
	eagleCustomUrlPrefix: '',
	eagleAlwaysUseCustomUrl: false,
	eagleCustomUrlFormat: 'item-id',
	eagleCustomUrlIncludeName: true,
	eagleEmbedThumbnail: false,
	eagleItemLinkFormat: 'http',
	enableImageSourceUrl: true,
	imageSourceUrlPriority: 'page-first',
	extraLinksImageSource: 'none',
	includeTypeInMetadataCard: true,
	includeSizeInMetadataCard: true,
	includeDimensionsInMetadataCard: true,
	includeStorageInMetadataCard: true,
	includeTagsInMetadataCard: true,
	includeEagleLinkInMetadataCard: true,
	includeCloudLinkInMetadataCard: true,
	includeSourceInMetadataCard: 'page',
	includeLocalSourceInMetadataCard: false,
	r2WorkerUrl: '',
	r2ApiKey: '',
	r2PublicUrl: '',
	imageDisplayMode: 'cloud',
	embedImageInCard: true,
	insertAsEmbed: true,
	imagePasteBehavior: 'ask',
	enableVaultDestination: false,
	excalidrawIntegration: true,
	excalidrawImportToEagle: true,
	canvasIntegration: true,
	canvasImportToEagle: true,
	canvasNodeType: 'text',
	aiProvider: 'none',
	aiProviders: {
		anthropic: { apiKey: '', model: 'claude-haiku-5-5' },
		openai: { apiKey: '', model: '' },
		gemini: { apiKey: '', model: '' },
		'openai-compatible': { apiKey: '', model: '', baseUrl: '' },
		lmstudio: { apiKey: '', model: '', baseUrl: 'http://localhost:1234/v1' },
	},
	aiMaxTags: 6,
	aiMaxNewTags: 2,
	aiHintTemplates: DEFAULT_AI_HINT_TEMPLATES,
	aiNewTagFormat: 'mix',
	aiNewTagExamples: '',
	activeCloudProvider: 'imghippo',
	searchScope: ['name', 'tags'],
	searchFileTypes: [...SUPPORTED_IMAGE_EXTENSIONS],
	cloudProviders: {
		r2: {
			type: 'r2',
			enabled: false,
			name: 'Cloudflare R2',
			workerUrl: '',
			apiKey: '',
			publicUrl: '',
		},
		s3: {
			type: 's3',
			enabled: false,
			name: 'Amazon S3',
			endpoint: '',
			region: 'us-east-1',
			bucket: '',
			accessKeyId: '',
			secretAccessKey: '',
			publicUrl: '',
		},
		webdav: {
			type: 'webdav',
			enabled: false,
			name: 'WebDAV (Synology/NAS)',
			serverUrl: '',
			username: '',
			password: '',
			uploadPath: '/eagle-uploads',
			publicUrl: '',
			disableShareLinkConversion: false,
		},
		imghippo: {
			type: 'imghippo',
			enabled: false,
			name: 'ImgHippo',
			apiKey: '',
		},
		custom: {
			type: 'custom',
			enabled: false,
			name: 'Custom Server',
			uploadUrl: '',
			headers: {},
			publicUrl: '',
		},
	},
};

export interface AddFromPathRequest {
	path: string;
	name: string;
	website?: string;
	folderId?: string;
	tags?: string[];
	annotation?: string;
}

export interface AddFromPathResponse {
	status: 'success' | 'error';
	data?: string;
	message?: string;
}

export interface R2UploadResult {
	success: boolean;
	key?: string;
	filename?: string;
	error?: string;
}

export interface CMDSPACELinkCard {
	type: 'eagle';
	id: string;
	url: string;
	title: string;
	tags: string[];
	source?: string;
	createdAt: string;
	updatedAt: string;
	eagle: {
		ext: string;
		size: number;
		width: number;
		height: number;
		annotation: string;
		sourceUrl: string;
		palettes: EaglePalette[];
	};
}
