/**
 * THE OPEN LANE'S ACCEPTANCE PATH — step 5a (OPEN_LANE_DESIGN_NOTE §8 step 5,
 * ordered fable-874 §3).
 *
 * # Where this sits, and why it is a module rather than a branch
 *
 * `readDelta` guards the boundary where a model's reply enters the record, and
 * it must stay closed to open kinds: a reader free to accept a model-authored
 * subject key hands the composition key to the model with no closed lane in
 * front of it, and *"give her wings"* stops being eyeliner (§8 step 0 — the one
 * choice that cannot be retrofitted). So the reader RECORDS what it did not own
 * (`FreeLaneCheck.unowned`) and this decides, after the closed lane has already
 * declined. Kept out of `refineInterpreter` so it can be driven directly, which
 * is the only way the walls below are proven without a model in the loop.
 *
 * # The lane is a FALLBACK, never a peer
 *
 * Reached only when no closed subject claimed the ask, and `normalizeOpenKind`
 * checks its own answer against the closed vocabulary before anything counts as
 * new. A collision is not a new kind — it is a ROUTING BUG, and it refuses
 * rather than minting a key that shadows a subject the product already owns.
 *
 * # Every guard the free lane runs, the open lane runs (§2, property 3)
 *
 * The open lane widens *what may be named* and must widen nothing else. The
 * words are brand-scrubbed, length-capped, and — the one that matters most —
 * held to SOURCE CONTAINMENT against the customer's own sentence, because there
 * is no vocabulary here to fall back on: an unelaborated ask is the only thing
 * standing between *"a scar on her cheek"* and *"a long knife scar"*.
 *
 * # ONE OPEN KIND PER INSTRUCTION, declared
 *
 * The normalizer is asked *"what is the THING"* of a whole sentence and its
 * three stability bars were measured on that question (§1). Asking it once per
 * unowned subject would be asking a question nobody measured, and a sentence
 * naming two uncatalogued things is not a shape this lane has ever been shown.
 * So one call, one kind, and a second unowned subject is recorded as demand and
 * not filed.
 *
 * # WHAT IT DOES NOT DO
 *
 * It refuses NOTHING on visibility (founder ruling, fable-869 §2): an ask whose
 * region is not in the current frame is accepted and rides as words. And it
 * mints no crop and asks for none — a paired open kind carries no crop until
 * promotion (fable-872 §2), and nothing here can yet tell a pair from a single,
 * so the conservative reading holds for every kind.
 */
import { createModuleLogger } from "../logging/logger";
import { normalizeOpenKind, openKindFromSubjectKey, type OpenKindReading } from "./openLaneKind";
import { scrubBrands } from "./brandScrub";
import { stageWordIn, stemmedContainment, type OpenKindAsk } from "./refineDelta";
import type { TextEngine } from "../providers/types";

const log = createModuleLogger("castingV2/openLaneAccept");

/**
 * The longest an open kind's words may be.
 *
 * The free lane's own ceiling, quoted rather than shared — see
 * `openLaneKind`'s note on the same number: two different questions asked of
 * two different writers, and if they ever must be one number the way to do it
 * is to export that one rather than to widen this one quietly.
 */
const MAX_OPEN_WORDS = 120;

/**
 * What the acceptance produced.
 *
 * `outcome` is the demand table's own vocabulary, so the row a caller writes is
 * not a second translation of this answer (working law 4). `words_only` is what
 * an ACCEPTED open kind is today and that is not a placeholder: with no crop it
 * is carried by words alone, which is exactly what the pair ruling's
 * conservative interim leaves it as.
 */
export type OpenLaneAcceptance =
  | { ok: true; kind: string; ask: OpenKindAsk; outcome: "words_only" }
  | {
    ok: false;
    /** `collides` — the closed lane owns this noun and the ask was misrouted.
     *  `unreadable` — the normalizer could not name the thing at all.
     *  `unfileable` — a guard the free lane also runs turned the words away. */
    reason: "collides" | "unreadable" | "unfileable";
    /** Present when a key was minted before the refusal, so demand can still be
     *  recorded against the noun somebody actually asked for. */
    kind?: string;
    outcome: "refused" | "unreadable";
  };

/**
 * THE OUTCOME OF AN ACCEPTED ASK IS WRITTEN WHERE THE ASK ENDS — not here (5b
 * Stage D, ruled fable-896 §4).
 *
 * Until 5b there was nothing to wait for: no crop could ever mint, so
 * `words_only` at the acceptance door was true by construction. Now it is a
 * PREDICTION, and migration 0031's own prose says what the column means —
 * *"words_only: served without a reference crop … the number that answers the
 * founder's one open question"*. A row written before the render cannot say that.
 *
 * So: **a refusal writes at the door**, because there the door IS terminal, and
 * an accepted ask writes ONE row when its render settles — `delivered` (a crop
 * filed), `words_only` (served, no crop) or `refunded`. One ask, one row, or the
 * promotion decision divides by a denominator holding both halves of the same
 * ask.
 *
 * {@link openLaneOutcomeOf} is that decision, here rather than at the two call
 * sites, so the delivered path and the refund path cannot come to disagree about
 * what a stored crop means (working law 4).
 */
export function openLaneOutcomeOf(input: {
  /** Whether the render settled at all, or handed the money back. */
  settled: boolean;
  /** True when the mint stored a crop for this kind on this render. */
  cropStored: boolean;
  /**
   * A DOOR TURNED IT AWAY BEFORE ANYTHING WAS CHARGED.
   *
   * `refused` and `refunded` are two different facts and the table keeps them
   * apart on purpose: one cost the customer nothing and one moved money and gave
   * it back. Collapsed into `refunded`, a lane refusing everything for free would
   * read as a lane charging and refunding — the loudest promotion case there is,
   * manufactured out of a lane that never spent a credit.
   */
  refusedFree?: boolean;
}): "delivered" | "words_only" | "refunded" | "refused" {
  if (input.refusedFree) return "refused";
  if (!input.settled) return "refunded";
  return input.cropStored ? "delivered" : "words_only";
}

/**
 * Name and file the thing an out-of-vocabulary ask is about.
 *
 * Spends one text call and never a credit. Fails CLOSED at every door: no
 * engine, no key; no key, no filing.
 */
export async function acceptOpenKind(input: {
  /** The customer's own sentence — the source containment is measured against. */
  instruction: string;
  /** What `readDelta` did not own, in the order it met them. */
  unowned: ReadonlyArray<{ subject: string; value: unknown }>;
  engine?: TextEngine | null;
  signal?: AbortSignal;
}): Promise<OpenLaneAcceptance | null> {
  if (input.unowned.length === 0) return null;
  if (input.unowned.length > 1) {
    /* Not a refusal — the first is still read. Logged because a sentence naming
       two uncatalogued things is a shape the bars were never measured on, and
       how often it happens is a fact the promotion design wants. */
    log.info(
      { subjects: input.unowned.length },
      "[openLaneAccept] one instruction named more than one unowned subject; reading the first",
    );
  }

  const named: OpenKindReading = await normalizeOpenKind(input.instruction, {
    ...(input.engine ? { engine: input.engine } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  /*
    ⚠ WHEN THE NAMER ANSWERS ABOUT THE WRONG HALF OF THE SENTENCE
    (fable-1371 §A; mechanism read at the raw reply, opus-1026 §2).

    `normalizeOpenKind` is handed the whole instruction. One uncatalogued thing
    in a sentence is fully determined and it answers correctly; TWO things — one
    closed, one open — is under-determined, and it picks the first salient noun.
    Measured 2/2 on the founder's own repair sentence:

      interpreter  {"free": {"horns": "…", "orb": "…"}}    ← BOTH, correctly
      normalizer   {"kind": "horns"}                       ← the CLOSED one
      → collides → refused as a routing bug → the orb filed nothing at all

    He paid 25 credits, received the horns, and got no sentence about the orb.
    The collision guard was doing its job on the wrong noun.

    So a collision now asks a second question before it refuses — of OUR OWN
    RECORD, never of the model: *is the subject the parse could not file itself
    a usable kind?* `orb` is; `cheeks` (§1's measured routing bug) is not,
    because it collides in turn and the refusal below stands unchanged.

    No new call, no credit, and deliberately NO CHANGE to the normalizer's
    prompt: its bars were measured on the sentence as it stands, and a subset of
    prompt context has already been measured moving routing in this very lane.
  */
  const rescued = named.ok || named.reason !== "collides"
    ? null
    : (() => {
      const fromRecord = openKindFromSubjectKey(input.unowned[0]!.subject);
      if (!fromRecord.ok) return null;
      log.info(
        { named: named.kind, rescued: fromRecord.kind },
        "[openLaneAccept] the namer answered about a closed subject; the parse's own unowned key is the kind",
      );
      return fromRecord;
    })();
  const reading: OpenKindReading = rescued ?? named;

  if (!reading.ok) {
    if (reading.reason === "collides") {
      /*
        THE GUARD WORKING, NOT THE LANE FAILING — and it refuses rather than
        files. The closed lane owns this noun, so the honest outcome is that the
        ask was misrouted on the way here; minting `open:<noun>` would put a
        second key over a subject the product already has a vocabulary, a court
        and a carrier for. Each occurrence names either a missing entry in
        `SUBJECT_NOUNS` or a real gap in the closed interpreter's routing, which
        is why the subject travels on the log line.
      */
      log.warn(
        { kind: reading.kind, subject: reading.subject },
        "[openLaneAccept] the open key names a closed subject — refused as a routing bug, not filed",
      );
      return { ok: false, reason: "collides", kind: reading.kind, outcome: "refused" };
    }
    return { ok: false, reason: "unreadable", outcome: "unreadable" };
  }

  /*
    THE WORDS ARE THE CUSTOMER'S, AND THIS IS WHERE THAT IS PROVED.

    The value under an unowned subject is model-authored text: the interpreter's
    reading of a sentence, not the sentence. It faces the same question every
    free value faces — did they say it? — and it faces it harder, because the
    closed lane has a vocabulary to fall back on and this one has nothing. A
    value that fails containment is not filed under a softer rule here.
  */
  const raw = input.unowned[0]!.value;
  const said = typeof raw === "string" ? raw : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : null;
  if (said === null) {
    return { ok: false, reason: "unfileable", kind: reading.kind, outcome: "refused" };
  }
  const scrubbed = scrubBrands(said.trim())?.trim() ?? "";
  if (!scrubbed || scrubbed.length > MAX_OPEN_WORDS) {
    return { ok: false, reason: "unfileable", kind: reading.kind, outcome: "refused" };
  }
  /*
    WALL (b) STAYS EXACTLY WHERE IT IS — §2, property 3, and this is the door
    that would have quietly dropped it.

    The open lane widens *what may be named* and must widen nothing else. An
    open lane that accepts *"horns"* must still refuse *"put her in a red
    coat"*, and without this it would not have: the closed reader refuses a
    garment by having no subject to file it under, so `coat` arrives here as an
    unowned subject like any other and the lane would have minted `open:coat` —
    turning the one wall that keeps a face edit from repainting the room into
    the lane's own front door.

    Asked of the NOUN as well as the words, because that is where the garment
    is: `{coat: "red"}` has no stage word in its value and the whole ask in its
    key. The accessory carve-out travels with the lexicon, so *"wearing small
    gold hoops"* is unaffected.
  */
  const scenery = stageWordIn(reading.noun) ?? stageWordIn(scrubbed);
  if (scenery !== null) {
    log.info(
      { kind: reading.kind, word: scenery },
      "[openLaneAccept] an out-of-vocabulary ask names the stage — wall (b) holds, nothing filed",
    );
    return { ok: false, reason: "unfileable", kind: reading.kind, outcome: "refused" };
  }

  const strip = (text: string) => text.replace(/['’]/g, "");
  if (!stemmedContainment(strip(scrubbed), strip(input.instruction))) {
    log.info(
      { kind: reading.kind },
      "[openLaneAccept] the words for an open kind are not in the customer's sentence — refused",
    );
    return { ok: false, reason: "unfileable", kind: reading.kind, outcome: "refused" };
  }

  return {
    ok: true,
    kind: reading.kind,
    ask: { noun: reading.noun, words: scrubbed },
    outcome: "words_only",
  };
}
