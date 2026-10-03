/**
 * THE FOCUS RUNG AS THE RULEBOOK DECLARES IT — the other half of the pair the
 * seat gate runs on, and the half nothing has ever read (#1860).
 *
 * # The repeat this exists to catch
 *
 * The seat gate reads the milestone off ONE artifact — the briefing's
 * `program.ladder`, through `focusRungFromLadder`. His word reaches the
 * RULEBOOK, `.agents/foreman/PROGRAM.md`. Three cards in two weeks are the same
 * symptom, *the seat gate silently held buildable work and nobody found out
 * from the gate*: **#1496** (every rung card held; found by his question),
 * **#1541** (`seatCount 0` from a rungless card on top of the band), and
 * **#1840** — his *"phase 2 gets built next not n2b"* reached `PROGRAM.md` at
 * `91749d2b9` and **not** the briefing, so all four P2 cards he had just
 * ordered were held on a stale `P1`, and the only reader that could have said
 * so was `server/seatBatches.test.ts`'s pin — which holds the briefing against
 * ITSELF and was green throughout.
 *
 * #1840's repair was a SENTENCE in `PROGRAM.md` (*"a focus recorded anywhere but
 * `program.ladder` is a focus no seat can act on, and the two move in ONE
 * commit"*). The rule is right; what it lacks is a reader that can fail.
 *
 * # ⚠ IT READS A DECLARATION, AND IT REFUSES RATHER THAN GUESSING
 *
 * `PROGRAM.md` holds MORE than one `CURRENT FOCUS` line — `:288` still reads
 * *"N2 IS THE CURRENT FOCUS"* as kept history — and **both carry the `✅`
 * marker**, so the marker decides nothing. A reader that took the first or the
 * last match would be guessing, and this repository has paid for that shape
 * before: #360's quiet-shift detector matched its own phrase inside a DENIAL of
 * it, and the repair was to read a declaration rather than a mention.
 *
 * So the declaration is the heading shape his flips actually use, and it is the
 * only thing believed:
 *
 * ```
 * ✅ **CURRENT FOCUS: P2 — PRICING, PHASE 2, THE PLANS REDESIGNED (his word …
 * ```
 *
 * `CURRENT FOCUS:` then the rung then a dash. Measured over PROGRAM.md's whole
 * tracked history (16 commits since `16e3706f5` put it in the tree): **both
 * flips in that era used it** — `a9846fe6a` wrote `CURRENT FOCUS: P1 —` and
 * `91749d2b9` wrote `CURRENT FOCUS: P2 —` — while the kept-history line at
 * `:288` has never matched it, because it puts the rung first and takes no
 * colon.
 *
 * ⚠ **ZERO MATCHES AND TWO MATCHES ARE BOTH REFUSALS, NOT A FALLBACK.** A
 * reader that quietly picks one of two, or quietly answers `null` when the
 * shape changes, hands the gate exactly the silence #1840 was: green while the
 * board holds his ordered cards. The caller's job is to go RED and say which
 * way it was ambiguous — a shift's five minutes against hours of every seat
 * being handed nothing he asked for.
 *
 * # What it is not
 *
 * It does not validate the rung against the ladder's keys, for
 * `focusRungFromLadder`'s own stated reason: an unknown rung is still a rung,
 * and a reader that rejected one would be the milestone gate failing open.
 * Comparing the two values is the CALLER's act.
 */

/** `CURRENT FOCUS:` then the rung, then a dash of any flavour. */
const DECLARATION = /\bCURRENT FOCUS:\s*([A-Za-z][A-Za-z0-9]*)\s*(?:—|–|-)/g;

/** Every line that so much as mentions the phrase, for the refusal's message. */
const MENTION = /\bCURRENT FOCUS\b/;

/**
 * The rung the rulebook declares, or why it could not be read.
 *
 * `ambiguous` carries the count and the rungs it saw, so a caller's failure
 * message can name the two lines rather than only complaining.
 */
export type RulebookFocusReading =
  | { readonly kind: "rung"; readonly rung: string; readonly line: number }
  | { readonly kind: "absent"; readonly mentions: number }
  | { readonly kind: "ambiguous"; readonly rungs: readonly string[]; readonly lines: readonly number[] };

/**
 * Read the declared focus rung out of the rulebook's own text.
 *
 * Pure: markdown in, verdict out, so the arms drive it without a file.
 * `server/seatFocusTwoTruths.test.ts` is its driver and its caller both.
 */
export function focusRungFromRulebook(markdown: string): RulebookFocusReading {
  const lines = markdown.split(/\r?\n/);
  const rungs: string[] = [];
  const at: number[] = [];
  let mentions = 0;
  lines.forEach((text, index) => {
    if (MENTION.test(text)) mentions += 1;
    /* A fresh `lastIndex` per line — a `g` regex reused across a loop skips
       matches, which is a silence this reader may not have. */
    DECLARATION.lastIndex = 0;
    const found = DECLARATION.exec(text);
    if (found?.[1] !== undefined) {
      rungs.push(found[1]);
      at.push(index + 1);
    }
  });
  if (rungs.length === 1) return { kind: "rung", rung: rungs[0]!, line: at[0]! };
  if (rungs.length === 0) return { kind: "absent", mentions };
  return { kind: "ambiguous", rungs, lines: at };
}

/**
 * The sentence a caller prints when the two artifacts disagree.
 *
 * It names BOTH values and the repair, because the shift that reads it is
 * mid-flip and the fix is to move the other half in the same commit — #1840's
 * own rule, which this is the reader for.
 */
export function focusDisagreementMessage(input: {
  readonly rulebookRung: string;
  readonly rulebookLine: number;
  readonly ladderRung: string | null;
}): string {
  return `THE FOCUS HAS TWO SOURCES OF TRUTH AND THEY DISAGREE (#1860).\n`
    + `  the rulebook  .agents/foreman/PROGRAM.md:${input.rulebookLine} declares CURRENT FOCUS: ${input.rulebookRung}\n`
    + `  the briefing  server/crew/crew-briefing.json's program.ladder marks `
    + `${input.ladderRung === null ? "NO rung" : input.ladderRung} current\n`
    + "\n"
    + "  THE BRIEFING IS THE ONLY ARTIFACT THE SEAT GATE READS, so right now every\n"
    + `  card labelled rung:${input.rulebookRung} is being held from every seat`
    + `${input.ladderRung === null ? "" : ` on a stale ${input.ladderRung}`} —\n`
    + "  which is #1840 exactly: his word reached the rulebook and not the ladder, and\n"
    + "  four cards he had just ordered were unbuildable until somebody noticed.\n"
    + "\n"
    + "  If you are mid-flip: move the other half in THIS commit. That is the rule\n"
    + "  #1840 wrote and this arm is the reader it never had.";
}
