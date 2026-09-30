import path from "node:path";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import { containedIn, trackedFiles } from "../../scripts/lib/trackedFiles.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./childProcessTimeout";
import { readListedSource } from "./listedSource";
import { withoutComments } from "./withoutComments";

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

function scannedFiles(): string[] {
  const contains = containedIn(REPO_ROOT);
  const out: string[] = [];
  for (const absolute of trackedFiles(REPO_ROOT)) {
    const relative = path.relative(REPO_ROOT, absolute).split(path.sep).join("/");
    if (!/\.(ts|tsx)$/.test(relative)) continue;
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
