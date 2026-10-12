# Release Notes

## 1.10.0 - 2026-10-11

### AI Suggestions for Name, Description and Tags

When the Eagle folder setting is **Ask**, the dialog shown as you add an image now has a wand button next to **Name**, **Description** and **Tags**. Click one and an AI model looks at the image and fills that field in.

* **Name and description:** a short title, or one to two sentences describing the image.
* **Tags:** tags already in your Eagle library are preferred and checked against your real tag list. New tags are written the way your library writes its tags, including a prefix such as `Topic: …` if you use one, and are shown with a dashed outline so you can see what would be created.
* **AI hints:** an optional box below the tags. Type what the image is, as briefly as you like, and the wands build on it with what the model knows.
* **Limits you control:** how many tags are added per click and how many of them may be new, under **Settings → AI → Tag suggestions**.

### Choose Your Model

Pick a provider under the new **AI** settings tab. Nothing is selected by default.

* **Anthropic, OpenAI or Gemini** with an API key. Anthropic defaults to Claude Haiku 5.5.
* **Any OpenAI-compatible server** with your own address and an optional key.
* **LM Studio**, detected automatically on your computer, with an optional API key. Leave the model empty and a loaded vision model is used.

Each provider has a **Browse** list of its models, a **Test connection** button, and an **Effort** setting for how much the model thinks before answering. Local reasoning models can think for 20 seconds or more over a short title; set Effort to **None** to skip that and get an answer in about a second.

With a cloud provider, each click sends that image, and for tags your tag names, to the provider. With LM Studio nothing leaves your computer.

### Tags That Obsidian Can Read

Eagle tags are now written into your notes as valid Obsidian tags. Previously a tag such as `Source: Obsidian` became `#source:-obsidian`, of which Obsidian only recognized `#source`.

* A colon or slash becomes a nested tag: `Topic: World of Warcraft` is written `#topic/world-of-warcraft`.
* Spaces and other punctuation become hyphens: `R&D Notes` is written `#r-d-notes`.
* A new **Tags in the card** setting under **Embedding → Metadata card** leaves Eagle tags out of metadata cards altogether if you prefer.

Cards already in your notes keep their old text until you embed the image again.

## 1.9.0 - 2026-10-11

### Images in Eagle, Visible on Every Device

Embedded Eagle images can now point at a **cloud copy** instead of a file on one computer. When you add an image to Eagle from a note, Eagle Bridge also uploads a copy to your cloud provider and embeds that address, so the image displays wherever the note is opened. This is the new default for fresh installs; existing installs keep their current setting and can switch under **Settings → Embedding → Link embedded images to**.

* **One copy per item:** embedding the same Eagle item again reuses its copy. The copy is recorded on the item as a **Cloud Copy** link in Eagle's Extra Links, and on WebDAV it is stored under the item's Eagle ID.
* **No duplicates from your own server:** an image pasted or dropped from your WebDAV server is linked where it already is rather than uploaded again.
* **Works everywhere you embed:** paste and drop, search and embed, pasted Eagle links, and images copied inside Eagle.
* **Falls back safely:** with no cloud provider, or if an upload fails, the note links to the local file as before.

### Canvas Support

Paste or drop an image or an Eagle item onto an Obsidian Canvas and it is added as a card that loads the image by URL, instead of saving a vault attachment. Choose the card type under **Settings → Extras → Canvas**: a **Text card** (the image plus its metadata card), a **Link card**, or **Ask every time**. Cards land at the pointer or drop position and are sized to the image.

Canvas support uses Canvas functions that are not part of Obsidian's public plugin interface. If a future Obsidian version changes them, Eagle Bridge steps aside and Canvas behaves as it does without the plugin.

### Excalidraw Improvements

* **Pasted images are no longer lost.** Without a cloud provider, the paste is left to Excalidraw. If an upload fails, the image is saved to your vault.
* **Same import as notes.** New images added to Eagle from a drawing get folder routing, default tags, the captured source URL and a backlink, and Eagle items reuse their single cloud copy.
* **More ways to add Eagle items.** `eagle://item/…` links are recognized, several items copied at once are all added, and Custom URL prefix mode embeds from your own server with nothing uploaded.

### Nextcloud and WebDAV

* **Public share links:** paste a Nextcloud share link as the WebDAV Public URL and it is converted automatically. The README has a step-by-step guide to serving uploads from a Nextcloud public share.
* **Test connection:** a new button checks your login and that the public address works without one.
* **Password field** is now masked.

### Settings, Reorganized

The settings are split into five tabs (**Connections**, **Cloud storage**, **Adding images**, **Embedding**, **Extras**) with related options grouped together and clearer names. Nothing changed its behaviour or stored value. A new **Use Eagle Extra Links** switch on the Connections tab turns all use of the Extra Links plugin on or off, shows whether it was detected, and has its own test button.

### Also New

* **Clearer paste dialog:** "Where to save image?" now lists Eagle, Vault and Cloud only, with a line describing what each will do.
* **Metadata card for cloud uploads:** images uploaded straight to the cloud get a card with type, size, dimensions and source links.
* **Pasted Eagle file paths** behave exactly like pasted Eagle links.

### Fixes

* **"No cloud provider configured" with valid settings:** cloud uploads were refused if credentials had been typed in a different order than the settings expected.
* **WebDAV uploads to Nextcloud failing with 404:** a missing upload folder is now created, including nested folders.
* **Double slash in WebDAV image links** when the Public URL ended with a slash.
* **Backlinks from Canvas files:** adding a backlink while a `.canvas` file was active no longer tries to write a note ID into that file.

## 1.8.0 - 2026-10-11

### Now Called Eagle Bridge

This fork of CMDS Eagle is now developed independently under a new name, **Eagle Bridge**, with its own plugin ID (`eagle-bridge`). Install it with BRAT from `https://github.com/coreyx/obsidian-eagle-bridge` (see the README). It installs alongside CMDS Eagle as a separate plugin, so disable CMDS Eagle, and copy `data.json` from `.obsidian/plugins/cmds-eagle/` to `.obsidian/plugins/eagle-bridge/` if you want to keep your settings. The settings footer now links to this fork's GitHub repository and credits the original CMDS Eagle by Yohan Koo.

### New Features
 
* **Root Folder for Mirrored Folders:** A new "Place mirrored folders under a root folder" setting lets you pick one Eagle folder (for example `Obsidian Attachments`) to hold everything the plugin mirrors from your vault, so mirrored folders no longer land at the top level of your Eagle library. It applies to both **Mirror Obsidian Folder Hierarchy** mode and the **Mirror** button in the **Ask** folder picker, whose path preview now shows the full destination including the root folder. If the chosen folder is later removed from Eagle, the plugin tells you and falls back to the library root.
* **Mirror Folder Button in Eagle Folder Picker:** When pasting or dragging and dropping content into Obsidian and choosing "Eagle (Local)" (or when folder routing is set to "Ask"), the folder picker modal (`EagleFolderPickerModal`) now includes a prominent **"🪞 Mirror"** action bar in the right-pane header:
  * **One-Click Vault Mirroring:** Dynamically replicates the active note's directory hierarchy inside Eagle. If any intermediate or leaf folders in that hierarchy do not already exist, the plugin automatically creates them via Eagle's Web API (`/api/folder/create`).
  * **Live Breadcrumb Preview:** Displays a real-time path badge (e.g., `Work / Projects / Alpha` or `Library Root`) showing exactly where the asset will land.
  * **Full Metadata Preservation:** Any custom name, description/annotation, 5-star rating, and tag pills configured in the picker's left pane are cleanly bundled and pushed to Eagle alongside the mirrored folder destination.
  * **Keyboard Shortcut:** Trigger mirroring instantly with `Alt+M` (or `Cmd+M` on macOS) from anywhere within the picker modal.
* **Image Source URL Capture:** When copying and pasting (or dragging and dropping) images directly from web browsers into Obsidian, the plugin now automatically captures the origin webpage URL and the direct image asset URL. These can be pushed directly to Eagle's primary website field and/or stored in Eagle's Extra Links panel.
* **Source Link in Metadata Card:** Updated the "Include source in metadata card" setting to a 4-way dropdown (`none`, `page`, `image`, `both`), matching the options in "Add image source to Extra Links". Users can now optionally add the origin webpage URL (`[Source: domain]`), the direct image URL (`[Direct: domain]`), both, or none to the embedded metadata card.
* **Local File Source Link in Metadata Card:** When "Include local file source in metadata card" is enabled (`includeLocalSourceInMetadataCard`, disabled by default), images dragged or pasted from your operating system's file explorer (Windows File Explorer, macOS Finder) include a clickable `[Source: File](file://...)` link in the metadata card pointing back to the original file. This operates independently from web URL sources.
* **Eagle Item Link Format Setting:** Added a new setting (`eagleItemLinkFormat`) defaulting to the modern HTTP localhost URL format (`http://localhost:41595/item?id=UUID`) while preserving the classic `eagle://item/UUID` protocol format as an option.
* **Eagle Extension Mirroring in "Ask" Modal:** Rebuilt the "Ask" mode upload modal to match the experience of the official Eagle Extension:
  * **Two-Pane Split Layout:** The modal expands to 860px with a split view: asset metadata and preview on the left pane (~320px), and folder tree navigation on the right pane.
  * **Image Preview & Dimensions Badge:** Shows a live thumbnail of the dropped/pasted/local image with an inset dimension badge (e.g. `800x600`) centered at the bottom over a translucent blur backdrop.
  * **5-Star Ratings Picker:** Interactive 5-star rating control with hover previews and toggle selection, automatically pushed to Eagle upon upload.
  * **Item Name Editing:** "Add Name" input pre-populated with the file name (without extension), with quick `Enter` shortcut to submit.
  * **Description Field & Alt Text:** "Add Description" input pre-populated with HTML `alt` tag values captured from browser drop or clipboard actions, saved as the Eagle note/annotation.
  * **Removable Tag Pills & Collapsible "+ Add Tag" Button:** Selected tags are displayed as pills with an `✕` button. The "+ Add Tag" button collapses to a compact `+` button when tags are selected and expands back when empty. Pre-populates with default tags configured in plugin settings.
  * **Tag Picker Modal:** Dedicated popup querying Eagle's `/api/tag/list` with a 2-column vertical bulleted list (`• TagName (Count)`), sorted alphabetically, with instant search filtering, keyboard navigation, and custom tag creation.
* **Target Folder 2.0 (Folder Routing Options):** Enhanced the folder assignment settings with a unified dropdown ("When adding an item to Eagle") offering four workflow options:
  * **Ask:** Presents an interactive modal picker before each upload, modeled after the Eagle Chrome extension:
    * **Expandable / Collapsible Tree View:** Browse folders as a nested tree with toggleable chevrons (`▶` / `▼`), indentation per depth level, and child folder count badges.
    * **Expand All / Collapse All:** Quick toggle buttons in the header to expand or collapse your entire folder hierarchy with one click.
    * **Recent Folders Kept At Top:** Combines recently used folders from Eagle (`/api/folder/listRecent`) with your selection history in Obsidian.
    * **Library Root Option:** Quick "Library Root (Uncategorized)" option to save without a folder.
    * **Real-Time Search Filtering:** Type any keywords to filter folders across your entire library with complete breadcrumb paths (`Parent / Child / Folder`).
    * **Complete Keyboard Navigation:** Navigate up/down with arrow keys, expand with `→`, collapse with `←`, select with `Enter`, and cancel with `Esc`.
  * **Add to Target Folder:** Preserves the previous designated target folder behavior, with a new "Clear" button to easily reset destination back to root.
  * **Mirror Obsidian Folder Hierarchy:** Automatically mirrors the active note's directory path relative to the vault root inside Eagle, dynamically creating intermediate and leaf folders via Eagle's Web API (`/api/folder/create`) as needed.
  * **Use Folder Map:** Lets you configure custom mapping rules between Obsidian folders and Eagle folders in plugin settings, with automatic longest-prefix matching for subdirectories.
* **Default Eagle Tags:** Added a new setting to automatically append a comma-separated list of tags (e.g., `obsidian, inspiration`) to all newly uploaded Eagle assets.
* **Obsidian Backlinks in Eagle:** You can now configure the plugin to automatically generate bidirectional backlinks. When an image is uploaded to Eagle, it can save an Obsidian Advanced URI back to the original note. You can choose to place this link in Eagle's URL field (making the standard link button open Obsidian), in the Note field as a markdown link, or both. To ensure these links never break even if you rename the file, the plugin will automatically generate and save a `uid` to the note's frontmatter if one doesn't already exist.

### Folder Picker & Modal Fixes

* **Automatic Image Name Extraction:** Fixed an issue where images copied or dragged from websites resulted in the Name field being populated with generic "image" (due to Chromium clipboard defaulting to `image.png`). The plugin now automatically resolves the real filename directly from the source image's URL path (e.g. `2600_HomeforEveryone` from `https://.../2600_HomeforEveryone.jpg`).
* **Clean Folder Selection in Ask Mode:** Fixed an issue where selecting a folder in the "Ask" mode picker modal could trigger "Upload cancelled" due to modal dismissal timing. Selection state is now locked before modal closure.

### Metadata Card & Image Source URL Fixes

* **Origin Webpage URL Extraction on Drag & Drop:** Fixed an issue where dragging an image directly from a webpage into Obsidian only recorded the direct image asset URL in Eagle's website field instead of the origin webpage URL when "Source URL priority (Eagle website field)" was set to "Webpage URL (fallback to image URL)".
  * The drop handler now parses multi-line `text/uri-list` payloads (RFC 2483), extracts surrounding `<a href="...">` and `<base href="...">` links from HTML payloads, and automatically checks the system clipboard text so that copying a webpage's address before dropping an image reliably attaches the page URL.
  * Added direct image URL detection (`isDirectImageUrl`) across clipboard and drag handlers so image CDN URLs are never misclassified as webpage URLs, ensuring Eagle's website field and Extra Links panel always distinguish between the source webpage and the direct image.
* **Null Byte Sanitization:** Fixed an issue where copying images in Chromium browsers on Windows placed a trailing null byte (`\0`) into the source URL. Because CommonMark rejects control characters in links, this previously broke markdown link rendering in Obsidian. All URLs are now sanitized upon capture.
* **In-Memory Fallback:** The metadata card generator now directly receives the in-memory captured source URL rather than waiting for and relying solely on Eagle's asynchronous database write round-trip, eliminating race conditions where the source link was skipped.
* **Extra Links Resolution:** If Eagle's primary URL field holds an Obsidian backlink, the metadata card now automatically inspects the item's Extra Links on disk to locate the web source URL.
* **Browser Drag & Drop Support:** The drag-and-drop handler now inspects browser `dataTransfer` payloads (`text/uri-list` and `text/html`) so dragging an image directly from a web page into Obsidian captures the source URL just like copy & paste.

### WebDAV Improvements and Fixes

This release focuses on heavily improving the stability and compatibility of the WebDAV cloud provider, ensuring it works flawlessly with servers like Nextcloud, Synology, and rclone:

* **Reliable Uploads & CORS Fixes:** We've updated the WebDAV uploader to use Obsidian's native networking APIs (`requestUrl`). This bypasses strict cross-origin (CORS) blocks that previously prevented uploads to certain servers when using the native `fetch` API.
* **Automatic Directory Creation:** If you specify an upload path (like `/uploads`) that doesn't exist on your server yet, the plugin will now automatically attempt to create the folder for you, completely eliminating unexpected `409 Conflict` errors during your first upload.
* **Better Path Handling:** Fixed edge cases with URL formatting so that trailing and leading slashes are handled gracefully, preventing broken URLs.
* **Clearer Error Messages:** When things do go wrong with deep folder structures, the plugin now provides much clearer error messages to help you configure your path correctly.

### Local Image Paste & Drop Fixes

* **Missing Metadata Cards:** Fixed a bug where uploading a new image to Eagle via paste or drop ignored the "Include metadata card" setting. Newly added images will now correctly append the Eagle metadata block (type, size, tags, Eagle link) immediately after they finish uploading.
* **Vault (Local) Double Slash Fix:** Resolved a bug where pasting or dropping an image and choosing the "Vault (Local)" option would generate invalid markdown paths with two leading slashes (e.g., `//image.png`) if the vault root was used. This previously caused Obsidian to display a markdown error block. Paths are now correctly normalized so images render instantly.

### Documentation

* **New README Section:** Added explicit instructions to the README on how to compile, install, and test local development builds directly inside an Obsidian vault.
* **BRAT Installation:** Added instructions to the README for installing and updating this fork's releases with BRAT.
