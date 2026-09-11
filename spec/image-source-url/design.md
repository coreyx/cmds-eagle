# Architecture & Design: Image Source URL Capture

## 1. Architectural Overview

When an image copied from a web browser is pasted into Obsidian, `cmds-eagle` intercepts the paste event, extracts the browser's origin URLs (`pageUrl` and `imageUrl`) from the system clipboard in-process, and supplies them to Eagle:
1. **Eagle Primary `website` Field**: Receives the preferred URL based on `imageSourceUrlPriority`.
2. **Eagle Extra Links Plugin**: Optionally receives the webpage URL, direct image URL, or both based on `extraLinksImageSource`.

```
+-------------------------------------------------------------------------------+
| User copies image in browser (Chrome, Edge, Brave, Arc, Safari, Firefox)      |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
                    +---------------------------------------+
                    | Operating System Clipboard            |
                    | - Windows: CF_HTML (SourceURL + <img>)|
                    | - macOS: org.chromium.source-url /    |
                    |          com.apple.webarchive         |
                    +-------------------+-------------------+
                                        |
                                        | Pastes into Obsidian note (Ctrl+V / Cmd+V)
                                        v
                    +---------------------------------------+
                    | cmds-eagle: editor-paste Event Handler |
                    +-------------------+-------------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
    [ClipboardSourceService]                          [Save to Temp File]
    - Reads platform clipboard in-process              - Writes image buffer
    - Extracts:                                        - Generates .eagle-temp path
      • pageUrl (Webpage origin)                       |
      • imageUrl (Direct CDN/file)                     |
    - Resolves primary URL according to priority       |
                 |                                             |
                 +----------------------+----------------------+
                                        |
                                        v
                    +---------------------------------------+
                    | uploadImageToEagle(file, sourceInfo)  |
                    +-------------------+-------------------+
                                        |
                     +------------------+------------------+
                     |                                     |
                     v                                     v
    [Primary Website Field]                     [Extra Links Plugin]
    POST /api/item/addFromPath                  POST /api/item/:id/links
    { website: resolvedUrl, ... }               If extraLinksImageSource !== 'none':
                     |                          • Push "Source Page: domain"
                     |                          • Push "Direct Image: domain"
                     |                          (plus Obsidian Note backlink)
                     +------------------+------------------+
                                        |
                                        v
                    +---------------------------------------+
                    | Eagle Desktop Asset Catalog           |
                    | - Clickable icon links to webpage     |
                    | - Extra Links panel lists all URLs    |
                    +-------------------+-------------------+
                                        |
                                        v
                    +---------------------------------------+
                    | Obsidian Note Markdown Insertion     |
                    | ![filename](file:///...)              |
                    | > Metadata Card (incl. Source link)   |
                    +---------------------------------------+
```

---

## 2. Component Design

### 2.1 `ClipboardSourceService` (`src/clipboard-source.ts`)
The central coordinator for extracting and resolving image source URLs.

```typescript
export class ClipboardSourceService {
  private provider: IClipboardSourceProvider;

  constructor() {
    this.provider = this.createProvider();
  }

  private createProvider(): IClipboardSourceProvider {
    if (process.platform === 'win32') {
      return new WindowsClipboardProvider();
    } else if (process.platform === 'darwin') {
      return new MacOSClipboardProvider();
    }
    return new NullClipboardProvider();
  }

  async getSourceInfo(): Promise<ImageSourceInfo | null> {
    try {
      return await this.provider.getImageSourceInfo();
    } catch (error) {
      console.warn('[CMDS Eagle] Error extracting clipboard source info:', error);
      return null;
    }
  }

  resolvePrimaryUrl(info: ImageSourceInfo | null, priority: ImageSourceUrlPriority): string | null {
    if (!info) return null;

    switch (priority) {
      case 'page-first':
        return info.pageUrl || info.imageUrl || null;
      case 'image-first':
        return info.imageUrl || info.pageUrl || null;
      case 'page-only':
        return info.pageUrl || null;
      case 'image-only':
        return info.imageUrl || null;
      default:
        return info.pageUrl || info.imageUrl || null;
    }
  }
}
```

### 2.2 `WindowsClipboardProvider`
Inspects the Win32 `HTML Format` (`CF_HTML`) clipboard stream.
1. Reads `electron.clipboard.readBuffer('HTML Format')`.
2. Encodes buffer to UTF-8 string.
3. Extracts `pageUrl` via regex matching `SourceURL:(https?://[^\r\n]+)`.
4. Extracts `imageUrl` via regex matching `<img[^>]+src=["'](https?://[^"']+)["']`.
5. Sanitizes and ensures URLs are valid `http://` or `https://` (filtering out `data:` URIs).
6. Fallback: If `HTML Format` is empty, checks `electron.clipboard.read('Chromium internal source URL')`.

### 2.3 `MacOSClipboardProvider`
Handles macOS `NSPasteboard` across Chromium, Safari, and Firefox.
1. Checks `electron.clipboard.read('org.chromium.source-url')` for Chromium browsers.
2. Checks `electron.clipboard.readBuffer('com.apple.webarchive')` for Safari:
   - Uses `BplistParser.extractSourceUrl(buf)` to decode `WebResourceURL`.
3. Checks `electron.clipboard.read('public.html')`:
   - Extracts `<img src="...">` attribute for direct image URL.
4. Fallback to `electron.clipboard.read('public.url')`.

### 2.4 `BplistParser`
A lightweight, self-contained binary plist (`bplist00`) reader derived from `paste-with-source`:
- Reads trailer table, object table offset, and object sizes.
- Traverses dictionary keys searching for `WebMainResource` -> `WebResourceURL`.
- Includes regex safety fallback if binary structure is non-standard.

---

## 3. Data Flow & Integration in `src/main.ts`

### 3.1 Paste Handler Pipeline
```typescript
private async handlePaste(evt: ClipboardEvent, editor: Editor): Promise<void> {
  // 1. Check plain text for Eagle links / paths...
  
  // 2. Check for image files:
  const { files } = clipboardData;
  if (!files || !this.allFilesAreImages(files)) return;

  // 3. Extract Image Source URL before clipboard is altered or consumed
  let sourceInfo: ImageSourceInfo | null = null;
  if (this.settings.enableImageSourceUrl) {
    sourceInfo = await this.clipboardSourceService.getSourceInfo();
  }

  // 4. Delegate to uploadFileWithProgress with sourceInfo
  for (const file of filesCopy) {
    await this.uploadFileWithProgress(file, editor, sourceInfo);
  }
}
```

### 3.2 Eagle Add Payload with Primary Source URL
In `uploadImageToEagle(file: File, sourceInfo?: ImageSourceInfo | null)`:
```typescript
const primaryUrl = sourceInfo 
  ? this.clipboardSourceService.resolvePrimaryUrl(sourceInfo, this.settings.imageSourceUrlPriority)
  : null;

const backlinkData = await this.getEagleBacklinkPayload(primaryUrl);

const result = await this.api.addFromPath({
  path: tempPath,
  name: filenameWithoutExt,
  website: primaryUrl || backlinkData.website,
  tags: this.getDefaultTags(),
  folderId: this.settings.enableDefaultFolder ? (this.settings.defaultFolder || undefined) : undefined,
  annotation: backlinkData.annotation,
});
```

### 3.3 Asynchronous Extra Links Dispatch
```typescript
if (result.itemId && sourceInfo && this.settings.extraLinksImageSource !== 'none') {
  void this.pushImageSourcesToExtraLinks(result.itemId, sourceInfo);
}
```
This runs in the background concurrently with note backlink application (`applyObsidianBacklink`), without adding latency to the user's paste action.

### 3.4 Metadata Card Enrichment
When `this.settings.insertThumbnail` is enabled and `this.settings.includeSourceInMetadataCard` is true:
If `item.url` or `primaryUrl` is present, `buildMetadataCard(item)` includes:
```markdown
> - **Source**: [${new URL(url).hostname}](${url})
```

---

## 4. Edge Cases & Resilience

| Scenario | System Response |
| :--- | :--- |
| **Local Screenshot (Snipping Tool, CleanShot, Snagit)** | Clipboard has image bitmap but no HTML/source-url. Provider returns `null` in < 1ms. Paste proceeds normally without website field or extra links. |
| **Base64 Data URI (`data:image/...`)** | Detected and discarded. System falls back to `pageUrl`. |
| **Extra Links IPC Server Offline** | Pushing image sources to Extra Links logs a warning and fails non-destructively; the image import and primary `website` field remain completely unaffected. |
| **Both Page and Image URLs Identical** | Deduplication check avoids sending duplicate Extra Links for the same URL. |
| **Clipboard Read Exception** | Wrapped in try-catch; logs warning and returns `null`. Never blocks or errors the paste event. |
