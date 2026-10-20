import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  choices,
  mascotSVG,
  validateState,
  visibleLayerIds,
} from "../dist/mascot.mjs";

test("brown cowboy hat is a distinct saved hat choice", () => {
  assert.ok(choices.hat.includes("cowboy"));
  assert.ok(choices.hat.includes("brown-cowboy"));
  const restored = validateState(
    JSON.parse(JSON.stringify(validateState({ hat: "brown-cowboy" }))),
  );
  assert.equal(restored.hat, "brown-cowboy");
  assert.ok(visibleLayerIds(restored).includes("hat"));
  assert.notEqual(mascotSVG(restored), mascotSVG({ hat: "cowboy" }));
});

test("standalone brown cowboy hat embeds the original transparent PNG", () => {
  const svg = mascotSVG({ hat: "brown-cowboy" }, { standalone: true });
  const encoded = svg.match(/<image href="data:image\/png;base64,([^"]+)"/);
  assert.ok(encoded);
  const png = Buffer.from(encoded[1], "base64");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 360);
  assert.equal(png.readUInt32BE(20), 360);
  assert.equal(png[25], 6);
  assert.equal(
    createHash("sha256").update(png).digest("hex"),
    "e8e5bdfd9c2bde7db4492d1a8a39765496621692230ac51494dbb7ab7bfc928e",
  );
  assert.ok(!svg.includes('href="http'));
});

test("brown cowboy hat uses the shared hat transforms and selection layer", () => {
  const svg = mascotSVG(
    {
      hat: "brown-cowboy",
      transforms: {
        hat: {
          x: 15,
          y: -12,
          scale: 1.5,
          scaleX: 2,
          scaleY: 0.5,
          rotation: 20,
          flipX: true,
          flipY: true,
          lockAspectRatio: false,
        },
      },
    },
    { interactive: true },
  );
  assert.match(
    svg,
    /transform="translate\(15 -12\) translate\(315 145\) rotate\(20\) scale\(-3 -0\.75\) translate\(-315 -145\)" data-layer="hat"[^>]*><image href="data:image\/png;base64,/,
  );
});
