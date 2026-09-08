# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Eagle Target Folder**: Added a new setting to designate a specific folder in your Eagle library for new attachments. When enabled, a new "Select Folder" button provides a searchable dropdown of your entire Eagle folder hierarchy.
- **Default Eagle Tags**: Added a setting to automatically append a comma-separated list of tags to every image uploaded to Eagle.
- **Obsidian Backlinks in Eagle**: Added a setting to automatically generate an Obsidian Advanced URI backlink to the current note when adding a new image to Eagle. The backlink can be saved to the image's URL field, Note field, or both. If the active note lacks a unique identifier (`uid`), one is automatically generated and saved to its frontmatter to ensure the link never breaks.
- **Docs**: Added a "Development & Testing" section to the `README.md` with instructions for compiling, installing, and testing local builds.

### Fixed
- **Paste/Drop to Eagle**: Fixed an issue where the "Include metadata card" setting was ignored when directly pasting or dropping a new image to Eagle, preventing the metadata info block (type, size, tags, Eagle link) from being appended below the image in Obsidian.
- **Local Paste/Drop**: Fixed an issue where local vault embeds could generate invalid markdown links with double slashes (e.g., `//image.png`) when saved to the root of the vault, causing broken image renders.
- **WebDAV**: Migrated the upload client from the browser's `fetch` API to Obsidian's native `requestUrl` to correctly bypass CORS restrictions.
- **WebDAV**: Resolved `409 Conflict` errors by automatically creating missing parent directories (`MKCOL`) on the server before retrying the upload.
- **WebDAV**: Fixed URL path construction to prevent malformed requests (e.g., double slashes) regardless of how the user formats their server URL or upload path.
- **WebDAV**: Improved error messages to explicitly warn users if their configured upload path cannot be created or accessed on the remote server.
- **WebDAV**: Ensured the file's raw binary buffer is correctly passed into the `PUT` body for standard WebDAV compatibility.
