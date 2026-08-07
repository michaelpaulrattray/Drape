/**
 * THE SEGMENTATION READER, on the product path.
 *
 * `maskedRefine` asks three questions and does not care who answers them. This
 * is the answer for production, and it is the same three models the whole
 * workstream was measured on — swapping one is a routing-table edit here rather
 * than a change to any law.
 *
 *   SAM 3            knows WHERE. Precise on named regions (0.77–0.96), holds on
 *                    thin wire, finds eyes through lenses — and is 100% BINARY,
 *                    so it never supplies a blendable edge.
 *   BiRefNet Matting knows the EDGE. A real alpha ramp, and an opinion about
 *                    exactly one thing: the whole subject.
 *   moondream3 point knows WHERE A THING WOULD BE, which is a different
 *                    capability again — it still answers when hair covers the
 *                    ear, and that is the only reason an addition can be placed.
 *
 * **Every prompt that reaches here is record-gated by the caller** (D-213). This
 * module does not decide what to ask; it asks what it is given, which is why the
 * question vocabulary lives beside the facets rather than here.
 */
import { createModuleLogger } from "../logging/logger";
import { MaskError } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

const log = createModuleLogger("castingV2/falRegionReader");

const SAM3 = "fal-ai/sam-3/image";
const BIREFNET = "fal-ai/birefnet/v2";
const POINT = "fal-ai/moondream3-preview/point";

/**
 * fal keeps generated objects for seven days by default; a mask we use once and
 * discard has no business outliving the request. Asked for on the outgoing call
 * rather than cleaned up afterwards — an expiry cannot be forgotten, a purge
 * depends on a worker staying healthy.
 */
const LIFECYCLE = JSON.stringify({ expiration_duration_seconds: 3600 });

async function post(apiKey: string, endpoint: string, body: unknown, signal?: AbortSignal): Promise<any> {
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": LIFECYCLE,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw new MaskError(`${endpoint}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
}

/**
 * A returned PNG into a single-channel mask, at its own resolution.
 *
 * **The channel count is proven, never assumed.** D-210 landed three times in
 * one session through exactly this door: sharp promotes buffers to three
 * channels behind your back, and every loop downstream walks one byte per pixel,
 * reads past the end, and compares against `undefined` — which is false, so a
 * guarantee reports success for two thirds of a buffer it never looked at.
 */
async function toMask(bytes: Buffer): Promise<Mask> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new MaskError(`mask is ${data.length} bytes for ${info.width}x${info.height} — not single-channel`);
  }
  return { data, width: info.width, height: info.height };
}

async function fetchMask(url: string): Promise<Mask> {
  const raw = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(raw);
}

function dataUri(image: Buffer): string {
  return `data:image/png;base64,${image.toString("base64")}`;
}

/**
 * A bilateral region is TWO QUESTIONS, and this is where that is enforced.
 *
 * SAM 3 returns exactly ONE instance for "ear", and which one depends on the
 * wording — "ear" came back with her left, "ears" with her right, each perfectly
 * good. A caller taking either would mask one side of a symmetrical feature and
 * report success. So a name in this set is asked once per side and unioned, and
 * the union is what the caller sees.
 */
const BILATERAL = new Set(["ear", "eyes", "eyebrows"]);

export function createFalRegionReader(input: {
  apiKey: string;
  signal?: AbortSignal;
}): RegionReader {
  const { apiKey, signal } = input;

  const askRegion = async (image: Buffer, prompt: string): Promise<Mask | null> => {
    const json = await post(apiKey, SAM3, {
      image_url: dataUri(image), prompt, include_scores: true, output_format: "png",
    }, signal);
    const masks: any[] = Array.isArray(json.masks) ? json.masks : [];
    if (masks.length === 0) return null;
    const entry = masks[0];
    return fetchMask(typeof entry === "string" ? entry : entry.url);
  };

  return {
    async region({ image, name, absentIsAnswer }) {
      /*
        AN EMPTY ANSWER MEANS TWO DIFFERENT THINGS, and which one is the
        CALLER's to know.

        Asked of the master about a region the record says is there, nothing
        found is a question this model could not answer, and composing on it
        would deliver "nothing changed" at full price. Asked of the PAINTED
        frame after *"take her glasses off"*, nothing found is the painter
        having done exactly what was asked — and refusing it would charge her
        for the picture she already had, which is the worse of the two errors
        this whole path exists to prevent.
      */
      const absent = async (): Promise<Mask> => {
        if (!absentIsAnswer) throw new MaskError(`the segmenter found no ${name} to edit`);
        const sharp = (await import("sharp")).default;
        const meta = await sharp(image).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (!width || !height) throw new MaskError(`cannot size an empty ${name} mask for this image`);
        log.debug({ name }, "[falRegionReader] nothing there, and nothing there is the answer");
        return { data: Buffer.alloc(width * height, 0), width, height };
      };

      if (BILATERAL.has(name)) {
        const sides = await Promise.all([
          askRegion(image, `left ${name === "eyes" ? "eye" : name.replace(/s$/, "")}`),
          askRegion(image, `right ${name === "eyes" ? "eye" : name.replace(/s$/, "")}`),
        ]);
        const found = sides.filter((mask): mask is Mask => mask !== null);
        if (found.length === 0) return absent();
        const { unionMasks } = await import("./maskGeometry");
        return found.length === 1 ? found[0] : unionMasks(...found);
      }
      const mask = await askRegion(image, name);
      if (!mask) return absent();
      return mask;
    },

    async subject({ image }) {
      const json = await post(apiKey, BIREFNET, {
        image_url: dataUri(image), mask_only: true, model: "Matting", output_format: "png",
      }, signal);
      const url = json?.mask_image?.url ?? json?.image?.url;
      if (!url) throw new MaskError("the matting model returned no mask");
      return fetchMask(url);
    },

    async landmark({ image, name }) {
      const json = await post(apiKey, POINT, { image_url: dataUri(image), prompt: name }, signal);
      const points: any[] = Array.isArray(json.points) ? json.points : [];
      if (points.length === 0) {
        throw new MaskError(`nothing could place a ${name} on this face`);
      }
      log.debug({ name, points: points.length }, "[falRegionReader] landmark located");
      return points.map((point) => ({ x: Number(point.x), y: Number(point.y) }));
    },
  };
}
