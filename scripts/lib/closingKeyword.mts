/**
 * THE CLOSING KEYWORD, IN THE THREE TEXTS GITHUB PARSES (#376).
 *
 * # The class, and it is eight for eight
 *
 * GitHub closes an issue when a pull request body, a commit message, or a
 * merge-commit body carries `Closes #N`. **It reads the keyword and the number
 * and nothing else** — not the clause after it, not the sentence it sits in,
 * not the fact that the sentence exists to say the keyword was withheld.
 *
 * Eight instances are on #376, in five different grammatical frames, and the
 * third one is the one that names the class:
 *
 * > `Closes #368 is deliberately NOT written here — the card keeps its second
 * > half open for the founder's word.`
 *
 * The author knew about the first two instances. **The natural mitigation is
 * itself the defect**, which is why this is a machine and not a reminder. Two
 * of the eight closed cards whose bar was *his eye closes it*, and the relay
 * reopened them by hand.
 *
 * # ⚠ THREE SURFACES, ONE READER — AND THE THIRD IS THE ONE NOBODY WROTE
 *
 * 1. **The pull request body** — `gh pr create --body`. Six of the eight.
 * 2. **A commit message reaching `main`** — the rite pushes editions, and
 *    under deploy-on-merge every squash subject lands there too (instance 6
 *    closed a card from an edition commit's SUBJECT).
 * 3. **The merge-commit body `gh pr merge` writes** — GitHub pre-fills it from
 *    the PR description, so a body that was clean when written can still carry
 *    the token at the squash (instance 7, where the shift had deliberately kept
 *    the keyword out of the PR body).
 *
 * All three call this function. A pattern copied into each would be working
 * law 4 with a merge queue attached.
 *
 * # WHAT IT MATCHES, AND WHY IT IS DELIBERATELY WIDER THAN GITHUB
 *
 * GitHub's own keyword list, all nine words, each with the optional colon and
 * the three reference forms it accepts (`#12`, `owner/repo#12`, the full issue
 * URL). **It does NOT exempt code fences, block quotes or negations**, and that
 * is the point rather than an oversight: this repository's own history is a
 * list of frames somebody was sure GitHub would not read. Refusing a fenced
 * example costs one edit; the alternative costs a reopened card and a founder
 * decision taken by a parser.
 *
 * ⚠ **"WIDER" IS A CHOICE ABOUT FRAMES, AND WAS BRIEFLY WRITTEN AS THOUGH IT
 * WERE A PROVEN FACT ABOUT WHITESPACE TOO.** The review of PR #683 found the
 * separator was `\s*:?\s+` — which cannot match `Closes:#12`, and which, run
 * per line, could not see a keyword ending one line with its number opening the
 * next. GitHub's own tolerance in those two corners is **not driven here**: it
 * would take a scratch repository and a real issue to settle, and nothing in
 * this product needs the answer. So the separator is simply **widened until the
 * question stops mattering** — any whitespace or none, newlines included — and
 * this comment says which of the two it is. **A checker may be wider than the
 * parser it guards; it may never quietly be narrower.**
 *
 * The one thing it will not do is guess. A keyword that does not immediately
 * precede a reference is ordinary English and passes — *"#368 stays open"*,
 * *"this closes the gap"*, *"the fix in #12"* — because GitHub does not close
 * on those either, and a checker that refuses them would be edited out of the
 * gate within a week.
 */

/** GitHub's closing keywords, verbatim from its own documentation. */
export const CLOSING_KEYWORDS = [
  "close",
  "closes",
  "closed",
  "fix",
  "fixes",
  "fixed",
  "resolve",
  "resolves",
  "resolved",
] as const;

/** One place a text would close a card, with enough to fix it by hand. */
export type ClosingKeywordHit = {
  /** The keyword as written, so the refusal quotes the author back. */
  readonly keyword: string;
  /** The reference as written — `#368`, `owner/repo#368`, or the URL. */
  readonly reference: string;
  /** 1-indexed, so a refusal names a line the author can jump to. */
  readonly line: number;
  /** The whole line, trimmed — the frame is what makes the hit legible. */
  readonly text: string;
};

/*
  ⚠ THE KEYWORD LIST IS INTERPOLATED, NEVER RETYPED. A second spelling of the
  same nine words is the drift this module exists to prevent, and it would fail
  silently in the direction that lets a card close.
*/
const REFERENCE = String.raw`#\d+|[\w.-]+\/[\w.-]+#\d+|https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+`;
/* ⚠ `\s*`, NOT `\s+` — AND THE `*` IS THE WHOLE OF FINDING 2 (PR #683 review).
   `\s+` could not match `Closes:#12`: after the optional colon it demanded a
   space and found `#`, and backtracking off the colon left `\s+` facing `:`.
   The widened form also matches `closes#12`, which GitHub may well ignore —
   that is the safe direction and it is taken deliberately. */
const PATTERN = new RegExp(
  String.raw`\b(${CLOSING_KEYWORDS.join("|")})\b\s*:?\s*(${REFERENCE})`,
  "gi",
);

/**
 * Every place `text` would close a card, in reading order.
 *
 * Empty means GitHub closes nothing from this text — which is the only state
 * the three call sites allow through.
 *
 * ⚠ **MATCHED OVER THE WHOLE TEXT, THEN ATTRIBUTED TO A LINE** — the second
 * half of finding 2. The first shape split into lines FIRST, so a keyword
 * ending one line with its number opening the next was invisible to it while
 * `\s` in the pattern would have matched the newline perfectly well. GitHub
 * reads the raw body. Line numbers are still reported, because a refusal that
 * cannot be located is a refusal nobody can act on — they are derived from the
 * match's offset rather than from the loop, which is the only way to have both.
 */
export function closingKeywordHits(text: string): ClosingKeywordHit[] {
  const hits: ClosingKeywordHit[] = [];
  const lines = text.split(/\r?\n/);
  /* Where each line starts in `text`, so an offset becomes a line number. The
     +1 is the separator; `\r\n` makes this one short, which can only ever
     under-count by moving a hit to the line above — the frame is quoted beside
     it either way. */
  const lineStarts: number[] = [];
  let at = 0;
  for (const line of lines) {
    lineStarts.push(at);
    at += line.length + 1;
  }
  const lineOf = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  /* ⚠ THIS RESET IS BELT-AND-BRACES AND SAYS SO, because the first draft of
     this file claimed it was load-bearing and a sabotage proved otherwise: a
     /g regex whose `exec` returns null resets `lastIndex` to 0 itself, and this
     loop always runs to null. It is kept for the day someone adds an early
     `break` — at which point the cursor WOULD carry into the next call — and it
     is documented as insurance rather than as the thing that makes the loop
     correct. A comment nobody can fail is a claim, not a guard. */
  PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = PATTERN.exec(text);
  while (match !== null) {
    const index = lineOf(match.index);
    hits.push({
      keyword: match[1],
      reference: match[2],
      line: index + 1,
      /* The line the hit STARTS on. A hit spanning a newline is quoted by its
         opening line, which is where the keyword the author typed actually is. */
      text: lines[index].trim(),
    });
    match = PATTERN.exec(text);
  }
  return hits;
}

/**
 * The refusal, in the words of somebody who has to fix it now.
 *
 * `where` names the surface — *"the PR body"*, *"commit 2e560260's subject"* —
 * because the three call sites refuse for the same reason and the repair is
 * different in each.
 */
export function closingKeywordRefusal(where: string, hits: readonly ClosingKeywordHit[]): string {
  const lines = [
    `REFUSED: ${where} carries ${hits.length === 1 ? "a closing keyword" : `${hits.length} closing keywords`} — GitHub would close ${hits.length === 1 ? "that card" : "those cards"} on merge.`,
  ];
  for (const hit of hits) {
    lines.push(`  line ${hit.line}: "${hit.keyword} ${hit.reference}"  —  ${hit.text}`);
  }
  lines.push(
    "",
    "  GitHub reads the keyword and the number and nothing else — not the clause after it,",
    "  and not a sentence written to say the keyword is being withheld (#376, 8 instances).",
    "",
    "  Repair: write the card number WITHOUT the keyword — `#368 stays open for his word`,",
    "  or `Card: #368` — and close it yourself with `gh issue close 368 --comment '<receipt>'`",
    "  once it has actually shipped. That is what every other card here already gets.",
  );
  return lines.join("\n");
}
