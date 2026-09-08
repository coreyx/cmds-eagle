# Technical Stack

## Language & Environment
* **TypeScript** (Targeting ES2018 / ES6 via esbuild)
* **Node.js Environment** (Available via Obsidian Desktop)

## Framework & APIs
* **Obsidian Plugin API**:
  * `Setting` class (for adding toggles, text displays, and buttons to the settings tab)
  * `FuzzySuggestModal` (for the interactive, searchable folder dropdown)
  * `Notice` (for user feedback, e.g., if Eagle is disconnected when trying to list folders)
* **Eagle Local API**:
  * `/api/folder/list` (GET): Returns the hierarchical tree of `EagleFolder` objects.
  * `/api/item/addFromPath` (POST): Accepts a `folderId` property in its JSON payload to place the new item in a specific folder.

## Existing Components to Reuse/Extend
* `EagleFolderModal` (already exists in `src/modals.ts`, previously used for Excalidraw integration or search scoping).
* `CMDSPACEEagleSettings` interface (needs `enableDefaultFolder` and `defaultFolderName` additions).
* `api.listFolders()` (already exists in `src/api.ts`).