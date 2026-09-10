# Architecture & Design Details: Obsidian Backlinks in Eagle 2.0

## 1. Overview
The Obsidian Backlinks in Eagle 2.0 feature connects Obsidian notes to Eagle assets bi-directionally. It supports two modes:
1. **Eagle Extra Links Mode (`extra-links`)**: Uses the new `eagle-extra-links` plugin running on `http://127.0.0.1:41598` to append backlinks to Eagle items without disrupting single-value properties like `website` or manual link ordering.
2. **Legacy Native Fields Mode (`legacy`)**: Preserves the 1.0 behavior by writing the Advanced URI into Eagle's `website` and/or `annotation` fields.

Backlinks are triggered under two distinct workflows:
- **On Upload**: When adding a new image/asset into Eagle from Obsidian.
- **On Paste**: When pasting an existing Eagle link into an Obsidian note.

---

## 2. Settings Schema & UI Flow

### Extended Settings in `src/types.ts`:
```typescript
export type BacklinkMode = 'extra-links' | 'legacy';

export interface CMDSPACEEagleSettings {
  // ... existing settings
  enableBacklinks: boolean;
  backlinkMode: BacklinkMode;
  extraLinksBaseUrl: string; // default: 'http://127.0.0.1:41598'
  backlinkDestination: 'url' | 'note' | 'both'; // legacy mode
}
```

### Settings Tab Flow (`src/settings.ts`):
- **Enable Backlinks Toggle**:
  - Off: All backlink actions are bypassed.
  - On:
    - **Backlink Mode Dropdown**:
      - `Eagle Extra Links Plugin (REST API)` -> Displays **Eagle Extra Links Base URL** text input (`http://127.0.0.1:41598`).
      - `Eagle Native Fields (Legacy)` -> Displays **Backlink Destination** dropdown (`url` | `note` | `both`).

---

## 3. Backlink Generation Pipeline

### Step 1: Active Context & UID Resolution
```typescript
interface BacklinkData {
  title: string;
  advancedUri: string;
}
```
1. `app.workspace.getActiveFile()` is checked. If `null`, generation exits gracefully.
2. `vaultName = encodeURIComponent(app.vault.getName())`.
3. `filePath = encodeURIComponent(activeFile.path)`.
4. Check frontmatter for `id` (or fallback `uid`). If missing:
   - Generate UUIDv4: `crypto.randomUUID()`.
   - Update frontmatter using `app.fileManager.processFrontMatter(activeFile, fm => { if (!fm.id) fm.id = newId; delete fm.uid; })`.
5. Construct Advanced URI: `obsidian://adv-uri?vault=${vaultName}&uid=${id}&filepath=${filePath}`.
6. Return `{ title: activeFile.basename, advancedUri }`.

### Step 2: Dispatching to Target Mode
When creating a backlink for `itemId`:
- If `settings.backlinkMode === 'extra-links'`:
  - Call `EagleApiService.addExtraLinks(baseUrl, itemId, [{ title, url: advancedUri }])`.
  - If request fails (server down or error status):
    - Show `new Notice('Eagle Extra Links plugin is unreachable. Please ensure the Extra Links plugin is installed in Eagle and its IPC server is toggled on.')`.
    - Log error to console.
    - Do not throw uncaught exceptions.
- If `settings.backlinkMode === 'legacy'`:
  - On upload: Injects `website` and/or `annotation` into the `addFromPath` / `addFromUrl` payload.
  - On link paste: Calls Eagle API `/api/item/update` to append/set `website` or `annotation` if configured.

---

## 4. Integration Call Sites

1. **New Image Upload (`uploadImageToEagle`, `uploadLocalImageToEagle`, Excalidraw)**:
   - If `extra-links` mode: Post-upload step calls `this.applyObsidianBacklink(itemId)`.
   - If `legacy` mode: Payload preparation calls `this.getEagleBacklinkPayload()` to include `website` and `annotation`.
2. **Eagle Link Paste (`handleEagleUrlPaste`)**:
   - In both embed and inline actions, once the Eagle `itemId` is resolved:
   - Call `this.applyObsidianBacklink(itemId)`.
