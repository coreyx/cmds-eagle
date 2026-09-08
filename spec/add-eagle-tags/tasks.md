# Implementation Tasks

- [ ] **Task 1: Update Settings Interface**
  * Update `CMDSPACEEagleSettings` in `src/types.ts` to add `enableDefaultTags: boolean` and `defaultTags: string`.
  * Update `DEFAULT_SETTINGS` to include default values (false and empty string).
  * *Implements Requirement 1.1, 1.2, 2.3*

- [ ] **Task 2: Add Settings UI Toggle & Input**
  * In `src/settings.ts`, under the "Eagle target folder" block, add a new `Setting` for the "Add default tags" toggle.
  * Right below it, conditionally (if `enableDefaultTags` is true) render a second `Setting` using `.addText(...)` for the user to type comma-separated tags. Update `this.plugin.settings.defaultTags` on change.
  * Ensure toggling the setting calls `this.display()` to re-render the settings view (showing/hiding the text input).
  * *Implements Requirement 1.1, 2.1, 2.2*

- [ ] **Task 3: Implement Tag Parsing Helper**
  * In `src/main.ts`, create a private helper `getDefaultTags(): string[] | undefined` that checks `this.settings.enableDefaultTags`. If true, it splits `this.settings.defaultTags` by commas, trims whitespace, filters empty strings, and returns the array (or undefined if the resulting array is empty).
  * *Implements Requirement 3.1*

- [ ] **Task 4: Inject Tags into Uploads**
  * In `src/main.ts`, locate all `api.addFromPath` and `api.addFromUrl` calls (e.g., `uploadImageToEagle`, and the Excalidraw paste handlers).
  * Add the `tags: this.getDefaultTags()` property to each payload.
  * *Implements Requirement 3.2, 3.3*