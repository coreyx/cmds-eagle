# Implementation Tasks: Image Source URL Capture

- [x] **Task 1: Extend Types & Settings**
  * In `src/types.ts`:
    * Define `ImageSourceUrlPriority = 'page-first' | 'image-first' | 'page-only' | 'image-only'`.
    * Define `ExtraLinksImageSource = 'none' | 'page' | 'image' | 'both'`.
    * Define `ImageSourceInfo` (`pageUrl?: string`, `imageUrl?: string`).
    * Add `enableImageSourceUrl: boolean`, `imageSourceUrlPriority: ImageSourceUrlPriority`, `extraLinksImageSource: ExtraLinksImageSource`, and `includeSourceInMetadataCard: boolean` to `CMDSPACEEagleSettings`.
    * Update `DEFAULT_SETTINGS` with default values:
      * `enableImageSourceUrl: true`
      * `imageSourceUrlPriority: 'page-first'`
      * `extraLinksImageSource: 'none'`
      * `includeSourceInMetadataCard: true`
    * Ensure `AddFromPathRequest` includes `website?: string`.
  * *Implements Requirement 2.1, 4.1, 6.1, 6.2, 6.3, 6.4*

- [x] **Task 2: Implement In-Process Clipboard Source Service**
  * Create `src/clipboard-source.ts`:
    * Implement `BplistParser` for Safari `com.apple.webarchive` decoding.
    * Implement `IClipboardSourceProvider` interface.
    * Implement `WindowsClipboardProvider` with `CF_HTML` parsing (`SourceURL:`, `<img src="...">`) and `Chromium internal source URL`.
    * Implement `MacOSClipboardProvider` (`org.chromium.source-url`, `com.apple.webarchive`, `public.html`).
    * Implement `NullClipboardProvider` for unsupported/mobile platforms.
    * Implement `ClipboardSourceService` with `getSourceInfo()` and `resolvePrimaryUrl(info, priority)`.
  * *Implements Requirement 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 7.1, 7.2, 7.3*

- [x] **Task 3: Integrate with Settings UI**
  * In `src/settings.ts`:
    * Add new setting section "Image source URL capture".
    * Add toggle for "Capture image source URL" (`enableImageSourceUrl`).
    * Add dropdown for "Source URL priority (Eagle website field)" (`imageSourceUrlPriority`):
      * "Webpage URL (fallback to image URL)" (`page-first`)
      * "Direct image URL (fallback to webpage URL)" (`image-first`)
      * "Webpage URL only" (`page-only`)
      * "Direct image URL only" (`image-only`)
    * Add dropdown for "Add image source to Extra Links" (`extraLinksImageSource`):
      * "None" (`none`)
      * "Page URL only" (`page`)
      * "Image src URL only" (`image`)
      * "Both Page URL and Image src" (`both`)
    * Add toggle for "Include source in metadata card" (`includeSourceInMetadataCard`).
  * *Implements Requirement 6.1, 6.2, 6.3, 6.4*

- [x] **Task 4: Integrate with Main Paste Pipeline & Extra Links Dispatch**
  * In `src/main.ts`:
    * Instantiate `ClipboardSourceService` in `onload()`.
    * In `handlePaste()`, extract `sourceInfo` before image upload when `enableImageSourceUrl` is true.
    * Update `uploadFileWithProgress(file: File, editor: Editor, sourceInfo?: ImageSourceInfo | null)`.
    * Update `uploadImageToEagle(file: File, sourceInfo?: ImageSourceInfo | null)`:
      * Resolve primary URL for `website` using `resolvePrimaryUrl(sourceInfo, settings.imageSourceUrlPriority)`.
      * Pass `website: primaryUrl` to `api.addFromPath()`.
      * Coordinate with `getEagleBacklinkPayload()` to ensure legacy backlinks do not overwrite `website` if `primaryUrl` is present (assigning legacy backlink to `annotation` instead).
    * Implement `pushImageSourcesToExtraLinks(itemId: string, sourceInfo: ImageSourceInfo): Promise<void>`:
      * Asynchronously push webpage URL and/or direct image URL to `api.addExtraLinks()` when `extraLinksImageSource !== 'none'`.
    * In `buildMetadataCard()`, render clickable Source URL line if present on `item` and enabled.
  * *Implements Requirement 3.1, 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2*

- [x] **Task 5: Build & Verification**
  * Run `npm run build` to verify clean TypeScript compilation and esbuild bundle.
  * Test clipboard reading with simulated or live browser image clipboard entries.
  * Test Extra Links dispatch when `extraLinksImageSource` is enabled.
  * Verify non-browser image paste (e.g. Snipping Tool) completes without error.
