# Requirements: Designated Eagle Folder

## 1. Feature Toggle
**The system shall** provide a toggle in the plugin settings to enable or disable the use of a designated Eagle folder for new attachments.
* **User Story**: As a user, I want to toggle whether my uploads go to a specific folder or just the root library, so I can easily change my workflow without losing my saved folder selection.
* **Acceptance Criteria**:
  * **1.1**: A toggle labeled "Save new attachments to a specific Eagle folder" exists in the Eagle plugin settings.
  * **1.2**: The state of this toggle is persisted in the plugin settings file (`data.json`).

## 2. Folder Selection UI
**When** the designated folder toggle is enabled, **the system shall** provide a UI control to search for and select the target Eagle folder.
* **User Story**: As a user, I want to easily find and select my target folder by name without needing to know its internal Eagle ID.
* **Acceptance Criteria**:
  * **2.1**: A setting control displays the currently selected folder's full path/name (or "No folder selected" if none is configured).
  * **2.2**: Clicking a "Select Folder" button next to this setting opens an interactive `FuzzySuggestModal` showing all available Eagle folders flattened with their hierarchy (e.g., `Parent / Child / Folder`).
  * **2.3**: Selecting a folder from the modal automatically saves its internal `folderId` and human-readable `folderName` to the plugin settings and instantly updates the settings UI to reflect the choice.

## 3. Upload API Integration
**When** a new image is added to Eagle via paste, drop, or Excalidraw, **if** the designated folder toggle is enabled, **the system shall** include the designated folder's ID in the Eagle API upload payload.
* **User Story**: As a user, I want my pasted or dropped images to automatically appear in the exact folder I chose in settings.
* **Acceptance Criteria**:
  * **3.1**: If the feature is enabled and a folder is selected, the `addFromPath` API payload includes the `folderId`.
  * **3.2**: If the feature is disabled (or no folder is selected), the `folderId` is omitted (or sent as undefined) in the API call, ignoring any previously saved folder ID, and defaulting to the Eagle root library.