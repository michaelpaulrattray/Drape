/**
 * IS THIS A PHOTOGRAPH, OR A DRAWING OF ONE — the class door for hair
 * (ruled fable-1075 §1; design `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §9.4).
 *
 * # Hair's defect is not makeup's, and this is the one it has
 *
 * Measured, four specimens, both directions: hair does NOT have makeup's
 * out-of-class defect. Handed the cyborg — the very bytes on which the makeup
 * reader called prosthetic circuitry a look — a bare hair reader answered
 * *there is no hair on this head* 2/2, and so did a golden retriever. **A
 * presence question anchored on a body part is a gate; one anchored on a
 * judgement is a prompt**, and hair's presence gate is anchored on a body part.
 *
 * Its defect lives in the one place a presence flag cannot help: **a salon
 * illustration reads as a real head.** Ink and gouache on paper with the pencil
 * construction lines still showing came back *present: yes*, *"copper red with
 * auburn tones"*, *"long, centre part, face-framing"*, 2/2, with no hedge.
 *
 * # IT ROUTES. IT NEVER REFUSES THE ASK.
 *
 * This is the whole shape of the ruling and it is not a nicety. fable-1052
 * forbids a reader's photo-versus-drawing verdict that TURNS A CUSTOMER AWAY,
 * and tolerates one that only chooses a lane. So:
 *
 *     photograph   both roads — the crop takes and the words take
 *     drawn        the WORDS take only; the crop takes are declined, and the
 *                  words road is offered in the same breath
 *     unreadable   BOTH ROADS, exactly as if this door were not here
 *
 * **The third row is the load-bearing one.** A door that narrows on silence is
 * a door that turns customers away on a bad minute at a provider — the reader
 * has no verdict, so there is nothing to route on, and the licence to narrow
 * comes from a POSITIVE `drawn` answer or from nowhere. It is the asymmetry
 * D-235 drew for affirmatives, pointed at a lane instead of at a fact.
 *
 * # WHY A DRAWN REFERENCE MAY NOT RIDE A CROP, in one sentence
 *
 * A crop is carried into a repaint as a picture of the thing to be reproduced.
 * Carrying a gouache painting there asks an engine to reproduce PAINT on a
 * photograph of a person's head. The colour is a different matter entirely and
 * that is why the words road stays open: a copper read off a drawing is an
 * honest copper.
 *
 * # STRUCTURE IS THE FENCE, and the ask is where the false positives are won
 *
 * The reply is one word from a closed list, so there is no field in which a
 * hedge, a caption, or a claim about the person can arrive. And the ask states
 * the thing the court exists to check: **an edited, retouched, filtered or
 * heavily stylised PHOTOGRAPH is a photograph.** That sentence is doing the
 * real work here — the failure that would matter is not a drawing read as a
 * photograph (the words road serves it fine), it is a real customer's stylised
 * photograph read as a drawing and quietly denied the crop road she paid for.
 *
 * # WHAT IS NOT HERE YET, said rather than implied
 *
 * **The count.** §9.4 asks for the outcome to be recorded so a false-positive
 * rate has a signal, and the demand column has no value for it. Adding one is a
 * migration and a second command on the founder's desk; this door cannot be
 * reached by anybody until the hair flag flips, so the value rides with that
 * flip in one ceremony rather than sitting on his desk twice. Until then the
 * narrowing is a log line, and that is stated here rather than left to be
 * discovered by somebody looking for a tally.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";

const log = createModuleLogger("castingV2/referenceMediumDoor");

/**
 * What a reference IS, as far as this door can tell.
 *
 * `unreadable` is a first-class member rather than a null, because the routing
 * rule has three rows and one of them is *the reader did not answer* — a
 * sentinel shared with `drawn` would narrow a lane on a provider's bad minute,
 * and a sentinel shared with `photograph` would hide the failure entirely.
 */
export const REFERENCE_MEDIA = ["photograph", "drawn", "unreadable"] as const;

export type ReferenceMedium = (typeof REFERENCE_MEDIA)[number];

/**
 * THE ASK — one word, and the sentence that protects the real photographs.
 *
 * Every line after the question is there because of a false positive it
 * prevents. A studio portrait with the skin retouched, a heavily graded fashion
 * frame, a photograph of somebody whose own look is stylised to the point of
 * costume — all of them are photographs, and all of them are what a customer of
 * this product actually attaches.
 */
const ASK = [
  "Look at this picture and answer with ONE WORD.",
  "",
  "Is it a PHOTOGRAPH taken with a camera, or is it DRAWN — an illustration,",
  "a painting, a sketch, a cartoon, a 3D render or a digital painting?",
  "",
  "Answer exactly one of these two words:",
  '  photograph',
  '  drawn',
  "",
  "IMPORTANT — these are all PHOTOGRAPHS and must answer \"photograph\":",
  "- a photograph that has been retouched, filtered, colour-graded or edited;",
  "- a studio portrait with smoothed skin or heavy makeup;",
  "- a photograph of a person whose hair colour or style is unusual, stylised",
  "  or theatrical;",
  "- a photograph of a person wearing prosthetics, body paint or costume;",
  "- a black-and-white or high-contrast photograph.",
  "",
  'Answer "drawn" ONLY if the image itself was made by drawing, painting or',
  "rendering rather than by a camera — visible brush, ink or pencil work, flat",
  "illustrated shading, or an obviously computer-generated character.",
  "",
  'Reply with JSON: {"medium": "photograph"} or {"medium": "drawn"}.',
].join("\n");

/**
 * Read one word out of a reply, or say it could not be read.
 *
 * Exported for its own arms: a parser that only ever runs behind a network call
 * is a parser nobody has driven on the shapes a model actually returns.
 */
export function readMediumAnswer(raw: string): ReferenceMedium {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* Some replies arrive as a bare word rather than as JSON, and a bare word
       is a perfectly good answer to a one-word question. It is matched
       STRICTLY — the whole reply must be the word — because "this is not a
       photograph" contains "photograph" and would read as its own opposite. */
    const bare = raw.trim().toLowerCase().replace(/[".]/g, "");
    if (bare === "photograph" || bare === "drawn") return bare;
    return "unreadable";
  }
  /* A quoted bare word is valid JSON and parses to a STRING, not to an object,
     so it fell through the object branch and read as unreadable until this line
     existed — caught by this module's own arm rather than by a live reply, and
     said that way because a comment claiming a model did it would be a claim
     nobody measured. The same strict equality applies: a whole reply that IS
     the word, never a reply containing it. */
  const medium = typeof parsed === "string"
    ? parsed.trim().toLowerCase()
    : (parsed as { medium?: unknown } | null)?.medium;
  if (medium === "photograph" || medium === "drawn") return medium;
  return "unreadable";
}

export type MediumReadInput = {
  bytes: Buffer;
  contentType: string;
  /** Test seam and dependency injection; `undefined` takes the shipped engine. */
  engine?: TextEngine | null;
  signal?: AbortSignal;
};

export async function readReferenceMedium(input: MediumReadInput): Promise<ReferenceMedium> {
  const engine = input.engine === undefined ? interpreterEngine() : input.engine;
  if (!engine) {
    log.warn({}, "[referenceMediumDoor] no text engine — the medium is unread rather than guessed");
    return "unreadable";
  }
  try {
    const reply = await engine.complete({
      about: "describe",
      system: "You identify what kind of image you are looking at. You never describe people.",
      user: ASK,
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0,
      /* One word inside a small object. Generous enough that a model which
         wraps its answer in a sentence still fits — an empty completion would
         read as `unreadable`, which is a different fact from a refusal. */
      maxOutputTokens: 200,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return readMediumAnswer(reply.text ?? "");
  } catch (error) {
    log.warn({ err: error }, "[referenceMediumDoor] the medium could not be read");
    return "unreadable";
  }
}

/**
 * MAY A CROP TAKE RIDE ON THIS PICTURE?
 *
 * The routing rule in one place, so the door and its copy cannot disagree about
 * what a medium means. Note what it does with `unreadable`: it says YES — a
 * narrowing needs a positive answer, and a reader that did not answer has not
 * given one.
 */
export function cropTakeAllowedOn(medium: ReferenceMedium): boolean {
  return medium !== "drawn";
}

/**
 * WHAT SHE IS TOLD when a drawing is declined the crop road — humble, and in
 * two parts (fable-1075's rider).
 *
 * The second half is not decoration: a refusal that only says no leaves a
 * customer holding a picture and no way forward, and the words road genuinely
 * serves this picture well. Naming the sentence she could type is the
 * difference between a door and a dead end (D-180).
 */
export const DRAWN_NARROWED_NOTE =
  "That looks like an illustration rather than a photograph, so I can't copy the cut from it — "
  + "a drawn style doesn't carry onto a real face. I can still take the COLOUR from it: "
  + "try \"copy just the hair colour from the picture\".";
