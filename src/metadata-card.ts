import { CMDSPACEEagleSettings } from './types';

/**
 * Everything a metadata card can show. What actually appears is decided by the "Metadata
 * card" settings, one per part.
 */
export interface MetadataCardParts {
	ext: string;
	// Already formatted, e.g. "3.4 MB" and "1920×1080"
	size: string;
	dimensions: string;
	// Whether the image has a cloud copy: shown as a cloud or a folder
	inCloud: boolean;
	// The item's tags, already written as Obsidian tags. Left out for an image that is not in Eagle.
	tags?: string;
	// Complete Markdown links
	eagleLink?: string;
	cloudLink?: string;
	sourceLinks?: string[];
}

// The settings that each turn one part of the card on or off
export type MetadataCardSettings = Pick<CMDSPACEEagleSettings,
	| 'includeTypeInMetadataCard'
	| 'includeSizeInMetadataCard'
	| 'includeDimensionsInMetadataCard'
	| 'includeStorageInMetadataCard'
	| 'includeTagsInMetadataCard'
	| 'includeEagleLinkInMetadataCard'
	| 'includeCloudLinkInMetadataCard'
>;

/** The card's two rows, facts then links, each holding only the parts that are turned on. */
export function getMetadataCardRows(settings: MetadataCardSettings, parts: MetadataCardParts): string[] {
	const facts: string[] = [];
	if (settings.includeTypeInMetadataCard) facts.push(`**${parts.ext.toUpperCase()}**`);
	if (settings.includeSizeInMetadataCard) facts.push(parts.size);
	if (settings.includeDimensionsInMetadataCard) facts.push(parts.dimensions);
	if (settings.includeStorageInMetadataCard) facts.push(parts.inCloud ? '☁️' : '📁');
	if (settings.includeTagsInMetadataCard && parts.tags !== undefined) facts.push(parts.tags || 'No tags');

	const links: string[] = [];
	if (settings.includeEagleLinkInMetadataCard && parts.eagleLink) links.push(parts.eagleLink);
	if (settings.includeCloudLinkInMetadataCard && parts.cloudLink) links.push(parts.cloudLink);
	// Source links have their own settings and arrive already chosen
	links.push(...(parts.sourceLinks || []));

	return [facts, links].filter(row => row.length > 0).map(row => row.join(' | '));
}

/**
 * The metadata card as it is written into a note: a quote block of up to two rows. Empty
 * when every part is turned off or missing, in which case nothing should be inserted.
 */
export function formatMetadataCard(settings: MetadataCardSettings, parts: MetadataCardParts): string {
	return getMetadataCardRows(settings, parts).map(row => `> ${row}`).join('\n');
}

/** `markdown` followed by `card`, or `markdown` alone when there is no card to add. */
export function appendMetadataCard(markdown: string, card: string | null | undefined): string {
	return card ? `${markdown}\n\n${card}` : markdown;
}
