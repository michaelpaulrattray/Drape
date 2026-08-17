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
 * Not *"is it paired?"*, which invites a yes — a forced COUNT with three named
 * alternatives, each carrying its own examples. That is the shape this campaign
 * named on SAM3's laterality, where a reader asked a yes/no about a class
 * answered yes about an instance.
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
 * # THE THREE-WAY COUNT IS FOLDED TO A BOOLEAN, and that is declared
 *
 * The store holds `paired`, and P1's own definition is *does the noun denote a
 * matched SET* — so `many` folds in beside `pair`: both are nouns meaning more
 * than one thing, and both would have a whole-frame read returning some of it
 * under a name that means all of it. The distinction is not stored, which throws
 * away part of a paid answer; the compensation is that `promptVersion` records
 * which prompt answered, so a promotion design that needs the three-way can
 * re-ask for $0.0148 rather than guess.
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
export const KIND_PROPERTY_PROMPT_VERSION = "kp-1";

/**
 * The instruction, and every line of it is load-bearing.
 *
 * No control specimen appears anywhere in it — see the header. The examples are
 * a snout, a trunk, tusks, freckles and quills, none of which any control uses.
 */
export const KIND_PROPERTY_SYSTEM = [
  "You answer two questions about a NOUN naming something on a person's body.",
  "You are given the noun alone — no picture, no sentence, no context.",
  "",
  "Reply with JSON only: {\"count\": \"<one word>\", \"anchor\": \"<one word>\"}",
  "",
  "count — HOW MANY of the thing someone who has them has:",
  "  \"single\"  exactly one          (a snout, a trunk)",
  "  \"pair\"    a matched two        (tusks)",
  "  \"many\"    no fixed number      (freckles, quills)",
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
  "  - where a thing is attached in one place and reaches well beyond it, answer",
  "    where it is ATTACHED: tusks grow from the jaw, so they are \"head\"",
  "  - both answers must be one of the words listed above. Never invent one, and",
  "    never explain",
].join("\n");

/** What one kind is, as the reader answered it. */
export type KindProperties = {
  /** True for `pair` and for `many` — see the header's fold. */
  readonly paired: boolean;
  readonly anchorRegion: BodyAnchorRegion;
  /** The model that answered, for the row's provenance. */
  readonly model: string;
  readonly promptVersion: string;
};

const COUNTS = ["single", "pair", "many"] as const;

/** The reply shape, parsed defensively — a model's JSON is input, not a promise. */
function readReply(raw: string): { count: (typeof COUNTS)[number]; anchor: BodyAnchorRegion } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const count = (parsed as { count?: unknown }).count;
  const anchor = (parsed as { anchor?: unknown }).anchor;
  if (typeof count !== "string" || typeof anchor !== "string") return null;
  const counted = count.trim().toLowerCase();
  if (!(COUNTS as readonly string[]).includes(counted)) return null;
  /*
    REFUSED, NEVER FOLDED TO THE NEAREST. A reply of `elbows` or `back` is a place
    the framing table has no row for, and mapping it onto a neighbour would be the
    unowned-axis collapse with a model's guess inside it. Trimmed but NOT
    case-folded: the vocabulary is one spelling, and a reader that cannot produce
    it has not obeyed an instruction that lists the words.
  */
  const place = anchor.trim();
  if (!isBodyAnchorRegion(place)) return null;
  return { count: counted as (typeof COUNTS)[number], anchor: place };
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
    paired: read.count !== "single",
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

  /* Not awaited for its verdict — a lost write costs one repeated read on the
     next ask, and this is the one path where a paid render is waiting. */
  void writeOpenKindProperties({
    kind: input.kind,
    paired: read.paired,
    anchorRegion: read.anchorRegion,
    model: read.model,
    promptVersion: read.promptVersion,
  });
  return read;
}
