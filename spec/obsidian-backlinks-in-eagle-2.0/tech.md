# Technical Stack: Obsidian Backlinks in Eagle 2.0

## Language & Environment
* **TypeScript** (compiled to ES2018 / ES6 via esbuild)
* **Node.js Environment** (provided by Obsidian Desktop runtime)

## Framework & APIs
* **Obsidian Plugin API**:
  * `this.app.vault.getName()`: Retrieves current vault name.
  * `this.app.workspace.getActiveFile()`: Retrieves current `TFile`.
  * `TFile.basename` & `TFile.path`: Provides note title and relative vault path.
  * `this.app.metadataCache.getFileCache(activeFile)?.frontmatter`: Extracts `id` (or fallback `uid`).
  * `this.app.fileManager.processFrontMatter(activeFile, (fm) => ...)`: Atomically updates frontmatter with `id` if absent and removes redundant `uid`.
  * `requestUrl()`: Native Obsidian HTTP client used to bypass browser CORS when posting to `http://127.0.0.1:41598`.
  * `new Notice(...)`: Displays warning if the Extra Links IPC server is unreachable.

* **Eagle Extra Links Embedded REST API**:
  * Base URL: Configurable, default `http://127.0.0.1:41598`.
  * Endpoint: `POST /api/item/:id/links`.
  * Request Headers: `Content-Type: application/json`.
  * Request Body:
    ```typescript
    interface ExtraLinksPayload {
      title?: string;
      url: string;
      allowDuplicates?: boolean;
    }
    ```
  * Response Handling:
    * `200 OK`: Success (returns `{ success: true, count: number }` or similar).
    * Network error / Connection Refused / Timeout: Triggers user notice and console warning without throwing uncaught exception.

## Existing Components to Reuse & Extend
* **`src/types.ts`**:
  * Update `CMDSPACEEagleSettings`:
    * `backlinkMode: 'extra-links' | 'legacy'`
    * `extraLinksBaseUrl: string` (default: `'http://127.0.0.1:41598'`)
  * Update `DEFAULT_SETTINGS` with default values.
* **`src/settings.ts`**:
  * Add mode selector dropdown (`Eagle Extra Links Plugin` vs `Legacy Native Fields`).
  * Add conditional setting for `extraLinksBaseUrl` when `extra-links` mode is selected.
  * Conditionally show `backlinkDestination` when `legacy` mode is selected.
* **`src/api.ts`**:
  * Add helper method `addExtraLinks(baseUrl: string, itemId: string, links: Array<{ title: string; url: string }>): Promise<{ success: boolean; error?: string }>`.
* **`src/main.ts`**:
  * Centralize backlink creation helper: `createObsidianBacklink(itemId: string): Promise<void>`.
  * Hook `createObsidianBacklink` into:
    * Upload completion in `uploadImageToEagle`, `uploadLocalImageToEagle`, and Excalidraw handlers.
    * Eagle link paste handler (`handleEagleUrlPaste`).
