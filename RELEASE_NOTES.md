# Release Notes

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
