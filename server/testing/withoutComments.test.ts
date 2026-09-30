import path from "node:path";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { containedIn, trackedFiles } from "../../scripts/lib/trackedFiles.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./childProcessTimeout";
import { readListedSource } from "./listedSource";
import { codeOnly, withoutComments } from "./withoutComments";

/* Two derived populations claim this suite and it declares one floor for both.
   It reads the whole tracked source tree off disk through `readListedSource`
   (#741's source sweep), and `trackedFiles` asks git what the repository
   contains — a real `ls-files` process — which puts it in #548's child-process
   population too. Both constants are 30_000; the child-process one is named
   because that is the slower fact about this suite. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE ONE COMMENT STRIPPER IS PROVEN AGAINST THE COMPILER, EVERY RUN (#1635).
 *
 * # What this suite is for
 *
 * `withoutComments` decides what 52 guards can SEE. A guard that reads less
 * than it thinks **passes for the wrong reason** — the silence direction — so
 * the reader itself needs the bar its consumers are held to, and it had no
 * suite of its own until this one.
 *
 * # The instrument is the compiler, and that is the whole design
 *
 * ⚠ **The fidelity law's question about a hand-written character walk is
 * answered here rather than argued with.** `parserStrip` below strips the same
 * source using `ts.createSourceFile` and the comment ranges the TypeScript
 * parser itself reports — which knows regex literals, nested template
 * substitutions and JSX by construction, because it resolved them to parse the
 * file at all. The sweep runs BOTH readers over every tracked `.ts`/`.tsx` file
 * and reddens on one character of disagreement.
 *
 * So the compiler's exactness is kept as the CONTROL rather than traded away,
 * and the walk ships for the two reasons its own docblock states: 52 consumers
 * that must not take on a module graph (one of them a money guard), and 912 ms
 * against the parser's 3,677 ms over the tree.
 *
 * **This is not decoration. The parser found a hole the card did not name** —
 * the nested template substitution in `facePanel.test.ts:61` — by being the one
 * file of 1,968 where the two disagreed.
 *
 * # The measurement that justified the change, kept as arms
 *
 * #1635 measured the previous reader in two directions and both are below as
 * fixtures, because the measurement IS the specification:
 *
 *   - a regex literal with an odd backtick count left the walk inside a
 *     template literal and every docblock after it was read as code;
 *   - a regex ending in an escaped slash handed the walk a bare `//` and the
 *     rest of the line was lost.
 *
 * Over the 1,968 tracked files the previous reader read SHORT on **83 of them,
 * 2,099 non-whitespace characters** of real code unseen.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BACKSLASH = String.fromCharCode(92);
const BACKTICK = String.fromCharCode(96);
const NEWLINE = String.fromCharCode(10);

/**
 * THE SECOND READER, AND IT DOES NOT SHARE A RESOLVER WITH THE FIRST.
 *
 * Every comment in a parsed file is leading trivia of exactly one token — or,
 * for a trailing comment at end of file, of the end-of-file token, which
 * `getChildren` yields. So walking every token and taking the ranges the parser
 * reports is complete, and it is exact about regex-vs-division because the
 * parser had to settle that to build the tree.
 *
 * Block comments are replaced by their own newlines, which is the line-count
 * promise the shipped reader makes.
 */
function parserStrip(source: string, fileName: string): string {
  const scriptKind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind);
  const spans = new Map<number, number>();
  const collect = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) spans.set(range.pos, Math.max(spans.get(range.pos) ?? 0, range.end));
  };
  const visit = (node: ts.Node) => {
    for (const child of node.getChildren(sourceFile)) {
      collect(ts.getLeadingCommentRanges(source, child.getFullStart()));
      collect(ts.getTrailingCommentRanges(source, child.getEnd()));
      visit(child);
    }
  };
  visit(sourceFile);
  let out = "";
  let at = 0;
  for (const [pos, end] of [...spans.entries()].sort((a, b) => a[0] - b[0])) {
    if (pos < at) continue;
    out += source.slice(at, pos) + source.slice(pos, end).replace(/[^\n]/g, "");
    at = end;
  }
  return out + source.slice(at);
}

/** Comparison is on non-whitespace content: both readers are free to differ on layout. */
const squeeze = (source: string) => source.replace(/\s+/g, "");

/**
 * THE READER AS IT STOOD BEFORE #1635, kept as the positive control's subject.
 *
 * A character walk that knows quotes and comments and nothing else. It is here
 * rather than described because a control needs a thing to fail, and describing
 * the old shape in prose would have left the comparison unproven — which is
 * exactly how this arm's first draft passed while exercising nothing.
 */
function flatWalkAsItStoodBefore1635(source: string): string {
  const quotes = new Set(['"', "'", BACKTICK]);
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
        if (current === NEWLINE && quote !== BACKTICK) break;
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

function scannedFiles(extension?: "ts" | "tsx"): string[] {
  const contains = containedIn(REPO_ROOT);
  const out: string[] = [];
  for (const absolute of trackedFiles(REPO_ROOT)) {
    const relative = path.relative(REPO_ROOT, absolute).split(path.sep).join("/");
    if (!/\.(ts|tsx)$/.test(relative)) continue;
    if (extension === "ts" && relative.endsWith(".tsx")) continue;
    if (extension === "tsx" && !relative.endsWith(".tsx")) continue;
    if (!contains(absolute)) continue;
    out.push(relative);
  }
  return out.sort();
}

describe("withoutComments — the one comment stripper (#1635)", () => {
  it("strips a docblock, which is the whole point of it", () => {
    const source = ["/** a docblock sentence */", "const kept = 1;"].join("\n");
    expect(withoutComments(source)).not.toContain("a docblock sentence");
    expect(withoutComments(source)).toContain("const kept = 1;");
  });

  it("keeps a `//` inside a string literal — the #1625 direction", () => {
    const source = 'const url = "https://pub.r2.dev/a/b.png"; const shape = { toolKind: null };';
    expect(withoutComments(source)).toContain("toolKind: null");
  });

  /* ---- #1635's own two measurements, as arms ---- */

  it("a regex literal with an odd backtick count does not stop the stripping", () => {
    // Direction 1. The shape at `staff/section05-guard.test.ts:446`: a regex
    // whose character class holds ONE backtick left the old walk inside a
    // template literal, and every docblock after it was copied through as code.
    const withRegex = [
      "const re = /title=(?:" + BACKSLASH + "{" + BACKTICK + "([^" + BACKTICK + "]*)" + BACKTICK + BACKSLASH + "}|x)/g;",
      "/** a docblock sentence */",
      "const kept = 1;",
    ].join("\n");
    const withoutRegex = ["const re = /nothing special/g;", "/** a docblock sentence */", "const kept = 1;"].join("\n");

    // The negative control belongs beside it: the fixture must only differ by the regex.
    expect(withoutComments(withoutRegex)).not.toContain("a docblock sentence");
    expect(withoutComments(withRegex)).not.toContain("a docblock sentence");
  });

  it("a regex ending in an escaped slash does not truncate the line", () => {
    // Direction 2, and the unsafe one: the old walk read `\//` as a line
    // comment and everything after the regex left the guard's sight.
    const source = 'const f = s.replace(/^image' + BACKSLASH + '//, "") + KEPT_TOKEN;';
    expect(withoutComments(source)).toContain("KEPT_TOKEN");
  });

  it("a nested template substitution does not truncate the line", () => {
    // Direction 3, which no card named: the parser control below found it.
    const source =
      "const maskUrl = " + BACKTICK + "/api/image-proxy?url=${encodeURIComponent(" +
      BACKTICK + "https://bucket.example/${key}" + BACKTICK + ")}" + BACKTICK + " + KEPT_TOKEN;";
    const read = withoutComments(source);
    expect(read).toContain("bucket.example");
    expect(read).toContain("KEPT_TOKEN");
  });

  it("a comment INSIDE a template substitution is still a comment", () => {
    // The substitution holds code, so the walk owes it the same reading.
    const source = "const x = " + BACKTICK + "a${/* hidden */ value}b" + BACKTICK + ";";
    expect(withoutComments(source)).not.toContain("hidden");
    expect(withoutComments(source)).toContain("value");
  });

  /* ---- negative controls: it must not read MORE than the source says ---- */

  it("division is not a regex literal, so a comment after it is still stripped", () => {
    const cases = [
      "const ratio = total / count; // a trailing note",
      "const ratio = (a + b) / count; // a trailing note",
      "const ratio = items[0] / count; // a trailing note",
      "const ratio = size.width / 2; // a trailing note",
    ];
    for (const source of cases) {
      expect(withoutComments(source), source).not.toContain("a trailing note");
    }
  });

  it("a regex literal's own contents are preserved, quotes and all", () => {
    const source = "const re = /['" + BACKSLASH + '"`]/g; const kept = 1;';
    const read = withoutComments(source);
    expect(read).toBe(source);
  });

  it("line numbers survive a block comment", () => {
    const source = ["const a = 1;", "/* one", "   two", "   three */", "const b = 2;"].join("\n");
    expect(withoutComments(source).split("\n").length).toBe(source.split("\n").length);
  });

  /* ---- the compiler, over the real tree ---- */

  it("reads a real population — the floor, before any verdict counts", () => {
    const files = scannedFiles();
    expect(files.length).toBeGreaterThan(1_500);
    // It must be able to see the files whose readings moved.
    expect(files).toContain("server/castingV2/facePanel.test.ts");
    expect(files).toContain("client/src/features/staff/section05-guard.test.ts");
    expect(files).toContain("server/testing/withoutComments.ts");
  });

  it("positive control: the comparison CATCHES this file's own predecessor", () => {
    // Law 2 — the instrument gets a control before its verdicts count, and the
    // control has to be the real blind reader rather than a convenient one. The
    // first draft of this arm used the anchored line shape, which never touches
    // a mid-line `//` and therefore AGREED with the parser on the fixture: a
    // positive control that passes by not exercising its subject.
    //
    // So this is the flat walk as it stood before #1635 — quote-aware, blind to
    // regex literals and to nested substitutions. Each of the three fixtures
    // must be caught, or the tree sweep below proves nothing.
    const fixtures = [
      'const f = s.replace(/^image' + BACKSLASH + '//, "") + KEPT_TOKEN;\n',
      "const re = /[" + BACKTICK + "]/g;\n/** a docblock */\nconst kept = 1;\n",
      "const u = " + BACKTICK + "a${f(" + BACKTICK + "https://h/${k}" + BACKTICK + ")}" + BACKTICK + ";\n",
    ];
    for (const fixture of fixtures) {
      const expected = squeeze(parserStrip(fixture, "fixture.ts"));
      expect(squeeze(flatWalkAsItStoodBefore1635(fixture)), fixture).not.toBe(expected);
      expect(squeeze(withoutComments(fixture)), fixture).toBe(expected);
    }
  });

  it("agrees with the TypeScript parser on every tracked source file", () => {
    const disagreements: string[] = [];
    for (const relative of scannedFiles()) {
      const source = readListedSource(path.join(REPO_ROOT, relative));
      if (source === null) continue;
      let expected: string;
      try {
        expected = parserStrip(source, relative);
      } catch {
        // A file the parser cannot read is not this reader's finding to make.
        continue;
      }
      const actual = withoutComments(source);
      if (squeeze(actual) === squeeze(expected)) continue;
      const delta = squeeze(expected).length - squeeze(actual).length;
      disagreements.push(`${relative}: reads ${delta > 0 ? `${delta} characters SHORT` : `${-delta} characters LONG`}`);
    }
    expect(disagreements.sort()).toEqual([]);
  });
});

/**
 * THE SECOND CONTRACT, PROVEN AGAINST THE COMPILER TOO (#1638).
 *
 * `codeOnly` drops a literal's CONTENTS as well as the comments around it, so
 * that a call-shaped string is not read as a call. Three tree-walking derivers
 * key their populations on it (#548, #741), and it used to be a SECOND WALK in
 * `childProcessSuites.ts` carrying exactly the blindness #1635 closed in the
 * first one — measured at **8 tracked files left inside a literal at end of
 * file**, dropping 5,398 to 18,420 non-whitespace characters each.
 *
 * ⚠ **A WRONG REGEX READ COSTS THE FIRST CONTRACT NOTHING AND THE SECOND ONE
 * THE SPAN, WHICH IS WHY POINTING THE PARSER AT BOTH FOUND THREE MORE
 * MISREADS.** `withoutComments` keeps a span either way, so a `/` mistaken for
 * a regex start is invisible in its output; `codeOnly` deletes it. The three,
 * all live and all now fixed in the shared reader: a non-null assertion
 * (`stencil.width! / stencil.height!`), a negation after a keyword
 * (`return !/x/.test(s)`) and a JSX closing tag (`</div>`).
 */

/**
 * Every span `codeOnly` must blank: the parser's comment ranges, and its
 * literal TOKENS. The `${` and `}` of a template are punctuation of the
 * surrounding expression rather than literal text — the parser folds them into
 * `TemplateHead`/`Middle`/`Tail`, so they are trimmed back off here, which is
 * exactly the reading the walk takes.
 */
const LITERAL_TOKENS = new Map<ts.SyntaxKind, { lead: number; trail: number }>([
  [ts.SyntaxKind.StringLiteral, { lead: 0, trail: 0 }],
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral, { lead: 0, trail: 0 }],
  [ts.SyntaxKind.RegularExpressionLiteral, { lead: 0, trail: 0 }],
  [ts.SyntaxKind.TemplateHead, { lead: 0, trail: 2 }],
  [ts.SyntaxKind.TemplateMiddle, { lead: 1, trail: 2 }],
  [ts.SyntaxKind.TemplateTail, { lead: 1, trail: 0 }],
]);

function parserCodeOnly(source: string, fileName: string): string {
  const scriptKind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind);
  const spans: [number, number][] = [];
  const collect = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) spans.push([range.pos, range.end]);
  };
  const visit = (node: ts.Node) => {
    for (const child of node.getChildren(sourceFile)) {
      collect(ts.getLeadingCommentRanges(source, child.getFullStart()));
      collect(ts.getTrailingCommentRanges(source, child.getEnd()));
      const trim = LITERAL_TOKENS.get(child.kind);
      if (trim) spans.push([child.getStart(sourceFile) + trim.lead, child.end - trim.trail]);
      visit(child);
    }
  };
  visit(sourceFile);
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let out = "";
  let at = 0;
  for (const [pos, end] of spans) {
    if (end <= at) continue;
    const from = Math.max(at, pos);
    out += source.slice(at, from) + source.slice(from, end).replace(/[^\n]/g, "");
    at = end;
  }
  return out + source.slice(at);
}

/**
 * Does this file hold a quote inside JSX TEXT? That is the reader's one
 * declared remainder, and this asks the PARSER rather than matching a shape —
 * so the arm below compares two derived sets instead of a set against a list.
 */
function hasQuotedJsxText(source: string, fileName: string): boolean {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (node.kind === ts.SyntaxKind.JsxText) {
      if (/['"]/.test(source.slice(node.getStart(sourceFile), node.end))) found = true;
      return;
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * `codeOnly` AS IT STOOD IN `childProcessSuites.ts` BEFORE #1638, kept as the
 * positive control's subject. A control needs a thing to fail, and describing
 * the old walk in prose would leave the comparison unproven — the same reason
 * `flatWalkAsItStoodBefore1635` sits above.
 */
function secondWalkAsItStoodBefore1638(source: string): string {
  let out = "";
  let i = 0;
  type Mode = "code" | "line" | "block" | "single" | "double" | "template";
  let mode: Mode = "code";
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (mode === "code") {
      if (two === "//") { mode = "line"; i += 2; continue; }
      if (two === "/*") { mode = "block"; i += 2; continue; }
      if (source[i] === "'") { mode = "single"; i += 1; continue; }
      if (source[i] === '"') { mode = "double"; i += 1; continue; }
      if (source[i] === BACKTICK) { mode = "template"; i += 1; continue; }
      out += source[i];
      i += 1;
      continue;
    }
    if (mode === "line") {
      if (source[i] === NEWLINE) { mode = "code"; out += NEWLINE; }
      i += 1;
      continue;
    }
    if (mode === "block") {
      if (two === "*/") { mode = "code"; i += 2; continue; }
      if (source[i] === NEWLINE) out += NEWLINE;
      i += 1;
      continue;
    }
    if (source[i] === BACKSLASH) { i += 2; continue; }
    if (source[i] === NEWLINE && mode !== "template") { mode = "code"; out += NEWLINE; i += 1; continue; }
    const closer = mode === "single" ? "'" : mode === "double" ? '"' : BACKTICK;
    if (source[i] === closer) { mode = "code"; }
    if (source[i] === NEWLINE) out += NEWLINE;
    i += 1;
  }
  return out;
}

describe("codeOnly — the same walk, with the literals dropped (#1638)", () => {
  it("drops a literal's contents, and that IS the contract", () => {
    const source = [
      "// spawnSync('a')",
      "/* execFileSync('b') */",
      'const fake = "spawnSync(\'c\')";',
      "spawnSync('the-real-one');",
    ].join(NEWLINE);
    const read = codeOnly(source);
    expect(read).toContain("spawnSync(");
    /* One call survives, not four: the count is the assertion. */
    expect(read.match(/spawnSync\(|execFileSync\(/g)).toHaveLength(1);
  });

  it("a regex literal's contents go too, because a pattern is not a call", () => {
    /* The direction that cannot manufacture a member. `/spawnSync\(/` is a
       thing the file MATCHES ON; a real call cannot sit inside one. */
    const source = "const RE = /spawnSync" + BACKSLASH + "(/; const kept = 1;";
    const read = codeOnly(source);
    expect(read).not.toContain("spawnSync");
    expect(read).toContain("const kept = 1;");
  });

  it("a `${…}` holds CODE, and the old walk swallowed it whole", () => {
    /* The remainder `childProcessSuites`'s header declared as having "no live
       instance today" — closed here rather than carried, because the frame
       stack that fixes the BOUNDARY answers this for free. */
    const source = "const line = " + BACKTICK + "a ${execFileSync(" + BACKTICK + "git" + BACKTICK + ")} b" + BACKTICK + ";";
    expect(codeOnly(source)).toContain("execFileSync(");
    expect(secondWalkAsItStoodBefore1638(source)).not.toContain("execFileSync(");
  });

  it("line numbers survive a dropped literal", () => {
    /* The promise a consumer reporting a line number relies on. */
    const source = ["const a = 1;", "const t = " + BACKTICK + "one", "two", "three" + BACKTICK + ";", "const b = 2;"].join(NEWLINE);
    expect(codeOnly(source).split(NEWLINE).length).toBe(source.split(NEWLINE).length);
  });

  /* ---- the three misreads the second contract exposed ---- */

  it("a non-null assertion divides; a negation opens a regex", () => {
    /* Both shapes are live and they differ only in what precedes the `!`. The
       first swallowed 46 characters of `faceScanService.test.ts`.

       ⚠ THE FIXTURE IS THAT FILE'S REAL LINE, AND THE FIRST DRAFT OF IT WAS
       INERT — the sabotage driver said so. It carried ONE division, and a
       regex scan that finds no closing slash before the newline backs out on
       its own, so the arm passed with the discriminator deleted. It takes TWO
       divisions on one line for the second `/` to close the false regex, which
       is why the real line is the fixture rather than a tidied one. */
    const divides =
      "expect(stencil.width! / stencil.height!).toBeCloseTo(entry.box.width / entry.box.height, KEPT_TOKEN);";
    expect(codeOnly(divides)).toContain("toBeCloseTo");
    expect(codeOnly(divides)).toContain("KEPT_TOKEN");
    const negates = "const bad = !/^NOT MEASURED/.test(text); const kept = KEPT_TOKEN;";
    const read = codeOnly(negates);
    expect(read, "the pattern is a literal and goes").not.toContain("NOT MEASURED");
    expect(read).toContain("KEPT_TOKEN");
    /* And a negation after a KEYWORD, which a one-character reading got wrong
       the other way — three files read LONG on the first attempt. */
    expect(codeOnly("return !/^NOT MEASURED/.test(text);")).not.toContain("NOT MEASURED");
    /* `!!/re/` is still a regex: `!` does not end a value. */
    expect(codeOnly("const ok = !!/^a/.test(s);")).not.toContain("^a");
  });

  it("a JSX closing tag is not a regex literal", () => {
    /* `<a></a><b></b>` read `/a><b></` as a regex and deleted the text between
       the tags. Both halves of `</` are answered: `>` may only be followed by a
       regex when it is an arrow, and a `/` straight after a `<` is a tag. */
    const source = "<a>KEPT_ONE</a><b>KEPT_TWO</b>";
    const read = codeOnly(source);
    expect(read).toContain("KEPT_ONE");
    expect(read).toContain("KEPT_TWO");
    expect(secondWalkAsItStoodBefore1638("<a>KEPT_ONE</a><b>KEPT_TWO</b>")).toContain("KEPT_ONE");
    /* The arrow still opens one, and it is this tree's commonest predecessor. */
    expect(codeOnly("const f = (s: string) => /^SECRET/.test(s);")).not.toContain("SECRET");
  });

  /* ---- the compiler, over the real tree ---- */

  it("positive control: the comparison CATCHES the walk this one replaced", () => {
    /* Law 2. Each fixture is a shape the previous walk got wrong, and the
       parser is the arbiter of both readings rather than this file's opinion. */
    const fixtures = [
      "const CLAIM = /push to " + BACKTICK + "main" + BACKTICK + " deploys/;" + NEWLINE +
        "/** a docblock */" + NEWLINE + "spawnSync('x');" + NEWLINE,
      "const line = " + BACKTICK + "a ${execFileSync(" + BACKTICK + "git" + BACKTICK + ")} b" + BACKTICK + ";" + NEWLINE,
      "const RE = /spawnSync" + BACKSLASH + "(/;" + NEWLINE,
    ];
    for (const fixture of fixtures) {
      const expected = squeeze(parserCodeOnly(fixture, "fixture.ts"));
      expect(squeeze(secondWalkAsItStoodBefore1638(fixture)), fixture).not.toBe(expected);
      expect(squeeze(codeOnly(fixture)), fixture).toBe(expected);
    }
  });

  it("agrees with the TypeScript parser on every tracked .ts file", () => {
    const files = scannedFiles("ts");
    /* The floor, before the verdict counts — and the files whose readings moved. */
    expect(files.length).toBeGreaterThan(1_500);
    expect(files).toContain("server/deployTriggerClaims.test.ts");
    expect(files).toContain("server/selfInvocationCheck.test.ts");
    expect(files).toContain("shared/crewNextUpHold.ts");

    const disagreements: string[] = [];
    for (const relative of files) {
      const source = readListedSource(path.join(REPO_ROOT, relative));
      if (source === null) continue;
      let expected: string;
      try {
        expected = parserCodeOnly(source, relative);
      } catch {
        continue;
      }
      const actual = squeeze(codeOnly(source));
      if (actual === squeeze(expected)) continue;
      const delta = squeeze(expected).length - actual.length;
      disagreements.push(`${relative}: reads ${delta > 0 ? `${delta} characters SHORT` : `${-delta} characters LONG`}`);
    }
    expect(disagreements.sort()).toEqual([]);
  });

  it("no literal is left open at end of file — the card's own probe, at zero", () => {
    /* #1638's measurement: append a sentinel on its own line and ask whether it
       survives. It does not when the walk is still inside a literal at EOF,
       which is the unbounded swallow. It returned EIGHT before the repair. */
    const SENTINEL = "ZZ_SENTINEL_1638_ZZ";
    const swallowed: string[] = [];
    for (const relative of scannedFiles()) {
      const source = readListedSource(path.join(REPO_ROOT, relative));
      if (source === null) continue;
      if (!codeOnly(`${source}${NEWLINE}${SENTINEL}${NEWLINE}`).includes(SENTINEL)) swallowed.push(relative);
    }
    expect(swallowed.sort()).toEqual([]);
  });

  it("the ONE declared remainder is JSX text, and it is a census rather than a floor", () => {
    /* ⚠ A CHARACTER WALK CANNOT READ JSX. `<p>doesn't exist.</p>` is TEXT to
       the parser and a string literal to any walk, so under `drop` the rest of
       the element goes. The limit is declared with its population, and the two
       sets are DERIVED and compared rather than a set being checked against a
       hand-kept list — a list would drift the first time a component gained an
       apostrophe. Measured the day this landed: 15 of 257. */
    const differ: string[] = [];
    const quoted: string[] = [];
    for (const relative of scannedFiles("tsx")) {
      const source = readListedSource(path.join(REPO_ROOT, relative));
      if (source === null) continue;
      if (hasQuotedJsxText(source, relative)) quoted.push(relative);
      let expected: string;
      try {
        expected = parserCodeOnly(source, relative);
      } catch {
        continue;
      }
      if (squeeze(codeOnly(source)) !== squeeze(expected)) differ.push(relative);
    }
    expect(
      differ.sort(),
      "a .tsx file reading differently for any reason but a quote inside JSX text is a new finding",
    ).toEqual(quoted.sort());

    /* ⚠ AND THE REASON IT COSTS THE THREE DERIVERS NOTHING: none of them ever
       reads one. Both populations are `git ls-files "*.test.ts" "*.test.tsx"`,
       and the tree holds no `*.test.tsx` at all. This arm is the tripwire for
       the day it does — if that file holds a quote inside JSX text, its reading
       is wrong and either the reader learns JSX or the file is exempted with
       its reason. A `.test.tsx` WITHOUT such a quote leaves it green, which is
       the correct answer rather than a convenient one. */
    expect(
      differ.filter((relative) => relative.endsWith(".test.tsx")),
      "a test file whose reading is wrong is in a derived population and cannot be left declared",
    ).toEqual([]);
  });
});
