export function rotateVector(point, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}
export function normalizeRotation(degrees) {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}
export function rotationAt(origin, center, start, point, snap = false) {
  const angle = (p) =>
    (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
  const rotation =
    origin.rotation + normalizeRotation(angle(point) - angle(start));
  const next = normalizeRotation(
    snap ? Math.round(rotation / 15) * 15 : rotation,
  );
  const offset = rotateVector(
    { x: origin.anchor.x - center.x, y: origin.anchor.y - center.y },
    next - origin.rotation,
  );
  return {
    rotation: next,
    anchor: { x: center.x + offset.x, y: center.y + offset.y },
  };
}
export function resizeAt(
  origin,
  corner,
  opposite,
  start,
  point,
  minimum,
  maximum,
) {
  const diagonal = { x: corner.x - opposite.x, y: corner.y - opposite.y };
  const target = {
    x: diagonal.x + point.x - start.x,
    y: diagonal.y + point.y - start.y,
  };
  if (origin.lockAspectRatio === false && origin.width && origin.height) {
    const localDiagonal = rotateVector(diagonal, -origin.rotation);
    const localTarget = rotateVector(target, -origin.rotation);
    const width = Math.max(
      1,
      Math.min(1200, (origin.width * localTarget.x) / localDiagonal.x),
    );
    const height = Math.max(
      1,
      Math.min(1200, (origin.height * localTarget.y) / localDiagonal.y),
    );
    const resizedDiagonal = rotateVector(
      {
        x: Math.sign(localDiagonal.x) * width,
        y: Math.sign(localDiagonal.y) * height,
      },
      origin.rotation,
    );
    return {
      width,
      height,
      anchor: {
        x: opposite.x + resizedDiagonal.x / 2,
        y: opposite.y + resizedDiagonal.y / 2,
      },
    };
  }
  if (origin.lockAspectRatio === false && origin.scale !== undefined) {
    const localDiagonal = rotateVector(diagonal, -origin.rotation);
    const localTarget = rotateVector(target, -origin.rotation);
    const scaleX = Math.max(
      0.1,
      Math.min(10, ((origin.scaleX ?? 1) * localTarget.x) / localDiagonal.x),
    );
    const scaleY = Math.max(
      0.1,
      Math.min(10, ((origin.scaleY ?? 1) * localTarget.y) / localDiagonal.y),
    );
    const offset = rotateVector(
      { x: origin.anchor.x - opposite.x, y: origin.anchor.y - opposite.y },
      -origin.rotation,
    );
    const resizedOffset = rotateVector(
      {
        x: (offset.x * scaleX) / (origin.scaleX ?? 1),
        y: (offset.y * scaleY) / (origin.scaleY ?? 1),
      },
      origin.rotation,
    );
    return {
      scaleX,
      scaleY,
      anchor: {
        x: opposite.x + resizedOffset.x,
        y: opposite.y + resizedOffset.y,
      },
    };
  }
  const lengthSquared = diagonal.x ** 2 + diagonal.y ** 2;
  const ratio = lengthSquared
    ? (target.x * diagonal.x + target.y * diagonal.y) / lengthSquared
    : 1;
  const factor = Math.max(minimum, Math.min(maximum, ratio));
  return {
    factor,
    anchor: {
      x: opposite.x + (origin.anchor.x - opposite.x) * factor,
      y: opposite.y + (origin.anchor.y - opposite.y) * factor,
    },
  };
}
export function transformChanges(id, origin, result, accessoryAnchor) {
  const position = {
    x: result.anchor.x - (accessoryAnchor?.x || 0),
    y: result.anchor.y - (accessoryAnchor?.y || 0),
  };
  if (result.rotation !== undefined)
    return { ...position, rotation: result.rotation };
  if (id.startsWith("image-"))
    return {
      ...position,
      width: result.width ?? origin.width * result.factor,
      height: result.height ?? origin.height * result.factor,
    };
  if (result.scaleX !== undefined)
    return { ...position, scaleX: result.scaleX, scaleY: result.scaleY };
  return { ...position, scale: origin.scale * result.factor };
}
export function resizeLimits(id, value) {
  if (id.startsWith("image-"))
    return [
      Math.max(1 / value.width, 1 / value.height),
      Math.min(1200 / value.width, 1200 / value.height),
    ];
  return [0.25 / value.scale, 3 / value.scale];
}
export function selectionGeometry(node, svg) {
  const bounds = node.getBBox();
  const root = svg.getScreenCTM();
  const screen = node.getScreenCTM();
  if (!root || !screen || !bounds.width || !bounds.height) return null;
  const matrix = root.inverse().multiply(screen);
  const point = (x, y) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  });
  const corners = [
    point(bounds.x, bounds.y),
    point(bounds.x + bounds.width, bounds.y),
    point(bounds.x + bounds.width, bounds.y + bounds.height),
    point(bounds.x, bounds.y + bounds.height),
  ];
  return {
    corners,
    center: point(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
    screenScale: Math.hypot(root.a, root.b),
  };
}
export function rotationHandle(corners, center, unit) {
  const inset = 14 * unit;
  const visible = (point) =>
    point.x >= inset &&
    point.x <= 600 - inset &&
    point.y >= inset &&
    point.y <= 600 - inset;
  const candidates = [0, 2, 1, 3].map((index) => {
    const next = corners[(index + 1) % 4];
    const base = {
      x: (corners[index].x + next.x) / 2,
      y: (corners[index].y + next.y) / 2,
    };
    const distance = Math.hypot(base.x - center.x, base.y - center.y);
    const offset = {
      x: ((base.x - center.x) / distance) * 28 * unit,
      y: ((base.y - center.y) / distance) * 28 * unit,
    };
    return { base, handle: { x: base.x + offset.x, y: base.y + offset.y } };
  });
  return (
    candidates.find((candidate) => visible(candidate.handle)) || {
      base: candidates[0].base,
      handle: {
        x: Math.max(inset, Math.min(600 - inset, candidates[0].handle.x)),
        y: Math.max(inset, Math.min(600 - inset, candidates[0].handle.y)),
      },
    }
  );
}
export function toolbarPosition(corners, unit, count = 4) {
  const width = (count * 30 + 8) * unit;
  const height = 38 * unit;
  return {
    x: Math.max(
      4 * unit,
      Math.min(
        600 - width - 4 * unit,
        Math.max(...corners.map((point) => point.x)) - width,
      ),
    ),
    y: Math.max(
      4 * unit,
      Math.min(
        600 - height - 4 * unit,
        Math.max(...corners.map((point) => point.y)) + 12 * unit,
      ),
    ),
    width,
    height,
  };
}
export function layerToolbar(corners, unit, value, id) {
  const { x, y, width, height } = toolbarPosition(
    corners,
    unit,
    id.startsWith("image-") ? 5 : id.startsWith("caption-") ? 1 : 4,
  );
  const icons = {
    flipX: '<path d="M12 3v18M8 6 3 12l5 6ZM16 6l5 6-5 6Z"/>',
    flipY: '<path d="M3 12h18M6 8l6-5 6 5ZM6 16l6 5 6-5Z"/>',
    lockAspectRatio: value.lockAspectRatio
      ? '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
      : '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0"/>',
    backgroundRemoved: '<path d="M4 4h16v16H4Z M4 12h16M12 4v16M4 4l16 16"/>',
    delete: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  };
  const labels = id.startsWith("caption-")
    ? {}
    : {
        flipX: "Flip horizontally",
        flipY: "Flip vertically",
        lockAspectRatio: value.lockAspectRatio
          ? "Unlock aspect ratio"
          : "Lock aspect ratio",
      };
  if (id.startsWith("image-"))
    labels.backgroundRemoved = value.backgroundRemoved
      ? "Restore background"
      : "Remove white background";
  labels.delete = `Delete ${id.startsWith("image-") ? "image" : id.startsWith("caption-") ? "caption" : id === "face" ? "glasses" : id}`;
  return `<foreignObject class="image-toolbar" x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" class="image-toolbar-buttons${y < 36 * unit ? " tooltip-below" : ""}" style="transform:scale(${unit});transform-origin:top left;width:${width / unit}px">${Object.entries(
    labels,
  )
    .map(
      ([action, label]) =>
        `<button type="button" data-layer-action="${action}" aria-label="${label}" title="${label}"${action === "delete" ? "" : ` aria-pressed="${Boolean(value[action])}"`}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${icons[action]}</svg><span class="image-toolbar-tooltip">${label}</span></button>`,
    )
    .join("")}</div></foreignObject>`;
}
export function drawSelection(svg, node, value) {
  svg.querySelector("[data-selection]")?.remove();
  if (!node) return;
  const geometry = selectionGeometry(node, svg);
  if (!geometry) return;
  const { corners, center, screenScale } = geometry;
  const unit = 1 / screenScale;
  const { base: top, handle: rotation } = rotationHandle(corners, center, unit);
  const angle =
    (Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) *
      180) /
    Math.PI;
  const handle = (point, action, label, shape) =>
    `<g data-transform="${action}" tabindex="0" role="button" aria-label="${label}" transform="translate(${point.x} ${point.y}) rotate(${angle})"><circle class="selection-hit" r="${14 * unit}"/>${shape}</g>`;
  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
  overlay.dataset.selection = "";
  overlay.setAttribute("class", "selection-overlay");
  overlay.innerHTML = `<polygon points="${corners.map((p) => `${p.x},${p.y}`).join(" ")}"/><line x1="${top.x}" y1="${top.y}" x2="${rotation.x}" y2="${rotation.y}"/>${corners.map((point, index) => handle(point, `resize-${index}`, `Resize ${["top left", "top right", "bottom right", "bottom left"][index]} corner; use arrow keys`, `<rect class="selection-handle" x="${-4 * unit}" y="${-4 * unit}" width="${8 * unit}" height="${8 * unit}"/>`)).join("")}${handle(rotation, "rotate", "Rotate layer; use left and right arrow keys", `<circle class="selection-handle" r="${5 * unit}"/>`)}`;
  if (
    value &&
    (node.dataset.layer.startsWith("image-") ||
      node.dataset.layer.startsWith("caption-") ||
      ["hat", "face", "prop"].includes(node.dataset.layer))
  )
    overlay.innerHTML += layerToolbar(corners, unit, value, node.dataset.layer);
  svg.append(overlay);
}
