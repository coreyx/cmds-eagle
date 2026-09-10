# Architecture & Design Details: Eagle Link Paste Capture

## 1. Overview
When a user copies an Eagle item link (from either the Eagle desktop app or Web API) and pastes it into Obsidian, the plugin intercepts the clipboard event, identifies the Eagle item ID, fetches its metadata from Eagle's Web API, and generates either an embed (`![name](...)`) or an inline link (`[name](...)`) based on configured preferences.

---

## 2. Detection & Extraction Pipeline

### Pattern Matching
The paste interceptor tests the clipboard text against candidate formats:
1. `eagle://item/<ID>`
2. `eagle://<ID>.info/<FILENAME>`
3. `http://localhost:<PORT>/item?id=<ID>` (and `https://...`)

An item ID extractor method `extractEagleItemId(text: string): string | null` runs synchronously in `willHandlePaste` to ensure `preventDefault()` is called if and only if an Eagle link is detected.

---

## 3. Modal Design: `EagleLinkChoiceModal`

### Structure
```
+-------------------------------------------------------+
|  Eagle Item: Bierstadt Painting                       |
|                                                       |
|  [ Embed ]                   [ Inline Link ]          |
|                                                       |
|  [x] Embed thumbnail (if available)                   |
|      (Revealed when Embed is selected)                |
|                                                       |
|  [ ] Remember my choice                               |
|                                                       |
|  [ Confirm ]                           [ Cancel ]     |
+-------------------------------------------------------+
```

### Component State
- `selectedAction`: `'embed' | 'inline'` (defaults to `'embed'`)
- `useThumbnail`: `boolean` (visible and togglable only if `item.noThumbnail === false` and `selectedAction === 'embed'`)
- `rememberChoice`: `boolean` (if checked, updates `settings.eagleLinkPasteMode = selectedAction` upon confirm)

---

## 4. Link & Embed Construction Logic

### Mode 1: Embed (`'embed'`)
Depending on `settings.eagleEmbedUrlMode`:

1. **`custom-url` Mode (HTTP / WebDAV)**:
   - Base prefix: `settings.eagleCustomUrlPrefix` (e.g. `https://localhost:8080`).
   - Library directory name: retrieved from `api.getLibraryPath()` or `api.getLibraryInfo()` (e.g. `Main.library`).
   - Filename:
     - If thumbnail requested and available: `${encodeURIComponent(item.name)}_thumbnail.png`.
     - Otherwise: `${encodeURIComponent(item.name)}.${item.ext}`.
   - Resulting embed:
     `![${item.name}.${item.ext}](${prefix}/${libraryName}/images/${item.id}.info/${targetFilename})`
     (Appended with `\n\n` + `this.buildMetadataCard(item)` if `settings.insertThumbnail` is enabled)

2. **`file` Mode (Local filesystem)**:
   - Resolves local original file path or thumbnail file path using `api.getThumbnailPath(item.id)`.
   - Converts to file URI via `pathToFileUrl`.
   - Resulting embed:
     `![${item.name}.${item.ext}](${fileUrl})`
     (Appended with `\n\n` + `this.buildMetadataCard(item)` if `settings.insertThumbnail` is enabled)

### Mode 2: Inline (`'inline'`)
- Constructs target URL from the configured Eagle API base URL:
  `${settings.eagleApiBaseUrl}/item?id=${item.id}`
- Resulting markdown:
  `[${item.name}.${item.ext}](${eagleApiUrl})`

---

## 5. Bi-Directional Backlink Coordination
Once the link or embed is inserted into Obsidian:
- If `settings.enableBacklinks` is enabled, `this.applyObsidianBacklink(item.id)` is invoked asynchronously.
- This creates the backlink in Eagle pointing back to the active note without blocking the UI.
