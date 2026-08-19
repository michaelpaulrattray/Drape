/**
 * WHAT THE CATALOGUE WOULD HAVE KNOWN — the kind-property read
 * (`OPEN_KIND_PROPERTIES_DESIGN.md` §2, ruled fable-897 §3).
 *
 * # One call, per NEW kind, ever
 *
 * Two facts about a noun: how many of the thing there are, and where on a body it
 * is attached. Both are properties of the WORD, so they are asked once and stored
 * against the kind (`db/castingV2OpenKindProperties.ts`) rather than asked per
 * ask. The design note rejected the obvious alternative — adding the questions to
 * the interpreter's own reply — for two measured reasons: a clause added to that
 * prompt moves routing for asks with nothing to do with this lane
 * (`context-is-not-additive`), and a per-KIND fact bought at per-ASK frequency may
 * be answered differently on two renders, which is a property nothing can key on.
 *
 * # THE QUESTION IS ASKED IN A FORM THAT CANNOT BE ANSWERED WRONG
 *
 * Not *"is it paired?"*, which invites a yes — a forced choice between three
 * named alternatives, each carrying its own examples. That is the shape this
 * campaign named on SAM3's laterality, where a reader asked a yes/no about a
 * class answered yes about an instance.
 *
 * And the locality question is asked in the terms of the thing it decides: *could
 * one tightly cropped photograph show all of it at once*. That is what the crop
 * road needs to know, so the reader is not asked an abstraction and trusted to
 * have meant the same thing by it.
 *
 * The same for the place: a closed list of eight, refused rather than folded if
 * the reply is outside it, so the reader cannot invent anatomy the framing table
 * has no row for.
 *
 * # AND THE PROMPT NAMES NONE OF THE CONTROL SPECIMENS
 *
 * `tail`, `halo`, `beak`, `horn`, `wings`, `fangs` and `nails` are the words the
 * controls are run on, so **not one of them appears in the prompt.** A control
 * whose answer is written in the instruction is not a control — the
 * `specimen-joins-the-vocabulary` defect, which this campaign has now committed in
 * both directions. The examples are deliberately other words entirely.
 *
 * # THE QUESTION IS LOCALITY, NOT COUNT — and the fold is gone (fable-951)
 *
 * It asked HOW MANY and folded three answers into a boolean `paired`, and the
 * founder took that apart on fangs: *"fangs are apart of teeth as a whole though
 * right? no need for a left and right fang?"* — with the instruction that the
 * repair *"must not be just a fang upgrade it must apply to anything of the
 * sort."*
 *
 * The old question measured the wrong thing. What decides whether a crop may
 * carry a kind is not how many instances exist but **whether one crop can hold
 * them**. Fangs are several and sit together; wings are two and sit on opposite
 * sides. A count cannot tell those apart, so when it answered the gate's
 * question it did so by accident.
 *
 * So the reader is asked the locality directly, in the same forced-choice shape,
 * and the three answers are STORED as they come — no fold, nothing thrown away
 * from a paid answer. `shared/kindLocality.ts` holds the vocabulary and the one
 * derivation that reads it.
 *
 * # WHAT IT DOES NOT DO
 *
 * It does not decide whether the thing presents in any frame. That is derived,
 * per framing, with no model in the loop (`shared/bodyAnchorRegions.ts`), because
 * the answer differs across the product's eight framings and a row cannot hold
 * eight answers. **The word "extend" does not appear in the prompt** (fable-897
 * §3c) — one model opinion fewer.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { isBodyAnchorRegion, type BodyAnchorRegion } from "../../shared/bodyAnchorRegions";
import { isKindLocality, type KindLocality } from "../../shared/kindLocality";
import { readOpenKindProperties, writeOpenKindProperties } from "../db/castingV2OpenKindProperties";

const log = createModuleLogger("castingV2/openKindProperties");

/**
 * WHICH PROMPT ANSWERED, stored on every row.
 *
 * Bumped when the wording below changes in any way that could move an answer. A
 * property whose value changed because the QUESTION changed is otherwise
 * indistinguishable from a property that was never stable — and that is the
 * distinction the whole store rests on.
 */
export const KIND_PROPERTY_PROMPT_VERSION = "kp-2";

/**
 * The instruction, and every line of it is load-bearing.
 *
 * No control specimen appears anywhere in it — see the header. The examples are
 * a snout, a trunk, whiskers, quills and tusks, none of which any control uses.
 * `freckles` left with the count question that needed it (fable-951).
 */
export const KIND_PROPERTY_SYSTEM = [
  "You answer two questions about a NOUN naming something on a person's body.",
  "You are given the noun alone — no picture, no sentence, no context.",
  "",
  "Reply with JSON only: {\"locality\": \"<one word>\", \"anchor\": \"<one word>\"}",
  "",
  "locality — could ONE PHOTOGRAPH, cropped tightly, show ALL of the thing at",
  "once on a person who has it:",
  "  \"single\"       there is only one of it           (a snout, a trunk)",
  "  \"coLocated\"    several, close together in one place, so one tight crop",
  "                 holds every one of them           (whiskers, quills)",
  "  \"distributed\"  two of them on OPPOSITE SIDES of the body, so no single",
  "                 tight crop can hold both          (tusks)",
  "",
  "anchor — WHERE ON THE BODY the thing is attached. Exactly one of:",
  "  \"head\"        on or in the head or face",
  "  \"neck\"        the neck or throat",
  "  \"torso\"       shoulders to waist, front or back",
  "  \"arms\"        the upper limbs, down to the wrists",
  "  \"hands\"       the hands or the fingers",
  "  \"belowWaist\"  the hips, the legs, anything below the waist",
  "  \"feet\"        the feet or the toes",
  "  \"wholeBody\"   spread over the body rather than attached in one place",
  "",
  "RULES:",
  "  - answer about the WORD as it is ordinarily used, never about a picture",
  "  - locality is about WHERE they sit, not how many there are: several things",
  "    growing side by side are \"coLocated\"; two things on opposite sides of the",
  "    body are \"distributed\"",
  "  - where a thing is attached in one place and reaches well beyond it, answer",
  "    where it is ATTACHED: tusks grow from the jaw, so they are \"head\"",
  "  - both answers must be one of the words listed above. Never invent one, and",
  "    never explain",
].join("\n");

/** What one kind is, as the reader answered it. */
export type KindProperties = {
  /** Stored as answered — three states, no fold (fable-951). */
  readonly locality: KindLocality;
  readonly anchorRegion: BodyAnchorRegion;
  /** The model that answered, for the row's provenance. */
  readonly model: string;
  readonly promptVersion: string;
};

/** The reply shape, parsed defensively — a model's JSON is input, not a promise. */
function readReply(raw: string): { locality: KindLocality; anchor: BodyAnchorRegion } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const locality = (parsed as { locality?: unknown }).locality;
  const anchor = (parsed as { anchor?: unknown }).anchor;
  if (typeof locality !== "string" || typeof anchor !== "string") return null;
  /* Trimmed but NOT case-folded, for the same reason the place below is not: the
     vocabulary is one spelling and `coLocated` is the spelling. A reader that
     answers `colocated` has not obeyed an instruction that lists the words, and
     folding it here would hide that from the control run. */
  const named = locality.trim();
  if (!isKindLocality(named)) return null;
  /*
    REFUSED, NEVER FOLDED TO THE NEAREST. A reply of `elbows` or `back` is a place
    the framing table has no row for, and mapping it onto a neighbour would be the
    unowned-axis collapse with a model's guess inside it. Trimmed but NOT
    case-folded: the vocabulary is one spelling, and a reader that cannot produce
    it has not obeyed an instruction that lists the words.
  */
  const place = anchor.trim();
  if (!isBodyAnchorRegion(place)) return null;
  return { locality: named, anchor: place };
}

/**
 * Ask what a kind IS. One text call, no credit, and it fails CLOSED.
 *
 * `null` is *nobody answered* — no engine, a failed call, a truncated reply, a
 * reply outside either vocabulary. Every one of those means no row is written,
 * and the mint gate reads a missing row as *unknown* and refuses the crop. That
 * is the conservative side by construction: the cost of a null is that an open
 * kind carries words, exactly as it does today.
 */
export async function readKindProperties(
  noun: string,
  deps: { engine?: TextEngine | null; signal?: AbortSignal } = {},
): Promise<KindProperties | null> {
  const word = noun.trim();
  if (!word) return null;
  if (!deps.engine) {
    log.warn({}, "[openKindProperties] no text engine — no property rather than a guess");
    return null;
  }

  let raw: string;
  let model = "unknown";
  try {
    const result = await deps.engine.complete({
      about: "classify",
      system: KIND_PROPERTY_SYSTEM,
      /* THE WORD ALONE. The customer's sentence is deliberately absent: both
         answers are facts about the thing rather than about this ask, and letting
         the sentence in would make this a second interpreter with an opinion
         about the ask (design note §2). */
      user: word,
      json: true,
      ...(deps.signal ? { signal: deps.signal } : {}),
    });
    if (result.truncated) {
      /* Our ceiling, not their sentence — the same branch `normalizeOpenKind`
         carries, so a truncation is not logged as a model that cannot follow
         instructions. */
      log.warn({ noun: word }, "[openKindProperties] the reply was truncated — our ceiling, no property");
      return null;
    }
    raw = result.text ?? "";
    /* The snapshot the provider SERVED where it reports one, else the slug we
       asked for. Provenance about a stored answer should name the thing that
       answered, not the thing we requested, when the two can differ. */
    model = result.provenance.servedModel ?? result.provenance.model;
  } catch (error) {
    log.warn({ err: error, noun: word }, "[openKindProperties] the call failed — no property");
    return null;
  }

  const read = readReply(raw);
  if (read === null) {
    log.warn({ noun: word }, "[openKindProperties] the reply was not two words from the two lists — no property");
    return null;
  }
  return {
    locality: read.locality,
    anchorRegion: read.anchor,
    model,
    promptVersion: KIND_PROPERTY_PROMPT_VERSION,
  };
}

/**
 * WHAT THIS KIND IS, buying the answer only if nobody has bought it before.
 *
 * The whole cost argument of the design rests on this being a CACHE and not a
 * call: one text read per new noun ever, and a table read on every ask after
 * that. Called at the acceptance door, so the answer is on disk before the render
 * it will gate has finished.
 *
 * Fails soft in one direction only. `null` means *nobody has answered*, and the
 * mint gate reads that as *do not mint a crop* — so a transport failure costs a
 * crop and never a wrong one. Nothing here may reject: a property we could not
 * remember must not take away a render somebody paid for.
 */
export async function ensureKindProperties(input: {
  /** The normalizer's key — what the row is keyed on. */
  kind: string;
  /** The customer-facing noun, which is what the READER is asked about.
   *  `cat-ears` is a key; `cat ears` is the word English has an answer for. */
  noun: string;
  engine?: TextEngine | null;
  signal?: AbortSignal;
}): Promise<KindProperties | null> {
  const kept = await readOpenKindProperties(input.kind);
  if (kept) return kept;

  const read = await readKindProperties(input.noun, {
    ...(input.engine ? { engine: input.engine } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  if (read === null) return null;

  /*
    Not awaited for its verdict — a lost write costs one repeated read on the
    next ask, and this is the one path where a paid render is waiting.

    BUT THE MISS IS SAID OUT LOUD (ordered fable-1057 §4). "One text read per
    new noun ever" is the entire cost argument of this design, and it holds only
    while the answer is KEPT. On 2026-08-19 it was found not to be: the
    properties table had never been created in production, so every ask bought
    the read again and threw it away — for months, behind a `warn` about one
    failed INSERT that reads like a transient. This line is about the
    CONSEQUENCE rather than the operation, which is the half a reader can act
    on: the next ask for this kind will pay again.
  */
  void writeOpenKindProperties({
    kind: input.kind,
    locality: read.locality,
    anchorRegion: read.anchorRegion,
    model: read.model,
    promptVersion: read.promptVersion,
  }).then((kept) => {
    if (kept) return;
    log.warn(
      { kind: input.kind },
      "[openKindProperties] the answer was bought and NOT kept — the next ask for this kind buys it again",
    );
  });
  return read;
}
