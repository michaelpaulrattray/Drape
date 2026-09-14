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
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

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
  const ROOTS = ["server", "client", "shared", "scripts", ".github"];
  const INCLUDES = ["--include=*.ts", "--include=*.mts", "--include=*.tsx", "--include=*.yml"];

  /*
    THE LEAK ARM. `vitest.setup.ts` is reachable only through
    `vitest.config.ts`'s `setupFiles`; if a server module ever imports it, or
    any product code starts reading VIPS_CONCURRENCY, the ceiling stops being a
    test-harness choice and becomes a production one nobody decided.

    This file's own name is excluded: it states the variable in its assertions,
    and a guard that may not mention its subject is no guard.
  */
  it("is named by nothing in the product's own source", () => {
    const hits = grep(["-rn", "VIPS_CONCURRENCY", ...INCLUDES, ...ROOTS]).filter(
      (line) => !line.startsWith("server/sharpTestCeiling.test.ts"),
    );

    expect(hits, `VIPS_CONCURRENCY is read outside the test harness:\n${hits.join("\n")}`).toEqual([]);
  });

  /*
    ⚠ AN IMPORT, NOT A MENTION. The first shape of this arm grepped for the
    bare string `vitest.setup` and went red on SEVENTEEN files — every one of
    them a docblock explaining that the setup file strips `DATABASE_URL`. That
    is #909's lesson inside the guard written to honour it: a loose grep is not
    the measurement, and one that is wrong in the noisy direction reads as
    diligence. Only a real import specifier counts.
  */
  /* ⚠ AND THE SIDE-EFFECT SHAPE IS THE ONE THAT MATTERS MOST HERE. The second
     draft of this pattern wanted `from` or `require(`, and a sabotage adding
     `import "../vitest.setup";` to `shared/const.ts` walked straight through
     it — which is precisely how this file would be imported for its effects,
     since it exports nothing to name. A bare `import "…"` counts. */
  const IMPORT_OF_SETUP = String.raw`(from|require\(|import)\s*['"][^'"]*vitest\.setup`;

  it("reaches no module that a server or script can import", () => {
    /* This file's own name is excluded for the same reason arm 1 excludes it:
       the comment above QUOTES the sabotage that proved the pattern, and a
       guard that may not describe its own subject is no guard. Driven both
       ways — the exclusion is one path, not a wildcard. */
    const hits = grep(["-rnE", IMPORT_OF_SETUP, ...INCLUDES, ...ROOTS]).filter(
      (line) => !line.startsWith("server/sharpTestCeiling.test.ts"),
    );

    expect(hits, `vitest.setup.ts is imported by product source:\n${hits.join("\n")}`).toEqual([]);
  });

  /*
    THE POSITIVE CONTROLS FOR THE TWO ARMS ABOVE (working law 2). Both assert an
    EMPTY list, and an empty list is also what a broken reader returns — a wrong
    root, an unsupported flag, a `cwd` that is not the repository. So each
    reader is pointed at something certainly present and must find it.

    The second control matters more than it looks: it exercises the IMPORT
    pattern itself, which is the half that was wrong the first time.
  */
  it("the plain reader can find a string that is certainly there", () => {
    expect(
      grep(["-rln", "VIPS_CONCURRENCY", "vitest.setup.ts"]),
      "the leak arm's reader found nothing in a file that certainly names it",
    ).toEqual(["vitest.setup.ts"]);
  });

  it("the import-shaped reader can find an import that is certainly there", () => {
    const hits = grep(["-rnE", String.raw`(from|require\()\s*['"][^'"]*sharp['"]`, "server/sharpTestCeiling.test.ts"]);

    expect(hits.length, "the import pattern matched nothing in a file that certainly imports sharp").toBeGreaterThan(0);
  });
});

/**
 * `grep` with an argument array — no shell, so nothing here is interpolated
 * into a command line. An empty result is grep's normal exit 1, not a failure.
 */
function grep(args: string[]): string[] {
  try {
    return execFileSync("grep", args, { cwd: resolve("."), encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (error) {
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }
}
