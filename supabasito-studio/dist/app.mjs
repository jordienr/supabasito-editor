import {
  defaults,
  captionDefaults,
  captionLimit,
  layerAnchors,
  choices,
  flagChoices,
  palettes,
  validateState,
  mascotSVG,
  visibleLayerIds,
  reorderLayer,
} from "./mascot.mjs?v=35";

import {
  addCaption,
  clientPoint,
  dragPosition,
  layerValue,
  moveLayer,
  prepareImage,
  removeImageBackground,
  pastedImages,
  uploadError,
  removeLayer,
  shouldDeleteLayer,
  toggleLayerAction,
} from "./editor.mjs?v=35";

import {
  drawSelection,
  selectionGeometry,
  rotationAt,
  resizeAt,
  resizeLimits,
  transformChanges,
} from "./selection.mjs?v=35";

const storageKey = "supabasito-studio-v1";
const colorNames = [
  "Supabase green",
  "Sky blue",
  "Pink",
  "Lavender",
  "Yellow",
  "Peach",
];
const shoeColors = [
  "#f4c75b",
  "#fff9df",
  "#ef8a61",
  "#84b8ee",
  "#b4a1df",
  "#26392e",
];
const labels = {
  bright: "Classic",
  lenny: "Lenny",
  stoic: "Stoic",
  none: "Original",
  cap: "Cap",
  beanie: "Beanie",
  cowboy: "Cowboy hat",
  "brown-cowboy": "Brown cowboy hat",
  party: "Party hat",
  sunglasses: "Sunglasses",
  round: "Round glasses",
  hearts: "Heart glasses",
  beer: "Beer",
  flag: "Flag",
  coffee: "Coffee",
};
let state = validateState(defaults);
let selectedLayer = "";
let captionDraft = { ...captionDefaults };
let uploadGeneration = 0;
let uploading = false;
let drag;
let saveTimer;
let saveStatus = "Changes stay in this browser.";
try {
  state = validateState(JSON.parse(localStorage.getItem(storageKey)));
} catch {}
let toastTimer;
const $ = (id) => document.getElementById(id);

function notify(message) {
  $("status").textContent = message;
  $("status").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("status").classList.remove("visible"), 3000);
}

function save() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    saveStatus = "Saved in this browser. Your images stay local.";
  } catch {
    saveStatus =
      "Changes are not saved: browser storage is full or unavailable. Download to keep your creation.";
  }
  $("save-state").textContent = saveStatus;
}
function update(changes, persist = true) {
  state = validateState({ ...state, ...changes });
  render();
  if (persist) {
    $("save-state").textContent = "Saving in this browser…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 350);
  }
}
function render() {
  $("mascot").innerHTML = mascotSVG(state, { interactive: true });
  renderEditor();
  $("flag-picker").hidden = state.prop !== "flag";
  $("flag-emoji").value = state.flagEmoji;
  const flagThumbnail = document.querySelector(
    '[data-choice-key="prop"][data-choice="flag"] .option-art',
  );
  if (flagThumbnail)
    flagThumbnail.innerHTML = mascotSVG({
      ...defaults,
      prop: "flag",
      flagEmoji: state.flagEmoji,
    });
  $("body-color").value = state.body;
  $("body-hex").textContent = state.body.toUpperCase();
  $("body-value").textContent =
    colorNames[palettes.indexOf(state.body)] || "Custom color";
  document
    .querySelectorAll("[data-color-key]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        state[button.dataset.colorKey] === button.dataset.color,
      ),
    );
  document
    .querySelectorAll("[data-choice-key]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        state[button.dataset.choiceKey] === button.dataset.choice,
      ),
    );
}

function addSwatches(id, key, colors, names) {
  colors.forEach((color, index) => {
    const button = document.createElement("button");
    button.className = `swatch${color === "transparent" ? " transparent" : ""}`;
    button.style.setProperty("--swatch", color);
    button.dataset.colorKey = key;
    button.dataset.color = color;
    button.setAttribute(
      "aria-label",
      `${key === "body" ? "Body" : "Shoes"}: ${names?.[index]?.toLowerCase() || color}`,
    );
    button.title = names?.[index] || color;
    button.addEventListener("click", () => update({ [key]: color }));
    $(id).append(button);
  });
}

function addChoices(key, id) {
  choices[key].forEach((value) => {
    const button = document.createElement("button");
    button.className = "option-tile";
    button.dataset.choiceKey = key;
    button.dataset.choice = value;
    const label =
      value === "none"
        ? key === "eyes"
          ? "None"
          : key === "face"
            ? "No glasses"
            : key === "prop"
              ? "Empty hand"
              : "No hat"
        : labels[value];
    button.setAttribute(
      "aria-label",
      `${key === "eyes" ? "Face" : key === "face" ? "Glasses" : key === "prop" ? "Hand prop" : "Hat"}: ${label}`,
    );
    button.innerHTML = `<div class="option-art" aria-hidden="true">${mascotSVG({ ...defaults, [key]: value })}</div>${label}`;
    button.addEventListener("click", () => update({ [key]: value }));
    $(id).append(button);
  });
}

function activateTab(button) {
  document.querySelectorAll("[role=tab]").forEach((tab) => {
    const selected = tab === button;
    tab.setAttribute("aria-selected", selected);
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !selected;
  });
}

document.querySelectorAll("[role=tab]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button));
  button.addEventListener("keydown", (event) => {
    const tabs = [...document.querySelectorAll("[role=tab]")];
    const current = tabs.indexOf(button);
    let index;
    if (event.key === "ArrowRight") index = (current + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      index = (current - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") index = 0;
    if (event.key === "End") index = tabs.length - 1;
    if (index !== undefined) {
      event.preventDefault();
      activateTab(tabs[index]);
      tabs[index].focus();
    }
  });
});

addSwatches("body-swatches", "body", palettes, colorNames);
addSwatches("shoe-swatches", "shoes", shoeColors, [
  "Golden yellow",
  "Cream",
  "Peach",
  "Sky blue",
  "Lavender",
  "Forest green",
]);
addChoices("eyes", "face-options");
addChoices("hat", "hat-options");
addChoices("face", "glasses-options");
addChoices("prop", "prop-options");
$("flag-emoji").replaceChildren(
  ...flagChoices.map(({ emoji, name }) => {
    const option = document.createElement("option");
    option.value = emoji;
    option.textContent = `${emoji} ${name}`;
    return option;
  }),
);
$("flag-emoji").addEventListener("change", (event) =>
  update({ flagEmoji: event.target.value }),
);
$("body-color").addEventListener("input", (event) =>
  update({ body: event.target.value }),
);
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("download").addEventListener("click", async () => {
  const button = $("download");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  const svg = mascotSVG(state, { background: true, standalone: true });
  const svgUrl = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    canvas.getContext("2d").drawImage(image, 0, 0, 1024, 1024);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("PNG export failed");
    downloadBlob(blob, "my-supabasito.png");
    notify("PNG downloaded.");
  } catch {
    notify("Couldn’t create that PNG. Try downloading the SVG instead.");
  } finally {
    URL.revokeObjectURL(svgUrl);
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
});

function closeDownloadMenu() {
  $("download-menu").hidden = true;
  $("download-more").setAttribute("aria-expanded", "false");
}
$("download-more").addEventListener("click", () => {
  const open = $("download-menu").hidden;
  $("download-menu").hidden = !open;
  $("download-more").setAttribute("aria-expanded", String(open));
  if (open) $("download-svg").focus();
});
$("download-svg").addEventListener("click", () => {
  downloadBlob(
    new Blob([mascotSVG(state, { background: true, standalone: true })], {
      type: "image/svg+xml;charset=utf-8",
    }),
    "my-supabasito.svg",
  );
  closeDownloadMenu();
  $("download-more").focus();
  notify("SVG downloaded.");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".download-group")) closeDownloadMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("download-menu").hidden) {
    closeDownloadMenu();
    $("download-more").focus();
  }
});
function availableLayers() {
  return visibleLayerIds(state)
    .reverse()
    .map((id) => ({
      id,
      name: id.startsWith("image-")
        ? state.images.find((image) => `image-${image.id}` === id).name
        : id.startsWith("caption-")
          ? `Caption: ${layerValue(state, id).text}`
          : {
              base: "Supabasito",
              fingers: "Fingers",
              face: "Glasses",
              hat: "Hat",
              prop: "Hand prop",
              caption: "Caption",
            }[id],
      icon:
        {
          base: "ϟ",
          fingers: "☞",
          face: "◉",
          hat: "⌂",
          prop: "♧",
          caption: "T",
        }[id] || (id.startsWith("caption-") ? "T" : "▧"),
    }));
}
let stackDrag;
function renderLayerList(layers) {
  if (stackDrag) return;
  const focused =
    document.activeElement.closest?.("[data-stack-layer]")?.dataset.stackLayer;
  $("layer-list").replaceChildren(
    ...layers.map((layer) => {
      const row = document.createElement("li");
      row.className = "layer-row";
      row.dataset.stackLayer = layer.id;
      const handle = document.createElement("button");
      handle.className = "layer-handle";
      handle.textContent = "⠿";
      handle.dataset.reorderLayer = layer.id;
      handle.dataset.layer = layer.id;
      handle.setAttribute("aria-label", `Reorder ${layer.name}`);
      handle.title = "Drag to reorder. Alt + ↑ / ↓ moves a focused layer.";
      const select = document.createElement("button");
      select.className = "layer-select";
      select.dataset.layer = layer.id;
      select.setAttribute("aria-pressed", String(selectedLayer === layer.id));
      select.title = `${layer.name} · Alt + ↑ / ↓ to reorder`;
      const icon = document.createElement("span");
      icon.className = "layer-icon";
      icon.setAttribute("aria-hidden", "true");
      const image = state.images.find(
        (image) => `image-${image.id}` === layer.id,
      );
      if (image) {
        const thumbnail = document.createElement("img");
        thumbnail.src = image.src;
        thumbnail.alt = "";
        icon.append(thumbnail);
      } else icon.textContent = layer.icon;
      const name = document.createElement("span");
      name.className = "layer-name";
      name.textContent = layer.name;
      select.append(icon, name);
      select.addEventListener("click", () => selectLayer(layer.id));
      row.append(handle, select);
      if (["base", "fingers"].includes(layer.id)) {
        const fixed = document.createElement("span");
        fixed.className = "layer-fixed";
        fixed.textContent = "Fixed art";
        row.append(fixed);
      }
      return row;
    }),
  );
  if (focused) focusStackLayer(focused);
}
function focusStackLayer(id) {
  [...$("layer-list").querySelectorAll("[data-stack-layer]")]
    .find((row) => row.dataset.stackLayer === id)
    ?.querySelector(".layer-select")
    .focus({ preventScroll: true });
}
function commitLayerOrder(id, targetId) {
  const ids = availableLayers().map((layer) => layer.id);
  if (!ids.includes(id) || !ids.includes(targetId)) {
    renderEditor();
    return;
  }
  update({ layerOrder: reorderLayer(state, id, targetId) });
  focusStackLayer(id);
  const layers = availableLayers();
  const index = layers.findIndex((layer) => layer.id === id);
  notify(
    `${layers[index].name} moved to layer ${index + 1} of ${layers.length}, from the top.`,
  );
}
$("layer-list").addEventListener("keydown", (event) => {
  const id = event.target.closest("[data-stack-layer]")?.dataset.stackLayer;
  if (!id || !event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key))
    return;
  event.preventDefault();
  const ids = availableLayers().map((layer) => layer.id);
  const targetId = ids[ids.indexOf(id) + (event.key === "ArrowUp" ? -1 : 1)];
  if (targetId) commitLayerOrder(id, targetId);
});
$("layer-list").addEventListener("pointerdown", (event) => {
  const id = event.target.closest("[data-reorder-layer]")?.dataset.reorderLayer;
  if (!id || event.button !== 0) return;
  event.preventDefault();
  selectLayer(id);
  stackDrag = { id, targetId: id, pointer: event.pointerId };
  $("layer-list").setPointerCapture(event.pointerId);
});
$("layer-list").addEventListener("pointermove", (event) => {
  if (!stackDrag || stackDrag.pointer !== event.pointerId) return;
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest("[data-stack-layer]");
  if (!row || !$("layer-list").contains(row)) return;
  stackDrag.targetId = row.dataset.stackLayer;
  const ids = availableLayers().map((layer) => layer.id);
  const movingDown =
    ids.indexOf(stackDrag.id) < ids.indexOf(stackDrag.targetId);
  $("layer-list")
    .querySelectorAll("[data-stack-layer]")
    .forEach((item) => {
      item.classList.toggle("drop-target", item === row);
      item.classList.toggle("drop-after", item === row && movingDown);
    });
});
function endStackDrag(event) {
  if (!stackDrag || stackDrag.pointer !== event.pointerId) return;
  const { id, targetId } = stackDrag;
  stackDrag = null;
  if ($("layer-list").hasPointerCapture(event.pointerId))
    $("layer-list").releasePointerCapture(event.pointerId);
  if (event.type === "pointerup" && id !== targetId)
    commitLayerOrder(id, targetId);
  else {
    renderEditor();
    focusStackLayer(id);
  }
}
$("layer-list").addEventListener("pointerup", endStackDrag);
$("layer-list").addEventListener("pointercancel", endStackDrag);
$("layer-list").addEventListener("lostpointercapture", endStackDrag);
function selectLayer(id) {
  selectedLayer = id;
  if (id.startsWith("caption-")) activateTab($("tab-text"));
  renderEditor();
}
function renderEditor() {
  const layers = availableLayers();
  if (!layers.some((layer) => layer.id === selectedLayer)) selectedLayer = "";
  renderLayerList(layers);
  document.querySelectorAll("#mascot [data-layer]").forEach((node) => {
    node.classList.toggle(
      "selected-layer",
      node.dataset.layer === selectedLayer,
    );
    node.setAttribute(
      "aria-pressed",
      String(node.dataset.layer === selectedLayer),
    );
  });
  drawSelection(
    $("mascot").querySelector("svg"),
    [...document.querySelectorAll("#mascot [data-layer]")].find(
      (node) => node.dataset.layer === selectedLayer,
    ),
    layerValue(state, selectedLayer),
  );
  const caption = selectedLayer.startsWith("caption-")
    ? layerValue(state, selectedLayer)
    : captionDraft;
  if ($("caption-text").value !== caption.text)
    $("caption-text").value = caption.text;
  $("caption-count").textContent = `${caption.text.length} / 100`;
  $("caption-size").value = caption.size;
  $("caption-color").value = caption.color;
  $("caption-mode").textContent = selectedLayer.startsWith("caption-")
    ? "Editing selected caption"
    : "New caption";
  $("caption-new").hidden = !selectedLayer.startsWith("caption-");
  $("caption-add").hidden = selectedLayer.startsWith("caption-");
  $("caption-add").disabled =
    !captionDraft.text.trim() || state.captions.length >= captionLimit;
  $("caption-limit").textContent =
    `${state.captions.length} / ${captionLimit} captions`;
  $("upload-count").textContent = `${state.images.length} / 5 images`;
  $("upload-list").replaceChildren(
    ...state.images.map((image) => {
      const row = document.createElement("div");
      row.className = "upload-row";
      const select = document.createElement("button");
      select.textContent = image.name;
      select.title = image.name;
      select.setAttribute(
        "aria-pressed",
        String(selectedLayer === `image-${image.id}`),
      );
      select.addEventListener("click", () => selectLayer(`image-${image.id}`));
      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${image.name}`);
      remove.addEventListener("click", () => deleteLayer(`image-${image.id}`));
      row.append(select, remove);
      return row;
    }),
  );
}
function deleteLayer(id = selectedLayer) {
  if (!id || ["base", "fingers"].includes(id)) return;
  drag = null;
  if (stackDrag) {
    const pointer = stackDrag.pointer;
    stackDrag = null;
    if ($("layer-list").hasPointerCapture(pointer))
      $("layer-list").releasePointerCapture(pointer);
  }
  update(removeLayer(state, id));
}
document.addEventListener("keydown", (event) => {
  if (!shouldDeleteLayer(event, selectedLayer)) return;
  event.preventDefault();
  deleteLayer();
  $("mascot").focus({ preventScroll: true });
});
$("mascot").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-layer-action]")?.dataset
    .layerAction;
  if (!action) return;
  event.stopPropagation();
  if (action === "delete") {
    deleteLayer();
    $("mascot").focus({ preventScroll: true });
    return;
  }
  if (action === "backgroundRemoved") {
    const id = selectedLayer;
    const image = layerValue(state, id);
    if (!id.startsWith("image-") || !image) return;
    const generation = uploadGeneration;
    const button = event.target.closest("[data-layer-action]");
    button.disabled = true;
    try {
      const next = await removeImageBackground(image);
      const current = layerValue(state, id);
      if (
        generation !== uploadGeneration ||
        !current ||
        current.src !== image.src
      )
        return;
      update(
        moveLayer(state, id, {
          src: next.src,
          originalSrc: next.originalSrc,
          backgroundRemovedSrc: next.backgroundRemovedSrc,
          backgroundRemoved: next.backgroundRemoved === true,
        }),
      );
      if (next.src === image.src)
        notify("No white background connected to the image edge was found.");
      if (selectedLayer === id)
        $("mascot")
          .querySelector(`[data-layer-action="${action}"]`)
          ?.focus({ preventScroll: true });
    } catch {
      notify("The background could not be removed. Your image is unchanged.");
    } finally {
      button.disabled = false;
    }
    return;
  }
  const node = $("mascot").querySelector(`[data-layer="${selectedLayer}"]`);
  const geometry =
    node && selectionGeometry(node, $("mascot").querySelector("svg"));
  const changes = toggleLayerAction(
    state,
    selectedLayer,
    action,
    geometry?.center,
    layerAnchors[selectedLayer],
  );
  if (!changes) return;
  update(changes);
  $("mascot")
    .querySelector(`[data-layer-action="${action}"]`)
    ?.focus({ preventScroll: true });
});
for (const [id, field] of [
  ["caption-text", "text"],
  ["caption-size", "size"],
  ["caption-color", "color"],
]) {
  $(id).addEventListener("input", (event) => {
    const changes = {
      [field]:
        field === "size" ? Number(event.target.value) : event.target.value,
    };
    if (selectedLayer.startsWith("caption-"))
      update(moveLayer(state, selectedLayer, changes));
    else {
      captionDraft = { ...captionDraft, ...changes };
      renderEditor();
    }
  });
}
$("caption-add").addEventListener("click", () => {
  const changes = addCaption(state, captionDraft);
  if (!changes) return;
  selectedLayer = `caption-${changes.captions.at(-1).id}`;
  captionDraft = { ...captionDefaults };
  update(changes);
});
$("caption-new").addEventListener("click", () => {
  selectLayer("");
  $("caption-text").focus();
});

$("mascot").addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest("[data-layer-action]")) return;
  const node = event.target.closest("[data-layer]");
  const action = event.target.closest("[data-transform]")?.dataset.transform;
  if (!action) selectLayer(node?.dataset.layer || "");
  $("mascot").focus({ preventScroll: true });
  if (!layerValue(state, selectedLayer)) return;
  const point = clientPoint(
    $("mascot").querySelector("svg"),
    event.clientX,
    event.clientY,
  );
  if (!point) return;
  clearTimeout(saveTimer);
  drag = {
    pointer: event.pointerId,
    id: selectedLayer,
    start: point,
    origin: { ...layerValue(state, selectedLayer) },
    action,
    geometry: selectionGeometry(
      $("mascot").querySelector(`[data-layer="${selectedLayer}"]`),
      $("mascot").querySelector("svg"),
    ),
  };
  const anchor = layerAnchors[selectedLayer] || { x: 0, y: 0 };
  drag.origin.anchor = {
    x: drag.origin.x + anchor.x,
    y: drag.origin.y + anchor.y,
  };
  $("mascot").setPointerCapture(event.pointerId);
  event.preventDefault();
});
$("mascot").addEventListener("pointermove", (event) => {
  if (!drag || drag.pointer !== event.pointerId) return;
  const point = clientPoint(
    $("mascot").querySelector("svg"),
    event.clientX,
    event.clientY,
  );
  if (!point) return;
  let changes;
  if (drag.action && drag.geometry) {
    const result =
      drag.action === "rotate"
        ? rotationAt(
            drag.origin,
            drag.geometry.center,
            drag.start,
            point,
            event.shiftKey,
          )
        : resizeAt(
            drag.origin,
            drag.geometry.corners[Number(drag.action.slice(-1))],
            drag.geometry.corners[(Number(drag.action.slice(-1)) + 2) % 4],
            drag.start,
            point,
            ...resizeLimits(drag.id, drag.origin),
          );
    changes = transformChanges(
      drag.id,
      drag.origin,
      result,
      layerAnchors[drag.id],
    );
  } else changes = dragPosition(drag.origin, drag.start, point);
  update(moveLayer(state, drag.id, changes), false);
});
function endDrag(event) {
  if (!drag || event.pointerId !== drag.pointer) return;
  drag = null;
  if ($("mascot").hasPointerCapture(event.pointerId))
    $("mascot").releasePointerCapture(event.pointerId);
  save();
}
$("mascot").addEventListener("pointerup", endDrag);
$("mascot").addEventListener("pointercancel", endDrag);
$("mascot").addEventListener("lostpointercapture", endDrag);
$("mascot").addEventListener("keydown", (event) => {
  if (event.target.closest("[data-layer-action]")) return;
  if (event.key === "Escape") {
    selectLayer("");
    return;
  }
  const action = event.target.closest("[data-transform]")?.dataset.transform;
  if (
    action &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    event.preventDefault();
    const node = $("mascot").querySelector(`[data-layer="${selectedLayer}"]`);
    const geometry =
      node && selectionGeometry(node, $("mascot").querySelector("svg"));
    if (!geometry) return;
    const origin = { ...layerValue(state, selectedLayer) };
    const anchor = layerAnchors[selectedLayer] || { x: 0, y: 0 };
    origin.anchor = { x: origin.x + anchor.x, y: origin.y + anchor.y };
    const direction = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1;
    let result;
    if (action === "rotate") {
      const start = { x: geometry.center.x + 100, y: geometry.center.y };
      const radians = (direction * (event.shiftKey ? 15 : 1) * Math.PI) / 180;
      result = rotationAt(origin, geometry.center, start, {
        x: geometry.center.x + Math.cos(radians) * 100,
        y: geometry.center.y + Math.sin(radians) * 100,
      });
    } else {
      const index = Number(action.slice(-1));
      const corner = geometry.corners[index];
      const opposite = geometry.corners[(index + 2) % 4];
      const factor = 1 + direction * (event.shiftKey ? 0.1 : 0.02);
      result = resizeAt(
        origin,
        corner,
        opposite,
        corner,
        {
          x: opposite.x + (corner.x - opposite.x) * factor,
          y: opposite.y + (corner.y - opposite.y) * factor,
        },
        ...resizeLimits(selectedLayer, origin),
      );
    }
    update(
      moveLayer(
        state,
        selectedLayer,
        transformChanges(
          selectedLayer,
          origin,
          result,
          layerAnchors[selectedLayer],
        ),
      ),
    );
    $("mascot")
      .querySelector(`[data-transform="${action}"]`)
      ?.focus({ preventScroll: true });
    return;
  }
  const id = event.target.closest("[data-layer]")?.dataset.layer;
  if (id && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    selectLayer(id);
    return;
  }
  const value = layerValue(state, selectedLayer);
  const direction = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[event.key];
  if (!value || !direction) return;
  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;
  $("mascot").focus({ preventScroll: true });
  update(
    moveLayer(state, selectedLayer, {
      x: value.x + direction[0] * step,
      y: value.y + direction[1] * step,
    }),
  );
});
async function addFiles(files, announce = false) {
  if (uploading) {
    notify("Please wait for your images to finish opening.");
    return;
  }
  uploading = true;
  const generation = uploadGeneration;
  const errors = [];
  let added = 0;
  try {
    for (const file of files) {
      if (generation !== uploadGeneration) break;
      const error = uploadError(file, state.images.length);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        continue;
      }
      try {
        const image = await prepareImage(file);
        if (generation !== uploadGeneration) break;
        if (image.backgroundError)
          errors.push(`${file.name}: ${image.backgroundError}`);
        selectedLayer = `image-${image.id}`;
        update({ images: [...state.images, image] });
        if (state.images.some((item) => item.id === image.id)) added++;
        else
          errors.push(
            `${file.name}: That image could not be added. Try a smaller image.`,
          );
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    if (generation === uploadGeneration) {
      $("upload-message").textContent = errors.length
        ? errors.join(" ")
        : `${added} image${added === 1 ? "" : "s"} added. Drag to position; use the canvas handles to resize or rotate.`;
      if (announce) notify($("upload-message").textContent);
      if (added) save();
    }
  } finally {
    uploading = false;
    $("image-upload").value = "";
  }
}
$("image-upload").addEventListener("change", (event) =>
  addFiles([...event.target.files]),
);
$("upload-zone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("upload-zone").classList.add("drag-over");
});
$("upload-zone").addEventListener("dragleave", () =>
  $("upload-zone").classList.remove("drag-over"),
);
$("upload-zone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("upload-zone").classList.remove("drag-over");
  addFiles([...event.dataTransfer.files]);
});
document.addEventListener("paste", (event) => {
  const files = pastedImages(event);
  if (!files.length) return;
  event.preventDefault();
  addFiles(files, true);
});
window.addEventListener("pagehide", save);
render();

new ResizeObserver(() => renderEditor()).observe($("mascot"));
