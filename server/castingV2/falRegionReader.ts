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
import { assertImageBytes, NotAnImageError } from "../security/trustedImageFetch";
import { LANDMARK_OF_ACCESSORY } from "./accessoryKinds";
import { MaskError, unionMasks } from "./maskGeometry";
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

/**
 * THE MASK FETCH IS A SECOND NETWORK CALL, AND IT USED TO HAVE NO DEFENCES.
 *
 * SAM 3 does not return a mask; it returns a URL to one, on fal's media CDN —
 * a different host from the API, reached by a bare `fetch` with no timeout, no
 * retry and no status check. On 2026-08-11 that host was unreachable for about
 * **ten minutes** while `queue.fal.run` answered normally: DNS resolved,
 * TCP connect timed out at 10s, every mask fetch failed. In that window every
 * masked render in production would have refused at the segmenter — a paid path
 * taken down by a blip on the one call that had nothing in the way.
 *
 * Three things, and each closes a different failure:
 *
 * - **A bounded retry**, because the specimen was transient and the alternative
 *   is refunding a render the provider was perfectly willing to serve.
 * - **A timeout**, because the default is the platform's and a request that
 *   hangs holds a paid operation's lease open behind it.
 * - **A status check and a medium check**, because a URL that answers with an
 *   error page answers with HTTP 200 more often than anyone expects, and the
 *   sweep that read thirty faces as bare did exactly that one layer up.
 *
 * **A 4xx is not retried** (except 429): a mask that is not there will not be
 * there in 250ms, and three attempts at a permanent answer only delays the
 * honest refusal the caller is waiting for.
 */
const MASK_FETCH_ATTEMPTS = 3;
const MASK_FETCH_TIMEOUT_MS = 15_000;
const MASK_FETCH_BACKOFF_MS = 250;

/** Whether this failure is worth a second look, or is simply the answer. */
function worthRetrying(status: number | null): boolean {
  if (status === null) return true; /* a network error — the specimen's own shape */
  if (status === 429) return true;
  return status >= 500;
}

async function fetchMaskBytes(url: string, signal?: AbortSignal): Promise<Buffer> {
  let last = "";
  for (let attempt = 1; attempt <= MASK_FETCH_ATTEMPTS; attempt += 1) {
    let retryable = true;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(MASK_FETCH_TIMEOUT_MS) });
      if (!response.ok) {
        retryable = worthRetrying(response.status);
        throw new MaskError(`the mask store answered ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      /* The caller gave up while we were waiting — a further attempt would be
         work nobody is listening for. */
      if (signal?.aborted) break;
      if (!retryable || attempt === MASK_FETCH_ATTEMPTS) break;
      log.warn(
        { attempt, of: MASK_FETCH_ATTEMPTS, err: last },
        "[falRegionReader] a mask did not come back — trying again",
      );
      await new Promise((resolve) => setTimeout(resolve, MASK_FETCH_BACKOFF_MS * attempt));
    }
  }
  throw new MaskError(`the mask could not be fetched — ${last}`);
}

async function fetchMask(url: string, signal?: AbortSignal): Promise<Mask> {
  const raw = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : await fetchMaskBytes(url, signal);
  /*
    A MASK IS A PICTURE, and bytes may only answer a question about pictures if
    they are provably one. Without this, an error page reaches `toMask` and
    fails as an unreadable sharp buffer — the right outcome by luck, wearing a
    message that names the wrong thing.
  */
  try {
    assertImageBytes(raw, "mask");
  } catch (error) {
    throw new MaskError(`what came back from the mask store is not a picture: ${(error as Error).message}`);
  }
  return toMask(raw);
}

function dataUri(image: Buffer): string {
  return `data:image/png;base64,${image.toString("base64")}`;
}

/**
 * EVERY QUESTION HERE IS A QUESTION ABOUT A PICTURE, so it is asked of one.
 *
 * Placed at the reader's own door rather than in each caller, because the
 * caller who forgets is the one who is silently wrong: a sweep over thirty
 * faces handed this module HTML error pages and read back "no glasses on any
 * of them" (opus-052 §3). `absentIsAnswer` is what makes it dangerous — it is
 * the one path that turns a failed reading into a confident negative, so it
 * must never be reachable from bytes that are not the medium.
 *
 * A `MaskError` rather than the raw `NotAnImageError`, because every caller on
 * the product path already handles that type as *this reading did not happen*;
 * the cause is preserved in the message so the diagnosis is not lost.
 */
function assertPicture(image: Buffer, question: string): void {
  try {
    assertImageBytes(image, `asked "${question}"`);
  } catch (error) {
    if (error instanceof NotAnImageError) throw new MaskError(error.message);
    throw error;
  }
}

/**
 * A BILATERAL REGION IS TWO PICTURES, not two adjectives.
 *
 * # What this set used to do, and the measurement that ended it
 *
 * The premise was right and the method was not. SAM 3 does return exactly ONE
 * instance for a bilateral noun — measured on the founder's own production
 * frames v#147 and v#156, the plain noun came back with **1 mask, every single
 * time**, and for `ear` and `eye` that one mask sits on ONE side. So a caller
 * taking it would mask half a symmetrical feature and report success. That much
 * was known.
 *
 * The fix was to ask twice, *"left ear"* and *"right ear"*, and union. **Those
 * words do not work.** Driven through this module's own code path against the
 * split-frame ground truth (`scripts/prove-bilateral-laterality-disposable.mts`,
 * artifacts in `output/bilateral-laterality/`):
 *
 *   ear        two distinct masks, one per side, on both frames — it worked here
 *   eye        `"right eye"` returned ZERO masks on BOTH frames, both runs, so
 *              the union was ONE EYE — 695px and 727px, all of it on one side of
 *              her midline, while the split frame found 518/937 and 581/1019
 *   eyebrow    on v#156 BOTH sides returned zero, so the union was EMPTY — and
 *              with `absentIsAnswer` that is the confident negative *"she has no
 *              eyebrows"*, over a frame whose brows measure 1429px and 1593px
 *
 * Four of twelve laterally-qualified calls returned nothing at all. The same
 * twelve features, asked as a PLAIN noun of a picture containing one side only,
 * read 12 of 12.
 *
 * # So the frame is cut before the question is asked
 *
 * This is the pair counter's cure, arrived at the same way (three instruments,
 * two of them wrong on his frames, mailbox opus-104): **a call can only answer
 * about the pixels it was handed.** Asked "is there an eye here" of a picture
 * containing one eye, laterality is not a word the model has to honour — it is
 * the crop. The midline is her FACE's own centroid rather than the image's,
 * because a portrait is not guaranteed centred; where no face reads — a tight
 * crop already inside one — the image's own middle is the honest fallback.
 *
 * The cost is one extra segmentation call per bilateral region (the face) and
 * one extra round trip, the two sides still going out in parallel. That is the
 * price of not silently editing one of a customer's eyes.
 */
/*
  AND THE ACCESSORY HALF OF THIS SET WAS A SECOND LIST (2026-08-10).

  The three names above are anatomy, and `REGION_OF_FACET` sends exactly those
  three bilateral ones — so that half is complete. The accessory half was not
  here at all: `LANDMARK_OF_ACCESSORY` sends `"earring"`, its entry already
  records `pair: true` with a `bothSides` phrase whose own doc comment says it
  is "how to name both sides, in the painter's clause AND THE READER'S" — and
  the reader never read it. Two lists holding one fact, drifted (working law 4).

  Proven at the wire before it was changed, on a frame where both hoops are
  plainly visible (`scripts/prove-earring-not-bilateral-disposable.mts`,
  GPT Image 2 paint `cell2g-1`):

    "earring"   ONE component, 786px, all of it on one side of her
    "ear"       TWO components, 2557px and 2553px, one per side

  The branch was sound; the name list was the defect. So the accessory table's
  own `pair` column is now the source, and this set derives from it rather than
  restating it — add a paired accessory to that table and the reader follows.

  This is D-238's class (a bilateral region answered as a single instance) and
  its sweep did not reach here: it cleared `landmark()` and `bornWornDetector`,
  both of which are anatomy. Cost is the same one extra call per bilateral
  region, now also paid on earrings — flagged to the latency-and-cost program.
*/
const BILATERAL = new Set([
  "ear",
  "eyes",
  "eyebrows",
  ...LANDMARK_OF_ACCESSORY.filter((entry) => entry.pair).map((entry) => entry.region),
]);

/** The noun ONE SIDE of a bilateral region is asked by. */
function singularOf(name: string): string {
  return name === "eyes" ? "eye" : name.replace(/s$/, "");
}

/** Her own vertical axis — the centroid of a mask, or null if it holds nothing. */
function centroidX(mask: Mask): number | null {
  let total = 0;
  let weighted = 0;
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[row + x] === 0) continue;
      total += 1;
      weighted += x;
    }
  }
  return total === 0 ? null : weighted / total;
}

/**
 * A HALF-FRAME MASK BACK INTO THE WHOLE FRAME'S COORDINATES.
 *
 * The caller asked about one picture and must be answered in that picture's
 * pixels; a mask that is silently half a frame wide would compose forty percent
 * of the way across her face. The returned size is CHECKED rather than assumed —
 * and where a provider hands back a different resolution than it was given, the
 * mask is resampled to the crop it answers about instead of throwing, because a
 * paid edit is not worth losing to a provider's scaling preference. Nearest
 * neighbour, so a binary mask stays binary.
 */
async function placeInFrame(
  half: Mask,
  crop: { left: number; width: number },
  width: number,
  height: number,
): Promise<Mask> {
  let source = half;
  if (half.width !== crop.width || half.height !== height) {
    log.warn(
      { returned: `${half.width}x${half.height}`, expected: `${crop.width}x${height}` },
      "[falRegionReader] the segmenter answered at a different size than it was asked — resampling to the crop",
    );
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(half.data, {
      raw: { width: half.width, height: half.height, channels: 1 },
    })
      .resize({ width: crop.width, height, kernel: "nearest", fit: "fill" })
      /* `toColourspace` is not decoration: a resize of a one-channel raw buffer
         comes back as THREE channels, and the guard below caught it on the first
         run. D-210, for the fourth time through the same door. */
      .toColourspace("b-w")
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (data.length !== info.width * info.height) {
      throw new MaskError(`a resampled side mask is ${data.length} bytes for ${info.width}x${info.height}`);
    }
    source = { data: Buffer.from(data), width: info.width, height: info.height };
  }
  const data = Buffer.alloc(width * height, 0);
  for (let y = 0; y < source.height; y += 1) {
    const from = y * source.width;
    source.data.copy(data, y * width + crop.left, from, from + source.width);
  }
  return { data, width, height };
}

export function createFalRegionReader(input: {
  apiKey: string;
  signal?: AbortSignal;
}): RegionReader {
  const { apiKey, signal } = input;

  /**
   * `keep: "all"` exists for the half frames, and the distinction is real.
   *
   * A region is one region, so the whole-frame path takes the first answer. A
   * SIDE of a bilateral region is a question about everything on that side —
   * two hoops in one ear, a brow read as two fragments — so nothing there may be
   * dropped. Measured: the plain noun returns one mask on a whole frame anyway,
   * which is exactly why the second side had to come from a second picture.
   */
  const askRegion = async (
    image: Buffer,
    prompt: string,
    keep: "first" | "all" = "first",
  ): Promise<Mask | null> => {
    const json = await post(apiKey, SAM3, {
      image_url: dataUri(image), prompt, include_scores: true, output_format: "png",
    }, signal);
    const masks: any[] = Array.isArray(json.masks) ? json.masks : [];
    const urls = masks
      .map((entry) => (typeof entry === "string" ? entry : entry?.url))
      .filter((url): url is string => typeof url === "string" && url.length > 0);
    if (urls.length === 0) return null;
    if (keep === "first") return fetchMask(urls[0], signal);
    const every = await Promise.all(urls.map((url) => fetchMask(url, signal)));
    return every.length === 1 ? every[0] : unionMasks(...every);
  };

  /**
   * ONE SIDE AT A TIME, each side its own picture. See `BILATERAL` for the
   * measurement that made this the method.
   *
   * Returns null when NEITHER side had anything — which is now a real reading of
   * two pictures rather than two words the model ignored, and is therefore fit to
   * reach `absentIsAnswer`. One side answering alone is also a real answer: a
   * head turned away genuinely has one visible ear.
   */
  const bilateral = async (image: Buffer, name: string): Promise<Mask | null> => {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(image).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) throw new MaskError(`cannot read a ${name} on an image with no size`);
    const noun = singularOf(name);
    /* A picture one pixel wide has no two sides to cut between. */
    if (width < 2) return askRegion(image, noun, "all");

    const face = await askRegion(image, "face", "all");
    const axis = face ? centroidX(face) : null;
    /* Clamped so a face read that lands on an edge cannot ask for a zero-width
       crop — a degenerate half is a thrown sharp error in place of a reading. */
    const midline = Math.min(width - 1, Math.max(1, Math.round(axis ?? width / 2)));

    const crops = [{ left: 0, width: midline }, { left: midline, width: width - midline }] as const;
    const sides = await Promise.all(crops.map(async (crop) => {
      const bytes = await sharp(image)
        .extract({ left: crop.left, top: 0, width: crop.width, height })
        .png()
        .toBuffer();
      const mask = await askRegion(bytes, noun, "all");
      return mask ? placeInFrame(mask, crop, width, height) : null;
    }));

    const found = sides.filter((mask): mask is Mask => mask !== null);
    log.debug(
      { name, noun, sides: found.length, midline, byFace: axis !== null },
      "[falRegionReader] bilateral read, one side to a picture",
    );
    if (found.length === 0) return null;
    return found.length === 1 ? found[0] : unionMasks(...found);
  };

  return {
    async region({ image, name, absentIsAnswer }) {
      assertPicture(image, name);
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
        const both = await bilateral(image, name);
        return both ?? absent();
      }
      const mask = await askRegion(image, name);
      if (!mask) return absent();
      return mask;
    },

    async subject({ image }) {
      assertPicture(image, "the whole subject");
      const json = await post(apiKey, BIREFNET, {
        image_url: dataUri(image), mask_only: true, model: "Matting", output_format: "png",
      }, signal);
      const url = json?.mask_image?.url ?? json?.image?.url;
      if (!url) throw new MaskError("the matting model returned no mask");
      return fetchMask(url, signal);
    },

    async landmark({ image, name }) {
      assertPicture(image, name);
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
