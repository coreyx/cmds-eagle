# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Canvas Integration**: Pasting or dropping an image or an Eagle item onto an Obsidian Canvas adds it as a card that loads the image by URL instead of saving a vault attachment. A "Card type" setting chooses **Text card** (default; the image plus its metadata card), **Link card**, or **Ask every time**. Cards are placed at the pointer or drop position and sized to the image. Settings are under **Extras → Canvas**, including "Also add new images to Eagle".
- **Excalidraw: Eagle Link Types and Multiple Items**: `eagle://item/…` links are now recognized on Excalidraw drawings, and several items copied from Eagle at once are all added.
- **Excalidraw: Custom URL Prefix**: With "Link embedded images to" set to Custom URL prefix, Eagle items are embedded from your own server and nothing is uploaded.
- **Cloud Copy Embed Mode**: Added a "Cloud copy" option to the image link setting (now "Link embedded images to", previously "Eagle embed URL mode"), the default for new installs. Images added to Eagle are also uploaded to the active cloud provider and the note embeds that URL, so they display on other devices. It applies to paste and drop, search and embed, pasted Eagle links and paths, and converting vault images to Eagle. Without a configured provider, or if the upload fails, the note links to the local file.
- **Reuse of Existing Cloud Files**: In Cloud copy mode, an image pasted or dropped from the WebDAV server itself (under its Server URL or Public URL) is embedded from its existing location instead of being uploaded again, after checking that the public URL serves it.
- **One Cloud Copy per Eagle Item**: Embedding the same Eagle item again reuses its cloud copy instead of uploading another one. Each copy is recorded on the item as a "Cloud Copy" link in Eagle's Extra Links, and on WebDAV copies are stored under a stable name (`<Eagle item ID>.<ext>`) that is looked up before uploading. A recorded copy the server reports as deleted is uploaded again.
- **Eagle Extra Links Setting**: Added a "Use Eagle Extra Links" toggle that turns all use of the Extra Links plugin on or off, with its Base URL, a status line that checks for the plugin whenever the settings open, and a "Test" button. When it is on but the plugin cannot be reached, a warning is shown once per session.
- **Metadata Card for Cloud Uploads**: Pasting or dropping an image and choosing **Cloud** now appends a metadata card (type, size, dimensions, cloud link) below the image when "Include metadata card" is enabled, with the same source links (`Source`, `Direct`, `Source: File`) as cards for Eagle uploads.
- **WebDAV Test Connection**: Added a "Test" button to the WebDAV settings that checks the server login and, for a Nextcloud public share, that the Public URL works without a login. Nothing is uploaded.
- **Nextcloud Share Links as Public URL**: A Nextcloud public share link (`https://host/s/TOKEN` or `/index.php/s/TOKEN`) entered as the WebDAV Public URL is converted to the share's file address (`/public.php/dav/files/TOKEN`) when image links are built. A "Disable Nextcloud share link conversion" toggle in the WebDAV settings turns this off.
- **Docs**: Added a "WebDAV with Nextcloud" section to the `README.md` covering public share setup for embedded images.

### Changed
- **Excalidraw Uses the Normal Import**: New images added to Eagle from an Excalidraw drawing now go through the same import as images pasted into a note, so they get the captured source URL, source links and a "Cloud Copy" record, and Eagle items reuse their single cloud copy instead of being uploaded again. A progress notice is shown while an image is being added. "Also add pasted screenshots to Eagle" is renamed **Also add new images to Eagle**.
- **Settings Reorganized**: The settings are now split into five tabs (Connections, Cloud storage, Adding images, Embedding, Extras) with related options grouped together, and many options have clearer names and descriptions. No setting changed its behaviour or stored value. Notable moves and renames:
  - The metadata card options are together under **Embedding → Metadata card**, and its source-link options no longer disappear when source capture is turned off.
  - "Eagle embed URL mode" is now **Link embedded images to**, "Eagle link paste behavior" is **When pasting an Eagle item**, and "Eagle item link format" is **"Open in Eagle" link format**, all under **Embedding → Image links**.
  - "Default image behavior" is now **When pasting or dropping an image**; "Backlink Mode" is **Save backlinks to**; "Active Cloud Provider" is **Cloud provider**.
  - Re-rendering the settings no longer jumps back to the top of the page.
- **Paste/Drop Destination Dialog**: The "Where to save image?" dialog now lists **Eagle**, **Vault** and **Cloud only** with a one-line description of what each does, including how the note will link to an Eagle image under the current embed mode.
- **Pasted Eagle File Paths**: Pasting a file path from inside the Eagle library (what Eagle copies for an image) is now handled exactly like pasting an Eagle item link: it follows "When pasting an Eagle item" (previously "Eagle link paste behavior"), honours every embed mode including Custom URL prefix, and adds the Obsidian backlink.
- **Extra Links Base URL**: Moved from the Obsidian Backlinks section to the new Eagle Extra Links section.
- **Extra Links Warnings**: A failed backlink no longer shows a notice on every paste; the "not detected" warning appears once per session.
- **WebDAV Password Field**: The WebDAV password is now masked in settings.

### Fixed
- **Images Lost When Pasting Into Excalidraw**: With no cloud provider set up, or when an upload failed, an image pasted or dropped onto an Excalidraw drawing was discarded. The paste is now left to Excalidraw when no shareable URL can be made, and a failed upload saves the image to the vault instead.
- **Backlinks From Non-Markdown Files**: Adding a backlink while a `.canvas` (or other non-Markdown) file was active tried to write a note ID into that file's frontmatter. Such files are now linked by path only and never modified.
- **"No cloud provider configured" With Valid Settings**: Fixed cloud uploads being refused when a provider's credentials were entered in a different order than the settings expected (for example the WebDAV password before the server URL). Whether a provider is configured is now derived from its fields instead of a stored flag.
- **WebDAV Uploads to Nextcloud Failing With 404**: The upload folder is now created when the server answers 404 as well as 409 for a missing folder, and each level of a nested upload path is created in turn.
- **WebDAV Public URL Double Slash**: Fixed image links containing `//` when the Public URL or Server URL ended with a slash.

## [1.8.0] - 2026-10-11

### Changed
- **Renamed to Eagle Bridge**: The plugin is now **Eagle Bridge** with plugin ID `eagle-bridge` (previously CMDS Eagle, `cmds-eagle`). It installs to `.obsidian/plugins/eagle-bridge/` as a separate plugin; to carry settings over, copy `data.json` from `.obsidian/plugins/cmds-eagle/`.
- **Maintainer and Links**: The plugin author is now Corey Struzan, and the settings footer links to this fork's GitHub repository with a credit to the original CMDS Eagle by Yohan Koo.

### Added
- **Configurable Root Folder for Mirrored Hierarchy**: Added a "Place mirrored folders under a root folder" toggle and Eagle folder selector (with "Select Folder" and "Clear" buttons), shown in both **Mirror Obsidian Folder Hierarchy** and **Ask** modes:
  - **Nested Mirroring**: When enabled, mirrored vault folder hierarchies are created under the designated Eagle folder instead of at the library root; notes at the vault root place attachments directly in the designated folder.
  - **Prefixed Breadcrumb Preview**: The folder picker's Mirror button badge and tooltip include the root folder name (e.g. `Obsidian Attachments / Work / Projects`).
  - **Missing Folder Fallback**: If the configured root folder no longer exists in Eagle, a notice is shown and mirroring falls back to the library root.
- **Mirror Folder Button in Folder Picker**: Added a dedicated `🪞 Mirror` button in the `EagleFolderPickerModal` header during paste and drag-and-drop import workflows:
  - **Dynamic Hierarchy Mirroring**: Automatically replicates the active note's vault folder hierarchy in Eagle, recursively creating missing parent and subfolders via Eagle's `/api/folder/create` Web API as needed.
  - **Live Breadcrumb Preview**: Displays an inline path preview (e.g. `Work / Projects / Alpha` or `Library Root`) showing the exact destination folder before clicking.
  - **Metadata Preservation**: Ensures all metadata entered in the picker's left pane (name, description/alt text, 5-star rating, and tags) is preserved and uploaded with the asset.
  - **Keyboard Shortcut**: Full keyboard accessibility via `Alt+M` (or `Cmd+M` on macOS) to mirror and upload in a single keystroke.
- **Image Source URL Capture on Paste & Drop**: Captures origin webpage URLs and direct image asset URLs from clipboard or browser drag-and-drop (`CF_HTML`, `Chromium internal source URL`, `org.chromium.source-url`, `com.apple.webarchive`) and routes them to Eagle's website field and/or Extra Links panel.
- **Source Link in Metadata Card**: Added a 4-way dropdown setting (`none`, `page`, `image`, `both`, defaulting to `page`), allowing users to include the origin webpage URL (`[Source: domain]`), the direct image URL (`[Direct: domain]`), both, or neither in embedded image metadata cards.
- **Local File Source Link in Metadata Card**: Added setting (`includeLocalSourceInMetadataCard`, defaults to `false`) to optionally display a clickable `[Source: File](file://...)` link in the metadata card when images are dragged or pasted directly from the operating system's file manager (Windows File Explorer, macOS Finder).
- **Eagle Item Link Format**: Added a setting (`eagleItemLinkFormat`) defaulting to HTTP localhost format (`http://localhost:41595/item?id=UUID`) with `eagle://item/UUID` protocol as a selectable option.
- **Eagle Extension Mirroring in "Ask" Modal**:
  - **Two-Pane Split Layout**: Redesigned the "Ask" mode upload modal (`EagleFolderPickerModal`) to mirror the official Eagle Extension UI/UX, featuring a desktop-grade 860px two-pane split layout with asset preview & metadata on the left and folder tree navigation on the right.
  - **Image Thumbnail & Dimensions Badge**: Displays a live preview of the dropped, pasted, or local image with an inset dimensions badge (e.g. `800x600`) centered at the bottom over a semi-transparent blur backdrop.
  - **5-Star Ratings Picker**: Interactive 5-star rating selector with hover previews and toggle selection; pushes the rating to Eagle upon upload.
  - **Item Name Field**: "Add Name" input pre-populated with the file name (without extension), supporting in-place editing and quick `Enter` submission.
  - **Description Field with Alt Text Extraction**: "Add Description" textarea automatically pre-populated with HTML `alt` attribute values from browser clipboard or drag-and-drop operations, saved as Eagle annotations/notes.
  - **Tag Pills & Collapsible "+ Add Tag" / "+" Button**: Selected tags are displayed as removable pills with `✕` buttons. The button displays as `+` when tags exist and expands back to `+ Add Tag` when empty. Pre-populates with default tags configured in settings.
  - **2-Column Tag Picker Modal**: Dedicated `EagleTagPickerModal` querying Eagle's `/api/tag/list` and displaying tags and image counts in a 2-column vertical bulleted list (`• TagName (Count)`), sorted alphabetically with real-time search filtering and custom tag creation.
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
- **Docs**: Added a "From BRAT" section to the `README.md` with instructions for installing this fork's releases via BRAT.

### Fixed
- **Webpage Origin URL Extraction on Drag & Drop**: Fixed an issue where dragging and dropping an image from a web browser into Obsidian stored only the direct image URL (e.g., from an image CDN) in Eagle's website field instead of the origin webpage URL when "Source URL priority (Eagle website field)" was configured to "Webpage URL (fallback to image URL)":
  - Added `isDirectImageUrl` classification to identify image asset URLs (e.g., `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, etc., taking query parameters like `?imwidth=1600` into account) and prevent them from masquerading as `pageUrl`.
  - Upgraded drag-and-drop parsing in `handleDrop` to process multi-line `text/uri-list` payloads (RFC 2483), extract `<a href="...">` and `<base href="...">` from HTML payloads, and automatically fall back to the system clipboard text (`clipboard.readText()`) if the webpage URL was copied from the browser address bar.
  - Updated `resolvePrimaryUrl` and Eagle's Extra Links service so that `page-only` and `page-first` priority options accurately distinguish between genuine origin webpage URLs and direct image asset URLs.
- **Image Name Resolution on Paste/Drop**: Fixed an issue where images pasted or dragged from web browsers were genericly named "image" (due to Chromium clipboard assigning `image.png`). The plugin now automatically resolves the real asset filename from the source image URL path (e.g., resolving `2600_HomeforEveryone` from `https://.../2600_HomeforEveryone.jpg`) to pre-populate the Name field in the Ask modal and name the Eagle asset.
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
