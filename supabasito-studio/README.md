# Supabasito Studio

A browser-based mascot editor for the Supabase community. Choose body and shoe colors, faces, hats, glasses, and hand props. Add uploaded images and captions, then download a 1024 × 1024 PNG or an editable SVG.

See the [repository README](../README.md) for local setup, tests, and GitHub Pages deployment.

## Editing

Select artwork on the canvas or in the Layers list. Drag it to move, use its corner handles to resize, and use the selection toolbar for available transforms. Drag a layer's handle in the Layers list to change its stacking order. A focused layer also supports Alt + ↑ / ↓ to reorder.

With the canvas focused, arrow keys move the selected layer; hold Shift for larger steps. Escape deselects it. Delete or Backspace removes selected artwork when you are not editing text.

The Uploads tab accepts up to five PNG, JPEG, or WebP images, at most 5 MB each. You can choose files, drop them into the upload area, or paste images from the clipboard. The Text tab supports up to 20 captions, each with up to 100 characters, and lets you edit the selected caption's text, size, and color.

Settings and added artwork stay in the browser. The editor reports when browser storage is full or unavailable.

## Files

- `dist/index.html`: page structure and controls.
- `dist/styles.css`: editor styling.
- `dist/app.mjs`: editor interaction, persistence, and downloads.
- `dist/mascot.mjs`: illustration, state validation, and SVG generation.
- `dist/editor.mjs`: layer editing and image input handling.
- `dist/selection.mjs`: selection geometry and transforms.
- `dist/image-background.mjs`: local image background processing.
- `test/`: Node.js tests.

This fan-made editor is not an official Supabase product.
