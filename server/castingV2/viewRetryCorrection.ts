/**
 * THE RETRY ESCALATES THE FRAMING RATHER THAN RE-ROLLING IT — #1492 shape A,
 * **his ruling, Crew reply #240, 2026-09-29 23:27Z, verbatim and entire: "A"**.
 *
 * # What it is for
 *
 * His own Jingu (cast 64), 2026-09-29: two views failed at Sign, he pressed Try
 * again several times, and **eight renders across two views were every one of
 * them refused on `angle`**. The three-quarter came back mirrored on 5 of 6
 * attempts; the close-up cropped through the jaw apparatus on 4 of 4. His
 * words: *"Ive retried on those views a few times and they keep failing"*.
 *
 * **Nothing was wrong with the money and nothing was wrong with the loop.** The
 * defect is that every attempt sent THE IDENTICAL WORDS to an engine that had
 * already answered them the same way, so a retry was a coin with the same
 * weighting. `"Never mirror the direction"` is in the prompt; it is a sentence
 * the engine does not obey, and repeating it louder is not an escalation.
 *
 * # The shape, and the two he declined
 *
 * **A (this):** the second and later attempts carry the reviewer's OWN note
 * back into the prompt as the correction. One clause, derived from the verdict,
 * never a new control.
 *
 * **B** — teach the judge to accept a mirrored three-quarter — was declined:
 * the sheet copies the exact camera views (his rule, 2026-09-27), so a mirrored
 * view changes which side of the face a customer's sheet shows. **C** — flip
 * the frame horizontally when identity passes — was declined and is written
 * down on the card so nobody builds it quietly: it is deterministic and free,
 * and silently wrong for any asymmetric being, moving a scar or a one-sided
 * prosthetic to the other side of a person.
 *
 * # ⚠ THE NOTE IS EVIDENCE, NEVER AN INSTRUCTION, AND THAT FRAMING IS THE WHOLE
 * CARE OF THIS MODULE
 *
 * A judge's note is model prose and it hedges. The #1414 court caught one in
 * the act — *"suggesting a slightly less than full 90-degree turn; **largely
 * matches intent though**"* — and a clause that pasted that in as guidance
 * would be telling the engine its rejected attempt was basically fine, which is
 * the opposite of an escalation. So the note always arrives wrapped in the one
 * sentence that fixes its meaning: **this describes the picture that was thrown
 * away, not the picture to draw.**
 *
 * # What it will and will not speak about
 *
 *   - **`differs` only.** `unsure` fails the axis too, but its note says the
 *     reader could not tell — which is a fact about the reader, not a
 *     description of a defect, and there is nothing in it for the engine to act
 *     on.
 *   - **A judged verdict only.** An `unjudged` verdict's note is a fail-closed
 *     reason (*"the conformance judge could not be reached"*, *"our judging
 *     account is out of funds"*). Feeding an outage into a drawing instruction
 *     would be describing our own plumbing to the engine, and the picture was
 *     never the thing that was wrong.
 *   - **The ANGLE axis only.** That is his ruling's own wording — *"second and
 *     later attempts on an angle refusal"* — and it is where the measured
 *     defect is. Whether a wardrobe or identity refusal should escalate the
 *     same way is a separate question with its own evidence, and folding it in
 *     here would be a second capability shipping under this one's name.
 *
 * # Where it is inert, and it must be
 *
 * Absent a previous attempt, or where the previous attempt's angle passed, this
 * composes the EMPTY STRING and the prompt is byte-identical to the one this
 * road sent before the module existed. A first attempt never carries a
 * correction: there is nothing yet to correct, and inventing one would be
 * telling the engine it had already failed.
 *
 * # The honest limit, stated rather than discovered
 *
 * ⚠ **This is a WITHIN-CALL escalation.** `renderViewAttempts` accumulates each
 * attempt's verdict, so attempt 2 sees attempt 1's — which is exactly what his
 * ruling names. **A fresh Try again is a new call and starts from attempt 1
 * with no memory of the previous retry's refusal**, which is the half of his
 * experience this does not reach. Carrying it across calls means reading the
 * failed slot's recorded verdict back out (#1492 part 1 now stores it) and
 * plumbing it into `BuildPackageInput` — the card names that as a SECOND
 * decision, and it is not taken here.
 */
import type { CastViewAngle } from "../../shared/boardTypes";
import type { ViewConformanceVerdict } from "./viewConformance";

/**
 * The longest a reviewer's note may be when it is quoted into a prompt.
 *
 * The judge's own schema caps a note at 400 characters, so this is not a second
 * opinion about length — it is a bound at the point of USE, because this module
 * must not depend on a cap declared in a file it does not own. A note longer
 * than this is cut with an ellipsis rather than dropped: a truncated
 * description of the defect still names the defect, and dropping it silently is
 * how a correction turns back into a re-roll.
 */
const NOTE_LIMIT = 400;

/**
 * The reviewer's sentence, made safe to quote — never made to say something
 * else.
 *
 * Collapses whitespace (a newline inside a quoted sentence would let the note
 * read as its own paragraph of instructions) and removes the double quotes that
 * would close the quotation early. Nothing else is rewritten: a note that
 * hedges still hedges, and the wrapper above it is what stops the hedge
 * mattering.
 */
function quotableNote(note: string): string {
  /* No `u` flag: this project's `tsconfig` target predates it, and neither
     pattern needs one — both are BMP literals. */
  const collapsed = note.replace(/\s+/g, " ").replace(/["“”]/g, "").trim();
  if (collapsed.length <= NOTE_LIMIT) return collapsed;
  return `${collapsed.slice(0, NOTE_LIMIT - 1).trimEnd()}…`;
}

/**
 * What the ANGLE axis is called where a customer or an engine can read it.
 *
 * Working law 8 — the user's ontology governs. "The angle axis failed" is this
 * pipeline's vocabulary; a photographer is told the CAMERA ANGLE was wrong.
 */
const ANGLE_IN_WORDS = "camera angle";

/**
 * THE CORRECTION, or the empty string.
 *
 * @param previous the verdict on the attempt BEFORE this one, or `undefined` on
 *   a first attempt
 * @param angle the view being drawn again, named so the sentence can say which
 */
export function viewAngleCorrectionClause(
  previous: ViewConformanceVerdict | undefined,
  angle: CastViewAngle,
): string {
  if (!previous) return "";
  /* A fail-closed default never looked at the picture — see the header. */
  if (previous.unjudged) return "";
  if (previous.axes.angle.verdict !== "differs") return "";

  const note = quotableNote(previous.axes.angle.note ?? "");

  /*
    ⚠ **THE WRAPPER IS NOT DECORATION.** Every sentence here does one job:
    the first says the last attempt was thrown away, so the engine knows it is
    correcting rather than starting; the second quotes the reviewer and
    immediately fixes what the quote MEANS, which is the hedge defence the
    header is about; the third points back at the framing instruction that is
    already in this prompt rather than writing a new one, which is what keeps
    this a correction instead of a second control; the last closes the scope, so
    an engine told to change the angle does not take it as licence to redraw the
    person or the outfit.
  */
  const quoted = note.length > 0
    ? `The reviewer wrote: "${note}" — that sentence describes the picture that was `
      + "THROWN AWAY, not the picture to draw. Change what it describes so it is no longer "
      + "true of this one. "
    : "";

  return `⚠ THE PREVIOUS ATTEMPT AT THIS ${angle === "closeUp" ? "CLOSE-UP" : "VIEW"} WAS `
    + `REJECTED ON ITS ${ANGLE_IN_WORDS.toUpperCase()} AND YOU ARE DRAWING IT AGAIN. `
    + quoted
    + "Follow the framing instruction above exactly. Nothing else about this person, their "
    + "outfit or the light changes — only the framing was wrong.";
}
