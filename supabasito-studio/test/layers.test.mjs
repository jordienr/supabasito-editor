import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  validateState,
  mascotSVG,
  visibleLayerIds,
  reorderLayer,
  normalizeLayerOrder,
} from "../dist/mascot.mjs";
import { removeLayer, layerValue, shouldDeleteLayer } from "../dist/editor.mjs";

const image = {
  id: "a",
  name: "Photo",
  src: "data:image/png;base64,aGVsbG8=",
  x: 300,
  y: 250,
  width: 500,
  height: 500,
};
const populated = () =>
  validateState({
    hat: "cap",
    prop: "beer",
    face: "sunglasses",
    images: [image],
    caption: { text: "HELLO" },
  });
const cases = [
  [
    "legacy saves receive canonical back-to-front order and keep grasping fingers above props",
    () => {
      const state = populated();
      assert.deepEqual(state.layerOrder, [
        "base",
        "face",
        "prop",
        "hat",
        "image-a",
        "fingers",
        "caption-legacy",
      ]);
      const svg = mascotSVG(state);
      assert.ok(svg.indexOf("translate(54 209)") < svg.indexOf("M57 234C66"));
      assert.ok(svg.indexOf('id="art-base"') < svg.indexOf('id="art-face"'));
      assert.ok(svg.indexOf('id="art-face"') < svg.indexOf('id="art-hat"'));
      assert.deepEqual(visibleLayerIds(validateState(defaults)), [
        "base",
        "fingers",
      ]);
    },
  ],
  [
    "normalization rejects stale, duplicate, and non-string ids and appends newly added layers",
    () => {
      const state = validateState({
        ...populated(),
        layerOrder: [
          "image-a",
          "base",
          "image-a",
          "image-deleted",
          {},
          "caption-legacy",
        ],
      });
      assert.deepEqual(state.layerOrder, [
        "image-a",
        "base",
        "caption-legacy",
        "face",
        "prop",
        "fingers",
        "hat",
      ]);
      assert.deepEqual(
        validateState({ ...state, layerOrder: "base" }).layerOrder,
        populated().layerOrder,
      );
      const added = validateState({
        ...state,
        images: [...state.images, { ...image, id: "b" }],
      });
      assert.deepEqual(added.layerOrder, [
        ...state.layerOrder.filter((id) => id !== "fingers"),
        "image-b",
        "fingers",
      ]);
      assert.deepEqual(
        validateState(JSON.parse(JSON.stringify(added))).layerOrder,
        added.layerOrder,
      );
    },
  ],
  [
    "moving layers changes SVG and PNG-source export painter order while preserving transforms",
    () => {
      const initial = populated();
      const layerOrder = reorderLayer(initial, "image-a", "base");
      assert.deepEqual(initial.layerOrder, populated().layerOrder);
      assert.deepEqual(layerOrder, [
        "image-a",
        "base",
        "face",
        "prop",
        "hat",
        "fingers",
        "caption-legacy",
      ]);
      const behind = validateState({ ...initial, layerOrder });
      for (const options of [
        { interactive: true },
        { standalone: true, background: true },
      ]) {
        const svg = mascotSVG(behind, options);
        assert.ok(svg.indexOf("<image ") < svg.indexOf('id="art-base"'));
        assert.ok(svg.indexOf('id="art-base"') < svg.indexOf("<text "));
        assert.ok(svg.includes('width="500" height="500"'));
      }
      const front = validateState({
        ...behind,
        layerOrder: reorderLayer(behind, "image-a", "caption-legacy"),
      });
      assert.ok(
        mascotSVG(front).indexOf("<image ") >
          mascotSVG(front).indexOf("<text "),
      );
      assert.deepEqual(
        reorderLayer(front, "missing", "base"),
        front.layerOrder,
      );
      assert.deepEqual(
        reorderLayer(front, "base", "missing"),
        front.layerOrder,
      );
      assert.deepEqual(reorderLayer(front, "base", "base"), front.layerOrder);
    },
  ],
  [
    "deleting and readding artwork removes stale order entries without moving surviving layers",
    () => {
      const state = populated();
      const removed = validateState({
        ...state,
        ...removeLayer(state, "image-a"),
      });
      assert.deepEqual(
        removed.layerOrder,
        state.layerOrder.filter((id) => id !== "image-a"),
      );
      const noProp = validateState({ ...state, ...removeLayer(state, "prop") });
      assert.ok(!visibleLayerIds(noProp).includes("prop"));
      assert.ok(
        visibleLayerIds(validateState({ ...noProp, prop: "flag" })).includes(
          "prop",
        ),
      );
      assert.ok(
        !visibleLayerIds(
          validateState({ ...state, ...removeLayer(state, "caption-legacy") }),
        ).includes("caption-legacy"),
      );
      for (const id of ["base", "fingers"]) {
        assert.equal(layerValue(state, id), undefined);
        assert.equal(
          shouldDeleteLayer(
            { key: "Delete", target: { closest: () => null } },
            id,
          ),
          false,
        );
        assert.deepEqual(
          validateState({ ...state, ...removeLayer(state, id) }),
          state,
        );
      }
    },
  ],
  [
    "normalization keeps fingers above every image while preserving other relative order",
    () => {
      const state = validateState({
        ...populated(),
        images: [image, { ...image, id: "b" }],
      });
      const invalid = [
        "base",
        "image-a",
        "fingers",
        "caption-legacy",
        "face",
        "image-b",
        "hat",
        "prop",
      ];
      const expected = [
        "base",
        "image-a",
        "caption-legacy",
        "face",
        "image-b",
        "fingers",
        "hat",
        "prop",
      ];
      assert.deepEqual(normalizeLayerOrder(state, invalid), expected);
      assert.deepEqual(invalid[2], "fingers");
      assert.deepEqual(normalizeLayerOrder(state, expected), expected);
      const restored = validateState(
        JSON.parse(JSON.stringify({ ...state, layerOrder: invalid })),
      );
      assert.deepEqual(restored.layerOrder, expected);
      assert.deepEqual(
        visibleLayerIds({ ...state, layerOrder: invalid }),
        expected,
      );
      for (const options of [
        { interactive: true },
        { standalone: true, background: true },
      ]) {
        const svg = mascotSVG({ ...state, layerOrder: invalid }, options);
        assert.equal((svg.match(/id="art-fingers"/g) || []).length, 1);
        assert.ok(svg.lastIndexOf("<image ") < svg.indexOf('id="art-fingers"'));
        assert.ok(
          svg.indexOf('id="art-fingers"') < svg.indexOf('id="art-hat"'),
        );
        assert.ok(svg.indexOf('id="art-hat"') < svg.indexOf('id="art-prop"'));
      }
    },
  ],
  [
    "reordering fingers or images enforces their order and leaves other layer moves available",
    () => {
      const state = populated();
      const fingersBehind = reorderLayer(state, "fingers", "base");
      assert.deepEqual(fingersBehind, state.layerOrder);
      const imageInFront = reorderLayer(state, "image-a", "fingers");
      assert.deepEqual(imageInFront, state.layerOrder);
      const captionInBack = reorderLayer(state, "caption-legacy", "base");
      assert.equal(captionInBack[0], "caption-legacy");
      assert.ok(
        captionInBack.indexOf("image-a") < captionInBack.indexOf("fingers"),
      );
      const hatInFront = reorderLayer(state, "hat", "caption-legacy");
      assert.equal(hatInFront.at(-1), "hat");
      assert.ok(hatInFront.indexOf("image-a") < hatInFront.indexOf("fingers"));
    },
  ],
];
for (const [name, run] of process.env.TEST_REVERSE === "1"
  ? [...cases].reverse()
  : cases)
  test(name, run);
