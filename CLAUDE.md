# Eagle Bridge

Obsidian plugin — connects the Eagle asset library to your vault. Search, embed, cloud upload (ImgHippo, R2, S3, WebDAV).

Fork of CMDS Eagle (`johnfkoo951/cmds-eagle`), renamed to Eagle Bridge at 1.8.0 and developed independently — upstream is no longer tracked.

## Build

```bash
npm install
npm run dev          # watch mode
npm run build        # tsc + esbuild production
```

Copy the build output `main.js` to the vault:
```bash
cp main.js manifest.json styles.css "/Users/yohankoo/Local Obsidian_MBP/CMDSPACE_Local_MBP/.obsidian/plugins/cmds-eagle/"
```

## Project Structure

```
src/
├── main.ts             # Plugin entry (CMDSEagle class)
├── api.ts              # Eagle REST API client
├── cloud-providers.ts  # ImgHippo, R2, S3, WebDAV upload
├── modals.ts           # Search/embed modals
├── settings.ts         # Settings tab
└── types.ts            # Interfaces, defaults
```

## Key Info

- **ID**: `eagle-bridge`
- **Version**: 1.13.0
- **Desktop only**: yes (Eagle REST API is local)
- **GitHub**: `coreyx/obsidian-eagle-bridge`
- **Distribution**: GitHub releases installed via BRAT (not in Community Plugins)

## Release Workflow

Use the `obsidian-plugin-dev` skill (can be invoked from any Claude Code session).
1. `npm run build` — verify the build
2. Update the version in `manifest.json` + `versions.json`
3. Create a GitHub release (attach `main.js`, `manifest.json`, `styles.css`)
4. In Obsidian Community: Review Branch → Check for new release

## CMDS Plugin Family

| Plugin | DEV path | Description |
|--------|----------|-------------|
| **cmds-eagle** | (here) | Eagle asset integration |
| cmds-share | `/Users/yohankoo/DEV/cmds-share/` | Share notes on the web |
| cmds-link-bookends | `/Users/yohankoo/DEV/cmds-link-bookends/` | Bookends reference integration |
| cmds-link-devonthink | `/Users/yohankoo/DEV/cmds-link-devonthink/` | DEVONthink document integration |
