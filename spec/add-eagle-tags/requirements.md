# Requirements: Default Eagle Tags

## 1. Feature Toggle
**The system shall** provide a toggle in the plugin settings to enable or disable appending default tags to images added to Eagle.
* **User Story**: As a user, I want to easily toggle whether my new uploads get automatically tagged, so I can turn off auto-tagging when working on unrelated projects.
* **Acceptance Criteria**:
  * **1.1**: A toggle labeled "Add default tags to new Eagle attachments" exists in the plugin settings.
  * **1.2**: The state of this toggle is persisted in the plugin settings file (`data.json`).

## 2. Tags Input Field
**When** the default tags toggle is enabled, **the system shall** provide a text input field to specify one or more tags (comma-separated).
* **User Story**: As a user, I want to specify a list of tags (e.g., "obsidian, reference, moodboard") so they are consistently applied to every image I paste or drop.
* **Acceptance Criteria**:
  * **2.1**: A text input field labeled "Default Tags" is visible in settings.
  * **2.2**: The user can input a comma-separated string of tags.
  * **2.3**: The string is persisted in the plugin settings file.

## 3. Upload API Integration
**When** a new image is added to Eagle (via paste, drop, or Excalidraw integration), **if** the default tags toggle is enabled, **the system shall** parse the default tags string and include the resulting array of tags in the Eagle API upload payload.
* **User Story**: As a user, I expect my configured tags to automatically appear on the newly created items in my Eagle desktop application.
* **Acceptance Criteria**:
  * **3.1**: The comma-separated string from settings is parsed into a cleaned array of strings (trimmed, empty strings removed).
  * **3.2**: If the feature is enabled and tags are provided, the `addFromPath` (or `addFromUrl`) API payload includes the `tags` property populated with the array.
  * **3.3**: If the feature is disabled (or the tags input is empty), the `tags` property defaults to undefined or is omitted.