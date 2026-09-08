# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Docs**: Added a "Development & Testing" section to the `README.md` with instructions for compiling, installing, and testing local builds.

### Fixed
- **Local Paste/Drop**: Fixed an issue where local vault embeds could generate invalid markdown links with double slashes (e.g., `//image.png`) when saved to the root of the vault, causing broken image renders.
- **WebDAV**: Migrated the upload client from the browser's `fetch` API to Obsidian's native `requestUrl` to correctly bypass CORS restrictions.
- **WebDAV**: Resolved `409 Conflict` errors by automatically creating missing parent directories (`MKCOL`) on the server before retrying the upload.
- **WebDAV**: Fixed URL path construction to prevent malformed requests (e.g., double slashes) regardless of how the user formats their server URL or upload path.
- **WebDAV**: Improved error messages to explicitly warn users if their configured upload path cannot be created or accessed on the remote server.
- **WebDAV**: Ensured the file's raw binary buffer is correctly passed into the `PUT` body for standard WebDAV compatibility.
