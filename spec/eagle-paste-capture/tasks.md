# Implementation Tasks: Eagle Link Paste Capture

- [x] **Task 1: Extend Settings & Types**
  * In `src/types.ts`, define `EagleLinkPasteMode = 'ask' | 'embed' | 'inline'` and `EagleEmbedUrlMode = 'file' | 'custom-url'`.
  * Add `eagleLinkPasteMode: EagleLinkPasteMode`, `eagleEmbedUrlMode: EagleEmbedUrlMode`, and `eagleCustomUrlPrefix: string` to `CMDSPACEEagleSettings`.
  * Set defaults in `DEFAULT_SETTINGS`:
    * `eagleLinkPasteMode: 'ask'`
    * `eagleEmbedUrlMode: 'file'`
    * `eagleCustomUrlPrefix: 'https://localhost:8080'`
  * *Implements Requirement 3.1, 5.1, 5.2*

- [x] **Task 2: Add Settings Tab Controls**
  * In `src/settings.ts`, create a setting section for "Eagle link paste".
  * Add dropdown for "Eagle link paste behavior" (`ask`, `embed`, `inline`).
  * Add dropdown for "Eagle embed URL mode" (`file`, `custom-url`).
  * Add conditional text input for "Custom URL prefix" (visible when mode is `custom-url`).
  * *Implements Requirement 3.1, 5.1, 5.2*

- [x] **Task 3: Implement Regex Detector & Item ID Extractor**
  * In `src/api.ts`, implement `extractEagleItemId(text: string): string | null`.
  * Support `eagle://item/{itemId}`, `http(s)://localhost:{port}/item?id={itemId}`, and `eagle://{itemId}.info/{filename}`.
  * Integrate into synchronous `willHandlePaste` in `src/main.ts` so `preventDefault()` is called for Eagle URLs.
  * *Implements Requirement 1.1, 1.2, 1.3*

- [x] **Task 4: Implement URL & Embed Builders**
  * In `src/api.ts` or `src/main.ts`, implement URL builder for `custom-url` mode:
    * Resolve library folder name (e.g. `Main.library`) from Eagle API `/api/library/info`.
    * Build URL for original file or thumbnail (`_thumbnail.png`).
  * Implement builder for inline link format: `[name.ext](${eagleApiBaseUrl}/item?id=${id})`.
  * *Implements Requirement 5.3, 5.4, 5.5, 6.1, 6.2*

- [x] **Task 5: Implement `EagleLinkChoiceModal`**
  * In `src/modals.ts`, implement `EagleLinkChoiceModal` accepting `app`, `item`, and a callback/promise.
  * Display item title and action buttons: "Embed" and "Inline".
  * Dynamically display "Embed thumbnail" checkbox when "Embed" is selected if `!item.noThumbnail`.
  * Add "Remember my choice" checkbox.
  * Save choice to settings if remember is checked.
  * *Implements Requirement 2.3, 4.1, 4.2, 4.3, 4.4, 4.5*

- [x] **Task 6: Connect Paste Handler & Backlink Trigger**
  * In `src/main.ts`, implement `handleEagleLinkPaste(text: string, editor: Editor): Promise<void>`.
  * Fetch item info via `api.getItemInfo(itemId)`.
  * Branch on `settings.eagleLinkPasteMode`:
    * If `ask`, open `EagleLinkChoiceModal` and await selection.
    * If `embed`, generate embed according to `settings.eagleEmbedUrlMode`.
    * If `inline`, generate inline link.
  * Insert generated markdown into editor.
  * Asynchronously trigger backlink registration via `this.applyObsidianBacklink(itemId)`.
  * *Implements Requirement 2.1, 2.2, 3.2, 3.3, 3.4, 5.6, 6.3, 7.1, 7.2*
