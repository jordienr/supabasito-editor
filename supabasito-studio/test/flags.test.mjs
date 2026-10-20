import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  flagChoices,
  validateState,
  mascotSVG,
  reorderLayer,
} from "../dist/mascot.mjs";
import { moveLayer } from "../dist/editor.mjs";

const propArtwork = (svg) =>
  svg.slice(svg.indexOf('id="art-prop"'), svg.indexOf('id="art-fingers"'));
const cases = [
  [
    "supported country and special flags survive saved state validation",
    () => {
      const supported = new Set(flagChoices.map(({ emoji }) => emoji));
      assert.equal(supported.size, flagChoices.length);
      for (const emoji of [
        "🇺🇸",
        "🇪🇸",
        "🇯🇵",
        "🇿🇦",
        "🏳️‍🌈",
        "🏳️‍⚧️",
        "🏴‍☠️",
        "🏁",
        "🏳️",
        "🏴",
      ]) {
        assert.ok(supported.has(emoji));
        const original = validateState({ prop: "flag", flagEmoji: emoji });
        assert.deepEqual(
          validateState(JSON.parse(JSON.stringify(original))),
          original,
        );
        assert.equal(original.flagEmoji, emoji);
      }
      assert.equal(
        validateState({ prop: "flag" }).flagEmoji,
        defaults.flagEmoji,
      );
      for (const flagEmoji of [
        null,
        4,
        "🚩",
        "US",
        "<script>alert(1)</script>",
        '🏁" onload="x',
      ]) {
        const state = validateState({ prop: "flag", flagEmoji });
        assert.equal(state.flagEmoji, defaults.flagEmoji);
        assert.ok(!mascotSVG(state).includes("<script>"));
        assert.ok(!mascotSVG(state).includes("onload="));
      }
    },
  ],
  [
    "changing a flag updates preview and export while keeping its pole and fingers",
    () => {
      for (const options of [
        {},
        { interactive: true },
        { standalone: true, background: true },
      ]) {
        const first = mascotSVG({ prop: "flag", flagEmoji: "🇪🇸" }, options);
        const second = mascotSVG({ prop: "flag", flagEmoji: "🏳️‍🌈" }, options);
        const firstProp = propArtwork(first);
        const secondProp = propArtwork(second);
        assert.match(firstProp, />🇪🇸<\/text>/);
        assert.match(secondProp, />🏳️‍🌈<\/text>/);
        assert.equal(firstProp.replace("🇪🇸", "🏳️‍🌈"), secondProp);
        assert.match(firstProp, /<path [^>]+fill="none"[^>]+\/><text /);
        assert.match(
          firstProp,
          /<text [^>]*font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"[^>]*stroke="none"/,
        );
        assert.ok(
          first.indexOf('id="art-prop"') < first.indexOf('id="art-fingers"'),
        );
        assert.ok(
          first.indexOf('id="art-base"') < first.indexOf('id="art-prop"'),
        );
      }
      const hidden = mascotSVG({ prop: "coffee", flagEmoji: "🇪🇸" });
      assert.ok(!hidden.includes("🇪🇸"));
    },
  ],
  [
    "flag changes preserve prop positioning and manual layer order",
    () => {
      const initial = validateState({ prop: "flag", flagEmoji: "🇺🇸" });
      const moved = validateState({
        ...initial,
        ...moveLayer(initial, "prop", {
          x: 45,
          y: -20,
          scale: 1.4,
          rotation: 25,
        }),
      });
      const changed = validateState({
        ...moved,
        flagEmoji: "🇯🇵",
        layerOrder: reorderLayer(moved, "prop", "base"),
      });
      const restored = validateState(JSON.parse(JSON.stringify(changed)));
      assert.deepEqual(restored.transforms.prop, moved.transforms.prop);
      assert.deepEqual(restored.layerOrder, changed.layerOrder);
      for (const options of [{ interactive: true }, { standalone: true }]) {
        const svg = mascotSVG(restored, options);
        assert.match(
          svg,
          /translate\(45 -20\) translate\(95 270\) rotate\(25\) scale\(1.4 1.4\) translate\(-95 -270\)/,
        );
        assert.ok(svg.includes("🇯🇵"));
        assert.ok(!svg.includes("🇺🇸"));
        assert.ok(svg.indexOf('id="art-prop"') < svg.indexOf('id="art-base"'));
        assert.equal(
          svg.includes('data-layer="prop"'),
          options.interactive === true,
        );
      }
    },
  ],
];
for (const [name, run] of process.env.TEST_REVERSE === "1"
  ? [...cases].reverse()
  : cases)
  test(name, run);
