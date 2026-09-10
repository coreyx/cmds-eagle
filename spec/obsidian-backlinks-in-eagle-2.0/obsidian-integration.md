# Obsidian Plugin Integration Guide: Eagle Extra Links

This guide provides drop-in TypeScript and JavaScript integration code for Obsidian (obsidian.md) plugins to interact with the **Eagle Extra Links** plugin.

---

## 1. Overview of Integration Patterns

An Obsidian plugin can interact with Eagle Extra Links via two complementary paths:
1. **Primary: Embedded HTTP REST IPC (`127.0.0.1:41598`)**:
   - Works across Windows and macOS without native dependencies.
   - Triggers real-time UI updates inside Eagle's Inspector if the asset is currently selected.
   - Built using Obsidian's native `requestUrl` method.
2. **Fallback: Direct Library Filesystem Write**:
   - Operates even if Eagle is closed or the plugin is inactive.
   - Modifies `<LibraryPath>/images/<itemId>.info/extra-links.json` directly via Node.js `fs.promises`.

---

## 2. Drop-in Obsidian Plugin Helper Class (TypeScript)

```typescript
import { requestUrl, RequestUrlParam, Notice } from 'obsidian';

export interface EagleExtraLinksResponse {
    status: 'success' | 'error';
    itemId?: string;
    links?: string[];
    addedCount?: number;
    alreadyExists?: boolean;
    message?: string;
}

export class EagleExtraLinksClient {
    private baseUrl: string;

    constructor(host: string = '127.0.0.1', port: number = 41598) {
        this.baseUrl = `http://${host}:${port}`;
    }

    /**
     * Check if the Eagle Extra Links IPC server is responsive.
     */
    async isHealthy(): Promise<boolean> {
        try {
            const res = await requestUrl({
                url: `${this.baseUrl}/health`,
                method: 'GET'
            });
            return res.status === 200 && res.json?.status === 'ok';
        } catch {
            return false;
        }
    }

    /**
     * Get all extra links currently associated with an Eagle item.
     */
    async getLinks(itemId: string): Promise<string[]> {
        try {
            const res = await requestUrl({
                url: `${this.baseUrl}/api/item/${encodeURIComponent(itemId)}/links`,
                method: 'GET'
            });
            if (res.status === 200 && res.json?.links) {
                return res.json.links;
            }
            return [];
        } catch (err) {
            console.error(`[EagleExtraLinks] Failed to fetch links for ${itemId}:`, err);
            return [];
        }
    }

    /**
     * Append a URL or Obsidian URI to an Eagle item.
     * Automatically deduplicates on the Eagle side unless allowDuplicates is true.
     * Triggers real-time UI refresh in Eagle if the item is currently open.
     */
    async addLink(itemId: string, url: string, allowDuplicates: boolean = false): Promise<EagleExtraLinksResponse> {
        try {
            const res = await requestUrl({
                url: `${this.baseUrl}/api/item/${encodeURIComponent(itemId)}/links`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, allowDuplicates })
            });
            return res.json as EagleExtraLinksResponse;
        } catch (err) {
            console.error(`[EagleExtraLinks] Failed to add link to ${itemId}:`, err);
            return { status: 'error', message: String(err) };
        }
    }

    /**
     * Replace all extra links for an Eagle item.
     */
    async setLinks(itemId: string, links: string[]): Promise<boolean> {
        try {
            const res = await requestUrl({
                url: `${this.baseUrl}/api/item/${encodeURIComponent(itemId)}/links`,
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ links })
            });
            return res.status === 200;
        } catch (err) {
            console.error(`[EagleExtraLinks] Failed to set links for ${itemId}:`, err);
            return false;
        }
    }
}
```

---

## 3. Example Obsidian Commands

### 3.1 Link Active Note to Eagle Asset by Item ID
```typescript
import { Plugin, App, Modal, Setting, Notice } from 'obsidian';

export default class MyObsidianPlugin extends Plugin {
    client = new EagleExtraLinksClient();

    async onload() {
        this.addCommand({
            id: 'link-active-note-to-eagle-item',
            name: 'Link Active Note to Eagle Asset',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return false;
                if (checking) return true;

                // Prompt user for Eagle Item ID
                new ItemIdPromptModal(this.app, async (itemId) => {
                    const vaultName = this.app.vault.getName();
                    // Construct an Obsidian Advanced URI or standard obsidian URI
                    const obsidianUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(activeFile.path)}`;
                    
                    const success = await this.client.addLink(itemId, obsidianUri);
                    if (success) {
                        new Notice(`Successfully linked "${activeFile.basename}" to Eagle item ${itemId}!`);
                    } else {
                        new Notice(`Failed to link note to Eagle item ${itemId}. Is Eagle running?`);
                    }
                }).open();
            }
        });
    }
}

class ItemIdPromptModal extends Modal {
    onSubmit: (itemId: string) => void;
    itemId: string = '';

    constructor(app: App, onSubmit: (itemId: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: 'Link to Eagle Item' });

        new Setting(contentEl)
            .setName('Eagle Item ID')
            .setDesc('Enter the ID of the Eagle item (e.g. MTSPUNN17LBUG)')
            .addText((text) =>
                text.onChange((value) => {
                    this.itemId = value.trim();
                })
            );

        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText('Attach Link')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(this.itemId);
                })
        );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
```

### 3.2 Automated Backlinks on Note Paste (Naive Integration Pattern)

When users copy an asset from Eagle and paste it into an Obsidian note, an Obsidian plugin can intercept the paste event and register the note's UID backlink in Eagle:

```typescript
// Example: In an Obsidian editor paste handler
app.workspace.on('editor-paste', async (evt: ClipboardEvent, editor: Editor, view: MarkdownView) => {
    const activeFile = view.file;
    if (!activeFile) return;

    // Get note unique ID from frontmatter
    const frontmatter = app.metadataCache.getFileCache(activeFile)?.frontmatter;
    const noteUid = frontmatter?.uid;
    const vaultName = encodeURIComponent(app.vault.getName());

    // If an Eagle item ID is extracted from the clipboard content:
    const eagleItemId = extractEagleItemId(evt.clipboardData);
    if (eagleItemId && noteUid) {
        const backlinkUri = `obsidian://adv-uri?vault=${vaultName}&uid=${noteUid}`;
        
        // Naively send POST without pre-checking:
        // Eagle Extra Links handles deduplication automatically!
        const result = await eagleClient.addLink(eagleItemId, backlinkUri);
        if (result.status === 'success') {
            if (result.alreadyExists) {
                console.log(`[Eagle] Backlink already exists for ${eagleItemId}, skipped.`);
            } else {
                new Notice(`Added Obsidian backlink to Eagle item ${eagleItemId}`);
            }
        }
    }
});
```

---

## 4. Offline Direct Filesystem Fallback (Node.js in Obsidian)

If Eagle is not currently open, Obsidian plugins have Node.js runtime access and can write directly to the item's `.info` directory:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export async function addLinkDirectlyToFile(
    libraryPath: string, // e.g. "C:/Users/.../Main.library"
    itemId: string,
    url: string
): Promise<boolean> {
    try {
        const itemInfoDir = path.join(libraryPath, 'images', `${itemId}.info`);
        const sidecarPath = path.join(itemInfoDir, 'extra-links.json');

        let links: string[] = [];
        try {
            const raw = await fs.readFile(sidecarPath, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data.links)) {
                links = data.links;
            }
        } catch {
            // File does not exist yet; start with empty array
        }

        if (!links.includes(url)) {
            links.push(url);
        }

        const payload = {
            version: 1,
            itemId,
            links,
            updatedAt: Date.now()
        };

        await fs.writeFile(sidecarPath, JSON.stringify(payload, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Failed to write extra-links.json directly:', err);
        return false;
    }
}
```
