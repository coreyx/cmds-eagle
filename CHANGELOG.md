# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Export and Import Settings**: Under **Settings → Extras**, save every setting to a `.json` file or the clipboard, and load one again. Passwords and API keys are left out of an export unless "Include passwords and API keys" is turned on. An import first shows the name of each setting that would change and waits for confirmation; it only replaces what the file contains, so a file without credentials keeps the ones already saved. Settings the running version does not know are skipped and listed, and a plain copy of `data.json` can be imported too.

## [1.13.0] - 2026-10-12

### Added
- **A Setting for Each Part of the Metadata Card**: Under **Settings → Embedding → Metadata card**, the file type, file size, dimensions, cloud or local icon, "Open in Eagle" link and cloud link can each be turned off, alongside the existing settings for tags, source links and the local file link. All are on by default, so existing cards are unchanged. A row with nothing left in it is dropped, and with every part off no card is added.
- **Metadata Card Preview**: The settings show the card as it is currently set up, updating as parts are turned on and off.

### Changed
- **Cards Inserted With Links and From Search**: The larger card inserted with a link to an item, and the one-line card added by search, follow the same per-part settings.

## [1.12.0] - 2026-10-12

### Added
- **Custom URL Address Format**: A setting under **Settings → Embedding**, shown once a Custom URL prefix is set. **Item ID** (the default) writes an item's address as `<prefix>/item/<ID>/<name>.<ext>`, which keeps working when the item or the library is renamed and needs a server that looks items up by ID, such as Eagle Serve. **Library path** writes `<prefix>/<Library>.library/images/<ID>.info/<name>.<ext>` as before, for any web or WebDAV server. A prefix saved before this setting existed stays on Library path.
- **Include the File Name**: With the Item ID format, a toggle (on by default) for whether the address ends with the item's file name. Off, the address is just `<prefix>/item/<ID>`.
- **Embedded Image Size**: Choose between the full-size image (default) and the thumbnail Eagle keeps beside an item. It applies to Custom URL prefix and file path links; a cloud copy is always full size, and an item Eagle made no thumbnail for is embedded full size. The "Embed thumbnail" toggle in the "Paste Eagle item" dialog starts from this setting.

### Fixed
- **"Embed Thumbnail" Toggle Never Appeared**: The "Paste Eagle item" dialog only offered the toggle when Eagle reported `noThumbnail: false`, but Eagle leaves that field out for items that have a thumbnail. The toggle is now offered for every item except those Eagle made no thumbnail for.

## [1.11.0] - 2026-10-12

### Added
- **Hint Templates**: A **Templates** list beside the AI hints box adds a ready-made hint to the box, where it can still be edited. Seven are built in (Subjects, Art style and medium, Characters and people, Places and setting, Series and franchise, Colors and mood, Screenshot), and the list can be renamed, reworded, extended or reset under **Settings → AI → Hint templates**.
- **Hints Can Steer the Suggestions**: A hint may say what you want as well as what the image is, for example "Only tag the character races". The request now tells the model to follow such instructions.
- **Tooltips for Long Tags**: Hovering a tag pill in the Eagle folder dialog, or a row in the Add Tag list, shows the whole tag when its text is cut short.
- **New Tag Format Setting**: **Settings → AI → Tag suggestions → New tag format** decides how a tag that is not in your library yet is written. For a library with prefixed tags: "Follow the library's mix" (the default: a new tag takes one of your prefixes when one fits and is left plain otherwise), "Always use a prefix" (every new tag gets one, a new prefix being made if none of yours fits) or "Never use a prefix" (every new tag is plain).
- **Your Own Tag Examples**: The fourth New tag format choice, "Use my own examples", shows an **Example new tags** field. New tags copy the form of the examples typed there, whatever the library does, which also covers a library with no tags yet.

- **Also Upload to the Cloud, per Image**: The "Where to save image?" dialog and the "Paste Eagle item" dialog have an **Also upload to the cloud** toggle, labelled with your provider's name. With it on, an image saved to Eagle also gets a cloud copy and the Eagle button reads "Eagle + <provider>". The toggle starts from **Settings → Embedding → Also upload to the cloud** and changes only that image unless **Remember this choice** is on.
- **Always Use Custom URL Prefix**: An override under **Settings → Embedding**, shown once a prefix is set, that links to your own server even when an image has a cloud copy.
- **Offer the Vault as a Destination**: A toggle under **Settings → Adding images**, off by default. While it is off, "Vault" does not appear in the paste dialog or in the destination setting. If "Save to vault" was already your saved choice, the toggle is turned on for you and nothing changes.
- **Warnings for Links That Only Work Here**: With no Custom URL prefix set, the paste dialog says when the note would link to a file on this computer only, settings shows a warning under the empty prefix field, and a notice appears the first time an embed falls back to a file path in a session.

### Changed
- **What an Embedded Eagle Image Links To**: The "Link embedded images to" setting (Cloud copy / Custom URL prefix / Local file path) is replaced by a rule applied per image: the cloud copy when the image has one, otherwise your Custom URL prefix, otherwise the file path on this computer. An item that already has a cloud copy links to it even when nothing is uploaded this time. Existing settings are carried over: "Cloud copy" becomes **Also upload to the cloud** on, "Custom URL prefix" keeps your prefix with uploading off, and "Local file path" becomes uploading off.
- **Custom URL Prefix Is Empty by Default**: It used to hold `https://localhost:8080` even when unused. That unused default is cleared on upgrade; a prefix you were using or had typed is kept. If you used "Local file path" and had also typed a prefix, embeds now use that prefix: clear the field to keep linking by file path.
- **Excalidraw and Canvas**: Pasted Eagle items and new images get the same link as in a note. With no Custom URL prefix a cloud copy is still made, since these surfaces cannot use a file path.
- **Taller Eagle Folder Dialog**: The dialog is 100 pixels taller, so the left pane no longer needs a scrollbar now that it holds the AI hints box.
- **Tag Format Read From the Library**: The prefix form for new tags is no longer assumed to be `Prefix: value`. The separator your library uses is detected with its exact spacing (`Topic: AI`, `Topic:AI`, `topic/ai`, `Topic - AI` and similar), and the request gives your prefixes as patterns to fill in so the form holds when a hint steers the suggestions. Under the default setting a prefix rule applies only when a meaningful share of your tags are prefixed (15% or more), and ordinary hyphenated tags such as `sci-fi` are never read as prefixes.
- **Minimum Obsidian Version**: Now 1.5.7 (was 1.5.0), for the function that places a vault attachment according to Obsidian's own settings.

### Removed
- **Cross-Platform Paths**: The feature that rewrote `file://` image links between registered computers, its "Convert cross-platform image paths in current note" command and its settings are gone. It only handled libraries inside a user folder on drive `C:`, rewrote note files as they were opened, and could mangle paths. Cloud copies and the Custom URL prefix give links that work on every device without changing your notes. Existing `file://` links in notes are left as they are.

### Fixed
- **Temporary Files Piling Up in the Vault**: Every image sent to Eagle or to the cloud was first copied into a hidden `.eagle-temp` folder in the vault and never deleted. A cloud-only upload now removes its copy as soon as it finishes, and copies handed to Eagle are cleared out once they are an hour old, including those already there.
- **Saving to the Vault Ignored Obsidian's Settings**: Choosing "Vault" always wrote a Markdown link with a full path and a timestamped file name. It now uses the vault's attachment folder, link style (wikilinks or Markdown) and path style, names a clipboard image "Pasted image <time>" as Obsidian does, and replaces characters such as `#` that would break the link.
- **"Upload to Eagle" Missed Common Embeds**: The right-click menu item did not appear on `![[image.png|300]]` or captioned embeds, on Markdown embeds whose path has spaces (written as `%20` or inside `<…>`), or on paths containing parentheses.
- **"Convert All Images in Note to Cloud URLs"**: The command skipped `![[…]]` embeds, could not find vault files whose path has spaces, and on Windows could not open `file://` images. All three now convert, a file embedded several times is uploaded once, and every embed of it is replaced.

## [1.10.0] - 2026-10-11

### Added
- **AI Provider Settings**: Added an **AI** settings tab for choosing the model behind the new wand buttons: Anthropic, OpenAI or Gemini with an API key; any OpenAI-compatible server with a custom address and optional key; or LM Studio, which is detected automatically on this computer and takes an optional key. Each provider has a model field with a **Browse** list and a **Test connection** button. No provider is selected by default, and Anthropic defaults to Claude Haiku 5.5.
- **AI Name and Description**: The Eagle folder dialog has a wand button next to **Name** and **Description** that sends the image to the selected provider and fills in a short title or a one-to-two sentence description. The file name, alt text and source page are passed along as hints.
- **Tags in the Metadata Card Can Be Turned Off**: Added a "Tags in the card" setting under **Embedding → Metadata card**, on by default. Turn it off to leave Eagle tags out of metadata and link cards.
- **AI Tags**: A wand button next to **Tags** suggests up to six tags. Tags already in the Eagle library are preferred and matched against the real tag list; at most two new tags are proposed, in the format the library already uses, and are marked with a dashed outline. Both limits are settings under **AI → Tag suggestions**: "Tags added per click" (1 to 20) and "New tags allowed" (0 or more; 0 restricts suggestions to existing tags).

- **AI Hints**: The Eagle folder dialog has an optional **AI hints** box below the tags. Whatever is typed there, however brief, is passed to the model as something to trust and expand on when a wand is clicked. Hints are not saved to Eagle.
- **Effort Setting**: Each AI provider has an **Effort** setting: Provider default (the default, which sends nothing and leaves it to the model), Low, Medium or High. LM Studio and OpenAI-compatible servers also offer **None**, which skips a reasoning model's thinking phase; on a local 27B reasoning model a title took about 21 seconds at the default, 9 at Low and under one at None. A level the model does not accept is left out automatically and not tried again.
- **Local Requests Run One at a Time**: Clicking several wands at once no longer fails on LM Studio. Simultaneous image requests overflowed the loaded model's context ("failed to decode"); they are now queued. If a request does run out of context, the message says so and what to change.
- **Tag Format With Prefixes**: When the Eagle library files tags under prefixes such as `Topic: …` and `Type: …`, the tag request names those prefixes and asks for every new tag in that form, and no longer pushes the model to use an existing tag that does not fit.

### Fixed
- **Eagle Tags Obsidian Could Not Read**: Eagle tags are now written into notes as valid Obsidian tags. Previously only spaces were replaced, so any other character an Obsidian tag cannot contain cut the tag short: `Source: Obsidian` was written as `#source:-obsidian`, of which Obsidian only recognizes `#source`. Now a colon or slash becomes a nested tag (`#source/obsidian`), apostrophes and quotation marks are dropped, and spaces and all other punctuation become single hyphens (`R&D Notes` is written `#r-d-notes`). A tag with nothing valid left in it is left out.

## [1.9.0] - 2026-10-11

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
