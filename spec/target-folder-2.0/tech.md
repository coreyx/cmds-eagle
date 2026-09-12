# Technical Architecture & APIs: Target Folder 2.0

## Language & Environment
* **TypeScript** (Targeting ES2018 / ES6 via esbuild)
* **Obsidian Plugin API** (Desktop environment)
* **Node.js Environment** (Electron / Node APIs)

## Obsidian APIs Utilized
* **`SuggestModal<T>`**:
  * Used for the interactive folder picker in "Ask" mode.
  * Provides complete control over suggestion grouping (`Recent`, `All Folders`, `Library Root`), custom HTML rendering, and keyboard navigation.
* **`prepareFuzzySearch`**:
  * Standard Obsidian utility for scoring and fuzzy matching text queries against folder paths.
* **`Setting`**:
  * For dropdowns, buttons, list rows, and mapping tables in the plugin settings tab.
* **`TFile`, `TFolder`, `Vault`**:
  * For identifying the active note and determining folder paths relative to the vault root.
* **`Notice`**:
  * For non-intrusive feedback (e.g., upload cancelled, folder creation failed, Eagle disconnected).

## Eagle Web API Endpoints Utilized
* **`/api/folder/list` (GET)**:
  * Returns the full tree of `EagleFolder` objects representing the library's folder structure.
* **`/api/folder/listRecent` (GET)**:
  * Returns an array of folders recently used by the user in Eagle.
* **`/api/folder/create` (POST)**:
  * Creates a new folder in Eagle.
  * Request payload:
    ```json
    {
      "folderName": "Folder Name",
      "parent": "OPTIONAL_PARENT_FOLDER_ID"
    }
    ```
  * Response: `{ status: "success", data: { id: "...", name: "...", ... } }`
* **`/api/item/addFromPath` & `/api/item/addFromURL` (POST)**:
  * Accepts `folderId` in payload to place the new item in the resolved folder.

## Core Data Structures

### 1. Folder Mode Type
```typescript
export type EagleAddFolderMode = 'ask' | 'target' | 'mirror' | 'map';
```

### 2. Folder Mapping Definition
```typescript
export interface EagleFolderMapping {
  id: string;             // Unique identifier for the rule
  obsidianFolder: string; // Relative vault path (e.g. "Work/Projects")
  eagleFolderId: string;  // Target Eagle folder hash ID
  eagleFolderName: string;// Human-readable Eagle folder path
}
```

### 3. Folder Picker Suggestion Item
```typescript
export interface EagleFolderPickerItem {
  type: 'root' | 'recent' | 'folder';
  id?: string;
  name: string;
  path: string;
}
```

### 4. Settings Extensions
```typescript
export interface CMDSPACEEagleSettings {
  // Existing settings...
  enableDefaultFolder: boolean; // Preserved for backwards compatibility
  defaultFolder: string;        // Eagle folder ID for 'target' mode
  defaultFolderName: string;    // Eagle folder path for 'target' mode
  
  // Target Folder 2.0 additions:
  addFolderMode: EagleAddFolderMode;
  folderMappings: EagleFolderMapping[];
  recentEagleFolders: string[]; // List of recently picked folder IDs
}
```
