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
import { readDelta, type RefineDelta } from "./refineDelta";

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
  return readDelta(migrateStoredDelta(value));
}
