import test from "node:test";
import assert from "node:assert/strict";
import {
  captionDefaults,
  captionLimit,
  validateState,
  visibleLayerIds,
  reorderLayer,
  mascotSVG,
} from "../dist/mascot.mjs";
import {
  addCaption,
  layerValue,
  moveLayer,
  removeLayer,
  shouldDeleteLayer,
} from "../dist/editor.mjs";
import {
  resizeLimits,
  resizeAt,
  transformChanges,
  layerToolbar,
} from "../dist/selection.mjs";

function populated() {
  let state = validateState();
  for (const [id, text] of [
    ["first", "First caption"],
    ["second", "Second caption"],
  ]) {
    state = validateState({ ...state, ...addCaption(state, { text }, id) });
  }
  return state;
}

test("migrates a saved singleton once with its position, appearance, transforms and painter order", () => {
  const caption = {
    text: "Saved caption",
    x: 123,
    y: 234,
    size: 48,
    color: "#abcdef",
    scale: 1.4,
    rotation: 25,
  };
  const state = validateState({
    caption,
    hat: "cap",
    layerOrder: ["caption", "base", "hat", "face", "prop", "fingers"],
  });
  assert.deepEqual(state.captions, [{ id: "legacy", ...caption }]);
  assert.equal(state.layerOrder[0], "caption-legacy");
  assert.deepEqual(visibleLayerIds(state), [
    "caption-legacy",
    "base",
    "hat",
    "fingers",
  ]);
  assert.equal("caption" in state, false);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
  const deleted = validateState({
    ...state,
    ...removeLayer(state, "caption-legacy"),
  });
  assert.deepEqual(deleted.captions, []);
  assert.deepEqual(validateState({ ...deleted, caption }).captions, []);
});

test("adds independent bounded captions, rejecting blank, duplicate and excess additions", () => {
  const state = populated();
  assert.deepEqual(
    state.captions.map(({ id, text }) => ({ id, text })),
    [
      { id: "first", text: "First caption" },
      { id: "second", text: "Second caption" },
    ],
  );
  assert.equal(addCaption(state, { text: " \n " }, "empty"), null);
  assert.equal(addCaption(state, { text: "Duplicate" }, "first"), null);
  const bounded = validateState({
    ...state,
    ...addCaption(
      state,
      {
        text: "x".repeat(200),
        size: Infinity,
        scale: 40,
        rotation: -999,
        color: "bad",
      },
      "bounded",
    ),
  });
  assert.equal(bounded.captions[2].text.length, 100);
  assert.equal(bounded.captions[2].size, 64);
  assert.equal(bounded.captions[2].scale, 3);
  assert.equal(bounded.captions[2].rotation, -180);
  assert.equal(bounded.captions[2].color, "#ffffff");
  const full = validateState({
    captions: Array.from({ length: captionLimit + 10 }, (_, index) => ({
      id: String(index),
      text: "Caption",
    })),
  });
  assert.equal(full.captions.length, captionLimit);
  assert.equal(addCaption(full, { text: "Extra" }, "extra"), null);
  assert.deepEqual(
    validateState({
      captions: [
        null,
        {},
        { id: "same", text: "one" },
        { id: "same", text: "two" },
        { id: "<>", text: "bad" },
      ],
    }).captions.map(({ text }) => text),
    ["one"],
  );
});

test("editing, moving, rotating, resizing and deleting affect only the selected caption", () => {
  const original = populated();
  const second = original.captions[1];
  let state = validateState({
    ...original,
    ...moveLayer(original, "caption-first", {
      text: "Edited",
      x: 100,
      y: 200,
      rotation: 45,
      color: "#ff00aa",
      size: 35,
    }),
  });
  const origin = {
    ...layerValue(state, "caption-first"),
    anchor: { x: 100, y: 200 },
  };
  const resize = resizeAt(
    origin,
    { x: 150, y: 250 },
    { x: 50, y: 150 },
    { x: 150, y: 250 },
    { x: 200, y: 300 },
    ...resizeLimits("caption-first", origin),
  );
  state = validateState({
    ...state,
    ...moveLayer(
      state,
      "caption-first",
      transformChanges("caption-first", origin, resize),
    ),
  });
  assert.deepEqual(state.captions[1], second);
  assert.deepEqual(state.captions[0], {
    ...captionDefaults,
    id: "first",
    text: "Edited",
    x: 125,
    y: 225,
    scale: 1.5,
    rotation: 45,
    color: "#ff00aa",
    size: 35,
  });
  state = validateState({ ...state, ...removeLayer(state, "caption-first") });
  assert.deepEqual(state.captions, [second]);
  assert.equal(layerValue(state, "caption-first"), undefined);
  assert.ok(!state.layerOrder.includes("caption-first"));
  assert.deepEqual(
    validateState({ ...state, ...removeLayer(state, "caption-missing") }),
    state,
  );
  assert.deepEqual(
    validateState({
      ...state,
      ...moveLayer(state, "caption-missing", { text: "Wrong" }),
    }),
    state,
  );
  assert.deepEqual(original.captions[0], {
    ...captionDefaults,
    id: "first",
    text: "First caption",
  });
});

test("reorders, persists and exports each caption in its own layer in preview and both export sources", () => {
  const initial = populated();
  const moved = validateState({
    ...initial,
    ...moveLayer(initial, "caption-second", {
      x: 120,
      y: 180,
      rotation: 20,
      scale: 1.3,
    }),
    layerOrder: reorderLayer(initial, "caption-second", "base"),
  });
  const restored = validateState(JSON.parse(JSON.stringify(moved)));
  assert.deepEqual(restored, moved);
  assert.equal(visibleLayerIds(restored)[0], "caption-second");
  assert.equal(visibleLayerIds(restored).at(-1), "caption-first");
  for (const options of [
    { interactive: true },
    { standalone: true },
    { standalone: true, background: true },
  ]) {
    const svg = mascotSVG(restored, options);
    assert.ok(
      svg.indexOf("Second caption</tspan>") < svg.indexOf('id="art-base"'),
    );
    assert.ok(
      svg.indexOf('id="art-base"') < svg.indexOf("First caption</tspan>"),
    );
    assert.ok(
      svg.includes(
        "translate(120 180) rotate(20) scale(1.3) translate(-120 -180)",
      ),
    );
    assert.equal((svg.match(/<text /g) || []).length, 2);
    assert.ok(svg.includes('font-family="Arial, sans-serif"'));
    assert.ok(svg.includes('font-weight="700"'));
    if (options.interactive) {
      assert.ok(svg.includes('data-layer="caption-first"'));
      assert.ok(svg.includes('data-layer="caption-second"'));
    } else assert.ok(!svg.includes("data-layer="));
  }
});

test("blank edits keep a selectable layer and caption deletion protects editable fields", () => {
  const state = populated();
  const edited = validateState({
    ...state,
    ...moveLayer(state, "caption-first", { text: "" }),
  });
  assert.ok(visibleLayerIds(edited).includes("caption-first"));
  for (const key of ["Delete", "Backspace"]) {
    assert.equal(
      shouldDeleteLayer(
        { key, target: { closest: () => ({}) } },
        "caption-first",
      ),
      false,
    );
    assert.equal(
      shouldDeleteLayer(
        { key, target: { closest: () => null } },
        "caption-first",
      ),
      true,
    );
  }
  const toolbar = layerToolbar(
    [
      { x: 100, y: 100 },
      { x: 150, y: 100 },
      { x: 150, y: 150 },
      { x: 100, y: 150 },
    ],
    1,
    state.captions[0],
    "caption-first",
  );
  assert.ok(toolbar.includes('aria-label="Delete caption"'));
  assert.ok(!toolbar.includes('data-layer-action="flipX"'));
});

test("ignores the blank singleton stored by older default creations", () => {
  for (const caption of [{}, { text: "" }, { text: " \n " }, { text: null }]) {
    const state = validateState({
      caption,
      layerOrder: ["base", "caption", "fingers"],
    });
    assert.deepEqual(state.captions, []);
    assert.ok(!state.layerOrder.includes("caption-legacy"));
    assert.deepEqual(visibleLayerIds(state), ["base", "fingers"]);
  }
});
