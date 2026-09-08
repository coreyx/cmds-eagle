# Implementation Tasks

- [ ] **Task 1: Update Settings Interface**
  * Update `CMDSPACEEagleSettings` in `src/types.ts` to add `enableBacklinks: boolean` and `backlinkDestination: 'url' | 'note' | 'both'`.
  * Update `DEFAULT_SETTINGS` to include default values (false and 'both').
  * *Implements Requirement 1.1, 1.2, 1.3*

- [ ] **Task 2: Add Settings UI Controls**
  * In `src/settings.ts`, create a new section for "Obsidian Backlinks".
  * Add a toggle setting for `enableBacklinks`.
  * Conditionally (if `enableBacklinks` is true) render a dropdown setting for `backlinkDestination` with options: 'url', 'note', and 'both'.
  * Call `this.display()` on toggle change to re-render the conditional UI.
  * *Implements Requirement 1.1, 1.2*

- [ ] **Task 3: Implement Backlink Generator Helper**
  * In `src/main.ts`, create a helper `getEagleBacklinkPayload(): { website?: string, annotation?: string }`.
  * Check `this.settings.enableBacklinks`. If false, return `{}`.
  * Get the active file. If none, return `{}`.
  * Extract Vault Name, File Path, and Frontmatter (`uid` or `id`).
  * If no UID is found, generate a UUIDv4, call `this.app.fileManager.processFrontMatter` to write it to the note, and use the new UUID.
  * Construct the Advanced URI.
  * Populate the returned object's `website` property if `destination` is 'url' or 'both'.
  * Populate the returned object's `annotation` property with the Markdown formatted string if `destination` is 'note' or 'both'.
  * *Implements Requirement 2.1, 2.2, 2.3, 2.4, 3.1, 4.1, 4.2, 4.3*

- [ ] **Task 4: Inject Backlink Payload into Uploads**
  * In `src/main.ts`, locate all `api.addFromPath` and `api.addFromUrl` calls (e.g., `uploadImageToEagle`, `uploadLocalImageToEagle`, and Excalidraw integration blocks).
  * Merge the result of `this.getEagleBacklinkPayload()` into the payload object passed to the API.
  * Ensure existing properties (like `tags` or `folderId`) are preserved.
  * *Implements Requirement 3.1, 4.3*