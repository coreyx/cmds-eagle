# Architecture & Design: Mirror Folder Button

## 1. Architectural Overview

The "Mirror" button integrates into the "Ask" mode upload modal (`EagleFolderPickerModal`), bridging the interactive picker workflow with the automated vault folder hierarchy mirroring system.

```
+-----------------------------------------------------------------------------------+
| User pastes or drops image into Obsidian and routes to "Eagle (Local)" / "Ask"    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| EagleFolderPickerModal Opens (Two-Pane Split Layout)                              |
| - Left Pane: Image preview, 5-star rating, Name, Description (alt text), Tags     |
| - Right Pane Header: Title, Search bar, AND [🪞 Mirror] Action Button             |
|   (Path preview: "Mirror: Work / Projects / Alpha")                               |
+------------------------------------+----------------------------------------------+
                                     |
                User clicks [🪞 Mirror] (or presses Alt+M)
                                     |
                                     v
+-----------------------------------------------------------------------------------+
| Mirrored Folder Resolution Pipeline                                               |
| 1. Read active note's parent vault directory path (e.g. "Work/Projects/Alpha")   |
| 2. If at vault root -> target = Library Root (undefined)                          |
| 3. If in subfolder -> Fetch Eagle folder tree (GET /api/folder/list)              |
| 4. For each segment ("Work", "Projects", "Alpha"):                                |
|    • Check if folder exists under current parent (case-insensitive)               |
|    • If found: advance current parent ID                                          |
|    • If missing: call POST /api/folder/create { folderName, parent: parentId }    |
| 5. Return target folder ID of the deepest folder                                  |
+------------------------------------+----------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------------+
| Commit Upload with Modal Metadata                                                 |
| - folderId: resolved mirrored Eagle folder ID                                     |
| - folderName: "Mirrored: Work / Projects / Alpha"                                 |
| - name, annotation, tags, star: user edits from modal                             |
| - Modal closes, asset uploaded to Eagle via POST /api/item/addFromPath            |
+-----------------------------------------------------------------------------------+
```

---

## 2. UI Layout & Component Design

### 2.1 Right-Pane Header with Mirror Button
The right pane of `EagleFolderPickerModal` currently contains:
- Title: `"Select Eagle Folder"`
- Search input: `"Type to search or browse tree... (Esc to cancel)"`

We add a dedicated action bar in the header right below the title and above the search bar, featuring the Mirror button and a path preview:

```
+-------------------------------------------------------------------------------+
| SELECT EAGLE FOLDER                                                           |
|                                                                               |
| [ 🪞 Mirror Note Path ]  Work / Projects / Alpha                              |
|                                                                               |
| [ 🔍 Type to search or browse tree...                          ]              |
+-------------------------------------------------------------------------------+
```

### 2.2 Button States & Behavior
1. **Note in Subfolder** (e.g. `Work/Projects/Alpha`):
   * Button text: `🪞 Mirror Note Path` (or `🪞 Mirror Folder`)
   * Subtitle/badge: Shows breadcrumbs `Work / Projects / Alpha`
   * Tooltip: `Create or use matching Eagle folder: Work / Projects / Alpha (Alt+M)`
2. **Note at Vault Root** (`/` or `.`):
   * Button text: `🪞 Mirror (Root)`
   * Subtitle/badge: `Library Root (Uncategorized)`
   * Tooltip: `Save to Eagle Library Root (note is at vault root)`
3. **No Active Note Available** (e.g. paste into canvas or detached leaf without file):
   * Button gracefully falls back to `🪞 Mirror (Root)`.
4. **Execution / Loading State**:
   * While Eagle folders are being inspected/created, button shows a spinner/loading label: `Mirroring...` and disables itself to prevent duplicate submission clicks.

### 2.3 Keyboard Shortcut
* **`Alt+M`** (or `Cmd+M` on macOS): Bounded inside the modal. Pressing this shortcut immediately triggers the Mirror action, matching the modal's quick keyboard navigation philosophy (`↵` for selected folder, `Esc` for cancel, `Alt+M` for mirror).

---

## 3. Hierarchy Resolution Pipeline

The Mirror button reuses the core logic of `resolveMirroredEagleFolder(activeFile)`:

```typescript
private async resolveMirroredEagleFolder(activeFile?: TFile | null): Promise<string | undefined> {
  const file = activeFile ?? this.app.workspace.getActiveFile();
  const folderPath = file?.parent?.path;
  if (!folderPath || folderPath === '/' || folderPath === '.') {
    return undefined; // Library Root
  }

  const segments = folderPath.split('/').map(s => s.trim()).filter(s => s.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  try {
    const eagleFolders = await this.api.listFolders();
    let currentParentId: string | undefined = undefined;
    let currentLevelFolders = eagleFolders;

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
    return undefined;
  }
}
```

---

## 4. Modal Integration Architecture

### 4.1 Supplying Context to `EagleFolderPickerModal`
In `src/main.ts` -> `resolveEagleFolderForUpload`:
When instantiating `EagleFolderPickerModal.pickFolder(...)`, pass:
* `activeFile`: The active `TFile` being edited.
* `activeFolderPath`: `activeFile?.parent?.path || ''`.
* `onMirror`: Callback executing `this.resolveMirroredEagleFolder(activeFile)`.

### 4.2 Modal Execution Handler
Inside `EagleFolderPickerModal`:
```typescript
private async handleMirrorClick(): Promise<void> {
  if (this.resolved) return;
  
  if (this.context?.onMirror) {
    this.setMirrorLoading(true);
    try {
      const folderId = await this.context.onMirror();
      this.resolved = true;
      this.onSelect({
        folderId,
        folderName: this.context.activeFolderPath || 'Library Root',
        cancelled: false,
        name: this.itemName.trim() || this.initialFileName,
        annotation: this.itemDescription.trim() || undefined,
        tags: this.itemTags.length > 0 ? this.itemTags : undefined,
        star: this.starRating > 0 ? this.starRating : undefined,
        mirrored: true,
      });
      this.close();
    } catch (err) {
      this.setMirrorLoading(false);
      new Notice('Failed to mirror folder hierarchy in Eagle.');
    }
  }
}
```

---

## 5. Edge Cases & Resilience

| Scenario | System Handling |
| :--- | :--- |
| **Note is at Vault Root** | Folder path is `/` or `.`. The Mirror button shows `Library Root (Uncategorized)` and resolves to `undefined`, saving to Eagle's root catalog cleanly. |
| **Eagle Offline or Closes Mid-Operation** | `createFolder` or `listFolders` throws an error. The modal catches the error, resets loading state, shows an informational Notice, and keeps the picker open so the user doesn't lose their metadata edits. |
| **Partial Path Exists in Eagle** | If `Work` exists but `Projects/Alpha` does not, the system traverses into `Work`, and only creates `Projects` under `Work`, then `Alpha` under `Projects`. Existing folders are never duplicated. |
| **Case-Insensitive Match** | Matches `work` to `Work` or `PROJECTS` to `Projects` without creating duplicate casing variants. |
| **Multiple Quick Clicks** | Button disables immediately upon first click (`isMirroring = true`) to prevent race conditions in folder creation. |
| **User Edited Metadata Before Clicking Mirror** | All custom Name, Description/Alt Text, 5-star Rating, and Tag Pills entered on the left pane are fully preserved and pushed to Eagle. |
