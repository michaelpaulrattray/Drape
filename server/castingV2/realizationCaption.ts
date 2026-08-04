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
export type RealizationCaptions = Partial<Record<Facet, string>>;

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
  'Reply with JSON: {"caption": "..."} and nothing else. Under 160 characters.',
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
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<string | null> {
  const engine = input.engine ?? interpreterEngine();
  if (!engine) return null;
  const heading = facetHeading(input.facet);
  try {
    const reply = await engine.complete({
      system: SYSTEM_PROMPT,
      user: `Describe this person's ${heading.toLowerCase()}.${extraAsk(input.facet)}`,
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
 * The clause that carries remembered realizations into a fresh render.
 *
 * Deliberately says these are ALREADY TRUE rather than asking for them again:
 * the render is one step from the original, so everything the stack established
 * has to be re-established in this single generation, and a caption that read
 * as a suggestion would let the earlier facets quietly drift.
 */
export function captionClause(captions: RealizationCaptions): string {
  const lines = Object.entries(captions)
    .filter(([, caption]) => Boolean(caption))
    .map(([facet, caption]) => `${facetHeading(facet)}: ${caption}`);
  if (lines.length === 0) return "";
  return " These are ALREADY TRUE of this person and must be reproduced exactly as described, "
    + `not approximated and not re-interpreted: ${lines.join(" | ")}.`;
}
