export function removeWhiteBackground(data, width, height) {
  const count = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1600 ||
    height > 1600 ||
    data.length !== count * 4
  )
    throw new Error("Invalid image dimensions.");
  const pixels = new Uint8ClampedArray(data);
  for (let index = 0; index < count; index++) {
    const border =
      index < width ||
      index >= count - width ||
      index % width === 0 ||
      index % width === width - 1;
    if (border && data[index * 4 + 3] < 255)
      return { data: pixels, changed: false };
  }
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let head = 0;
  let tail = 0;
  let changed = false;
  const enqueue = (index) => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const maximum = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    if (data[offset + 3] === 0 || (minimum >= 220 && maximum - minimum <= 18))
      queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const offset = index * 4;
    const minimum = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const alpha = Math.round(
      data[offset + 3] * Math.max(0, (244 - minimum) / 24),
    );
    if (alpha < data[offset + 3]) {
      pixels[offset + 3] = alpha;
      changed = true;
    }
    if (index % width) enqueue(index - 1);
    if (index % width < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index < count - width) enqueue(index + width);
  }
  return { data: pixels, changed };
}

export function toggleImageBackground(image) {
  if (image.backgroundRemoved && image.originalSrc) {
    const { originalSrc, ...rest } = image;
    return {
      ...rest,
      src: originalSrc,
      backgroundRemovedSrc: image.src,
      backgroundRemoved: false,
    };
  }
  if (image.backgroundRemovedSrc) {
    const { backgroundRemovedSrc, ...rest } = image;
    return {
      ...rest,
      src: backgroundRemovedSrc,
      originalSrc: image.src,
      backgroundRemoved: true,
    };
  }
  return null;
}
