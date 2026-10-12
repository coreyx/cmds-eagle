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
- **Excalidraw Integration**: Paste or drop images onto an Excalidraw canvas — Eagle assets embed the original, and clipboard screenshots are uploaded to your cloud provider (and optionally added to your Eagle library) instead of bloating the vault with attachments
- **Canvas Integration**: Paste or drop images and Eagle items onto an Obsidian Canvas as text or link cards that load the image by URL
- **AI Suggestions**: Let an AI model look at the image and suggest its name, description and tags as you add it to Eagle, using Anthropic, OpenAI, Gemini, any OpenAI-compatible server, or LM Studio on your own computer

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

- **Eagle**: adds the image to your Eagle library.
- **Vault**: saves the image as an attachment in the vault, in the folder and with the link style your Obsidian settings give. This choice is hidden by default; turn on **Settings → Adding images → Offer the vault as a destination** to show it.
- **Cloud only**: uploads the image to the active cloud provider without adding it to Eagle.

Below the choices is an **Also upload to the cloud** toggle (shown with your provider's name, for example "Also upload to Nextcloud"). It applies to **Eagle**: with it on, the image is added to Eagle and a copy is uploaded to your cloud provider, and the Eagle button reads "Eagle + Nextcloud". The button's description always says what the note will link to. The toggle starts from **Settings → Embedding → Also upload to the cloud**; changing it in the dialog affects only that image unless **Remember this choice** is on. The same toggle appears when you paste an item that is already in Eagle.

**What an embedded Eagle image links to** is decided per image, in this order:

1. **Its cloud copy**, when it has one: either just uploaded, or made earlier. If the image was copied from the cloud provider itself (for example while browsing your WebDAV folder in a browser), the existing file is linked instead of uploading a duplicate.
2. **Your Custom URL prefix** (**Settings → Embedding**), when it has no cloud copy: the image is loaded from the Eagle library through your own HTTP/WebDAV server.
3. **The file path on this computer**, when no Custom URL prefix is set. Such a link only displays on this computer, so the dialog says so before you choose, settings shows a warning while the prefix is empty, and a notice appears the first time it happens in a session.

**Always use Custom URL prefix** (shown once a prefix is set) links to your own server even when an image has a cloud copy. Use it with **Also upload to the cloud** on when you want every image to have a cloud copy, as a share link listed in the metadata card and in Eagle Extra Links, while all your notes load images from your own server. If you do not want cloud copies at all, turn **Also upload to the cloud** off instead.

The same rule applies when you embed an existing Eagle item from search or by pasting an Eagle link or library file path. Without a dialog, **Also upload to the cloud** follows the setting.

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

### AI Suggestions

When the Eagle folder setting is **Ask**, the dialog shown as you add an image has a wand button next to **Name**, **Description** and **Tags**. Click one and an AI model looks at the image and fills that field in:

- **Name**: a short title for the image.
- **Description**: one or two sentences describing it.
- **Tags**: up to six tags. Tags already in your Eagle library are preferred; at most two new ones are proposed, written the way your library writes its tags (see **Prefixed tags** below). New tags are shown with a dashed outline so you can see what would be created, and every suggestion can be removed before you save. Both limits can be changed under **Settings → AI → Tag suggestions**; setting new tags to 0 restricts suggestions to tags you already have.

**Why six tags, and only two new ones?** Those are the defaults for the two limits under **Settings → AI → Tag suggestions**:

- **Two new tags:** a new tag is permanent once it is saved to Eagle, and models invent tags readily. A low cap keeps suggestions drawing on the tags you already have, and stops near-duplicates such as `Fantasy Art` beside `Topic: Fantasy` from piling up.
- **Six tags in total:** every suggestion is one you have to read and may want to remove, and a handful is usually enough to cover what an image shows, what it is about and what kind of image it is.

> **Tip:** With a new or small library, few of your existing tags fit any given image, so the new-tag cap ends up being most of what you get back. While you are building the library up, raise **New tags allowed** to four or six, then bring it back down once your tag list covers most images.

**Prefixed tags.** If your library files tags under prefixes, new tags follow the same form. Nothing about the form is built in: the prefixes and the punctuation between prefix and value are read from your own tags, spacing included, so `Topic: AI`, `Topic:AI`, `topic/ai` and `Topic - AI` libraries each get new tags in their own style. Ordinary hyphenated tags such as `sci-fi` are not mistaken for prefixes, and, under the default setting below, a library with only a stray prefixed tag or two is treated as plain.

**New tag format** (under **Settings → AI → Tag suggestions**) decides how a tag that is not in your library yet is written:

| Setting | What a new tag looks like |
|---------|---------------------------|
| **Follow the library's mix** (default) | Filed under one of your prefixes when one fits, and left plain when none does. No new prefixes are made. If nearly all your tags are prefixed, every new tag gets one. |
| **Always use a prefix** | Always filed under a prefix: one of yours where possible, otherwise a new one in the same style. |
| **Never use a prefix** | Always plain, even in a library full of prefixed tags. Your existing prefixed tags are still suggested when they fit. |
| **Use my own examples** | Written like the examples you type in **Example new tags**, whatever your library does. |

The first three only matter in a library that has prefixed tags; a plain library is not affected by them. **Use my own examples** shows an **Example new tags** field: type one or more tags the way you want new ones to look, separated by commas, for example `Topic: World of Warcraft, Type: Illustration` or `subject/night-elf, medium/digital-painting`. While the field is empty, the library's mix is followed.

**Tips for the tag format**

- **Start with the default.** **Follow the library's mix** never makes a new prefix: a new tag goes under one you already have or is left plain, so your list of prefixes does not grow.
- **New tags arriving plain when you wanted `Topic: …`?** Switch to **Always use a prefix**. Deciding whether a prefix "fits" is a judgment call that models get wrong, most often when there is a hint in the box.
- **Let the model think when the format matters.** A local model with **Effort** set to **None** answers in about a second but follows the format less reliably. With thinking on it is slower and more consistent.
- **New library?** There are no tags yet to read a format from, so choose **Use my own examples** and show the form you want from the start.
- **Changing style?** **Use my own examples** also writes new tags differently from the ones you have. Your existing tags are not renamed and are still suggested as they are, so the library holds both styles until you tidy it in Eagle.
- **Examples show a form, not a list.** The model copies the structure, punctuation, spacing and capitalization, and may file a tag under a prefix you did not show, such as `Faction: Horde`. The examples themselves are only suggested when they fit the image, so they do not need to relate to your images.
- **The form does not have to be a prefix.** One example such as `fantasy-art` gets you lowercase words joined by hyphens. A `#` at the start of a suggested tag is always removed.
- **Check the dashed outlines before you save.** Whatever the setting, a new tag can still come back in the wrong form now and then. Remove it in the dialog; once saved, it is in your Eagle library.

Below the tags is an optional **AI hints** box. Type what the image is, as briefly as you like (for example `WoW Dalaran fan art`), and the wands treat it as true and build on it with what the model knows: proper names, the series it belongs to, the right terms. Hints are only sent to the model; they are not saved to Eagle.

> **Tip:** A hint can steer the suggestions as well as describe the image. Say which kinds of tags you want, for example `Only tag the character races` or `WoW. Tag the locations and factions, not the art style`, and the tag wand concentrates on those. You can combine both in one hint. How closely it is followed depends on the model, and it can still misidentify what it sees, so name specifics yourself where they matter.

For steering you use often, the **Templates** list beside the box adds a ready-made hint, which you can then edit or add to. Seven are built in:

| Template | Hint it adds |
|----------|--------------|
| Subjects | Tag the main subjects: who or what is shown. |
| Art style and medium | Focus on the art style and medium, not the subject. |
| Characters and people | Only tag the characters or people shown. Name someone only if you are certain who it is; otherwise say what kind of character or person they are. |
| Places and setting | Tag the location and setting, not the art style. |
| Series and franchise | Focus on the series or franchise this comes from, and the factions or groups in it. |
| Colors and mood | Tag the dominant colors, the lighting and the mood. |
| Screenshot | This is a screenshot. Tag the app, game or site it shows and what is on screen. |

Rename, reword, delete or add templates under **Settings → AI → Hint templates**; **Restore defaults** brings the built-in list back.

Choose the model under **Settings → AI**. Nothing is selected by default.

| Provider | What you enter |
|----------|----------------|
| **Anthropic** | API key. The model defaults to Claude Haiku 5.5. |
| **OpenAI** | API key and a model that accepts images. |
| **Gemini** | API key and a model that accepts images. |
| **OpenAI-compatible** | The server's address (for example `https://example.com/v1`), an optional API key, and a model. |
| **LM Studio** | Nothing, if its local server is running without a key. It is detected automatically, and a loaded vision model is chosen if you leave the model empty. Add an API key if your LM Studio requires one. |

**Browse** next to the model field lists the models the provider offers, and **Test connection** checks your settings without sending an image.

**Effort** (per provider, under **Settings → AI**) sets how much the model thinks before answering. **Provider default** sends no setting and leaves it to the model. **Low**, **Medium** and **High** ask for less or more; for Claude, effort also covers how thorough the answer is, not only the thinking. A level the model does not accept is left out automatically.

**Local models (LM Studio and OpenAI-compatible servers):**

- With **Provider default**, a reasoning model thinks at length before answering: its best results, but a short title can take 20 seconds or more. Effort also offers **None**, which skips the thinking and answers in about a second.
- Requests run one at a time, so clicking several wands at once is fine.
- An image takes roughly 1,500 tokens of the model's context, and thinking uses the same context. Load a reasoning model with a context length of 16,000 tokens or more; 8,000 is enough with effort set to None.

Each click sends the image, scaled down to at most 1568 pixels on its long side, to the selected provider; a tag request also sends your Eagle tag names and how often each is used. With LM Studio, nothing leaves your computer. API keys are stored in the vault's plugin settings file.

### Cloud Upload

Upload images to cloud storage for sharing and portability.

![Cloud Upload](assets/CMDS-eagle5.gif)
![Paste Options](assets/CMDS-eagle4.gif)

### Excalidraw

Paste or drop images directly onto an Excalidraw canvas and let Eagle handle them:

- **Eagle assets** (copied or dragged from Eagle, or pasted as an `eagle://` or localhost item link) resolve to the **original** image (not the thumbnail). Several items copied at once are all added.
- **New images** such as clipboard screenshots are uploaded to your active cloud provider and embedded by URL. When **Also add new images to Eagle** is on, they go through the same import as images pasted into a note: folder routing, default tags, source capture and backlinks.
- Images are embedded as portable URLs, keeping the `.excalidraw` file small instead of storing vault attachments. Each Eagle item gets the same link as in a note: its cloud copy, or your Custom URL prefix address. A drawing cannot use a file path, so with no Custom URL prefix a cloud copy is made even when **Also upload to the cloud** is off.
- If no portable URL can be made (no cloud provider is set up), Excalidraw handles the paste as it normally would. If an upload fails, the image is saved to your vault instead of being lost.

Requires the [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) plugin. Toggle it under **Settings → Extras → Excalidraw**.

### Canvas

The same works on an Obsidian Canvas: paste or drop an image or an Eagle item onto the canvas and it is added as a card that loads the image by URL.

- **Card type** (under **Settings → Extras → Canvas**):
  - **Text card** (default): a card containing the image, followed by its metadata card when that is enabled.
  - **Link card**: a web card that loads the image address directly.
  - **Ask every time**: choose per paste.
- The card is placed at the pointer or drop position and sized to the image. Several images are laid out side by side.
- Pasting or dropping into a card you are editing is left to that card.
- As with Excalidraw, Canvas handles the paste itself when no portable URL can be made, and a failed upload falls back to an ordinary vault attachment card.

Canvas support relies on Canvas functions that are not part of Obsidian's public plugin interface. If a future Obsidian version changes them, Eagle Bridge steps aside and Canvas behaves as it does without the plugin.

## Settings

The settings are organized into six tabs:

| Tab | What it covers |
|-----|----------------|
| **Connections** | The Eagle app and the Eagle Extra Links plugin, each with a connection test |
| **Cloud storage** | Which cloud provider to use and its credentials |
| **Adding images** | Where pasted or dropped images go, the Eagle folder and tags they get, source capture, and backlinks to your notes |
| **Embedding** | What embedded Eagle images link to, the metadata card, and search defaults |
| **AI** | The AI provider and model behind the name, description and tag wands |
| **Extras** | Excalidraw and Canvas support |


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
