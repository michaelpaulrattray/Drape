/**
 * WHAT COUNTS AS DECORATION AT THE START OF A LINE — decided once, here (#1559).
 *
 * Two readers of a card body were defeated by ordinary markdown the writer had
 * every reason to use, and **both failed toward SILENCE**:
 *
 * | reader | what it missed | what the silence did |
 * |---|---|---|
 * | `RELEASE_RE` (`shared/crewCardBuildState.ts`) | `**RELEASED — …**` in a paragraph under a heading | #180 read as `claimed` for twelve hours after it was handed back; every seat pass stepped over it |
 * | `holdReasonFromBody` (`shared/crewNextUpHold.ts`) | `> **Waiting on:** YOU` inside a blockquote | a question for his eye that his desk could not draw |
 *
 * Both were anchored for a GOOD reason — prose *about* claiming must not be a
 * claim — so the repair is not to loosen them. It is to step over the
 * decoration once, in one place, and let each reader keep its own anchor
 * against the text that is left.
 *
 * # ⚠ BLOCK DECORATION ONLY, AND NEVER INLINE EMPHASIS
 *
 * The obvious shape — strip every leading `>`, `#`, `-` **and `*`** — is wrong,
 * and wrong in a way that would have shipped: the hold marker is literally
 * `**Waiting on:**`, so a stripper that ate leading asterisks would eat the
 * marker's own text and turn one silence into another. So this removes only
 * what markdown uses to say *what kind of block this line is* — blockquote,
 * heading, list bullet, ordered item — and leaves every emphasis run alone.
 * A matcher that wants to allow `**BOLD` keeps its own allowance, which both of
 * them already had.
 *
 * A bullet is `*` **followed by whitespace**; `**RELEASED` is not a bullet, and
 * the distinction is the whole reason this can be written down at all.
 *
 * # Why it is a module and not two copies
 *
 * Working law 4. The moment this rule had two readers, a copy in each is the
 * drift this repository has already been bitten by — and the two readers do not
 * even live in the same file, so nothing would have made them disagree loudly.
 * `server/crewMarkdownLead.test.ts` holds both consumers to sourcing it.
 */

/**
 * Block-level markdown at the head of a line: any run of blockquote markers,
 * ATX heading hashes, unordered bullets and ordered-list numbers, in any order,
 * with whitespace between them — then the whitespace before the real text.
 *
 * ⚠ **`[-+*]` REQUIRES THE FOLLOWING SPACE and `#{1,6}` is bounded**, because
 * both are how markdown itself tells a bullet from emphasis and a heading from
 * a run of hashes. Dropping either turns `**RELEASED` into `RELEASED` by
 * accident rather than on purpose, which is the same class one level down.
 */
const BLOCK_LEAD = /^(?:[ \t]*(?:>+|#{1,6}[ \t]|[-+*][ \t]|\d+[.)][ \t]))*[ \t]*/;

/**
 * One line with its block decoration removed. Inline emphasis, the ⚠ glyph and
 * every other character are untouched, and a line that carries no decoration
 * comes back trimmed of leading whitespace and nothing else.
 */
export function stripBlockLead(line: string): string {
  return line.replace(BLOCK_LEAD, "");
}

/**
 * Every line of a body, block decoration removed — the population both readers
 * walk.
 *
 * ⚠ **IT IS LINES, WHICH IS THE OTHER HALF OF #1559.** Anchoring at the start
 * of the whole BODY is what made a release written under a heading invisible;
 * anchoring per line is what makes it visible. Measured before it was chosen,
 * over 84 real comments on twelve cards that discuss claiming and releasing at
 * length: **per-line found three releases the body anchor missed** (#180 twice,
 * #1492 once) **and not one extra claim.** The feared failure — prose about
 * claiming read as a claim — did not occur on the real corpus, and the arms in
 * `server/crewCardBuildState.test.ts` keep the negative control that would
 * catch it if it ever did.
 */
export function decoratedLines(body: string): string[] {
  return body.split(/\r?\n/).map(stripBlockLead);
}

/** A line markdown itself treats as opening a block: an ATX heading, allowing
 *  for the blockquote markers that may sit in front of it. */
const HEADING_LINE = /^\s*(?:>+\s*)*#{1,6}[ \t]/;

/**
 * Only the lines that OPEN a block — the first line of the body, any line after
 * a blank one, and any line after a heading.
 *
 * ⚠ **THIS IS STRICTER THAN "PER LINE", AND A NEGATIVE CONTROL IS WHY.** The
 * first shape of #1559's repair read every line, and the arm written to prove
 * *prose about releasing is still not a release* **went red on its own
 * fixture**: a hard-wrapped paragraph can put `RELEASED — Foreman (night
 * shift) on #1492 while…` at the start of line two, and a per-line reader
 * cannot tell that from a handback. The failure directions are not symmetric —
 * a missed release idles a seat, a FALSE release cancels a live claim and two
 * seats build the same card — so the expensive direction gets the stricter
 * rule.
 *
 * **A continuation line is not a block opener, and markdown says so** — this is
 * a property of the format rather than a heuristic about how long a sentence
 * is. A release, a claim and a refusal are all written as their own statement,
 * which is exactly what opening a block means.
 *
 * ⚠ **AND IT COSTS NOTHING, MEASURED RATHER THAN HOPED.** Re-driven over the
 * same 84 real comments on twelve cards: block-opening finds **the same three
 * releases** the body anchor missed (#180 twice, #1492 once) and **the same
 * zero extra claims**. The heading clause is in it because a shift writes
 * `## Handover` and the release on the very next line with no blank between,
 * and markdown starts a new block there too — without it that shape would be a
 * new silence of the same class, which is the trap this whole card is about.
 *
 * `holdReasonFromBody` deliberately reads `decoratedLines` instead: its marker
 * is the specific string `**Waiting on:**` rather than a common English word,
 * so the prose collision this guards against cannot arise there, and narrowing
 * its population would be a silence bought for nothing.
 */
export function blockOpeningLines(body: string): string[] {
  const raw = body.split(/\r?\n/);
  const out: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const previous = index === 0 ? null : raw[index - 1] ?? "";
    const opens = previous === null
      || stripBlockLead(previous).trim() === ""
      || HEADING_LINE.test(previous);
    if (opens) out.push(stripBlockLead(raw[index] ?? ""));
  }
  return out;
}
