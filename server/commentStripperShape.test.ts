import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { containedIn, trackedFiles } from "../scripts/lib/trackedFiles.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

/* Two derived populations claim this suite and it declares one floor for both.
   It reads the whole tracked source tree off disk through `readListedSource`
   (#741's source sweep), and `trackedFiles` asks git what the repository
   contains — a real `ls-files` process — which puts it in #548's child-process
   population too. `declaresTheFloor` accepts either constant and both are
   30_000; the child-process one is named because that is the slower fact about
   this suite. Preflight found the second population, not a reviewer: the first
   draft declared the contended floor alone and went red on #548. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * A GUARD MAY NOT STRIP `//` TO END OF LINE (#1629).
 *
 * # What this is actually protecting
 *
 * Something like ninety suites in this repository decide whether a diff merges
 * by READING SOURCE — *does this file still say the forbidden thing?* Every one
 * of them has to strip comments first, because this repository writes its
 * reasons into docblocks and a guard that counted its own prose would redden on
 * the sentence explaining the rule it enforces.
 *
 * The obvious way to strip a line comment is a bare `//` to end of line. It is
 * wrong, and it is wrong in the direction nobody notices: **a `//` inside a
 * string literal is not a comment.**
 *
 *     const doc = "https://klieglabs.com/pricing"; const shape = { toolKind: null };
 *
 * A bare `//` reader truncates that at the scheme. Everything after it —
 * `toolKind: null`, a real money decision — leaves the guard's sight, the guard
 * passes, and nothing anywhere says a thing. **A guard that reads less passes
 * for the wrong reason**, which is the silence direction and the one this
 * repository keeps paying for.
 *
 * # It was live, not theoretical, and it was measured before it was fixed
 *
 * Eight sites carried the bare shape. Measured over the 1,947 tracked `.ts` and
 * `.tsx` files the day this landed, comparing each reading against the shared
 * quote-aware one on NON-WHITESPACE content:
 *
 *   | line-comment shape             | files read SHORT | real characters unseen |
 *   |--------------------------------|------------------|------------------------|
 *   | bare `//` to end of line       | 283              | 89,656                 |
 *   | anchored, line-start only      | 61               | 44,055                 |
 *
 * Three of the eight were blind on today's inputs rather than merely at risk:
 * `selfInvocationCheck` read 127 of 573 scripts short (41,533 characters),
 * `creditToolKind` — a MONEY guard, the one asserting that exactly three
 * production files pass `toolKind: null` — read 23 of 523 server files short,
 * and the crew desk's open/held reading read one file short.
 *
 * The control that closed it: a real `toolKind: null` decision appended to
 * `server/_core/cookies.ts` on a line carrying a URL. On its old private
 * stripper the money guard returned **8 passed**. Through the shared reader it
 * returns **1 failed**, naming the file.
 *
 * # Why a guard rather than a line in the standing orders
 *
 * Because the population regrows silently. #1625 found four strippers, #1628
 * re-measured and found thirty-five across nine shapes, and nothing in the tree
 * would have said so. An allowlist of the survivors would be the second list
 * working law 4 warns about — so this guard names no survivors: after #1629 the
 * population of the bare shape is ZERO, and the only exemption is this file,
 * which has to carry the shapes it forbids in order to hunt for them.
 *
 * # What it deliberately does NOT forbid
 *
 * **The anchored, line-start-only shape**, which 60-odd suites still carry. It
 * is safer — it only strips a comment that begins a line — and retiring it is a
 * separate sweep with a separate measurement, named on #1629 rather than folded
 * in here. **And the URL-aware shape** two suites use deliberately, which
 * refuses to read the slashes in a scheme as a comment. The negative control
 * below pins that neither is caught, because a guard that punished a correct
 * answer would be deleted rather than obeyed.
 *
 * Both are written as literals in that control rather than quoted here: the
 * character pair that closes a block comment occurs inside the regex itself, so
 * a docblock cannot carry one. That is also why the table above says "anchored,
 * line-start only" in words.
 *
 * # ⚠ It hunts the RAW source, and the reason CHANGED under it (#1635)
 *
 * The first draft stripped each file with `withoutComments` before looking, on
 * the reasonable-sounding ground that prose quoting the shape is not a
 * declaration of it. The sabotage driver caught it: a bare stripper restored
 * into `creditToolKind.test.ts` landed on disk and the guard stayed GREEN.
 *
 * **The cause was a limit of the shared reader, and #1635 CLOSED it.** That
 * reader knew string literals and comments and not REGEX LITERALS: a
 * block-comment-stripping regex ends with a backslash, a slash and a slash,
 * which it read as the start of a line comment, so it deleted the rest of that
 * line — and the two strippers are almost always written on ONE line, so
 * stripping comments first hid the shape on exactly the line it lives on.
 * `withoutComments` now reads regex literals and nested template substitutions,
 * proven against the TypeScript parser over every tracked file on every run
 * (`server/testing/withoutComments.test.ts`). The arm below pins the NEW
 * reading, so this paragraph cannot rot back into a fact.
 *
 * ⚠ **The hunt still reads the RAW source, and that is now a CHOICE rather
 * than a workaround — which is worth saying plainly, because the reason it was
 * forced no longer exists.** It keys on the CALL — the needle immediately
 * preceded by `.replace(` — rather than on the pattern alone. A docblock
 * discussing the shape in prose does not match that; one pasting a whole call
 * would, and would be right to, **because this repository's own history is of a
 * quoted shape being copied back into use.** That second reason was always the
 * load-bearing one and it is untouched by #1635, so the hunt does not move.
 */

const REPO_ROOT = path.resolve(__dirname, "..");

/** The bare shapes: `//` to end of line, with nothing in front of it. */
const FORBIDDEN: { shape: string; needle: string }[] = [
  { shape: "//.*$ with the m flag", needle: String.raw`/\/\/.*$/gm` },
  { shape: "//.* globally", needle: String.raw`/\/\/.*/g` },
  { shape: "//[^\\n]* globally", needle: String.raw`/\/\/[^\n]*/g` },
];

/**
 * The ONE exemption, and it is structural rather than a survivor: this file
 * must contain the shapes it forbids to be able to look for them. The arm below
 * asserts the list stays exactly this long, so a second entry cannot be added
 * quietly — that is the moment it would become the allowlist this guard exists
 * instead of.
 */
const EXEMPT = ["server/commentStripperShape.test.ts"];

const SCANNED_ROOTS = ["client/src", "server", "shared", "scripts"];

/**
 * The hunt, in one place so the controls and the sweep cannot drift apart. It
 * reads the source AS WRITTEN and keys on the call rather than on the pattern —
 * see the header for why stripping comments first is what made the first draft
 * blind to its own subject.
 */
function shapesDeclaredIn(source: string): string[] {
  return FORBIDDEN.filter(({ needle }) => source.includes(`.replace(${needle}`)).map(({ shape }) => shape);
}

function declaresAForbiddenShape(source: string): boolean {
  return shapesDeclaredIn(source).length > 0;
}

function scannedFiles(): string[] {
  const contains = containedIn(REPO_ROOT);
  const out: string[] = [];
  for (const absolute of trackedFiles(REPO_ROOT)) {
    const relative = path.relative(REPO_ROOT, absolute).split(path.sep).join("/");
    if (!SCANNED_ROOTS.some((root) => relative.startsWith(`${root}/`))) continue;
    if (!/\.(ts|tsx|mts|js|mjs)$/.test(relative)) continue;
    if (EXEMPT.includes(relative)) continue;
    if (!contains(absolute)) continue;
    out.push(relative);
  }
  return out.sort();
}

describe("no guard strips `//` to end of line (#1629)", () => {
  it("reads a real population — the floor, before any verdict counts", () => {
    const files = scannedFiles();
    expect(files.length).toBeGreaterThan(1_500);
    // It must be able to SEE the suites this rule is about.
    expect(files).toContain("server/creditToolKind.test.ts");
    expect(files).toContain("server/selfInvocationCheck.test.ts");
    expect(files).toContain("client/src/features/castingV2/modalAnatomy.test.ts");
  });

  it("positive control: the reader catches each forbidden shape in a fixture", () => {
    for (const { shape, needle } of FORBIDDEN) {
      const fixture = `const code = source.replace(${needle}, "");`;
      expect(declaresAForbiddenShape(fixture), shape).toBe(true);
    }
  });

  it("positive control: it catches the shape written beside a block stripper, on ONE line", () => {
    // The shape it missed in its first draft. These two are nearly always
    // written together, so a reader blind to the pair is blind in practice.
    const together = `  return source.replace(/\\/\\*[\\s\\S]*?\\*\\//g, "").replace(${FORBIDDEN[2]!.needle}, "");`;
    expect(declaresAForbiddenShape(together)).toBe(true);
    // ⚠ THIS ASSERTION IS THE OTHER WAY ROUND SINCE #1635, AND THE FLIP IS THE
    // POINT. It used to pin the shared reader EATING this line — the limit that
    // forced the raw-source hunt. The reader now reads the regex literal, so
    // the call survives being stripped. The hunt stays raw for its second
    // reason (a quoted call is this tree's real history); the assertion moves
    // because a guard may not go on asserting a defect that has been fixed.
    expect(withoutComments(together).includes(FORBIDDEN[2]!.needle)).toBe(true);
  });

  it("negative control: the URL-aware and anchored shapes are NOT caught", () => {
    const allowed = [
      String.raw`const a = source.replace(/(^|[^:])\/\/[^\n]*/g, "$1");`,
      String.raw`const b = source.replace(/(^|[^:])\/\/.*$/gm, "$1");`,
      String.raw`const c = source.replace(/^\s*\/\/.*$/gm, "");`,
      String.raw`const d = source.replace(/^[ \t]*\/\/.*$/gm, "");`,
    ];
    for (const line of allowed) {
      expect(declaresAForbiddenShape(line), line).toBe(false);
    }
  });

  it("negative control: prose naming the pattern is not a declaration of it", () => {
    // Keying on the CALL is what makes this true: the rule can be discussed in
    // a docblock — as this file's own header discusses it — without a suite
    // that mentions it becoming an offence.
    const prose = `// never strip with ${FORBIDDEN[0]!.needle} — it eats a URL\nconst ok = 1;`;
    expect(declaresAForbiddenShape(prose)).toBe(false);
  });

  it("no tracked source file declares one", () => {
    const offences: string[] = [];
    for (const relative of scannedFiles()) {
      const source = readListedSource(path.join(REPO_ROOT, relative));
      if (source === null) continue;
      for (const shape of shapesDeclaredIn(source)) offences.push(`${relative}: strips ${shape}`);
    }
    expect(offences.sort()).toEqual([]);
  });

  it("the exemption list is one file, and it is this one", () => {
    // A second entry here is the moment this guard becomes an allowlist of
    // survivors rather than a rule with an empty population.
    expect(EXEMPT).toEqual(["server/commentStripperShape.test.ts"]);
  });
});
