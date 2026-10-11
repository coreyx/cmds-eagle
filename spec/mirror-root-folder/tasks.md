# Tasks: Configurable Root Folder for Mirrored Hierarchy

- [x] **Task 1: Extend Settings Interfaces and Default Values**
  - **Description**: Add mirror root folder properties to `CMDSPACEEagleSettings`, initialize them in `DEFAULT_SETTINGS`, and extend `EagleFolderPickerContext` in `src/types.ts`.
  - **Concrete Steps**:
    1. In `src/types.ts`, add `enableMirrorRootFolder: boolean`, `mirrorRootFolder: string`, and `mirrorRootFolderName: string` to `CMDSPACEEagleSettings`.
    2. In `DEFAULT_SETTINGS`, initialize `enableMirrorRootFolder: false`, `mirrorRootFolder: ''`, and `mirrorRootFolderName: ''`.
    3. In `EagleFolderPickerContext`, add `mirrorRootFolderName?: string` to pass display path information to the folder picker modal.
  - **Requirements Mapping**: Requirements 1.3, 4.1, 4.2, 4.3.

- [x] **Task 2: Implement Settings UI for Mirror Root Folder in Settings Tab**
  - **Description**: Add the toggle and Eagle folder selector controls to `src/settings.ts`, ensuring they appear in both `'mirror'` and `'ask'` folder modes.
  - **Concrete Steps**:
    1. In `src/settings.ts`, implement a reusable helper `renderMirrorRootFolderSettings(containerEl: HTMLElement)` to build the toggle and folder selector controls.
    2. Add toggle "Place mirrored folders under a root folder" bound to `this.plugin.settings.enableMirrorRootFolder`.
    3. When toggle is ON, render the folder selector setting showing `mirrorRootFolderName` or `No folder selected (Required)`.
    4. Implement "Select Folder" button: query `api.isConnected()`, fetch folders with `api.listFolders()`, flatten via `flattenEagleFolders`, and open `EagleFolderModal`. Save `mirrorRootFolder` and `mirrorRootFolderName` on selection.
    5. Implement "Clear" button: clear `mirrorRootFolder` and `mirrorRootFolderName`, save settings, and refresh tab display.
    6. Integrate `renderMirrorRootFolderSettings` into the settings tab under `addFolderMode === 'mirror'` and `addFolderMode === 'ask'`.
  - **Requirements Mapping**: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8.

- [x] **Task 3: Update Folder Mirroring Logic to Support Designated Root Folder**
  - **Description**: Update `resolveMirroredEagleFolder()` in `src/main.ts` to nest the mirrored hierarchy under the designated root folder when enabled.
  - **Concrete Steps**:
    1. In `src/main.ts` -> `resolveMirroredEagleFolder(activeFile)`, check whether `enableMirrorRootFolder` is `true` and `mirrorRootFolder` is non-empty.
    2. If active note is at vault root (`/` or `.`):
       - If root folder mode is enabled, return `this.settings.mirrorRootFolder` directly.
       - If root folder mode is disabled, return `undefined` (Eagle Library Root).
    3. If active note is in subfolders:
       - When root folder mode is enabled, locate the root folder node in the Eagle tree to verify it exists and retrieve its children.
       - Set `currentParentId` to `this.settings.mirrorRootFolder` and begin traversal through note path segments from that parent.
       - For each missing segment, call `this.api.createFolder({ folderName: segment, parent: currentParentId })`.
       - Return the deepest resolved folder ID.
    4. If the configured root folder ID is not found in Eagle, log a warning, show an informational Notice, and fall back to root-level mirroring.
  - **Requirements Mapping**: Requirements 2.1, 2.2, 2.3.

- [x] **Task 4: Update Folder Picker Modal Breadcrumb Preview and Context**
  - **Description**: Update `resolveEagleFolderForUpload` and `EagleFolderPickerModal` to display the root folder prefix in the Mirror button path preview badge and tooltip.
  - **Concrete Steps**:
    1. In `src/main.ts` -> `resolveEagleFolderForUpload()` under `'ask'` mode, supply `mirrorRootFolderName` into `EagleFolderPickerModal` context if `enableMirrorRootFolder` is true.
    2. In `src/modals.ts` -> `EagleFolderPickerModal.onOpen()`, compute `pathDisplay` including `mirrorRootFolderName` when present (e.g. `Obsidian Attachments / Work / Projects` or `Obsidian Attachments` if note is at vault root).
    3. Update the Mirror button tooltip and badge text to reflect the full prefixed path.
  - **Requirements Mapping**: Requirements 3.1, 3.2, 3.3, 3.4.

- [x] **Task 5: Verification and Build Validation**
  - **Description**: Validate the end-to-end functionality of settings, folder mirroring, and picker modal integration.
  - **Concrete Steps**:
    1. Create automated scratch test verifying `resolveMirroredEagleFolder` logic across all four combinations (root note vs subfolder note × root folder enabled vs disabled).
    2. Test fallback behavior when root folder setting is enabled without a folder chosen or when folder is missing.
    3. Run `npm run build` to verify type-checking (`tsc -noEmit`) and bundling (`esbuild`).
  - **Requirements Mapping**: Requirements 1.1–1.8, 2.1–2.3, 3.1–3.4, 4.1–4.3.
