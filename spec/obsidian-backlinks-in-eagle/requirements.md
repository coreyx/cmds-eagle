# Requirements: Obsidian Backlinks in Eagle

## 1. Feature Toggles & Configuration
**The system shall** provide settings to enable Obsidian backlink generation for newly uploaded Eagle assets, specifying where the link should be stored.
* **User Story**: As a user, I want to automatically add a link back to my Obsidian note whenever I upload an image to Eagle, so I can easily trace an asset back to its original context.
* **Acceptance Criteria**:
  * **1.1**: A toggle labeled "Add Obsidian backlink to new Eagle attachments" exists in the plugin settings.
  * **1.2**: A configuration option (dropdown or checkboxes) exists to determine the destination of the backlink: "URL/Link Field", "Note/Annotation Field", or "Both".
  * **1.3**: These settings are persisted in the plugin's `data.json` file.

## 2. Advanced URI Generation
**When** an image is uploaded to Eagle and backlinks are enabled, **the system shall** dynamically generate an Obsidian Advanced URI linking to the currently active note.
* **User Story**: As a user, I want the link to use the Advanced URI format so it robustly opens the exact note and vault, even if I have multiple vaults.
* **Acceptance Criteria**:
  * **2.1**: The system retrieves the current Vault Name and URL-encodes it (`vault=<vault_name>`).
  * **2.2**: The system retrieves the active file's path and URL-encodes it (`filepath=<file_path>`).
  * **2.3**: The system attempts to extract a unique identifier (UID) from the active file's frontmatter (e.g., `uid` or `id`) to populate the `uid=<uid>` parameter. If no UID exists, the system shall generate a standard UUIDv4, write it to the file's frontmatter as `uid`, and use it for the URI.
  * **2.4**: The system constructs the base URI format: `obsidian://adv-uri?vault=<vault_name>&uid=<uid>&filepath=<file_path>`.

## 3. Eagle API Integration (URL Field)
**When** the user has configured the backlink to save to the URL field, **the system shall** populate Eagle's URL property.
* **User Story**: As a user, I want the backlink in the Eagle URL field so I can just click the standard browser/link icon in Eagle to open the Obsidian note.
* **Acceptance Criteria**:
  * **3.1**: The generated Advanced URI is passed as the `website` property in the Eagle `addFromPath` / `addFromUrl` API payload.

## 4. Eagle API Integration (Note Field)
**When** the user has configured the backlink to save to the Note field, **the system shall** populate Eagle's annotation property with a formatted Markdown link.
* **User Story**: As a user, I want the backlink in the Note field as a readable Markdown link with the note's filename.
* **Acceptance Criteria**:
  * **4.1**: The system extracts the active file's filename (without extension).
  * **4.2**: The system formats the text exactly as: `Linked From Obsidian: [<filename>](obsidian://adv-uri?vault=<vault_name>&uid=<uid>&filepath=<file_path>)`.
  * **4.3**: This formatted string is passed as the `annotation` property in the Eagle `addFromPath` / `addFromUrl` API payload.