# Eagle Bridge

Obsidian plugin to connect [Eagle](https://eagle.cool) asset library with your vault.

Eagle Bridge started as a fork of [CMDS Eagle](https://github.com/johnfkoo951/cmds-eagle) by Yohan Koo and is now developed independently.



## Features

- **Search & Embed**: Search Eagle library and embed images directly into notes
- **Cloud Upload**: Upload images to cloud storage (ImgHippo, Cloudflare R2, Amazon S3, WebDAV)
- **Paste/Drop Integration**: Automatically handle pasted or dropped images
- **Target Folder Routing**: Route uploads using 4 modes: interactive **Ask** tree picker, designated **Target Folder**, **Mirror Obsidian Folder Hierarchy**, or custom **Folder Map**
- **Image Source Capture**: Automatically capture webpage origin URLs, direct image asset URLs, or local file links into metadata cards and Eagle Extra Links
- **Obsidian Backlinks**: Automatically write bidirectional Obsidian Advanced URI backlinks to Eagle notes/URL fields
- **Batch Convert**: Convert all local images in a note to cloud URLs
- **Cross-Platform Sync**: Automatically convert image paths between Mac and Windows
- **Excalidraw Integration**: Paste or drop images onto an Excalidraw canvas — Eagle assets embed the original, and clipboard screenshots are uploaded to your cloud provider (and optionally added to your Eagle library) instead of bloating the vault with attachments

## Installation

### From BRAT (Recommended)

Eagle Bridge is not in the Community Plugins list. [BRAT](https://github.com/TfTHacker/obsidian42-brat) installs it directly from its [GitHub releases](https://github.com/coreyx/obsidian-eagle-bridge/releases) and keeps it up to date.

1. Open **Settings → Community plugins**, click **Browse**, then install and enable **BRAT**
2. Open **Settings → BRAT** and click **Add beta plugin**
3. Enter the repository URL: `https://github.com/coreyx/obsidian-eagle-bridge`
4. Select the latest version, keep **Enable after installing the plugin** checked, and click **Add plugin**

BRAT checks for new releases when Obsidian starts. To update on demand, run the command **BRAT: Check for updates to all beta plugins and UPDATE**.

> **Coming from CMDS Eagle?** Eagle Bridge installs alongside it as a separate plugin (`eagle-bridge`). Disable CMDS Eagle so the two don't both handle pasted and dropped images. To keep your settings, copy `data.json` from `.obsidian/plugins/cmds-eagle/` to `.obsidian/plugins/eagle-bridge/`, then reload Obsidian.

### Manual Installation

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/coreyx/obsidian-eagle-bridge/releases)
2. Create folder: `.obsidian/plugins/eagle-bridge/`
3. Copy downloaded files into the folder
4. Enable plugin in Obsidian settings

## Requirements

- [Eagle](https://eagle.cool) app running locally
- Obsidian 1.5.0+

## Usage

### Search & Embed

Search your Eagle library and embed images directly into notes.

![Search and Embed](assets/CMDS-eagle1.gif)



### Image Paste/Drop

When pasting or dropping images, choose where to save them:

- **Eagle**: adds the image to your Eagle library. How the note links to it follows **Settings → Embedding → Link embedded images to**:
  - **Cloud copy** (default): uploads a copy to the active cloud provider and embeds that URL, so the image displays on your other devices. If the image was copied from the cloud provider itself (for example while browsing your WebDAV folder in a browser), the existing file is linked instead of uploading a duplicate. Without a configured cloud provider, the note links to the local file.
  - **Custom URL prefix**: links into the Eagle library through your own HTTP/WebDAV server.
  - **Local file path**: links to the file on this computer.
- **Vault**: saves the image as an attachment in the vault.
- **Cloud only**: uploads the image to the active cloud provider without adding it to Eagle.

That setting also applies when you embed an existing Eagle item from search or by pasting an Eagle link or library file path.

Each Eagle item gets one cloud copy. It is recorded on the item as a **Cloud Copy** link in Eagle's Extra Links (when **Use Eagle Extra Links** is on), and on WebDAV it is stored as `<Eagle item ID>.<ext>`, so embedding the same item again reuses the copy instead of uploading a new one.

![Search Modal](assets/CMDS-eagle2.gif)
![Search Results](assets/CMDS-eagle3.png)

### Target Folder Routing

Control where newly added images are stored in your Eagle library with 4 workflow options under **Settings → Adding images → When adding an item to Eagle**:

- **Ask**: Prompts before each upload with an interactive Eagle Extension-style split modal:
  - **Left Pane (Metadata & Preview)**: Live thumbnail preview with inset dimensions badge (e.g. `800x600`), 5-star ratings picker, editable "Name" field, "Description" field (pre-populated with HTML `alt` text), removable tag pills, and a dedicated 2-column bulleted Tag Picker popup (`• TagName (Count)`) with search and custom tag creation.
  - **Right Pane (Folder Navigation)**: Interactive expandable/collapsible folder tree, quick expand/collapse all buttons, recent folder history, library root option, real-time search with breadcrumbs, and complete keyboard navigation.
- **Add to Target Folder**: Always routes new uploads to a specific designated folder in Eagle (with a "Clear" button to reset to root).
- **Mirror Obsidian Folder Hierarchy**: Automatically creates and mirrors your active note's relative vault path in Eagle, creating intermediate folders as needed.
- **Use Folder Map**: Map specific Obsidian vault directories to specific Eagle folders with automatic longest-prefix matching for subdirectories.

### Cloud Upload

Upload images to cloud storage for sharing and portability.

![Cloud Upload](assets/CMDS-eagle5.gif)
![Paste Options](assets/CMDS-eagle4.gif)

### Cross-Platform Sync

Use the same Eagle library across Mac and Windows with automatic path conversion.

![Cross-Platform Sync](assets/CMDS-eagle-cross-platform.gif)

**How it works:**
1. Register your computers in settings (Mac and Windows)
2. Eagle library synced via cloud storage (e.g., Dropbox, iCloud, OneDrive)
3. Image paths automatically convert when opening notes on different platforms

**Settings:**
- `Convert file paths between computers`: Turn on/off the feature
- `Convert when a note is opened`: Automatically convert paths when opening notes

Both are under **Settings → Extras → Cross-platform paths**.

**Manual conversion:**
- Command: `Convert cross-platform image paths in current note`

### Excalidraw

Paste or drop images directly onto an Excalidraw canvas and let Eagle handle them:

- **Eagle assets** (copied/dragged from Eagle) resolve to the **original** image (not the thumbnail).
- **Clipboard screenshots** are uploaded to your active cloud provider and embedded by URL — and, when enabled, added to your Eagle library.
- Images are embedded as portable cloud URLs, keeping the `.excalidraw` file small instead of storing vault attachments.

Requires the [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) plugin and a configured cloud provider. Toggle it under **Settings → Extras → Excalidraw**.

## Settings

The settings are organized into five tabs:

| Tab | What it covers |
|-----|----------------|
| **Connections** | The Eagle app and the Eagle Extra Links plugin, each with a connection test |
| **Cloud storage** | Which cloud provider to use and its credentials |
| **Adding images** | Where pasted or dropped images go, the Eagle folder and tags they get, source capture, and backlinks to your notes |
| **Embedding** | What embedded Eagle images link to, the metadata card, and search defaults |
| **Extras** | Excalidraw support and cross-platform path conversion |


![Settings](assets/CMDS-eagle6.png)

## Cloud Providers

| Provider | Setup |
|----------|-------|
| **ImgHippo** (Free) | Sign up at [imghippo.com](https://imghippo.com), get API key from [settings](https://www.imghippo.com/settings) |
| **Cloudflare R2** | Requires Worker deployment (see docs) |
| **Amazon S3** | Standard S3 credentials |
| **WebDAV** | Works with Synology, Nextcloud, etc. See [WebDAV with Nextcloud](#webdav-with-nextcloud) |

![Cloud Settings](assets/CMDS-eagle7.png)

### WebDAV with Nextcloud

Obsidian loads embedded images without logging in, so the **Public URL** must serve files to anyone who has the link. Nextcloud's regular WebDAV address (`/remote.php/dav/files/...`) requires a login: uploads through it succeed, but the embedded images will not display. Point the Public URL at a public share link instead. This needs Nextcloud 29 or later, which added the [public share WebDAV endpoint](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/basic.html).

The plugin builds each image link as **Public URL + Upload path + filename**, so the folder you share must be the *parent* of the upload folder:

1. In Nextcloud, create a folder to hold your uploads, for example `Obsidian`.
2. Share that folder with a **public link**: view only, no password. The link looks like `https://cloud.example.com/s/AbCdEf123`; the last part is the share token.
3. In **Settings → Eagle Bridge → Cloud storage**, set the cloud provider to **WebDAV** and fill in:

   | Setting | Value |
   |---------|-------|
   | Server URL | `https://cloud.example.com/remote.php/dav/files/USERNAME/Obsidian` |
   | Username / Password | Your Nextcloud login (an app password is recommended) |
   | Upload path | `/eagle-uploads` |
   | Public URL | `https://cloud.example.com/public.php/dav/files/AbCdEf123` |

   There is no separate setting for the shared folder: it is the last part of the Server URL (`Obsidian` above), and the share token in the Public URL points at that same folder.

   You can also paste the share link itself (`https://cloud.example.com/s/AbCdEf123`) as the Public URL; the plugin converts it to the form above when it builds image links. If your Public URL has that shape but is not a Nextcloud share, turn on **Disable Nextcloud share link conversion** to have it used exactly as entered.

4. Click **Test** under **Test connection**. It checks the server login and that the public share works without a login, without uploading anything.
5. Paste an image and choose **Cloud**. The plugin creates the `eagle-uploads` folder on the first upload.
6. Open the embedded image URL in a private browser window. If it loads there without a login, it will display in Obsidian.

Things to know:

- **Anyone with the share link can view every file in the shared folder**, not only the image embedded in a given note. Keep that folder for uploads you are comfortable sharing.
- **A password-protected share will not work**, because Obsidian cannot supply the password when loading an image.
- **Images only load where your server is reachable.** If its address only resolves on your home network, notes opened elsewhere show broken images unless you are on a VPN or use an externally reachable address.
- **The same rule applies to any WebDAV server**: uploads can require a login, but the Public URL must not.

## Commands

| Command | Description |
|---------|-------------|
| `Search Eagle library and embed` | Open search modal |
| `Upload clipboard Eagle image to cloud` | Upload from clipboard |
| `Embed Eagle image and upload to cloud` | Embed + upload in one step |
| `Convert all images in note to cloud URLs` | Batch convert local images |
| `Convert cross-platform image paths in current note` | Convert Mac/Windows paths |

## Development & Testing

When running `npm run build` or `npm run dev`, the plugin is compiled into the root of this repository. The required files are:
- `main.js` (the compiled code)
- `manifest.json` (metadata)
- `styles.css` (styling, if present)

### How to install and test your local build

1. Find your Obsidian vault's plugins folder, usually at `<YourVault>/.obsidian/plugins/` (the `.obsidian` folder may be hidden by default).
2. Create a new directory inside it called `eagle-bridge`.
3. Copy `main.js`, `manifest.json`, and `styles.css` from your development directory into that new folder. *(Note: For a faster development loop, many developers create a symbolic link from their vault's plugin folder to this repository, or develop directly inside the vault).*
4. In Obsidian, go to **Settings → Community plugins** and click the **Reload plugins** button (refresh icon).
5. Find **Eagle Bridge** in the list and toggle it on. 

## License

MIT
