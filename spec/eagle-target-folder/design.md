# Architecture & Design Details

## Eagle API Constraints Analysis
The Eagle API `addFromPath` endpoint strict requires a `folderId` (a unique string hash), not a plain text folder name. Because of this, simply providing a regular text input for the folder name would require a real-time API lookup on every upload, introducing fragility (what if multiple folders share a name?) and latency. 

Therefore, the design mandates resolving the folder ID *at selection time* via an interactive modal, then persisting both the ID (for the API) and the Name (for the UI) in the settings.

## Settings State Management
We will extend the `CMDSPACEEagleSettings` interface with two new properties alongside the existing `defaultFolder` (which holds the ID):
* `enableDefaultFolder`: `boolean`
* `defaultFolderName`: `string`

## Folder Hierarchy Flattening
The `api.listFolders()` endpoint returns a nested tree of folders (`children: EagleFolder[]`). Because the `EagleFolderModal` expects a flat array to fuzzy search against, the settings UI will implement a recursive flattening function.
* It will traverse the `EagleFolder` tree.
* It will track the path string (e.g., `"Design" -> "Design / Icons" -> "Design / Icons / SVG"`).
* It will output an array of `{ id: string, name: string, path: string }`.

## UI Flow
1. **Toggle Row**: "Save new attachments to a specific Eagle folder" (controls `enableDefaultFolder`).
2. **Folder Selection Row**: Only visibly enabled/useful when the toggle is true. It will show the current `defaultFolderName`.
3. **Modal Invocation**: A "Select Folder" button on the selection row will fetch the folder list from Eagle, flatten it, and instantiate the `EagleFolderModal`.
4. **On Callback**: When the modal resolves, it assigns the chosen `id` and `path` to the plugin settings and re-renders the settings tab.