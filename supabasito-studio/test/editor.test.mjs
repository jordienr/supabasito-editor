import test from "node:test";
import assert from "node:assert/strict";
import {
  uploadError,
  dragPosition,
  moveLayer,
  pastedImages,
} from "../dist/editor.mjs";

function pasteEvent(files, { editable = false, text = "", html = "" } = {}) {
  return {
    target: { closest: () => editable },
    clipboardData: {
      items: files.map((file) => ({
        kind: "file",
        getAsFile: () => file,
      })),
      files,
      getData: (type) => (type === "text/plain" ? text : html),
    },
  };
}

test("paste extracts every image once from overlapping clipboard items and files", () => {
  const files = [
    { name: "one.png", type: "image/png", size: 12 },
    { name: "two.jpg", type: "image/jpeg", size: 24 },
  ];
  const event = pasteEvent(files);
  event.clipboardData.items.unshift({ kind: "string" });
  event.clipboardData.items.push({ kind: "file", getAsFile: () => null });
  assert.deepEqual(pastedImages(event), files);
});

test("paste falls back to files and leaves non-image clipboard content alone", () => {
  const image = { type: "image/webp" };
  const event = pasteEvent([{ type: "application/pdf" }, image]);
  event.clipboardData.items = [];
  assert.deepEqual(pastedImages(event), [image]);
  assert.deepEqual(pastedImages(pasteEvent([{ type: "text/plain" }])), []);
  assert.deepEqual(pastedImages(pasteEvent([], { text: "hello" })), []);
  assert.deepEqual(pastedImages({}), []);
  event.defaultPrevented = true;
  assert.deepEqual(pastedImages(event), []);
});

test("paste preserves editable text and HTML while allowing images on the page", () => {
  const files = [{ type: "image/png" }];
  assert.deepEqual(
    pastedImages(pasteEvent(files, { editable: true, text: "caption" })),
    [],
  );
  assert.deepEqual(
    pastedImages(pasteEvent(files, { editable: true, html: "<b>caption</b>" })),
    [],
  );
  assert.deepEqual(pastedImages(pasteEvent(files, { editable: true })), files);
  assert.deepEqual(pastedImages(pasteEvent(files, { text: "image" })), files);
});

test("pasted images share upload format, size and count validation", () => {
  const files = [
    { type: "image/gif", size: 12 },
    { type: "image/png", size: 5 * 1024 * 1024 + 1 },
    { type: "image/png", size: 12 },
    { type: "image/jpeg", size: 12 },
  ];
  const images = pastedImages(pasteEvent(files));
  assert.deepEqual(images, files);
  let count = 4;
  const errors = images.map((file) => {
    const error = uploadError(file, count);
    if (!error) count++;
    return error;
  });
  assert.match(errors[0], /PNG/);
  assert.match(errors[1], /5 MB/);
  assert.equal(errors[2], "");
  assert.match(errors[3], /up to 5/);
  assert.equal(count, 5);
});

test("upload rejects unsupported and oversized files before decode and enforces count", () => {
  assert.match(uploadError({ type: "image/svg+xml", size: 10 }, 0), /PNG/);
  assert.match(
    uploadError({ type: "image/png", size: 5 * 1024 * 1024 + 1 }, 0),
    /5 MB/,
  );
  assert.match(uploadError({ type: "image/png", size: 10 }, 5), /up to 5/);
  assert.equal(
    uploadError({ type: "image/webp", size: 5 * 1024 * 1024 }, 4),
    "",
  );
});
test("drag retains grab offset in SVG coordinates", () => {
  assert.deepEqual(
    dragPosition({ x: 20, y: -10 }, { x: 310, y: 210 }, { x: 340, y: 190 }),
    { x: 50, y: -30 },
  );
});
test("moving one image preserves other layers and image dimensions", () => {
  const state = {
    images: [
      { id: "a", x: 10, y: 20, width: 100, height: 50 },
      { id: "b", x: 30, y: 40 },
    ],
    transforms: { hat: { x: 0, y: 0 } },
  };
  const patch = moveLayer(state, "image-a", { x: 80 });
  assert.deepEqual(patch.images[0], {
    id: "a",
    x: 80,
    y: 20,
    width: 100,
    height: 50,
  });
  assert.equal(patch.images[1], state.images[1]);
  assert.equal(state.images[0].x, 10);
});

test("deleting selected artwork removes only that item or clears its content", async () => {
  const { removeLayer } = await import("../dist/editor.mjs");
  const state = {
    images: [{ id: "a" }, { id: "b" }],
    captions: [{ id: "a", text: "hello", size: 42 }],
    hat: "cap",
  };
  assert.deepEqual(removeLayer(state, "image-a"), {
    images: [state.images[1]],
  });
  assert.deepEqual(removeLayer(state, "caption-a"), {
    captions: [],
  });
  assert.deepEqual(removeLayer(state, "hat"), { hat: "none" });
  assert.equal(state.captions[0].text, "hello");
});
test("delete shortcuts protect typing, composing, modified keys and unrelated buttons", async () => {
  const { shouldDeleteLayer } = await import("../dist/editor.mjs");
  const target = (...matches) => ({
    closest: (selector) =>
      matches.find((match) => selector.includes(match)) || null,
  });
  const event = { key: "Backspace", target: target() };
  assert.equal(shouldDeleteLayer(event, "image-a"), true);
  assert.equal(shouldDeleteLayer({ ...event, key: "Delete" }, "caption"), true);
  assert.equal(shouldDeleteLayer(event, ""), false);
  for (const match of [
    "input",
    "textarea",
    "select",
    "contenteditable",
    "button",
  ]) {
    assert.equal(
      shouldDeleteLayer({ ...event, target: target(match) }, "image-a"),
      false,
    );
  }
  assert.equal(
    shouldDeleteLayer(
      { ...event, target: target("button", "data-layer-action") },
      "image-a",
    ),
    true,
  );
  for (const field of [
    "ctrlKey",
    "altKey",
    "metaKey",
    "shiftKey",
    "isComposing",
    "defaultPrevented",
  ]) {
    assert.equal(
      shouldDeleteLayer({ ...event, [field]: true }, "image-a"),
      false,
    );
  }
});
