# Release Notes

## New Features

* **Eagle Target Folder Selection:** You can now configure the plugin to upload new pasted or dropped images into a specific folder in your Eagle library, rather than dropping them into the root library. A new searchable dropdown in settings lets you navigate your entire folder hierarchy to make your selection.
* **Default Eagle Tags:** Added a new setting to automatically append a comma-separated list of tags (e.g., `obsidian, inspiration`) to all newly uploaded Eagle assets.
* **Obsidian Backlinks in Eagle:** You can now configure the plugin to automatically generate bidirectional backlinks. When an image is uploaded to Eagle, it can save an Obsidian Advanced URI back to the original note. You can choose to place this link in Eagle's URL field (making the standard link button open Obsidian), in the Note field as a markdown link, or both. To ensure these links never break even if you rename the file, the plugin will automatically generate and save a `uid` to the note's frontmatter if one doesn't already exist.

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
