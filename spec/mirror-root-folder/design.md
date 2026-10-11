# Architecture & Design: Mirror Root Folder

## 1. Architectural Overview

The Mirror Root Folder feature allows users to scope all automated Obsidian-to-Eagle folder mirroring under a designated Eagle root folder (such as `"Obsidian Attachments"`). This prevents Obsidian vault folder structures from being mixed in at the root level of Eagle alongside other project folders.

```
+---------------------------------------------------------------------------------------------------+
| Plugin Settings Tab                                                                               |
| - addFolderMode = 'mirror' OR 'ask'                                                               |
|   ├── [Toggle] Place mirrored folders under a root folder (enableMirrorRootFolder)                |
|   └── [Folder Selector] Mirrored root folder: "Obsidian Attachments" (mirrorRootFolder)           |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      | Trigger: "Mirror Obsidian Mode" OR [🪞 Mirror] in Ask |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      | Folder Hierarchy Resolution (resolveMirroredEagleFolder)
                      +-------------------------------------------------------+
                                                  |
                        Is enableMirrorRootFolder enabled with valid folder?
                                 /                         \
                               YES                          NO
                              /                              \
                             v                                v
+---------------------------------------------+   +---------------------------------------------+
| Root Folder Mode Active                     |   | Eagle Library Root Mode (Default)           |
| baseParentId = settings.mirrorRootFolder    |   | baseParentId = undefined                    |
|                                             |   |                                             |
| Note at vault root?                         |   | Note at vault root?                         |
|   -> Target = baseParentId                  |   |   -> Target = undefined (Library Root)      |
|                                             |   |                                             |
| Note in subfolders (e.g. "Work/Projects")?  |   | Note in subfolders (e.g. "Work/Projects")?  |
|   -> Resolve/create "Work" under root       |   |   -> Resolve/create "Work" at Eagle root    |
|   -> Resolve/create "Projects" under "Work" |   |   -> Resolve/create "Projects" under "Work" |
|   -> Target = "Projects" ID                 |   |   -> Target = "Projects" ID                 |
+---------------------------------------------+   +---------------------------------------------+
```

---

## 2. Settings Tab UI Design

### 2.1 Rendering in "Mirror Obsidian Folder Hierarchy" Mode
When `this.plugin.settings.addFolderMode === 'mirror'`:

```
+---------------------------------------------------------------------------------------+
| Folder hierarchy mirroring                                                            |
| Automatically creates and mirrors the active note's folder hierarchy inside Eagle.   |
|                                                                                       |
| Place mirrored folders under a root folder                                    [ ON ]  |
| Nest all mirrored folders under a designated Eagle folder instead of library root.    |
|                                                                                       |
| Mirrored root folder                                                                  |
| Obsidian Attachments                             [ Select Folder ]   [ Clear ]        |
+---------------------------------------------------------------------------------------+
```

### 2.2 Rendering in "Ask" Mode
When `this.plugin.settings.addFolderMode === 'ask'`:

The "Ask" mode settings panel retains its existing recent history counter and clear button, and now additionally displays the mirror root folder controls directly below, since the `🪞 Mirror` button in the picker relies on this setting:

```
+---------------------------------------------------------------------------------------+
| Folder prompt                                                                         |
| Prompts you with a searchable folder picker before each upload... [Clear Recent]      |
|                                                                                       |
| Place mirrored folders under a root folder                                    [ ON ]  |
| When using the 'Mirror' button in the folder picker, nest folders under a root folder.|
|                                                                                       |
| Mirrored root folder                                                                  |
| Obsidian Attachments                             [ Select Folder ]   [ Clear ]        |
+---------------------------------------------------------------------------------------+
```

### 2.3 Required Folder Selection State
When the toggle is switched **ON** but no folder has been chosen yet:
* Description text updates to: `No folder selected (Required)`.
* Text color can be highlighted with `var(--text-error)` or an informational callout.
* If user attempts an upload while unconfigured, an informational notice directs them to select a root folder in settings, falling back safely to library root.

```
+---------------------------------------------------------------------------------------+
| Mirrored root folder                                                                  |
| ⚠️ No folder selected (Required)                  [ Select Folder ]   [ Clear ]        |
+---------------------------------------------------------------------------------------+
```

### 2.4 Folder Selection Interaction
1. Clicking **"Select Folder"**:
   - Checks connection via `api.isConnected()`. If not running, presents notice `"Eagle is not running. Please start Eagle and try again."`.
   - Fetches Eagle folders using `api.listFolders()`.
   - Flattens the hierarchy using `flattenEagleFolders(folders)`.
   - Opens `EagleFolderModal(this.app, flattened, async (folderId) => { ... })`.
   - On choose: assigns `settings.mirrorRootFolder = selected.id` and `settings.mirrorRootFolderName = selected.path`.
   - Saves settings and calls `this.display()` to re-render.
2. Clicking **"Clear"**:
   - Resets `settings.mirrorRootFolder = ''` and `settings.mirrorRootFolderName = ''`.
   - Saves settings and refreshes UI.

---

## 3. Folder Hierarchy Resolution Engine

### 3.1 Updated `resolveMirroredEagleFolder` Flow

```typescript
private async resolveMirroredEagleFolder(activeFile?: TFile | null): Promise<string | undefined> {
    const file = activeFile ?? this.app.workspace.getActiveFile();
    const folderPath = file?.parent?.path;
    const isVaultRoot = !folderPath || folderPath === '/' || folderPath === '.';

    const isRootFolderEnabled = this.settings.enableMirrorRootFolder && !!this.settings.mirrorRootFolder;
    const rootFolderId = isRootFolderEnabled ? this.settings.mirrorRootFolder : undefined;

    // Case 1: Active note is at vault root
    if (isVaultRoot) {
        // If root folder is enabled, place item directly inside the designated root folder
        return rootFolderId; // (returns rootFolderId or undefined for Library Root)
    }

    const segments = folderPath.split('/').map(s => s.trim()).filter(s => s.length > 0);
    if (segments.length === 0) {
        return rootFolderId;
    }

    try {
        const eagleFolders = await this.api.listFolders();
        let currentParentId: string | undefined = rootFolderId;
        let currentLevelFolders: EagleFolder[] = [];

        if (rootFolderId) {
            // Find the configured root folder in Eagle to get its child folders
            const rootFolderNode = this.findFolderInTree(eagleFolders, rootFolderId);
            if (!rootFolderNode) {
                console.warn(`[CMDS Eagle] Configured mirror root folder ID '${rootFolderId}' not found in Eagle. Falling back to root.`);
                new Notice('Configured Eagle mirror root folder was not found. Using Library Root.');
                currentParentId = undefined;
                currentLevelFolders = eagleFolders;
            } else {
                currentLevelFolders = rootFolderNode.children || [];
            }
        } else {
            currentLevelFolders = eagleFolders;
        }

        // Recursively match or create path segments
        for (const segment of segments) {
            const matchedFolder = currentLevelFolders.find(
                f => f.name.toLowerCase() === segment.toLowerCase()
            );

            if (matchedFolder) {
                currentParentId = matchedFolder.id;
                currentLevelFolders = matchedFolder.children || [];
            } else {
                const created: EagleFolder | null = await this.api.createFolder({
                    folderName: segment,
                    parent: currentParentId,
                });
                if (!created || !created.id) {
                    console.warn(`[CMDS Eagle] Failed to create mirrored folder '${segment}' in Eagle`);
                    break;
                }
                currentParentId = created.id;
                currentLevelFolders = [];
            }
        }

        return currentParentId;
    } catch (error) {
        console.error('[CMDS Eagle] Error during folder hierarchy mirroring:', error);
        return rootFolderId;
    }
}
```

---

## 4. Folder Picker Modal Breadcrumb Integration

In `EagleFolderPickerModal`, the Mirror action bar path badge reflects the target destination including the root folder:

### 4.1 Path Display Calculation

```typescript
function computeMirrorPathDisplay(activeFolderPath?: string, rootFolderName?: string): string {
    const trimmedPath = activeFolderPath?.trim();
    const vaultSegments = trimmedPath ? trimmedPath.split('/').filter(s => s.length > 0) : [];

    if (rootFolderName && rootFolderName.trim().length > 0) {
        if (vaultSegments.length === 0) {
            return rootFolderName;
        }
        return `${rootFolderName} / ${vaultSegments.join(' / ')}`;
    }

    if (vaultSegments.length === 0) {
        return 'Library Root';
    }
    return vaultSegments.join(' / ');
}
```

### 4.2 Display Scenarios

| `enableMirrorRootFolder` | `mirrorRootFolderName` | Note Vault Location | Mirror Path Preview |
|---|---|---|---|
| `false` | *Ignored* | Root (`/`) | `Library Root` |
| `false` | *Ignored* | `Work/Projects` | `Work / Projects` |
| `true` | `Obsidian Attachments` | Root (`/`) | `Obsidian Attachments` |
| `true` | `Obsidian Attachments` | `Work/Projects` | `Obsidian Attachments / Work / Projects` |
| `true` | *(None selected)* | `Work/Projects` | `Work / Projects` *(fallback)* |

---

## 5. Edge Cases & Handling

1. **Eagle Not Running when Selecting Folder**:
   - Handled cleanly via `api.isConnected()` with immediate user notification.
2. **Eagle Root Folder Deleted in Eagle by User**:
   - Detected during `resolveMirroredEagleFolder()` via `findFolderInTree`. If not found, gracefully alerts the user and falls back to root-level mirroring instead of throwing errors or halting upload.
3. **Toggle Enabled but User Leaves Folder Blank**:
   - UI clearly flags the field as `(Required)` in settings.
   - Mirror resolution gracefully falls back to root library if `mirrorRootFolder` is empty.
4. **Active Note without Vault File (e.g. Canvas or New Untitled Note)**:
   - Evaluates to vault root, cleanly routing to `mirrorRootFolder` (if enabled) or Library Root (if disabled).
