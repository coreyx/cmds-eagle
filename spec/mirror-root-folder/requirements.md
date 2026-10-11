# Requirements: Configurable Root Folder for Mirrored Hierarchy

## Feature Summary
When mirroring Obsidian vault folder structures in Eagle (via the "Mirror Obsidian Folder Hierarchy" mode or via the `🪞 Mirror` button in the "Ask" mode folder picker modal), assets are currently placed either at Eagle's library root (if the active note is at the vault root) or in folders created directly at Eagle's top level (e.g., `Work / Projects`).

This feature introduces a new configurable setting that allows users to designate an Eagle root folder (such as "Obsidian Attachments" or "Notes Media") under which all mirrored folder hierarchies will be nested. This separates Obsidian attachments from other existing Eagle folders and libraries.

The setting consists of a toggle ("Place mirrored folders under a root folder") and an interactive Eagle folder selector (similar to the folder selector in "Add to Target Folder" mode). When enabled, selecting a root folder is required. This configuration appears in the plugin settings under both **"Mirror Obsidian Folder Hierarchy"** mode and **"Ask"** mode.

When the setting is turned off, folder mirroring retains its default behavior (placing folders at the root level of Eagle). When turned on, notes at the vault root place attachments directly in the designated Eagle root folder, and notes in subfolders have their matching hierarchies created as descendants under the designated Eagle root folder.

---

## Requirements (EARS Format)

### Requirement 1: Setting UI in Plugin Settings Tab
**Where** the user configures folder routing in the settings tab, **the system shall** render a toggle and a folder selector for nesting mirrored hierarchies when either "Mirror Obsidian Folder Hierarchy" or "Ask" mode is active.

* **User Story**: As a user organizing my Eagle library, I want a setting to specify a root folder for mirrored vault hierarchies so that my Obsidian attachments don't clutter the top level of my Eagle folder list alongside my non-Obsidian assets.
* **Acceptance Criteria**:
  * **1.1**: The setting controls are visible when **"When adding an item to Eagle"** (`addFolderMode`) is set to `'mirror'` ("Mirror Obsidian Folder Hierarchy").
  * **1.2**: The setting controls are also visible when **"When adding an item to Eagle"** (`addFolderMode`) is set to `'ask'` ("Ask").
  * **1.3**: The feature provides a toggle setting named **"Place mirrored folders under a root folder"** (or **"Nest under Eagle root folder"**), defaulting to `false` (disabled).
  * **1.4**: When the toggle is enabled (`true`), the system displays a folder selection control showing the currently selected root folder name (or a warning prompt if unselected).
  * **1.5**: The folder selector control provides a **"Select Folder"** button that opens a searchable Eagle folder modal (`EagleFolderModal`) allowing the user to pick any existing Eagle folder.
  * **1.6**: The folder selector control provides a **"Clear"** button that resets the selected root folder.
  * **1.7**: When the toggle is enabled, selecting a folder is mandatory. If no folder is selected, the UI visually indicates that a folder selection is required (e.g. description displays `No folder selected (Required)` and displays an alert/warning styling or notice).
  * **1.8**: When the toggle is disabled (`false`), the folder selector sub-setting is either hidden or clearly disabled, indicating that mirrored folders will be placed at the root of Eagle.

---

### Requirement 2: Folder Hierarchy Resolution Under Designated Root
**When** folder mirroring is executed (in "Mirror Obsidian Folder Hierarchy" mode or via the `🪞 Mirror` button in the "Ask" folder picker), **the system shall** nest the resolved folder hierarchy beneath the configured Eagle root folder if the setting is enabled.

* **User Story**: As a user who enabled a root attachment folder in Eagle, I want any mirrored folder structures from Obsidian to automatically be created inside that root folder, keeping my library organized and scoped.
* **Acceptance Criteria**:
  * **2.1**: **Setting Disabled (Default)**:
    * If the active note resides at the vault root (`/` or `.`), the system resolves the target folder as `undefined` (Eagle Library Root).
    * If the active note resides in subfolders (e.g. `Work/Projects`), the system creates or matches `Work` at the root of Eagle, then `Projects` under `Work`, returning the ID of the deepest folder.
  * **2.2**: **Setting Enabled with Valid Root Folder**:
    * If the active note resides at the vault root (`/` or `.`), the system returns the ID of the configured Eagle root folder directly as the target folder.
    * If the active note resides in subfolders (e.g. `Work/Projects`), the system begins folder traversal and creation using the configured Eagle root folder ID as `currentParentId`:
      * Checks if `Work` exists under the Eagle root folder (case-insensitive). If missing, creates `Work` under the root folder via `POST /api/folder/create`.
      * Checks if `Projects` exists under `Work`. If missing, creates `Projects` under `Work`.
      * Returns the ID of the deepest folder (`Projects`) as the target upload folder.
  * **2.3**: **Setting Enabled but Root Folder Missing or Invalid**:
    * If the toggle is enabled but no root folder has been selected, or the selected folder ID no longer exists in Eagle, the system displays an informational Notice to the user and gracefully falls back to Eagle Library Root or root-level mirroring without crashing or corrupting data.

---

### Requirement 3: Mirror Action Bar and Breadcrumb Preview in Folder Picker Modal
**When** the Eagle folder picker modal (`EagleFolderPickerModal`) is opened in "Ask" mode, **the system shall** reflect the configured root folder in the Mirror button's breadcrumb preview and tooltip.

* **User Story**: As a user looking at the folder picker modal, I want the path preview on the "Mirror" button to accurately reflect the designated root folder so that I can see the exact full path where my asset will be stored before clicking.
* **Acceptance Criteria**:
  * **3.1**: When the mirror root folder setting is disabled:
    * If the note is at vault root: path preview displays `Library Root`.
    * If the note is in subfolders: path preview displays `Parent / Subfolder` (e.g. `Work / Projects`).
  * **3.2**: When the mirror root folder setting is enabled and a root folder is chosen (e.g. `Obsidian Attachments`):
    * If the note is at vault root: path preview displays `Obsidian Attachments`.
    * If the note is in subfolders: path preview displays `Obsidian Attachments / Parent / Subfolder` (e.g. `Obsidian Attachments / Work / Projects`).
  * **3.3**: The Mirror button tooltip reflects the full target path including the root folder prefix.
  * **3.4**: Activating the Mirror button (`Click` or `Alt+M` / `Cmd+M`) executes the hierarchy resolution using the configured root folder and attaches all left-pane metadata (name, description, rating, tags).

---

### Requirement 4: Settings Persistence and Backward Compatibility
**When** plugin settings are loaded, saved, or updated, **the system shall** persist the mirror root folder configuration without impacting existing user workflows or configurations.

* **User Story**: As an existing user upgrading the plugin, I want my existing settings to continue functioning exactly as before without unexpected changes to where my files are saved.
* **Acceptance Criteria**:
  * **4.1**: `CMDSPACEEagleSettings` includes properties:
    * `enableMirrorRootFolder: boolean` (default: `false`)
    * `mirrorRootFolder: string` (default: `''`)
    * `mirrorRootFolderName: string` (default: `''`)
  * **4.2**: `DEFAULT_SETTINGS` initializes `enableMirrorRootFolder` to `false`, and `mirrorRootFolder` / `mirrorRootFolderName` to empty strings.
  * **4.3**: Upgrading from prior versions without these keys maintains the previous behavior (mirroring at Eagle root).
