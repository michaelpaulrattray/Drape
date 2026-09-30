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
 * ## What it guarantees, and the FOUR ways the crude shapes get it wrong
 *
 * It is a character walk, so a quote opens a literal and the literal is copied
 * through untouched. That closes the two failure directions #1625 measured:
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
 * ⚠ **AND A FLAT WALK IS WRONG ABOUT TWO MORE CONSTRUCTS, WHICH IS WHAT #1635
 * CLOSED — the class is that ANY construct able to nest another was read as
 * flat.** Both were driven with controls before they were fixed:
 *
 *  - **a REGEX LITERAL is not a string and not a comment.** Its own characters
 *    include quotes and slashes, so the quote branch running first read them as
 *    delimiters. Two directions, one of each sign: a regex carrying an odd
 *    number of backticks left the walk inside a template literal and **every
 *    docblock after it was copied through as code** (that is what reddened
 *    `client/src/features/staff/section05-guard.test.ts:446` on #1629's swap);
 *    and a regex ending in an escaped slash handed the walk a bare `//`, so
 *    `s.replace(/^image\//, "") + KEPT` **lost everything after the regex**.
 *  - **a TEMPLATE SUBSTITUTION nests, and its `${…}` holds CODE.** An inner
 *    template literal inside `${…}` was read as closing the outer one, so
 *    `` `/api/image-proxy?url=${encodeURIComponent(`https://bucket/${key}`)}` ``
 *    was truncated at the inner scheme. This one was NOT on #1635's card: it
 *    was found because the parser control below disagreed with the walk on one
 *    file of 1,968, and it is the same class as the card's two.
 *
 * **Measured over the 1,968 tracked `.ts`/`.tsx` files the day this landed, the
 * previous reader read SHORT on 83 of them — 2,099 non-whitespace characters of
 * real code no guard could see.** That is the silence direction, and it was
 * live rather than latent: #1635's card could only say no guard's VERDICT had
 * moved, which is a weaker claim than no reader reading short.
 *
 * Line count is preserved through block comments (their newlines are kept), so
 * a reader that reports a line number still reports the right one.
 *
 * ## Deliberately dependency-free — and proven against the compiler anyway
 *
 * It lives here, and `scripts/lib/productionMention.mts` re-exports it, so that
 * a suite anywhere in the tree can reach it without pulling `node:child_process`
 * into a security guard's module graph. Measured 2026-10-01: a suite under
 * `client/src` can import it too, so a copy that stays under `client/` is a
 * choice about SHAPE and never about reachability.
 *
 * ⚠ **The fidelity law asks why this is a hand-written walk rather than the
 * TypeScript compiler, which knows all of this by construction. It is not — the
 * compiler IS the reader of record; it just is not the one that ships.**
 * `withoutComments.test.ts` strips every tracked file BOTH ways on every run —
 * this walk, and `ts.createSourceFile` plus its own comment ranges — and
 * reddens on a single character of disagreement. Two reasons the walk ships:
 *
 *  1. **Its 52 consumers include a money guard** (`creditToolKind.test.ts`) and
 *     several security guards, and this module's whole point is that they can
 *     reach it without taking on a module graph.
 *  2. **Measured latency over the tree: this walk 912 ms, the parser 3,677 ms.**
 *     Several sweeps read all 1,948 files, so the oracle is 4× the price of the
 *     thing it proves.
 *
 * **So the parser's exactness is bought and kept — as the control, on every run
 * — rather than traded away.** Where they ever disagree, the parser is right:
 * that is how the template-substitution hole above was found.
 */

/**
 * Words after which a `/` opens a REGEX LITERAL rather than dividing. Every
 * other word — an identifier, `this`, `true`, a number — ends an expression, so
 * a `/` after it is division. Getting this wrong is cheap in one direction and
 * not the other, which is why the list is deliberately generous: see
 * `regexLiteralEnd`'s note on the newline back-off.
 */
const REGEX_MAY_FOLLOW_WORD = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw",
  "case", "do", "else", "yield", "await",
]);

/**
 * `code` is ordinary source; `template` is the text half of a template literal.
 * They alternate through `${…}`, which is why this is a STACK and not a flag —
 * a template inside a substitution inside a template is legal and occurs in
 * this tree (`facePanel.test.ts:61`).
 */
type Frame = { kind: "code"; braces: number } | { kind: "template" };

export function withoutComments(source: string): string {
  const BACKSLASH = String.fromCharCode(92);
  const NEWLINE = String.fromCharCode(10);
  const BACKTICK = String.fromCharCode(96);
  let out = "";
  let index = 0;
  /** The last non-whitespace character, and the word it ends, for regex-vs-division. */
  let previousCharacter = "";
  let previousWord = "";
  const stack: Frame[] = [{ kind: "code", braces: 0 }];

  while (index < source.length) {
    const frame = stack[stack.length - 1]!;
    const character = source[index]!;

    if (frame.kind === "template") {
      if (character === BACKSLASH) {
        out += character + (source[index + 1] ?? "");
        index += 2;
        continue;
      }
      if (character === BACKTICK) {
        out += character;
        index += 1;
        stack.pop();
        previousCharacter = BACKTICK;
        previousWord = "";
        continue;
      }
      if (character === "$" && source[index + 1] === "{") {
        out += "${";
        index += 2;
        stack.push({ kind: "code", braces: 0 });
        previousCharacter = "{";
        previousWord = "";
        continue;
      }
      out += character;
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      out += character;
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        out += current;
        index += 1;
        if (current === BACKSLASH) { out += source[index] ?? ""; index += 1; continue; }
        if (current === quote) break;
        if (current === NEWLINE) break;
      }
      previousCharacter = quote;
      previousWord = "";
      continue;
    }

    if (character === BACKTICK) {
      out += character;
      index += 1;
      stack.push({ kind: "template" });
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

    if (character === "/" && regexLiteralMayStart(previousCharacter, previousWord)) {
      const end = regexLiteralEnd(source, index);
      if (end !== null) {
        out += source.slice(index, end);
        index = end;
        previousCharacter = "/";
        previousWord = "";
        continue;
      }
    }

    // A `}` closing a `${…}` hands the walk back to the template's text half.
    if (character === "{") {
      frame.braces += 1;
    } else if (character === "}") {
      if (frame.braces === 0 && stack.length > 1) {
        out += character;
        index += 1;
        stack.pop();
        previousCharacter = "}";
        previousWord = "";
        continue;
      }
      if (frame.braces > 0) frame.braces -= 1;
    }

    out += character;
    index += 1;
    if (!/\s/.test(character)) {
      previousCharacter = character;
      previousWord = /[A-Za-z0-9_$]/.test(character) ? previousWord + character : "";
    }
  }
  return out;
}

/**
 * Whether a `/` here can open a regex literal. Telling `a / b` from `/ab/`
 * needs the preceding token, and `)`, `]` and `}` are genuinely ambiguous
 * (`(a + b) / 2` divides; `if (x) /re/.test(s)` does not) — both are read as
 * DIVISION, which is the reading that cannot over-consume.
 */
function regexLiteralMayStart(previousCharacter: string, previousWord: string): boolean {
  if (previousCharacter === "") return true;
  if (previousWord !== "") return REGEX_MAY_FOLLOW_WORD.has(previousWord);
  if (previousCharacter === String.fromCharCode(96)) return false;
  if (/[A-Za-z0-9_$)\]}'"]/.test(previousCharacter)) return false;
  return true;
}

/**
 * End index of the regex literal at `start`, flags included, or `null` when the
 * text is not one.
 *
 * ⚠ **The `null` is the safety valve that makes the guess above affordable.** A
 * regex literal cannot span a line, so a scan that reaches a newline without
 * closing was never a regex — the caller falls back to treating the `/` as an
 * ordinary character. That is what keeps a generous `REGEX_MAY_FOLLOW_WORD`
 * from costing anything: `x.in / 2;` enters regex mode, finds no closing slash
 * on the line, and backs out. A character class is tracked because `/[/]/`
 * closes at the second slash and not the first.
 */
function regexLiteralEnd(source: string, start: number): number | null {
  const BACKSLASH = String.fromCharCode(92);
  const NEWLINE = String.fromCharCode(10);
  let index = start + 1;
  let insideCharacterClass = false;
  while (index < source.length) {
    const character = source[index]!;
    if (character === NEWLINE) return null;
    if (character === BACKSLASH) { index += 2; continue; }
    if (insideCharacterClass) {
      if (character === "]") insideCharacterClass = false;
      index += 1;
      continue;
    }
    if (character === "[") { insideCharacterClass = true; index += 1; continue; }
    if (character === "/") {
      index += 1;
      while (index < source.length && /[A-Za-z]/.test(source[index]!)) index += 1;
      return index;
    }
    index += 1;
  }
  return null;
}
