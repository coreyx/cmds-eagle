# Technical Stack & Architecture: Mirror Root Folder

## 1. Runtime Environment & Dependencies

* **Language & Runtime**: TypeScript 5.x / 4.7 targeting ES2018 / CommonJS (bundled via esbuild for Obsidian Desktop).
* **Host Application**: Obsidian v0.15.0+ Desktop environment (`App`, `TFile`, `TFolder`, `Plugin`, `PluginSettingTab`, `Setting`, `Modal`, `FuzzySuggestModal`, `Notice`).
* **Eagle Local API**: Eagle desktop HTTP REST server on localhost:
  * Default URL: `http://localhost:41595`
  * Transport: Node.js / Obsidian `requestUrl` and standard HTTP JSON requests.
* **External Dependencies**: Zero external runtime libraries. All UI controls, modal dialogs, and hierarchy resolution logic rely strictly on Obsidian's internal DOM APIs and existing Eagle API wrappers.

---

## 2. Eagle Web API Endpoints

### 2.1 `/api/folder/list` (GET)
* **Purpose**: Retrieves the full hierarchical tree of folders in the active Eagle library.
* **Usage**:
  1. Used by `EagleFolderModal` to populate the folder picker list when selecting a root folder in plugin settings.
  2. Used by `resolveMirroredEagleFolder()` to traverse existing folders and locate or verify the configured root folder and intermediate child folders.
* **Response Schema**:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "ROOT_ATTACHMENTS_ID",
        "name": "Obsidian Attachments",
        "children": [
          {
            "id": "CHILD_FOLDER_ID",
            "name": "Work",
            "children": []
          }
        ]
      }
    ]
  }
  ```

### 2.2 `/api/folder/create` (POST)
* **Purpose**: Creates a new folder segment in Eagle.
* **Usage**: Dynamically invoked during mirroring when a folder segment along the active note's vault path does not yet exist under the parent folder.
* **Request Payload**:
  ```json
  {
    "folderName": "Work",
    "parent": "ROOT_ATTACHMENTS_ID"
  }
  ```
  *(If creating at the root level, `parent` is omitted or `undefined`).*
* **Response Schema**:
  ```json
  {
    "status": "success",
    "data": {
      "id": "NEW_FOLDER_ID",
      "name": "Work",
      "parent": "ROOT_ATTACHMENTS_ID"
    }
  }
  ```

---

## 3. Data Structures & Settings Contracts

### 3.1 `CMDSPACEEagleSettings` (`src/types.ts`)
Three new configuration properties are added to `CMDSPACEEagleSettings`:

```typescript
export interface CMDSPACEEagleSettings {
  // ... existing settings ...

  /**
   * Whether to place mirrored folder structures inside a designated Eagle root folder.
   * Defaults to false (mirrors directly at Eagle's library root).
   */
  enableMirrorRootFolder: boolean;

  /**
   * Eagle folder ID of the designated root folder for mirrored structures.
   * Required when enableMirrorRootFolder is true.
   */
  mirrorRootFolder: string;

  /**
   * Human-readable display path or name of the designated Eagle root folder (e.g. "Obsidian Attachments").
   */
  mirrorRootFolderName: string;

  // ... remaining settings ...
}
```

### 3.2 `DEFAULT_SETTINGS` (`src/types.ts`)
Initialized with safe defaults ensuring backward compatibility:

```typescript
export const DEFAULT_SETTINGS: CMDSPACEEagleSettings = {
  // ... existing defaults ...
  enableMirrorRootFolder: false,
  mirrorRootFolder: '',
  mirrorRootFolderName: '',
  // ... remaining defaults ...
};
```

### 3.3 `EagleFolderPickerContext` (`src/types.ts`)
Updated to include root folder information for rendering dynamic breadcrumbs in the folder picker modal:

```typescript
export interface EagleFolderPickerContext {
  file?: File;
  fileName?: string;
  initialAltText?: string;
  initialTags?: string[];
  previewUrl?: string;
  activeFolderPath?: string;
  mirrorRootFolderName?: string; // e.g. "Obsidian Attachments" if enabled and configured
  onMirror?: () => Promise<string | undefined>;
}
```

---

## 4. Component Structure & Touchpoints

### 4.1 `src/settings.ts` (`CMDSPACEEagleSettingTab`)
* **Location**: Folder routing section (`When adding an item to Eagle`).
* **Condition**: Rendered when `addFolderMode === 'mirror'` OR `addFolderMode === 'ask'`.
* **Controls**:
  1. **Toggle**: "Place mirrored folders under a root folder" / `enableMirrorRootFolder`.
     - When toggled, toggles `enableMirrorRootFolder`, saves settings, and refreshes the tab.
  2. **Folder Selector** (rendered when `enableMirrorRootFolder === true`):
     - Displays `mirrorRootFolderName || 'No folder selected (Required)'`.
     - Button **"Select Folder"**: Fetches Eagle folders, flattens via `flattenEagleFolders`, and opens `EagleFolderModal`. On selection, writes `mirrorRootFolder = selected.id` and `mirrorRootFolderName = selected.path`.
     - Button **"Clear"**: Resets `mirrorRootFolder = ''` and `mirrorRootFolderName = ''`.
     - Validation: Highlights or warns if enabled without a selected folder.

### 4.2 `src/main.ts` (`CMDSPACELinkEagle`)
* **`resolveMirroredEagleFolder(activeFile?: TFile | null): Promise<string | undefined>`**:
  - Updated to evaluate `settings.enableMirrorRootFolder` and `settings.mirrorRootFolder`.
  - Determines base `currentParentId`:
    - If enabled and `mirrorRootFolder` is set: verifies root folder in Eagle tree and sets `currentParentId = settings.mirrorRootFolder`.
    - If disabled: `currentParentId = undefined`.
  - Handles note at vault root (`folderPath` is empty, `/`, or `.`):
    - If enabled: returns `settings.mirrorRootFolder` directly.
    - If disabled: returns `undefined` (Eagle Library Root).
  - Traverses path segments starting from `currentParentId`.
* **`resolveEagleFolderForUpload(context)` in `'ask'` mode**:
  - Computes display path preview including `mirrorRootFolderName` when enabled.
  - Passes `mirrorRootFolderName` to `EagleFolderPickerModal`.

### 4.3 `src/modals.ts` (`EagleFolderPickerModal`)
* Evaluates `context.mirrorRootFolderName`:
  - If set: prepends root folder name to breadcrumb display (e.g., `Obsidian Attachments / Work / Projects` or `Obsidian Attachments`).
  - If unset: displays relative vault path (`Work / Projects`) or `Library Root`.
