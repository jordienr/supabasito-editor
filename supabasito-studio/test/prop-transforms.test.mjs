import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  layerAnchors,
  validateState,
  mascotSVG,
} from "../dist/mascot.mjs";
import {
  layerToolbar,
  resizeAt,
  resizeLimits,
  rotateVector,
  transformChanges,
} from "../dist/selection.mjs";
import { toggleLayerAction } from "../dist/editor.mjs";

const close = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    `${actual} differs from ${expected}`,
  );
const corners = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 },
  { x: 100, y: 200 },
];

test("accessory transforms recover old saves, sanitize new fields, and round-trip to matching preview and export", () => {
  const old = validateState({ transforms: { hat: { scale: 1.8 } } });
  assert.deepEqual(old.transforms.hat, {
    ...defaults.transforms.hat,
    scale: 1.8,
  });
  const invalid = validateState({
    transforms: {
      face: {
        scaleX: Infinity,
        scaleY: -2,
        flipX: "true",
        flipY: true,
        lockAspectRatio: 0,
      },
    },
  });
  assert.deepEqual(invalid.transforms.face, {
    ...defaults.transforms.face,
    scaleY: 0.1,
    flipY: true,
  });
  assert.equal(
    validateState({ transforms: { prop: { scaleX: 100 } } }).transforms.prop
      .scaleX,
    10,
  );
  for (const id of ["hat", "face", "prop"]) {
    const input = {
      [id]: { hat: "cap", face: "round", prop: "coffee" }[id],
      transforms: {
        [id]: {
          x: 30,
          y: -10,
          scale: 1.5,
          scaleX: 2,
          scaleY: 0.6,
          flipX: true,
          flipY: true,
          lockAspectRatio: false,
          rotation: 37,
        },
      },
    };
    const saved = validateState(input);
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(saved))), saved);
    const a = layerAnchors[id];
    const transform = `translate(30 -10) translate(${a.x} ${a.y}) rotate(37) scale(-3 -0.8999999999999999) translate(${-a.x} ${-a.y})`;
    assert.ok(mascotSVG(saved, { interactive: true }).includes(transform));
    assert.ok(mascotSVG(saved, { standalone: true }).includes(transform));
    assert.ok(
      !mascotSVG(saved, { standalone: true }).includes("data-layer-action"),
    );
  }
});

test("unlocked accessory resize preserves off-center opposite corners through rotation and flips", () => {
  for (const rotation of [0, 37, -120])
    for (const flipX of [-1, 1])
      for (const flipY of [-1, 1])
        for (const cornerX of [-1, 1])
          for (const cornerY of [-1, 1]) {
            const origin = {
              ...defaults.transforms.hat,
              x: 25,
              y: -15,
              scale: 1.2,
              scaleX: 1.4,
              scaleY: 0.8,
              rotation,
              flipX: flipX < 0,
              flipY: flipY < 0,
              lockAspectRatio: false,
              anchor: { x: 340, y: 130 },
            };
            const localOpposite = {
              x: (20 - cornerX * 70) * flipX * origin.scale * origin.scaleX,
              y: (-30 - cornerY * 50) * flipY * origin.scale * origin.scaleY,
            };
            const offset = rotateVector(localOpposite, rotation);
            const opposite = {
              x: origin.anchor.x + offset.x,
              y: origin.anchor.y + offset.y,
            };
            const diagonal = rotateVector(
              {
                x: cornerX * flipX * 140 * origin.scale * origin.scaleX,
                y: cornerY * flipY * 100 * origin.scale * origin.scaleY,
              },
              rotation,
            );
            const corner = {
              x: opposite.x + diagonal.x,
              y: opposite.y + diagonal.y,
            };
            const localDiagonal = rotateVector(diagonal, -rotation);
            const delta = rotateVector(
              { x: localDiagonal.x * 0.5, y: localDiagonal.y * -0.25 },
              rotation,
            );
            const start = { x: corner.x + 4, y: corner.y - 3 };
            const unchanged = resizeAt(
              origin,
              corner,
              opposite,
              start,
              start,
              ...resizeLimits("hat", origin),
            );
            close(unchanged.anchor.x, origin.anchor.x);
            close(unchanged.anchor.y, origin.anchor.y);
            const resized = resizeAt(
              origin,
              corner,
              opposite,
              start,
              { x: start.x + delta.x, y: start.y + delta.y },
              ...resizeLimits("hat", origin),
            );
            const changes = transformChanges(
              "hat",
              origin,
              resized,
              layerAnchors.hat,
            );
            close(changes.scaleX, 2.1);
            close(changes.scaleY, 0.6);
            const afterOffset = rotateVector(
              { x: localOpposite.x * 1.5, y: localOpposite.y * 0.75 },
              rotation,
            );
            close(changes.x + layerAnchors.hat.x + afterOffset.x, opposite.x);
            close(changes.y + layerAnchors.hat.y + afterOffset.y, opposite.y);
            const locked = {
              ...origin,
              ...changes,
              lockAspectRatio: true,
              anchor: resized.anchor,
            };
            const resizedCorner = {
              x: opposite.x + diagonal.x + delta.x,
              y: opposite.y + diagonal.y + delta.y,
            };
            const lockedResize = resizeAt(
              locked,
              resizedCorner,
              opposite,
              resizedCorner,
              {
                x: opposite.x + (resizedCorner.x - opposite.x) * 1.1,
                y: opposite.y + (resizedCorner.y - opposite.y) * 1.1,
              },
              ...resizeLimits("hat", locked),
            );
            const lockedChanges = transformChanges(
              "hat",
              locked,
              lockedResize,
              layerAnchors.hat,
            );
            close(lockedChanges.scale, 1.32);
            assert.equal(lockedChanges.scaleX, undefined);
            assert.equal(lockedChanges.scaleY, undefined);
          }
});

test("accessory toolbar buttons expose labels, toggle only their layer and keep current proportions on relock", () => {
  for (const [id, label] of [
    ["hat", "hat"],
    ["face", "glasses"],
    ["prop", "prop"],
    ["image-a", "image"],
  ]) {
    const value = { ...defaults.transforms.hat, scaleX: 2, scaleY: 0.6 };
    const state = validateState(null);
    if (id.startsWith("image-")) state.images = [{ ...value, id: "a" }];
    else state.transforms[id] = value;
    const html = layerToolbar(corners, 1, value, id);
    for (const label of [
      "Flip horizontally",
      "Flip vertically",
      "Unlock aspect ratio",
    ])
      assert.ok(html.includes(`aria-label="${label}"`));
    assert.ok(html.includes(`aria-label="Delete ${label}"`));
    let current = state;
    for (const action of [
      "flipX",
      "flipY",
      "lockAspectRatio",
      "lockAspectRatio",
    ])
      current = { ...current, ...toggleLayerAction(current, id, action) };
    const actual = id.startsWith("image-")
      ? current.images[0]
      : current.transforms[id];
    assert.equal(actual.flipX, true);
    assert.equal(actual.flipY, true);
    assert.equal(actual.lockAspectRatio, true);
    assert.equal(actual.scaleX, 2);
    assert.equal(actual.scaleY, 0.6);
    assert.equal(state.transforms.prop.flipX, false);
    assert.ok(
      layerToolbar(
        corners,
        1,
        { ...value, lockAspectRatio: false },
        id,
      ).includes('aria-label="Lock aspect ratio"'),
    );
  }
  assert.equal(toggleLayerAction(defaults, "caption", "flipX"), null);
  assert.equal(toggleLayerAction(defaults, "hat", "x"), null);
});

test("accessory flips preserve the visible center away from the transform anchor", () => {
  for (const rotation of [0, 37, -120])
    for (const action of ["flipX", "flipY"]) {
      const value = { ...defaults.transforms.hat, x: 25, y: -15, rotation };
      const anchor = {
        x: value.x + layerAnchors.hat.x,
        y: value.y + layerAnchors.hat.y,
      };
      const offset = rotateVector({ x: 20, y: -30 }, rotation);
      const center = { x: anchor.x + offset.x, y: anchor.y + offset.y };
      const state = {
        ...defaults,
        transforms: { ...defaults.transforms, hat: value },
      };
      const changes = toggleLayerAction(
        state,
        "hat",
        action,
        center,
        layerAnchors.hat,
      );
      const next = changes.transforms.hat;
      const nextOffset = rotateVector(
        { x: action === "flipX" ? -20 : 20, y: action === "flipY" ? 30 : -30 },
        rotation,
      );
      close(next.x + layerAnchors.hat.x + nextOffset.x, center.x);
      close(next.y + layerAnchors.hat.y + nextOffset.y, center.y);
      const restored = toggleLayerAction(
        { ...state, ...changes },
        "hat",
        action,
        center,
        layerAnchors.hat,
      ).transforms.hat;
      close(restored.x, value.x);
      close(restored.y, value.y);
    }
});
