/**
 * THE SPOTLIGHT'S PIECES, FROM THE READING — #2902, his eye on the live picker.
 *
 * ## His words, which are the whole of the specification
 *
 * On the picker as slice 3b shipped it (2026-10-31, his own account, verbatim):
 *
 * > *"i shouldnt be able to select the background i should also be able to
 * > select her hair the selector is so bad like i select her pants and only half
 * > her pants light up i select her shoe and only 1 shoes lights up and her top
 * > only the bra part lights up whats cuasing thius is the image analyzer just
 * > really bad why is everything being compartmentalized?"*
 *
 * **The last clause is the diagnosis, and it is wrong in an instructive way:
 * the analyser was not involved at all.** The pieces came from `splitAtPoints`
 * — a grid of 32 point prompts into SAM 3 — so each piece was *whatever region
 * surrounds this dot*, and a dot knows nothing about what a thing IS. A dot on
 * the floor gives a floor piece; a dot on one shoe gives one shoe; half the
 * pants and the bra part of the top are the same mechanism. Nothing downstream
 * could repair it: `cleanSplit` arbitrates and de-duplicates, but **it cannot
 * make two disconnected shoes one thing**.
 *
 * So this module is the other road. **A piece is a thing the picture was READ
 * to contain, cut whole by its own name** — which makes each of his four
 * complaints a property of the construction rather than a defect to tune out:
 *
 * | his complaint | what this road does about it |
 * |---|---|
 * | half the pants light | ✅ the cut is asked for `pants` inside the pants' own rectangle, so the answer is the pair |
 * | one shoe lights | ✅ likewise for the shoes — one name, one cut, both of them |
 * | the hair cannot be selected | ✅ hair is a name like any other, and the face fence that used to eat it is now pixel-exact ({@link SPOTLIGHT_FACE_FENCE_NOTE}) |
 * | the background is selectable | ⚠ **NOT FIXED BY THIS ROAD — MEASURED, NOT ASSUMED** |
 *
 * ⚠ **THE BACKGROUND ROW IS THE ONE TO READ, BECAUSE THIS HEADER CLAIMED THE
 * OPPOSITE UNTIL IT WAS DRIVEN.** It said *"only things on or worn by the
 * subject are named, so the background has no name and therefore no piece"* —
 * which is what `REFERENCE_DISCOVERY_SYSTEM_PROMPT` ASKS FOR (*"if there is a
 * person, what they are wearing and what is on them; if it is a standalone
 * item, that item and its parts"*) and is **not what the reading returns.**
 * Driven through the real providers on his own three fixtures, 2026-10-31: the
 * worn photograph named `plant` and `chair`, and the hanger shot named `rail`
 * and `hanger` — and `plant`, `rail` and `hanger` all survived to become
 * pieces. So the structural claim was false and the honest statement is
 * narrower: **the background is no longer selectable AS A SIDE EFFECT of a grid
 * dot landing on it, and it is still selectable when the reading names it.**
 * That is a prompt-adherence question with its own card and its own
 * measurement; it is not fixed here and is not claimed to be.
 *
 * ⚠ **AND THE OTHER MEASURED COST, STATED OUT LOUD because the law's clause 3
 * requires it**: this road is 30.3 s / 82.5 s / 85.1 s on those three fixtures
 * at native size against the grid's 17.6 s / 20.3 s, and it buys 15–26 fal
 * calls where the grid bought 2. The dominant term is FRAME SIZE — boxing and
 * cutting a 1536x1024 photograph took 35 s and 28 s — and a bound on the long
 * edge before the road is the repair the catalogue already calls owed. **It is
 * a separate card on purpose**: it changes the size of the map a browser
 * hit-tests against, so it wants a render in front of eyes and not a late-night
 * guess.
 *
 * ## What it is made of, and all of it already existed
 *
 * Three roads, none of them new, which is the fidelity law read forwards: the
 * picture is READ by `readReferencePicture` (the full frame first, a head crop
 * only if a person is in it, at most {@link REFERENCE_MARKER_CAP} names), BOXED
 * by `markReferenceThings` (one gathered request to the pointer boxer), and
 * each name is CUT by `regionInBox` — the same one-box-per-call road #2532
 * measured and the take has used since it shipped.
 *
 * ⚠ **THIS IS THE SECOND CONSUMER OF THE FIRST TWO HALVES, AND IT IS
 * DELIBERATELY NOT `readAndMarkReference`.** That function is their existing
 * composition and it is still dark with no production caller — the flag
 * catalogue says so in its own entry. It is not called here for one reason that
 * would otherwise put a lie in the log: its `about` takes a
 * `candidatePublicId`, and what this road holds is an ATTACHMENT's public id.
 * Its two halves are imported directly instead, so nothing is duplicated and no
 * log line claims an id it was never given.
 *
 * ## Every failure is local to one name
 *
 * Inherited verbatim from the two roads below it, because it is the property
 * the whole surface rests on: a reading that fails leaves no pieces and the
 * attach exactly as it looks today; a detector that falls over on one noun
 * drops that marker; **a cut that comes back empty drops that piece and leaves
 * every other one exactly as it was.** Nothing here throws at its caller.
 *
 * ## What it does NOT do
 *
 * It does not arbitrate, de-duplicate, fill or fence — `cleanSplit` owns all of
 * that and is handed what this returns. It stores nothing and charges nothing:
 * the first mint is still slice 4's. And it does not change what a TAP does — a
 * tap still cuts at the point and names its own cut, which is its own road and
 * its own card.
 */

import { createModuleLogger } from "../logging/logger";
import type { DiscoveredFeature, FeatureKind } from "./faceDiscovery";
import type { Mask } from "./maskedComposite";
import type { PointerBox, RegionReader } from "./maskedRefine";
import { markReferenceThings, readReferencePicture, REFERENCE_MARKER_CAP } from "./referenceDiscovery";
import type { TextEngine } from "../providers/types";

const log = createModuleLogger("casting-reference-spotlight-pieces");

/**
 * WHY THE FACE FENCE CHANGED SHAPE WITH THIS CARD, AND WHOSE DECISION THAT WAS.
 *
 * `referenceSplitCleanup.ts` recorded the cost of the old fence in its own
 * header and named the repair as reserved: *"the HAIR's hover region shrinks,
 * 0.935 → 0.503 … the tempting repair — exempting hair from the subtraction, or
 * trimming the box to the face's mask — is a change to the likeness fence and
 * is **his**, never a builder's."*
 *
 * **He has now ruled it**, in the card this module is built for: *"i should
 * also be able to select her hair"*, and the card's own clause — **"Hair is a
 * piece. The face still never lights."** Those two sentences together are
 * precisely the SECOND of the two repairs that paragraph forbade a builder from
 * choosing: the subtraction is trimmed to the face's own MASK instead of its
 * rectangle, so hair that frames a face survives and no pixel OF the face does.
 *
 * It is NOT the first repair — exempting a piece by name — and that distinction
 * is the point: an exemption list would be a fixed list deciding where the
 * fence applies, which is the thing his 2026-09-24 ruling forbids (*"we really
 * cannot be working from fixed lists in a fluid editing application"*). A mask
 * applies to every piece equally and knows no names.
 *
 * ⚠ **AND IT FAILS CLOSED TO THE OLD FENCE, which is why it may ship at all.**
 * The mask is one more segmenter read, and a read can fail; when it does, the
 * rectangle is subtracted exactly as it is today. So the worst case of the new
 * road is the measured behaviour of the old one, and the fence is never the
 * thing that goes missing.
 */
export const SPOTLIGHT_FACE_FENCE_NOTE =
  "the face's own mask is subtracted, not its rectangle; a mask that cannot be read falls back to the rectangle";

/** One thing the picture was read to contain, cut whole. */
export type SpotlightPiece = {
  /** The reading's own bare noun — what the thing IS, in a person's words. */
  readonly name: string;
  /** What sort of thing it is, carried from the reading rather than re-asked. */
  readonly kind: FeatureKind;
  /** The cut, at the frame's own size. */
  readonly mask: Mask;
  /** The rectangle the cut was asked inside. */
  readonly box: PointerBox;
};

/** Every number the road spent, for the log and the measurement — never for a customer. */
export type PiecesTally = {
  /** How many names the reading brought back. */
  readonly named: number;
  /** How many of those the boxer put a rectangle round. */
  readonly marked: number;
  /** Named and not marked — past the cap, not a bare noun, or nothing found. */
  readonly unmarked: readonly string[];
  /** How many cuts were asked for. */
  readonly cutsAsked: number;
  /** How many came back with a mask. */
  readonly cutsAnswered: number;
  /** Whether the picture held a person, as the reading itself answered. */
  readonly personPresent: boolean;
  /** Which crops answered, so a half-answer is legible rather than mysterious. */
  readonly crops: readonly ("head" | "full")[];
  readonly readMs: number;
  readonly markMs: number;
  readonly cutMs: number;
};

export type PiecesFromReading =
  | { readonly ok: true; readonly pieces: readonly SpotlightPiece[]; readonly tally: PiecesTally }
  | { readonly ok: false; readonly why: string };

/**
 * READ THE PICTURE, BOX WHAT IT NAMED, CUT EACH NAME WHOLE.
 *
 * The three stages are inherently sequential, and that is a latency fact rather
 * than an implementation choice: the boxer cannot be asked until there are
 * names, and a rectangle cannot be cut until it exists. What IS parallel is
 * every cut — they all start in the same turn of the event loop, so they share
 * the segmenter's existing `FAL_CONCURRENCY` pool of 6 and **no new concurrency
 * path is declared** (`assertFalBudget` never sees one; CLAUDE.md's five
 * allowances already total exactly 20 of 20, and a sixth refuses boot).
 */
export async function piecesFromTheReading(input: {
  readonly frame: { readonly bytes: Buffer; readonly width: number; readonly height: number };
  readonly reader: RegionReader;
  readonly engine: TextEngine;
  readonly signal?: AbortSignal;
  /** For the log alone — never part of any question asked of a provider. */
  readonly about: { readonly userId: number; readonly attachmentPublicId: string };
}): Promise<PiecesFromReading> {
  const { regionInBox } = input.reader;
  if (regionInBox === undefined) return { ok: false, why: "no-cutter" };

  const readAt = Date.now();
  const reading = await readReferencePicture({ frame: input.frame, engine: input.engine });
  const readMs = Date.now() - readAt;
  if (!reading.ok) {
    log.info(
      { ...input.about, why: reading.why, readMs },
      "[referenceSpotlightPieces] the picture was not read — it does not light, and the words road is untouched",
    );
    return { ok: false, why: `not-read:${reading.why}` };
  }

  const markAt = Date.now();
  let marked: { markers: readonly { name: string; kind: FeatureKind; box: PointerBox }[]; unmarked: string[] };
  try {
    marked = await markReferenceThings({
      picture: input.frame.bytes,
      features: reading.features as readonly DiscoveredFeature[],
      reader: input.reader,
      signal: input.signal,
    });
  } catch (cause) {
    /* Belt and braces: the marker road handles a failure per name, so reaching
       here means something structural. It still fails open. */
    log.warn({ ...input.about, cause: String(cause) }, "[referenceSpotlightPieces] the names could not be boxed");
    return { ok: false, why: "not-boxed" };
  }
  const markMs = Date.now() - markAt;
  if (marked.markers.length === 0) {
    log.info(
      { ...input.about, named: reading.features.length, readMs, markMs },
      "[referenceSpotlightPieces] nothing in the picture got a rectangle — it does not light",
    );
    return { ok: false, why: "nothing-boxed" };
  }

  /*
    EVERY CUT STARTS IN THE SAME TURN, AND ITS ANSWER IS KEPT BESIDE ITS NAME.

    `Promise.all` over the markers PRESERVES ORDER, which is load-bearing
    downstream for the same reason it is in `splitAtPoints`: a surviving piece's
    position becomes its id in the hit-test map. The markers arrive largest-first
    from the reading road, so the ids run largest-first too.

    A cut that throws or comes back with nothing is ONE missing piece and never a
    failed picture — the per-name tolerance the two roads above already hold.
  */
  const cutAt = Date.now();
  const cuts = await Promise.all(
    marked.markers.map(async (marker): Promise<SpotlightPiece | null> => {
      try {
        const mask = await regionInBox.call(input.reader, {
          image: input.frame.bytes,
          name: marker.name,
          box: marker.box,
          signal: input.signal,
        });
        if (mask === null) return null;
        return { name: marker.name, kind: marker.kind, mask, box: marker.box };
      } catch (cause) {
        log.warn(
          { ...input.about, name: marker.name, cause: String(cause) },
          "[referenceSpotlightPieces] one thing could not be cut — the rest of the picture still lights",
        );
        return null;
      }
    }),
  );
  const cutMs = Date.now() - cutAt;
  const pieces = cuts.filter((piece): piece is SpotlightPiece => piece !== null);

  const tally: PiecesTally = {
    named: reading.features.length,
    marked: marked.markers.length,
    unmarked: marked.unmarked,
    cutsAsked: marked.markers.length,
    cutsAnswered: pieces.length,
    personPresent: reading.personPresent,
    crops: reading.crops,
    readMs,
    markMs,
    cutMs,
  };

  if (pieces.length === 0) {
    log.info(
      { ...input.about, ...tally },
      "[referenceSpotlightPieces] nothing could be cut — the picture does not light",
    );
    return { ok: false, why: "nothing-cut" };
  }

  log.info(
    { ...input.about, ...tally, names: pieces.map((piece) => piece.name) },
    "[referenceSpotlightPieces] cut the picture into the things it was read to hold",
  );
  return { ok: true, pieces, tally };
}

export { REFERENCE_MARKER_CAP };
