/**
 * THE SPOTLIGHT'S HIT-TEST, IN THE BROWSER — #14 slice 3b.
 *
 * The server answers an opened picture with an INDEX MAP: a greyscale PNG, one
 * byte per pixel, each byte naming the piece that owns that pixel (0 for none).
 * `server/castingV2/referenceSpotlightMap.ts` is its encoder and its header
 * says what it leaves to this side: *"whether a browser's canvas hands the
 * bytes back unshifted is a reading 3b must take."*
 *
 * ## The reading, and why the answer is NOT the canvas
 *
 * A canvas round trip is a colour-managed, privacy-noised channel: a browser
 * may convert an untagged PNG on decode, and several (Brave's farbling,
 * Firefox's resist-fingerprinting) deliberately perturb `getImageData` so that
 * a script cannot read back exactly what it drew. For a photograph that is
 * invisible. For an index map it is a different piece under the pointer — the
 * jacket lighting the scarf — and it would read exactly like a geometry bug.
 *
 * So the map is never drawn to read it. It is DECODED here, by the PNG format's
 * own rules, from its bytes: chunks, the zlib stream (through the browser's own
 * `DecompressionStream`, not a library), and the five scanline filters. Exact
 * by construction on every browser, and the suite proves it against the
 * server's real encoder rather than against a fixture this module wrote.
 *
 * It decodes the ONE shape the encoder emits — 8-bit greyscale, not interlaced
 * — and REFUSES anything else rather than guessing at it. A refusal here is a
 * picture that does not light, which is the fail-open the design asks for; a
 * guess would be a lit shape that disagrees with the cut the tap takes.
 *
 * ## Nothing here costs anything
 *
 * Hover is a lookup in a byte array the browser already holds (§0: *"hover is
 * then a hit-test in the browser and costs nothing"*). The only calls that
 * spend are the open and the tap, and neither lives in this module.
 */

/** The byte that means "no piece owns this pixel" — the encoder's own value. */
export const SPOTLIGHT_NOTHING = 0;

export type SpotlightIndex = {
  /** One byte per pixel, row-major, at the FRAME's own size. */
  indices: Uint8Array;
  width: number;
  height: number;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

/** Big-endian unsigned 32-bit read — PNG's only integer shape. */
function u32(bytes: Uint8Array, at: number): number {
  return ((bytes[at]! << 24) >>> 0) + (bytes[at + 1]! << 16) + (bytes[at + 2]! << 8) + bytes[at + 3]!;
}

async function inflate(zlib: Uint8Array): Promise<Uint8Array> {
  /* "deflate" is the zlib-wrapped format (RFC 1950), which is exactly what a
     PNG's IDAT stream is. Copied into a fresh buffer so the Blob owns plain
     bytes whatever view it was handed. */
  const stream = new Blob([zlib.slice()]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The Paeth predictor, from the PNG specification §9.4. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * DECODE THE SERVER'S INDEX MAP — exactly, or not at all.
 *
 * Throws on anything that is not the encoder's own shape; the caller turns a
 * throw into a picture that does not light.
 */
export async function decodeSpotlightMap(png: Uint8Array): Promise<SpotlightIndex> {
  if (png.length < 8 || PNG_SIGNATURE.some((byte, at) => png[at] !== byte)) {
    throw new Error("not a PNG");
  }
  let width = 0;
  let height = 0;
  const parts: Uint8Array[] = [];
  let at = 8;
  let sawHeader = false;
  while (at + 8 <= png.length) {
    const length = u32(png, at);
    const type = String.fromCharCode(png[at + 4]!, png[at + 5]!, png[at + 6]!, png[at + 7]!);
    const data = png.subarray(at + 8, at + 8 + length);
    if (data.length !== length) throw new Error(`the ${type} chunk is cut short`);
    if (type === "IHDR") {
      width = u32(data, 0);
      height = u32(data, 4);
      const bitDepth = data[8];
      const colourType = data[9];
      const interlace = data[12];
      /* The encoder pins colour type 0 at depth 8 with no interlace. A palette
         (type 3) would make the decoded byte an index into a table rather than
         the piece's id — the exact mislighting the encoder's header warns of. */
      if (bitDepth !== 8 || colourType !== 0 || interlace !== 0) {
        throw new Error(`not an 8-bit greyscale map (depth ${bitDepth}, type ${colourType}, interlace ${interlace})`);
      }
      sawHeader = true;
    } else if (type === "IDAT") {
      parts.push(data);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  if (!sawHeader || width <= 0 || height <= 0) throw new Error("no image header");
  if (parts.length === 0) throw new Error("no image data");

  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  const raw = await inflate(joined);
  const stride = width; // one byte per pixel
  if (raw.length !== height * (stride + 1)) {
    throw new Error(`the map is ${raw.length} bytes for a ${width}x${height} frame`);
  }

  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    const line = y * (stride + 1) + 1;
    const out = y * stride;
    const above = out - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[line + x]!;
      const left = x > 0 ? indices[out + x - 1]! : 0;
      const up = y > 0 ? indices[above + x]! : 0;
      const upLeft = x > 0 && y > 0 ? indices[above + x - 1]! : 0;
      let decoded: number;
      switch (filter) {
        case 0: decoded = value; break;
        case 1: decoded = value + left; break;
        case 2: decoded = value + up; break;
        case 3: decoded = value + ((left + up) >> 1); break;
        case 4: decoded = value + paeth(left, up, upLeft); break;
        default: throw new Error(`unknown scanline filter ${filter}`);
      }
      indices[out + x] = decoded & 0xff;
    }
  }
  return { indices, width, height };
}

/** Base64 to bytes — the wire carries the map as text. */
export function bytesOfBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at);
  return bytes;
}

/**
 * DOES THIS MAP DESCRIBE THE PICTURE ON SCREEN?
 *
 * The map is at the frame's size as the SERVER read it, and the picture on
 * screen is the file as the BROWSER decoded it. They are the same bytes, so
 * they agree — unless something between turned the picture (a rotation flag a
 * browser honours and a reader does not). A map whose shape disagrees with the
 * picture's would light the wrong place under the pointer, so it does not
 * light at all. Scale is allowed to differ; shape is not.
 */
export function mapFitsPicture(
  map: { width: number; height: number },
  picture: { width: number; height: number },
): boolean {
  if (map.width <= 0 || map.height <= 0 || picture.width <= 0 || picture.height <= 0) return false;
  const mapShape = map.width / map.height;
  const pictureShape = picture.width / picture.height;
  return Math.abs(mapShape - pictureShape) / pictureShape < 0.01;
}

/**
 * WHERE ON THE FRAME A POINTER IS — `null` off the picture.
 *
 * `box` is the drawn picture's rectangle on screen. The answer is in the
 * frame's own pixels, which is the coordinate the tap travels in.
 */
export function framePoint(
  pointer: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number },
): { x: number; y: number } | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const u = (pointer.clientX - box.left) / box.width;
  const v = (pointer.clientY - box.top) / box.height;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return null;
  return {
    x: Math.min(frame.width - 1, Math.floor(u * frame.width)),
    y: Math.min(frame.height - 1, Math.floor(v * frame.height)),
  };
}

/** Which piece owns this frame pixel — `SPOTLIGHT_NOTHING` for none or off the frame. */
export function pieceAt(map: SpotlightIndex, point: { x: number; y: number } | null): number {
  if (!point) return SPOTLIGHT_NOTHING;
  const { x, y } = point;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return SPOTLIGHT_NOTHING;
  return map.indices[y * map.width + x] ?? SPOTLIGHT_NOTHING;
}

/**
 * THE LIT SHAPE AS CANVAS PIXELS — opaque where any layer's piece is, clear
 * everywhere else.
 *
 * Several layers because the picture can show more than one thing lit at once:
 * the piece under the pointer is one layer of the split map, and every taken
 * cut is its own one-piece map. All layers are at the frame's size.
 */
export function litPixels(
  frame: { width: number; height: number },
  layers: ReadonlyArray<{ map: SpotlightIndex; piece: number }>,
): Uint8ClampedArray<ArrayBuffer> {
  const size = frame.width * frame.height;
  const pixels = new Uint8ClampedArray(size * 4);
  for (const { map, piece } of layers) {
    if (piece === SPOTLIGHT_NOTHING || map.width !== frame.width || map.height !== frame.height) continue;
    const { indices } = map;
    for (let at = 0; at < size; at += 1) {
      if (indices[at] !== piece) continue;
      const o = at * 4;
      pixels[o] = 255;
      pixels[o + 1] = 255;
      pixels[o + 2] = 255;
      pixels[o + 3] = 255;
    }
  }
  return pixels;
}
