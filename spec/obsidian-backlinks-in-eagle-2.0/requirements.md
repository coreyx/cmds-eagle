# Requirements: Obsidian Backlinks in Eagle 2.0

## 1. Feature Configuration & Modes
**The system shall** provide a configurable backlink system with support for both the Eagle Extra Links REST API and legacy Eagle native fields.
* **User Story**: As a user, I want to choose between the new Eagle Extra Links plugin for multi-link support or legacy fields for standard Eagle setups, so I can integrate cleanly regardless of my Eagle setup.
* **Acceptance Criteria**:
  * **1.1**: A toggle labeled "Enable Obsidian Backlinks in Eagle" exists in settings (`enableBacklinks`).
  * **1.2**: When enabled, a dropdown labeled "Backlink Mode" allows selecting between:
    * `Eagle Extra Links Plugin (REST API)` (`'extra-links'`)
    * `Eagle Native Fields (Website / Note)` (`'legacy'`)
  * **1.3**: When `extra-links` mode is active, an input field labeled "Eagle Extra Links Base URL" is shown, defaulting to `http://127.0.0.1:41598` (`extraLinksBaseUrl`).
  * **1.4**: When `legacy` mode is active, the existing destination dropdown is shown with options: "URL/Link Field", "Note/Annotation Field", or "Both" (`backlinkDestination`).
  * **1.5**: All settings are persisted to `data.json`.

## 2. Trigger Points (Dual Triggers)
**The system shall** trigger backlink generation on both image uploads and Eagle link pastes into Obsidian notes.
* **User Story**: As a user, I want backlinks created both when I add new assets to Eagle from Obsidian and when I paste existing Eagle item links into notes, keeping bi-directional links synchronized.
* **Acceptance Criteria**:
  * **2.1**: **On Upload**: When a new image is added to Eagle via paste, drop, Excalidraw, or local file upload, a backlink is registered if backlinks are enabled.
  * **2.2**: **On Link Paste**: When an existing Eagle item link is pasted into an active Obsidian note, a backlink is registered if backlinks are enabled.
  * **2.3**: If there is no active note (e.g., upload outside note context), the backlink creation is gracefully skipped without error.

## 3. Obsidian Advanced URI Generation
**The system shall** construct a resilient Obsidian Advanced URI linking directly to the active note.
* **User Story**: As a user, I want the backlink in Eagle to open the exact Obsidian note across multiple vaults and even if the note is renamed or moved.
* **Acceptance Criteria**:
  * **3.1**: Retrieves the current vault name and URL-encodes it: `vault=<vault_name>`.
  * **3.2**: Retrieves the active file's path and URL-encodes it: `filepath=<file_path>`.
  * **3.3**: Checks the active note's frontmatter for an existing `id` (or fallback `uid`). If missing, generates a standard UUIDv4 and persists it to the note's frontmatter as `id` (removing any redundant `uid` if present) via `app.fileManager.processFrontMatter`.
  * **3.4**: Constructs the Advanced URI format: `obsidian://adv-uri?vault=<vault_name>&uid=<id>&filepath=<file_path>`.
  * **3.5**: Uses the active note's filename (`activeFile.basename`) as the backlink title.

## 4. Eagle Extra Links REST API Integration
**When** backlink mode is set to `extra-links`, **the system shall** append the backlink via the Eagle Extra Links REST API.
* **User Story**: As a user, I want backlinks appended without overwriting existing links or disturbing manual link order in Eagle.
* **Acceptance Criteria**:
  * **4.1**: Sends a `POST /api/item/:id/links` request to the configured `extraLinksBaseUrl` (e.g. `http://127.0.0.1:41598/api/item/<itemId>/links`) using Obsidian's `requestUrl`.
  * **4.2**: The request payload includes:
    ```json
    {
      "title": "<note_basename>",
      "url": "<advanced_uri>",
      "allowDuplicates": false
    }
    ```
  * **4.3**: Uses `POST` with built-in deduplication so existing links are preserved and duplicate URLs are skipped without error.
  * **4.4**: If the Extra Links server is unreachable or returns an error, the system displays an Obsidian Notice: `"Eagle Extra Links plugin is unreachable. Please ensure the Extra Links plugin is installed in Eagle and its IPC server is toggled on."` and logs the error to console without breaking the primary operation (e.g., the paste or upload still completes).

## 5. Legacy Native Fields Compatibility
**When** backlink mode is set to `legacy`, **the system shall** maintain backward compatibility with Eagle 1.0 backlink behavior.
* **User Story**: As a user without the Extra Links plugin, I want to continue using the single URL and/or Note fields on Eagle items.
* **Acceptance Criteria**:
  * **5.1**: If destination is `url` or `both`, sets the `website` property in the Eagle item payload to the Advanced URI.
  * **5.2**: If destination is `note` or `both`, formats the annotation as `Linked From Obsidian: [<basename>](<advanced_uri>)` and sets the `annotation` property in the Eagle item payload.
