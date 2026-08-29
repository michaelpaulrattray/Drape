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
import { catalogueSlots } from "./referenceSlotCatalogue";
import { throughCensus } from "./callCensus";
import { throughFalGate } from "./falConcurrency";
import { REGION_CARDS, REGION_CARD_ENTRIES, type AskedAs, type RegionCard } from "./regionCards";
import { MaskError, unionMasks } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import type { RegionReader, SideRegions } from "./maskedRefine";

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

/**
 * EVERY CALL THIS READER MAKES GOES THROUGH THE GATE (fable-505/506).
 *
 * One place, because the account's twenty-concurrent ceiling is one ceiling: a
 * scan asks eleven questions at once and each bilateral one becomes two more,
 * so an ungated reader spends the whole allowance on one panel and the next
 * panel gets nothing. The measurement, and what the provider said, are in
 * `falConcurrency.ts`.
 */
async function post(apiKey: string, endpoint: string, body: unknown, signal?: AbortSignal): Promise<any> {
  /*
    AND EVERY ONE OF THEM IS COUNTED (the call census).

    Inside the gate rather than around it, deliberately: the segmenter is the
    call this product makes most — a scan asks eleven questions, a bilateral
    refine asks seven — so if the census measured the WAIT for a gate slot as
    the model's latency, the cost program's first table would blame the
    provider for our own queueing. `wallMs` on the census is where the waiting
    belongs, and it is already there.
  */
  return throughFalGate(async () => throughCensus(
    { stage: "segment", provider: "fal", model: endpoint, ...aboutOf(body) },
    async () => {
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
      /* 429 is the account's own concurrency ceiling and 5xx is the provider
         having a moment — both are weather, and the scan's cache reads this to
         decide whether a damaged reading is worth keeping. */
      throw new MaskError(
        `${endpoint}: ${response.status} ${(await response.text()).slice(0, 200)}`,
        { retryable: response.status === 429 || response.status >= 500 },
      );
    }
    return response.json();
    },
  ));
}

/**
 * WHAT THIS CALL WAS ABOUT, when that is a fixed word rather than a customer's
 * sentence.
 *
 * The region names come from the closed vocabulary — "left eye", "face skin" —
 * so recording them costs nobody their privacy and it is the difference between
 * "eleven segment calls" and "eleven segment calls, six of them about eyes".
 * Anything that is not a plain string is left out rather than stringified: a
 * telemetry field is not a place to discover what a payload contains.
 */
function aboutOf(body: unknown): { about?: string } {
  const prompt = (body as { text_input?: unknown; prompt?: unknown } | null)?.text_input
    ?? (body as { prompt?: unknown } | null)?.prompt;
  return typeof prompt === "string" && prompt.length <= 60 ? { about: prompt } : {};
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
        throw new MaskError(`the mask store answered ${response.status}`, {
          retryable: response.status === 429 || response.status >= 500,
        });
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
  /* Every attempt at fetching the drawn mask failed: transport, and the next
     look may well get it. */
  throw new MaskError(`the mask could not be fetched — ${last}`, { retryable: true });
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

  AND THE ANATOMY HALF DERIVES TOO, since 2026-08-15 — because it drifted the
  first time a new pair arrived. The founder ruled horns bilateral ("left and
  right bounding boxes and edits should apply to things like horns"); the
  catalogue declared `perSide`; every layer above followed the declaration; and
  this hand-written list did not, so `regionSides` answered `null` and the scan
  filed `horns:--` on a frame with two plainly visible horns. Three names typed
  once were exactly as wrong as the accessory list they replaced.

  The catalogue's `frame: "ownSide"` IS the fact ("this slot is read one half at
  a time"), so the set is that column now: a kind declares its shape on its card
  and the reader follows, with nothing to remember.

  This is D-238's class (a bilateral region answered as a single instance) and
  its sweep did not reach here: it cleared `landmark()` and `bornWornDetector`,
  both of which are anatomy. Cost is the same one extra call per bilateral
  region, now also paid on earrings — flagged to the latency-and-cost program.
*/
/**
 * HER AXIS, PER FACE — the one approximation this reader is allowed, declared.
 *
 * Keyed by whatever the caller calls a face (a candidate's public id), and held
 * at module scope on purpose: the point is that the SECOND frame of the same
 * face does not pay for the read the first one already made, and readers are
 * built per call site.
 *
 * Bounded, because a process lives longer than a session. Oldest out first, and
 * a hundred faces is far more than any one process works on before the axis is
 * cheap again.
 */
const AXIS_BY_FACE = new Map<string, Promise<number | null>>();
const AXIS_FACES_KEPT = 100;

function rememberAxis(key: string, axis: Promise<number | null>): void {
  AXIS_BY_FACE.set(key, axis);
  while (AXIS_BY_FACE.size > AXIS_FACES_KEPT) {
    const oldest = AXIS_BY_FACE.keys().next().value;
    if (oldest === undefined) break;
    AXIS_BY_FACE.delete(oldest);
  }
}

const BILATERAL = new Set(
  catalogueSlots()
    .filter((definition) => definition.frame === "ownSide" && definition.question !== null)
    .map((definition) => definition.question as string),
);

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

/**
 * THE WORDS SENT, WHICH ARE NOT THE REGION'S NAME (fable-492 §2a).
 *
 * A region's name is a KEY: catalogues, courts, floors, neighbour lists and
 * library rows are all keyed on it, and a spelling change there is an edit in
 * nine files and a silent mismatch in the tenth. What the segmenter is ASKED is
 * a different thing — a phrasing, chosen by measurement, and this is the one
 * place a phrasing is allowed to differ from its key.
 *
 * `lips` earned an entry. Bare, it answers NOTHING on an open mouth, which is
 * how a smiling woman came to have no lips at all. Measured over five frames
 * and four phrasings, house money (`bench-lips-phrasing-disposable`, the figure
 * is the share of the frame the mask covers):
 *
 * ```
 *                       lips      her lips   his lips   the lips
 * woman, OPEN mouth     0.0000%   0.0944%    0.1022%    0.2342%
 * woman, closed         0.1500%   0.1459%    0.1470%    0.1507%
 * woman (warm)          0.2178%   0.2151%    0.2165%    0.2184%
 * woman (fixture)       0.1993%   0.1965%    0.1963%    0.1992%
 * MAN, closed mouth     0.1878%   0.0000%    0.1870%    0.1900%
 * ```
 *
 * "her lips" answers nothing at all on a man — a gendered phrasing carries a
 * gendered failure, and this product casts men. "The lips" answers on 5 of 5
 * and reads highest of the four on the one frame that was failing. So the
 * genderless phrasing wins, and it wins on the numbers rather than on taste.
 */
export function askedAs(name: string): string {
  const card: RegionCard | undefined = (REGION_CARDS as Record<string, RegionCard>)[name];
  return card?.askedAs?.words ?? name;
}

/** Every region whose wire words were chosen by measurement — for the report. */
export function measuredPhrasings(): Array<{ region: string } & AskedAs> {
  return REGION_CARD_ENTRIES
    .filter(([, card]) => card.askedAs !== undefined)
    .map(([region, card]) => ({ region, ...(card.askedAs as AskedAs) }));
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
  /*
    SEND THE ADDRESS INSTEAD OF THE PICTURE — but only once it is PROVEN to be
    the same picture (fable-358 §3).

    Every call here base64s the frame into its own request body, so one panel
    scan uploads ~38 MB of the same 2.3 MB master: twelve questions about one
    photograph, each carrying its own copy. fal takes a URL for `image_url` and
    our frames already live at one, so the six whole-frame calls of a scan can
    upload nothing at all.

    **The trap is the one this program keeps paying for**: geometry computed
    against one image while the segmenter looked at another. Every mask below is
    measured in the passed buffer's pixel space, so a URL that is not those
    exact bytes would put a correct-looking mask in the wrong space — the
    wrong-frame class, arriving silently.

    So the URL is not trusted, it is CHECKED: fetched once per reader, hashed,
    and compared with the bytes in hand. Match, and every whole-frame call after
    it sends the address. Mismatch or an unreachable URL, and it says so and
    uploads — one download replaces six uploads on the happy path, and the
    unhappy path is exactly today's behaviour.

    A HALF-frame never gets an address: it is a derived picture that exists only
    in memory and has no URL to be identical to.
  */
  const referenced = new Map<string, Promise<string | null>>();
  const addressIfIdentical = (image: Buffer, url: string): Promise<string | null> => {
    const already = referenced.get(url);
    if (already) return already;
    const asked = (async () => {
      try {
        const response = await fetch(url, { signal: signal ?? AbortSignal.timeout(MASK_FETCH_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`the frame store answered ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const { createHash } = await import("node:crypto");
        const digest = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
        const theirs = digest(bytes);
        const ours = digest(image);
        if (theirs !== ours) {
          log.warn(
            { url, theirs: theirs.slice(0, 12), ours: ours.slice(0, 12) },
            "[falRegionReader] the frame at that address is not the frame in hand — uploading instead",
          );
          return null;
        }
        return url;
      } catch (error) {
        log.warn(
          { url, err: error instanceof Error ? error.message : String(error) },
          "[falRegionReader] could not confirm the frame at that address — uploading instead",
        );
        return null;
      }
    })();
    referenced.set(url, asked);
    return asked;
  };

  const askRegion = async (
    image: Buffer,
    prompt: string,
    keep: "first" | "all" = "first",
    imageUrl?: string,
  ): Promise<Mask | null> => {
    const address = imageUrl ? await addressIfIdentical(image, imageUrl) : null;
    const json = await post(apiKey, SAM3, {
      image_url: address ?? dataUri(image), prompt: askedAs(prompt), include_scores: true,
      output_format: "png",
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

  /** A frame-sized mask holding nothing — the shape of "there is none of this
   *  here", sized once so no caller has to compute it a second time. */
  const emptyLike = async (image: Buffer, name: string): Promise<Mask> => {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(image).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) throw new MaskError(`cannot size an empty ${name} mask for this image`);
    return { data: Buffer.alloc(width * height, 0), width, height };
  };

  /**
   * HER VERTICAL AXIS — one face read per picture, however many pairs are asked
   * about it.
   *
   * A frame has ONE midline. Every bilateral region was buying its own face read
   * to find it, and the scan proved what that costs on a real face: three
   * bilateral reads on one frame printed `midline: 513 · 513 · 513`, three
   * identical questions about one photograph — three round trips and $0.015 on
   * every panel, for an answer that cannot differ.
   *
   * It holds the PROMISE rather than the axis, and that is the load-bearing
   * half: the scan asks its regions in PARALLEL, so three memos storing settled
   * values would all miss and all pay. The first caller starts the read and the
   * other two join it.
   *
   * Keyed on the buffer itself, which is exact rather than clever — the same
   * picture is the same object here (one reader is built per frame), and a
   * genuinely different picture is a different object, so a stale axis cannot
   * cross frames. The cost of a miss is one face read, which is today's price.
   */
  const axes = new Map<Buffer, Promise<number | null>>();
  const axisOf = (image: Buffer, imageUrl?: string, axisKey?: string): Promise<number | null> => {
    /*
      AND ONCE PER FACE, when the caller says whose face it is (fable-603 §3).

      A repaint reproduces the same pose and framing by construction, so her
      axis barely moves between a master and its renders: measured across a
      candidate's whole chain, **0.3px in 1024** (0.1px on the founder's own
      cast), against a face read that is 13.7s of the ~23 a bilateral region
      takes. The cut it decides is a half-frame split and no feature is a third
      of a pixel wide.

      It is an approximation and it is declared: a cached axis is a claim about
      a frame it was not read from. Without a key nothing changes — every frame
      reads its own.
    */
    const shared = axisKey === undefined ? null : AXIS_BY_FACE.get(axisKey);
    if (shared) return shared;
    const held = axes.get(image);
    if (held) return held;
    const asked = (async () => {
      const face = await askRegion(image, "face", "all", imageUrl);
      return face ? centroidX(face) : null;
    })();
    axes.set(image, asked);
    if (axisKey !== undefined) rememberAxis(axisKey, asked);
    /* A failed read is not remembered: the next pair asks again rather than
       inheriting one bad minute for the life of this reader. */
    asked.catch(() => {
      axes.delete(image);
      if (axisKey !== undefined) AXIS_BY_FACE.delete(axisKey);
    });
    return asked;
  };

  /**
   * THE TWO HALVES, KEPT APART — one side to a picture. See `BILATERAL` for the
   * measurement that made this the method.
   *
   * Returned in IMAGE order, because that is the only thing this function
   * actually knows: it cut the frame at an x and asked each piece. Which of them
   * is HER left is a fact about anatomy, and it is applied once, in
   * `regionSides`, rather than here.
   *
   * `null` for a side that held nothing — a real reading of a real picture, and
   * therefore fit to reach `absentIsAnswer`. One side answering alone is also a
   * real answer: a head turned away genuinely has one visible ear. `null` for the
   * WHOLE result means there was no split to make.
   */
  const bilateralHalves = async (
    image: Buffer, name: string, imageUrl?: string, axisKey?: string,
  ): Promise<{
    atImageLeft: Mask | null;
    atImageRight: Mask | null;
  } | null> => {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(image).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) throw new MaskError(`cannot read a ${name} on an image with no size`);
    const noun = singularOf(name);
    /* A picture one pixel wide has no two sides to cut between. */
    if (width < 2) return null;

    const axis = await axisOf(image, imageUrl, axisKey);
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

    log.debug(
      {
        name,
        noun,
        sides: sides.filter((mask) => mask !== null).length,
        midline,
        byFace: axis !== null,
      },
      "[falRegionReader] bilateral read, one side to a picture",
    );
    return { atImageLeft: sides[0], atImageRight: sides[1] };
  };

  /**
   * The same two halves, unioned — what a caller asking about the whole frame
   * means by "her ears".
   *
   * The union is DERIVED from the split rather than read separately, which is
   * what makes `regionSides` cost nothing: both answers come out of one set of
   * calls, and there is exactly one midline in the system.
   */
  const bilateral = async (
    image: Buffer, name: string, imageUrl?: string, axisKey?: string,
  ): Promise<Mask | null> => {
    const halves = await bilateralHalves(image, name, imageUrl, axisKey);
    if (halves === null) return askRegion(image, singularOf(name), "all", imageUrl);
    const found = [halves.atImageLeft, halves.atImageRight].filter((mask): mask is Mask => mask !== null);
    if (found.length === 0) return null;
    return found.length === 1 ? found[0] : unionMasks(...found);
  };

  return {
    async region({ image, name, absentIsAnswer, imageUrl, axisKey }) {
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
      /*
        ⚠ AND A NON-EMPTY ANSWER MEANS TWO DIFFERENT THINGS TOO — the feature,
        or THE NEAREST THING IN THE PICTURE THAT LOOKS LIKE THE WORD. This half
        was missing from this module, and it is the half `absentIsAnswer`
        cannot survive (#246, measured 2026-08-30).

        The `eyebrow` union above is the direction this file already records at
        length: a feature that IS there read as zero, which with
        `absentIsAnswer` becomes a confident *"she has no eyebrows"*. The
        mirror is worse and was written down nowhere:

            frame                          asked     px      where the mask sat
            an oni with NO tusks, horns   `tusks`   7,455    17%–23% of height
              plainly in frame                               — THE HORNS
            the same species WITH tusks   `tusks`   2,123    35%–38% — the mouth

        Stable on re-read (7455 twice, 2123 twice): a settled wrong answer, not
        noise. **It fails UPWARD** — the arm where the feature was ABSENT scored
        three to four times the arm where it was PRESENT — and that is the
        dangerous direction, because a false negative reads as a null result and
        gets treated with suspicion while a false positive reads as a finding
        and gets written down.

        So `absentIsAnswer` does what its callers believe ONLY for a word with
        no lookalike in frame. A caller whose question can be asked of a picture
        that does not contain the answer cannot read "some pixels" as
        "it is there": that reading needs a second, differently-anchored
        question, or a bound on WHERE the answer is allowed to sit.

        **A positive control does not catch this**, which is why it survived a
        court that had one — the reader really can find the thing when it is
        there. What catches it is painting the mask back onto the frame and
        looking at the band (`scripts/_shift104-where-disposable.mts`), and it
        takes thirty seconds. Confirmed to reach the product path through the
        real `reMintCarriedGeometry` with both controls holding
        (`docs/specs/ABSENT_FEATURE_SUBSTITUTION_AUDIT_2026-08-30.md`).
      */
      const absent = async (): Promise<Mask> => {
        if (!absentIsAnswer) throw new MaskError(`the segmenter found no ${name} to edit`);
        log.debug({ name }, "[falRegionReader] nothing there, and nothing there is the answer");
        return emptyLike(image, name);
      };

      if (BILATERAL.has(name)) {
        const both = await bilateral(image, name, imageUrl, axisKey);
        return both ?? absent();
      }
      const mask = await askRegion(image, name, "first", imageUrl);
      if (!mask) return absent();
      return mask;
    },

    /**
     * THE SAME READ, WITH THE TWO SIDES STILL APART.
     *
     * `region` has always performed this split and then thrown it away, and the
     * union is the only reason a per-side crop could not be cut: `earring@left`
     * taken from a mask of both hoops is a picture of two things under the name
     * of one, and it scores 100% against the very union it came from. So the
     * sides are handed back instead of merged, and the caller that wants the
     * whole region unions them (`bilateral` above, which is what `region` uses).
     *
     * # `null` is a capability answer, not a reading
     *
     * A name this reader does not read two-sidedly — a nose, a mouth, a
     * hairstyle — has no sides to give, and neither does a frame too narrow to
     * cut. `null` says exactly that, **before any call is spent**, and the
     * caller falls back to `region`. It never means "there is none of this
     * here": that answer is two empty masks, and only when the caller has said
     * absence is an answer.
     *
     * # `left` IS HER LEFT
     *
     * The halves come back in image order and are relabelled here, once. The
     * product's laterality is the subject's own throughout — `canthalTilt`
     * reads the smaller x as her RIGHT eye, the panel says "her left earring",
     * and the R7 server-authority ruling is that left and right always mean the
     * subject's anatomy and never the viewer's side of the image.
     *
     * **What that assumes, stated rather than buried: that she is facing the
     * camera.** On a frame shot from behind, or one somebody mirrored, the
     * labels are swapped, and nothing in a segmentation call can tell. It is
     * the same assumption the tilt reader has always made, and it is the reason
     * the mapping lives in one function instead of at four call sites.
     */
    async regionSides({ image, name, absentIsAnswer, imageUrl, axisKey, declaredTwoSided }): Promise<SideRegions | null> {
      assertPicture(image, name);
      /*
        THE CLOSED LIST IS THIS READER'S OWN KNOWLEDGE, AND IT IS NOT THE ONLY
        WAY A NAME BECOMES TWO-SIDED (the D1 wire, fable-1001).

        `BILATERAL` is the vocabulary this reader was built knowing about, and
        refusing everything outside it is what keeps a nose from being split down
        the middle on a guess. An open kind is outside it by construction —
        nobody catalogued the word — so without the caller's flag the distributed
        road could never read a side at all.

        The flag is a CLASSIFIER'S ANSWER arriving, not a caller's opinion: the
        locality read (kp-2) is controlled on three kinds that disagree with each
        other, and only `distributed` sets it. The split itself is identical
        either way — same midline, same halves, same question — so nothing about
        HOW the answer is produced changes with it.
      */
      if (!BILATERAL.has(name) && declaredTwoSided !== true) return null;
      const halves = await bilateralHalves(image, name, imageUrl, axisKey);
      if (halves === null) return null;

      if (halves.atImageLeft === null && halves.atImageRight === null) {
        if (!absentIsAnswer) throw new MaskError(`the segmenter found no ${name} to edit`);
        log.debug({ name }, "[falRegionReader] neither side wears one, and that is the answer");
        return { left: await emptyLike(image, name), right: await emptyLike(image, name) };
      }
      /* Allocated per side rather than shared: two names for one buffer is an
         alias waiting for the first caller that writes through it. */
      return {
        left: halves.atImageRight ?? await emptyLike(image, name),
        right: halves.atImageLeft ?? await emptyLike(image, name),
      };
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
