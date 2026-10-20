import test from "node:test";
import assert from "node:assert/strict";
import {
  choices,
  defaults,
  mascotSVG,
  reorderLayer,
  validateState,
  visibleLayerIds,
} from "../dist/mascot.mjs";
import { moveLayer, removeLayer } from "../dist/editor.mjs";

const artwork = (svg, id) =>
  svg.split(`id="art-${id}"`)[1]?.split('<g id="art-')[0];
const eyes = (svg) => svg.match(/<g id="bright-eyes">(.*?)<\/g>/)?.[1];
const cases = [
  [
    "bright eyes belong to the mascot with every glasses choice and transformed overlay",
    () => {
      const original = mascotSVG(defaults);
      assert.equal(defaults.face, "none");
      assert.equal((eyes(original).match(/<ellipse /g) || []).length, 2);
      assert.ok(!visibleLayerIds(validateState(defaults)).includes("face"));
      for (const face of choices.face) {
        const svg = mascotSVG({
          face,
          transforms: { face: { x: 150, y: -100, scale: 2, rotation: 90 } },
        });
        assert.equal(eyes(svg), eyes(original));
        assert.equal(artwork(svg, "base"), artwork(original, "base"));
      }
    },
  ],
  [
    "regular glasses contain transparent lenses and borrow the mascot pupils",
    () => {
      const svg = mascotSVG({ face: "round" }, { interactive: true });
      const glasses = artwork(svg, "face");
      const lenses = [...glasses.matchAll(/<circle ([^>]+)\/>/g)];
      assert.equal(lenses.length, 2);
      assert.ok(lenses.every(([, attrs]) => attrs.includes('fill="none"')));
      assert.equal((svg.match(/<ellipse [^>]*ry="18"/g) || []).length, 2);
      assert.ok(!glasses.includes("<ellipse"));
      assert.ok(!glasses.includes('id="bright-eyes"'));
      assert.ok(glasses.includes('aria-label="Glasses layer"'));
    },
  ],
  [
    "saved glasses remain independent of hand props and deleting glasses reveals the original eyes",
    () => {
      for (const face of choices.face) {
        const saved = validateState({ face, prop: "coffee" });
        const restored = validateState(JSON.parse(JSON.stringify(saved)));
        assert.equal(restored.face, face);
        assert.equal(restored.prop, "coffee");
        const moved = validateState({
          ...restored,
          ...moveLayer(restored, "face", { x: 80, scale: 1.5 }),
        });
        assert.equal(moved.prop, "coffee");
        assert.deepEqual(moved.transforms.prop, restored.transforms.prop);
        const deleted = validateState({
          ...moved,
          ...removeLayer(moved, "face"),
        });
        assert.equal(deleted.face, "none");
        assert.equal(deleted.prop, "coffee");
        assert.ok(!visibleLayerIds(deleted).includes("face"));
        const svg = mascotSVG(deleted, { interactive: true });
        assert.equal(eyes(svg), eyes(mascotSVG(defaults)));
        assert.ok(svg.includes('data-layer="prop"'));
        assert.ok(!svg.includes('data-layer="face"'));
        assert.equal(
          validateState({ ...restored, ...removeLayer(restored, "prop") }).face,
          face,
        );
      }
    },
  ],
  [
    "glasses and hand props retain independent order and transforms in canvas and export",
    () => {
      const initial = validateState({ face: "hearts", prop: "beer" });
      const state = validateState({
        ...initial,
        ...moveLayer(initial, "face", { x: 75, rotation: 20 }),
        layerOrder: reorderLayer(initial, "face", "hat"),
      });
      for (const options of [
        { interactive: true },
        { standalone: true, background: true },
      ]) {
        const svg = mascotSVG(state, options);
        assert.equal(eyes(svg), eyes(mascotSVG(defaults)));
        assert.ok(svg.indexOf('id="art-base"') < svg.indexOf('id="art-prop"'));
        assert.ok(svg.indexOf('id="art-prop"') < svg.indexOf('id="art-face"'));
        assert.ok(artwork(svg, "face").includes("translate(75 0)"));
        assert.ok(artwork(svg, "face").includes("rotate(20)"));
        assert.ok(artwork(svg, "prop").includes("translate(0 0)"));
        assert.equal(svg.includes('data-layer="face"'), !!options.interactive);
      }
    },
  ],
];
for (const [name, run] of process.env.TEST_REVERSE === "1"
  ? [...cases].reverse()
  : cases)
  test(name, run);
