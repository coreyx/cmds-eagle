# Tasks: Mirror Folder Button in Folder Picker

- [x] **Task 1: Extend Context and Result Types for Mirroring**
  - **Description**: Add active file context, path preview, and mirror execution callback to `EagleFolderPickerContext` and update `EagleFolderPickerResult` in `src/types.ts`.
  - **Concrete Steps**:
    1. Update `EagleFolderPickerContext` in `src/types.ts` to include `activeFile?: TFile | null`, `activeFolderPath?: string`, and `onMirror?: () => Promise<string | undefined>`.
    2. Update `EagleFolderPickerResult` in `src/types.ts` to include optional `mirrored?: boolean`.
  - **Requirements Mapping**: Requirements 1.2, 1.3, 3.1, 3.2.

- [x] **Task 2: Pass Mirror Resolver and Active File from Main Plugin**
  - **Description**: Provide the active note path and the `resolveMirroredEagleFolder` callback inside `resolveEagleFolderForUpload` in `src/main.ts`.
  - **Concrete Steps**:
    1. In `src/main.ts` -> `resolveEagleFolderForUpload`, resolve the current `activeFile` (`context.activeFile || this.app.workspace.getActiveFile()`).
    2. Extract `activeFolderPath` from `activeFile?.parent?.path`.
    3. Pass `activeFile`, `activeFolderPath`, and an `onMirror` callback that invokes `this.resolveMirroredEagleFolder(activeFile)` into `EagleFolderPickerModal.pickFolder(..., context)`.
  - **Requirements Mapping**: Requirements 2.1, 4.1, 4.2, 4.3.

- [x] **Task 3: Implement Mirror Button UI in `EagleFolderPickerModal`**
  - **Description**: Build the Mirror button and path preview badge inside the right-pane header of `EagleFolderPickerModal` in `src/modals.ts`.
  - **Concrete Steps**:
    1. In `src/modals.ts` -> `EagleFolderPickerModal.onOpen()`, create a mirror action container in `headerEl` above the search input.
    2. Render the "Mirror" button with icon `🪞` and clear action label.
    3. Render the target path preview (e.g. breadcrumb `Work / Projects / Alpha` or `Library Root (Uncategorized)` if note is at root).
    4. Attach click listener to trigger `handleMirrorClick()`.
    5. Implement keyboard listener for `Alt+M` (or `Cmd+M`) to invoke mirror action from keyboard.
  - **Requirements Mapping**: Requirements 1.1, 1.2, 1.3, 1.4.

- [x] **Task 4: Implement Mirror Execution Handler and Metadata Preservation**
  - **Description**: Implement `handleMirrorClick()` in `EagleFolderPickerModal` to execute hierarchy resolution, update UI state, and commit metadata.
  - **Concrete Steps**:
    1. Implement loading/busy state on the Mirror button (`Mirroring...`, disabled state).
    2. Await `context.onMirror()`, catching errors with user Notice feedback if folder creation fails.
    3. On success, package the resolved `folderId`, `folderName`, and all left-pane user edits (`itemName`, `itemDescription`, `starRating`, `itemTags`).
    4. Call `this.onSelect(...)` with `cancelled: false`, mark `this.resolved = true`, and close the modal.
    5. In `main.ts`, update `recentEagleFolders` with the resolved mirrored folder ID if non-empty.
  - **Requirements Mapping**: Requirements 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4.

- [x] **Task 5: Style Mirror Button and Breadcrumb Badge in `styles.css`**
  - **Description**: Add CSS rules for the mirror button bar, badge, hover states, and responsive layout in `styles.css`.
  - **Concrete Steps**:
    1. Define `.cmdspace-eagle-picker-mirror-bar` flex layout container with border and background styling.
    2. Define `.cmdspace-eagle-picker-mirror-btn` styling using Obsidian CSS variables (`--interactive-accent`, `--text-on-accent`, hover transition).
    3. Define `.cmdspace-eagle-picker-mirror-path` badge styling with text truncation for deep paths.
    4. Define loading state `.is-loading` with disabled pointer events.
  - **Requirements Mapping**: Requirements 1.1, 1.4.

- [x] **Task 6: Verification and End-to-End Testing**
  - **Description**: Verify the Mirror button across paste and drag-and-drop scenarios.
  - **Concrete Steps**:
    1. Verify modal display when note is at root vs nested folders (`Work/Projects/Alpha`).
    2. Verify clicking Mirror creates missing nested folders in Eagle and uploads image to the deepest folder.
    3. Verify edited name, description, rating, and tags are preserved when clicking Mirror.
    4. Verify keyboard shortcut `Alt+M` triggers mirror action.
    5. Run `npm run build` to verify clean TypeScript compilation and bundling.
  - **Requirements Mapping**: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3.
