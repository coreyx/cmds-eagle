# Requirements: Image Source URL Capture on Paste

## 1. Clipboard Image Source Detection
**The system shall** inspect the system clipboard upon an image paste event to detect whether the image originated from a web browser.
* **User Story**: As a user copying images from web articles, galleries, or search engines into Obsidian, I want the plugin to detect the source webpage and/or image URL automatically so I don't have to manually copy-paste source links into Eagle.
* **Acceptance Criteria**:
  * **1.1**: When an image is pasted in Obsidian (`editor-paste`), if `enableImageSourceUrl` is enabled, the system reads platform-specific clipboard formats in-process using Electron's clipboard API.
  * **1.2**: On Windows, the system parses the `HTML Format` (`CF_HTML`) buffer to extract the origin page URL from the `SourceURL:` header, and the direct image asset URL from `<img src="...">`.
  * **1.3**: On macOS, the system checks `org.chromium.source-url` (Chromium browsers), `com.apple.webarchive` (Safari), and `public.html` (Firefox / generic) to extract the origin page and/or direct image asset URL.
  * **1.4**: If the clipboard contains an image copied from a local desktop tool (e.g. Snipping Tool, Photoshop, local filesystem) without browser metadata, the system gracefully resolves to `null` within 1ms without blocking the paste operation.

## 2. URL Type Preference & Fallback Hierarchy for Eagle Website Field
**The system shall** provide configurable resolution between the origin webpage URL and the direct image asset URL when populating Eagle's primary `website` field.
* **User Story**: As a user, I want the flexibility to choose whether Eagle's primary website link points to the article/context page or the direct full-resolution image URL.
* **Acceptance Criteria**:
  * **2.1**: A setting named "Image Source URL Priority" (`imageSourceUrlPriority`) provides the following options:
    * `Webpage URL with Image fallback` (`'page-first'`) [Default]: Prefers the article/page URL (`SourceURL:` / `org.chromium.source-url`). If absent, falls back to the direct image URL (`<img src="...">` / `WebResourceURL`).
    * `Direct Image URL with Webpage fallback` (`'image-first'`): Prefers the direct image asset URL. If absent, falls back to the origin page URL.
    * `Webpage URL only` (`'page-only'`): Only populates Eagle if a webpage URL is found; never uses direct image file links.
    * `Direct Image URL only` (`'image-only'`): Only populates Eagle if a direct image link is found.
  * **2.2**: Data URLs (e.g. `data:image/...;base64,...`) are discarded and not treated as valid source URLs; the fallback URL is used instead.
  * **2.3**: URLs are validated to begin with `http://` or `https://` before being pushed to Eagle.

## 3. Eagle API Payload Enrichment (Primary Website Field)
**When** an image is uploaded to Eagle, **the system shall** include the resolved source URL in the creation request.
* **User Story**: As a user, I want Eagle to display the origin URL immediately when viewing the imported asset in the Eagle desktop app.
* **Acceptance Criteria**:
  * **3.1**: The resolved URL is passed as the `website` property in the `/api/item/addFromPath` payload.
  * **3.2**: In the event that an item is uploaded without `website` initially (or if post-creation enrichment is required), the system can invoke `/api/item/update` with `{ id: itemId, url: resolvedUrl }`.
  * **3.3**: If Eagle is configured with the Extra Links plugin (`backlinkMode: 'extra-links'`), the Obsidian note backlink is saved to Extra Links, and Eagle's native `website` field displays the external web URL.

## 4. Extra Links Integration for Image Source URLs
**When** image source URLs are captured, **the system shall** optionally add the origin webpage URL, the direct image asset URL, or both to Eagle Extra Links.
* **User Story**: As an Eagle user utilizing the Extra Links plugin, I want to store both the origin webpage link and the direct image asset link as separate items in Eagle's Extra Links panel, alongside my Obsidian note backlink.
* **Acceptance Criteria**:
  * **4.1**: A setting named "Add Image Source to Extra Links" (`extraLinksImageSource`) is available in settings with options:
    * `None` (`'none'`) [Default]
    * `Page URL only` (`'page'`)
    * `Image src URL only` (`'image'`)
    * `Both Page URL and Image src` (`'both'`)
  * **4.2**: When configured and valid browser URLs are captured on paste:
    * If `'page'` or `'both'` is selected and `pageUrl` is available, pushes an Extra Link with title `Source Page: <domain>` (or `Source Page`) and `url: pageUrl`.
    * If `'image'` or `'both'` is selected and `imageUrl` is available, pushes an Extra Link with title `Direct Image: <domain>` (or `Direct Image`) and `url: imageUrl`.
  * **4.3**: Pushes to Extra Links are idempotent (`allowDuplicates: false`).
  * **4.4**: Extra Link pushes for image sources execute asynchronously alongside Obsidian note backlinks and do not block the paste or file creation flow.
  * **4.5**: If the Extra Links server is unreachable or disabled, the primary image import to Eagle and its `website` field still succeed seamlessly with a non-fatal warning.

## 5. Backlink Destination Coordination (Legacy Backlinks)
**When** legacy Obsidian backlinks are configured to use the `url` field, **the system shall** follow a deterministic precedence rule.
* **User Story**: As a user using legacy Eagle backlink modes, I want to control whether the Eagle `website` field stores the Obsidian backlink URI or the internet image source URL.
* **Acceptance Criteria**:
  * **5.1**: If `backlinkMode === 'legacy'` and `backlinkDestination === 'url'` or `'both'`:
    * If `enableImageSourceUrl` is true and a valid web URL was extracted:
      * The internet source URL is assigned to the `website` / `url` field.
      * The Obsidian note link (`obsidian://adv-uri...`) is assigned to the `annotation` note field so neither link is lost.
  * **5.2**: If `backlinkMode === 'extra-links'`, no conflict exists: the Obsidian note is added to Extra Links, and the web source URL is saved as `website`.

## 6. User Settings & Controls
**The system shall** provide intuitive settings in the plugin settings tab to configure image source URL extraction and Extra Links routing.
* **User Story**: As a user, I want to easily toggle this feature on or off and adjust its behavior from Obsidian settings.
* **Acceptance Criteria**:
  * **6.1**: Setting "Capture Image Source URL" (`enableImageSourceUrl: boolean`): Toggles whether image paste checks for browser source URLs. Default: `true`.
  * **6.2**: Setting "Image Source URL Priority" (`imageSourceUrlPriority`): Dropdown with options `'page-first'`, `'image-first'`, `'page-only'`, `'image-only'`. Default: `'page-first'`.
  * **6.3**: Setting "Add Image Source to Extra Links" (`extraLinksImageSource`): Dropdown with options `'none'`, `'page'`, `'image'`, `'both'`. Default: `'none'`.
  * **6.4**: Setting "Include Source URL in Metadata Card" (`includeSourceInMetadataCard: boolean`): When enabled, if an image source URL was captured and `insertThumbnail` (metadata card) is active, the source URL is displayed as a clickable markdown link in the card under "Source". Default: `true`.

## 7. Resilience & Zero-Binary Guarantee
**The system shall** operate 100% in-process within Electron and never fail or block the user's paste flow.
* **User Story**: As a user on any supported OS, I want pasting to remain instant without terminal popups, external binary installations, or hanging on error.
* **Acceptance Criteria**:
  * **7.1**: Under standard operation, all clipboard inspection is completed in-process in < 5ms.
  * **7.2**: Any unexpected clipboard error or unparsable payload is caught silently, logging a debug notice without throwing or interrupting the paste operation.
  * **7.3**: No external dependencies or native binary add-ons are introduced.
