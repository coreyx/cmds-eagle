# Release Notes

## New Features

* **Image Source URL Capture:** When copying and pasting (or dragging and dropping) images directly from web browsers into Obsidian, the plugin now automatically captures the origin webpage URL and the direct image asset URL. These can be pushed directly to Eagle's primary website field and/or stored in Eagle's Extra Links panel.
* **Source Link in Metadata Card:** When "Include source in metadata card" is enabled, the embedded markdown metadata card displays a clickable `[Source: domain](url)` link referencing the origin of the image.
* **Local File Source Link in Metadata Card:** When "Include local file source in metadata card" is enabled (`includeLocalSourceInMetadataCard`, disabled by default), images dragged or pasted from your operating system's file explorer (Windows File Explorer, macOS Finder) include a clickable `[Source: File](file://...)` link in the metadata card pointing back to the original file. This operates independently from web URL sources.
* **Eagle Item Link Format Setting:** Added a new setting (`eagleItemLinkFormat`) defaulting to the modern HTTP localhost URL format (`http://localhost:41595/item?id=UUID`) while preserving the classic `eagle://item/UUID` protocol format as an option.
* **Eagle Target Folder Selection:** You can now configure the plugin to upload new pasted or dropped images into a specific folder in your Eagle library, rather than dropping them into the root library. A new searchable dropdown in settings lets you navigate your entire folder hierarchy to make your selection.
* **Default Eagle Tags:** Added a new setting to automatically append a comma-separated list of tags (e.g., `obsidian, inspiration`) to all newly uploaded Eagle assets.
* **Obsidian Backlinks in Eagle:** You can now configure the plugin to automatically generate bidirectional backlinks. When an image is uploaded to Eagle, it can save an Obsidian Advanced URI back to the original note. You can choose to place this link in Eagle's URL field (making the standard link button open Obsidian), in the Note field as a markdown link, or both. To ensure these links never break even if you rename the file, the plugin will automatically generate and save a `uid` to the note's frontmatter if one doesn't already exist.

## Metadata Card & Image Source URL Fixes

* **Null Byte Sanitization:** Fixed an issue where copying images in Chromium browsers on Windows placed a trailing null byte (`\0`) into the source URL. Because CommonMark rejects control characters in links, this previously broke markdown link rendering in Obsidian. All URLs are now sanitized upon capture.
* **In-Memory Fallback:** The metadata card generator now directly receives the in-memory captured source URL rather than waiting for and relying solely on Eagle's asynchronous database write round-trip, eliminating race conditions where the source link was skipped.
* **Extra Links Resolution:** If Eagle's primary URL field holds an Obsidian backlink, the metadata card now automatically inspects the item's Extra Links on disk to locate the web source URL.
* **Browser Drag & Drop Support:** The drag-and-drop handler now inspects browser `dataTransfer` payloads (`text/uri-list` and `text/html`) so dragging an image directly from a web page into Obsidian captures the source URL just like copy & paste.

## WebDAV Improvements and Fixes

This release focuses on heavily improving the stability and compatibility of the WebDAV cloud provider, ensuring it works flawlessly with servers like Nextcloud, Synology, and rclone:

* **Reliable Uploads & CORS Fixes:** We've updated the WebDAV uploader to use Obsidian's native networking APIs (`requestUrl`). This bypasses strict cross-origin (CORS) blocks that previously prevented uploads to certain servers when using the native `fetch` API.
* **Automatic Directory Creation:** If you specify an upload path (like `/uploads`) that doesn't exist on your server yet, the plugin will now automatically attempt to create the folder for you, completely eliminating unexpected `409 Conflict` errors during your first upload.
* **Better Path Handling:** Fixed edge cases with URL formatting so that trailing and leading slashes are handled gracefully, preventing broken URLs.
* **Clearer Error Messages:** When things do go wrong with deep folder structures, the plugin now provides much clearer error messages to help you configure your path correctly.

## Local Image Paste & Drop Fixes

* **Missing Metadata Cards:** Fixed a bug where uploading a new image to Eagle via paste or drop ignored the "Include metadata card" setting. Newly added images will now correctly append the Eagle metadata block (type, size, tags, Eagle link) immediately after they finish uploading.
* **Vault (Local) Double Slash Fix:** Resolved a bug where pasting or dropping an image and choosing the "Vault (Local)" option would generate invalid markdown paths with two leading slashes (e.g., `//image.png`) if the vault root was used. This previously caused Obsidian to display a markdown error block. Paths are now correctly normalized so images render instantly.

## Developer Documentation

* **New README Section:** Added explicit instructions to the README on how to compile, install, and test local development builds directly inside an Obsidian vault.
