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
 */
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";

/* ⚠ #741'S FAMILY, NOT `suiteClocks`'s — AND THE GUARD IS WHAT SAID SO. This
   suite reads ~1,700 files off the real tree, so it belongs to the contended
   class; `allowTreeSweeps()` was the first declaration here and it sets a clock
   by a route `declaresTheFloor` does not recognise, so `contendedTestTimeouts`
   reddened with the file listed. Three timeout families exist and they are not
   interchangeable — this one is named by the guard that polices this shape. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

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

  function sweep(pattern: RegExp): { hits: Hit[]; filesRead: number } {
    const hits: Hit[] = [];
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

        /* ⚠ The house's own reader, not `readFileSync`: this working tree is
           shared and carries hundreds of untracked disposables, so a file can
           vanish between the listing and the read (#223). `null` means gone. */
        const source = readListedSource(full);
        if (source === null) continue;
        filesRead += 1;

        const path = relative(REPO, full).split("\\").join("/");
        if (path === SELF.split("\\").join("/")) continue;

        source.split("\n").forEach((text, index) => {
          if (pattern.test(text)) hits.push({ file: path, line: index + 1, text: text.trim() });
        });
      }
    };

    for (const root of ROOTS) walk(join(REPO, root));
    return { hits, filesRead };
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
