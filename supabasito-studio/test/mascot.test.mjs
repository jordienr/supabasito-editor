import test from "node:test";
import assert from "node:assert/strict";
import { defaults, validateState, mascotSVG } from "../dist/mascot.mjs";

const cases = [
  [
    "recovers from malformed or old saved settings",
    () => {
      for (const value of [
        null,
        4,
        "invalid",
        [],
        {
          body: "red",
          shoes: "#fff",
          hat: "missing",
          face: "<script>",
          prop: false,
        },
      ]) {
        assert.deepEqual(validateState(value), defaults);
      }
      assert.deepEqual(
        validateState({
          ...defaults,
          body: "#abcdef",
          hat: "party",
          prop: "beer",
          unknown: 1,
        }),
        { ...defaults, body: "#abcdef", hat: "party", prop: "beer" },
      );
    },
  ],
  [
    "does not allow stored SVG markup injection",
    () => {
      const result = mascotSVG(
        {
          body: '\"><script>alert(1)</script>',
          background: '\" onload=\"alert(1)',
          hat: "__proto__",
          face: "constructor",
        },
        { background: true, standalone: true },
      );
      assert.ok(!result.includes("<script>"));
      assert.ok(!result.includes("onload="));
      assert.ok(result.includes('fill="#3ecf8e"'));
      assert.ok(result.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    },
  ],
  [
    "uses a white export background regardless of saved background values",
    () => {
      assert.ok(
        mascotSVG(defaults, { background: true }).includes(
          '<rect width="600" height="600" fill="#ffffff"/>',
        ),
      );
      assert.equal(
        validateState({ background: "#f4f2e5" }).background,
        "#ffffff",
      );
      assert.equal(
        validateState({ background: "transparent" }).background,
        "#ffffff",
      );
      assert.ok(
        mascotSVG(
          { ...defaults, background: "#f4f2e5" },
          { background: true },
        ).includes('<rect width="600" height="600" fill="#ffffff"/>'),
      );
    },
  ],
  [
    "exports the selected layers and colors without shared state between renders",
    () => {
      const custom = mascotSVG({
        ...defaults,
        body: "#123456",
        shoes: "#654321",
        hat: "party",
        face: "hearts",
        prop: "beer",
      });
      assert.ok(custom.includes('fill="#123456"'));
      assert.ok(custom.includes('fill="#654321"'));
      assert.ok(custom.includes("M242 166L316 23L393 166Z"));
      assert.ok(custom.includes("M247 286Q197 250"));
      assert.ok(custom.includes("translate(54 209)"));
      assert.ok(!mascotSVG(defaults).includes("translate(54 209)"));
      assert.deepEqual(defaults, validateState(null));
    },
  ],
  [
    "keeps legacy states isolated from nested defaults",
    () => {
      const first = validateState({ hat: "cap" });
      const second = validateState({ hat: "cap" });
      first.transforms.hat.x = 100;
      first.captions.push({ id: "a", text: "Changed" });
      first.images.push({ id: "x" });
      assert.equal(second.transforms.hat.x, 0);
      assert.equal(second.captions.length, 0);
      assert.deepEqual(second.images, []);
      assert.deepEqual(defaults.transforms.hat, {
        x: 0,
        y: 0,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false,
        lockAspectRatio: true,
        rotation: 0,
      });
    },
  ],
  [
    "bounds transforms and exports identical positions without editor attributes",
    () => {
      const state = {
        hat: "cap",
        transforms: {
          hat: { x: 32, y: -18, scale: 1.5, rotation: 25 },
          face: { x: Infinity, y: -900, scale: 0, rotation: 900 },
        },
      };
      const saved = validateState(state);
      assert.deepEqual(saved.transforms.face, {
        x: 0,
        y: -500,
        scale: 0.25,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false,
        lockAspectRatio: true,
        rotation: 180,
      });
      const exported = mascotSVG(state, { standalone: true });
      const editor = mascotSVG(state, { interactive: true });
      const transform =
        "translate(32 -18) translate(315 145) rotate(25) scale(1.5 1.5) translate(-315 -145)";
      assert.ok(exported.includes(transform));
      assert.ok(editor.includes(transform));
      assert.ok(editor.includes('data-layer="hat" tabindex="0" role="button"'));
      assert.ok(editor.includes('role="group"'));
      assert.ok(!/data-layer|tabindex|role="button"/.test(exported));
      assert.ok(exported.includes('width="1024" height="1024"'));
    },
  ],
  [
    "allows only bounded embedded raster images and escapes their names",
    () => {
      const image = {
        id: "photo",
        name: 'Photo <&"',
        src: "data:image/png;base64,aGVsbG8=",
        x: 200,
        y: 250,
        width: 100,
        height: 80,
        rotation: 30,
      };
      const state = validateState({
        images: [
          { ...image, src: "https://example.com/p.png" },
          { ...image, src: "data:image/svg+xml;base64,aGVsbG8=" },
          { ...image, src: 'data:image/png;base64,aGVsbG8=" onload="x' },
          image,
          { ...image, id: "photo" },
        ],
      });
      assert.equal(state.images.length, 1);
      const rendered = mascotSVG(state, { interactive: true });
      assert.ok(
        rendered.includes(
          'href="data:image/png;base64,aGVsbG8=" x="150" y="210" width="100" height="80"',
        ),
      );
      assert.ok(
        rendered.includes(
          "translate(200 250) rotate(30) scale(1 1) translate(-200 -250)",
        ),
      );
      assert.ok(rendered.includes('aria-label="Photo &lt;&amp;&quot;"'));
      assert.equal(
        validateState({
          images: Array.from({ length: 8 }, (_, index) => ({
            ...image,
            id: String(index),
          })),
        }).images.length,
        5,
      );
      assert.equal(
        validateState({ images: [{ ...image, src: "data:image/png;base64," }] })
          .images.length,
        0,
      );
      assert.equal(
        validateState({
          images: [{ ...image, width: NaN, height: Infinity, rotation: -999 }],
        }).images[0].rotation,
        -180,
      );
    },
  ],
  [
    "wraps and escapes a bounded meme caption in both preview and export",
    () => {
      const state = {
        caption: {
          text: '<script>&" HELLO WORLD FROM SUPABASITO THIS IS A LONG CAPTION FOR THE PARTY',
          size: 100,
          color: "#ff00aa",
        },
      };
      const svg = mascotSVG(state);
      assert.ok(svg.includes("&lt;script&gt;&amp;&quot;"));
      assert.ok(!svg.includes("<script>"));
      assert.ok(svg.includes('font-family="Arial, sans-serif"'));
      assert.ok(svg.includes('paint-order="stroke fill"'));
      assert.ok(svg.includes('textLength="520"'));
      assert.equal((svg.match(/<tspan /g) || []).length, 3);
      assert.equal(
        validateState({ caption: { text: "x".repeat(200) } }).captions[0].text
          .length,
        100,
      );
      assert.ok(!mascotSVG(defaults).includes("<text "));
    },
  ],
  [
    "clips party stripes and places held props behind the glove fingers",
    () => {
      const svg = mascotSVG({ hat: "party", prop: "flag" });
      assert.ok(svg.includes('clip-path="url(#party-cone)"'));
      assert.ok(svg.indexOf("translate(76 139)") < svg.indexOf("M57 234C66"));
    },
  ],
  [
    "accepts large camera uploads without regexp stack overflow",
    () => {
      for (const length of [5_000_000, 14_000_000]) {
        const src = `data:image/png;base64,${"A".repeat(length)}`;
        assert.equal(
          validateState({ images: [{ id: "large", src }] }).images[0].src,
          src,
        );
      }
    },
  ],
  [
    "honors manual caption lines inside the default canvas",
    () => {
      const svg = mascotSVG({ caption: { text: "ONE\nTWO\nTHREE" } });
      assert.ok(svg.includes('y="402.8"'));
      assert.equal((svg.match(/<tspan /g) || []).length, 3);
      assert.ok(svg.includes(">ONE</tspan>"));
      assert.ok(svg.includes(">TWO</tspan>"));
      assert.ok(svg.includes(">THREE</tspan>"));
    },
  ],
  [
    "moves accessories while keeping glove and mouth attached",
    () => {
      const svg = mascotSVG(
        { prop: "flag", face: "sunglasses", transforms: { prop: { x: 100 } } },
        { interactive: true },
      );
      const prop = svg.slice(
        svg.indexOf('data-layer="prop"'),
        svg.indexOf("</g>", svg.indexOf('data-layer="prop"')),
      );
      assert.ok(!prop.includes("M93 318"));
      assert.ok(
        !mascotSVG({ face: "none" }, { interactive: true }).includes(
          'data-layer="face"',
        ),
      );
      const face = svg.slice(
        svg.indexOf('data-layer="face"'),
        svg.indexOf("</g>", svg.indexOf('data-layer="face"')),
      );
      assert.ok(!face.includes("M246 314"));
    },
  ],
];
const ordered = process.env.TEST_REVERSE === "1" ? [...cases].reverse() : cases;
for (const [name, run] of ordered) test(name, run);

test("image flip and ratio settings survive validation and export stretches the resized rectangle", () => {
  const image = {
    id: "a",
    src: "data:image/png;base64,aGVsbG8=",
    x: 200,
    y: 250,
    width: 200,
    height: 50,
    rotation: 30,
  };
  const legacy = validateState({ images: [image] }).images[0];
  assert.deepEqual(
    [legacy.flipX, legacy.flipY, legacy.lockAspectRatio],
    [false, false, true],
  );
  const invalid = validateState({
    images: [{ ...image, flipX: "true", flipY: 1, lockAspectRatio: 0 }],
  }).images[0];
  assert.deepEqual(
    [invalid.flipX, invalid.flipY, invalid.lockAspectRatio],
    [false, false, true],
  );
  for (const flipX of [false, true]) {
    for (const flipY of [false, true]) {
      const state = validateState({
        images: [{ ...image, flipX, flipY, lockAspectRatio: false }],
      });
      assert.deepEqual(
        [
          state.images[0].flipX,
          state.images[0].flipY,
          state.images[0].lockAspectRatio,
        ],
        [flipX, flipY, false],
      );
      const exported = mascotSVG(state, { standalone: true });
      assert.ok(
        exported.includes(
          `translate(200 250) rotate(30) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1}) translate(-200 -250)`,
        ),
      );
      assert.ok(
        exported.includes('width="200" height="50" preserveAspectRatio="none"'),
      );
      assert.ok(
        !/data-layer-action|foreignObject|data-selection/.test(exported),
      );
    }
  }
});
