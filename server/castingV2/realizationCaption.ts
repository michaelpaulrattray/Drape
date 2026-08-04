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
import { interpreterEngine } from "./interpreter";
import { FREE_SUBJECTS, type FreeSubject } from "./refineSubjects";

const log = createModuleLogger("castingV2/realizationCaption");

/** Captions by subject — one per facet, the same keys the deltas use. */
export type RealizationCaptions = Partial<Record<string, string>>;

/** Long enough to be specific, short enough not to become a second brief. */
const MAX_CAPTION = 160;

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
  subject: string;
  bytes: Buffer;
  contentType: string;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<string | null> {
  const engine = input.engine ?? interpreterEngine();
  if (!engine) return null;
  const heading = FREE_SUBJECTS[input.subject as FreeSubject] ?? input.subject;
  try {
    const reply = await engine.complete({
      system: SYSTEM_PROMPT,
      user: `Describe this person's ${heading.toLowerCase()}.`,
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0.1,
      maxOutputTokens: 300,
      signal: input.signal,
    });
    const parsed = JSON.parse(reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""));
    const caption = typeof parsed?.caption === "string" ? parsed.caption.trim() : "";
    if (!caption) return null;
    return caption.slice(0, MAX_CAPTION);
  } catch (error) {
    log.warn({ err: error, subject: input.subject }, "[realizationCaption] could not read the render back");
    return null;
  }
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
    .map(([subject, caption]) => {
      const heading = FREE_SUBJECTS[subject as FreeSubject] ?? subject.toUpperCase();
      return `${heading}: ${caption}`;
    });
  if (lines.length === 0) return "";
  return " These are ALREADY TRUE of this person and must be reproduced exactly as described, "
    + `not approximated and not re-interpreted: ${lines.join(" | ")}.`;
}
