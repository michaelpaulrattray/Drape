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
 * Does this file REACH the live compiler — call it, or hand it on as a value?
 *
 * Both shapes count, and the second is the one a call-count would miss:
 * `rollService.ts` names it as a default (`dependencies.compileBrief ??
 * castingBriefCompiler`) rather than calling it in place.
 */
function reachesTheCompiler(text: string): boolean {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const withoutOwnDeclaration = withoutComments.replace(/export const castingBriefCompiler\b[^=]*=/g, "");
  return /\bcastingBriefCompiler\b/.test(withoutOwnDeclaration);
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
