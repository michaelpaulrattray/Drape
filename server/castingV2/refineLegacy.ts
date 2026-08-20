/**
 * Reading deltas written by OLDER BUILDS of this program (D-182).
 *
 * # The defect this exists because of
 *
 * The founder's verification chain — eleven instructions deep, spanning most of
 * M8's schema history — was rendered as *the original plus pink hair*. The
 * mullet, the seafoam eyes, the hooded lids, the smokey eye, the smile: all
 * gone from the picture while the record listed every one of them correctly.
 *
 * The chain's older rows file their free lane under `hair` and `eyes`, the
 * single slots that existed before hair was split into cut/shade/pattern/worn
 * and eyes into colour/shape. `readDelta` rejects an unknown subject by
 * returning **null for the entire delta** — which is right for a model reply,
 * because an invented key means the reply cannot be trusted at all. Applied to
 * a STORED row it means one retired key erases eleven instructions.
 *
 * And it was swallowed: the composition read `readDelta(predecessor) ?? {}`, so
 * "unreadable" and "there was nothing" were the same value. The money moved on
 * an input the code had already decided it could not read.
 *
 * # Two different questions, and they deserve different answers
 *
 * A **model reply** with an unknown key is a reply to distrust — the vocabulary
 * is closed on purpose and a new key is either a hallucination or a version
 * skew. Strict rejection stays.
 *
 * A **stored row** with an unknown key is our own past. It was written by this
 * program, from the user's own words, and it has already been paid for. The
 * only honest reading is to carry it forward.
 *
 * # What the mapping may and may not decide
 *
 * The legacy slots held whatever the single facet meant that day, so the value
 * has to be classified rather than merely renamed: production holds `hair` as
 * "mullet", as "the colour of rosé" and as "worn down". Classification uses the
 * SAME vocabularies the roll draws from, and the residual is the slot's
 * historical dominant meaning — colour for hair, colour for eyes — because the
 * split happened when a second meaning appeared, not the first.
 *
 * It never invents a value and it never drops one. A value it cannot place
 * still travels; it simply travels in the drawer the slot used to mean.
 */
import { REFINABLE_CUT_NAMES } from "./hairStyles";
import { EYE_SHAPES } from "../../shared/castingRealization";
import { readAppliedInk } from "./inkApplied";
import { closedSubjectFor, readOpenKinds } from "./openLaneKind";
import { readDelta, type FreeValue, type OpenKindAsk, type RefineDelta } from "./refineDelta";
import type { FreeSubject } from "./refineSubjects";

/** Subjects that no longer exist, and the modern facets they split into. */
const RETIRED_SUBJECTS = ["hair", "eyes"] as const;

/** Worn is styling, never the cut — the distinction that earned `hairWorn`. */
const WORN_WORDS = [
  "worn", "tied", "up", "down", "back", "loose", "ponytail", "bun", "braid",
  "braided", "pinned", "half", "swept",
];

const CUT_WORDS = [
  "mullet", "bob", "pixie", "shag", "crop", "cropped", "fringe", "bangs",
  "layers", "layered", "buzz", "undercut", "wolf", "lob", "cut",
];

const EYE_SHAPE_WORDS = [
  "hooded", "almond", "round", "fox", "upturned", "downturned", "monolid",
  "wide", "deep", "set", "shape", "lift", "lifted",
];

const words = (value: string) => value.toLowerCase().split(/[^a-z]+/).filter(Boolean);
const namesAny = (value: string, list: readonly string[]) =>
  words(value).some((word) => list.includes(word));

/**
 * Which modern subject a legacy `hair` value belongs to.
 *
 * Cut first, because a named cut is unambiguous; worn second, because "worn
 * down" and "tied up" are styling and were the reason `hairWorn` exists at all;
 * colour last, as the slot's historical meaning.
 */
function hairSubjectFor(value: string): "hairCut" | "hairWorn" | "hairShade" {
  const lowered = value.toLowerCase();
  if ((REFINABLE_CUT_NAMES as readonly string[]).some((cut) => lowered.includes(cut.toLowerCase()))) {
    return "hairCut";
  }
  if (namesAny(value, CUT_WORDS)) return "hairCut";
  if (namesAny(value, WORN_WORDS)) return "hairWorn";
  return "hairShade";
}

/** Which modern subject a legacy `eyes` value belongs to. */
function eyeSubjectFor(value: string): "eyeShapeFree" | "eyeColourFree" {
  const lowered = value.toLowerCase();
  if ((EYE_SHAPES as readonly string[]).some((shape) => lowered.includes(shape.toLowerCase()))) {
    return "eyeShapeFree";
  }
  return namesAny(value, EYE_SHAPE_WORDS) ? "eyeShapeFree" : "eyeColourFree";
}

/** True when this stored object carries a subject the vocabulary has retired. */
export function namesRetiredSubject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const free = (value as { free?: unknown }).free;
  if (!free || typeof free !== "object") return false;
  return RETIRED_SUBJECTS.some((subject) => subject in (free as Record<string, unknown>));
}

/**
 * A stored delta, translated into today's vocabulary.
 *
 * Returns a NEW object; the row is never rewritten. A migration would have to
 * classify every historical row in one pass with no way to check the result
 * against the picture it produced, and it would be irreversible — this runs at
 * read time, where a mistake is a bug rather than a lost record.
 */
export function migrateStoredDelta(value: unknown): unknown {
  if (!namesRetiredSubject(value)) return value;
  const raw = value as { free?: Record<string, unknown> };
  const free: Record<string, unknown> = { ...(raw.free ?? {}) };

  const legacyHair = free.hair;
  const legacyEyes = free.eyes;
  delete free.hair;
  delete free.eyes;

  /*
    A modern key already present WINS. The newer write is the more recent
    statement of that facet, and the legacy slot is by definition older.
  */
  if (typeof legacyHair === "string" && legacyHair.trim()) {
    const subject = hairSubjectFor(legacyHair);
    if (free[subject] == null) free[subject] = legacyHair;
  }
  if (typeof legacyEyes === "string" && legacyEyes.trim()) {
    const subject = eyeSubjectFor(legacyEyes);
    if (free[subject] == null) free[subject] = legacyEyes;
  }

  return { ...(value as Record<string, unknown>), free };
}

/**
 * Read a delta THIS PROGRAM WROTE — the only reader legacy rows go through.
 *
 * Separate from `readDelta` on purpose: the strict reader guards the boundary
 * where a model's reply enters the record, and that boundary must stay closed.
 * This one guards the boundary where our own history re-enters, and history
 * cannot be made to have used today's names.
 */
export function readStoredDelta(value: unknown): RefineDelta | null {
  /*
    AND THE OPEN LANE'S OWN KINDS, WHICH `readDelta` DELIBERATELY CANNOT SEE.

    The strict reader guards the boundary where a model's reply enters the
    record, and it must stay closed to `open`: a reply free to name its own kind
    routes an ask into the open lane before the closed one has declined, and the
    lane stops being a fallback (`OPEN_LANE_DESIGN_NOTE.md` §8 step 0). This
    reader guards our own past, where a key we wrote is a fact already paid for.

    Exactly the split this module's header draws for retired subjects, arriving
    for a second reason.

    Promotion runs on the RAW object, before the strict reader, for the same
    reason `migrateStoredDelta` does: a value moved into the closed lane must
    pass that lane's own guards and come back in that lane's own shape. Written
    onto the delta afterwards it would skip both — and `horns` is plural, so it
    would arrive as a bare string where every other reader expects a list.
  */
  const migrated = promoteOpenKinds(migrateStoredDelta(value));
  const open = readOpenKinds(migrated);
  /*
    AND THE DESIGNS ALREADY ON HER, WHICH `readDelta` IS ALSO BLIND TO — and
    blind for a sharper reason than the open lane's (shape A, fable-1167 §2a).

    A model free to name a design id would be choosing which of a customer's
    eight designs gets painted onto her body, which is `inkDesignForAsk`'s
    decision and no reply's. So the strict reader must never produce this
    field, and this reader — guarding our own past, where a key we wrote is a
    fact already paid for — carries it forward unchanged.

    Re-attached rather than left to `readDelta` for the same mechanical reason
    `open` is: the strict reader cannot see it, so it would be dropped on every
    read and the tattoo would be lost on the very edit this exists to survive.
  */
  const inkApplied = readAppliedInk(migrated);
  const delta = readDelta(migrated);
  if (delta !== null) {
    return {
      ...delta,
      ...(open === null ? {} : { open }),
      ...(inkApplied === null ? {} : { inkApplied }),
    };
  }
  /*
    A NULL FROM THE STRICT READER MEANS TWO DIFFERENT THINGS, and telling them
    apart is the whole of D-182's lesson said once more.

    *"An empty delta is not a delta"* — so a step whose ONLY ask was an open
    kind reads as null, and treating that as unreadable would refuse the render
    and lose the branch. But a row with other content that the reader rejected
    is genuinely unreadable, and carrying the open kind out of it alone would be
    the original defect in a new coat: eleven instructions erased, one carried,
    and the money moving on an input the code had already decided it could not
    read.

    So the discriminator is what else is in the row.
  */
  if (open === null) return null;
  /*
    `inkApplied` joins `open` on the LEFT of this discriminator, and it is not a
    widening: both are fields the strict reader cannot see, so counting either
    as "other content" would mean a step the strict reader legitimately reads as
    empty is declared unreadable for carrying a field we wrote ourselves.

    An ink step always carries its own words (`free.ink`), so a delta holding
    `inkApplied` and nothing the strict reader can read should not exist. It is
    handled rather than declared unreachable, because a comment calling a branch
    synthetic is a branch with no test, and this codebase has paid a walk for
    that once already.
  */
  const others = Object.keys(migrated as Record<string, unknown>)
    .filter((key) => key !== "open" && key !== "inkApplied");
  if (others.length > 0) return null;
  return inkApplied === null ? { open } : { open, inkApplied };
}

/**
 * A STORED OPEN KIND WHOSE NOUN THE CLOSED LANE NOW OWNS — moved into it.
 *
 * # The event this exists for has already happened once
 *
 * `horns` was an open kind and is a catalogued subject now; it was promoted
 * inside this very campaign. Every branch that carried it as an open kind
 * across that day holds a record the two lanes both answer for: the open loop
 * paints `open:horns` from her words while the closed lane owns the noun. Two
 * instructions about one feature — the thing the assembler refuses everywhere
 * else — arriving through the RECORD rather than through an ask, on a
 * customer's face rather than in a fixture.
 *
 * It is the third member of the specimen-joins-the-vocabulary family in this
 * campaign and the first one that is not a test.
 *
 * # And the answer was already in this file
 *
 * A promotion is a vocabulary split pointed the other way, so it migrates in
 * the same place and by the same rule: **the modern key already present WINS**
 * (a newer write is the more recent statement of that subject), the value
 * travels rather than being dropped, and the row is never rewritten.
 *
 * `foldNoun` does the matching, asked of the NOUN and never of the key — the
 * closed table's entries carry spaces and the key does not, so asking it about
 * `cat-ears` would stop matching every multi-word noun the closed lane owns.
 * Same sharp edge as `normalizeOpenKind`'s own collision check, and the same
 * answer.
 *
 * # It rewrites the RAW row, and never the stored one
 *
 * Like `migrateStoredDelta` above, and for a reason beyond symmetry: a value
 * moved into the closed lane has to go through that lane's guards and come back
 * in that lane's shape. `horns` is a plural subject, so `readDelta` returns it
 * as a list — a promotion written onto the finished delta would hand every
 * downstream reader a bare string where one is never expected.
 *
 * **Declared**: if the closed lane then REFUSES those words, the whole row
 * reads as unreadable and the render refuses loudly rather than painting. That
 * is the honest outcome and not an oversight — the noun belongs to the closed
 * lane now, and painting it through a lane that has rejected its words would be
 * guessing. The only guard that can do it is brand-scrubbing the words to
 * nothing; the length ceilings are the same number on both sides.
 *
 * `readOpenKinds` is the only validator, asked once and re-used — a second
 * reading of the same field is how two answers to *what is stored here* come to
 * disagree (working law 4).
 */
function promoteOpenKinds(value: unknown): unknown {
  const stored = readOpenKinds(value);
  if (stored === null) return value;

  const raw = value as Record<string, unknown>;
  const free: Record<string, unknown> = { ...(raw.free as Record<string, unknown> | undefined ?? {}) };
  const open: Record<string, OpenKindAsk> = {};
  let promoted = false;

  for (const [kind, ask] of Object.entries(stored)) {
    const subject = closedSubjectFor(ask.noun);
    if (subject === null) {
      open[kind] = ask;
      continue;
    }
    promoted = true;
    /* Her words, in the lane that owns the noun today. Only where that subject
       has nothing to say already: a later closed ask is the more recent
       statement and this one is, by construction, older than the promotion. */
    if (free[subject] == null) free[subject] = ask.words;
  }
  if (!promoted) return value;
  return { ...raw, free, open };
}
