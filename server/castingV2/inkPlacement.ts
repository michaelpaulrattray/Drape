/**
 * Where a stated tattoo would sit, and whether we can honestly render it yet
 * (D-133, gated by D-137).
 *
 * # Only pixels render a design (D-132)
 *
 * A tattoo described in words produces a different tattoo in every frame, which
 * is a person who does not have one tattoo. The law is that a design needs a
 * DOCUMENT — a plate — and the only case where words alone suffice is the one
 * where the anchor ITSELF is the document: ink fully inside the chest-up frame,
 * where a single generation captures the whole of it and the conformance judge
 * referees it into every later view.
 *
 * # So this is a placement question, answered in code
 *
 * Face and neck are in-frame. A sleeve, a chest piece, a back piece are not —
 * the anchor cannot show them, so no amount of prompt text makes the render
 * trustworthy. Until the body-art studio exists (D-138), those refuse.
 *
 * **Unnamed placement refuses too, and that is deliberate.** "A small rose
 * tattoo" with no location could land anywhere; rendering it somewhere and
 * hoping is exactly the drift the law exists to prevent. The refusal names what
 * DOES work, so it points somewhere rather than just closing a door.
 */

/**
 * Words that put ink inside the chest-up frame.
 *
 * Deliberately narrow. Anything not clearly in-frame is treated as not
 * in-frame, because the failure of being too generous here is a paid render of
 * a tattoo nobody can verify, and the failure of being too strict is a refusal
 * that names the studio.
 */
const IN_FRAME_PLACES = [
  "face", "cheek", "cheekbone", "forehead", "temple", "brow", "chin", "jaw",
  "jawline", "nose", "lip", "eyebrow", "eye",
  "neck", "throat", "nape",
  "ear", "earlobe", "behind the ear",
];

export type InkPlacement =
  /** Fully inside the canonical frame — D-133(a), renders today. */
  | { kind: "in_frame"; place: string }
  /** Needs a design document. Gated until the body-art studio ships (D-137). */
  | { kind: "needs_document" };

/**
 * Placements that are NOT front-visible — checked FIRST, and they win.
 *
 * D-153 established the principle: the classifier was asking "is this a head
 * word?" when the question D-133 turns on is "can the ANCHOR see it?". Behind an
 * ear, the nape, the scalp under hair — every one is on the head and none
 * appears in a chest-up frontal frame.
 *
 * **It was written as a list of phrasings, and the next tattoo walked straight
 * through it (D-158).** "Behind her ear" was gated; the founder typed "behind
 * ear", which was not on the list, so it matched `\bear\b` and rendered — a star
 * on the ear with the hair disturbed on the way. "Behind the left ear" and
 * "behind one ear" went through too. No list of surface forms is ever finished,
 * so these are RULES about relations now, and the relation is what makes a place
 * invisible: something described as BEHIND a feature is behind it however the
 * sentence is worded.
 *
 * They GATE rather than refuse forever: the head template joins the studio
 * (D-153), and that is where they will live.
 */
const HIDDEN_RULES: Array<{ why: string; pattern: RegExp }> = [
  /*
    "Behind" ANYTHING. There is no such thing as a front-visible tattoo the user
    describes as being behind a feature, so this needs no place list at all —
    which is exactly why the place list was the bug.
  */
  { why: "behind", pattern: /\bbehind\b/ },
  /* The far side of a region, however many words sit in between. */
  { why: "back of", pattern: /\bbacks?\s+of\b/ },
  /*
    UNDER stays narrow, on purpose: "under her eye" is front-visible and renders
    today. Only hair hides things.
  */
  { why: "under the hair", pattern: /\b(?:under|underneath|beneath)\b(?:\s+\w+){0,2}?\s+\bhair(?:line)?\b/ },
  /* Places that are hidden all by themselves, with no relation word. */
  { why: "hidden place", pattern: /\b(?:nape|scalp|occiput|crown\s+of\s+(?:the|her|his|their)\s+head)\b/ },
];

/**
 * Words that make something a DESIGN rather than something skin did by itself.
 *
 * The gate lived on the `ink` subject alone, so it was bypassed by FILING: "a
 * small star behind her ear" — no word "tattoo" in it — was read as a MARK, and
 * marks have no placement law. A star is a design wherever it is filed, and
 * D-132 is about designs, not about which drawer they landed in.
 *
 * Deliberately unambiguous entries only. Freckles, scars, moles, birthmarks and
 * vitiligo are things skin does, and none of them appear here.
 */
const DESIGN_WORDS = [
  "star", "heart", "moon", "cross", "arrow", "symbol", "initial", "initials",
  "letter", "letters", "word", "script", "design", "motif", "rose", "flower",
  "butterfly", "snake", "dagger", "anchor", "crown", "skull", "swallow",
  "lightning", "infinity", "tattoo", "ink",
];

/** Does this value name a design, whatever subject it was filed under? */
export function namesDesign(text: string): boolean {
  const lowered = text.toLowerCase();
  return DESIGN_WORDS.some((word) => new RegExp(`\\b${word}s?\\b`).test(lowered));
}

export function classifyInkPlacement(text: string): InkPlacement {
  const lowered = text.toLowerCase();
  /*
    VISIBILITY BEATS REGION, and checking it first is the whole fix: it is what
    stops any phrasing of "behind the ear" from matching on "ear".
  */
  for (const rule of HIDDEN_RULES) {
    if (rule.pattern.test(lowered)) return { kind: "needs_document" };
  }
  for (const place of IN_FRAME_PLACES) {
    if (new RegExp(`\\b${place}\\b`).test(lowered)) return { kind: "in_frame", place };
  }
  return { kind: "needs_document" };
}

/**
 * What the user is told, and it names the thing that DOES work.
 *
 * A refusal that only closes a door leaves someone guessing whether to rephrase,
 * wait, or give up. This one says which of the three.
 */
export const INK_NEEDS_DOCUMENT_MESSAGE =
  "Tell me where it goes — face and neck ink works today. Anywhere else needs a "
  + "design document first, and the body-art studio is coming. Nothing was charged.";

/**
 * A STATED PLACEMENT IS NEVER RELOCATED (D-145).
 *
 * Pre-gate, "chest tattoo of two swallows" rendered on the COLLARBONES. That is
 * silent substitution in space — the same disease as the mullet coming back as
 * a wolf cut, one dimension over: the user named a thing, the model produced
 * something adjacent, and nothing said so.
 *
 * The gate now refuses that whole class, but the law generalises and applies to
 * the ink that DOES render: "a rose on her left cheek" must never land right.
 * So the placement words are carried into the prompt as an explicit,
 * non-negotiable clause rather than left inside a sentence the model may
 * paraphrase.
 */
const SIDES = ["left", "right"];

export function placementClause(text: string): string {
  const lowered = text.toLowerCase();
  const place = IN_FRAME_PLACES.find((p) => new RegExp(`\\b${p}\\b`).test(lowered));
  if (!place) return "";
  const side = SIDES.find((s) => new RegExp(`\\b${s}\\b`).test(lowered));
  const where = side ? `the ${side} ${place}` : `the ${place}`;
  return ` It sits on ${where} and nowhere else — do not move it to a nearby `
    + `part of the body, and do not mirror it to the other side. Ink rendered `
    + `somewhere other than ${where} is a failed candidate.`;
}
