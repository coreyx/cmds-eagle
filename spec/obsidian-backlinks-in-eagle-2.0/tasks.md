# Implementation Tasks: Obsidian Backlinks in Eagle 2.0

- [x] **Task 1: Update Types & Settings Defaults**
  * In `src/types.ts`, add `BacklinkMode = 'extra-links' | 'legacy'`.
  * Add `backlinkMode: BacklinkMode` and `extraLinksBaseUrl: string` to `CMDSPACEEagleSettings`.
  * Update `DEFAULT_SETTINGS` with `backlinkMode: 'extra-links'` and `extraLinksBaseUrl: 'http://127.0.0.1:41598'`.
  * *Implements Requirement 1.1, 1.2, 1.3, 1.5*

- [x] **Task 2: Update Settings UI Controls**
  * In `src/settings.ts`, update the "Obsidian backlinks" settings section.
  * When backlinks are enabled:
    * Render a dropdown for `backlinkMode` with options:
      * `Eagle Extra Links Plugin (REST API)` (`extra-links`)
      * `Eagle Native Fields (Website / Note)` (`legacy`)
    * When `extra-links` is selected, render a text input for `extraLinksBaseUrl` (with placeholder `http://127.0.0.1:41598`).
    * When `legacy` is selected, render the destination dropdown (`backlinkDestination`).
  * *Implements Requirement 1.1, 1.2, 1.3, 1.4*

- [x] **Task 3: Implement Extra Links Client in `EagleApiService`**
  * In `src/api.ts`, implement `addExtraLinks(baseUrl: string, itemId: string, links: Array<{ title: string; url: string }>): Promise<{ success: boolean; error?: string }>`.
  * Use `requestUrl` to issue `POST ${baseUrl}/api/links` with payload `{ itemId, links }`.
  * Handle network failures gracefully and return status/error.
  * *Implements Requirement 4.1, 4.2, 4.3*

- [x] **Task 4: Implement Central Backlink Applicator in `main.ts`**
  * In `src/main.ts`, implement `applyObsidianBacklink(itemId: string): Promise<void>`.
  * If `!this.settings.enableBacklinks`, return immediately.
  * Resolve active file, vault name, UID (generating & persisting to frontmatter if missing), and note basename.
  * Construct Obsidian Advanced URI.
  * If `backlinkMode === 'extra-links'`:
    * Call `api.addExtraLinks(...)`.
    * If call fails, show `Notice` with exact warning: `"Eagle Extra Links plugin is unreachable. Please ensure the Extra Links plugin is installed in Eagle and its IPC server is toggled on."`
  * If `backlinkMode === 'legacy'`:
    * Call Eagle API `/api/item/update` with `website` or `annotation` as configured.
  * *Implements Requirement 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.4, 5.1, 5.2*

- [x] **Task 5: Integrate Dual Triggers**
  * In `src/main.ts`, hook `applyObsidianBacklink` into:
    * Upload completion paths (`uploadImageToEagle`, `uploadLocalImageToEagle`, and Excalidraw integration).
    * Eagle link paste handler (when an Eagle link is detected and parsed).
  * Ensure legacy payload injection (`getEagleBacklinkPayload`) remains intact when `backlinkMode === 'legacy'` during initial `addFromPath`.
  * *Implements Requirement 2.1, 2.2*
