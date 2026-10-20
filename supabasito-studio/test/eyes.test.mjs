import test from "node:test";
import assert from "node:assert/strict";
import {
  choices,
  defaults,
  mascotSVG,
  validateState,
  visibleLayerIds,
} from "../dist/mascot.mjs";
import { moveLayer, removeLayer } from "../dist/editor.mjs";

const faceArtwork = (svg) =>
  svg.match(
    /<g id="(?:bright|lenny|stoic)-full-face">(.*?)<\/g><path d="M93/s,
  )?.[1] || "";
const baseArtwork = (svg) =>
  svg.split('id="art-base"')[1]?.split('<g id="art-')[0];
const originalSmile =
  'd="M246 314Q295 335 352 314Q340 376 298 375Q256 374 251 317"';
const mouthCorners = 'd="M241 315L250 311M349 311Q358 311 359 320"';
const cases = [
  [
    "exactly four complete face choices survive browser persistence",
    () => {
      assert.deepEqual(choices.eyes, ["bright", "lenny", "stoic", "none"]);
      const artwork = [];
      for (const eyes of choices.eyes) {
        const restored = validateState(
          JSON.parse(JSON.stringify(validateState({ eyes }))),
        );
        assert.equal(restored.eyes, eyes);
        artwork.push(faceArtwork(mascotSVG(restored)));
      }
      assert.ok(artwork.slice(0, 3).every(Boolean));
      assert.equal(artwork[3], "");
      assert.equal(new Set(artwork).size, choices.eyes.length);
    },
  ],
  [
    "removed and invalid saved eye settings recover Classic and preserve eyewear",
    () => {
      assert.equal(defaults.eyes, "bright");
      for (const eyes of [
        "anime",
        "happy",
        "surprised",
        "sleepy",
        "determined",
        undefined,
        null,
        "unknown",
        "__proto__",
        "<script>",
        1,
      ]) {
        const restored = validateState({ eyes, face: "round" });
        assert.equal(restored.eyes, "bright");
        assert.equal(restored.face, "round");
        assert.equal(
          faceArtwork(mascotSVG(restored)),
          faceArtwork(mascotSVG(defaults)),
        );
      }
    },
  ],
  [
    "saved Sad migrates to Lenny with accessories and transforms preserved",
    () => {
      const migrated = validateState(
        JSON.parse(
          JSON.stringify({
            eyes: "sad",
            face: "round",
            prop: "coffee",
            transforms: { face: { x: 18, y: -12, scale: 1.4, rotation: 22 } },
          }),
        ),
      );
      assert.equal(migrated.eyes, "lenny");
      assert.equal(migrated.face, "round");
      assert.equal(migrated.prop, "coffee");
      assert.equal(migrated.transforms.face.x, 18);
      assert.equal(migrated.transforms.face.rotation, 22);
      assert.match(mascotSVG(migrated), /id="lenny-mouth"/);
    },
  ],
  [
    "Classic owns its original open smile and Lenny owns its nose and smirk",
    () => {
      for (const eyes of choices.eyes) {
        const svg = mascotSVG({ eyes });
        assert.equal(svg.includes(originalSmile), eyes === "bright");
        assert.equal(svg.includes(mouthCorners), eyes === "bright");
        assert.equal(svg.includes('id="lenny-mouth"'), eyes === "lenny");
      }
      const lenny = faceArtwork(mascotSVG({ eyes: "lenny" }));
      assert.equal((lenny.match(/<circle /g) || []).length, 2);
      assert.match(lenny, /M294 241V273C310 273 318 286 310 298/);
      assert.match(lenny, /id="lenny-mouth" d="M276 315Q299 331 326 315"/);
    },
  ],
  [
    "Stoic is a vector face with brows eyelids nose lips and chin",
    () => {
      const art = faceArtwork(mascotSVG({ eyes: "stoic" }));
      for (const feature of ["brows", "eyes", "nose", "mouth", "chin"])
        assert.match(art, new RegExp(`id="stoic-${feature}"`));
      assert.match(art, /fill="#000000"/);
      assert.ok(!art.includes("<image"));
      assert.ok(!art.includes("<text"));
      assert.ok(!art.includes(originalSmile));
      assert.ok(!art.includes('id="bright-eyes"'));
    },
  ],
  [
    "None removes every facial feature and preserves body uploads and text across exports",
    () => {
      const image = {
        id: "custom-face",
        name: "Custom face",
        src: "data:image/png;base64,AAAA",
      };
      for (const options of [
        {},
        { interactive: true },
        { standalone: true, background: true },
      ]) {
        const svg = mascotSVG(
          { eyes: "none", images: [image], caption: { text: "HELLO" } },
          options,
        );
        assert.ok(!svg.includes("-full-face"));
        assert.ok(!svg.includes("-eyes"));
        assert.ok(!svg.includes("-mouth"));
        assert.ok(!svg.includes(originalSmile));
        assert.ok(!svg.includes(mouthCorners));
        assert.ok(!svg.includes("M294 241V273"));
        assert.match(svg, /<image href="data:image\/png;base64,AAAA"/);
        assert.match(svg, />HELLO<\/tspan>/);
        assert.match(svg, /fill="#3ecf8e"/);
        assert.match(svg, /fill="#f4c75b"/);
      }
      const withoutFaces = (svg) =>
        svg.replace(
          /<g id="(?:bright|lenny|stoic)-full-face">.*?<\/g>(?=<path d="M93)/s,
          "",
        );
      for (const eyes of ["bright", "lenny", "stoic"])
        assert.equal(
          withoutFaces(mascotSVG({ eyes })),
          mascotSVG({ eyes: "none" }),
        );
    },
  ],
  [
    "full faces stay fixed when independent eyewear moves or is removed",
    () => {
      for (const eyes of choices.eyes) {
        const original = mascotSVG({ eyes });
        for (const face of choices.face) {
          const initial = validateState({ eyes, face, prop: "coffee" });
          const moved = validateState({
            ...initial,
            ...moveLayer(initial, "face", {
              x: 120,
              y: -75,
              scale: 1.7,
              rotation: 35,
            }),
          });
          const svg = mascotSVG(moved, { interactive: true });
          assert.equal(baseArtwork(svg), baseArtwork(original));
          assert.equal(faceArtwork(svg), faceArtwork(original));
          assert.ok(!visibleLayerIds(moved).includes("eyes"));
          assert.ok(!svg.includes('data-layer="eyes"'));
          const removed = validateState({
            ...moved,
            ...removeLayer(moved, "face"),
          });
          assert.equal(removed.eyes, eyes);
          assert.equal(removed.prop, "coffee");
          assert.equal(mascotSVG(removed), mascotSVG({ eyes, prop: "coffee" }));
          for (const options of [
            {},
            { interactive: true },
            { standalone: true, background: true },
          ])
            assert.equal(
              faceArtwork(mascotSVG(moved, options)),
              faceArtwork(original),
            );
        }
      }
    },
  ],
];
for (const [name, run] of process.env.TEST_REVERSE === "1"
  ? [...cases].reverse()
  : cases)
  test(name, run);
