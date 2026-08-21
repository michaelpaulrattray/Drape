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
 * **Unnamed placement refuses too, and that is deliberate.** "A small rose
 * tattoo" with no location could land anywhere; rendering it somewhere and
 * hoping is exactly the drift the law exists to prevent. The refusal names what
 * DOES work, so it points somewhere rather than just closing a door.
 *
 * # ⚠ THE FACE HALF OF D-133(a) WAS RETIRED 2026-08-21 — it was a promise the
 * # code had stopped keeping (driven opus-954 §3, ruled fable-1296 §1)
 *
 * This header used to open *"Face and neck are in-frame"*, and the face half of
 * that sentence had not been true for as long as this road has existed. Driven
 * at the service: a cheek ask passes this gate and dies at the NEXT door, which
 * requires a placement the measured vocabulary holds — `INK_PLACEMENTS` is
 * `neck`, `upperArm`, `upperChest` and contains no face surface at all. What the
 * customer got was *"I need to know where it goes"*, said to somebody who had
 * just said where it goes: D-180's dead-end wearing a question.
 *
 * So this list was never a CAPABILITY list. What renders is whatever the take
 * resolves to a measured placement; this list only ever decided WHERE the
 * refusal happened and WHICH sentence was said, and on fourteen face words it
 * decided both wrong.
 *
 * # It is DERIVED now, and that is the repair rather than a shorter list
 *
 * {@link inkLanePlaces} comes off the measured vocabulary, filtered by the one
 * fact that decides this: which placements the WORDS road can serve today. Two
 * hand-authored lists answering one question is working law 4, and the drift
 * between them is what a customer was paying the price of.
 *
 * The founder's ruling (fable-1290) is that the road opens wherever the delivery
 * mint can find and crop the result — which is the whole measured vocabulary.
 * It has NOT been opened here: `upperChest` and `upperArm` wait on the court
 * that measures whether the mint fires on what they deliver (fable-1296 §3).
 * When it does, {@link WORDS_ROAD_PLACEMENTS} is the one line that widens.
 *
 * # ⚠ AND THE RETIREMENT IS PER LANE, WHICH THE SUITE HAD TO TEACH ME
 *
 * The first version of this change retired the face words for BOTH subjects the
 * gate covers, and four arms went red on the founder's own sentence — *"give
 * her a harry potter lighting bolt scar on her forehead"*.
 *
 * **The generalisation was wrong and the reason is worth keeping.** The face
 * carve-out is dead for `ink` because an ink value goes on to a door that needs
 * a MEASURED placement and dies there. A design-named MARK never travels that
 * road at all — the words lane is entered on `facetsWrittenBy(delta).has("ink")`
 * and a mark writes `marks` — so it renders on the face exactly as it always
 * has. One promise the code stopped keeping, one it still keeps, and only the
 * first is being retired.
 *
 * `namesDesign` still pulls a design-named mark into THIS gate, so D-158's
 * bypass stays shut: *"a small star behind her ear"* is caught by
 * {@link HIDDEN_RULES} before either list is consulted, on either lane.
 */

import {
  INK_PLACEMENTS,
  inkPlacementEntry,
  type InkPlacement as InkPlacementKey,
} from "../../shared/inkPlacementVocabulary";

/**
 * WHICH MEASURED PLACEMENTS THE WORDS ROAD SERVES TODAY — the one line that
 * widens when the court in fable-1296 §3 reports.
 *
 * `neck` alone, and it is the only one of the three that was ever proven end to
 * end: crop #1, his cybersigilism, minted from a delivered frame with no design
 * row anywhere. `upperArm` and `upperChest` are measured SURFACES on masters and
 * that is a different claim from *the mint fires on what a words render
 * delivers there* — which is the court's question, not this file's assumption.
 *
 * Typed against the vocabulary so a placement that leaves it cannot be left
 * behind here.
 */
const WORDS_ROAD_PLACEMENTS: readonly InkPlacementKey[] = ["neck"];

/**
 * AND THE SET THE FLAG OPENS — measured, and PROVEN TO CARRY.
 *
 * ⚠ It was the whole measured vocabulary for one commit, on the reading that
 * the founder's condition names every placement the mint can crop. **The court
 * narrowed it** (run opus-960, ratified fable-1301 §1): `upperArm` renders on
 * the correct anatomical side and mints a clean crop, and `upperChest` renders
 * something and mints NOTHING.
 *
 * The chest frame is defensible — the engine obeyed the clothing clause and put
 * the swallow on the sliver of skin above the collar, which is his own
 * fable-1081 sentence rendered. What fails is the RECORD: the reader is asked
 * `upper chest` of a chest under a t-shirt and finds nothing (D-226, *you
 * cannot segment a thing that is hidden*), so the customer pays, receives a
 * tattoo, and the product keeps no crop of it — gone on the next unrelated
 * edit. That is the one-frame loss HIS OWN condition forbids: *"as long as the
 * engine can find and crop them"*.
 *
 * So this list is hand-written rather than derived, and the difference from its
 * neighbour is the point: "which placements does the vocabulary hold" is a fact
 * about measurement, and "which of them can this road carry" is a fact about
 * courts. Deriving the second from the first is what put `upperChest` here.
 */
const WORDS_ROAD_PLACEMENTS_OPEN: readonly InkPlacementKey[] = ["neck", "upperArm"];

/**
 * Words that put INK where the words road can actually put it.
 *
 * DERIVED from the vocabulary rather than authored — see the header for the
 * fourteen face words this replaces and what they cost. Each served placement
 * contributes the two spellings the vocabulary already owns: the segmenter's
 * measured word and the customer-facing noun with its possessive stripped, so
 * *"her neck"* and *"the neck"* both match without a synonym list of our own.
 *
 * A synonym judgement is NOT made here and the omission is deliberate
 * (`inkPlacementResolve`'s own rule, fable-1114 §2): *"throat"* is a word for
 * this surface and it is not the vocabulary's, so an ask naming it walls with an
 * honest sentence rather than being silently merged into `neck` by a machine.
 * It walled in effect before this change too — the take could not resolve it and
 * the next door refused it — so nothing renders today that stops rendering now.
 */
const inkLanePlaces = (open: boolean): readonly string[] => Array.from(new Set(
  (open ? WORDS_ROAD_PLACEMENTS_OPEN : WORDS_ROAD_PLACEMENTS).flatMap((key) => {
    const entry = inkPlacementEntry(key);
    return [entry.readerWord, entry.noun.replace(/^(?:her|his|their)\s+/, "")];
  }),
)).sort((a, b) => b.length - a.length);

/**
 * Words that put a design-named MARK inside the chest-up frame — the list this
 * file opened with, kept whole for the one lane it is still true of.
 *
 * See the header's per-lane note. A mark renders straight from words with no
 * placement door in the way, so *"a lightning bolt scar on her forehead"* — the
 * founder's own sentence — is a promise this road keeps, and retiring it here
 * would take a working feature out on the strength of a measurement about a
 * different lane.
 *
 * Deliberately narrow, for the reason it always was: the failure of being too
 * generous is a paid render of a design nobody can verify.
 */
const MARK_LANE_PLACES: readonly string[] = [
  "face", "cheek", "cheekbone", "forehead", "temple", "brow", "chin", "jaw",
  "jawline", "nose", "lip", "eyebrow", "eye",
  "neck", "throat", "nape",
  "ear", "earlobe", "behind the ear",
];

export type InkPlacement =
  /** Fully inside the canonical frame — D-133(a), renders today. */
  | { kind: "in_frame"; place: string }
  /**
   * MEASURED, AND THIS ROAD CANNOT KEEP IT — the court's own answer
   * (opus-960, ratified fable-1301 §1).
   *
   * Distinct from `needs_document` because the customer's situation is
   * different and so is her next move. She named a place the vocabulary holds
   * and the product can see; what it cannot do is CROP the result, because a
   * garment is over it — so the tattoo would be delivered and then lost. The
   * sentence names the two places that work and the wardrobe change that opens
   * this one, and every answer to it acts.
   */
  | { kind: "not_carried"; place: string }
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

/**
 * Which lane this value arrived on — see the header's per-lane note.
 *
 * Not defaulted, and that is the point: the caller knows the subject, and a
 * default here would let a future third caller inherit whichever answer was
 * convenient rather than deciding. `"ink"` is the retired-face lane and
 * `"mark"` is the one that still renders on a face.
 */
export type InkPlacementLane = "ink" | "mark";

export function classifyInkPlacement(
  text: string,
  lane: InkPlacementLane,
  /**
   * Whether this account's words road is open past her neck —
   * `CASTING_INK_WORDS_SCOPE`, resolved by the service and passed in.
   *
   * REQUIRED, and not defaulted, for the reason `lane` is not: a default would
   * let a future caller inherit whichever answer was convenient. `false` is
   * today's product for everybody.
   */
  wordsRoadOpen: boolean,
): InkPlacement {
  const lowered = text.toLowerCase();
  /*
    VISIBILITY BEATS REGION, and checking it first is the whole fix: it is what
    stops any phrasing of "behind the ear" from matching on "ear". It runs on
    BOTH lanes — a thing behind an ear is behind it whatever drawer it is filed
    in, which is D-158's finding and nothing here supersedes it.
  */
  for (const rule of HIDDEN_RULES) {
    if (rule.pattern.test(lowered)) return { kind: "needs_document" };
  }
  for (const place of lane === "ink" ? inkLanePlaces(wordsRoadOpen) : MARK_LANE_PLACES) {
    if (new RegExp(`\\b${place}\\b`).test(lowered)) return { kind: "in_frame", place };
  }
  /*
    AND THE ONE SHE NAMED THAT WE CAN SEE AND CANNOT KEEP — checked only on the
    ink lane and only after the served set has had its say, so a place that
    RENDERS is never described as one that cannot.
  */
  if (lane === "ink") {
    for (const place of uncarriedInkPlaces()) {
      if (new RegExp(`\\b${place}\\b`).test(lowered)) return { kind: "not_carried", place };
    }
  }
  return { kind: "needs_document" };
}

/**
 * The measured surfaces the words road can SEE and cannot KEEP — the whole
 * vocabulary minus what it serves at its most open.
 *
 * Derived from the two lists above rather than named a third time: the day the
 * chest earns its place in `WORDS_ROAD_PLACEMENTS_OPEN`, it leaves this one in
 * the same edit and cannot be left behind speaking a refusal it has outgrown.
 */
function uncarriedInkPlaces(): readonly string[] {
  const served = new Set<string>(WORDS_ROAD_PLACEMENTS_OPEN);
  return INK_PLACEMENTS.filter((key) => !served.has(key)).flatMap((key) => {
    const entry = inkPlacementEntry(key);
    return [entry.readerWord, entry.noun.replace(/^(?:her|his|their)\s+/, "")];
  }).sort((a, b) => b.length - a.length);
}

/**
 * What the user is told, and it names the things that DO work.
 *
 * A refusal that only closes a door leaves someone guessing whether to rephrase,
 * wait, or give up. This one says which of the three.
 *
 * # ⚠ IT IS DERIVED, and it was a hard-coded sentence until 2026-08-22
 * # (census finding 4(c), filed fable-1317)
 *
 * It said *"a neck tattoo is the one I can do from a description alone"* — to
 * every account, including the ones whose UPPER ARM the words road serves.
 * `WORDS_ROAD_PLACEMENTS_OPEN` had already grown and the sentence had not, which
 * is a refusal telling a customer the product is smaller than it is. Nothing was
 * broken and nothing rendered differently; she was simply talked out of an ask
 * that would have worked.
 *
 * So it comes off the same lists that decide the road, through the same
 * `inkLanePlaces` the classifier uses — one derivation, two readers. The day a
 * fourth surface earns its place, this sentence grows with it in the same edit,
 * which is the whole reason `uncarriedInkPlaces` above is written the same way.
 *
 * The customer-facing NOUN rather than the segmenter's word: `inkLanePlaces`
 * returns both spellings and the shorter one is the reader's — *"upper arm"* is
 * what a person says, and the possessive is stripped so the sentence can put
 * its own article in front.
 */
export function inkNeedsDocumentMessage(wordsRoadOpen: boolean): string {
  const places = (wordsRoadOpen ? WORDS_ROAD_PLACEMENTS_OPEN : WORDS_ROAD_PLACEMENTS)
    .map((key) => inkPlacementEntry(key).noun.replace(/^(?:her|his|their)\s+/, ""));
  /* "a neck tattoo" · "a neck or an upper arm tattoo" — the article agrees with
     the word after it, because "a upper arm" is the kind of sentence that makes
     a careful product look careless. */
  const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
  const named = places.length === 1
    ? `${article(places[0]!)} ${places[0]!} tattoo is the one I can do`
    : `${places.map((place) => `${article(place)} ${place}`).join(" or ")} tattoo is what I can do`;
  return `Tell me where it goes — ${named} from a description alone. `
    + "Anywhere else needs a design to work from first, and the body-art "
    + "studio is coming. Nothing was charged.";
}

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
  /*
    THE WIDER LIST, on purpose: this clause is written for whatever actually
    reached a render, and the mark lane reaches one on every face word. Reading
    the ink lane's shorter list here would silently drop the never-relocate
    sentence from exactly the renders D-145 was written about — a face mark
    landing on the wrong cheek.
  */
  const place = MARK_LANE_PLACES.find((p) => new RegExp(`\\b${p}\\b`).test(lowered));
  if (!place) return "";
  const side = SIDES.find((s) => new RegExp(`\\b${s}\\b`).test(lowered));
  const where = side ? `the ${side} ${place}` : `the ${place}`;
  return ` It sits on ${where} and nowhere else — do not move it to a nearby `
    + `part of the body, and do not mirror it to the other side. Ink rendered `
    + `somewhere other than ${where} is a failed candidate.`;
}
