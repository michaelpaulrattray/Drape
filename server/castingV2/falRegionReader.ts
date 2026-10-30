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
import { classifyFalHttp, falHeaders } from "../providers/falTransport";
import { REGION_CARDS, REGION_CARD_ENTRIES, type AskedAs, type RegionCard } from "./regionCards";
import { judgeCut } from "./cutQuality";
import { MaskError, overlapWith, unionMasks } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import type { PointerBox, RegionReader, SideRegions } from "./maskedRefine";

const log = createModuleLogger("castingV2/falRegionReader");

const SAM3 = "fal-ai/sam-3/image";
const BIREFNET = "fal-ai/birefnet/v2";
const POINT = "fal-ai/moondream3-preview/point";
/**
 * THE OPEN-VOCABULARY DETECTOR — `detect`, and it is a different endpoint from
 * `point` above rather than a setting on it.
 *
 * Chosen by measurement on #2532 and the two cost the same to the millisecond
 * (3.63 s against 3.64 s median), so the choice was quality alone: a box
 * carries EXTENT where a point carries only a location, and the segmenter grows
 * the smallest plausible object around a point — one tube of a jaw brace, one
 * tooth of a row, one earring of a pair.
 */
const DETECT = "fal-ai/moondream3-preview/detect";

/**
 * HOW MANY INSTANCES ONE WHOLE-FRAME PAIR READ MAY COME BACK WITH — the
 * `pairInOneRead` road only (#2191).
 *
 * A pair is two, and the headroom above two is deliberate rather than generous:
 * a cast may genuinely wear three of a thing, and the crop road this replaces
 * would have found the extra one — a third eye sitting on the midline lands in
 * both halves, so both of today's reads see it. Four is the number #2532's arm
 * 1 measured the setting at, including the run where the elder alien's `eyes`
 * came back as four instances with the third eye as its own.
 *
 * ⚠ **The ceiling is not a filter and must not be read as one.** fal pads
 * nothing: asked for a noun that is not in the picture, the setting returned
 * NOTHING rather than junk up to this number, on 3 of 3 absent specimens —
 * which is the control the whole scan rests on, because `absentIsAnswer` reads
 * "no masks" as "it is not there".
 *
 * ⚠ **AND IT HAS NEVER BEEN MEASURED TO BIND — #2811, 2026-10-30, and that is
 * a reading rather than a reassurance.** The worry the card raised is real as
 * a sentence about the code: a creature with six eyes, or three horns a side,
 * would keep at most four of them. Driven on four cells at two sizes — a
 * three-eyed alien's `eyes` and `ear`, and both creatures' `all the teeth`,
 * which is the many-instance question this product has — the same request was
 * sent with `max_masks` at **4, 8 and 16**, and the answer was IDENTICAL every
 * time: 3, 2, 2 and 4 masks, same pixel counts to the digit. **The instance
 * count is set by the picture, not by this number**, and in the one cell that
 * reached four (`all the teeth` on the horned creature, both sizes) raising
 * the ceiling four-fold bought no fifth instance.
 *
 * So it is NOT raised: a ceiling nothing has been measured to touch is not
 * evidence for a different ceiling either. **What is genuinely unmeasured is
 * stated rather than implied** — no cast with more than four of one feature
 * exists in the fixture set, so what the model would offer for six eyes is not
 * known, and the day one is cast this is the first thing to re-drive.
 *
 * ⚠ **THAT DAY CAME ON 2026-10-30 (#2833, his eye round 9), AND IT BOUND ON THE
 * WHOLE-FRAME READ, NOT ON A SIDE.** A cast with climbers, a drop and a hoop in
 * each ear, asked `earring` of the whole picture: **exactly 4 answers every
 * time, the same to the pixel, three draws** — and the same request at 8
 * returned **7**: the cast's left lobe hoop, a tighter outline of it, and a
 * climber at the top of the other ear. His panel showed what four means there:
 * three answers on one ear and ONE on the other, whose lobe hoop was the fifth.
 * The anatomy pairs on the same frame (`eyes`, `eyebrows`, `ears`, `horns`) gave
 * the same count and the same pixels at 4 and at 8, as #2811's four cells did.
 *
 * **So this number is still right, and it is right PER SIDE.** It is what each
 * half-picture of the crop road asks, and what the detector's other-ear look
 * keeps on one side. The whole-frame read asks for both sides in one request,
 * so it carries both sides' allowance — {@link PAIR_ROAD_MAX_MASKS}.
 */
const PAIR_MAX_MASKS = 4;

/**
 * WHAT ONE WHOLE-FRAME READ OF A PAIR MAY COME BACK WITH — both sides'
 * allowance, because it is one request standing in for two (#2833).
 *
 * Derived, not tuned: the crop road this road replaced asked each half for
 * {@link PAIR_MAX_MASKS}, so one request for both halves at that same number
 * gave each ear half the headroom it had before the road was built. Measured
 * where it binds rather than assumed: on #2833's cast the read at 4 is cut off
 * and the read at 8 returns 7, so this ceiling is above what the picture holds.
 * It costs no request — the answers come back from the one call either way —
 * only the extra masks' downloads. Every answer is still unioned and cut at the
 * midline exactly as before.
 */
const PAIR_ROAD_MAX_MASKS = PAIR_MAX_MASKS * 2;

/*
  fal keeps generated objects for seven days by default; a mask we use once and
  discard has no business outliving the request — and since #2334 fal keeps no
  copy of the request or its answer either. Both are asked for on the outgoing
  call, through the transport's own `falHeaders`, rather than a second copy of
  them here: this reader carried its own copy of the lifetime header, and a
  copy is where the next header would have been forgotten (law 4).
*/

/**
 * EVERY CALL THIS READER MAKES GOES THROUGH THE GATE (fable-505/506).
 *
 * One place, because the account's twenty-concurrent ceiling is one ceiling: a
 * scan asks eleven questions at once and each bilateral one becomes two more,
 * so an ungated reader spends the whole allowance on one panel and the next
 * panel gets nothing. The measurement, and what the provider said, are in
 * `falConcurrency.ts`.
 */
async function post(
  apiKey: string,
  endpoint: string,
  body: unknown,
  signal: AbortSignal | undefined,
  label: CensusLabel,
): Promise<any> {
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
    {
      stage: "segment",
      provider: "fal",
      model: endpoint,
      ...(label === "theClosedVocabularyPrompt" ? aboutOf(body) : { about: label.road }),
    },
    async () => {
    const response = await fetch(`https://fal.run/${endpoint}`, {
      method: "POST",
      headers: falHeaders(apiKey),
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      /* The body is read ONCE into a const, because it is now wanted twice —
         for the message and for the classifier — and `response.text()` on a
         consumed body answers with the empty string rather than throwing, so
         reading it twice would have classified every failure against "". */
      const body = await response.text();
      /* 429 is the account's own concurrency ceiling and 5xx is the provider
         having a moment — both are weather, and the scan's cache reads this to
         decide whether a damaged reading is worth keeping. */
      throw new MaskError(
        `${endpoint}: ${response.status} ${body.slice(0, 200)}`,
        {
          retryable: response.status === 429 || response.status >= 500,
          /*
            OUR ACCOUNT, NOT THE PICTURE (#2688) — asked of the product's own
            fal classifier rather than re-deciding here what a 401 means.

            `classifyFalHttp` is the one reader of a fal status in this product
            and it is already exported; a second `status === 401 || …` here is
            the mirror working law 4 is about, and it would be the copy that
            got forgotten the day fal starts answering 402 for an exhausted
            balance (it is the one status the other two classifiers in the
            product treat as an account failure and this one does not).

            The two cutters read this to choose a sentence; nothing else does,
            and `retryable` above is untouched — so every existing caller, the
            face scan's weather cache included, behaves exactly as before.
          */
          accountRefused: classifyFalHttp(response.status, body) === "provider_account",
        },
      );
    }
    return response.json();
    },
  ));
}

/**
 * THE POINTER ROAD'S TWO CALLS, NAMED BY THE ROAD THEY ARE ON (#2566, the
 * relay's note on PR #2692).
 *
 * Exported because the census reader and the suite both name them, and a string
 * literal in each would be the mirror working law 4 is about.
 *
 * `detect` and `box` are kept APART rather than summed under one `pointer`
 * label, because they are the two halves of the relay's own question and they
 * scale differently: one `detect` per off-list name, then up to `count` box
 * calls for each name that answered. A single label would hide exactly the
 * multiplier the note was written about.
 */
export const POINTER_DETECT_ABOUT = "pointer.detect";
export const POINTER_BOX_ABOUT = "pointer.box";

/**
 * HOW A CALL IS LABELLED IN THE CALL CENSUS — decided at the CALL SITE and
 * never inferred from the body. Required, so a new road cannot forget to.
 *
 * # Why it is a parameter rather than a rule about bodies
 *
 * It used to be inferred: `aboutOf(body)` read the outgoing `prompt` and made
 * it the label, justified — in the docblock below, in these words — on the
 * ground that *"the region names come from the closed vocabulary"*. That was
 * true of every road this reader had.
 *
 * ⚠ **SLICE 2 MADE IT FALSE AND NOTHING SAID SO.** The pointer road's detector
 * call sends the DISCOVERY READING'S OWN NOUN as its prompt — open vocabulary,
 * the customer's cast described in whatever words the reading chose — so
 * `about` began carrying prose like *"small mole on left cheek near nose"* into
 * the census, which the scan logs in full (`byAbout`, `[faceScanService]
 * scanned a face-version`). The field's own contract is *"a fixed word rather
 * than a customer's sentence"*, and the only thing holding it was a sentence in
 * a comment one road away from the caller that broke it.
 *
 * ⚠ **AND IT LEAKED SELECTIVELY, WHICH IS WORSE FOR THE MEASUREMENT THAN A
 * CLEAN LEAK**: `aboutOf` caps at 60 characters, so a short noun was recorded
 * and a long one silently was not — *"small mole on left cheek near nose"* (33)
 * landed and *"mechanical/metallic jaw brackets with tube-like extensions along
 * cheeks and chin"* (76) did not. One road, two behaviours, decided by the
 * length of a word a model happened to pick.
 *
 * Making this a required argument is the CLASS fix rather than the instance
 * one: the next road that sends an open-vocabulary prompt has to say what its
 * calls are called, and cannot inherit a justification written for the
 * catalogue.
 */
type CensusLabel =
  /**
   * The outgoing prompt IS a closed-vocabulary region word, so it labels the
   * call — `aboutOf` below, unchanged. A body with no string prompt at all
   * (the matting road) lands here too and stays deliberately unlabelled: it
   * contributes to `byStage` and `byModel` and opens no `byAbout` row, exactly
   * as it did before this type existed, so no figure anybody has already read
   * moves under them.
   */
  | "theClosedVocabularyPrompt"
  /** This call has no closed-vocabulary word to be named by — the road names
   *  it instead, as a fixed string that is the same on every cast. */
  | { road: string };

/**
 * WHAT THIS CALL WAS ABOUT, when that is a fixed word rather than a customer's
 * sentence.
 *
 * The region names come from the closed vocabulary — "left eye", "face skin" —
 * so recording them costs nobody their privacy and it is the difference between
 * "eleven segment calls" and "eleven segment calls, six of them about eyes".
 * Anything that is not a plain string is left out rather than stringified: a
 * telemetry field is not a place to discover what a payload contains.
 *
 * ⚠ **THAT FIRST SENTENCE IS NOW GUARANTEED BY {@link CensusLabel} AND NOT BY
 * THIS COMMENT.** It was a comment alone for as long as every road sent a
 * catalogue word, and slice 2's pointer road broke it without touching this
 * file. Only a caller that says `"theClosedVocabularyPrompt"` reaches here, so
 * the vocabulary claim is a property of the call sites rather than a hope about
 * them.
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
/* The face's whole SPAN is held, not only its axis (#2844): the face rule
   judges a feature by the face's extent, and a keyed hit that held the axis
   alone would have bought a second face read to find the box the first read
   already measured. Same mask, same approximation, declared above. */
const AXIS_BY_FACE = new Map<string, Promise<FaceSpan | null>>();
const AXIS_FACES_KEPT = 100;

function rememberAxis(key: string, axis: Promise<FaceSpan | null>): void {
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

/**
 * THE REGIONS THAT ARE SEVERAL SEPARATE THINGS, asked for every instance and
 * answered as their union (#2810) — read off the catalogue's own `several`,
 * never a list here, the way {@link BILATERAL} reads `frame`.
 *
 * The region a scan asks for a slot is its question, or its display region when
 * it has no question (`scanPlan`), so both are read.
 */
const SEVERAL = new Set(
  catalogueSlots()
    .filter((definition) => definition.several !== undefined)
    .map((definition) => definition.question ?? definition.display)
    .filter((region): region is string => typeof region === "string" && region.length > 0),
);

/**
 * THE PAIRS THAT ARE PART OF THE FACE, judged by the face's extent (#2844) —
 * read off the catalogue's own `group`, never a list here, the way
 * {@link BILATERAL} reads `frame`. Today that is `eyes`, `eyebrows` and `ear`;
 * an earring (accessories) and horns (hair) are not, by the catalogue's word.
 */
const FACE_FEATURES = new Set(
  catalogueSlots()
    .filter((definition) => definition.frame === "ownSide" && definition.question !== null && definition.group === "face")
    .map((definition) => definition.question as string),
);

/** The noun ONE SIDE of a bilateral region is asked by. Exported since #2802
 *  so a suite asserting WHICH question the second look asked reads it here
 *  rather than keeping a copy of the mapping (working law 4). */
export function singularOf(name: string): string {
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
 * THE FACE ACROSS — its midline and its two sides, from the one face read the
 * pairs already make (#2781). Same pixel space as {@link centroidX}, because it
 * is the same mask: the axis the frame is cut on and the sides an ear sits at
 * cannot disagree about where the face is.
 */
type FaceSpan = {
  axis: number; left: number; right: number;
  /* And the face DOWN (#2844) — the same mask's top, bottom and middle row,
     read in the same pass, so the face's height costs no request either. */
  top: number; bottom: number; middle: number;
};

function spanOf(mask: Mask): FaceSpan | null {
  const axis = centroidX(mask);
  if (axis === null) return null;
  let left = mask.width;
  let right = -1;
  let top = mask.height;
  let bottom = -1;
  let rows = 0;
  let pixels = 0;
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[row + x] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      rows += y;
      pixels += 1;
    }
  }
  return { axis, left, right, top, bottom, middle: rows / pixels };
}

/** One connected piece of a side's answer that was not kept, for the log. */
export type DroppedPiece = { pixels: number; centreX: number };

/**
 * IS A THING CENTRED HERE WHERE THAT SIDE'S EAR IS (#2781's rule, one place).
 *
 * At least as near that side of the face as its middle. A tie is kept: the
 * answer that cannot take a real earring away. Read by
 * {@link keepPiecesAtTheSide} for a piece of a segmenter's answer and by the
 * other-ear look below for a detector's rectangle (#2800), so the two cannot
 * disagree about where an ear is.
 */
function atTheSide(
  centreX: number,
  side: "imageLeft" | "imageRight",
  face: { midline: number; left: number; right: number },
): boolean {
  const edge = side === "imageLeft" ? face.left : face.right;
  return Math.abs(centreX - face.midline) >= Math.abs(centreX - edge);
}

/**
 * ONLY THE PIECES THAT ARE WHERE AN EAR IS — one side of an ear-worn pair
 * (#2781, his eye round 3: *"the earring boxes are massive?"*).
 *
 * # What his panel showed, and what the segmenter actually answered
 *
 * Asked `earring` of his cast, SAM 3 answered THREE masks at the same score
 * (0.58, 0.54, 0.54): a hoop on each ear, and **the septum ring**. A ring on
 * the face's midline is cut in two by the split every pair is read through,
 * and each half joins its side's real earring — so each side's rectangle ran
 * from the ear to the nose and the two met above the ring. Read on his
 * screenshot crop through this reader's own road (pair road: the cast's right side
 * x240–362 against his panel's 241–369, the same rectangle), and on the crop
 * road it is worse: each half-frame answered the ring's half and NOT the ear.
 *
 * # The rule, and why it is not a tuned number
 *
 * An earring hangs from an ear, and an ear is at the SIDE of the face. So a
 * connected piece of one side's answer is kept when its centre is at least as
 * near that side of the face as it is to the face's midline, and dropped when
 * it is nearer the middle. "Nearer" is the whole rule — the halfway point
 * between two places the face read already gives — and the measurement says
 * how far the real pieces sit from it:
 *
 *     his cast    hoops       |side| 8 and 12 px against |middle| 124 and 141
 *                 septum ring |middle| 13 against |side| 103
 *     cast 2456   two dangles and a stud on one ear: |side| 33–51 against
 *                 |middle| 140–154 — all three kept, the stud and the dangle
 *                 on one ear staying TWO (#2565 §6)
 *     cast 2472   the ears themselves: |side| 39–42 against |middle| 138–142
 *
 * ⚠ **Why not "the part inside the face mask"**: on cast 2472 SAM 3's `face`
 * mask holds 92–93% of each EAR, so a rule keyed on the mask's inside would
 * have thrown away every earring on a face whose read includes its ears. The
 * mask's EXTENT is the robust half of it.
 *
 * ⚠ **What it cannot judge, declared**: a face read that came back as one
 * fragment on one side gives that side an edge AT the midline, and then every
 * piece there is nearer its side — so the rule falls open to today's answer
 * rather than taking a real earring off the panel. And a thing worn near the
 * ear that is not an earring (a cheek stud by the tragus) is not this rule's
 * to catch.
 *
 * Returns the same mask object when nothing was dropped, and `null` for
 * `kept` when nothing is left — the reading's own "this side holds nothing".
 */
export function keepPiecesAtTheSide(
  mask: Mask,
  side: "imageLeft" | "imageRight",
  face: { midline: number; left: number; right: number },
): { kept: Mask | null; dropped: DroppedPiece[] } {
  const { kept, dropped } = keepPiecesWhere(mask, (piece) => atTheSide(piece.centreX, side, face));
  return { kept, dropped: dropped.map(({ pixels, centreX }) => ({ pixels, centreX })) };
}

/** One connected piece of an answer that was not kept, with where it sat down
 *  as well as across — the face rule judges both. */
export type DroppedFacePiece = { pixels: number; centreX: number; centreY: number };

/**
 * IS A THING CENTRED HERE ON THE FACE (#2844) — no farther outside the face
 * read's extent, on either axis, than that axis's middle is inside it.
 *
 * Read across, that is {@link atTheSide}'s own construction turned outward: a
 * piece beyond the face's edge is still the face's when it is no farther past
 * that edge than the edge is from the face's middle. Read down, the same
 * sentence with the face's top, bottom and middle row. A tie is kept, for
 * `atTheSide`'s reason. Both bounds come off the one face read, so nothing here
 * is tuned: the face is its own measure.
 */
function onTheFace(
  centreX: number,
  centreY: number,
  face: { midline: number; left: number; right: number; top: number; bottom: number; middle: number },
): boolean {
  const across = centreX < face.left
    ? face.left - centreX <= face.midline - face.left
    : centreX > face.right
      ? centreX - face.right <= face.right - face.midline
      : true;
  const down = centreY < face.top
    ? face.top - centreY <= face.middle - face.top
    : centreY > face.bottom
      ? centreY - face.bottom <= face.bottom - face.middle
      : true;
  return across && down;
}

/**
 * ONLY THE PIECES OF A FACE FEATURE THAT ARE ON THE FACE — an eye, a brow or
 * an ear lying away from it is not that feature (#2844, his eye round 10:
 * *"her left eye box is jacked up and not cropped"*).
 *
 * # What his panel showed, and what the segmenter actually answered
 *
 * A cast with a tattoo sleeve on each arm, and on the cast's LEFT arm, at the
 * elbow, **a tattooed woman's face with eyes**. Asked `eyes` of the whole frame
 * at 1024 wide, SAM 3 answered two masks: both real eyes as one shape
 * (5,571px), and **the tattoo's eye** (606px, x916–947 y1187–1210). The pair
 * road unions every answer and cuts at the midline, so the cast's left eye
 * came back as the real eye AND the tattoo's — x558–947 y438–1210, which is
 * his panel's rectangle to the pixel once scaled. **The crop road, which every
 * paid refine takes, kept it too**: on the image-right half `eye` answered the
 * real eye, a looser outline of it, and the tattoo's eye (430px), and #2818's
 * `"separate"` rule keeps an extra that touches nothing — so a refine that
 * touches the left eye would paint on the arm. `eyebrow` on the same half
 * answered the tattoo's brow (220px) beside the real one, kept the same way.
 *
 * # The rule, measured where the real pieces and the false ones sit
 *
 * {@link onTheFace}, applied to every connected piece of one side's answer.
 * On this frame the face read is x351–727 y317–754, its middle row y557:
 *
 *     the tattoo's eye    y1199, past the chin by 445 against 197 allowed
 *     the tattoo's brow   y1180, past the chin by 426 against 197 allowed
 *     the cast's right ear x306, past the face's edge by 45 against 155 —
 *                         SAM 3's face read does not hold that ear at all
 *
 * so "inside the face read's box" is NOT the rule: it would take a real ear
 * off, and the positive controls in the PR (three-quarter and side views, a
 * creature's eyes and ears) are where the margin is read.
 *
 * ⚠ **What it cannot judge, declared**: a lookalike ON the face (a tattooed eye
 * on a cheek) is on the face, and this rule keeps it. A face read that came
 * back as a fragment shrinks the box it judges by — the same fall-open
 * `keepPiecesAtTheSide` declares. And it is read for the catalogue's own FACE
 * pairs only ({@link FACE_FEATURES}): an earring may hang below the chin and a
 * horn grows above the brow, so neither is judged by the face's extent.
 */
export function keepPiecesOnTheFace(
  mask: Mask,
  face: { midline: number; left: number; right: number; top: number; bottom: number; middle: number },
): { kept: Mask | null; dropped: DroppedFacePiece[] } {
  return keepPiecesWhere(mask, (piece) => onTheFace(piece.centreX, piece.centreY, face));
}

/**
 * THE CONNECTED PIECES OF A MASK, EACH KEPT OR DROPPED BY ITS CENTRE — the one
 * labelling both rules above read, so the ear's rule and the face's cannot
 * disagree about what a piece is. 8-neighbour.
 *
 * Returns the same mask object when nothing was dropped, and `null` for `kept`
 * when nothing is left.
 */
function keepPiecesWhere(
  mask: Mask,
  keep: (piece: { centreX: number; centreY: number }) => boolean,
): { kept: Mask | null; dropped: DroppedFacePiece[] } {
  const { width, height, data } = mask;
  /* Labelled inside the mask's own bounds only: a side's answer is a few
     small pieces on a frame of millions of pixels, and a label buffer the size
     of the frame is tens of megabytes for nothing. */
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { kept: null, dropped: [] };
  const boxWidth = x1 - x0 + 1;
  const boxHeight = y1 - y0 + 1;
  const label = new Uint32Array(boxWidth * boxHeight);
  const pieces: { pixels: number; sumX: number; sumY: number }[] = [];
  const stack: number[] = [];
  for (let by = 0; by < boxHeight; by += 1) {
    for (let bx = 0; bx < boxWidth; bx += 1) {
      const at = by * boxWidth + bx;
      if (label[at] !== 0 || data[(by + y0) * width + bx + x0] === 0) continue;
      const id = pieces.length + 1;
      let pixels = 0;
      let sumX = 0;
      let sumY = 0;
      label[at] = id;
      stack.push(at);
      while (stack.length > 0) {
        const p = stack.pop() as number;
        const px = p % boxWidth;
        const py = (p - px) / boxWidth;
        pixels += 1;
        sumX += px + x0;
        sumY += py + y0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= boxWidth || ny >= boxHeight) continue;
            const q = ny * boxWidth + nx;
            if (label[q] !== 0 || data[(ny + y0) * width + nx + x0] === 0) continue;
            label[q] = id;
            stack.push(q);
          }
        }
      }
      pieces.push({ pixels, sumX, sumY });
    }
  }
  const drop = pieces.map(({ pixels, sumX, sumY }) => !keep({ centreX: sumX / pixels, centreY: sumY / pixels }));
  if (!drop.some(Boolean)) return { kept: mask, dropped: [] };
  const out = Buffer.from(data);
  let left = 0;
  for (let by = 0; by < boxHeight; by += 1) {
    for (let bx = 0; bx < boxWidth; bx += 1) {
      const id = label[by * boxWidth + bx]!;
      if (id === 0) continue;
      if (drop[id - 1]) out[(by + y0) * width + bx + x0] = 0;
      else left += 1;
    }
  }
  const dropped = pieces
    .filter((_, at) => drop[at])
    .map(({ pixels, sumX, sumY }) => ({
      pixels, centreX: Math.round(sumX / pixels), centreY: Math.round(sumY / pixels),
    }));
  return { kept: left === 0 ? null : { data: out, width, height }, dropped };
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
 * A FEATURE ON HER MIDLINE BELONGS TO NEITHER SIDE OF A PAIR (#2783, the
 * law-7 sibling of the earring boxes on #2781).
 *
 * # What it is for, measured rather than reasoned
 *
 * On a cast with an eye in the middle of the forehead, `splitAtMidline` cut
 * that eye in half and each half joined its side's row. Read through this very
 * reader on #2566's local copy of candidate 2472 (768x1152, no production
 * read), `eyes` on the pair road answered:
 *
 * ```
 *   her left    x 389-462, y 211-314  (74x104)  = her real eye + half the third
 *   her right   x 316-388, y 211-311  (73x101)  = her real eye + half the third
 * ```
 *
 * Each box runs from the eye up to the middle of the forehead, and the real
 * eyes alone measure 45x22 and 41x20. Broken into pieces, every side held
 * exactly two: its own eye, away from the cut, and a slice of the forehead eye
 * sitting ON the cut.
 *
 * # The rule, and why it is this one rather than "anything crossing the cut"
 *
 * **A side's biggest piece is always kept; a smaller piece is kept only when it
 * does not touch the cut.**
 *
 * The obvious rule — drop whatever crosses the midline — is the one this must
 * not be, and the counterexample is a UNIBROW: one continuous band is a real
 * pair whose own mask spans the cut, so dropping every crossing piece would
 * answer *"no eyebrows"* on a face that plainly has them, which is the exact
 * failure `BILATERAL` above was written about. Keeping the biggest piece
 * unconditionally means this can never empty a side and can never take the
 * largest thing on it: a unibrow is its side's only piece, so it survives
 * untouched, and so does a pair that merely reaches the midline.
 *
 * On the fixture it returns `x 418-462, y 293-314` and `x 316-356, y 292-311` —
 * the real eyes, at the size the card measured them.
 *
 * # Where it does NOT apply, stated rather than left to be discovered
 *
 * This is the PAIR road's geometry only, which is the face scan's road
 * (`pairInOneRead` is the scan's and the refine is on the crop road by
 * construction — see the constructor). The crop road has the same defect and
 * geometry cannot repair it: asked a half-frame at a time, the segmenter
 * answered with ONLY its half of the forehead eye and neither real eye, so
 * there is no real eye in the answer to keep. That is #2784's shape — the
 * caller has to say what it wants — and it is left to that card rather than
 * half-fixed here on a paid road with no measurement behind it.
 *
 * The forehead eye is not lost by this: the discovery reading gives it its own
 * row (`third eye`, anatomy, forehead — read in #2566's own grouping output on
 * this same candidate).
 */
function withoutPiecesOnTheCut(
  slice: { data: Buffer; width: number; height: number },
  cutColumn: number,
): { data: Buffer; width: number; height: number } {
  /* One labelling pass, 4-neighbour, with an explicit stack: a mask is up to a
     megapixel and a recursive fill on a long thin piece overflows. */
  const label = new Int32Array(slice.width * slice.height).fill(-1);
  const pixels: number[] = [];
  const onTheCut: boolean[] = [];
  const stack: number[] = [];
  for (let start = 0; start < label.length; start += 1) {
    if (label[start] !== -1 || slice.data[start] === 0) continue;
    const piece = pixels.length;
    pixels.push(0);
    onTheCut.push(false);
    label[start] = piece;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop() as number;
      const x = at % slice.width;
      pixels[piece] += 1;
      if (x === cutColumn) onTheCut[piece] = true;
      const around = [
        x > 0 ? at - 1 : -1,
        x < slice.width - 1 ? at + 1 : -1,
        at >= slice.width ? at - slice.width : -1,
        at + slice.width < label.length ? at + slice.width : -1,
      ];
      for (const next of around) {
        if (next < 0 || label[next] !== -1 || slice.data[next] === 0) continue;
        label[next] = piece;
        stack.push(next);
      }
    }
  }
  /* Nothing to decide between: one piece is its side's biggest by definition. */
  if (pixels.length < 2) return slice;
  let biggest = 0;
  for (let piece = 1; piece < pixels.length; piece += 1) {
    if (pixels[piece] > pixels[biggest]) biggest = piece;
  }
  const dropped = pixels.map((_, piece) => piece !== biggest && onTheCut[piece]);
  if (!dropped.some(Boolean)) return slice;
  const data = Buffer.from(slice.data);
  for (let at = 0; at < label.length; at += 1) {
    if (label[at] !== -1 && dropped[label[at]]) data[at] = 0;
  }
  log.debug(
    {
      pieces: pixels.length,
      droppedPieces: dropped.filter(Boolean).length,
      droppedPixels: pixels.reduce((n, px, piece) => (dropped[piece] ? n + px : n), 0),
      cutColumn,
    },
    "[falRegionReader] a piece on her midline belongs to neither side of this pair",
  );
  return { data, width: slice.width, height: slice.height };
}

/**
 * ONE WHOLE-FRAME MASK CUT INTO THE TWO SIDES IT SPANS — the `pairInOneRead`
 * road's geometry (#2191).
 *
 * # Why a cut and not "take mask 0 and mask 1"
 *
 * #2532's arm 1 measured what comes back when the pair is asked of the whole
 * frame with `return_multiple_masks`, and it is not one shape: `ear` and
 * `earring` answered as two clean per-side masks, while `eyes` and `eyebrows`
 * usually answered as ONE mask spanning the midline and covering both. Picking
 * instances apart would therefore work on two nouns and silently halve the
 * other three. ⚠ And reading a side off a mask's CENTROID is worse than
 * useless on exactly these shapes — a two-lobed brow mask centres between the
 * lobes and reads as whichever side wins by a pixel, which is the error arm 1's
 * own first run made.
 *
 * So the answer is unioned first (`keep: "all"`) and then CUT, at the same
 * midline the crop road splits the picture on. Both shapes then give the same
 * answer: two masks come apart at the cut, one spanning mask comes apart at the
 * cut, and neither case needs to be told which it is.
 *
 * # It is the crop road's own arithmetic, reused rather than restated
 *
 * The two pieces are handed to `placeInFrame` with exactly the crops
 * `bilateralHalves` would have extracted, so a side's mask comes back in the
 * frame's pixels by the same code that places a half-frame read — including the
 * resample for a provider that answers at its own resolution. The cut is taken
 * as a FRACTION of the mask's own width for that reason: a mask returned at a
 * different size than it was asked about still gets cut in the right place,
 * where a cut at the frame's pixel index would land wherever the scaling put it.
 *
 * `null` for a side that holds nothing — the same reading the crop road returns
 * for a half-frame that came back empty, and therefore fit to reach
 * `absentIsAnswer` and the half-answered-pair heal above it.
 */
async function splitAtMidline(
  whole: Mask,
  midline: number,
  width: number,
  height: number,
): Promise<{ atImageLeft: Mask | null; atImageRight: Mask | null }> {
  const crops = [{ left: 0, width: midline }, { left: midline, width: width - midline }] as const;
  const sides = await Promise.all(crops.map(async (crop) => {
    const from = Math.round((crop.left / width) * whole.width);
    const to = Math.round(((crop.left + crop.width) / width) * whole.width);
    /* A cut that leaves one side nothing to hold is a real reading of a mask
       entirely on the other side of her midline, not an error. */
    if (to <= from) return null;
    const sliceWidth = to - from;
    const data = Buffer.alloc(sliceWidth * whole.height, 0);
    for (let y = 0; y < whole.height; y += 1) {
      const row = y * whole.width;
      whole.data.copy(data, y * sliceWidth, row + from, row + to);
    }
    if (!data.some((byte) => byte !== 0)) return null;
    /* A FEATURE ON HER MIDLINE IS NEITHER SIDE'S (#2783). The cut is this
       slice's inner edge — the last column of the left half, the first of the
       right — read in the slice's own pixels, so a mask returned at another
       resolution is judged at the same place it was cut. */
    const kept = withoutPiecesOnTheCut(
      { data, width: sliceWidth, height: whole.height },
      crop.left === 0 ? sliceWidth - 1 : 0,
    );
    if (!kept.data.some((byte) => byte !== 0)) return null;
    return placeInFrame(kept, crop, width, height);
  }));
  return { atImageLeft: sides[0] ?? null, atImageRight: sides[1] ?? null };
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
  /**
   * ASK A PAIR ONCE INSTEAD OF TWICE — off unless the caller says otherwise
   * (#2191, his goal of 2026-10-10: *"our goal would be to reduce this cost by
   * as much as possible"*).
   *
   * A bilateral region costs TWO segmenter reads today, one per half-frame, and
   * #2532's arm 1 measured that one whole-frame read with
   * `return_multiple_masks` can answer both sides: **five reads off a face
   * scan's floor, about 2.5¢ a scan, 28% of the floor.** `bilateralHalves`
   * carries the road and `splitAtMidline` its geometry.
   *
   * # Why the CALLER decides and not this module
   *
   * Two things reach the pair road and only one of them is this card's: the
   * face SCAN, which buys the whole plan on every face, and a masked REFINE,
   * which buys one region and then PAINTS on the mask it gets back. A wrong
   * mask costs the scan a panel row and costs a refine a delivered picture the
   * customer paid for — so the refine is left on the crop road by construction
   * rather than by a flag somebody could widen, and this module goes on not
   * deciding what to ask (see the header).
   *
   * # And why it is off by default
   *
   * The crop road is not an accident: `BILATERAL` above records that asking a
   * pair of a whole frame once failed badly enough to deliver *"she has no
   * eyebrows"* over a frame whose brows measure 1429px, and that **the same
   * twelve features asked of a picture containing one side read 12 of 12.**
   * Arm 1's reading is 15 cells on three casts against that, which is enough to
   * build the road and not enough to move every customer onto it — so the
   * default is today's answer and the flip is his, with his eye on the panel.
   */
  pairInOneRead?: boolean;
}): RegionReader {
  const { apiKey, signal, pairInOneRead = false } = input;

  /**
   * WHICH SIGNAL ONE CALL RUNS UNDER — the reader's own, the caller's, or both
   * (#1781).
   *
   * The reader takes a signal at construction and every read has used it since;
   * `region` and `subject` now take one PER CALL as well, because the judge's
   * framing measurement has a deadline and this reader is a module-level
   * singleton shared by every view of every Sign — read at `signEngine.ts`,
   * where `judge` is cached, before this was written. **Aborting the
   * construction-time signal would cancel every other customer's read in the
   * process**, so the deadline's signal has to arrive with the call.
   *
   * Both can cancel, so neither is dropped. `AbortSignal.any` is only reached
   * when both exist, which on production is never — nothing passes a
   * construction signal today — so the common path composes nothing.
   */
  const signalFor = (perCall?: AbortSignal): AbortSignal | undefined => {
    if (perCall === undefined) return signal;
    if (signal === undefined) return perCall;
    return AbortSignal.any([signal, perCall]);
  };

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

  /**
   * THE QUESTION A SCAN ASKS TWICE, PAID FOR ONCE (#2191).
   *
   * A face scan asks SAM 3 for `face` twice on the same frame, and the cost
   * model has recorded both as facts since #2184 — *"the face asked twice: once
   * for the midline the pairs are split on, once for the head the build row is
   * cut under"*. Two of the floor's nineteen reads, on every scan, in every
   * outcome; measured at the wire again on 2026-10-15 and the prompt table says
   * `face = 2` under all three answer policies.
   *
   * They are the SAME REQUEST: same endpoint, same prompt, same bytes, same
   * address. fal bills SAM 3 per request, so the second one is half a cent for
   * an answer already in hand — and the founder's goal on this card is to cut
   * what a scan costs without the customer noticing. This is the whole of that
   * sentence: nothing the panel draws can move, because both callers still
   * apply their own `keep` to the same answer.
   *
   * # Why this prompt and no other
   *
   * ⚠ **A general memo would silently swallow the scan's deliberate re-asks.**
   * An empty anatomy read is asked once more on purpose (fable-468 ruling 1)
   * and a half-answered pair gets one more look (fable-749 §3a) — both of them
   * the same prompt on the same bytes, both of them wanted. `face` is safe
   * because **nothing in the scan's plan asks it**: the catalogue's questions
   * are `hair`, `eyes`, `face skin`, and so on, and the only two askers of the
   * bare noun are `axisOf` below and the composed head read in `faceScan.ts`,
   * neither of which ever asks twice. That is not left to prose —
   * `server/faceScanSharedFaceRead.test.ts` holds it against
   * `catalogueSlots()`, so the day a slot asks `face` the suite reddens here
   * rather than a re-ask quietly disappearing.
   *
   * # And only for a caller with no deadline of its own
   *
   * The shared-read rule this file already applies to `axes` and `referenced`:
   * a memoised promise may not carry one caller's abort into another caller's
   * await. Both of today's askers pass no per-call signal, so both share; a
   * future caller that brings a deadline asks fresh rather than having it
   * dropped. A rejection is forgotten, so the next ask re-asks rather than
   * inheriting one bad minute.
   *
   * # And the key is the PROMPT and the frame, not the frame alone
   *
   * ⚠ **Keyed on the picture alone this is a wrong-answer bug and not a saving,
   * and that was driven rather than reasoned.** Seven of the scan's questions
   * are asked of the SAME buffer — `hair`, `facial hair`, `nose`, `lips`, the
   * teeth, `face skin`, `glasses` — so a frame-only key makes whichever of them
   * asks first the answer to all the others. Measured by widening the filter to
   * every prompt: all seven vanished from the wire table and would have been
   * served the FACE mask, the floor reading a flattering 11 instead of 18. The
   * narrow filter made that unreachable, which is exactly the kind of
   * correctness that stops being true the day somebody widens one condition.
   *
   * So the pair is the key. Widening the filter can then only ever swallow a
   * deliberate re-ask — one failure mode instead of two — and that one is held
   * by `faceScanSharedFaceRead.test.ts`'s negative control.
   */
  const SHARED_PROMPT = "face";
  const sharedUrls = new Map<Buffer, Map<string, Promise<readonly string[]>>>();

  /** The POST, and the mask addresses it answered with — `keep` is the
   *  caller's business, so a shared answer cannot impose one reading on the
   *  other caller. */
  const askRegionUrls = async (
    image: Buffer,
    prompt: string,
    imageUrl?: string,
    theirs?: AbortSignal,
    /**
     * SEVERAL INSTANCES OF THE ONE NOUN.
     *
     * fal's published schema carries `return_multiple_masks` (default FALSE)
     * and `max_masks`, and this product had never sent either — so the August
     * reading that *"SAM 3 returns exactly ONE instance for a bilateral noun"*
     * was a fact about our REQUEST and not about the model (#2532 arm 1, law
     * clause 4: read what the engine already gives you).
     *
     * ⚠ **This line read *"for the `pairInOneRead` road only"* until 2026-10-30
     * (#2818), and the CROP road asks for them too now** — a side can wear more
     * than one of a thing, and asking for one gave a refine one earring off an
     * ear wearing two. What comes back is not all instances: on a feature there
     * is only one of, the extra answers are that same feature outlined again,
     * and `askRegion` drops those at the pixels rather than by noun.
     *
     * ⚠ **A NUMBER NOW, NOT A BOOLEAN (#2833)**: `null` asks for one, and a
     * number is the ceiling the caller's road carries — {@link PAIR_MAX_MASKS}
     * for one side, {@link PAIR_ROAD_MAX_MASKS} for both sides in one request.
     */
    maxMasks: number | null = null,
  ): Promise<readonly string[]> => {
    const address = imageUrl ? await addressIfIdentical(image, imageUrl) : null;
    const json = await post(apiKey, SAM3, {
      image_url: address ?? dataUri(image), prompt: askedAs(prompt), include_scores: true,
      output_format: "png",
      ...(maxMasks !== null ? { return_multiple_masks: true, max_masks: maxMasks } : {}),
    }, theirs, "theClosedVocabularyPrompt");
    const masks: any[] = Array.isArray(json.masks) ? json.masks : [];
    return masks
      .map((entry) => (typeof entry === "string" ? entry : entry?.url))
      .filter((url): url is string => typeof url === "string" && url.length > 0);
  };

  const askRegion = async (
    image: Buffer,
    prompt: string,
    keep: "first" | "all" = "first",
    imageUrl?: string,
    /* The CALLER's deadline, when it has one — see `signalFor`. The address
       check above is deliberately not given it: `referenced` is memoised per
       URL across callers, so one caller's deadline would abort a check another
       is awaiting. That is the shared-read rule, and it costs nothing — the
       check already bounds itself with `MASK_FETCH_TIMEOUT_MS`. */
    callSignal?: AbortSignal,
    /**
     * SEVERAL INSTANCES OF THE ONE NOUN, and what the caller means by them.
     *
     * `false` asks for one. `"all"` asks for several and unions every answer,
     * which is the pair road's reading: the two sides of a pair come back as
     * separate instances of one noun and both are wanted. `"separate"` asks for
     * several and keeps only the answers that are a SEPARATE THING, which is
     * the crop road's (#2818) — on a half there is only one feature on, the
     * extra answers are that feature outlined again.
     *
     * The wire field is the same for both; what differs is which answers
     * survive, and the two roads say which they mean rather than inheriting one
     * reading from the other. The memo below is deliberately not keyed on this:
     * the askers that set it never ask the shared prompt, and the guard there
     * says so.
     *
     * `"pair"` is `"all"` asked of BOTH SIDES AT ONCE (#2833) — the whole-frame
     * pair read, which carries both sides' allowance
     * ({@link PAIR_ROAD_MAX_MASKS}) and unions every answer the way `"all"`
     * does. `"all"` itself stays for `region`'s several-road (both tusks and the
     * row between them), which is one region and one side's allowance.
     */
    multiple: false | "all" | "separate" | "pair" = false,
  ): Promise<Mask | null> => {
    /*
      ⚠ THE SHARED `face` READ MAY NEVER ASK FOR SEVERAL INSTANCES — measured,
      not feared, and refused HERE rather than one function down.

      Under the setting, `face` on the elder alien came back as TWO masks where
      it has always been one (#2532 arm 1's own refusing control). That read is
      where every pair's midline comes from AND where the build row's head box
      is cut, so a shattered face moves the cut under all five pairs and the box
      under a row at once — the one failure on this road that would not look
      like a failure.

      It sits above the memo deliberately. Put in `askRegionUrls`, the memo
      branch below would have reached fal WITHOUT the field and never tripped
      it: a guard that cannot fire on the path its subject actually takes
      (invariant 7). Above it, every ask of this prompt refuses, whatever
      signal it carries — which is also what makes it honest to leave the memo
      un-keyed on `multiple`, since the one prompt it holds can never have it.
    */
    if (multiple && prompt === SHARED_PROMPT) {
      throw new MaskError(`the shared ${SHARED_PROMPT} read may not ask for several instances`);
    }
    const theirs = signalFor(callSignal);
    let urls: readonly string[];
    if (prompt === SHARED_PROMPT && callSignal === undefined) {
      let byPrompt = sharedUrls.get(image);
      if (byPrompt === undefined) {
        byPrompt = new Map();
        sharedUrls.set(image, byPrompt);
      }
      const held = byPrompt.get(prompt);
      if (held) urls = await held;
      else {
        const asked = askRegionUrls(image, prompt, imageUrl, theirs);
        byPrompt.set(prompt, asked);
        asked.catch(() => byPrompt.delete(prompt));
        urls = await asked;
      }
    } else {
      /* `"all"` and `"separate"` send the same request and differ only in which
         answers they keep. `"pair"` is the one road that asks for two sides in
         one request, so it is the one that carries two sides' ceiling (#2833). */
      urls = await askRegionUrls(
        image, prompt, imageUrl, theirs,
        multiple === false ? null : multiple === "pair" ? PAIR_ROAD_MAX_MASKS : PAIR_MAX_MASKS,
      );
    }
    if (urls.length === 0) return null;
    if (keep === "first") return fetchMask(urls[0], theirs);
    const every = await Promise.all(urls.map((url) => fetchMask(url, theirs)));
    if (every.length === 1) return every[0];
    if (multiple !== "separate") return unionMasks(...every);
    /*
      ⚠ SEVERAL INSTANCES MEANS SEVERAL THINGS, NOT SEVERAL READINGS OF ONE
      THING — and which of the two arrived is read off the ANSWER (#2818).

      Asked for several, SAM 3 returns both: a second earring further up the
      same ear, and — on a feature there is only one of — another outline of
      that same feature, tighter or looser than the first. Unioning the second
      kind silently GROWS the region, and a refine paints on the mask it gets
      back, so that is a delivered picture somebody paid for.

      Measured through the product's own crop geometry, two humans and a
      creature, `eyes` / `eyebrows` / `ear` / `horns`, one half at a time at two
      sizes — **36 cells, and not one genuine second instance on any anatomy
      pair.** Four extra masks came back and all four were the same feature read
      again: two TIGHTER (inside the first) and two LOOSER, and a looser one
      unioned in would have taken one eye from 1,042px to 1,995px. The worn pair
      is the opposite and is this card's defect: on a cast wearing several
      earrings in one ear the extras are real hoops — 1,500 + 334 at 1024, and
      513 + 109 + 85 at 598.

      **The two populations separate at the PIXELS, which is why no list is
      needed and none is kept here**: every one of the extra earrings shares
      ZERO pixels with the answer already in hand, and every one of the anatomy
      extras is one shape wholly inside the other. So an extra is kept when it
      touches nothing already kept, and dropped when it does — read from the
      answer, never looked up by noun (N3's rule).

      It costs no request: the instances come back from the SAME call, so this
      changes what is read and not what is spent. Boxes rather than shapes is
      the tempting cheaper test and it is wrong here — two boxes can overlap
      while the shapes inside them never touch.
    */
    const kept: Mask[] = [every[0]!];
    let dropped = 0;
    for (const mask of every.slice(1)) {
      if (kept.some((already) => overlapWith(mask, already) > 0)) {
        dropped += 1;
        continue;
      }
      kept.push(mask);
    }
    if (every.length > 1) {
      /* Numbers only — how many answers came back and how many were the same
         thing again. Never a word of the reading. */
      log.debug(
        { prompt, answers: every.length, kept: kept.length, dropped },
        "[falRegionReader] asked for several instances",
      );
    }
    return kept.length === 1 ? kept[0] : unionMasks(...kept);
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
  /**
   * THE FACE ACROSS, once per picture — the read `axisOf` turns into a midline
   * and an ear-worn pair turns into the face's two sides (#2781).
   *
   * One promise per buffer for `axes`' own reason (parallel askers join one
   * read), and the request under it is the `SHARED_PROMPT` memo's, so holding
   * the span costs no call: the axis was always this mask's centroid, and the
   * span is the same mask's extent.
   */
  const faces = new Map<Buffer, Promise<FaceSpan | null>>();
  const faceOf = (image: Buffer, imageUrl?: string): Promise<FaceSpan | null> => {
    const held = faces.get(image);
    if (held) return held;
    const asked = (async () => {
      const face = await askRegion(image, SHARED_PROMPT, "all", imageUrl);
      return face ? spanOf(face) : null;
    })();
    faces.set(image, asked);
    asked.catch(() => faces.delete(image));
    return asked;
  };

  const axes = new Map<Buffer, Promise<FaceSpan | null>>();
  const axisOf = (image: Buffer, imageUrl?: string, axisKey?: string): Promise<number | null> =>
    spanFor(image, imageUrl, axisKey).then((span) => span?.axis ?? null);

  /** The face across AND down, by the same memo the axis is read through —
   *  so the face rule (#2844) judges by the very read the midline came from,
   *  keyed or not, and never buys one of its own. */
  const spanFor = (image: Buffer, imageUrl?: string, axisKey?: string): Promise<FaceSpan | null> => {
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
    const asked = faceOf(image, imageUrl);
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
    /* The caller's deadline reaches the two SIDE reads and deliberately not
       `axisOf` below: the axis promise is memoised per frame AND per face
       across callers, so one deadline would abort a read another caller is
       awaiting. The shared-read rule, same as `addressIfIdentical`. */
    callSignal?: AbortSignal,
    /** Keep only the pieces where an ear is — `regionSides`' `onTheEars`. */
    onTheEars = false,
  ): Promise<{
    atImageLeft: Mask | null;
    atImageRight: Mask | null;
  } | null> => {
    const halves = await readHalves(image, name, imageUrl, axisKey, callSignal);
    if (halves === null) return null;
    /*
      A FACE FEATURE IS ON THE FACE (#2844) — applied to BOTH roads, because
      both kept the tattoo's eye on his round-10 cast: the pair road by the
      union, the crop road by `"separate"`. See `keepPiecesOnTheFace` for the
      measurement. Every paid refine reads a pair through here (`regionSides`),
      and so does the panel, so the two cannot disagree about which eye is hers.
    */
    const split = FACE_FEATURES.has(name)
      ? await offTheFaceDropped(image, name, imageUrl, axisKey, halves.split, halves.midline)
      : halves.split;
    if (!onTheEars) return split;
    /*
      AN EAR IS AT THE SIDE OF THE FACE (#2781) — applied to BOTH roads,
      because both take a thing on the midline into a side: the pair road cuts
      it in half, and the crop road hands each half-frame its half of it. See
      `keepPiecesAtTheSide` for the measurement.

      The face read here is the one the midline came from (`faceOf` is the memo
      `axisOf` reads), so it costs no request. With no face, there is no side
      to judge by and the answer is today's.
    */
    const span = await faceOf(image, imageUrl);
    if (span === null) return split;
    const face = { midline: halves.midline, left: span.left, right: span.right };
    const left = split.atImageLeft === null
      ? { kept: null, dropped: [] }
      : keepPiecesAtTheSide(split.atImageLeft, "imageLeft", face);
    const right = split.atImageRight === null
      ? { kept: null, dropped: [] }
      : keepPiecesAtTheSide(split.atImageRight, "imageRight", face);
    if (left.dropped.length > 0 || right.dropped.length > 0) {
      /* Numbers only — where the dropped pieces were and how big. Never a
         word of the reading. */
      log.info(
        {
          name,
          midline: face.midline,
          faceSides: [face.left, face.right],
          droppedAtImageLeft: left.dropped,
          droppedAtImageRight: right.dropped,
        },
        "[falRegionReader] an ear-worn pair answered something nearer the middle of the face — not that side's",
      );
    }
    return { atImageLeft: left.kept, atImageRight: right.kept };
  };

  /**
   * ONE SIDE'S ANSWER, OR BOTH, WITH EVERY PIECE OFF THE FACE DROPPED — the
   * face rule's one call site, read by `bilateralHalves` (both roads) and by
   * `sideByCrop` (the half-answered heal), so the heal cannot bring back the
   * piece the first reading dropped (#2844).
   *
   * The face is the read the midline came from (`spanFor`, keyed or not), so
   * it costs no request. With no face there is nothing to judge by and the
   * answer is today's.
   */
  const offTheFaceDropped = async (
    image: Buffer, name: string, imageUrl: string | undefined, axisKey: string | undefined,
    split: { atImageLeft: Mask | null; atImageRight: Mask | null },
    midline: number,
  ): Promise<{ atImageLeft: Mask | null; atImageRight: Mask | null }> => {
    const span = await spanFor(image, imageUrl, axisKey);
    if (span === null) return split;
    const face = { ...span, midline };
    const left = split.atImageLeft === null ? { kept: null, dropped: [] } : keepPiecesOnTheFace(split.atImageLeft, face);
    const right = split.atImageRight === null ? { kept: null, dropped: [] } : keepPiecesOnTheFace(split.atImageRight, face);
    if (left.dropped.length > 0 || right.dropped.length > 0) {
      /* Numbers only — where the dropped pieces were and how big, and the
         face they were judged against. Never a word of the reading. */
      log.info(
        {
          name,
          face: { left: face.left, right: face.right, top: face.top, bottom: face.bottom, midline },
          droppedAtImageLeft: left.dropped,
          droppedAtImageRight: right.dropped,
        },
        "[falRegionReader] a face feature's answer held a piece away from the face — not that feature",
      );
    }
    return { atImageLeft: left.kept, atImageRight: right.kept };
  };

  /**
   * THE CUT ITSELF — her midline, the frame's size, and the two crops it makes.
   *
   * One copy, because there are now two readers of it: the crop road's own
   * pair read, and the blind-side read `sideByCrop` performs for a half-answered
   * pair (#2802). A second copy of this arithmetic is working law 4 in the one
   * place it would be worst — two midlines would put the heal's answer on a
   * different cut from the reading it is repairing.
   *
   * `null` is *there is no split to make*, before any call is spent.
   */
  const cutOf = async (
    image: Buffer, name: string, imageUrl: string | undefined, axisKey: string | undefined,
  ): Promise<{
    width: number; height: number; midline: number; byFace: boolean;
    crops: { imageLeft: { left: number; width: number }; imageRight: { left: number; width: number } };
  } | null> => {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(image).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) throw new MaskError(`cannot read a ${name} on an image with no size`);
    /* A picture one pixel wide has no two sides to cut between. */
    if (width < 2) return null;
    const axis = await axisOf(image, imageUrl, axisKey);
    /* Clamped so a face read that lands on an edge cannot ask for a zero-width
       crop — a degenerate half is a thrown sharp error in place of a reading. */
    const midline = Math.min(width - 1, Math.max(1, Math.round(axis ?? width / 2)));
    return {
      width, height, midline, byFace: axis !== null,
      crops: {
        imageLeft: { left: 0, width: midline },
        imageRight: { left: midline, width: width - midline },
      },
    };
  };

  /**
   * ONE HALF-PICTURE, ASKED — the crop road's single read, placed back in the
   * caller's frame.
   *
   * ⚠ **IT ASKS FOR EVERY INSTANCE ON THAT HALF, NOT THE BEST ONE (#2818).**
   * A side can wear more than one of a thing: measured on a cast wearing
   * several earrings in one ear, this ask returned ONE of them — 1,500px where
   * the ear also carried a 334px hoop further up — so a refine that touches the
   * earrings painted on one and left the others out of the edit. The
   * instances come back from the same call, so this costs no request; which of
   * them survive is `askRegion`'s business and is decided at the pixels, in the
   * block there.
   */
  const readOneCrop = async (
    image: Buffer, noun: string, crop: { left: number; width: number },
    width: number, height: number, callSignal: AbortSignal | undefined,
  ): Promise<Mask | null> => {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(image)
      .extract({ left: crop.left, top: 0, width: crop.width, height })
      .png()
      .toBuffer();
    const mask = await askRegion(bytes, noun, "all", undefined, callSignal, "separate");
    return mask ? placeInFrame(mask, crop, width, height) : null;
  };

  /** The two halves as read, and the midline they were cut at. */
  const readHalves = async (
    image: Buffer, name: string, imageUrl: string | undefined, axisKey: string | undefined,
    callSignal: AbortSignal | undefined,
  ): Promise<{
    split: { atImageLeft: Mask | null; atImageRight: Mask | null };
    midline: number;
  } | null> => {
    const noun = singularOf(name);
    const cut = await cutOf(image, name, imageUrl, axisKey);
    if (cut === null) return null;
    const { width, height, midline } = cut;

    /*
      ONE REQUEST FOR BOTH SIDES, when the caller has asked for that road
      (#2191). See `pairInOneRead` on the constructor for what it saves, why the
      caller decides, and why it is off by default.

      The midline is read FIRST and unconditionally, so this road costs one
      request where the crop road costs two and neither saves the `face` read —
      that read is shared across all five pairs and the build row already
      (`SHARED_PROMPT`), so it is one read a scan either way.

      ⚠ **A ONE-SIDED ANSWER IS LEFT ONE-SIDED HERE, ON PURPOSE.** It is
      tempting to ask the missing half the old way and hand back a whole pair,
      and that would be a control written at the wrong altitude: `faceScan.ts`
      ALREADY looks again when exactly one side is at literal zero (fable-749
      §3a, a heal bought on a measured production rate), and it keeps the second
      reading only when it actually recovers the blind side. A rescue attempt in
      here would fire first, spend the same read, and leave that heal looking at
      a pair it can no longer tell was ever half-answered — so the measured
      control would be the one that stopped working. The cost is the same either
      way: one read, then one more only if a side is missing.
    */
    if (pairInOneRead) {
      /* `"pair"`: both sides in one request, so both sides' allowance — at
         one side's, an ear wearing three pieces lost one to the other ear's
         answers (#2833, `PAIR_ROAD_MAX_MASKS`). */
      const whole = await askRegion(image, name, "all", imageUrl, callSignal, "pair");
      /* No masks at all is the crop road's own both-halves-empty answer, at one
         read instead of two — `absentIsAnswer` and the empty-anatomy re-ask
         above decide what it means, exactly as they do today. */
      const split = whole === null
        ? { atImageLeft: null, atImageRight: null }
        : await splitAtMidline(whole, midline, width, height);
      log.debug(
        {
          name,
          sides: [split.atImageLeft, split.atImageRight].filter((mask) => mask !== null).length,
          midline,
          byFace: cut.byFace,
          masked: whole !== null,
        },
        "[falRegionReader] bilateral read, one request for both sides",
      );
      return { split, midline };
    }

    const crops = [cut.crops.imageLeft, cut.crops.imageRight] as const;
    const sides = await Promise.all(crops.map(
      (crop) => readOneCrop(image, noun, crop, width, height, callSignal),
    ));

    log.debug(
      {
        name,
        noun,
        sides: sides.filter((mask) => mask !== null).length,
        midline,
        byFace: cut.byFace,
      },
      "[falRegionReader] bilateral read, one side to a picture",
    );
    return { split: { atImageLeft: sides[0], atImageRight: sides[1] }, midline };
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
    callSignal?: AbortSignal,
  ): Promise<Mask | null> => {
    const halves = await bilateralHalves(image, name, imageUrl, axisKey, callSignal);
    if (halves === null) return askRegion(image, singularOf(name), "all", imageUrl, callSignal);
    const found = [halves.atImageLeft, halves.atImageRight].filter((mask): mask is Mask => mask !== null);
    if (found.length === 0) return null;
    return found.length === 1 ? found[0] : unionMasks(...found);
  };

  /** The detector's rectangles round a noun, in pixels — `pointer`'s whole body, shared with the other-ear look. */
  const detectBoxes = async (
    image: Buffer,
    name: string,
    imageUrl: string | undefined,
    callSignal: AbortSignal | undefined,
  ): Promise<readonly PointerBox[]> => {
    assertPicture(image, name);
    const theirs = signalFor(callSignal);
    const address = imageUrl ? await addressIfIdentical(image, imageUrl) : null;
    const sharp = (await import("sharp")).default;
    const meta = await sharp(image).metadata();
    if (!meta.width || !meta.height) throw new MaskError(`the frame asked about ${name} has no readable size`);
    const { width, height } = meta;
    /* ⚠ THE ROAD NAMES THIS CALL, NOT ITS PROMPT. `name` is the discovery
       reading's own open-vocabulary noun — see `CensusLabel`. */
    const json = await post(apiKey, DETECT, {
      image_url: address ?? dataUri(image),
      prompt: name,
    }, theirs, { road: POINTER_DETECT_ABOUT });
    const objects: any[] = Array.isArray(json.objects) ? json.objects : [];
    const boxes: PointerBox[] = [];
    for (const object of objects) {
      const left = Number(object?.x_min);
      const top = Number(object?.y_min);
      const right = Number(object?.x_max);
      const bottom = Number(object?.y_max);
      if (![left, top, right, bottom].every((one) => Number.isFinite(one))) continue;
      /* Clamped to the picture and ordered, because a rectangle is the
         QUESTION the segmenter answers: a negative width or an edge past the
         frame is not a tighter box, it is a prompt the provider has to
         interpret, and what it interprets it as is nobody's measurement. */
      const x = Math.round(Math.min(Math.max(Math.min(left, right), 0), 1) * width);
      const y = Math.round(Math.min(Math.max(Math.min(top, bottom), 0), 1) * height);
      const far = Math.round(Math.min(Math.max(Math.max(left, right), 0), 1) * width);
      const low = Math.round(Math.min(Math.max(Math.max(top, bottom), 0), 1) * height);
      if (far <= x || low <= y) continue;
      boxes.push({ x, y, width: far - x, height: low - y });
    }
    log.debug(
      { name, objects: objects.length, boxes: boxes.length },
      boxes.length === 0
        ? "[falRegionReader] the detector found no such thing, and that is the answer"
        : "[falRegionReader] the detector put a rectangle round it",
    );
    return boxes;
  };

  /**
   * THE REGION INSIDE ONE RECTANGLE — the pointer road's second half.
   *
   * The prompt goes out EMPTY on purpose: the rectangle is the question, and
   * a noun beside it is a second question the model would have to reconcile
   * with the first. #2532's bench sent `prompt: ""` with `box_prompts`, and
   * every number this road rests on was measured that way, so sending the
   * noun as well would be a different request than the one that was judged.
   *
   * `include_scores` rides along for the reason the text road's call carries
   * it — the law's clause 4, read what the engine already gives you — and
   * nothing here reads it yet, which is stated rather than implied: the
   * presence head is #246's unfinished business and not this slice's.
   *
   * ⚠ **AND IT CANNOT SAY *WHICH NOUN* — DRIVEN 2026-10-29 (#2787), SO THE
   * NEXT HAND DOES NOT BUY THESE CALLS AGAIN TO FIND OUT.** The score is a
   * real signal and it is about the MASK rather than about the word: the
   * prompt goes out empty two paragraphs above, so the segmenter is never
   * told which noun the rectangle came from and two nouns whose rectangles
   * agree get the same answer. Measured on the selector's own reference
   * stand-in, where the detector returned `hoop earring` and `nose ring` as
   * one object — boxes identical to the last bit (`305,462 44x56`) and
   * therefore scores identical to the last bit (**0.89453125** each), while
   * the correct `earring` at `306,462 42x56` scored 0.8984 and the nose's
   * own box scored 0.8164. **So where two nouns land on one place this score
   * is flat by construction**: it says how good a cut is, never whose it is.
   * #246's absent-feature question is still the one it is for.
   */
  const cutInBox = async (
    image: Buffer,
    name: string,
    box: PointerBox,
    imageUrl: string | undefined,
    callSignal: AbortSignal | undefined,
  ): Promise<Mask | null> => {
    assertPicture(image, name);
    const theirs = signalFor(callSignal);
    const address = imageUrl ? await addressIfIdentical(image, imageUrl) : null;
    const json = await post(apiKey, SAM3, {
      image_url: address ?? dataUri(image),
      prompt: "",
      box_prompts: [{
        x_min: box.x,
        y_min: box.y,
        x_max: box.x + box.width,
        y_max: box.y + box.height,
      }],
      include_scores: true,
      output_format: "png",
    /* The prompt goes out EMPTY on this road, so there was never a word here
       to label the call with — and an empty label opens no `byAbout` row, so
       these calls were summed into the SAME `byModel` bucket as the
       catalogue's SAM 3 reads and separable from them by nothing. That is the
       half of the relay's question that scales with `count`. */
    }, theirs, { road: POINTER_BOX_ABOUT });
    const masks: any[] = Array.isArray(json.masks) ? json.masks : [];
    const url = masks
      .map((entry) => (typeof entry === "string" ? entry : entry?.url))
      .find((one): one is string => typeof one === "string" && one.length > 0);
    if (url === undefined) {
      log.debug({ name }, "[falRegionReader] the segmenter returned no mask inside that rectangle");
      return null;
    }
    return fetchMask(url, theirs);
  };

  return {
    async region({ image, name, absentIsAnswer, imageUrl, axisKey, signal: callSignal }) {
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

        ⚠ AND IT IS NOT A PROPERTY OF ONE WORD. Two further words have been
        driven at the departure gate since, each in its own sitting with its own
        controls, and the second of them fails upward PAST ITS OWN POSITIVE
        CONTROLS:

            frame                          asked        px      where the mask sat
            a hairless creature skull     `hair`      25,962    a hairline-shaped
                                                                cap on bare bone
            a creature with NO brow hair  `eyebrows`   6,714    TWO perfect brow
              (ANG-C-2)                                         shapes on the bare
                                                                ridge, 26%–29%
            a woman WITH dark brows       `eyebrows`   3,878    her real brows
            a man WITH blond brows        `eyebrows`   6,084    his real brows

        So on `eyebrows` the ABSENT read outscores the feature genuinely being
        present, in both present arms. **A magnitude test cannot separate these
        two populations** — not because they overlap, but because they are
        inverted. Pooled: three substitutions in ten absent cells across five
        words; `facial hair` and `horns` came back clean with positive controls
        firing on the same word in the same sitting, so which words it reaches is
        still open. (`docs/specs/DEPARTURE_GATE_SUBSTITUTION_2026-08-30.md`
        §2 and §7.)

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
        const both = await bilateral(image, name, imageUrl, axisKey, callSignal);
        return both ?? absent();
      }
      /*
        A REGION THAT IS SEVERAL THINGS IS ASKED FOR ALL OF THEM (#2810, his eye
        round 8: *"teeth highlighted his tooth/tusk thing"*).

        Asked the one-instance way, SAM 3 answers its single best instance, so
        `all the teeth` on a creature with two tusks came back as ONE tusk on
        every reading — the engine had the other one and the request never asked
        for it (the law's clause 4: read what the engine already gives you).
        The same call with `return_multiple_masks` answered both tusks and the
        row between them, so the union is the row. No extra request is bought:
        it is one call either way, under the pair road's own ceiling.
      */
      const several = SEVERAL.has(name);
      /* ⚠ `"all"` AND NOT `"separate"`, AND THE PARAGRAPH ABOVE IS WHY (#2818).
         This road wants the answers that OVERLAP: both tusks and the row
         between them are three answers that touch, and the union of them is the
         row. The crop road's rule — keep only what touches nothing already kept
         — would throw two of the three away here. Two roads, two meanings of
         "several", each saying which it means. */
      const mask = await askRegion(image, name, several ? "all" : "first", imageUrl, callSignal, several ? "all" : false);
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
    async regionSides({ image, name, absentIsAnswer, imageUrl, axisKey, declaredTwoSided, onTheEars }): Promise<SideRegions | null> {
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
      /* NO per-call signal, and it is declared rather than omitted (#1781):
         `regionSides` has one consumer, the masked refine, and a refine has no
         deadline to cancel on. Widening the interface for a signal nobody
         passes is a control that is not invoked. */
      const halves = await bilateralHalves(image, name, imageUrl, axisKey, undefined, onTheEars === true);
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

    async subject({ image, signal: callSignal }) {
      assertPicture(image, "the whole subject");
      const theirs = signalFor(callSignal);
      /* No prompt to be named by, and deliberately not given a road label
         either: labelling it would open a `byAbout` row the matting road has
         never had, and move `labelledCalls` under every reader comparing this
         render to an older one. */
      const json = await post(apiKey, BIREFNET, {
        image_url: dataUri(image), mask_only: true, model: "Matting", output_format: "png",
      }, theirs, "theClosedVocabularyPrompt");
      const url = json?.mask_image?.url ?? json?.image?.url;
      if (!url) throw new MaskError("the matting model returned no mask");
      return fetchMask(url, theirs);
    },

    /**
     * WHERE A THING THE VOCABULARY HAS NEVER HEARD OF SITS (#2566 slice 2, the
     * pointer road of the design approved on #2532).
     *
     * # The frame's size is read HERE, and that is the whole of the conversion
     *
     * The detector answers in FRACTIONS of the picture (`x_min` … `y_max`, each
     * 0–1) and the segmenter's `box_prompts` take PIXELS. One of those two
     * spaces has to be converted and the conversion needs the frame's size, so
     * it happens in this function where the bytes are in hand — never at a
     * caller, and never half-done. {@link PointerBox} is pixels by declaration
     * for exactly that reason: a fraction that escaped into the caller's
     * geometry would be a box 0.3 pixels wide and a correct-looking mask in the
     * wrong space, which is the wrong-frame class this file already carries two
     * warnings about.
     *
     * # An empty list and a failure are different answers
     *
     * It throws what `post` throws, and returns `[]` for *nothing there*. The
     * caller reads the empty list as the absence answer (see
     * {@link RegionReader.pointer} for why that is trustworthy here and not on
     * the text road) — so collapsing a 429 into `[]` would file a provider's bad
     * minute as a feature the cast has not got.
     */
    async pointer({ image, name, imageUrl, signal: callSignal }): Promise<readonly PointerBox[]> {
      return detectBoxes(image, name, imageUrl, callSignal);
    },

    /**
     * THE REGION INSIDE ONE RECTANGLE — the pointer road's second half. Its
     * account is on {@link cutInBox}, which the other-ear look reuses.
     */
    async regionInBox({ image, name, box, imageUrl, signal: callSignal }): Promise<Mask | null> {
      return cutInBox(image, name, box, imageUrl, callSignal);
    },

    /**
     * THE OTHER EAR, LOOKED AT BY THE DETECTOR (#2800, his eye round 6:
     * *"why did it pick up her left ear but not the left earing?"*).
     *
     * # What the segmenter answered, measured on his screenshot
     *
     * Asked `earring` of the whole picture, SAM 3 answered ONE mask: the hoop
     * in the cast's right ear (score 0.564 at 1024 wide, 0.511 at 598). The
     * hoop in the left ear was never offered, at either size, and a second ask
     * came back identical to the last digit — so the scan's second look, which
     * asks the same question, cannot find it. Read half a picture at a time it
     * was not found either. **The detector, asked `earring`, boxed BOTH hoops
     * at both sizes**, and the box cut filled 0.804 and 0.766 of its rectangle.
     *
     * # What it does
     *
     * One detector call for the noun, on the whole frame. The rectangles kept
     * are the ones whose centre is where THIS side's ear is — {@link atTheSide},
     * the very rule the segmenter's own pieces are judged by, so the found
     * side's earring and a septum ring are never this side's. Each is cut
     * inside its rectangle, refused under #2795's fill floor exactly as the
     * pointer road refuses a cut, and what is left is judged once more by
     * {@link keepPiecesAtTheSide}. `null` when nothing is left.
     *
     * The face read is the one the midline came from (`faceOf`), so it costs no
     * request; with no face there is no side to judge by and the answer is
     * `null`, which is today's.
     */
    async sideByDetector({ image, name, side, imageUrl }): Promise<Mask | null> {
      assertPicture(image, name);
      const span = await faceOf(image, imageUrl);
      if (span === null) return null;
      /* `left` is HER left, which is the image's right — `regionSides`' own
         mapping, read the same way. */
      const imageSide = side === "left" ? "imageRight" : "imageLeft";
      const face = { midline: span.axis, left: span.left, right: span.right };
      const boxes = await detectBoxes(image, singularOf(name), imageUrl, undefined);
      const here = boxes
        .filter((box) => atTheSide(box.x + box.width / 2, imageSide, face))
        /* A pair read may come back with this many instances; so may a side. */
        .slice(0, PAIR_MAX_MASKS);
      const judged = await Promise.all(here.map(async (box) => {
        const mask = await cutInBox(image, name, box, imageUrl, undefined);
        return { box, mask, verdict: mask === null ? null : judgeCut({ mask, box }) };
      }));
      const used = judged.filter((one) => one.verdict?.use === true).map((one) => one.mask as Mask);
      const kept = used.length === 0
        ? null
        : keepPiecesAtTheSide(used.length === 1 ? used[0] : unionMasks(...used), imageSide, face).kept;
      /* Numbers only — where it looked, how full each cut was. Never a word of
         the reading. */
      log.info(
        {
          name,
          side,
          boxes: boxes.length,
          atThisSide: here.length,
          fills: judged.map((one) => (one.verdict === null ? null : one.verdict.fill)),
          found: kept !== null,
        },
        kept === null
          ? "[falRegionReader] the detector looked at the other ear and found nothing to keep"
          : "[falRegionReader] the detector found what the segmenter missed on the other ear",
      );
      return kept;
    },

    /**
     * ONE SIDE OF A PAIR, READ ON THE CROP ROAD (#2802).
     *
     * # The question the second look was asking, and why it could not answer
     *
     * Production reads a pair in ONE whole-picture request
     * (`ENABLE_CASTING_PAIR_ONE_READ`, `pairInOneRead` above). When one side
     * comes back at literal zero, `faceScan.ts` takes a second look — and on
     * that road the second look **was the identical request**: same endpoint,
     * same prompt, same bytes. Measured on the founder's own round-6 cast,
     * `ear` at 1024 and at 598, five draws a size through the product's own
     * reader: **the pair road answered 0 and 0 on 10 of 10 draws.** It is not
     * a flaky read that a second ask might catch; it is the same question
     * getting the same answer.
     *
     * **The crop road is a different question**, and that is this module's
     * oldest measured fact rather than a hope — see {@link BILATERAL}: *"the
     * same twelve features, asked as a PLAIN noun of a picture containing one
     * side only, read 12 of 12."* On the same ten draws, the crop road found
     * **both** ears every time (699–704px and 748–752px at 1024; 239px and
     * 249–250px at 598), on a cast whose two ears the founder's own eye reads
     * plainly.
     *
     * # And it does not invent a side that is not there
     *
     * Two negative controls, read at the frames first: a cast whose ears are
     * both under her hair (6 draws) and a hooded cast with no ear in frame
     * (6 draws). The crop road answered **nothing on the blind side in 12 of
     * 12** — it recovered no ear either road could not see, which is the half
     * of this that a positive arm cannot show.
     *
     * # What it costs
     *
     * One segmenter read, which is what the second look already spends. On the
     * crop road itself the first reading was already a half-picture, so this
     * asks that half again — today's heal exactly, at one read instead of the
     * two a whole `regionSides` re-ask spends.
     *
     * `null` is *nothing to keep on that side*, and a name this reader does not
     * read two-sidedly answers `null` before any call is spent, as
     * `regionSides` does. `side` is anatomical, as `regionSides`' keys are.
     */
    async sideByCrop({ image, name, side, imageUrl, axisKey, onTheEars }): Promise<Mask | null> {
      assertPicture(image, name);
      if (!BILATERAL.has(name)) return null;
      const cut = await cutOf(image, name, imageUrl, axisKey);
      if (cut === null) return null;
      /* `left` is HER left, which is the image's right — `regionSides`' own
         mapping, read the same way. */
      const imageSide = side === "left" ? "imageRight" : "imageLeft";
      const read = await readOneCrop(
        image, singularOf(name), cut.crops[imageSide], cut.width, cut.height, undefined,
      );
      if (read === null) return null;
      /* A FACE FEATURE IS ON THE FACE (#2844) — the heal judged as the first
         reading was, or it would bring back the very piece that reading
         dropped and leave the side looking healed. */
      const half = FACE_FEATURES.has(name)
        ? (await offTheFaceDropped(
          image, name, imageUrl, axisKey,
          imageSide === "imageLeft" ? { atImageLeft: read, atImageRight: null } : { atImageLeft: null, atImageRight: read },
          cut.midline,
        ))[imageSide === "imageLeft" ? "atImageLeft" : "atImageRight"]
        : read;
      if (half === null) return null;
      if (onTheEars !== true) return half;
      /* AN EAR IS AT THE SIDE OF THE FACE (#2781) — applied here too, so the
         heal judges the same answer the panel will draw. The face read is the
         one the midline came from, so it costs no request; with no face there
         is no side to judge by and the answer is the half as read. */
      const span = await faceOf(image, imageUrl);
      if (span === null) return half;
      const { kept, dropped } = keepPiecesAtTheSide(
        half, imageSide, { midline: cut.midline, left: span.left, right: span.right },
      );
      if (dropped.length > 0) {
        /* Numbers only — where the dropped pieces were and how big. Never a
           word of the reading. */
        log.info(
          { name, side, midline: cut.midline, faceSides: [span.left, span.right], dropped },
          "[falRegionReader] the blind side's own read answered something nearer the middle of the face — not that side's",
        );
      }
      return kept;
    },

    /* NO per-call signal, for `regionSides`' reason: its callers place an
       addition and none of them has a deadline. */
    async landmark({ image, name }) {
      assertPicture(image, name);
      /* `name` here is `landmarkNameOf`'s / the removal table's own fixed
         word, not a reading's noun — the closed vocabulary, as before. */
      const json = await post(apiKey, POINT, { image_url: dataUri(image), prompt: name }, signal, "theClosedVocabularyPrompt");
      const points: any[] = Array.isArray(json.points) ? json.points : [];
      if (points.length === 0) {
        throw new MaskError(`nothing could place a ${name} on this face`);
      }
      log.debug({ name, points: points.length }, "[falRegionReader] landmark located");
      return points.map((point) => ({ x: Number(point.x), y: Number(point.y) }));
    },
  };
}
