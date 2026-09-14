/**
 * THE LIBVIPS THREAD CEILING THE TEST HARNESS SETS, HELD AT BOTH ENDS (#965).
 *
 * `vitest.setup.ts` pins `VIPS_CONCURRENCY=1` because the suite already runs a
 * worker per core and a second helping of threads inside libvips was costing it
 * 14.6% of the sharp files' wall time. Two things have to stay true for that to
 * be a fix rather than a hazard, and neither is self-evident from reading the
 * line:
 *
 *   1. **It is actually in force.** An env var set in a setup file is only
 *      useful if libvips reads it before a test imports sharp. That is an
 *      ordering claim about someone else's module init, which is exactly the
 *      kind of thing this house drives rather than assumes.
 *   2. **It cannot reach a running server.** The product's own image work wants
 *      the threads it has. A test-harness setting that leaked into production
 *      would quietly single-thread every customer's render.
 *
 * ⚠ **THE FIRST ARM IS THE ONE THAT CAN ROT SILENTLY**, and it is the reason
 * this file exists rather than a comment. If the setup line is deleted, or
 * moved below something that imports sharp, or vitest changes when setup files
 * run, nothing else in the repository goes red — the suite just gets slower
 * again and no one has a reason to look. This arm fails the moment it does.
 *
 * ⚠ **THE SWEEP IS PURE NODE, AND ITS FIRST SHAPE SHELLED OUT TO `grep`.** That
 * cost a red gate on two house guards at once — `childProcessTestTimeouts`
 * (a suite spawning a real process inside vitest's 5 s default) and
 * `hookDriver` (a suite reading a child's exit status outside `runHook`) —
 * and both were right. Reading the tree in-process removes the child, removes
 * the dependency on a `grep` being on the runner at all, and is why this file
 * declares the tree-sweep clock instead of the child-process one.
 *
 * ⚠ **AND THAT PURE-NODE CHOICE IS PARTLY REVERSED NOW, DELIBERATELY, BECAUSE
 * IT SWEPT A POPULATION THAT WAS NEVER THE PRODUCT (#976).** The walk read
 * every file on disk under its roots, and `scripts/` carries hundreds of a
 * shift's own untracked disposables. Two of them — `_965-full-suite-` and
 * `_965-red-chase-`, the harness the sharp measurement in PR #966 was taken
 * with — write `process.env.VIPS_CONCURRENCY = "1"` into a generated setup
 * file, so **`pnpm test` was RED on every shift's own tree on an unchanged
 * `main`**, deterministically, in both of two full runs.
 *
 * ⚠ **AND THE GATE COULD NEVER SEE IT**: CI checks out a clean tree, so the
 * population there cannot contain an untracked file. A red that lands only on a
 * developer's box lands on `pnpm preflight`, which is the first thing a shift
 * runs before it pushes — and this file's own sibling doctrine names that cost
 * out loud: *"A TOOL THAT REDDENS AT RANDOM IS A TOOL A SHIFT LEARNS TO
 * IGNORE."* Two standing reds teach exactly that, and the next real red arrives
 * into a shift that has learned to scroll past them.
 *
 * **The arm's own title was already right and the population was wrong** — *"is
 * named by nothing in the product's own SOURCE"*. An untracked one-shot cannot
 * ship, so it is not the product's source, which is the same scope
 * `scriptWorldGuard.test.ts` states in its header (*"OUT of scope: a file the
 * repository does not contain — an untracked one-shot"*) and implements with
 * `git ls-files`.
 *
 * ⚠ **THE FILENAME ROAD WAS AVAILABLE, IS IN USE BY TWO SIBLINGS, AND WAS
 * DECLINED ON THIS HOUSE'S OWN REASONING.** `ceremonyArguments` and
 * `selfInvocationCheck` both drop `*disposable*` by name; `sourceSweepSuites.ts`
 * says why that decays — *"an exception keyed on a FILENAME is the thing that
 * stops a guard watching"* — and `selfInvocationCheck`'s copy is the worked
 * example, since it also demands a leading `_` and therefore sweeps
 * `court-ink-plate-*` and `build-ink-court-panel-*` today — two live untracked
 * files whose names carry no leading underscore (#979, filed not fixed here).
 *
 * ⚠ **THOSE TWO SUFFIXES ARE CLIPPED ON PURPOSE AND THE REASON IS THIS FILE'S
 * OWN SUBJECT.** Written in full they were a CITATION: `disposable-age.mts`
 * matches on the basename, so naming a live disposable in a tracked file's
 * prose pins it as a permanent KEEP. The first version of this docblock did
 * exactly that — an explanation of the class, committing an instance of it —
 * and `disposableAge.test.ts`'s own arm (#975) is what caught it, on the next
 * tree that had a population to read. **Prose is not an exemption.**
 *
 * So the listing is derived rather than typed: ONE `git ls-files` through
 * `runHook`, which satisfies the `hookDriver` guard, and the clock moves to
 * `CHILD_PROCESS_TEST_TIMEOUT_MS` for the `childProcessTestTimeouts` one. That
 * is not a weakening of the clock: both constants are 30_000 ms, and
 * `declaresTheFloor` accepts EITHER, so this file stays correctly declared for
 * the contended family it is also in.
 */
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";
import { readListedSource } from "./testing/listedSource";

/* ⚠ TWO FAMILIES AT ONCE, AND ONE DECLARATION SERVES BOTH. This suite reads
   ~1,700 files off the real tree (#741's contended class) and, since #976, also
   spawns one `git ls-files` (#548's child-process class). `declaresTheTimeout`
   demands `CHILD_PROCESS_TEST_TIMEOUT_MS` by name while `declaresTheFloor`
   accepts either constant, so naming the child-process one satisfies both
   guards; the reverse would redden `childProcessTestTimeouts`. Both are
   30_000 ms, so nothing about the clock's LENGTH changed here. Three timeout
   families exist and they are not interchangeable — each is named by the guard
   that polices its shape. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

describe("the libvips ceiling inside a test run", () => {
  /*
    THE ARM WITH TEETH. It reads what libvips actually settled on, not what the
    setup file says — a string assertion against `process.env` would pass just
    as happily with the value arriving too late to matter, which is the single
    way this change can fail quietly.
  */
  it("is 1 by the time a test can use sharp — not merely requested", () => {
    expect(sharp.concurrency()).toBe(1);
  });

  it("is what the harness asked for, so a failure above says WHICH half broke", () => {
    expect(process.env.VIPS_CONCURRENCY).toBe("1");
  });
});

describe("and it stays inside the test harness", () => {
  const REPO = resolve(import.meta.dirname, "..");
  const ROOTS = ["server", "client", "shared", "scripts", ".github"];
  const EXTENSIONS = [".ts", ".mts", ".tsx", ".yml"];
  /* This file states both subjects in its own assertions and prose, and a guard
     that may not name what it guards is no guard. */
  const SELF = join("server", "sharpTestCeiling.test.ts");

  /*
    ⚠ AN IMPORT, NOT A MENTION. The first shape of the second arm searched for
    the bare string `vitest.setup` and found SEVENTEEN files — every one a
    docblock explaining that the setup file strips `DATABASE_URL`. That is
    #909's lesson landing inside the guard written to honour it: a loose match
    is not a measurement, and one wrong in the noisy direction reads as
    diligence.

    ⚠ AND THE SIDE-EFFECT SHAPE IS THE ONE THAT MATTERS MOST. The second draft
    wanted `from` or `require(`, and a sabotage adding `import "../vitest.setup";`
    to `shared/const.ts` walked straight through it — which is precisely how
    this file would be imported, since it exports nothing to name.
  */
  const IMPORTS_SETUP = /(?:from|require\(|import)\s*['"][^'"]*vitest\.setup/;
  const READS_THE_VAR = /VIPS_CONCURRENCY/;

  type Hit = { file: string; line: number; text: string };

  /*
    THE POPULATION, DERIVED FROM THE REPOSITORY RATHER THAN FROM THE DISK
    (#976). `git ls-files` lists what the repository CONTAINS; `readdirSync`
    lists what happens to be sitting there, which on a shift's tree is the same
    thing plus several hundred untracked one-shots.

    ⚠ IT REFUSES RATHER THAN RETURNING A SHORT LIST, and that is the whole
    safety of it: a filter that failed open — no git, a wrong cwd, a swallowed
    throw — would not make this guard noisy, it would make it BLIND, and every
    arm below asserts an EMPTY list, so a blind sweep passes all three. That is
    invariant 7's shape and it is the direction this file cannot afford to fail
    in. The floor arm below then proves the surviving population is real.
  */
  function trackedPaths(): Set<string> {
    const listing = runHook("git", ["ls-files", "-z", "--", ...ROOTS], { cwd: REPO });
    if (listing.status !== 0) {
      throw new Error(
        `git ls-files failed (status ${listing.status}) — the swept population cannot be `
          + `decided, and an undecided population would silently pass every arm here.\n${listing.stderr}`,
      );
    }
    const names = listing.stdout.split("\0").filter((name) => name.length > 0);
    if (names.length === 0) {
      throw new Error(
        "git ls-files returned nothing under " + ROOTS.join(", ")
          + " — refusing rather than sweeping an empty tree, which would pass every arm below.",
      );
    }
    return new Set(names);
  }

  const TRACKED = trackedPaths();

  /* `tracked` is a parameter, not a closed-over constant, for one reason: an
     arm below narrows it deliberately to prove the filter is CONSULTED. A
     filter nothing can be seen to change is invariant 7's shape. */
  function sweep(
    pattern: RegExp,
    tracked: Set<string> = TRACKED,
  ): { hits: Hit[]; filesRead: number; read: string[] } {
    const hits: Hit[] = [];
    const read: string[] = [];
    let filesRead = 0;

    const walk = (directory: string): void => {
      let entries;
      try {
        entries = readdirSync(directory, { withFileTypes: true });
      } catch {
        /* A directory that is not there is not a finding — `.github` is the
           only optional root, and a missing one is caught by the floor arm. */
        return;
      }
      for (const entry of entries) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
          walk(full);
          continue;
        }
        if (!EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;

        const path = relative(REPO, full).split("\\").join("/");

        /* ⚠ #976 — the disposable that is simply THERE. `listedSource` below
           handles the one that VANISHES mid-read; neither it nor this walk had
           anything to say about a shift's untracked scratch sitting in
           `scripts/` at the moment of the reading, and two such files made this
           suite red on an unchanged `main`. The repository's own listing is
           what says whether a file is the product's source. */
        if (!tracked.has(path)) continue;

        /* ⚠ The house's own reader, not `readFileSync`: this working tree is
           shared and carries hundreds of untracked disposables, so a file can
           vanish between the listing and the read (#223). `null` means gone.
           Still needed with the filter above — a TRACKED file can be deleted
           on disk by a rebase or a branch switch under a parallel run. */
        const source = readListedSource(full);
        if (source === null) continue;
        filesRead += 1;
        read.push(path);

        if (path === SELF.split("\\").join("/")) continue;

        source.split("\n").forEach((text, index) => {
          if (pattern.test(text)) hits.push({ file: path, line: index + 1, text: text.trim() });
        });
      }
    };

    for (const root of ROOTS) walk(join(REPO, root));
    return { hits, filesRead, read };
  }

  /*
    THE FLOOR ARM, AND IT IS WHAT MAKES THE TWO BELOW MEAN ANYTHING (working
    law 2). Both of them assert an EMPTY list, and an empty list is also what a
    sweep that read nothing returns — a wrong root, a bad extension list, a
    `import.meta.dirname` that is not where it is thought to be. So the sweep
    must first prove it read a real tree, and must find a string that is
    certainly in it.
  */
  it("the sweep reads a real tree and can find what is certainly there", () => {
    const { hits, filesRead } = sweep(READS_THE_VAR);

    expect(filesRead, "the sweep read almost no files — its roots or extensions are wrong").toBeGreaterThan(500);
    /* `vitest.setup.ts` is above these roots, so the positive control is the
       one place inside them that names the variable: this file, which the
       sweep deliberately skips. Point the same reader at a string every root
       certainly holds instead. */
    expect(sweep(/\bimport\b/).hits.length, "the sweep matched no imports in 500+ TypeScript files").toBeGreaterThan(500);
    expect(hits, `VIPS_CONCURRENCY is read outside the test harness:\n${format(hits)}`).toEqual([]);
  });

  /*
    THE FILTER'S OWN POSITIVE CONTROL (#976, working law 2). The three arms
    around it all assert an EMPTY list, so a filter that silently dropped
    everything, or one that was never consulted at all, reads as a pass in every
    one of them. This is the only arm here that can tell those apart, and it
    fires on a clean CI checkout exactly as it does on a shift's dirty tree —
    which the disjointness arm below cannot.
  */
  it("the tracked filter is CONSULTED — narrowing the listing narrows what is read", () => {
    const wide = sweep(READS_THE_VAR);
    const narrow = sweep(READS_THE_VAR, new Set([SELF.split("\\").join("/")]));

    expect(wide.filesRead, "the wide sweep should read the whole tracked tree").toBeGreaterThan(500);
    expect(
      narrow.filesRead,
      "narrowing the tracked listing to one file changed nothing — the filter is not wired in",
    ).toBe(1);
    expect(narrow.read).toEqual([SELF.split("\\").join("/")]);
  });

  /*
    ⚠ ITS LIMIT IS STATED RATHER THAN DISCOVERED: on a clean checkout git
    reports no untracked files and this arm is VACUOUS — which is precisely the
    state CI runs in, and precisely why #976 was invisible to the gate for as
    long as it existed. It has teeth only on a shift's own tree, where the
    population it guards against is several hundred files. The arm above is the
    one that holds everywhere; this one is the direct statement of the defect.
  */
  it("reads nothing git calls untracked — the defect #976 was, stated directly", () => {
    const listing = runHook("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", ...ROOTS], {
      cwd: REPO,
    });
    expect(listing.status, `git ls-files --others failed:\n${listing.stderr}`).toBe(0);

    const untracked = new Set(listing.stdout.split("\0").filter((name) => name.length > 0));
    const readAnyway = sweep(READS_THE_VAR).read.filter((path) => untracked.has(path));

    expect(
      readAnyway,
      `the sweep read files the repository does not contain:\n${readAnyway.join("\n")}`,
    ).toEqual([]);
  });

  it("is named by nothing in the product's own source", () => {
    const { hits } = sweep(READS_THE_VAR);

    expect(hits, `VIPS_CONCURRENCY is read outside the test harness:\n${format(hits)}`).toEqual([]);
  });

  it("reaches no module that a server or script can import", () => {
    const { hits } = sweep(IMPORTS_SETUP);

    expect(hits, `vitest.setup.ts is imported by product source:\n${format(hits)}`).toEqual([]);
  });
});

function format(hits: { file: string; line: number; text: string }[]): string {
  return hits.map((hit) => `  ${hit.file}:${hit.line}  ${hit.text}`).join("\n");
}
