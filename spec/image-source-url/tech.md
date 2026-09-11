# Technical Stack & Specifications: Image Source URL Capture

## 1. Runtime Environment & Dependencies
* **TypeScript**: 5.x targeting ES2018 / CommonJS (Obsidian desktop plugin standard).
* **Obsidian Environment**: Obsidian Desktop v1.5.0+ running on Electron.
* **Electron In-Process APIs**:
  * `electron.clipboard`: In-process clipboard reader.
  * Access pattern:
    ```typescript
    const electron = (window as any).require ? (window as any).require('electron') : require('electron');
    const clipboard = electron?.clipboard;
    ```
* **Zero External Dependencies**: All parsing (`CF_HTML`, `bplist00`, regex) is executed purely in TypeScript/JavaScript without external npm packages or native binaries.

---

## 2. Low-Level Clipboard Formats

### 2.1 Windows: `HTML Format` (`CF_HTML`)
On Windows, when an image is copied from Chromium (Chrome, Edge, Brave, Arc, Opera) or Firefox, the browser places the `HTML Format` clipboard type onto the clipboard.

* **Electron Read**:
  ```typescript
  const buf: Buffer = clipboard.readBuffer('HTML Format');
  ```
* **Format Structure**:
  ```http
  Version:0.9
  StartHTML:0000000105
  EndHTML:0000000450
  StartFragment:0000000141
  EndFragment:0000000414
  SourceURL:https://example.com/art-gallery/bierstadt
  <html><body>
  <!--StartFragment--><img src="https://cdn.example.com/images/mountain.jpg" alt="Mountain"><!--EndFragment-->
  </body></html>
  ```
* **Extraction Logic**:
  * **Page URL**: Extracted via `buf.toString('utf8').match(/SourceURL:(https?:\/\/[^\r\n]+)/i)?.[1]?.trim()`
  * **Image URL**: Extracted via regex on the HTML fragment:
    `/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i` or `/<img[^>]+src=([^\s>]+)/i`
* **Windows Custom Format (`Chromium internal source URL`)**:
  * Chromium also registers `"Chromium internal source URL"`. As a secondary check, `clipboard.read('Chromium internal source URL')` or `readBuffer` can be inspected if `HTML Format` is absent.

### 2.2 macOS: `org.chromium.source-url` & `com.apple.webarchive`
On macOS, `NSPasteboard` uses uniform type identifiers (UTIs):

1. **Chromium Browsers (Chrome, Edge, Arc, Brave, Opera)**:
   * **Page URL**:
     ```typescript
     const sourceUrl = clipboard.read('org.chromium.source-url');
     ```
   * **Image URL**:
     ```typescript
     const html = clipboard.read('public.html');
     const imageMatch = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
     ```

2. **Apple Safari**:
   * Safari stores copied web content in `com.apple.webarchive`, which is an Apple Binary Property List (`bplist00`).
   * **Buffer Extraction**:
     ```typescript
     const buf: Buffer = clipboard.readBuffer('com.apple.webarchive');
     ```
   * **Bplist Parsing**:
     An embedded, zero-dependency `BplistParser` traverses the dictionary structure:
     `Root -> WebMainResource -> WebResourceURL` or top-level `WebResourceURL`.
     If standard bplist structure traversal fails, regex scanning on the raw buffer finds the `WebResourceURL` key followed by ASCII/UTF-8 URL bytes.
   * **Safari Fallback**:
     `clipboard.read('public.url')`

3. **Firefox on macOS**:
   * Populates `public.html` with `SourceURL:` comment or `<img>` element.

---

## 3. Data Types & Interfaces

```typescript
export type ImageSourceUrlPriority = 
  | 'page-first'   // Prefer webpage URL, fallback to image URL
  | 'image-first'  // Prefer image asset URL, fallback to webpage URL
  | 'page-only'    // Only accept webpage URL
  | 'image-only';  // Only accept image asset URL

export type ExtraLinksImageSource =
  | 'none'         // Do not add image sources to Extra Links
  | 'page'         // Add origin webpage URL only
  | 'image'        // Add direct image asset URL only
  | 'both';        // Add both webpage URL and image asset URL

export interface ImageSourceInfo {
  pageUrl?: string;       // Origin article/webpage URL
  imageUrl?: string;      // Direct image file CDN URL
  resolvedUrl?: string;   // Final URL chosen according to priority
}

export interface IClipboardSourceProvider {
  getImageSourceInfo(): Promise<ImageSourceInfo | null>;
}
```

---

## 4. Settings Extensions in `src/types.ts`

```typescript
export interface CMDSPACEEagleSettings {
  // ... existing properties ...

  // Image Source URL settings
  enableImageSourceUrl: boolean;
  imageSourceUrlPriority: ImageSourceUrlPriority;
  extraLinksImageSource: ExtraLinksImageSource;
  includeSourceInMetadataCard: boolean;
}

export const DEFAULT_SETTINGS: CMDSPACEEagleSettings = {
  // ... existing defaults ...
  enableImageSourceUrl: true,
  imageSourceUrlPriority: 'page-first',
  extraLinksImageSource: 'none',
  includeSourceInMetadataCard: true,
};
```

---

## 5. Eagle API Integration Points

### 5.1 `/api/item/addFromPath` (Primary Website Field)
The payload sent in `src/main.ts` -> `uploadImageToEagle`:
```typescript
const result = await this.api.addFromPath({
  path: tempPath,
  name: filenameWithoutExt,
  website: sourceUrl || backlinkData.website,
  tags: this.getDefaultTags(),
  folderId: this.settings.enableDefaultFolder ? (this.settings.defaultFolder || undefined) : undefined,
  annotation: backlinkData.annotation,
});
```

### 5.2 Eagle Extra Links Plugin Integration (`POST /api/item/:id/links`)
When `extraLinksImageSource` is not `'none'`, the plugin pushes the requested source URLs:
```typescript
private async pushImageSourcesToExtraLinks(
  itemId: string,
  sourceInfo: ImageSourceInfo
): Promise<void> {
  const mode = this.settings.extraLinksImageSource;
  if (mode === 'none' || !sourceInfo) return;

  const linksToPush: Array<{ title: string; url: string }> = [];

  if ((mode === 'page' || mode === 'both') && sourceInfo.pageUrl) {
    const domain = this.extractDomain(sourceInfo.pageUrl);
    linksToPush.push({
      title: domain ? `Source Page: ${domain}` : 'Source Page',
      url: sourceInfo.pageUrl
    });
  }

  if ((mode === 'image' || mode === 'both') && sourceInfo.imageUrl) {
    const domain = this.extractDomain(sourceInfo.imageUrl);
    linksToPush.push({
      title: domain ? `Direct Image: ${domain}` : 'Direct Image',
      url: sourceInfo.imageUrl
    });
  }

  for (const link of linksToPush) {
    await this.api.addExtraLinks(
      this.settings.extraLinksBaseUrl,
      itemId,
      link
    );
  }
}
```

### 5.3 Legacy Backlink Coordination
When `enableBacklinks: true` and `backlinkMode: 'legacy'` and `backlinkDestination: 'url' | 'both'`:
If a valid `sourceUrl` exists from the browser:
- `website` is assigned `sourceUrl`.
- The Obsidian URI is placed in `annotation` (`Linked From Obsidian: [Note](obsidian://adv-uri...)`), ensuring no data is dropped.

---

## 6. Project Architecture & File Organization

* **`src/clipboard-source.ts`** [NEW]:
  - `BplistParser`: Zero-dependency bplist decoder for Safari.
  - `IClipboardSourceProvider`: Interface for clipboard source extractors.
  - `WindowsClipboardProvider`: Windows `CF_HTML` and `Chromium internal source URL` implementation.
  - `MacOSClipboardProvider`: macOS `org.chromium.source-url`, `com.apple.webarchive`, and `public.html` implementation.
  - `NullClipboardProvider`: Graceful fallback for non-desktop environments.
  - `ClipboardSourceService`: Orchestrator that creates the right provider and resolves URLs based on `ImageSourceUrlPriority`.
* **`src/types.ts`** [MODIFY]:
  - Add `ImageSourceUrlPriority`, `ExtraLinksImageSource`, `ImageSourceInfo`, and settings fields.
* **`src/main.ts`** [MODIFY]:
  - Initialize `ClipboardSourceService` in `onload()`.
  - Extract image source info in `handlePaste()` during image paste.
  - Pass resolved URL and full `sourceInfo` to `uploadFileWithProgress` and `uploadImageToEagle`.
  - Push to Extra Links if `extraLinksImageSource !== 'none'`.
  - Update `buildMetadataCard` to optionally render the source link if enabled.
* **`src/settings.ts`** [MODIFY]:
  - Add "Image source URL" settings group with toggle, priority dropdown, Extra Links dropdown, and metadata card toggle.
