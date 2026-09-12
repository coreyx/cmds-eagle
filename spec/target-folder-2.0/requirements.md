# Requirements: Target Folder 2.0

## 1. Setting: "When adding an item to Eagle"
**The system shall** replace the previous "Eagle Target Folder" toggle with a unified dropdown setting labeled "When adding an item to Eagle".
* **User Story**: As a user, I want to choose how new items added to Eagle are organized into folders, selecting between prompt-on-demand ("Ask"), a designated target folder, automatic vault hierarchy mirroring, or a customized folder mapping table.
* **Acceptance Criteria**:
  * **1.1**: The plugin settings provides a dropdown setting labeled "When adding an item to Eagle" with four options:
    * `Ask` (`ask`): Prompt the user to select an Eagle folder on every upload.
    * `Add to Target Folder` (`target`): Automatically save to a single pre-configured Eagle folder (or root if none is configured).
    * `Mirror Obsidian Folder Hierarchy` (`mirror`): Place items in Eagle matching the active note's relative path in the Obsidian vault.
    * `Use Folder Map` (`map`): Match the active note's location against custom user-defined mapping rules between Obsidian folders and Eagle folders.
  * **1.2**: The setting is persisted in `CMDSPACEEagleSettings` as `addFolderMode` (or backwards compatible with `enableDefaultFolder`).
  * **1.3**: Existing configurations are migrated cleanly: if `enableDefaultFolder` was `true`, `addFolderMode` defaults to `target`; otherwise it defaults to `target` (with empty folder for root library).

## 2. Interactive Folder Picker ("Ask" Mode)
**When** an item is being added to Eagle and the mode is set to "Ask", **the system shall** present an interactive modal picker using Eagle's Web API.
* **User Story**: As a user, I want a quick, searchable popup modal similar to the Eagle Chrome extension that allows me to pick a target folder, select from my recent folders, or save to the library root.
* **Acceptance Criteria**:
  * **2.1**: The modal uses Eagle's `/api/folder/list` and `/api/folder/listRecent` endpoints to populate available and recent folders.
  * **2.2**: The modal provides a prominent option to save to the **Library Root (Uncategorized)**.
  * **2.3**: The modal displays a **Recent Folders** section at the top showing the most recently used folders.
  * **2.4**: The modal displays an **All Folders** section displaying flattened hierarchy paths (e.g., `Design / Icons / Web`).
  * **2.5**: The modal provides real-time search/fuzzy filtering across folder names and paths as the user types.
  * **2.6**: The user can navigate suggestions using arrow keys and press Enter to select, or click with the mouse.
  * **2.7**: Upon selection, the chosen folder is recorded in the recent folder history and the upload proceeds with that `folderId`.
  * **2.8**: If the user cancels the picker (Esc or clicking outside), the upload is aborted cleanly with an informational notice.

## 3. "Add to Target Folder" Mode
**When** the mode is set to "Add to Target Folder", **the system shall** preserve existing behavior by saving to the designated target folder.
* **User Story**: As a user, I want all my uploads to consistently route to one specific Eagle folder without manual prompts.
* **Acceptance Criteria**:
  * **3.1**: When "Add to Target Folder" is selected, the settings tab reveals the "Target Folder" selector row.
  * **3.2**: The selector displays the currently configured folder name (or "No folder selected (Root library)").
  * **3.3**: Clicking "Select Folder" opens the folder search modal to pick an Eagle folder.
  * **3.4**: A "Clear" button allows clearing the target folder back to root library without needing to change modes.
  * **3.5**: When adding an item, the upload payload includes the designated `folderId` (or omits it if no folder is configured).

## 4. "Mirror Obsidian Folder Hierarchy" Mode
**When** the mode is set to "Mirror Obsidian Folder Hierarchy", **the system shall** place the image in an Eagle folder path corresponding to the active note's path in the Obsidian vault.
* **User Story**: As a user, I want my Eagle folder structure to mirror my Obsidian note organization automatically so assets are categorized in Eagle just like my notes.
* **Acceptance Criteria**:
  * **4.1**: The system determines the parent folder path of the active note relative to the vault root (e.g., `Work/Projects/Alpha`).
  * **4.2**: If the note resides at the vault root, the item is placed in Eagle's root library.
  * **4.3**: If the note resides in subfolders, the system inspects Eagle's folder tree to find matching folders along each level of the path hierarchy.
  * **4.4**: If any intermediate or leaf folder does not exist in Eagle, the system automatically creates it via Eagle's `/api/folder/create` endpoint under the correct parent folder.
  * **4.5**: The item is uploaded with the `folderId` of the deepest matching Eagle folder.

## 5. "Use Folder Map" Mode
**When** the mode is set to "Use Folder Map", **the system shall** evaluate custom user mappings from Obsidian vault folders to Eagle folders.
* **User Story**: As a user, I want to define explicit rules mapping specific Obsidian folders to specific Eagle folders, so different projects or areas route to distinct destinations.
* **Acceptance Criteria**:
  * **5.1**: The settings tab provides a management interface for folder mappings (`folderMappings: EagleFolderMapping[]`).
  * **5.2**: Users can add a new mapping rule specifying an Obsidian folder path and selecting an Eagle target folder.
  * **5.3**: Users can delete existing mapping rules.
  * **5.4**: When adding an item, the system matches the active note's folder against defined mappings:
    * Exact matches take highest precedence.
    * Subfolders inherit the parent folder mapping via longest prefix match (e.g. `Projects/Alpha` uses rule for `Projects` if no rule for `Projects/Alpha` exists).
  * **5.5**: If no mapping matches, the system falls back to the root library (or default target folder).

## 6. Integration Across All Add Entry Points
**The system shall** apply the selected folder resolution mode across all ways items can be added to Eagle:
* **Acceptance Criteria**:
  * **6.1**: Clipboard image paste (`handlePaste`).
  * **6.2**: Drag-and-drop image import (`handleDrop`).
  * **6.3**: Excalidraw paste import (`handleExcalidrawFilePaste`).
  * **6.4**: URL capture command (`handleCaptureUrl`).
  * **6.5**: Direct Eagle import command (`handleDirectEagleImport`).
