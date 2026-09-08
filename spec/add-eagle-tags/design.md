# Architecture & Design Details

## Eagle API Compatibility
The Eagle API endpoints `addFromPath` and `addFromURL` both support a `tags: string[]` property in their payload. This makes appending tags extremely straightforward, requiring no additional API calls after upload.

## Settings State Management
We will extend the `CMDSPACEEagleSettings` interface with two new properties:
* `enableDefaultTags`: `boolean` (default: false)
* `defaultTags`: `string` (default: "")

## String Parsing Logic
Since the Obsidian UI provides a simple `text` input setting, users will input tags as a comma-separated list (e.g., `design, web inspiration, dark mode`).
Before calling the API, this string must be transformed safely into a string array:
```typescript
const getTagsArray = (tagsString: string): string[] => {
    return tagsString
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
};
```

## UI Flow
1. **Toggle Row**: "Add default tags to new Eagle attachments" (controls `enableDefaultTags`).
2. **Text Input Row**: Only visibly enabled or functional when the toggle is true. It will show a text input for the `defaultTags` string. Re-render `display()` on toggle change to selectively show this row (consistent with the recent target folder implementation).