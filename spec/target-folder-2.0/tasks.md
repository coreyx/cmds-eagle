# Implementation Tasks: Target Folder 2.0

## Phase 1: Type Definitions & API Services
- [x] **Task 1.1: Extend Settings & Data Interfaces (`src/types.ts`)**
  * Define `EagleAddFolderMode = 'ask' | 'target' | 'mirror' | 'map'`.
  * Define `EagleFolderMapping` interface (`id`, `obsidianFolder`, `eagleFolderId`, `eagleFolderName`).
  * Add `addFolderMode`, `folderMappings`, and `recentEagleFolders` to `CMDSPACEEagleSettings`.
  * Update `DEFAULT_SETTINGS` with default values (`addFolderMode: 'target'`, `folderMappings: []`, `recentEagleFolders: []`).
  * *Implements Requirement 1.1, 1.2, 5.1*

- [x] **Task 1.2: Add Eagle Folder API Endpoints (`src/api.ts`)**
  * Add `listRecentFolders(): Promise<EagleFolder[]>` calling `/api/folder/listRecent`.
  * Add `createFolder(params: { folderName: string; parent?: string }): Promise<EagleFolder | null>` calling `/api/folder/create`.
  * *Implements Requirement 2.1, 4.4*

## Phase 2: Folder Picker Modal ("Ask" Mode)
- [x] **Task 2.1: Implement `EagleFolderPickerModal` (`src/modals.ts`)**
  * Create `EagleFolderPickerModal` extending `SuggestModal<EagleFolderPickerItem>`.
  * Query both `/api/folder/list` and `/api/folder/listRecent`.
  * Merge with plugin `recentEagleFolders` setting.
  * Structure suggestions:
    * `type: 'root'` ("📁 Library Root (Uncategorized)")
    * `type: 'recent'` ("🕒 Recent Folders")
    * `type: 'folder'` ("📁 All Folders" with full hierarchy paths)
  * Render styled suggestion items with badges/icons and breadcrumbs.
  * Integrate `prepareFuzzySearch` for real-time search filtering.
  * Handle selection callback (record in `recentEagleFolders`) and cancellation (abort upload).
  * *Implements Requirement 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8*

- [x] **Task 2.2: Add Styles for Folder Picker (`styles.css`)**
  * Add CSS classes for section dividers (`.cmdspace-eagle-picker-section`), root item badge, recent badge, and folder hierarchy breadcrumbs.
  * *Implements Requirement 2.3, 2.4*

## Phase 3: Mirror & Folder Map Services
- [x] **Task 3.1: Implement Folder Resolution Service (`src/main.ts` or helper)**
  * Create unified folder resolver: `resolveEagleFolderForUpload(context?: { activeFile?: TFile | null }): Promise<{ folderId?: string; cancelled?: boolean }>`
  * Implement `mirror` mode:
    * Extract active note relative directory path.
    * Walk segments and find/create folders in Eagle via `api.createFolder()`.
  * Implement `map` mode:
    * Match note directory path using exact match and longest-prefix match.
    * Fallback to `defaultFolder` or root.
  * Implement `target` mode:
    * Return `this.settings.defaultFolder || undefined`.
  * Implement `ask` mode:
    * Open `EagleFolderPickerModal` and await user choice.
  * *Implements Requirement 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.4, 5.5*

## Phase 4: Settings Tab UI Enhancements
- [x] **Task 4.1: Migrate Settings & Add Dropdown (`src/settings.ts`, `src/main.ts`)**
  * In `loadSettings()`, migrate legacy `enableDefaultFolder`:
    * If `enableDefaultFolder === true` and `addFolderMode` not set $\rightarrow$ `addFolderMode = 'target'`.
    * If `enableDefaultFolder === false` and `addFolderMode` not set $\rightarrow$ `addFolderMode = 'target'` with empty defaultFolder.
  * Replace "Eagle target folder" heading and toggle with "When adding an item to Eagle" dropdown.
  * *Implements Requirement 1.1, 1.3*

- [x] **Task 4.2: Build Conditional Settings Sections (`src/settings.ts`)**
  * Target Folder section: Show current folder, "Select Folder" button, and new "Clear" button.
  * Ask Mode section: Show explanation and "Clear Recent History" button.
  * Mirror Mode section: Show explanation.
  * Folder Map section:
    * Render mappings table showing existing mappings.
    * Add "Add Folder Mapping" modal/flow:
      * Let user pick/enter Obsidian vault folder.
      * Let user select Eagle target folder via `EagleFolderModal`.
    * Delete button per mapping row.
  * *Implements Requirement 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3*

## Phase 5: Integration & Upload Call Sites
- [x] **Task 5.1: Wire Resolver to All Add Entry Points (`src/main.ts`)**
  * Update `uploadImageToEagle`: resolve folder before calling `addFromPath`. Abort if cancelled in "Ask" mode.
  * Update `handleCaptureUrl`: resolve folder before `addFromUrl`.
  * Update `handleExcalidrawFilePaste`: resolve folder before Excalidraw Eagle upload.
  * Update `handleDirectEagleImport`: resolve folder before direct import.
  * *Implements Requirement 6.1, 6.2, 6.3, 6.4, 6.5*

## Phase 6: Testing & Documentation
- [x] **Task 6.1: Automated Verification Script**
  * Write test script verifying:
    * Migration of legacy settings.
    * Folder mapping longest-prefix matching.
    * Mirror path segment traversal logic.
- [x] **Task 6.2: Build & Vault Deployment**
  * Run `npm run build` and deploy bundle to local test vaults.
- [x] **Task 6.3: Update Documentation**
  * Update `CHANGELOG.md`, `RELEASE_NOTES.md`, and create walkthrough artifact.
