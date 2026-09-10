# Technical Stack: Eagle Link Paste Capture

## Language & Environment
* **TypeScript** (Targeting ES2018 / ES6, CommonJS for Obsidian)
* **Obsidian Plugin API** (v1.5.0+)

## Framework & APIs
* **Obsidian Editor & Clipboard API**:
  * `this.app.workspace.on('editor-paste', (evt, editor) => ...)`: Event listener to synchronously intercept paste.
  * `evt.clipboardData.getData('text/plain')`: Retrieves raw pasted string.
  * `editor.replaceSelection(text)`: Inserts embed or inline link at active cursor.
  * `Modal`: Obsidian's base modal class used to construct interactive choice dialog.
  * `Setting`: Used inside the modal for options ("Remember choice", "Embed thumbnail").

* **Eagle Web API**:
  * `GET /api/item/info?id={id}`: Retrieves `EagleItem` (contains `name`, `ext`, `noThumbnail`, `id`, etc.).
  * `GET /api/library/info`: Retrieves current active library information (provides `.library` directory path or name).
  * `GET /api/item/thumbnail?id={id}`: Fallback for discovering local thumbnail file paths.

## Regex Patterns for URL Detection
* **Item Link Patterns**:
  * Old/Desktop scheme: `/^eagle:\/\/item\/([A-Za-z0-9]+)$/i`
  * Old direct item file scheme: `/^eagle:\/\/([A-Za-z0-9]+)\.info\/([^\s]+)$/i`
  * Web API URL: `/^https?:\/\/localhost:(\d+)\/item\?id=([A-Za-z0-9]+)$/i`
  * General Eagle Link Tester:
    `const EAGLE_LINK_REGEX = /^(?:eagle:\/\/(?:item\/([A-Za-z0-9]+)|([A-Za-z0-9]+)\.info\/[^\s]+)|https?:\/\/localhost:\d+\/item\?id=([A-Za-z0-9]+))$/i;`

## URL Construction & Encoding
* **Custom URL Prefix Mode**:
  * Prefix: configured string, trailing slashes trimmed (e.g. `https://localhost:8080`).
  * Library Folder: `${libraryName}.library`.
  * Original file path: `${prefix}/${libraryName}.library/images/${itemId}.info/${encodeURIComponent(item.name)}.${item.ext}`
  * Thumbnail path: `${prefix}/${libraryName}.library/images/${itemId}.info/${encodeURIComponent(item.name)}_thumbnail.png`
* **Local `file://` Mode**:
  * Converts absolute path via existing `pathToFileUrl` utility.

## Existing Components to Reuse & Extend
* `src/types.ts`:
  * Add `EagleLinkPasteMode = 'ask' | 'embed' | 'inline'`.
  * Add `EagleEmbedUrlMode = 'file' | 'custom-url'`.
  * Extend `CMDSPACEEagleSettings`:
    * `eagleLinkPasteMode: EagleLinkPasteMode`
    * `eagleEmbedUrlMode: EagleEmbedUrlMode`
    * `eagleCustomUrlPrefix: string`
* `src/api.ts`:
  * Update `parseEagleUrl` or add `extractEagleItemId(text: string): string | null` to match all supported formats.
  * Helper `buildEagleCustomUrl(...)`.
* `src/modals.ts`:
  * New `EagleLinkChoiceModal` class.
* `src/settings.ts`:
  * Settings controls for paste mode and custom URL prefix.
* `src/main.ts`:
  * Integration in `willHandlePaste` and `handlePaste`.
