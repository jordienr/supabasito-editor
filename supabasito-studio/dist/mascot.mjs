import { brownCowboyHat } from "./brown-cowboy-hat.mjs?v=31";

const identity = () => ({
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  lockAspectRatio: true,
});
export const layerAnchors = Object.freeze({
  hat: Object.freeze({ x: 315, y: 145 }),
  face: Object.freeze({ x: 295, y: 250 }),
  prop: Object.freeze({ x: 95, y: 270 }),
});
export const defaults = Object.freeze({
  body: "#3ecf8e",
  shoes: "#f4c75b",
  background: "#ffffff",
  hat: "none",
  face: "none",
  eyes: "bright",
  prop: "none",
  flagEmoji: "🏁",
  transforms: Object.freeze(
    Object.fromEntries(
      Object.keys(layerAnchors).map((key) => [key, Object.freeze(identity())]),
    ),
  ),
  layerOrder: Object.freeze(["base", "face", "prop", "fingers", "hat"]),
  images: Object.freeze([]),
  captions: Object.freeze([]),
});
export const captionLimit = 20;
export const captionDefaults = Object.freeze({
  text: "",
  x: 300,
  y: 470,
  size: 64,
  scale: 1,
  rotation: 0,
  color: "#ffffff",
});
export const choices = {
  eyes: ["bright", "lenny", "stoic", "none"],
  hat: ["none", "cap", "beanie", "cowboy", "brown-cowboy", "party"],
  face: ["none", "sunglasses", "round", "hearts"],
  prop: ["none", "beer", "flag", "coffee"],
};
const flagRegions =
  "AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CP CR CU CV CW CX CY CZ DE DG DJ DK DM DO DZ EA EC EE EG EH ER ES ET EU FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU IC ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TA TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM UN US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(
    " ",
  );
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const flagChoices = Object.freeze([
  ...[
    ["🏁", "Chequered flag"],
    ["🏳️‍🌈", "Rainbow flag"],
    ["🏳️‍⚧️", "Transgender flag"],
    ["🏴‍☠️", "Pirate flag"],
    ["🏳️", "White flag"],
    ["🏴", "Black flag"],
  ].map(([emoji, name]) => Object.freeze({ emoji, name })),
  ...flagRegions
    .map((region) => ({
      emoji: String.fromCodePoint(
        ...[...region].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
      ),
      name: regionNames.of(region),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(Object.freeze),
]);
const flagEmojis = new Set(flagChoices.map(({ emoji }) => emoji));
export const palettes = [
  "#3ecf8e",
  "#84b8ee",
  "#f3a3bd",
  "#b4a1df",
  "#f4c75b",
  "#ef8a61",
];
const bounded = (value, fallback, min, max) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
const color = (value, fallback) =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
const escapeXML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
function isRasterSource(source) {
  if (typeof source !== "string" || source.length > 15_000_000) return false;
  const prefix = /^data:image\/(png|jpeg|webp);base64,/.exec(source);
  if (!prefix) return false;
  const payload = source.slice(prefix[0].length);
  return (
    payload.length > 0 &&
    payload.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(payload)
  );
}
export function validateState(input) {
  const result = {
    ...defaults,
    transforms: Object.fromEntries(
      Object.keys(layerAnchors).map((key) => [key, identity()]),
    ),
    layerOrder: [...defaults.layerOrder],
    images: [],
    captions: [],
  };
  if (!input || typeof input !== "object") return result;
  for (const key of ["body", "shoes"])
    result[key] = color(input[key], result[key]);
  for (const [key, values] of Object.entries(choices))
    if (values.includes(input[key])) result[key] = input[key];
  if (input.eyes === "sad") result.eyes = "lenny";
  if (flagEmojis.has(input.flagEmoji)) result.flagEmoji = input.flagEmoji;
  for (const key of Object.keys(layerAnchors)) {
    const transform = input.transforms?.[key];
    if (!transform || typeof transform !== "object") continue;
    result.transforms[key] = {
      x: bounded(transform.x, 0, -500, 500),
      y: bounded(transform.y, 0, -500, 500),
      scale: bounded(transform.scale, 1, 0.25, 3),
      scaleX: bounded(transform.scaleX, 1, 0.1, 10),
      scaleY: bounded(transform.scaleY, 1, 0.1, 10),
      flipX: transform.flipX === true,
      flipY: transform.flipY === true,
      lockAspectRatio: transform.lockAspectRatio !== false,
      rotation: bounded(transform.rotation, 0, -180, 180),
    };
  }
  if (Array.isArray(input.images)) {
    const ids = new Set();
    for (const item of input.images) {
      if (result.images.length === 5) break;
      if (!item || typeof item !== "object" || !isRasterSource(item.src))
        continue;
      const id =
        typeof item.id === "string"
          ? item.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
          : "";
      if (!id || ids.has(id)) continue;
      ids.add(id);
      const image = {
        id,
        name:
          typeof item.name === "string"
            ? item.name.slice(0, 100)
            : "Uploaded image",
        src: item.src,
        x: bounded(item.x, 300, -500, 1100),
        y: bounded(item.y, 300, -500, 1100),
        width: bounded(item.width, 160, 1, 1200),
        height: bounded(item.height, 160, 1, 1200),
        rotation: bounded(item.rotation, 0, -180, 180),
        flipX: item.flipX === true,
        flipY: item.flipY === true,
        lockAspectRatio: item.lockAspectRatio !== false,
      };
      if (item.backgroundRemoved === true && isRasterSource(item.originalSrc)) {
        image.originalSrc = item.originalSrc;
        image.backgroundRemoved = true;
      } else if (isRasterSource(item.backgroundRemovedSrc)) {
        image.backgroundRemovedSrc = item.backgroundRemovedSrc;
        image.backgroundRemoved = false;
      }
      result.images.push(image);
    }
  }
  const captions = Array.isArray(input.captions)
    ? input.captions
    : input.caption &&
        typeof input.caption === "object" &&
        typeof input.caption.text === "string" &&
        input.caption.text.trim()
      ? [{ ...input.caption, id: "legacy" }]
      : [];
  const captionIds = new Set();
  for (const item of captions) {
    if (result.captions.length >= captionLimit) break;
    if (!item || typeof item !== "object") continue;
    const id =
      typeof item.id === "string"
        ? item.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
        : "";
    if (!id || captionIds.has(id)) continue;
    captionIds.add(id);
    result.captions.push({
      id,
      text: typeof item.text === "string" ? item.text.slice(0, 100) : "",
      x: bounded(item.x, 300, -500, 1100),
      y: bounded(item.y, 470, -500, 1100),
      size: bounded(item.size, 64, 16, 100),
      scale: bounded(item.scale, 1, 0.25, 3),
      rotation: bounded(item.rotation, 0, -180, 180),
      color: color(item.color, "#ffffff"),
    });
  }
  const order = Array.isArray(input.layerOrder)
    ? input.layerOrder.map((id) => (id === "caption" ? "caption-legacy" : id))
    : input.layerOrder;
  result.layerOrder = normalizeLayerOrder(result, order);
  return result;
}
export function normalizeLayerOrder(state, order) {
  const canonical = [
    "base",
    "face",
    "prop",
    "fingers",
    "hat",
    ...state.images.map((image) => `image-${image.id}`),
    ...state.captions.map((caption) => `caption-${caption.id}`),
  ];
  const allowed = new Set(canonical);
  const normalized = [
    ...new Set([...(Array.isArray(order) ? order : []), ...canonical]),
  ].filter((id) => allowed.has(id));
  const fingers = normalized.indexOf("fingers");
  const topImage = normalized.findLastIndex((id) => id.startsWith("image-"));
  if (topImage > fingers) {
    normalized.splice(fingers, 1);
    normalized.splice(topImage, 0, "fingers");
  }
  return normalized;
}
export function visibleLayerIds(state) {
  return normalizeLayerOrder(state, state.layerOrder).filter(
    (id) => !["hat", "face", "prop"].includes(id) || state[id] !== "none",
  );
}
export function reorderLayer(state, id, targetId) {
  const order = normalizeLayerOrder(state, state.layerOrder);
  const from = order.indexOf(id);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return order;
  order.splice(from, 1);
  order.splice(to, 0, id);
  return normalizeLayerOrder(state, order);
}
function captionLines(text) {
  const lines = [];
  for (const paragraph of text.trim().split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let newLine = true;
    for (const word of words) {
      const last = lines.length - 1;
      if (
        lines.length < 3 &&
        (newLine || lines[last].length + word.length > 18)
      )
        lines.push(word);
      else if (last < 0) lines.push(word);
      else lines[last] += ` ${word}`;
      newLine = false;
    }
  }
  return lines;
}
export function mascotSVG(
  input = defaults,
  { background = false, standalone = false, interactive = false } = {},
) {
  const s = validateState(input);
  const ink = "#18231e",
    cream = "#fff9df";
  const selectable = (id, label, content, transform = "") =>
    `<g${transform ? ` transform="${transform}"` : ""}${interactive ? ` data-layer="${escapeXML(id)}" tabindex="0" role="button" aria-label="${escapeXML(label)}"` : ""}>${content}</g>`;
  const layer = (id, content) => {
    const t = s.transforms[id],
      a = layerAnchors[id];
    return selectable(
      id,
      `${id === "face" ? "Glasses" : id === "prop" ? "Hand prop" : "Hat"} layer`,
      content,
      `translate(${t.x} ${t.y}) translate(${a.x} ${a.y}) rotate(${t.rotation}) scale(${t.scale * t.scaleX * (t.flipX ? -1 : 1)} ${t.scale * t.scaleY * (t.flipY ? -1 : 1)}) translate(${-a.x} ${-a.y})`,
    );
  };
  const hats = {
    none: "",
    cap: `<path d="M243 157 Q250 77 304 66 Q356 48 367 113 L369 164Z" fill="#5d76ce"/><path d="M259 135Q276 89 309 86" stroke="#fff" stroke-opacity=".18" stroke-width="7"/><path d="M238 159 Q304 140 373 153 Q400 162 399 175 Q336 190 247 179Z" fill="#8198ed"/><path d="M309 69Q326 103 324 145" fill="none" stroke-width="4"/>`,
    beanie: `<path d="M244 160L251 119Q265 52 311 59Q358 54 367 119L372 160Z" fill="#f08b62"/><path d="M269 115Q276 84 299 83" stroke="#fff" stroke-opacity=".22" stroke-width="7"/><rect x="239" y="143" width="139" height="35" rx="12" fill="#f7ac85"/><circle cx="313" cy="57" r="17" fill="#f7ac85"/><path d="M270 113L264 140M297 96L294 140M326 96L330 140M349 114L356 140" stroke-width="4"/>`,
    cowboy: `<path d="M244 146L266 69Q288 55 310 79Q335 55 355 70L373 147Z" fill="#c89153"/><path d="M256 128Q315 144 366 127L374 154L244 154Z" fill="#795a3f"/><path d="M211 139Q233 131 253 146Q312 171 371 144Q394 128 413 140Q405 184 313 185Q224 183 211 139Z" fill="#edba74"/><path d="M233 158Q274 177 314 174" stroke="#fff9df" stroke-opacity=".4" stroke-width="4"/>`,
    "brown-cowboy": `<image href="${brownCowboyHat}" x="200" y="4" width="240" height="240" preserveAspectRatio="xMidYMid meet"/>`,
    party: `<defs><clipPath id="party-cone"><path d="M242 166L316 23L393 166Z"/></clipPath></defs><path d="M242 166L316 23L393 166Z" fill="#c2a3e7"/><g clip-path="url(#party-cone)" stroke="none"><path d="M263 112L365 87L374 105L254 136Z M239 151L377 119L386 138L235 176Z" fill="${cream}"/><path d="M316 23L393 166H365Z" fill="${ink}" opacity=".1"/></g><path d="M242 166L316 23L393 166Z" fill="none"/><circle cx="316" cy="23" r="13" fill="#ef9ba9"/>`,
  };
  const glasses = {
    sunglasses: `<path d="M198 224Q238 210 277 224Q292 232 308 225Q349 211 389 225L384 243L375 245Q367 295 330 292Q306 292 299 249Q293 234 286 249Q279 291 246 290Q214 290 207 245L199 243Z" fill="${ink}"/><path d="M230 232L251 235L223 267Z M331 232L352 235L324 268Z" fill="${cream}" stroke="none"/>`,
    round: `<circle cx="249" cy="251" r="30" fill="none"/><circle cx="334" cy="251" r="30" fill="none"/><path d="M279 248Q292 237 304 248M207 242L218 246M364 246L388 241" fill="none"/>`,
    hearts: `<path d="M247 286Q197 250 216 231Q232 216 248 234Q265 215 281 232Q299 251 247 286Z M337 286Q287 250 306 231Q322 216 338 234Q355 215 371 232Q389 251 337 286Z" fill="#ed7093"/><path d="M282 246L303 246M205 239L216 243M372 243L390 238" fill="none"/>`,
    none: "",
  };
  const classicEyes = `<g id="bright-eyes"><ellipse cx="249" cy="251" rx="9" ry="18" fill="${ink}" stroke="none"/><ellipse cx="334" cy="251" rx="9" ry="18" fill="${ink}" stroke="none"/><path d="M232 221Q246 211 260 222M319 222Q335 210 348 221" fill="none" stroke-width="5"/></g>`;
  const classicMouth = `<path d="M246 314Q295 335 352 314Q340 376 298 375Q256 374 251 317" fill="${ink}"/><path d="M270 357Q280 341 294 351L297 358Q306 342 323 346Q334 349 325 361Q300 383 270 357Z" fill="#f39455" stroke-width="3"/><path d="M241 315L250 311M349 311Q358 311 359 320" stroke-width="7"/>`;
  const faces = {
    bright: `${classicEyes}${classicMouth}`,
    lenny: `<g id="lenny-eyes"><circle cx="249" cy="255" r="10" fill="${s.body}" stroke-width="5"/><circle cx="334" cy="255" r="10" fill="${s.body}" stroke-width="5"/><path d="M294 241V273C310 273 318 286 310 298C303 309 285 306 281 296" fill="none" stroke-width="6"/><path d="M230 244Q249 227 277 243M315 243Q334 227 353 244" fill="none" stroke-width="5"/></g><path id="lenny-mouth" d="M276 315Q299 331 326 315" fill="none" stroke-width="5"/>`,
    stoic: `<g fill="#000000" stroke="none" transform="translate(192 187) scale(.72)"><path id="stoic-brows" d="M62 63C79 55 111 58 129 65C138 72 123 76 115 74L111 83L104 80L97 88L89 81L73 86L82 76L93 73C81 71 71 69 62 72Z M164 66C185 61 216 60 235 67L239 74L224 75L229 83L219 87L209 79L201 89L190 85L191 76L176 80L167 77Z"/><path id="stoic-eyes" d="M77 92C88 88 105 89 116 94C101 94 90 96 77 96Z M101 103L115 101L110 105L101 106Z M177 92C190 88 211 88 223 94C208 93 193 96 180 95Z M197 103L210 103L207 106L198 106Z"/><path id="stoic-nose" d="M165 68L171 74L164 92L170 119L165 122L166 130L159 128C153 112 153 99 158 86Z M153 139C160 143 168 149 164 155C160 163 153 158 147 163C141 170 134 161 129 160C128 153 134 149 141 151C150 156 154 151 153 139Z"/><path id="stoic-mouth" d="M108 178C120 178 128 178 139 180L145 182C131 186 115 183 108 181Z M146 181C157 178 172 178 181 180C174 184 159 184 146 183Z"/><path id="stoic-chin" d="M128 201C137 201 151 202 165 203L160 206C147 206 135 205 127 204Z M151 227C154 229 153 236 149 242L149 232Z"/></g>`,
    none: "",
  };
  const fullFace =
    s.eyes === "none" ? "" : `<g id="${s.eyes}-full-face">${faces[s.eyes]}</g>`;
  const props = {
    none: "",
    beer: `<g transform="translate(54 209) rotate(-9)"><path d="M14 17H66V93Q40 105 17 92Z" fill="#f3bc43"/><path d="M66 30H80Q96 33 88 63Q85 74 68 70" fill="none" stroke-width="9"/><path d="M13 17Q-1 7 8 -4Q15 -12 27 -5Q38 -21 50 -8Q69 -15 75 0Q82 16 66 20Z" fill="${cream}"/><path d="M30 35V78M50 35V78" stroke="#ffe38a" stroke-width="5"/></g>`,
    flag: `<g transform="translate(76 139) rotate(-8)"><path d="M0 18V176" fill="none" stroke-width="9"/><text x="-7" y="78" font-size="104" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif" fill="${ink}" stroke="none">${escapeXML(s.flagEmoji)}</text></g>`,
    coffee: `<g transform="translate(53 230) rotate(-9)"><path d="M11 10H73L65 84H22Z" fill="${cream}"/><path d="M10 5H75L78 20H7Z" fill="#725d47"/><path d="M17 36H70L67 65H20Z" fill="#dba571"/><path d="M39 40L29 53H41L36 63L52 49H41L46 40Z" fill="${cream}" stroke="none"/></g>`,
  };
  const art = (id, content) =>
    `<g id="art-${id}" stroke="${ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${content}</g>`;
  const content = new Map([
    [
      "base",
      art(
        "base",
        `<ellipse cx="304" cy="537" rx="175" ry="10" fill="${ink}" opacity=".12" stroke="none"/><path d="M263 375Q224 418 184 476M352 403Q331 464 367 473" stroke-width="34"/><g transform="translate(58 399) scale(.47)" stroke-width="19"><path d="M230 171C246 123 218 76 182 64C137 48 96 68 76 103C47 150 84 208 151 248C173 281 197 305 232 305C270 309 304 281 299 234C307 216 303 201 288 195C297 201 300 213 302 223C321 200 313 175 291 156C276 143 254 138 240 143C247 149 257 159 258 170C250 166 244 159 237 157Z" fill="${s.shoes}"/><path d="M82 112C123 92 166 139 188 178C208 213 218 227 239 237C260 258 267 283 253 295C234 312 192 285 158 249C115 233 71 183 75 141C75 130 77 120 82 112Z" fill="${ink}" fill-opacity=".16" stroke-width="15"/><path d="M158 249C186 248 214 242 239 237" fill="none" stroke-width="15"/></g><path d="M375 466C397 464 416 481 410 504C403 529 379 541 345 541C321 542 300 536 304 518C307 503 317 493 331 493C345 492 358 500 366 504L341 493L343 483C355 491 374 493 381 480C385 473 381 468 375 466Z" fill="${s.shoes}"/><path d="M392 474C399 483 396 495 386 500" stroke-width="6"/><path d="M185 306Q111 382 91 314M433 305Q517 322 467 366" stroke-width="28"/><path d="M313 80Q331 58 343 81L344 210L491 210Q526 209 513 243L393 402L374 435Q355 454 345 431L344 393Q274 420 236 375Q212 347 211 317L171 317Q142 316 156 286Z" fill="${s.body}"/><path d="M344 211L491 211Q525 212 512 243L393 402L375 435Q357 453 345 431Z" fill="${ink}" opacity=".09" stroke="none"/>${fullFace}<path d="M93 318C69 326 49 312 46 291C43 278 49 269 57 263C46 253 48 240 58 233C66 229 75 229 84 232C79 222 79 209 85 201C91 191 106 191 112 199C120 209 107 222 108 235C109 248 119 257 120 273C123 293 112 311 93 318Z" fill="${cream}"/><path d="M459 354C476 345 490 358 494 376C498 393 487 410 472 416L451 402Z" fill="${cream}"/><path d="M461 361C444 346 416 345 394 356C375 365 363 380 360 395C357 407 364 417 375 420C372 433 384 443 397 438C396 451 410 455 422 448C431 443 438 437 444 432C465 431 478 414 478 394C478 380 472 368 461 361Z" fill="${cream}"/><path d="M375 420C378 402 392 386 413 379M397 438C399 422 411 407 427 401" stroke-width="6"/>`,
      ),
    ],
    ["face", art("face", layer("face", glasses[s.face]))],
    ["prop", art("prop", layer("prop", props[s.prop]))],
    [
      "fingers",
      art(
        "fingers",
        `<path d="M57 234C66 228 80 229 88 235C98 242 94 254 84 257L66 260C79 255 93 260 95 270C98 282 85 290 73 287C85 287 96 292 94 301C92 309 84 313 77 312C67 319 49 312 46 291C43 278 49 269 57 263C46 253 48 240 58 233Z" fill="${cream}" stroke-width="6"/>`,
      ),
    ],
    ["hat", art("hat", layer("hat", hats[s.hat]))],
    ...s.images.map((item) => [
      `image-${item.id}`,
      selectable(
        `image-${item.id}`,
        item.name,
        `<image href="${escapeXML(item.src)}" x="${item.x - item.width / 2}" y="${item.y - item.height / 2}" width="${item.width}" height="${item.height}" preserveAspectRatio="none"/>`,
        `translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.flipX ? -1 : 1} ${item.flipY ? -1 : 1}) translate(${-item.x} ${-item.y})`,
      ),
    ]),
    ...s.captions.map((caption) => {
      const lines = captionLines(caption.text);
      const baseline = caption.y - (lines.length - 1) * caption.size * 0.525;
      return [
        `caption-${caption.id}`,
        selectable(
          `caption-${caption.id}`,
          `Caption: ${caption.text}`,
          `<text x="${caption.x}" y="${baseline}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${caption.size}" font-weight="700" fill="${caption.color}" stroke="#18231e" stroke-width="${Math.max(1.5, caption.size * 0.045)}" stroke-linejoin="round" paint-order="stroke fill">${lines.map((line, i) => `<tspan x="${caption.x}" dy="${i ? caption.size * 1.05 : 0}" textLength="${Math.min(520, line.length * caption.size * 0.58)}" lengthAdjust="spacingAndGlyphs">${escapeXML(line)}</tspan>`).join("")}</text>`,
          `translate(${caption.x} ${caption.y}) rotate(${caption.rotation}) scale(${caption.scale}) translate(${-caption.x} ${-caption.y})`,
        ),
      ];
    }),
  ]);
  return `<svg ${standalone ? 'xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" ' : ""}viewBox="0 0 600 600" fill="none" role="${interactive ? "group" : "img"}" aria-label="Your customized Supabasito mascot"><title>Your customized Supabasito mascot</title>${background ? `<rect width="600" height="600" fill="#ffffff"/>` : ""}${visibleLayerIds(
    s,
  )
    .map((id) => content.get(id))
    .join("")}</svg>`;
}
