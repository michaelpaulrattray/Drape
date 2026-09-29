/**
 * ⚠ THE HOUSE ROAD IS GONE, NOT MERELY UNREACHABLE — #1490 ACT 1, AND THIS
 * SUITE'S SUBJECT CHANGED UNDER IT.
 *
 * It was written by #1445 (slice 4) to pin the POPULATION while the branch was
 * still in the tree: `castingBriefCompiler` carried both roads, `rollService`
 * passed the literal `authorRoad: true`, and a SECOND production caller that
 * omitted the field would have taken the house road silently on a paid path
 * with every wire arm still green. That was working law 4 read forwards, and
 * it was the right guard for that tree.
 *
 * **Act 1 deleted the branch and the input field with it, so the hazard is
 * structural rather than guarded: there is no second road to take by
 * forgetting anything.** Three arms went with it and each says so in place —
 * the literal check, its own can-this-fail control, and the paired
 * behaviour control that drove BOTH roads to prove the suite was not vacuous.
 * That last one is the one worth naming: it existed precisely because an
 * unreachable branch that did nothing would have made the suite meaningless,
 * and the honest reading now is that there is no second behaviour to compare.
 *
 * # WHAT IS STILL LIVE HERE, AND WHY IT IS WORTH KEEPING
 *
 * ONE production module reaches this compiler. That is no longer a money
 * guard — a new caller would get the one road, correctly — but it is still a
 * true and useful architectural fact, and it is the arm the walker and the
 * matcher exist to make trustworthy: "no second caller" passes for three
 * reasons and only one of them is the finding, so the walker is proven to read
 * a real population and the matcher is proven to find a reach in a literal and
 * to refuse a comment and the declaration.
 *
 * THE FILE KEEPS ITS NAME: #1445, #1490 and the retirement manifest all point
 * at it by name, and renaming a suite inside a retirement is the tidying his
 * rule on #1398 forbids folding in.
 *
 * # THE SECOND ROUTE, AND IT WAS HELD AT ZERO BY A COMMENT (#1491)
 *
 * There are TWO ways into the house road's prompts, and the arms above pin one
 * of them. The other is `deterministicBriefCompiler` — which composes through
 * `composeCandidatePrompt` and delivers the house road's prompts with no
 * interpreter call at all. Raised by the founder's engineer (Squall) on #1489's
 * review.
 *
 * #1489 withdrew its docblock's invitation to production callers. **A comment
 * is not a control** (enforcement invariant 7): a caller wired in later would
 * put a paid roll back on the retired lane with every existing arm in this
 * repository still green, because nothing counted the population. These arms
 * count it, at ZERO, in the same walk as the live compiler's.
 *
 * Both symbols dissolve when #1490 act 2 deletes them, and these arms go with
 * them. Until then the house road is not to be described as closed.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { readListedSource } from "../testing/listedSource";

/* This suite reads every source file in the server tree, which is well past
   vitest's 5s default under parallel load (#741). */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const ROOT = path.resolve(__dirname, "../..");

/**
 * A NAMED file, which is not allowed to be missing — the same split this tree's
 * other walkers use (#223): a null is the finding for a name this suite chose,
 * and is tolerated only on the walk, where a disposable can leave between the
 * listing and the read.
 */
function read(file: string): string {
  const text = readListedSource(path.resolve(ROOT, file));
  if (text === null) throw new Error(`${file} is not there, and this suite names it`);
  return text;
}

/** Every non-test source file under the product's server tree. */
function serverSourceFiles(): string[] {
  const out: string[] = [];
  const skip = new Set(["node_modules", "dist", ".git"]);
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.resolve(ROOT, dir))) {
      if (skip.has(entry)) continue;
      const rel = `${dir}/${entry}`;
      /* An entry can be gone before it is even CLASSIFIED (#223). */
      const stats = statSync(path.resolve(ROOT, rel), { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) walk(rel);
      else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(rel);
    }
  };
  walk("server");
  return out;
}

/**
 * Does this file REACH a symbol — call it, import it, or hand it on as a value?
 *
 * Every shape counts, and the handoff is the one a call-count would miss:
 * `rollService.ts` names the live compiler as a default
 * (`dependencies.compileBrief ?? castingBriefCompiler`) rather than calling it
 * in place. An import counts too — a module that imports one of these has
 * reached it, whatever it then does.
 *
 * ⚠ THE COMMENT STRIP CARRIES A WHOLE BLOCK, NOT A LINE SHAPE, AND THAT IS
 * LOAD-BEARING HERE RATHER THAN CAREFUL (#1498's class). Both symbols are
 * discussed at length in prose — `cohortPhotorealHuman.ts` alone names
 * `deterministicBriefCompiler` three times and `composeCandidatePrompt` three
 * more — and this repository's dominant comment style has continuation lines
 * with no `*` prefix, which a line-shape test reads as code. A reader that
 * counted those would report callers that do not exist and the absence arms
 * below would be unfailable in the noisy direction.
 *
 * Its own limit, stated rather than discovered: a `/*` inside a STRING LITERAL
 * would open a block this reader does not close. Neither file contains one, and
 * a fixture arm below pins the shapes that are actually in the tree.
 */
function reaches(text: string, symbol: string): boolean {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  /* A declaration is not a reach. `const`, `function` and `async function` are
     the three shapes these symbols are declared in. */
  const declaration = new RegExp(`export\\s+(?:const|(?:async\\s+)?function)\\s+${symbol}\\b`, "g");
  return new RegExp(`\\b${symbol}\\b`).test(withoutComments.replace(declaration, ""));
}

/** The live compiler's own reading, kept by name because the arms below say it. */
function reachesTheCompiler(text: string): boolean {
  return reaches(text, "castingBriefCompiler");
}

describe("the house road has no production caller", () => {
  it("the walker reaches a real population of server files — the floor the absence arm rests on", () => {
    const files = serverSourceFiles();
    /* A walk that silently walked nothing would make the absence arm below pass
       for the wrong reason. The figure is a FLOOR, not the count: all it has to
       prove is that the walk ran and reached the two files that matter. */
    expect(files.length).toBeGreaterThan(200);
    expect(files).toContain("server/castingV2/rollService.ts");
    expect(files).toContain("server/castingV2/briefCompiler.ts");
    /* Test files are deliberately out — they are the branch's only consumers,
       and counting them would make the arm below assert the opposite of its
       subject. */
    expect(files.some((file) => file.endsWith(".test.ts"))).toBe(false);
  });

  it("the matcher finds the reach in a literal, and refuses a comment and the declaration", () => {
    expect(reachesTheCompiler("const compile = castingBriefCompiler;")).toBe(true);
    expect(reachesTheCompiler("compileBrief ?? castingBriefCompiler")).toBe(true);
    expect(reachesTheCompiler("/* castingBriefCompiler is named here in prose */")).toBe(false);
    expect(reachesTheCompiler("// see castingBriefCompiler")).toBe(false);
    expect(reachesTheCompiler("export const castingBriefCompiler: BriefCompiler = async () => {};")).toBe(false);
  });

  it("EXACTLY ONE production module reaches the live compiler, and it is the roll service", () => {
    const reaching = serverSourceFiles().filter((file) => {
      const text = readListedSource(path.resolve(ROOT, file));
      return text !== null && reachesTheCompiler(text);
    });
    /*
      A second name here is not a style problem — it is the house road becoming
      reachable on a paid path. Whoever adds one states which road it takes and
      why, in the same commit, and edits this arm to say so.
    */
    expect(reaching).toEqual(["server/castingV2/rollService.ts"]);
  });

  /*
    THE SECOND ROUTE (#1491). Everything above pins `castingBriefCompiler`, the
    LIVE compiler, at one caller. These pin the other way into the same prompts
    at NONE — the one #1489 left held by a withdrawn invitation in a docblock.
  */
  it("the matcher reads an import, a call and a handoff, and refuses every shape of prose", () => {
    /* The three ways a file reaches one of these. */
    expect(reaches("import { deterministicBriefCompiler } from './briefCompiler';", "deterministicBriefCompiler")).toBe(true);
    expect(reaches("const out = await deterministicBriefCompiler(input);", "deterministicBriefCompiler")).toBe(true);
    expect(reaches("compileBrief ?? deterministicBriefCompiler", "deterministicBriefCompiler")).toBe(true);
    expect(reaches("prompt: composeCandidatePrompt({ position })", "composeCandidatePrompt")).toBe(true);

    /* A declaration is not a reach — either shape these two are declared in. */
    expect(reaches("export const deterministicBriefCompiler: BriefCompiler = async (input) => {};", "deterministicBriefCompiler")).toBe(false);
    expect(reaches("export function composeCandidatePrompt(input: { position: number }) {}", "composeCandidatePrompt")).toBe(false);

    /*
      ⚠ AND NEITHER IS PROSE — INCLUDING A CONTINUATION LINE WITH NO `*`, WHICH
      IS THE SHAPE BOTH REAL FILES USE AND THE ONE #1498 IS ABOUT. A line-shape
      comment test passes the first two of these and fails the third, and would
      report `cohortPhotorealHuman.ts` as a caller of both symbols.
    */
    expect(reaches("// see deterministicBriefCompiler", "deterministicBriefCompiler")).toBe(false);
    expect(reaches("/** `deterministicBriefCompiler`, when no interpreter is asked. */", "deterministicBriefCompiler")).toBe(false);
    expect(
      reaches("/*\n  Act 2 retires deterministicBriefCompiler and\n  composeCandidatePrompt together.\n*/", "deterministicBriefCompiler"),
    ).toBe(false);
    expect(
      reaches("/*\n  Act 2 retires deterministicBriefCompiler and\n  composeCandidatePrompt together.\n*/", "composeCandidatePrompt"),
    ).toBe(false);
  });

  it("NOTHING in production reaches deterministicBriefCompiler — the second route is a declaration and nothing else", () => {
    const reaching = serverSourceFiles().filter((file) => {
      const text = readListedSource(path.resolve(ROOT, file));
      return text !== null && reaches(text, "deterministicBriefCompiler");
    });
    /*
      The whole of #1491. It delivers the house road's prompts without a network
      round trip, so ONE production caller puts a paid roll back on the retired
      lane — and until this arm existed nothing would have gone red. Whoever
      adds a caller states which road it takes and why, in the same commit, and
      edits this arm to say so.

      Its declaring file is deliberately NOT excused: a self-call inside
      `briefCompiler.ts` would reach the retired composition exactly as an
      outside one would, and the declaration itself is not a reach.
    */
    expect(reaching).toEqual([]);
  });

  it("composeCandidatePrompt is reached from the compiler that declares the route, and from nowhere else", () => {
    const reaching = serverSourceFiles().filter((file) => {
      const text = readListedSource(path.resolve(ROOT, file));
      return text !== null && reaches(text, "composeCandidatePrompt");
    });
    /*
      The composer under the second route. `briefCompiler.ts` imports and calls
      it — that is the route itself, and it is dead only because nothing calls
      the route's entrance (the arm above). What must stay at zero is everything
      ELSE: a second consumer would keep the composition alive past act 2's
      deletion of the entrance, which is how a retired road survives its own
      retirement.

      `cohortPhotorealHuman.ts` DECLARES it and names it three times in prose,
      so its absence here is the comment strip and the declaration strip both
      working — not a walk that missed the file.
    */
    expect(reaching).toEqual(["server/castingV2/briefCompiler.ts"]);
    expect(serverSourceFiles()).toContain("server/castingV2/cohortPhotorealHuman.ts");
  });

  /*
    ⚠ TWO ARMS STOOD HERE AND BOTH ARE DELETED (#1490 act 1):
    *"the roll service hands the compiler the author road as a LITERAL"* and its
    paired control *"that literal check can actually FAIL"*. The literal is gone
    from `rollService` because the FIELD is gone from the compiler's input — a
    caller can no longer select a road, so there is nothing for a literal to
    assert and nothing for `NOT_THE_LITERAL` to match. The control went with the
    arm it controlled rather than being left to test a regex nobody uses.
  */
});

/*
  ⚠ `describe("the two roads really do differ — without this the suite above is
  vacuous")` STOOD HERE — TWO ARMS — AND IS DELETED (#1490 act 1). It drove both
  roads and proved they produced different prompts and different `unsent` marks,
  which is what stopped the absence arm above from being vacuous while a dead
  branch sat in the tree. There is ONE road now, so there is no difference left
  to drive: the arms would have to compare a compile to itself, and a green
  no-op is worse than an absent arm (working law 2).

  What those arms asserted about the SURVIVING road did not go unguarded —
  `creativeRegisterScope.test.ts` drives the customer's own words reaching all
  eight prompts and every per-slice record carrying `unsent: true`, at the wire,
  and both were strengthened in this same commit.
*/
