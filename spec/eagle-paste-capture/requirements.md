# Requirements: Eagle Link Paste Capture

## 1. Paste Event Detection & URL Parsing
**The system shall** intercept paste events containing Eagle item URLs using regex detection.
* **User Story**: As a user, when I paste an Eagle link into an Obsidian note, I want Obsidian to automatically recognize it as an Eagle asset and handle it smoothly.
* **Acceptance Criteria**:
  * **1.1**: The paste interceptor checks clipboard plain text against supported Eagle URL patterns:
    * `eagle://item/{itemId}`
    * `http://localhost:{port}/item?id={itemId}` (and `https://localhost:{port}/item?id={itemId}`)
    * `eagle://{itemId}.info/{filename}` (legacy format)
  * **1.2**: Extracts the Eagle `itemId` correctly from any matched pattern.
  * **1.3**: If no pattern matches, the paste event continues normal default handling without modification.

## 2. Item Metadata Lookup
**When** an Eagle link is detected, **the system shall** query the Eagle Web API to fetch the item's metadata before inserting content.
* **User Story**: As a user, I want the plugin to fetch asset details so it knows the exact filename, extension, and whether a thumbnail exists.
* **Acceptance Criteria**:
  * **2.1**: Queries the Eagle Web API endpoint `/api/item/info?id={itemId}`.
  * **2.2**: If Eagle is not reachable or the item is not found, displays a `Notice` to the user and aborts without crashing.
  * **2.3**: Inspects the `noThumbnail` property on the retrieved `EagleItem`. A thumbnail is deemed available when `item.noThumbnail === false` (or undefined/falsy).

## 3. Configurable Paste Modes
**The system shall** provide a configurable setting to govern the default behavior when an Eagle link is pasted.
* **User Story**: As a user, I want to choose whether pasting an Eagle link prompts me, automatically embeds the image, or creates an inline link.
* **Acceptance Criteria**:
  * **3.1**: A setting named "Eagle Link Paste Behavior" (`eagleLinkPasteMode`) is available in settings with options:
    * `Always Ask` (`'ask'`) [Default]
    * `Embed` (`'embed'`)
    * `Inline` (`'inline'`)
  * **3.2**: When set to `embed`, pasting an Eagle link immediately inserts an image embed.
  * **3.3**: When set to `inline`, pasting an Eagle link immediately inserts an inline markdown link.
  * **3.4**: When set to `ask`, pasting an Eagle link opens the Eagle Link Choice Modal.

## 4. "Always Ask" Modal UI
**When** `eagleLinkPasteMode` is `ask`, **the system shall** present a modal dialog with action buttons and dynamic options.
* **User Story**: As a user, I want an interactive choice dialog where I can choose to embed or link, decide on thumbnail usage, and optionally remember my choice.
* **Acceptance Criteria**:
  * **4.1**: The modal displays the item name and type.
  * **4.2**: The modal provides primary choice buttons: "Embed" and "Inline".
  * **4.3**: When "Embed" is selected, if a thumbnail is available (`!item.noThumbnail`), a checkbox option "Embed thumbnail" is revealed.
  * **4.4**: The modal contains a "Remember my choice" checkbox.
  * **4.5**: If "Remember my choice" is checked upon confirming "Embed" or "Inline", the plugin persists the chosen mode (`embed` or `inline`) to `eagleLinkPasteMode` in settings.

## 5. Embed URL Generation Modes (file:// vs Custom URL Prefix)
**The system shall** support both local `file://` URLs and configurable HTTP/HTTPS WebDAV URL prefixes for embedded assets.
* **User Story**: As a user serving my Eagle library over local WebDAV/HTTP (e.g. `https://localhost:8080`), I want embeds to use the custom URL prefix so my notes can render assets over HTTP.
* **Acceptance Criteria**:
  * **5.1**: Settings provide an "Eagle Embed URL Mode" (`eagleEmbedUrlMode`) with options:
    * `Local File Path (file://)` (`'file'`)
    * `Custom URL Prefix (HTTP / WebDAV)` (`'custom-url'`)
  * **5.2**: When `custom-url` is selected, an input field "Custom URL Prefix" (`eagleCustomUrlPrefix`) is shown, suggesting default `https://localhost:8080`.
  * **5.3**: In `file` mode, generates `![filename](file:///...)` with URL-escaped absolute paths.
  * **5.4**: In `custom-url` mode, constructs the URL as:
    `${prefix}/${libraryName}.library/images/${itemId}.info/${encodeURIComponent(fileName)}`
    where `libraryName` is resolved from Eagle's API `/api/library/info`.
  * **5.5**: When thumbnail embedding is chosen, the filename is formatted as:
    `${encodeURIComponent(fileNameWithoutExt)}_thumbnail.png`.
  * **5.6**: Inserts the formatted markdown embed `![filename](url)` into the editor at cursor position.
  * **5.7**: If `insertThumbnail` ("Include metadata card" setting) is enabled, appends the metadata blockquote card (type, size, dimensions, cloud status, tags, and Eagle link) below the embedded image.

## 6. Inline Link Generation
**When** the inline mode is chosen, **the system shall** insert a markdown link using the Eagle API URL.
* **User Story**: As a user, I want an inline link that references the Eagle item directly via the API URL.
* **Acceptance Criteria**:
  * **6.1**: Constructs the target URL using the configured Eagle API base URL: `${eagleApiBaseUrl}/item?id=${itemId}` (e.g., `http://localhost:41595/item?id=MTSPUNN17LBUG`).
  * **6.2**: Constructs the markdown link text with the item filename: `[${item.name}.${item.ext}](${eagleApiUrl})`.
  * **6.3**: Inserts the link into the editor at cursor position.

## 7. Bi-directional Backlink Trigger
**When** an Eagle link is pasted into an active note, **the system shall** register a backlink in Eagle if backlinks are enabled.
* **User Story**: As a user, when I paste an Eagle link into a note, I want Eagle to know that this item is linked from that note.
* **Acceptance Criteria**:
  * **7.1**: If `enableBacklinks` is true, triggers backlink generation for the pasted `itemId`.
  * **7.2**: Connects seamlessly with the Obsidian Backlinks 2.0 system.
