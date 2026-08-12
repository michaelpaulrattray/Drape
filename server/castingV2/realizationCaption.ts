/**
 * RECIPE v3 — pixels teach, words remember (D-152).
 *
 * # What v2 got right, and what it cost
 *
 * v2 conditioned each render on the SELECTED PARENT as well as the original, so
 * a mullet would stop being redrawn from scratch every time. It worked: facets
 * held. And it introduced a slower failure that a facet-survival instrument
 * could not see — **photocopy loss**. Conditioning on the parent's pixels
 * inherits its softness, its tone-crush and its vignette, once per generation.
 * Six edits deep the founder's gauntlet is visibly blurred while every facet is
 * perfectly intact.
 *
 * # The caption pattern
 *
 * A realization is a FACT about how something looked, and a fact is better kept
 * in words than in a re-photograph of a photograph. So after a render is kept, a
 * vision pass reads it and writes down what actually landed — *the specific
 * mullet, the exact blue-black* — and every later render goes back to ONE step
 * from the sharp original carrying those captions.
 *
 * **Quality anchors to the original forever.** There is no chain of pixels for
 * softness to accumulate along, because there is no chain of pixels at all.
 *
 * # And it makes restatement idempotent
 *
 * Under v2, "copper" conditioned on already-copper parent pixels brightened it —
 * re-dyeing dyed hair. Under v3 the parent is not in the frame, so copper on
 * copper renders the same copper. The founder isolated that intensification to
 * same-facet stacking, which is what exonerated the colour prose itself (D-146
 * closed); this is the permanent guard on that finding.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { scrubBrands } from "./brandScrub";
import { HAIR_ARRANGEMENT_IDS } from "./hairArrangement";
import { interpreterEngine } from "./interpreter";
import { facetHeading, type Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/realizationCaption");

/**
 * Captions BY FACET, and the key is the whole of D-159 applied here.
 *
 * A caption is the answer to "what did this facet actually look like when it
 * rendered". Key it by anything coarser and a colour instruction inherits a
 * colour caption from before it — which is not stale information but a WRONG
 * one, stated to the image model as already true. Keyed by facet, it dies with
 * the facet it describes.
 */
/**
 * A PIN CARRIES ITS VOCABULARY ID; A REALIZATION NEVER DOES (fable-118).
 *
 * Two different things have always shared this key space and been told apart by
 * reading them — and on 2026-08-09 that cost the founder a render. His paid
 * "wear her hair down" stored the realization *"Straight dark hair worn down,
 * center-parted…"*; the next render asked whether that string was one of the
 * ten closed arrangement wordings, decided it was a pin from before the
 * vocabulary existed, retired it, re-read the MASTER, and told the painter
 * *"HAIR WORN: gathered"* as an already-true fact. The engine obeyed. The edit
 * he had paid for was not forgotten — it was countermanded.
 *
 * Prose-sniffing cannot separate them because both are prose. So a pin now
 * says it is one, structurally: it is an object carrying the id it was CHOSEN
 * from, beside the wording that id expands to. A realization caption is a bare
 * string and can never accidentally look like a pin.
 */
export type PinnedCaption = {
  /** The sentence handed to the painter and the net — unchanged in shape. */
  wording: string;
  /** The id it was chosen from, e.g. `gathered`. Its vocabulary owns it. */
  pin: string;
};

/** A caption is prose read off a delivered frame, or a pin chosen from a list. */
export type CaptionEntry = string | PinnedCaption;

export type RealizationCaptions = Partial<Record<Facet, CaptionEntry>>;

/** The sentence, whichever kind of caption this is. */
export function captionWording(entry: CaptionEntry | undefined): string {
  if (entry === undefined) return "";
  return typeof entry === "string" ? entry : entry.wording;
}

/** The vocabulary id if this is a pin, and null if it is a realization. */
export function pinIdOf(entry: CaptionEntry | undefined): string | null {
  if (!entry || typeof entry === "string") return null;
  return entry.pin;
}

/**
 * DID A RENDER EVER ACTUALLY DELIVER THIS FACET?
 *
 * The only evidence in the system that an ask once landed, and it is free
 * because D-183 already built it: `captionRealization` returns **null** when
 * the reader says the asked-for change is not visibly there, so a realization
 * caption existing for a facet means some render was corroborated on it.
 *
 * A PIN is not that evidence and the distinction is the whole point — a pin is
 * read off the MASTER by `capturePresentation`, describing how she was before
 * anybody asked for anything. That is exactly the state a FAILED ask leaves
 * behind, so treating it as delivery evidence would read every unfulfilled
 * request as a fulfilled one.
 *
 * Its consumer is the refusal gate: an ask that has never landed must not gate
 * the renders that come after it, or one sentence the painter cannot do blocks
 * every later edit on the chain.
 */
export function evidencesDelivery(entry: CaptionEntry | undefined): boolean {
  return entry !== undefined && captionWording(entry) !== "" && pinIdOf(entry) === null;
}

/**
 * Long enough to be specific, short enough not to become a second brief.
 *
 * Raised from 160 and matched to the reader's cap, which was already 200 — the
 * mismatch meant the writer truncated and the reader did not, so nothing ever
 * enforced one length. The mullet caption hit the old ceiling and stored
 * "…falling past the jawline in front and to the shoulders at", a fact that
 * trails off mid-clause and is then stated to the image model as ALREADY TRUE.
 */
const MAX_CAPTION = 200;

/**
 * Cut at a boundary, never mid-phrase, and never with trailing whitespace.
 *
 * A caption is a FACT handed to the next render. Half a clause is a fact that
 * stops making a claim partway through, and a trailing space made two identical
 * captions compare unequal — which showed up as a driver failure that looked
 * like a lost caption and was punctuation.
 */
function tidy(caption: string): string {
  if (caption.length <= MAX_CAPTION) return caption.trim();
  const cut = caption.slice(0, MAX_CAPTION);
  const boundary = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" "));
  return (boundary > MAX_CAPTION / 2 ? cut.slice(0, boundary) : cut).trim().replace(/[,;]$/, "");
}

const SYSTEM_PROMPT = [
  "You look at a photograph of a person and describe ONE named feature of it with the",
  "precision of a person writing a note so the exact same thing can be reproduced later.",
  "",
  "You never describe the person's identity, their mood, the lighting, the framing or the",
  "background. Only the feature you are asked about, and only what you can actually see.",
  "",
  "Be concrete and physical. Not 'nice hair' — 'a shaggy mullet, short choppy layers through",
  "the crown and fringe, length falling past the collar at the back'. Not 'dark hair' —",
  "'blue-black, cool-toned, slightly deeper at the roots'.",
  "",
  "",
  /*
    THE CORROBORATION (D-183), and it is the difference between a memory and a
    lie repeated forever.

    A caption is pinned into every later render as ALREADY TRUE. So a caption
    written after an edit that did NOT take pins the failure: the founder's face
    carried "EYE COLOUR: pinker" in the edits lane and "ALREADY TRUE … Deep
    brown irises" in the pins, in one prompt, and the model resolved that
    contradiction differently on every render — pink eyeshadow once, nothing the
    next time.

    So the reader is asked the second question too. Not to judge quality: only
    whether the thing it was told to look for is visibly there.
  */
  "You are also told what the edit ASKED for. Answer honestly whether that ask is visibly",
  "true in this photograph. If the asked-for change is not there, say so — a description of",
  "what is there instead would be recorded as if it had been wanted.",
  "",
  'Reply with JSON: {"caption": "...", "matches": true|false} and nothing else.',
  "The caption is under 160 characters.",
].join("\n");

/**
 * Read back what a render actually produced, for one subject.
 *
 * Fails SOFT, unlike the instruction interpreter. A missing caption costs
 * precision on later renders; refusing here would cost the user an edit they
 * already paid for, and the render in hand is already correct.
 */
export async function captionRealization(input: {
  facet: Facet;
  bytes: Buffer;
  contentType: string;
  /**
   * What the edit asked for, so the read-back can be checked against it.
   *
   * Absent means there is nothing to corroborate, and the caption is taken as
   * written — right for a facet that was not the subject of an instruction.
   */
  asked?: string | null;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<string | null> {
  const engine = input.engine ?? interpreterEngine();
  if (!engine) return null;
  const heading = facetHeading(input.facet);
  try {
    const reply = await engine.complete({
      system: SYSTEM_PROMPT,
      user: [
        `Describe this person's ${heading.toLowerCase()}.${extraAsk(input.facet)}`,
        ...(input.asked ? [`The edit asked for: ${input.asked}`] : []),
      ].join("\n"),
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0.1,
      maxOutputTokens: 300,
      signal: input.signal,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    const caption = typeof parsed?.caption === "string" ? parsed.caption.trim() : "";
    if (!caption) return null;
    /*
      NO PIN UNLESS IT CORROBORATES (D-183).

      Conservative on purpose. An unconfirmed caption is simply not written, and
      the cost of that is the drift this mechanism exists to reduce — real, but
      it decays. The cost of the other default is a prompt that argues with
      itself in every render from here on, and that one does not decay.
    */
    if (input.asked && parsed?.matches !== true) {
      log.warn(
        { facet: input.facet, asked: input.asked, saw: caption },
        "[realizationCaption] the edit is not visible in the render — refusing to pin what is there instead",
      );
      return null;
    }
    /*
      Scrubbed like every other free text that enters a paid prompt. This one is
      MODEL-authored rather than user-authored, which makes it the likeliest
      place in the whole surface for a brand name to arrive unasked.
    */
    const cleaned = scrubBrands(caption)?.trim() ?? "";
    if (!cleaned) return null;
    return tidy(cleaned) || null;
  } catch (error) {
    log.warn({ err: error, facet: input.facet }, "[realizationCaption] could not read the render back");
    return null;
  }
}

/**
 * READ ONE SLOT, FROM THE NARROWEST VIEW THAT CONTAINS IT.
 *
 * `captionRealization` reads a FACET against the whole frame, which is right for
 * the already-true lane and wrong for the library. `statedAccessories` is one
 * facet over every object a face can wear, so its whole-frame caption is a
 * sentence about everything she has on — and filed as the state of one earring
 * it named her GLASSES on eight production rows, twice describing both ears.
 *
 * This is the library's own read: one call, one slot, and the pixels are the
 * slot's own CUT wherever there is one. A crop of her left earlobe cannot be
 * described as glasses, because the glasses are not in the bytes handed over —
 * structural rather than remembered. Only a slot the region vocabulary has no
 * question for (her jaw, her skin) is read against the frame, and only because
 * such a noun names one thing on a face that there is no second of.
 *
 * Fails SOFT, like every read-back: a missing sentence costs later precision,
 * and the render in hand is already correct and already paid for.
 */
export async function captionSlot(input: {
  /** The stylist's word for what to describe: `left earring`, `hair`, `jaw`. */
  noun: string;
  /** `cut` — these bytes are the slot's own crop. `frame` — the whole picture. */
  view: "cut" | "frame";
  bytes: Buffer;
  contentType: string;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<string | null> {
  const engine = input.engine ?? interpreterEngine();
  if (!engine) return null;
  try {
    const reply = await engine.complete({
      system: SYSTEM_PROMPT,
      user: [
        input.view === "cut"
          ? `This picture is a CUTOUT of one thing: this person's ${input.noun}. `
            + "Describe only the thing itself — never anything around it, and"
            + " never anything you cannot see in this cutout."
          : `Describe this person's ${input.noun}.`,
        /*
          THE OTHER INSTANCE IS NOT THIS SLOT'S BUSINESS. Mismatched pairs are a
          ruled feature, and the words were being filed identically under both
          sides — so a sentence claiming the pair matches was not even evidence
          of itself. The write door refuses these; saying so here is what keeps
          the refusal rare.
        */
        "If this person has two of these, describe ONLY this one. Never say"
        + " \"both\", \"each\" or \"a matching pair\" of the other side.",
      ].join("\n"),
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0.1,
      maxOutputTokens: 300,
      signal: input.signal,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    const caption = typeof parsed?.caption === "string" ? parsed.caption.trim() : "";
    if (!caption) return null;
    /* Model-authored free text entering a paid prompt, scrubbed like the rest. */
    const cleaned = scrubBrands(caption)?.trim() ?? "";
    if (!cleaned) return null;
    return tidy(cleaned) || null;
  } catch (error) {
    log.warn({ err: error, noun: input.noun }, "[realizationCaption] could not read a slot back");
    return null;
  }
}

/**
 * Ink is asked WHERE, not just what.
 *
 * D-145 says a stated placement is never relocated, and a caption that
 * faithfully describes two swallows without saying "on the chest" hands the
 * next render a design with no address — which is an invitation to move it.
 */
function extraAsk(facet: Facet): string {
  if (facet === "ink" || facet === "marks") {
    return " Say exactly where on the body it sits, as part of the description.";
  }
  return "";
}

/**
 * Forget what these facets looked like — they are being rewritten (D-159).
 *
 * The founder's evidence: a copper caption surviving a pastel-pink instruction
 * tells the model copper is already true while the instruction asks for pink,
 * and the caption wins because it is phrased as fact. Dropping is not tidiness;
 * it is the difference between a memory and a contradiction.
 */
export function dropFacets(
  captions: RealizationCaptions,
  facets: ReadonlySet<Facet>,
): RealizationCaptions {
  const kept: RealizationCaptions = {};
  for (const [facet, caption] of Object.entries(captions)) {
    if (facets.has(facet)) continue;
    if (caption) kept[facet] = caption;
  }
  return kept;
}

/**
 * Any caption that survived a facet it had no right to survive.
 *
 * COMPOSE-COMPLETENESS, EXTENDED TO THE CAPTION LAYER (D-159, per the founder:
 * "a superseded caption reaching the prompt is the same crime as a dropped
 * instruction"). D-143 put teeth on the promise that a filed fact reaches the
 * prompt; this is the same promise pointing the other way — a fact that is no
 * longer true must not.
 */
export function staleCaptions(
  captions: RealizationCaptions,
  written: ReadonlySet<Facet>,
): Facet[] {
  return Object.keys(captions).filter((facet) => written.has(facet));
}

/**
 * ARRANGEMENT WORDS, so a caption written for one facet can be caught speaking
 * for another.
 *
 * The core is DERIVED from the closed vocabulary (`HAIR_ARRANGEMENT_IDS`) so it
 * cannot drift from the list it is about. The rest are the phrasings the
 * captioner actually produced on paid renders — a model told to describe HAIR
 * COLOUR writes "piled into a high bun", not "bun".
 *
 * Bare "down" is deliberately NOT here. It is the one id that is also an
 * ordinary English word ("toned down", "further down the shoulder"), and a
 * matcher that strips on it would cut colour description out of prompts. The
 * down-side phrasings that ARE unambiguous are listed instead.
 */
const ARRANGEMENT_WORDS: readonly string[] = [
  ...HAIR_ARRANGEMENT_IDS.filter((id) => id !== "down"),
  "piled", "pinned", "tied back", "pulled back", "swept back", "topknot", "top knot",
  "chignon", "updo", "up-do", "worn down", "hanging loose", "falling loose", "loose past",
];

/**
 * A caption with any clause that speaks for the hair's ARRANGEMENT removed.
 *
 * # The render this exists for
 *
 * Run 1, step 4, production, the founder's account. He asked *"wear her hair
 * down"*. The prompt he paid for carried, under **ALREADY TRUE of this person
 * and must be reproduced exactly as described**:
 *
 *   HAIR COLOUR: Bright copper-orange hair, warm reddish-brown tone, tight
 *   curls piled into a high bun.
 *
 * The hair came back in a bun. The colour caption is a *colour* caption — it
 * strayed into arrangement, and the already-true lane states it as fact, so the
 * prompt asked for hair down and asserted a high bun in the same breath. This
 * is D-159's contradiction ("a superseded caption reaching the prompt is the
 * same crime as a dropped instruction") arriving through a door D-159 does not
 * watch: the caption's FACET is not the one being asked, so nothing dropped it,
 * and its TEXT is.
 *
 * # Why a clause and not the caption
 *
 * Dropping the whole caption would take the copper with the bun, on the one
 * render where the user is changing the hair and the colour most needs
 * carrying. Captions are comma-separated descriptive clauses by construction —
 * the captioner's own worked examples are exactly that shape — so the clause is
 * the unit, and what survives is the part that was always this facet's job.
 *
 * Applied ONLY when the arrangement is actually being asked for. A caption that
 * mentions a bun on a render where nobody is touching the hair is simply true,
 * and truth is what the already-true lane is for.
 */
export function withoutArrangementClaims(caption: string): {
  caption: string;
  stripped: string[];
} {
  const clauses = caption.split(",");
  const kept: string[] = [];
  const stripped: string[] = [];
  for (const clause of clauses) {
    const haystack = clause.toLowerCase();
    (ARRANGEMENT_WORDS.some((word) => haystack.includes(word)) ? stripped : kept).push(clause);
  }
  if (stripped.length === 0) return { caption, stripped };
  /* One full stop, and never a caption that trails off into a comma — the same
     tidiness `tidy` enforces, for the same reason: this is a FACT handed to a
     painter, and half a clause is a fact that stops making a claim partway. */
  const rebuilt = kept.join(",").trim().replace(/[,;]+$/, "").replace(/\.*$/, "");
  return { caption: rebuilt ? `${rebuilt}.` : "", stripped };
}

/**
 * The clause that carries remembered realizations into a fresh render.
 *
 * Deliberately says these are ALREADY TRUE rather than asking for them again:
 * the render is one step from the original, so everything the stack established
 * has to be re-established in this single generation, and a caption that read
 * as a suggestion would let the earlier facets quietly drift.
 */
export function captionClause(captions: RealizationCaptions): string {
  const lines = Object.entries(captions)
    .filter(([, caption]) => Boolean(captionWording(caption)))
    .map(([facet, caption]) => `${facetHeading(facet)}: ${captionWording(caption)}`);
  if (lines.length === 0) return "";
  return " These are ALREADY TRUE of this person and must be reproduced exactly as described, "
    + `not approximated and not re-interpreted: ${lines.join(" | ")}.`;
}
