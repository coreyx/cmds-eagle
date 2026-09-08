# Technical Stack

## Language & Environment
* **TypeScript** (Targeting ES2018 / ES6 via esbuild)
* **Node.js Environment** (Available via Obsidian Desktop)

## Framework & APIs
* **Obsidian Plugin API**:
  * `Setting` class (for adding toggles and text inputs to the settings tab)
* **Eagle Local API**:
  * `/api/item/addFromPath` (POST): Accepts an optional `tags?: string[]` property in its payload.
  * `/api/item/addFromURL` (POST): Accepts an optional `tags?: string[]` property in its payload.

## Existing Components to Reuse/Extend
* `CMDSPACEEagleSettings` interface (`src/types.ts`): Needs `enableDefaultTags` and `defaultTags` additions.
* Settings Tab (`src/settings.ts`): Will house the new toggle and input fields.
* Upload logic (`src/main.ts`): Functions like `uploadImageToEagle` and Excalidraw integration uploaders need to map the string settings into the `tags` array payload.