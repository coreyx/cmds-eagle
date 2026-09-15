# Requirements: Mirror Folder Button in Folder Picker

## Feature Summary
When pasting or dragging and dropping content into Obsidian and routing the asset to Eagle (via "Eagle (Local)" paste choice or with the folder routing mode set to "Ask"), the user is presented with the interactive Eagle folder picker modal (`EagleFolderPickerModal`).

This feature adds a prominent **"Mirror"** button directly to the folder picker modal UI. Clicking this button triggers functionality identical to the plugin's existing "Mirror Obsidian Folder Hierarchy" routing mode: the asset is placed in an Eagle folder hierarchy that matches the active note's directory path relative to the Obsidian vault root. If any intermediate or leaf folders in that hierarchy do not already exist in Eagle, the system automatically creates them via Eagle's Web API (`/api/folder/create`). The asset is then uploaded to that mirrored folder alongside the user's chosen metadata (name, description/annotation, rating, tags) from the picker.

---

## Requirements (EARS Format)

### 1. Mirror Button UI in Folder Picker Modal
**When** the Eagle folder picker modal is displayed, **the system shall** render a "Mirror" button alongside a path preview of the mirrored destination in the folder picker header controls.
* **User Story**: As an Obsidian user saving an image to Eagle with the folder picker open, I want a dedicated "Mirror" action button so that I can quickly send the image to an Eagle folder matching my current note's vault path without having to manually search for or create matching folders in the tree.
* **Acceptance Criteria**:
  * **1.1**: The folder picker modal (`EagleFolderPickerModal`) right-pane header contains a button labeled "Mirror" (or with an accompanying icon, e.g. 🪞 or folder mirror icon).
  * **1.2**: The button displays a tooltip and/or subtitle preview showing the target mirrored folder path derived from the active note (e.g., `Mirror: Work / Projects / Alpha` or `Mirror: Library Root` if the note is at vault root).
  * **1.3**: If no active note is open or the active note is in the vault root, the button remains functional, targeting Eagle's Library Root (or indicating root destination).
  * **1.4**: The Mirror button is keyboard-accessible (accessible via Tab focus or a designated shortcut key such as `Alt+M` / `Cmd+M`) and clearly styled to stand out as a primary action without cluttering the search bar.

### 2. Mirrored Folder Hierarchy Resolution
**When** the user clicks the "Mirror" button, **the system shall** dynamically resolve or create the complete folder hierarchy in Eagle corresponding to the active note's relative path in Obsidian.
* **User Story**: As a user organizing notes in nested vault folders, I want clicking "Mirror" in the picker to automatically inspect Eagle's folder structure and recursively create any missing parent or subfolders so that the asset lands in the exact matching category in Eagle.
* **Acceptance Criteria**:
  * **2.1**: The system identifies the parent folder path of the active note relative to the vault root (e.g., `Reference/Design/Mobile`).
  * **2.2**: If the note resides at the vault root (`/` or `.`), the system resolves the target folder as `undefined` (Library Root in Eagle).
  * **2.3**: If the note resides in subfolders, the system parses each path segment and traverses Eagle's folder tree:
    * Matching is case-insensitive against existing Eagle folder names.
    * If a folder segment exists under the current parent, its `id` is used as the parent for the next segment.
    * If a folder segment does not exist, the system issues a `POST /api/folder/create` request to Eagle to create that folder under the current parent `id`.
  * **2.4**: The deepest created or matched folder `id` is returned as the resolved target `folderId`.
  * **2.5**: If folder creation fails due to network or Eagle API error, the system presents an informational notice and safely prevents asset misplacement or corruption.

### 3. Preservation of Edited Metadata and Upload Flow
**When** the "Mirror" button is activated, **the system shall** commit the asset upload with all current metadata values entered in the modal's left pane.
* **User Story**: As a user who has entered a custom name, star rating, description, or tags in the left pane of the picker, I want clicking "Mirror" to preserve and upload all of those metadata attributes to Eagle along with the mirrored folder destination.
* **Acceptance Criteria**:
  * **3.1**: The name field value (`itemName`), description field value (`itemDescription`), star rating (`starRating`), and tags (`itemTags`) from the modal are bundled with the resolved mirrored `folderId`.
  * **3.2**: The folder picker returns an `EagleFolderPickerResult` with `cancelled: false`, the resolved `folderId`, and the user's custom metadata.
  * **3.3**: The resolved mirrored `folderId` is added to the user's recent Eagle folder history in settings (`recentEagleFolders`).
  * **3.4**: The modal closes cleanly, and the upload pipeline (`uploadImageToEagle`) proceeds seamlessly.

### 4. Integration with Paste and Drag-and-Drop Workflows
**The system shall** provide the "Mirror" option seamlessly across both clipboard paste and drag-and-drop operations whenever the Eagle folder picker is invoked.
* **User Story**: As a user importing images via clipboard paste or mouse drag-and-drop, I want the folder picker to offer the Mirror functionality consistently regardless of which gesture triggered the import.
* **Acceptance Criteria**:
  * **4.1**: In `handlePaste` when the user selects "Eagle (Local)" in `ImagePasteChoiceModal` (or when `imagePasteBehavior` is `'eagle'` and `addFolderMode` is `'ask'`), the picker presents the Mirror button.
  * **4.2**: In `handleDrop` when an image file or browser image is dropped into Obsidian and routed to Eagle with folder mode "Ask", the picker presents the Mirror button.
  * **4.3**: In `handleExcalidrawFilePaste` and URL capture operations routed through the folder picker, the Mirror button is available and functional.
