# Architecture & Design Details

## Settings State Management
We will extend the `CMDSPACEEagleSettings` interface with two new properties:
* `enableBacklinks`: `boolean` (default: false)
* `backlinkDestination`: `'url' | 'note' | 'both'` (default: 'both')

## Advanced URI Construction Logic
To ensure the backlinks are generated safely without crashing when contexts are missing (e.g., pasting into an empty workspace or a file without a UID):
1. **Context Check**: A helper method `getObsidianBacklinkData()` will first verify an active file exists (`app.workspace.getActiveFile()`). If null (e.g., uploading from somewhere with no active note), it gracefully returns null.
2. **Metadata Extraction**:
   * **Vault**: `encodeURIComponent(this.app.vault.getName())`
   * **Path**: `encodeURIComponent(activeFile.path)`
   * **UID**: It will check `metadataCache.getFileCache(activeFile)?.frontmatter` for `uid` or `id`. If neither exists, it will generate a new UUIDv4 (e.g. via `crypto.randomUUID()`) and use `app.fileManager.processFrontMatter` to automatically write the `uid: <uuid>` to the note's frontmatter block before constructing the URI. This guarantees permanent resilience even if the file is moved.
3. **Payload Formatting**:
   * The helper will return an object: `{ website?: string, annotation?: string }` depending on the `backlinkDestination` setting.
   * `website` will be the raw URI.
   * `annotation` will be the formatted markdown string `Linked From Obsidian: [Basename](URI)`.

## API Payload Injection
The `addFromPath` and `addFromURL` methods in the Eagle API service already accept `website` and `annotation` in their parameter interfaces (currently `src/api.ts` defines them). 
We simply spread or explicitly assign the results of `getObsidianBacklinkData()` into the upload options in `src/main.ts`.