import test from "node:test";
import assert from "node:assert/strict";
import {
  removeWhiteBackground,
  toggleImageBackground,
} from "../dist/image-background.mjs";
import { removeImageBackground, prepareImage } from "../dist/editor.mjs";
import { validateState, mascotSVG } from "../dist/mascot.mjs";
import { layerToolbar, toolbarPosition } from "../dist/selection.mjs";

const source = (value) => `data:image/png;base64,${value}`;
const grid = (rows) => new Uint8ClampedArray(rows.flat(2));
const white = [255, 255, 255, 255];
const brown = [145, 95, 55, 255];

function fixture() {
  return grid([
    [white, [248, 247, 245, 255], white, white, white],
    [white, brown, brown, brown, white],
    [white, brown, white, brown, white],
    [white, brown, brown, brown, white],
    [white, white, white, white, white],
  ]);
}

test("removes connected white and nearwhite borders while preserving enclosed whites and colored object", () => {
  const input = fixture();
  const original = input.slice();
  const { data, changed } = removeWhiteBackground(input, 5, 5);
  assert.equal(changed, true);
  assert.equal(data[3], 0);
  assert.equal(data[7], 0);
  assert.deepEqual([...data.slice(48, 52)], white);
  assert.deepEqual([...data.slice(24, 28)], brown);
  assert.deepEqual(input, original);
});

test("softens only connected low-chroma antialias pixels and retains colored nearwhites", () => {
  const input = grid([
    [white, [232, 232, 230, 255], [245, 220, 190, 255], brown],
  ]);
  const { data } = removeWhiteBackground(input, 4, 1);
  assert.ok(data[7] > 0 && data[7] < 255);
  assert.deepEqual([...data.slice(8, 12)], [245, 220, 190, 255]);
  assert.deepEqual([...data.slice(12)], brown);
});

test("preserves existing transparent backgrounds including adjacent white artwork", () => {
  const input = grid([[[0, 0, 0, 0], white, brown]]);
  const result = removeWhiteBackground(input, 3, 1);
  assert.equal(result.changed, false);
  assert.deepEqual(result.data, input);
});

test("colored backgrounds are unchanged and dimensions are bounded", () => {
  const input = grid([
    [brown, brown],
    [brown, brown],
  ]);
  assert.deepEqual(removeWhiteBackground(input, 2, 2), {
    data: input,
    changed: false,
  });
  assert.throws(() => removeWhiteBackground(input, 1601, 1), /dimensions/);
  assert.throws(() => removeWhiteBackground(input, 2, 3), /dimensions/);
});

test("restore and reapply retain exact source bytes, survive persistence and export the active variant", () => {
  const original = source("b3JpZ2luYWw=");
  const processed = source("cHJvY2Vzc2Vk");
  let image = {
    id: "hat",
    src: processed,
    originalSrc: original,
    backgroundRemoved: true,
  };
  for (let index = 0; index < 3; index++) {
    let state = validateState(JSON.parse(JSON.stringify({ images: [image] })));
    assert.equal(state.images[0].originalSrc, original);
    assert.ok(mascotSVG(state).includes(`href="${processed}"`));
    image = toggleImageBackground(state.images[0]);
    state = validateState(JSON.parse(JSON.stringify({ images: [image] })));
    assert.equal(state.images[0].src, original);
    assert.equal(state.images[0].backgroundRemovedSrc, processed);
    assert.equal(state.images[0].originalSrc, undefined);
    assert.equal(state.images[0].backgroundRemoved, false);
    assert.ok(mascotSVG(state).includes(`href="${original}"`));
    image = toggleImageBackground(state.images[0]);
    assert.equal(image.src, processed);
    assert.equal(image.backgroundRemovedSrc, undefined);
    assert.equal(image.originalSrc, original);
  }
});

test("saved legacy uploads remain unchanged and alternate sources reject unsafe content", () => {
  const legacy = { id: "old", src: source("b2xk") };
  assert.equal(toggleImageBackground(legacy), null);
  assert.deepEqual(
    validateState({ images: [legacy] }).images[0].src,
    legacy.src,
  );
  const invalid = validateState({
    images: [
      {
        ...legacy,
        originalSrc: "https://external.invalid/x",
        backgroundRemovedSrc: "data:image/svg+xml;base64,xxx",
        backgroundRemoved: true,
      },
    ],
  }).images[0];
  assert.equal(invalid.originalSrc, undefined);
  assert.equal(invalid.backgroundRemovedSrc, undefined);
  assert.equal(invalid.backgroundRemoved, undefined);
});

test("image toolbar has a fifth reversible background action while accessory controls stay unchanged", () => {
  const corners = [
    { x: 10, y: 10 },
    { x: 100, y: 10 },
    { x: 100, y: 100 },
    { x: 10, y: 100 },
  ];
  const removed = layerToolbar(
    corners,
    1,
    { backgroundRemoved: true },
    "image-a",
  );
  assert.equal((removed.match(/<button /g) || []).length, 5);
  assert.match(
    removed,
    /data-layer-action="backgroundRemoved" aria-label="Restore background"/,
  );
  assert.match(
    layerToolbar(corners, 1, {}, "image-a"),
    /aria-label="Remove white background"/,
  );
  assert.equal(
    (layerToolbar(corners, 1, {}, "prop").match(/<button /g) || []).length,
    4,
  );
  assert.equal(toolbarPosition(corners, 1, 5).width, 158);
});

function canvasEnvironment(t, input, { failRead = false } = {}) {
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  const loaded = [];
  let current = input.slice();
  globalThis.Image = class {
    naturalWidth = 5;
    naturalHeight = 5;
    set src(value) {
      loaded.push(value);
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        drawImage() {},
        getImageData() {
          if (failRead) throw new Error("read failure");
          return { data: current.slice() };
        },
        putImageData(pixels) {
          current = pixels.data.slice();
        },
      }),
      toDataURL: () => source(Buffer.from(current).toString("base64")),
    }),
  };
  t.after(() => {
    globalThis.Image = previousImage;
    globalThis.document = previousDocument;
  });
  return loaded;
}

test("legacy saved upload can opt in asynchronously and restore exact legacy source without decoding twice", async (t) => {
  const loaded = canvasEnvironment(t, fixture());
  const legacy = { id: "legacy", src: source("bGVnYWN5"), x: 42, rotation: 16 };
  const removed = await removeImageBackground(legacy);
  assert.equal(removed.backgroundRemoved, true);
  assert.equal(removed.originalSrc, legacy.src);
  assert.notEqual(removed.src, legacy.src);
  assert.equal(removed.x, 42);
  const restored = await removeImageBackground(removed);
  assert.equal(restored.src, legacy.src);
  const reapplied = await removeImageBackground(restored);
  assert.equal(reapplied.src, removed.src);
  assert.equal(loaded.length, 1);
});

test("upload pipeline automatically removes detected background and leaves intact image when removal fails", async (t) => {
  canvasEnvironment(t, fixture(), { failRead: true });
  const file = new Blob(["fixture"], { type: "image/png" });
  Object.defineProperty(file, "name", { value: "hat.png" });
  const image = await prepareImage(file);
  assert.equal(image.src, source(Buffer.from(fixture()).toString("base64")));
  assert.equal(image.originalSrc, undefined);
  assert.match(image.backgroundError, /unchanged/);
});

test("new uploads clean automatically and store only active and original sources", async (t) => {
  canvasEnvironment(t, fixture());
  const file = new Blob(["fixture"], { type: "image/png" });
  Object.defineProperty(file, "name", { value: "hat.png" });
  const image = await prepareImage(file);
  assert.equal(image.backgroundRemoved, true);
  assert.equal(
    image.originalSrc,
    source(Buffer.from(fixture()).toString("base64")),
  );
  assert.equal(image.backgroundRemovedSrc, undefined);
  const decoded = Buffer.from(image.src.split(",")[1], "base64");
  assert.equal(decoded[3], 0);
  assert.equal(decoded[51], 255);
});

test("colored uploads keep one source and no unused restore variants", async (t) => {
  canvasEnvironment(
    t,
    new Uint8ClampedArray(Array.from({ length: 25 }, () => brown).flat()),
  );
  const file = new Blob(["fixture"], { type: "image/png" });
  Object.defineProperty(file, "name", { value: "brown.png" });
  const image = await prepareImage(file);
  assert.equal(image.backgroundRemoved, undefined);
  assert.equal(image.originalSrc, undefined);
  assert.equal(image.backgroundRemovedSrc, undefined);
});

test("maximum supported image dimensions process a fully connected background", () => {
  const input = new Uint8ClampedArray(1600 * 1600 * 4).fill(255);
  const result = removeWhiteBackground(input, 1600, 1600);
  assert.equal(result.changed, true);
  assert.equal(result.data[3], 0);
  assert.equal(result.data[result.data.length - 1], 0);
  assert.equal(result.data[(800 * 1600 + 800) * 4 + 3], 0);
});
