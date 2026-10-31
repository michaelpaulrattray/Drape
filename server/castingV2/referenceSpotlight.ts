/**
 * THE SPOTLIGHT'S ENTRANCE — #14 slice 3a-2.
 *
 * Slice 3a-1 built four roads and gave them no way in: `splitAtPoints`,
 * `cutAtPoint`, `cleanSplit` and `nameTheCut` all exist, are tested, and
 * nothing at runtime reaches any of them. This module is the way in, and it is
 * the whole of what 3a-2 owes: **open** a photograph into a hit-test map, and
 * **tap** a point in it for a named cut.
 *
 * ## The two acts, and why they are two
 *
 * They are two spends with two latencies, measured in the spotlight court:
 * opening is ONE 32-point SAM 3 read, 4.3–6.6 s and ≈0.5¢ (52.3 s once, on the
 * provider's bad minute); a tap is one point read at 1.1–3.8 s plus one text
 * call at 1.5–4.1 s. Putting them behind one entrance would make every tap pay
 * the split again.
 *
 * ## What goes back, and what deliberately does not
 *
 * **Geometry and a name. Never a pixel of the photograph.** The map is an
 * index image (`referenceSpotlightMap.ts`) and a tap's answer is that same
 * encoding over the one cut, plus its bounds and its name. The customer's
 * browser already holds the picture it attached, so sending pixels of it back
 * would be re-publishing a photograph of a person to buy nothing — and §6's
 * rule is that the attachment lives at owner-only addresses with no public URL.
 * **Returning geometry is how that fence is kept by construction here** rather
 * than by a reviewer noticing.
 *
 * It follows that nothing on this road stores a byte: no `casting_reference_crops`
 * row, no object, no manifest. **The first mint is slice 4's** (§9), and taking
 * it here would be the "new capability folded into another slice" shape his
 * 2026-09-24 ruling forbids.
 *
 * ## Fail-open, inherited verbatim
 *
 * §4's property, which every road here already holds on its own: *"a failed or
 * empty split means the picture presents with no spotlight, taps still
 * honoured, words road untouched, nothing charged, nothing said."* So both
 * entrances answer with a `why` rather than throwing, and a caller that gets
 * one shows the attach exactly as it looks today.
 *
 * ## The flag is NOT read here
 *
 * `captureCastingReferenceSelectorEnabled` is the caller's, which is
 * `readAndMarkReference`'s own rule one road along (*"nothing here reads a
 * flag, so the gate stays in one place"*). The gate for these two acts is on
 * the procedures in `server/routes/castingV2.ts`.
 */

import { cleanCut, FILL_MEASURED_NOT_REFUSED } from "./cutQuality";
import { createFalRegionReader, cutAtPoint } from "./falRegionReader";
import { interpreterTextQueue } from "./interpreter";
import { createModuleLogger } from "../logging/logger";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../providers/openrouterText";
import type { Mask } from "./maskedComposite";
import { unionMasks } from "./maskGeometry";
import type { PointerBox, RegionReader } from "./maskedRefine";
import type { TextEngine } from "../providers/types";
import { nameTheCut } from "./referenceCutName";
import { piecesFromTheReading, type PiecesTally } from "./referenceSpotlightPieces";
import { cleanSplit, type CleanedSplit } from "./referenceSplitCleanup";
import { encodeSpotlightMap, spotlightMapOf, type SpotlightMapImage } from "./referenceSpotlightMap";
import { subtractFaces, TAKE_FACE_NOUN } from "./referenceTake";
import { boundsOf } from "./segmentCuts";

const log = createModuleLogger("casting-reference-spotlight");

/** How many pixels a mask actually holds, at the threshold every road here uses. */
function pixelsIn(mask: Mask): number {
  let n = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at]! > 127) n += 1;
  return n;
}

/**
 * THE MODEL THAT NAMES A CUT, AND IT IS NOT A CHOICE THIS SLICE MAKES.
 *
 * The spotlight court measured the naming arm at **8 of 8 whole-thing cuts**
 * on `anthropic/claude-sonnet-5` — which is `DEFAULT_INTERPRETER_MODEL`, the
 * product's own default. So this road is not picking an engine; it is standing
 * on the one the measurement was taken on, and the constant is referenced
 * rather than restated so the two cannot drift apart.
 *
 * If the default ever moves, the 8-of-8 is a reading about a model this road no
 * longer uses, and the clause-1 question (*is this still the right engine?*)
 * is re-asked with a measurement rather than inherited.
 */
export const CUT_NAME_MODEL = DEFAULT_INTERPRETER_MODEL;

let namingEngine: TextEngine | null = null;

/**
 * The namer's engine, on the product's ONE OpenRouter text allowance.
 *
 * The queue is shared rather than built here, and that is the load-bearing
 * half: a second engine with a second queue would double what the product is
 * willing to have in flight at OpenRouter, which shows up as a 429 on a
 * customer's read rather than as a failing test. Four other roads declare
 * their own engine over this same queue; this is the fifth.
 */
export function cutNameEngine(): TextEngine | null {
  if (namingEngine) return namingEngine;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  namingEngine = createOpenRouterTextEngine({
    apiKey,
    model: CUT_NAME_MODEL,
    queue: interpreterTextQueue(),
  });
  return namingEngine;
}

/** Test seam: drops the memoized naming engine. */
export function resetCutNameEngineForTests(): void {
  namingEngine = null;
}

/**
 * The reader that detects the faces §6 needs, on the segmenter's own allowance.
 *
 * `null` with no key, which both entrances read as *this picture does not
 * light* rather than as a failure — §4's fail-open property.
 */
export function spotlightRegionReader(): RegionReader | null {
  const apiKey = process.env.FAL_KEY;
  return apiKey ? createFalRegionReader({ apiKey }) : null;
}

/** Every number the open read used, for the log and the measurement — never for a customer. */
export type SpotlightTally = Omit<CleanedSplit, "pieces"> & {
  /** How many masks the provider answered with, before any clean-up. */
  rawPieces: number;
  /** How many survived it. */
  pieces: number;
  /** How many face boxes the detector found. */
  faces: number;
  /** Whether the face's own pixels were read, or the rectangle stood in (#2902). */
  faceMaskRead: boolean;
  /** What the reading, the boxer and the cuts each cost — {@link PiecesTally}. */
  reading: PiecesTally;
  splitMs: number;
  facesMs: number;
  totalMs: number;
};

export type SpotlightOpened =
  | {
      ok: true;
      map: SpotlightMapImage;
      /**
       * WHAT EACH PIECE OF THE MAP IS, IN THE READING'S OWN WORDS — #2902.
       *
       * One name per piece, in the map's own id order, so `names[id - 1]` is
       * the thing piece `id` holds. It is carried because it was BOUGHT: the
       * pieces exist only because the picture was read, and discarding the
       * names would be the law's clause 4 failure (*read what the engine
       * already gives you*) in the one place the whole road turns on them.
       *
       * ⚠ **NOTHING ON THE SURFACE READS IT YET AND THAT IS DELIBERATE.** His
       * card keeps the map's contract so the client's hover and tap code is
       * reused rather than rewritten, and the tap still names its own cut on
       * its own road. This is the server's record of which piece is which —
       * the log quotes it, the measurement reads it, and a later slice that
       * wants to show a name has it without buying anything.
       */
      names: readonly string[];
      tally: SpotlightTally;
    }
  | { ok: false; why: string };

export type SpotlightTapped =
  | {
      ok: true;
      /** The cut, in the same encoding as the map: one piece, so every lit byte is 1. */
      cut: SpotlightMapImage;
      bounds: { x: number; y: number; width: number; height: number };
      /** The cut's own name, or `null` when the reader would not give a bare noun. */
      name: string | null;
      /**
       * The judge's fill, MEASURED AND REFUSING NOTHING — see the call site for
       * why this road has no floor.
       */
      fill: number | null;
      cutMs: number;
      nameMs: number;
      totalMs: number;
    }
  | { ok: false; why: string };

/**
 * OPEN A PHOTOGRAPH INTO A HIT-TEST MAP.
 *
 * ⚠ **THE SPLIT AND THE FACE DETECT RUN TOGETHER, AND THAT COSTS NO NEW
 * CONCURRENCY PATH.** Both go through `falRegionReader`'s own `post`, so both
 * spend from the existing `FAL_CONCURRENCY` pool of 6 — `assertFalBudget`
 * never sees a fifth path and the sum of declared allowances does not move
 * (CLAUDE.md: they already total exactly 20 of 20, and a fifth declared path
 * refuses boot). Running them in sequence would add the detect's ~1.8 s to a
 * 4.3–6.6 s road for nothing, because neither answer feeds the other.
 *
 * ⚠ **THE FACES MUST ARRIVE BEFORE `cleanSplit`, NOT AFTER IT.** §6 binds the
 * HOVER SET: the whole-person piece is dropped and every surviving piece has
 * the face boxes subtracted. `cleanSplit` runs both of those INSIDE itself and
 * before its own arbitration, because 3a-1 measured what happens otherwise —
 * the person piece contains the garment, so left in the contest it is deeper at
 * every one of the garment's pixels and takes the lot (the tank top fell from
 * 0.992 to 0.358). So the ordering here is split ∥ detect → clean, and the
 * faces are a parameter rather than a later pass.
 *
 * A detect that falls over is NOT a reason to refuse the picture, but it IS a
 * reason to refuse to LIGHT it: with no boxes, §6 cannot be kept, and a
 * spotlight that might light a face is the one failure this road may not have.
 */
export async function openSpotlight(input: {
  apiKey: string;
  frame: Buffer;
  /** The frame's own pixels, from the attachment row the loader already read. */
  size: { width: number; height: number };
  reader: RegionReader;
  /** The reading's engine — #2902. A picture with no engine does not light. */
  engine: TextEngine;
  signal?: AbortSignal;
  /** For the log alone — never part of any question asked of a provider. */
  about: { userId: number; attachmentPublicId: string };
}): Promise<SpotlightOpened> {
  const started = Date.now();
  const { pointer } = input.reader;
  if (pointer === undefined) {
    return { ok: false, why: "no-pointer" };
  }

  let splitMs = 0;
  let facesMs = 0;
  const splitAt = Date.now();
  const facesAt = Date.now();
  const [read, faces] = await Promise.all([
    piecesFromTheReading({
      frame: { bytes: input.frame, width: input.size.width, height: input.size.height },
      reader: input.reader,
      engine: input.engine,
      signal: input.signal,
      about: input.about,
    }).then((answer) => {
      splitMs = Date.now() - splitAt;
      return answer;
    }),
    pointer
      .call(input.reader, { image: input.frame, name: TAKE_FACE_NOUN, signal: input.signal })
      .then((answer) => {
        facesMs = Date.now() - facesAt;
        return answer;
      })
      .catch((cause: unknown) => {
        facesMs = Date.now() - facesAt;
        log.warn({ ...input.about, cause: String(cause) }, "the faces could not be read — the picture will not light");
        return null;
      }),
  ]);

  if (faces === null) return { ok: false, why: "no-faces-read" };
  if (!read.ok) return { ok: false, why: read.why };

  /*
    THE FACE'S OWN PIXELS, SO HAIR CAN BE A PIECE — #2902, and the fence stays.

    His ruling is quoted at `cleanSplit`'s subtraction and in
    `referenceSpotlightPieces.ts`: the rectangle ate the hair that frames a
    face, so what is subtracted off a KEPT piece is now the face's own mask.

    ⚠ **IT IS BOUGHT HERE AND NOT INSIDE `cleanSplit`, because that module
    takes no network and must not start.** Its header's own promise is *"masks
    in, masks out, no network, no provider, no clock"*.

    ⚠ **AND IT CANNOT RUN BESIDE THE DETECT, which is why it is a third read
    rather than a third arm of the `Promise.all` above**: the rectangle to cut
    inside is the detect's own answer, so it does not exist until that resolves.
    One cut per detected face, all started in the same turn, through the same
    `FAL_CONCURRENCY` pool — no new allowance.

    A failure is not a refusal: `null` means the rectangle stands in, which is
    exactly the fence that shipped. **Fail-closed, never fail-open.**
  */
  let faceMask: Mask | null = null;
  const { regionInBox } = input.reader;
  if (faces.length > 0 && regionInBox !== undefined) {
    const cut = await Promise.all(
      faces.map(async (box) => {
        try {
          return await regionInBox.call(input.reader, {
            image: input.frame,
            name: TAKE_FACE_NOUN,
            box,
            signal: input.signal,
          });
        } catch (cause) {
          log.warn(
            { ...input.about, cause: String(cause) },
            "a face's own pixels could not be read — its rectangle stands in",
          );
          return null;
        }
      }),
    );
    const read_ = cut.filter((mask): mask is Mask => mask !== null);
    /* EVERY face must have answered, or the rectangles stand in for ALL of
       them. A union of two faces' masks and one face's rectangle would be a
       fence with a hole in it exactly where a read failed, which is the one
       shape worse than the coarse fence. */
    if (read_.length === faces.length && read_.length > 0) {
      faceMask = unionMasks(...read_);
    }
  }

  const cleaned = cleanSplit(read.pieces.map((piece) => piece.mask), faces, faceMask);
  if (cleaned.pieces.length === 0) return { ok: false, why: "nothing-left-to-light" };

  let map: SpotlightMapImage;
  try {
    map = await encodeSpotlightMap(spotlightMapOf(cleaned.pieces));
  } catch (cause) {
    /* The disjointness assertion lives in the encoder and throwing is right
       there — but it is an upstream invariant, so here it is a picture that
       does not light rather than an ask that fails. */
    log.warn({ ...input.about, cause: String(cause) }, "the hit-test map could not be built");
    return { ok: false, why: "map-not-built" };
  }

  const { pieces: survivors, ...rest } = cleaned;

  /*
    WHICH NAME EACH SURVIVING PIECE CARRIES — DERIVED, NEVER MIRRORED (law 4).

    `cleanSplit` returns its survivors in ARRIVAL ORDER and lists every arriving
    piece that did not survive in `dropped[].at`. So the survivors are exactly
    the arriving indices that are not in `dropped`, in ascending order — read
    off the answer rather than tracked in a second list alongside it.

    ⚠ **AND IT IS CHECKED RATHER THAN TRUSTED.** If that derivation and the
    returned piece count ever disagree, the mapping from a map id to a name is
    wrong — which would show up as the wrong word on the right shape, the
    quietest defect available here. So it is asserted, and a mismatch makes the
    picture not light rather than light with the names shuffled.
  */
  const droppedAt = new Set(cleaned.dropped.map((one) => one.at));
  const names = read.pieces
    .map((piece, at) => ({ name: piece.name, at }))
    .filter(({ at }) => !droppedAt.has(at))
    .map(({ name }) => name);
  if (names.length !== survivors.length) {
    log.error(
      { ...input.about, derived: names.length, survivors: survivors.length },
      "the surviving pieces and their names do not line up — the picture will not light",
    );
    return { ok: false, why: "names-do-not-line-up" };
  }

  const tally: SpotlightTally = {
    ...rest,
    rawPieces: read.pieces.length,
    pieces: survivors.length,
    faces: faces.length,
    faceMaskRead: faceMask !== null,
    reading: read.tally,
    splitMs,
    facesMs,
    totalMs: Date.now() - started,
  };
  log.info(
    { ...input.about, ...tally, names, mapBytes: map.bytes.byteLength },
    "[referenceSpotlight] opened a picture",
  );
  return { ok: true, map, names, tally };
}

/**
 * TAKE WHATEVER IS UNDER THE FINGER, AND NAME IT.
 *
 * §3's order exactly: cut, cleaned and judged, faces subtracted in the bytes,
 * then named. The cut is honoured wherever the tap lands, lit or not — the
 * court found all four worn things including the earring and the necklace,
 * neither of which has a piece in the split at all.
 *
 * ⚠ **THE JUDGE'S FILL FLOOR DOES NOT APPLY ON THIS ROAD AND IS PASSED
 * `FILL_MEASURED_NOT_REFUSED` ON PURPOSE.** `judgeCut`'s `fill` is *claimed
 * pixels inside the ASKED BOX over that box's area* — it answers whether the
 * segmenter filled the rectangle a DETECTOR asked about. A tap has no asked
 * rectangle; the point is the whole prompt. Handing it the cut's own bounds
 * would compute a number that looks like the detector road's and means
 * something else entirely (how convex the piece is), which is the
 * matching-question precondition working law 4 carries. So the pipeline is
 * consumed for the half whose question matches — close the gaps, widen, feather
 * — and the fill is reported as a measurement that refuses nothing. Its other
 * refusals (`no-pixels`, `no-overlap`) still mean what they say.
 *
 * ⚠ **THE FACES ARE DETECTED HERE, AND THE OBVIOUS SAVING IS DECLINED ON
 * PURPOSE.** The open read already bought these exact rectangles — same
 * photograph, same frame coordinates — so carrying them over would save ≈0.5¢
 * and ~1.8 s a tap. It would also mean a rectangle around a customer's face
 * travelling to a browser and being accepted back as input, which is both a
 * thing that should not be on a wire and **a client-supplied way to turn §6's
 * fence off**: hand back no boxes and the face subtraction does nothing. There
 * is no server-side cache to read them from either, because nothing on this
 * road is stored (§10). So the detect is re-bought, and the cost is the price
 * of the fence being ours to keep.
 *
 * A detect that falls over refuses the tap rather than cutting without the
 * fence — §6 cannot be kept without the boxes, and a cut that might carry a
 * face is the one answer this road may not give. `referenceTake.ts` detects on
 * the flat cut instead, by its own recorded decision (#2831); if a tap is ever
 * measured to leave skin at a cut's edge, that precedent is the repair, and it
 * is an arm rather than a redesign.
 */
export async function tapSpotlight(input: {
  apiKey: string;
  frame: Buffer;
  at: { x: number; y: number };
  reader: RegionReader;
  engine: TextEngine;
  signal?: AbortSignal;
  about: { userId: number; attachmentPublicId: string };
}): Promise<SpotlightTapped> {
  const started = Date.now();
  const { pointer } = input.reader;
  if (pointer === undefined) return { ok: false, why: "no-pointer" };

  let faces: readonly PointerBox[];
  try {
    faces = await pointer.call(input.reader, {
      image: input.frame,
      name: TAKE_FACE_NOUN,
      signal: input.signal,
    });
  } catch (cause) {
    log.warn({ ...input.about, cause: String(cause) }, "the faces could not be read — the tap is refused");
    return { ok: false, why: "no-faces-read" };
  }

  const cutAt = Date.now();
  const raw = await cutAtPoint({
    apiKey: input.apiKey,
    image: input.frame,
    at: input.at,
    signal: input.signal,
  });
  const cutMs = Date.now() - cutAt;
  if (raw === null) return { ok: false, why: "nothing-under-the-tap" };

  const bounds = boundsOf(raw);
  if (bounds === null) return { ok: false, why: "nothing-under-the-tap" };

  /*
    ⚠ THE FACE IS SUBTRACTED TWICE, AND THE FIRST ONE IS A VERDICT RATHER THAN
    A CLEAN-UP. Found by this module's own suite rather than reasoned.

    `cleanCut` WIDENS a kept cut by `CUT_WIDEN_PX` before it is returned, so
    subtracting the faces only afterwards cannot answer *was this tap a face?*:
    a cut that was EXACTLY a face comes back as a two-pixel ring around it —
    non-empty, so it earns bounds, a name and a chip. A ring of nothing is not
    a takeable thing, and naming it would put a reader's guess on a tap that
    found a person.

    So the question is asked on the RAW cut, where it is exact and needs no
    invented threshold: if every pixel the segmenter returned sits inside a
    detected face box, the tap found only a face. The second subtraction, after
    the cleaning, is what makes the DELIVERED mask face-free — and it has to be
    that way round, because widening after a subtraction would grow the cut
    back INTO the face by those same two pixels.
  */
  if (faces.length > 0 && pixelsIn(subtractFaces(raw, faces)) === 0) {
    return { ok: false, why: "only-a-face-was-under-the-tap" };
  }

  const judged = await cleanCut({ mask: raw, box: bounds, fillFloor: FILL_MEASURED_NOT_REFUSED });
  if (judged.mask === null) {
    log.info({ ...input.about, why: judged.verdict.why }, "[referenceSpotlight] the tap's cut was refused");
    return { ok: false, why: `cut-refused:${judged.verdict.why ?? "unknown"}` };
  }

  /* §6, in the bytes: a photo of a person carries the piece and never the
     person. `subtractFaces` is consumed and never rewritten. */
  const bare: Mask = faces.length > 0 ? subtractFaces(judged.mask, faces) : judged.mask;
  const bareBounds = boundsOf(bare);
  if (bareBounds === null) return { ok: false, why: "only-a-face-was-under-the-tap" };

  const nameAt = Date.now();
  const name = await nameTheCut({ frame: input.frame, mask: bare, engine: input.engine });
  const nameMs = Date.now() - nameAt;

  let cut: SpotlightMapImage;
  try {
    cut = await encodeSpotlightMap(spotlightMapOf([bare]));
  } catch (cause) {
    log.warn({ ...input.about, cause: String(cause) }, "the tap's cut could not be encoded");
    return { ok: false, why: "cut-not-encoded" };
  }

  log.info(
    { ...input.about, named: name !== null, fill: judged.verdict.fill, cutMs, nameMs },
    "[referenceSpotlight] took a tap",
  );
  return {
    ok: true,
    cut,
    bounds: bareBounds,
    name,
    fill: judged.verdict.fill,
    cutMs,
    nameMs,
    totalMs: Date.now() - started,
  };
}
