# Implementation Tasks

- [x] **Task 1: Update Settings Interface**
  * Update `CMDSPACEEagleSettings` in `src/types.ts` to add `enableDefaultFolder: boolean` and `defaultFolderName: string`.
  * Update `DEFAULT_SETTINGS` to include default values for these new properties (false and empty string).
  * *Implements Requirement 1.1, 1.2*

- [x] **Task 2: Flatten Folders Helper**
  * Implement a recursive helper method in `src/settings.ts` (e.g., `flattenEagleFolders`) that takes the `EagleFolder[]` tree from `api.listFolders()` and returns a flat array of `{id, name, path}`.
  * *Implements Requirement 2.2*

- [x] **Task 3: Add Settings UI Toggle**
  * In `src/settings.ts`, add a new `Setting` for the "Save new attachments to a specific Eagle folder" toggle, bound to `enableDefaultFolder`.
  * *Implements Requirement 1.1*

- [x] **Task 4: Add Folder Selection UI**
  * Add a `Setting` right below the toggle for "Target Folder".
  * Set its description to dynamically show the current `defaultFolderName` (or "No folder selected").
  * Add a button labeled "Select Folder" that, when clicked, checks if Eagle is connected, fetches and flattens the folders, and opens the `EagleFolderModal`.
  * *Implements Requirement 2.1, 2.2*

- [x] **Task 5: Handle Modal Selection Callback**
  * In the callback passed to `EagleFolderModal`, update `this.plugin.settings.defaultFolder = item.id` and `this.plugin.settings.defaultFolderName = item.path`.
  * Call `this.plugin.saveSettings()` and call `this.display()` to re-render the settings tab so the new name shows up.
  * *Implements Requirement 2.3*

- [x] **Task 6: Enforce Toggle in Upload Logic**
  * Search `src/main.ts` for all usages of `folderId: this.settings.defaultFolder`.
  * Update the logic (in `uploadImageToEagle`, and the Excalidraw paste handlers) to evaluate: `folderId: this.settings.enableDefaultFolder ? (this.settings.defaultFolder || undefined) : undefined`.
  * *Implements Requirement 3.1, 3.2*