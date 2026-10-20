import test from "node:test";
import assert from "node:assert/strict";
import {
  resizeAt,
  rotationHandle,
  rotationAt,
  rotateVector,
  transformChanges,
  resizeLimits,
} from "../dist/selection.mjs";
import {
  captionDefaults,
  defaults,
  validateState,
  mascotSVG,
} from "../dist/mascot.mjs";
const close = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-8,
    `${actual} differs from ${expected}`,
  );
const pointClose = (actual, expected) => {
  close(actual.x, expected.x);
  close(actual.y, expected.y);
};
const cases = [
  [
    "rotation handle chooses a visible edge for artwork near canvas boundary",
    () => {
      const result = rotationHandle(
        [
          { x: 240, y: 10 },
          { x: 390, y: 10 },
          { x: 390, y: 180 },
          { x: 240, y: 180 },
        ],
        { x: 315, y: 95 },
        1,
      );
      assert.deepEqual(result, {
        base: { x: 315, y: 180 },
        handle: { x: 315, y: 208 },
      });
      const normal = rotationHandle(
        [
          { x: 240, y: 80 },
          { x: 390, y: 80 },
          { x: 390, y: 180 },
          { x: 240, y: 180 },
        ],
        { x: 315, y: 130 },
        1,
      );
      assert.deepEqual(normal, {
        base: { x: 315, y: 80 },
        handle: { x: 315, y: 52 },
      });
    },
  ],
  [
    "rotated accessory resize fixes opposite corner and retains grab offset",
    () => {
      const anchor = { x: 340, y: 170 };
      const localOpposite = { x: -90, y: -70 };
      const offset = rotateVector(localOpposite, 37);
      const opposite = { x: anchor.x + offset.x, y: anchor.y + offset.y };
      const diagonal = rotateVector({ x: 170, y: 110 }, 37);
      const corner = { x: opposite.x + diagonal.x, y: opposite.y + diagonal.y };
      const start = { x: corner.x + 4, y: corner.y - 3 };
      const origin = { anchor, x: 25, y: 25, scale: 1.3, rotation: 37 };
      const unchanged = resizeAt(
        origin,
        corner,
        opposite,
        start,
        start,
        0.1,
        3,
      );
      close(unchanged.factor, 1);
      pointClose(unchanged.anchor, anchor);
      const result = resizeAt(
        origin,
        corner,
        opposite,
        start,
        { x: start.x + diagonal.x * 0.5, y: start.y + diagonal.y * 0.5 },
        0.1,
        3,
      );
      close(result.factor, 1.5);
      pointClose(
        {
          x: result.anchor.x + offset.x * result.factor,
          y: result.anchor.y + offset.y * result.factor,
        },
        opposite,
      );
      const changes = transformChanges("hat", origin, result, {
        x: 315,
        y: 145,
      });
      close(changes.scale, 1.95);
      close(changes.x + 315, result.anchor.x);
      close(changes.y + 145, result.anchor.y);
    },
  ],
  [
    "rotation holds an off-anchor visible center fixed",
    () => {
      const center = { x: 300, y: 200 };
      const origin = { rotation: 35, anchor: { x: 330, y: 220 } };
      const result = rotationAt(
        origin,
        center,
        { x: 400, y: 200 },
        { x: 300, y: 300 },
      );
      close(result.rotation, 125);
      pointClose(result.anchor, { x: 280, y: 230 });
      const centerOffset = rotateVector(
        { x: center.x - origin.anchor.x, y: center.y - origin.anchor.y },
        90,
      );
      pointClose(
        {
          x: result.anchor.x + centerOffset.x,
          y: result.anchor.y + centerOffset.y,
        },
        center,
      );
    },
  ],
  [
    "rotation snapping remains continuous across the angle wrap",
    () => {
      const point = (degrees) => rotateVector({ x: 100, y: 0 }, degrees);
      const origin = { rotation: 170, anchor: { x: 0, y: 0 } };
      const result = rotationAt(
        origin,
        { x: 0, y: 0 },
        point(179),
        point(-170),
        true,
      );
      assert.equal(result.rotation, -180);
      const unsnapped = rotationAt(
        origin,
        { x: 0, y: 0 },
        point(179),
        point(-170),
      );
      close(unsnapped.rotation, -179);
    },
  ],
  [
    "image resize clamps uniformly and preserves its aspect ratio",
    () => {
      const origin = { anchor: { x: 50, y: 50 }, width: 600, height: 300 };
      const result = resizeAt(
        origin,
        { x: 100, y: 100 },
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 1000, y: 1000 },
        ...resizeLimits("image-a", origin),
      );
      const changes = transformChanges("image-a", origin, result);
      assert.equal(changes.width, 1200);
      assert.equal(changes.height, 600);
      assert.equal(changes.x, 100);
    },
  ],
  [
    "caption resize scales its bounded layout while exporting rotation without editor handles",
    () => {
      const origin = {
        ...captionDefaults,
        text: "A VERY LONG CAPTION TO RESIZE",
        rotation: 30,
        anchor: { x: 300, y: 470 },
      };
      const changes = transformChanges("caption", origin, {
        anchor: { x: 280, y: 450 },
        factor: 1.5,
      });
      assert.deepEqual(changes, { x: 280, y: 450, scale: 1.5 });
      const state = validateState({ caption: { ...origin, ...changes } });
      const svg = mascotSVG(state, { standalone: true });
      assert.ok(
        svg.includes(
          "translate(280 450) rotate(30) scale(1.5) translate(-280 -450)",
        ),
      );
      assert.ok(svg.includes('textLength="520"'));
      assert.ok(!/data-selection|data-transform|data-layer/.test(svg));
      assert.equal(
        validateState({ caption: { text: "old" } }).captions[0].rotation,
        0,
      );
      assert.equal(
        validateState({ caption: { text: "old" } }).captions[0].scale,
        1,
      );
      assert.equal(
        validateState({
          caption: { text: "old", rotation: Infinity, scale: 99 },
        }).captions[0].rotation,
        0,
      );
      assert.equal(
        validateState({
          caption: { text: "old", rotation: Infinity, scale: 99 },
        }).captions[0].scale,
        3,
      );
    },
  ],
];
for (const [name, run] of process.env.TEST_REVERSE === "1"
  ? [...cases].reverse()
  : cases)
  test(name, run);

test("unlocked resize anchors the opposite visible corner under rotation and either flip", () => {
  for (const rotation of [0, 37, -120]) {
    for (const flipX of [-1, 1]) {
      for (const flipY of [-1, 1]) {
        for (const cornerX of [-1, 1]) {
          for (const cornerY of [-1, 1]) {
            const origin = {
              anchor: { x: 300, y: 280 },
              width: 180,
              height: 100,
              rotation,
              lockAspectRatio: false,
            };
            const local = { x: cornerX * flipX * 90, y: cornerY * flipY * 50 };
            const offset = rotateVector(local, rotation);
            const corner = { x: 300 + offset.x, y: 280 + offset.y };
            const opposite = { x: 300 - offset.x, y: 280 - offset.y };
            const delta = rotateVector(
              { x: cornerX * flipX * 60, y: cornerY * flipY * -40 },
              rotation,
            );
            const result = resizeAt(
              origin,
              corner,
              opposite,
              corner,
              { x: corner.x + delta.x, y: corner.y + delta.y },
              ...resizeLimits("image-a", origin),
            );
            const changes = transformChanges("image-a", origin, result);
            close(changes.width, 240);
            close(changes.height, 60);
            const resizedOffset = rotateVector(
              {
                x: (cornerX * flipX * changes.width) / 2,
                y: (cornerY * flipY * changes.height) / 2,
              },
              rotation,
            );
            pointClose(
              {
                x: changes.x - resizedOffset.x,
                y: changes.y - resizedOffset.y,
              },
              opposite,
            );
            const limit = resizeAt(
              origin,
              corner,
              opposite,
              corner,
              { x: corner.x + offset.x * 100, y: corner.y + offset.y * 100 },
              ...resizeLimits("image-a", origin),
            );
            close(limit.width, 1200);
            close(limit.height, 1200);
            const minimum = resizeAt(
              origin,
              corner,
              opposite,
              corner,
              opposite,
              ...resizeLimits("image-a", origin),
            );
            close(minimum.width, 1);
            close(minimum.height, 1);
          }
        }
      }
    }
  }
});
test("toolbar follows rotated bounds while clamped inside the canvas at constant screen size", async () => {
  const { toolbarPosition } = await import("../dist/selection.mjs");
  const corners = [
    { x: 100, y: 100 },
    { x: 400, y: 200 },
    { x: 350, y: 350 },
    { x: 50, y: 250 },
  ];
  const normal = toolbarPosition(corners, 1);
  assert.deepEqual(normal, { x: 272, y: 362, width: 128, height: 38 });
  for (const unit of [0.5, 1, 2]) {
    const positioned = toolbarPosition(
      corners.map((p) => ({ x: p.x + 1000, y: p.y + 1000 })),
      unit,
    );
    close(positioned.width / unit, 128);
    assert.ok(positioned.x >= 0 && positioned.x + positioned.width <= 600);
    assert.ok(positioned.y >= 0 && positioned.y + positioned.height <= 600);
  }
});
