/**
 * THE ONE COMMENT STRIPPER, AND THE REASON IT IS QUOTE-AWARE (#1625).
 *
 * A guard that reads source to decide whether a diff merges has to be able to
 * tell what the file SAYS from what it DISCUSSES — this repository writes its
 * reasons into docblocks and quotes the founder inside them, so a guard that
 * counted prose would redden on the sentence explaining the rule it enforces.
 * `landingEngineNames.test.ts` says exactly that at its own declaration:
 * *"Strip comments, so a docblock explaining the rule cannot trip the rule."*
 *
 * ## Why this file exists rather than a fourth private copy
 *
 * #1623's law-7 sweep found four implementations of that idea and they did not
 * agree about STRING LITERALS. Re-measured at the tree 2026-10-01 the real
 * population is larger — 35 declaration sites across nine shapes, and TWO of
 * them were exported, not one. This is the one both exports now resolve to.
 *
 * ## What it guarantees, and the two ways the crude shapes get it wrong
 *
 * It is a character walk, so a quote opens a literal and the literal is copied
 * through untouched. That closes both failure directions the measurement found:
 *
 *  - **a `//` inside a string is not a comment.** The shape it replaced in
 *    `storageKeyExpressions.ts` was a bare regex over every `//` to end of line,
 *    so `const url = "https://pub.r2.dev/a/b.png";` was truncated at the
 *    scheme and everything after it on that line left the guard's sight.
 *  - **a `/*` inside a string does not open a comment**, so a regex-pair
 *    stripper cannot swallow from a quoted block-comment sequence to the next
 *    one — which is text a guard would then never read, and a guard that reads
 *    less passes for the wrong reason.
 *
 * Line count is preserved through block comments (their newlines are kept), so
 * a reader that reports a line number still reports the right one.
 *
 * ## Deliberately dependency-free
 *
 * It lives here, and `scripts/lib/productionMention.mts` re-exports it, so that
 * a suite anywhere in the tree can reach it without pulling `node:child_process`
 * into a security guard's module graph. Measured 2026-10-01: a suite under
 * `client/src` can import it too, so a copy that stays under `client/` is a
 * choice about SHAPE and never about reachability.
 */
export function withoutComments(source: string): string {
  const quotes = new Set(['"', "'", "`"]);
  const BACKSLASH = String.fromCharCode(92);
  const NEWLINE = String.fromCharCode(10);
  let out = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    if (quotes.has(character)) {
      const quote = character;
      out += character;
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        out += current;
        index += 1;
        if (current === BACKSLASH) { out += source[index] ?? ""; index += 1; continue; }
        if (current === quote) break;
        if (current === NEWLINE && quote !== "`") break;
      }
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== NEWLINE) index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === NEWLINE) out += NEWLINE;
        index += 1;
      }
      index += 2;
      continue;
    }
    out += character;
    index += 1;
  }
  return out;
}
