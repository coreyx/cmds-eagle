# Technical Stack

## Language & Environment
* **TypeScript** (Targeting ES2018 / ES6 via esbuild)
* **Node.js Environment** (Available via Obsidian Desktop API)

## Framework & APIs
* **Obsidian Plugin API**:
  * `this.app.vault.getName()`: Retrieves the current vault's name.
  * `this.app.workspace.getActiveFile()`: Retrieves the currently active `TFile`.
  * `TFile.path` and `TFile.basename`: Used to get the filepath and filename.
  * `this.app.metadataCache.getFileCache(activeFile)?.frontmatter`: Used to extract the `uid` or `id` property for the Advanced URI.
  * `this.app.fileManager.processFrontMatter(activeFile, (frontmatter) => ...)`: Used to safely write a newly generated UID into the file's frontmatter if one doesn't exist.

* **Eagle Local API**:
  * `/api/item/addFromPath` (POST): Accepts optional `website?: string` (URL field) and `annotation?: string` (Note field).
  * `/api/item/addFromURL` (POST): Accepts optional `website?: string` and `annotation?: string`.

## Existing Components to Reuse/Extend
* `CMDSPACEEagleSettings` interface (`src/types.ts`): Needs `enableBacklinks` and `backlinkDestination` additions.
* Settings Tab (`src/settings.ts`): UI implementation for toggles.
* Upload logic (`src/main.ts`): Functions like `uploadImageToEagle`, `uploadLocalImageToEagle`, and the Excalidraw paste handlers need to call a new URI generator helper and append the results to the Eagle payload.