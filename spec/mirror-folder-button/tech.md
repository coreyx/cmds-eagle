# Technical Stack & Architecture: Mirror Folder Button

## 1. Runtime Environment & Dependencies
* **TypeScript**: 5.x / 4.7 targeting ES2018 / CommonJS (bundled via esbuild for Obsidian Desktop).
* **Obsidian Plugin API**: Desktop environment (`App`, `TFile`, `TFolder`, `Vault`, `Modal`, `Notice`).
* **Eagle Web API**: HTTP REST endpoints on localhost:
  * Default port: `41595` (`http://localhost:41595`).
* **Zero External Dependencies**: All UI components, hierarchy resolution, and API calls use Obsidian's native DOM/networking APIs and existing Eagle API wrappers.

---

## 2. Eagle Web API Endpoints

### 2.1 `/api/folder/list` (GET)
* **Purpose**: Fetches the complete hierarchical tree of folders currently defined in the active Eagle library.
* **Response Payload**:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "FOLDER_ID_1",
        "name": "Work",
        "children": [
          {
            "id": "FOLDER_ID_2",
            "name": "Projects",
            "children": []
          }
        ]
      }
    ]
  }
  ```

### 2.2 `/api/folder/create` (POST)
* **Purpose**: Dynamically creates a missing folder segment in Eagle.
* **Request Payload**:
  ```json
  {
    "folderName": "Alpha",
    "parent": "FOLDER_ID_2"
  }
  ```
  *(If creating at root level, `parent` is omitted or left undefined).*
* **Response Payload**:
  ```json
  {
    "status": "success",
    "data": {
      "id": "NEW_FOLDER_ID",
      "name": "Alpha",
      "parent": "FOLDER_ID_2"
    }
  }
  ```

### 2.3 `/api/item/addFromPath` (POST)
* **Purpose**: Uploads the temporary image file to Eagle and assigns it to the resolved mirrored `folderId`.

---

## 3. Core Data Structures & Interfaces

### 3.1 `EagleFolderPickerContext` (`src/types.ts`)
Updated to supply active file context and an optional mirror resolver callback directly into the modal:
```typescript
export interface EagleFolderPickerContext {
  file?: File | TFile;
  fileName?: string;
  initialAltText?: string;
  initialTags?: string[];
  previewUrl?: string;
  activeFile?: TFile | null;
  activeFolderPath?: string; // Relative vault parent path, e.g. "Work/Projects/Alpha"
  onMirror?: () => Promise<string | undefined>; // Callback to trigger folder hierarchy mirroring
}
```

### 3.2 `EagleFolderPickerResult` (`src/types.ts`)
```typescript
export interface EagleFolderPickerResult {
  folderId?: string;       // Target Eagle folder ID (or undefined for Library Root)
  folderName?: string;     // Display name / path of chosen folder
  cancelled: boolean;      // True if user aborted
  name?: string;           // Asset name from Name field
  annotation?: string;     // Note/description from Description field
  tags?: string[];         // Tag list from Tag pills
  star?: number;           // 1-5 rating from Star picker
  mirrored?: boolean;      // True if selected via Mirror button action
}
```

---

## 4. Component Structure & Touchpoints

1. **`src/modals.ts` - `EagleFolderPickerModal`**:
   * Add the "Mirror" button element in the right-pane header adjacent to the search input / title.
   * Render active vault folder path breadcrumb preview (e.g. `Mirror: Work / Projects`).
   * Bind click / keyboard handler to execute mirroring, show loading state, retrieve the resolved folder ID, and commit selection.

2. **`src/main.ts` - `resolveEagleFolderForUpload` & `resolveMirroredEagleFolder`**:
   * Reuse the existing `resolveMirroredEagleFolder(activeFile)` method.
   * Provide the `activeFolderPath` and `onMirror` callback inside the `context` passed to `EagleFolderPickerModal.pickFolder(...)`.

3. **`styles.css`**:
   * Style `.cmdspace-eagle-picker-mirror-btn` and preview badge to blend seamlessly with Obsidian theme variables (`--interactive-accent`, `--text-muted`, `--background-modifier-border`).
