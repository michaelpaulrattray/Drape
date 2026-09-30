/**
 * THE ONE SOURCE WALK, AND ITS TWO CONTRACTS (#1625, #1635, #1638).
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
 *
 * ## TWO CONTRACTS, ONE WALK — and the second one arrived four minutes later
 * (#1638)
 *
 * `withoutComments` keeps a literal and drops the comments around it.
 * **`codeOnly` drops the literal's CONTENTS too**, so that a call-shaped string
 * — `expect(runner).toContain("spawnSync('taskkill…")` — is not read as a call.
 * That second contract is the whole reason it exists, and it is not traded for
 * anything here.
 *
 * ⚠ **IT USED TO BE A SECOND WALK, IN `childProcessSuites.ts`, AND IT CARRIED
 * EXACTLY THE BLINDNESS #1635 CLOSED IN THIS ONE.** #1635's own PR declined to
 * swap it on the correct ground that it is a different contract rather than a
 * duplicate — and a different contract is not a different WALK. Measured
 * through the shipped function the day #1638 was built: **8 of the 1,968
 * tracked files left it inside a literal at end of file**, dropping between
 * 5,398 and 18,420 non-whitespace characters each, and three tree-walking
 * derivers read every one of those files as empty:
 *
 * ```
 * server/selfInvocationCheck.test.ts                 18,420
 * shared/crewNextUpHold.ts                           16,794
 * server/castingV2/openLanePinning.test.ts           14,890
 * server/casting/evidence/evidenceComposerSchema.ts  14,651
 * server/claudeMdFlagEnumeration.test.ts             13,842
 * server/crewShiftArguments.test.ts                  12,312
 * client/src/foundation/iconbutton-guard.test.ts      7,733
 * server/castingV2/inkCutRouteCoupling.test.ts        5,398
 * ```
 *
 * ⚠ **AND THAT READING IS A FLOOR, NOT A CENSUS — it cannot see the one
 * instance the tree already DECLARED.** `server/deployTriggerClaims.test.ts`
 * swallowed eleven lines and then a later backtick re-closed the literal, so
 * the walk was not inside one at EOF and the probe above was blind to it. A
 * BOUNDED swallow is invisible to that signal; the per-file comparison against
 * the previous walk is what measures those, and it is in the suite.
 *
 * **So the two contracts are one walk with one parameter, and the parser
 * control below proves BOTH of them over every tracked file on every run.**
 * The alternative on the table was a second regex-literal reader — the hard
 * half of this file, copied — which is working law 4 with the ink still wet on
 * the commit that removed the last copy.
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

/** An identifier character, and whitespace — declared once for the token reader. */
const WORD_CHARACTER = /[A-Za-z0-9_$]/;
const WHITESPACE = /\s/;
/** Punctuation that can END a value, so that a `/` after it divides. */
const VALUE_CLOSER = /^[)\]}'"/]$/;

/**
 * What the walk does with a literal it has just bounded.
 *
 *  - `keep` — copy it through verbatim, delimiters included. This is
 *    `withoutComments`: a guard asking what a file SAYS usually needs the
 *    strings, because half of what this repository asserts about itself is a
 *    string it expects to find.
 *  - `drop` — emit only its NEWLINES, so the line numbers a later reader
 *    reports still mean something. This is `codeOnly`: a guard asking what a
 *    file DOES must not read a quoted call as a call.
 *
 * The `${…}` of a template is punctuation of the surrounding EXPRESSION rather
 * than literal text, so it is emitted under both policies and its contents are
 * walked as code. Keeping the braces under `drop` is deliberate: without them
 * `` `${a}${b}` `` would collapse to `ab`, and two halves of a name glued
 * together is a false member.
 */
type LiteralPolicy = "keep" | "drop";

/**
 * COMMENTS GONE, LITERALS KEPT. 56 consumers, several of them security guards
 * and one of them a money guard (`creditToolKind.test.ts`).
 */
export function withoutComments(source: string): string {
  return walk(source, "keep");
}

/**
 * COMMENTS GONE AND LITERAL CONTENTS GONE WITH THEM — the population reader's
 * contract (#548, #741), moved here from `childProcessSuites.ts` by #1638 so
 * that the regex-literal reading below is not written twice.
 *
 * ⚠ **THE ONE PLACE THIS GOES TOO FAR IS LOAD-BEARING AND ITS CALLERS KNOW:**
 * an import specifier is always a string literal, so it is gone from this
 * output. Both derivers read the specifier from the RAW source and the CALL
 * from this one, which is why neither a comment naming a module nor an import
 * with no call reads as a member.
 */
export function codeOnly(source: string): string {
  return walk(source, "drop");
}

function walk(source: string, literals: LiteralPolicy): string {
  const BACKSLASH = String.fromCharCode(92);
  const NEWLINE = String.fromCharCode(10);
  const BACKTICK = String.fromCharCode(96);
  /* Literal text under the policy. A dropped span keeps its newlines and
     nothing else, which is the same promise a block comment already made — so a
     reader that reports a line number still reports the right one. Written with
     the declared NEWLINE rather than an escape sequence, in this file's own
     style: its whole subject is what an escape does to a naive reader. */
  const literal = (text: string) =>
    literals === "keep" ? text : NEWLINE.repeat(text.split(NEWLINE).length - 1);
  let out = "";
  let index = 0;
  /**
   * The last two significant TOKENS — a word or number, or one punctuation
   * character. Regex-vs-division turns on the pair rather than on single
   * characters, and `regexLiteralMayStart` says which two need the second.
   * Comments update neither: a `/` after a docblock divides or does not on the
   * strength of the code before the docblock, which is the whole point.
   */
  let previousToken = "";
  let tokenBeforeThat = "";
  const remember = (token: string) => {
    tokenBeforeThat = previousToken;
    previousToken = token;
  };
  /* One source character, with identifier characters building up a word. */
  const rememberCharacter = (character: string) => {
    if (WHITESPACE.test(character)) return;
    if (WORD_CHARACTER.test(character) && WORD_CHARACTER.test(previousToken.slice(0, 1))) {
      previousToken += character;
      return;
    }
    remember(character);
  };
  const stack: Frame[] = [{ kind: "code", braces: 0 }];

  while (index < source.length) {
    const frame = stack[stack.length - 1]!;
    const character = source[index]!;

    if (frame.kind === "template") {
      if (character === BACKSLASH) {
        out += literal(character + (source[index + 1] ?? ""));
        index += 2;
        continue;
      }
      if (character === BACKTICK) {
        out += literal(character);
        index += 1;
        stack.pop();
        remember(BACKTICK);
        continue;
      }
      if (character === "$" && source[index + 1] === "{") {
        /* Punctuation of the expression, not literal text — emitted either way. */
        out += "${";
        index += 2;
        stack.push({ kind: "code", braces: 0 });
        remember("{");
        continue;
      }
      out += literal(character);
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      out += literal(character);
      index += 1;
      while (index < source.length) {
        const current = source[index]!;
        out += literal(current);
        index += 1;
        if (current === BACKSLASH) { out += literal(source[index] ?? ""); index += 1; continue; }
        if (current === quote) break;
        /* ⚠ AN UNESCAPED NEWLINE ENDS A QUOTED LITERAL, FULL STOP — JavaScript's
           own rule rather than a heuristic, and it is what bounds a misread `/`
           to one line. It is emitted under both policies for that reason. */
        if (current === NEWLINE) break;
      }
      remember(quote);
      continue;
    }

    if (character === BACKTICK) {
      out += literal(character);
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

    if (character === "/" && regexLiteralMayStart(previousToken, tokenBeforeThat)) {
      const end = regexLiteralEnd(source, index);
      if (end !== null) {
        /* ⚠ A REGEX LITERAL IS DROPPED UNDER `drop`, AND THE REASON IS NOT
           caution: `/spawnSync\(/` is a pattern a file MATCHES ON, never a call
           it makes, so keeping it would manufacture a member. A real call
           cannot sit inside one — that is what makes this the exact reading
           rather than the safe one. */
        out += literal(source.slice(index, end));
        index = end;
        remember("/");
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
        remember("}");
        continue;
      }
      if (frame.braces > 0) frame.braces -= 1;
    }

    out += character;
    index += 1;
    rememberCharacter(character);
  }
  return out;
}

/**
 * Whether a token can END A VALUE — which is the question regex-vs-division
 * actually turns on. `a / b` divides because `a` is a value; `return /a/` does
 * not because `return` is not.
 *
 * A word ends a value unless it is one of the operators spelt as a word. `)`,
 * `]` and `}` are genuinely ambiguous — `(a + b) / 2` divides while
 * `if (x) /re/.test(s)` does not — and all three are read as ENDING a value,
 * which is the reading that cannot over-consume. `!` deliberately does NOT end
 * one, so `!!/re/.test(s)` still reads as a regex.
 */
function endsAValue(token: string): boolean {
  if (token === "") return false;
  if (WORD_CHARACTER.test(token.slice(0, 1))) return !REGEX_MAY_FOLLOW_WORD.has(token);
  /* A closing regex slash ends a value too, and the walk remembers one. */
  return VALUE_CLOSER.test(token) || token === String.fromCharCode(96);
}

/**
 * Whether a `/` here can open a regex literal, given the previous significant
 * token and the one before it.
 *
 * ⚠ **TWO TOKENS NEED THE ONE BEFORE THEM, AND BOTH WERE MISREADING LIVE CODE
 * UNTIL #1638 — invisibly, because a wrong regex read costs `withoutComments`
 * nothing (it keeps the span either way) and costs `codeOnly` the span.** Found
 * by pointing the parser control at the second contract, and corrected for BOTH
 * readers, because a misread is a misread:
 *
 *  - **`!`** is a non-null assertion as often as it is a negation.
 *    `expect(stencil.width! / stencil.height!)` divides, and a one-character
 *    reading swallowed `` / stencil.height!).toBeCloseTo(entry.box.width / ``
 *    as a regex — 46 characters of `faceScanService.test.ts` gone. But
 *    `!/x/.test(s)` is the house style for a negated pattern and appears dozens
 *    of times, **and `return !/x/` is a THIRD shape the character reading got
 *    wrong in the other direction** — three files read LONG on the first
 *    attempt, this one among them. What settles all three is whether the token
 *    before the `!` ends a value: after `x`, `f()` or `a[0]` it is an
 *    assertion and the `/` divides; after `return`, `(` or `&&` it is a
 *    negation and a regex may follow.
 *  - **`>`** closes a JSX tag as well as an arrow, and **`<`** opens the
 *    closing one. `=>` is this tree's commonest regex predecessor, so `>` must
 *    stay — but `<a></a><b></b>` handed the walk a `/` that scanned on to the
 *    NEXT tag's slash and swallowed the text between them. Both halves of
 *    `</` are answered: only `=>` may be followed by a regex, and a `/`
 *    straight after a `<` is a closing tag.
 *
 * ⚠ **WHAT IS LEFT IS JSX TEXT, AND A CHARACTER WALK CANNOT HAVE IT** — the
 * limit is DECLARED rather than discovered, with the figure beside it.
 * `<p>doesn` + an apostrophe + `t exist.</p>` is TEXT to the parser and a
 * string literal to any walk, so under `drop` the rest of the element goes.
 *
 * **Measured 2026-10-01, and the class is fully accounted for rather than
 * sampled:** the walk agrees with the parser on **all 1,712 tracked `.ts`
 * files** and on **242 of the 257 `.tsx`**. The 15 that differ are **exactly
 * the 15 `.tsx` files holding a quote inside a `JsxText` node** — counted by
 * asking the parser for those nodes, so the remainder is a census and not a
 * floor. It costs `codeOnly`'s three derivers nothing TODAY, because there are
 * **zero `.test.tsx` files in the tree**; the suite reddens the day one enters
 * either population rather than leaving that to be noticed. `withoutComments`
 * is unaffected either way — it keeps the span, which is why this was
 * invisible until the second contract asked.
 */
function regexLiteralMayStart(previousToken: string, tokenBeforeThat: string): boolean {
  if (previousToken === "!") return !endsAValue(tokenBeforeThat);
  if (previousToken === ">") return tokenBeforeThat === "=";
  /* `</div>`. A `/` straight after a `<` is a closing tag in every real
     program — comparing a value against a RegExp object is not a thing anyone
     writes — and without this the `/` scanned on to the NEXT tag's slash and
     swallowed the text between them. */
  if (previousToken === "<") return false;
  return !endsAValue(previousToken);
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
