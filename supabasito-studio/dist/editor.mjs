import { captionDefaults, captionLimit } from "./mascot.mjs?v=35";
import {
  removeWhiteBackground,
  toggleImageBackground,
} from "./image-background.mjs?v=34";

export const uploadLimit = 5;
export const uploadBytes = 5 * 1024 * 1024;
export function pastedImages(event) {
  const clipboard = event.clipboardData;
  if (event.defaultPrevented || !clipboard) return [];
  const editable = event.target?.closest?.(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  );
  if (
    editable &&
    (clipboard.getData("text/plain") || clipboard.getData("text/html"))
  )
    return [];
  const items = Array.from(clipboard.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file) => file?.type.startsWith("image/"));
  return items.length
    ? items
    : Array.from(clipboard.files || []).filter((file) =>
        file.type.startsWith("image/"),
      );
}
export function uploadError(file, count) {
  if (count >= uploadLimit)
    return "You can add up to 5 images. Remove one to add another.";
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return "Choose a PNG, JPEG, or WebP image.";
  if (file.size > uploadBytes)
    return "That image is over 5 MB. Choose a smaller file.";
  return "";
}
export function clientPoint(svg, x, y) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(x, y).matrixTransform(matrix.inverse());
}
export function moveLayer(state, id, changes) {
  if (["hat", "face", "prop"].includes(id))
    return {
      transforms: {
        ...state.transforms,
        [id]: { ...state.transforms[id], ...changes },
      },
    };
  if (id.startsWith("caption-"))
    return {
      captions: state.captions.map((caption) =>
        `caption-${caption.id}` === id ? { ...caption, ...changes } : caption,
      ),
    };
  return {
    images: state.images.map((image) =>
      `image-${image.id}` === id ? { ...image, ...changes } : image,
    ),
  };
}
export function layerValue(state, id) {
  if (["hat", "face", "prop"].includes(id)) return state.transforms[id];
  if (id.startsWith("caption-"))
    return state.captions.find((caption) => `caption-${caption.id}` === id);
  return state.images.find((image) => `image-${image.id}` === id);
}
export function dragPosition(origin, start, point) {
  return { x: origin.x + point.x - start.x, y: origin.y + point.y - start.y };
}
export async function removeImageBackground(image) {
  const toggled = toggleImageBackground(image);
  if (toggled) return toggled;
  const canvas = await imageCanvas(image.src);
  const cleaned = cleanCanvasBackground(canvas);
  return cleaned.backgroundRemoved
    ? { ...image, ...cleaned, originalSrc: image.src }
    : image;
}

async function imageCanvas(src) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () =>
      reject(
        new Error(
          "That image could not be opened. Try a different PNG, JPEG, or WebP.",
        ),
      );
    image.src = src;
  });
  const ratio = Math.min(
    1,
    1600 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cleanCanvasBackground(canvas) {
  const context = canvas.getContext("2d");
  const originalSrc = canvas.toDataURL("image/png");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = removeWhiteBackground(
    pixels.data,
    canvas.width,
    canvas.height,
  );
  if (!result.changed) return { src: originalSrc };
  pixels.data.set(result.data);
  context.putImageData(pixels, 0, 0);
  return {
    src: canvas.toDataURL("image/png"),
    originalSrc,
    backgroundRemoved: true,
  };
}

export async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const canvas = await imageCanvas(url);
    const originalSrc = canvas.toDataURL("image/png");
    let prepared = { src: originalSrc };
    try {
      prepared = cleanCanvasBackground(canvas);
    } catch {
      prepared.backgroundError =
        "The white background could not be removed. Your image was added unchanged.";
    }
    const size = 180 / Math.max(canvas.width, canvas.height);
    return {
      id: crypto.randomUUID(),
      name: file.name.slice(0, 100),
      ...prepared,
      x: 300,
      y: 280,
      width: Math.max(1, Math.round(canvas.width * size)),
      height: Math.max(1, Math.round(canvas.height * size)),
      rotation: 0,
      flipX: false,
      flipY: false,
      lockAspectRatio: true,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function removeLayer(state, id) {
  if (["hat", "face", "prop"].includes(id)) return { [id]: "none" };
  if (id.startsWith("caption-"))
    return {
      captions: state.captions.filter(
        (caption) => `caption-${caption.id}` !== id,
      ),
    };
  return { images: state.images.filter((image) => `image-${image.id}` !== id) };
}
export function shouldDeleteLayer(event, selectedLayer) {
  if (
    !selectedLayer ||
    ["base", "fingers"].includes(selectedLayer) ||
    !["Backspace", "Delete"].includes(event.key)
  )
    return false;
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.isComposing ||
    event.defaultPrevented
  )
    return false;
  const target = event.target;
  if (
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    )
  )
    return false;
  return (
    !target.closest('button, [role="button"]') ||
    Boolean(
      target.closest("[data-layer], [data-transform], [data-layer-action]"),
    )
  );
}

export function toggleLayerAction(state, id, action, center, accessoryAnchor) {
  if (
    !id ||
    !(id.startsWith("image-") || ["hat", "face", "prop"].includes(id)) ||
    !["flipX", "flipY", "lockAspectRatio"].includes(action)
  )
    return null;
  const value = layerValue(state, id);
  if (!value) return null;
  const changes = { [action]: !value[action] };
  if (accessoryAnchor && center && ["flipX", "flipY"].includes(action)) {
    const radians =
      ((value.rotation + (action === "flipY" ? 90 : 0)) * Math.PI) / 180;
    const axis = { x: Math.cos(radians), y: Math.sin(radians) };
    const offset = {
      x: center.x - value.x - accessoryAnchor.x,
      y: center.y - value.y - accessoryAnchor.y,
    };
    const distance = 2 * (offset.x * axis.x + offset.y * axis.y);
    changes.x = value.x + distance * axis.x;
    changes.y = value.y + distance * axis.y;
  }
  return moveLayer(state, id, changes);
}

export function addCaption(state, draft, id = crypto.randomUUID()) {
  if (state.captions.length >= captionLimit || !draft.text?.trim()) return null;
  if (state.captions.some((caption) => caption.id === id)) return null;
  return {
    captions: [
      ...state.captions,
      {
        ...captionDefaults,
        ...draft,
        id,
        text: draft.text.trim().slice(0, 100),
      },
    ],
  };
}
