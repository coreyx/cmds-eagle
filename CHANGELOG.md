# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Image Source URL Capture on Paste & Drop**: Captures origin webpage URLs and direct image asset URLs from clipboard or browser drag-and-drop (`CF_HTML`, `Chromium internal source URL`, `org.chromium.source-url`, `com.apple.webarchive`) and routes them to Eagle's website field and/or Extra Links panel.
- **Source Link in Metadata Card**: Added a 4-way dropdown setting (`none`, `page`, `image`, `both`, defaulting to `page`), allowing users to include the origin webpage URL (`[Source: domain]`), the direct image URL (`[Direct: domain]`), both, or neither in embedded image metadata cards.
- **Local File Source Link in Metadata Card**: Added setting (`includeLocalSourceInMetadataCard`, defaults to `false`) to optionally display a clickable `[Source: File](file://...)` link in the metadata card when images are dragged or pasted directly from the operating system's file manager (Windows File Explorer, macOS Finder).
- **Eagle Item Link Format**: Added a setting (`eagleItemLinkFormat`) defaulting to HTTP localhost format (`http://localhost:41595/item?id=UUID`) with `eagle://item/UUID` protocol as a selectable option.
- **Target Folder 2.0 (Folder Routing Options)**: Replaced the static target folder toggle with a unified dropdown setting ("When adding an item to Eagle") offering 4 powerful workflow modes:
  - **Ask**: Displays an interactive modal picker before each upload (similar to the Eagle Chrome extension) with:
    - **Expandable / Collapsible Folder Tree**: Browse your library as an interactive hierarchical tree with chevrons (`▶` / `▼`), depth indentation, and child folder count badges.
    - **Quick Expand/Collapse Actions**: "Expand all" and "Collapse all" buttons for navigating large libraries effortlessly.
    - **Recent Folders**: Preserved "RECENT FOLDERS" section combining Eagle Web API `/api/folder/listRecent` and Obsidian-picked history.
    - **Library Root**: Pinned "Library Root (Uncategorized)" option for direct root library storage.
    - **Real-Time Search**: Instant filtering across all folders with full breadcrumb paths (`Parent / Child / Folder`).
    - **Full Keyboard Navigation**: Navigate with `↑`/`↓`, expand with `→`, collapse with `←`, select with `↵`, and cancel with `esc`.
  - **Add to Target Folder**: Automatically routes uploads to a designated Eagle folder, with a "Clear" button to easily reset to root.
  - **Mirror Obsidian Folder Hierarchy**: Dynamically mirrors the active note's relative vault path in Eagle, automatically creating matching parent and subfolders via Eagle's `/api/folder/create` Web API as needed.
  - **Use Folder Map**: Enables custom mapping rules matching Obsidian vault directories to specific Eagle folders, with longest-prefix inheritance for nested subfolders.
- **Default Eagle Tags**: Added a setting to automatically append a comma-separated list of tags to every image uploaded to Eagle.
- **Obsidian Backlinks in Eagle**: Added a setting to automatically generate an Obsidian Advanced URI backlink to the current note when adding a new image to Eagle. The backlink can be saved to the image's URL field, Note field, or both. If the active note lacks a unique identifier (`uid`), one is automatically generated and saved to its frontmatter to ensure the link never breaks.
- **Docs**: Added a "Development & Testing" section to the `README.md` with instructions for compiling, installing, and testing local builds.

### Fixed
- **Folder Picker Selection**: Fixed an issue in the Ask mode folder picker where choosing a folder could prematurely trigger "Upload cancelled" due to modal dismissal timing.
- **Metadata Card Image Source Link**: Resolved an issue where the source link was not added to the metadata card even when "Include source in metadata card" was enabled:
  - Sanitized null bytes (`\0`) returned by Windows Electron clipboard (`Chromium internal source URL`), preventing broken CommonMark link syntax in Obsidian.
  - Passed in-memory clipboard `sourceInfo` directly to the metadata card generator instead of relying solely on Eagle's asynchronous metadata write round-trip.
  - Added multi-tier source resolution falling back to `extra-links.json` on disk if Eagle's primary URL field holds an Obsidian backlink.
  - Filtered out non-HTTP schemes (such as `obsidian://`) from being mislabeled as web sources.
- **Browser Drag & Drop Source Extraction**: Fixed drag & drop handler (`handleDrop`) to extract `text/uri-list` and `text/html` browser metadata from `dataTransfer` when images are dragged from a browser into Obsidian.
- **Paste/Drop to Eagle**: Fixed an issue where the "Include metadata card" setting was ignored when directly pasting or dropping a new image to Eagle, preventing the metadata info block (type, size, tags, Eagle link) from being appended below the image in Obsidian.
- **Local Paste/Drop**: Fixed an issue where local vault embeds could generate invalid markdown links with double slashes (e.g., `//image.png`) when saved to the root of the vault, causing broken image renders.
- **WebDAV**: Migrated the upload client from the browser's `fetch` API to Obsidian's native `requestUrl` to correctly bypass CORS restrictions.
- **WebDAV**: Resolved `409 Conflict` errors by automatically creating missing parent directories (`MKCOL`) on the server before retrying the upload.
- **WebDAV**: Fixed URL path construction to prevent malformed requests (e.g., double slashes) regardless of how the user formats their server URL or upload path.
- **WebDAV**: Improved error messages to explicitly warn users if their configured upload path cannot be created or accessed on the remote server.
- **WebDAV**: Ensured the file's raw binary buffer is correctly passed into the `PUT` body for standard WebDAV compatibility.
