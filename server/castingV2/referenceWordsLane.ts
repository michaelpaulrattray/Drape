/**
 * A WORDS TAKE IS ANSWERED WITH A SENTENCE TO ADOPT, FREE, BEFORE THE CLAIM —
 * the other half of the reference road (ruled fable-1103 §1, sited fable-1104
 * §4).
 *
 * # The two halves, and why only one of them is a render
 *
 * The founder's general law splits a reference in two (§7.11 ruling 4): a
 * SPECIFIC LOOK rides as a cropped picture, and a property that carries fine as
 * words stays words. The crop half is the cutter and the carrier. This is the
 * words half, and it cannot be a render at all:
 *
 *   - `refineDelta` has required since D-171/D-172 that a free `hairShade` or a
 *     `makeup` value appear in the CUSTOMER'S OWN instruction. A sentence
 *     routed from a reader straight into a prompt is refused by a guard that
 *     has stood there for months — and it should be.
 *   - So the only legal shape is the one the makeup chip already had: read the
 *     picture, hand her the sentence, let her adopt or edit it, and charge
 *     nothing until she sends it herself.
 *
 * The measurement that put this here rather than anywhere else: with the
 * entrance clause live, *"take the hair colour from this picture"* files
 * `hairShade: "the hair colour in the attached picture"` and *"give her the
 * makeup from this photo"* refuses `wall_unfileable`. Both are the same fact —
 * only a reader can supply the value — arriving at two different doors.
 *
 * # It never intercepts an ask that would have rendered
 *
 * Two conditions, and both are hers rather than ours. She has to have POINTED
 * at the picture (the parse's `fromReference`, or a refusal the picture could
 * answer), and her sentence has to NAME one of the two properties a reader can
 * speak for. *"Make her hair copper"* with a picture attached satisfies
 * neither: it keeps its own value, renders, and the picture is confessed
 * unused exactly as before.
 *
 * # And the reading is a suggestion in every direction
 *
 * Nothing here writes a row, spends a credit, or reaches a render. A refusal
 * from the reader is her sentence to read, not an exception — and the demand
 * row records THAT a read happened and how it ended, never the sentence.
 */
import { referenceReadOutcomeFor } from "../db/castingV2ReferenceReads";
import { readHairColourFromReference } from "./hairColourFromReference";
import { asksAboutHair, hairTakesNamedIn } from "./hairReferenceTake";
import { readMakeupFromReference } from "./makeupFromReference";
import type { ReferenceReadIntent } from "./referenceProvenance";

/**
 * THE WORD "MAKEUP", in the three spellings a person writes it in.
 *
 * Deliberately NOT the cosmetic slot nouns (eyes, lips, brows, complexion). A
 * sentence naming one of those with a picture attached — *"make her eyes green
 * like this"* — is an ask about a FEATURE, and routing it to a makeup reader
 * would answer a question she did not ask with a sentence about four surfaces.
 * The narrow word is the one that means the whole cosmetic look.
 */
const MAKEUP_WORDS = ["makeup", "make up", "make-up"] as const;

function saysMakeup(instruction: string): boolean {
  const lowered = instruction.toLowerCase();
  return MAKEUP_WORDS.some((word) => lowered.includes(word));
}

/**
 * WHICH READER — or `null`, which is most asks and is the answer that keeps
 * this lane out of the way.
 *
 * Hair is asked FIRST and asked NARROWLY: the sentence must be about hair and
 * must name the colour take and only the colour take. Two takes named at once
 * — *"the colour and the cut"* — is a crop ask with a disclaimer, and it
 * belongs to the cutter rather than here; the word tests are free, so nothing
 * about this decision costs anybody a call.
 */
export function wordsTakeIntentFor(instruction: string): ReferenceReadIntent | null {
  const named = hairTakesNamedIn(instruction);
  if (named.length === 1 && named[0] === "colour" && asksAboutHair(instruction)) return "hair";
  if (saysMakeup(instruction)) return "makeup";
  return null;
}

/**
 * THE REFUSALS THIS LANE MAY ANSWER OVER — a closed list, and the omissions are
 * the point.
 *
 * `unreadable` and `wall_likeness` are what a picture-pointing sentence hits
 * when the interpreter has nothing to file; `wall_unfileable` is containment
 * saying the value is not in her words, which is precisely true and precisely
 * what a read fixes.
 *
 * **`wall_content` is not here, and never will be.** A content wall is an
 * answer about what was asked, not a gap a reader can fill, and reading a
 * picture around it would be this lane serving the one ask the product refuses.
 * `wall_stage` is out for the sibling reason: a garment is not a property of a
 * person, so no reader here speaks for it.
 */
const ANSWERABLE_REFUSALS = ["unreadable", "wall_likeness", "wall_unfileable"] as const;

export function refusalIsAnswerableByAReader(reason: string): boolean {
  return (ANSWERABLE_REFUSALS as readonly string[]).includes(reason);
}

/**
 * What one reader answered — the two shapes a customer can be given, and
 * nothing else.
 *
 * `used` and `dropped` are the no-silent-caps half, and they are RETURNED
 * rather than counted: a head holds more blocks of colour, and a face more
 * cosmetic surfaces, than a sentence's contract can carry, so what did not fit
 * comes back NAMED and she can type it herself. A count in place of the names
 * is the quiet truncation this program keeps paying for.
 */
export type WordsTakeReading =
  | { ok: true; sentence: string; used: readonly string[]; dropped: readonly string[]; outcome: string }
  | { ok: false; message: string; outcome: string };

/**
 * ONE READ, on house money, and the reader is chosen by the intent rather than
 * by a branch at each call site.
 *
 * Both readers already exist, are courted, and keep nothing — the bytes are
 * looked at once and dropped. What is new here is only that the road reaches
 * them: until this lane the makeup reader was reachable ONLY from a per-feature
 * text link the founder deleted, and the hair reader had no caller at all
 * outside a door nobody could press.
 *
 * The seams are per-reader for the reason the rest of this service uses seams:
 * a suite driving this lane must be able to answer, refuse and throw without a
 * transport, and a single injected "reader" would make the two readers'
 * different refusal vocabularies one another's problem.
 */
export async function readWordsTake(input: {
  intent: ReferenceReadIntent;
  bytes: Buffer;
  contentType: string;
  readHair?: typeof readHairColourFromReference;
  readMakeup?: typeof readMakeupFromReference;
}): Promise<WordsTakeReading> {
  if (input.intent === "hair") {
    const outcome = await (input.readHair ?? readHairColourFromReference)({
      bytes: input.bytes, contentType: input.contentType,
    });
    /* The demand tally's own word for how this ended — one mapper for both
       readers, so the two lanes can never spell "delivered" differently. */
    const filed = referenceReadOutcomeFor(outcome);
    return outcome.ok
      ? {
        ok: true,
        sentence: outcome.sentence,
        /*
          THE BLOCKS AS WORDS, HERE rather than at the surface.

          A hair reading's blocks are `{tone, where, side}` and a makeup
          reading's surfaces are plain words, and the customer is owed the same
          sentence either way — *what did not come across, named, so she can
          type it herself*. Spelling one shape into English on the server keeps
          the surface holding ONE list of strings instead of two shapes and a
          branch, which is how two lanes come to say it differently.
        */
        used: outcome.used.map(sectionWords),
        dropped: outcome.dropped.map(sectionWords),
        outcome: filed,
      }
      : { ok: false, message: outcome.refusal.message, outcome: filed };
  }
  const outcome = await (input.readMakeup ?? readMakeupFromReference)({
    bytes: input.bytes, contentType: input.contentType,
  });
  const filed = referenceReadOutcomeFor(outcome);
  return outcome.ok
    ? { ok: true, sentence: outcome.sentence, used: outcome.used, dropped: outcome.dropped, outcome: filed }
    : { ok: false, message: outcome.refusal.message, outcome: filed };
}

/** "copper at the ends" — a block of colour in the words a person would use. */
function sectionWords(section: { tone: string; where: string }): string {
  return `${section.tone} ${section.where}`.trim();
}
