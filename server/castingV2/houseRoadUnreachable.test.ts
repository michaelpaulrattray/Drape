/**
 * THE HOUSE ROAD IS UNREACHABLE IN PRODUCTION, AND NOTHING PINNED THE
 * POPULATION — #1445, slice 4 of the old-lane retirement.
 *
 * `castingBriefCompiler` still carries both roads. `input.authorRoad === true`
 * takes the author road — the customer's own words plus the locked block — and
 * anything else takes the HOUSE road, which composes eight prompts out of the
 * three prose tables and is the lane his *"Delete it"* (#1398) retires.
 *
 * # WHAT WAS ALREADY GUARDED, AND WHAT WAS NOT
 *
 * Slice 2 (#1443) pinned the VALUE at the wire: `rollService.test.ts` asserts
 * twice that the compiler is handed `authorRoad: true`. What nothing pinned is
 * the POPULATION — that `rollService` is the only production caller at all. A
 * second caller that omitted the field would take the house road silently, on a
 * paid path, with every one of those wire arms still green, because they assert
 * about the call they can see rather than about the set of calls that exist.
 *
 * That is working law 4 read forwards: the wire arms are a fact about one call
 * site, and "no other call site" is a different claim needing its own reader.
 *
 * # ⚠ THE ABSENCE ARM IS PAIRED WITH A BEHAVIOUR CONTROL, ON PURPOSE
 *
 * "No second caller" passes for three reasons and only one is the finding: there
 * is no second caller; the matcher is broken; the walker read nothing. So the
 * walker is proven to find a real population, the matcher is proven to find the
 * call in a literal AND to refuse a comment and the declaration, and — the arm
 * that matters most — the two roads are DRIVEN and proven to produce different
 * prompts. An unreachable branch that did nothing would make this whole suite
 * vacuous, and the only way to know is to run both.
 *
 * # WHY THE BRANCH IS STILL HERE AT ALL
 *
 * Measured on this tree, not carried from the card: collapsing it reddens
 * **101 arms across 20 suites** (the card says 86 across 17 — that figure was
 * read at slice 2's tree and is stale). They are the branch's only consumers.
 * Separating the arms that assert a LIVE resolver decision from the ones that
 * assert a DEAD house prompt is a rung-sized act, not a slice, and it is carded.
 * Until then this suite is what stops the road coming back by accident.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { readListedSource } from "../testing/listedSource";
import type { TextEngine } from "../providers/types";

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

function engineReturning(text: string): TextEngine {
  return {
    id: "test:interpreter",
    complete: async () => ({
      text,
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

const READER_REPLY = JSON.stringify({
  cohort: "photoreal_human",
  role: "a fitness creator",
  characterNotes: null,
  sex: "female",
  ageBand: "30s",
  archetype: "raw editorial",
  variationAxis: "look",
  reads: [],
});

const BRIEF = "a fitness creator in her 30s";

/**
 * An `authorRoad:` handed anything but the literal `true`.
 *
 * Declared once, at file level, so the arm that USES it and the arm that proves
 * it can fire are reading the same bytes — two copies of a regex is how one of
 * them quietly stops being the one under test.
 */
const NOT_THE_LITERAL = /authorRoad:(?!\s*true\b)/;

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

  it("the roll service hands the compiler the author road as a LITERAL", () => {
    const rollService = read("server/castingV2/rollService.ts");
    expect(rollService).toContain("authorRoad: true,");
    /*
      The literal is the whole control: a variable here could be false at
      runtime and this file would still read as though the road were settled.

      ⚠ The lookahead sits INSIDE the whitespace, not after it. Written as
      `/authorRoad:\s*(?!true\b)/` this arm fails on the correct source, because
      `\s*` happily matches zero characters and the lookahead then fires on the
      space — a zero-width match that reports the opposite of the truth. The
      control below is what turned that from a puzzling red into a one-line fix.
    */
    expect(NOT_THE_LITERAL.test(rollService)).toBe(false);
  });

  it("that literal check can actually FAIL — it is not a regex that never matches", () => {
    /* Working law 2: a guard whose matcher cannot fire proves nothing. */
    expect(NOT_THE_LITERAL.test("compileBrief({ authorRoad: enabled, })")).toBe(true);
    expect(NOT_THE_LITERAL.test("compileBrief({ authorRoad: false, })")).toBe(true);
    expect(NOT_THE_LITERAL.test("compileBrief({ authorRoad: true, })")).toBe(false);
  });
});

describe("the two roads really do differ — without this the suite above is vacuous", () => {
  it("the author road sends the customer's own words; the house road sends the composed constant", async () => {
    const author = await castingBriefCompiler({
      briefText: BRIEF,
      candidateCount: 8,
      rollSeed: "roads",
      engine: engineReturning(READER_REPLY),
      authorRoad: true,
    } as never);
    const house = await castingBriefCompiler({
      briefText: BRIEF,
      candidateCount: 8,
      rollSeed: "roads",
      engine: engineReturning(READER_REPLY),
    } as never);

    /* The author road: one authored sentence paints all eight, and it opens
       with the brief as she typed it (#535). */
    const authorPrompts = new Set(author.candidates.map((candidate) => candidate.prompt));
    expect(authorPrompts.size).toBe(1);
    expect(author.candidates[0]!.prompt.startsWith(BRIEF)).toBe(true);

    /* The house road: eight separately composed prompts, none of which opens
       with the brief. That difference is the thing being retired. */
    const housePrompts = new Set(house.candidates.map((candidate) => candidate.prompt));
    expect(housePrompts.size).toBeGreaterThan(1);
    expect(house.candidates[0]!.prompt.startsWith(BRIEF)).toBe(false);

    expect(author.candidates[0]!.prompt).not.toBe(house.candidates[0]!.prompt);
  });

  it("the author road marks every per-slice record UNSENT, and the house road does not (#176)", async () => {
    const author = await castingBriefCompiler({
      briefText: BRIEF,
      candidateCount: 8,
      rollSeed: "unsent",
      engine: engineReturning(READER_REPLY),
      authorRoad: true,
    } as never);
    const house = await castingBriefCompiler({
      briefText: BRIEF,
      candidateCount: 8,
      rollSeed: "unsent",
      engine: engineReturning(READER_REPLY),
    } as never);

    /*
      One authored prompt paints all eight, so the dice describe what was ROLLED
      and not what was DELIVERED. The flag is what stops a downstream feature
      reading the dice as fact — the defect #176 was filed about.
    */
    for (const candidate of author.candidates) {
      expect((candidate.resolvedIdentity as { unsent?: boolean }).unsent).toBe(true);
    }
    for (const candidate of house.candidates) {
      expect((candidate.resolvedIdentity as { unsent?: boolean }).unsent).toBeUndefined();
    }
  });
});
