import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { declaresTheFloor, sourceSweepSuites, sweepsTheTree } from "./testing/sourceSweepSuites";

/* ⚠ THIS SUITE IS IN ITS OWN SUBJECT'S FAMILY, AND IN #548'S POPULATION TOO —
   it runs `git ls-files` and then reads all 801 tracked test files, so it does
   exactly the kind of work it polices. It declares the child-process floor
   because the hop through `sourceSweepSuites.ts` puts it in that population,
   and either constant lifts a file off the 5 s default, which is the whole
   property. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * EVERY SUITE THAT SWEEPS THE SOURCE TREE DECLARES THE CLASS'S TIMEOUT (#741),
 * and the population it checks is DERIVED from the tree rather than listed.
 *
 * This is `childProcessTestTimeouts.test.ts`'s sibling and it exists because
 * that guard's population — suites that spawn a real process — structurally
 * cannot contain a suite that does its heavy work inside the vitest worker.
 * Five consecutive runs of an unchanged `server/castingV2` produced seven
 * failures and every one that was read at the error was `Test timed out in
 * 5000ms`. The numbers are in `testing/contendedTestTimeout.ts`.
 *
 * ⚠ **A GUARD KEYED ON THE FILES YOU HAVE ALREADY FIXED STOPS WATCHING THE
 * MOMENT YOU FIX ONE**, so there is no list of sixteen filenames here: a suite
 * written next month that reaches for the tree reader is in the population the
 * day it is written, and reddens here rather than reddening some other shift's
 * preflight at random three weeks later.
 */
const ROOT = resolve(import.meta.dirname, "..");

describe("suites that sweep the source tree declare the class's timeout (#741)", () => {
  const population = sourceSweepSuites(ROOT);

  it("sweeps a real population — a clean answer over no files is not an answer", () => {
    /* The deriver throws on an empty `git ls-files`; this is the other half,
       and it is the arm that catches a resolver quietly matching nothing.
       Working law 2: verify the instrument before believing its finding. */
    expect(population.length).toBeGreaterThan(10);
  });

  it("every one of them declares it", () => {
    const missing = population.filter((row) => !row.declares).map((row) => row.file);
    expect(
      missing,
      "These suites read many files off the real tree inside vitest's 5s default " +
        "and will go red under load on somebody's machine, not in CI. Add, after " +
        "the imports:\n" +
        '  import { CONTENDED_TEST_TIMEOUT_MS } from "…/testing/contendedTestTimeout";\n' +
        "  vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });",
    ).toEqual([]);
  });

  it("the population is a FLOOR, and the one file it cannot see is declared anyway", () => {
    /*
      ⚠ THE LIMIT, PINNED SO IT CANNOT BECOME A SURPRISE. A grep for the reader
      returns fifteen tracked test files; this deriver returns fourteen. The
      missing one is `deployTriggerClaims.test.ts`, which imports the reader
      plainly and calls it — and is lost because it carries a REGEX LITERAL
      CONTAINING A BACKTICK, which flips `codeOnly` into template mode, and a
      template is not ended by a newline. Eleven lines vanish, the call with
      them. The cause is documented in `childProcessSuites`, whose own header
      records this remainder as having no live instance — true of ITS question,
      not of this one.

      The arm asserts the consequence rather than the mechanism: the file is
      OUT of the derived population and IS declared regardless. If somebody
      teaches the stripper about regex literals, the first half flips and this
      arm says so, which is the moment to delete it.
    */
    expect(population.map((row) => row.file)).not.toContain("server/deployTriggerClaims.test.ts");
    expect(
      declaresTheFloor(readFileSync(join(ROOT, "server/deployTriggerClaims.test.ts"), "utf8")),
      "a suite the deriver cannot see must still carry the floor on measurement",
    ).toBe(true);
  });

  it("the file the card named is IN the population", () => {
    /* A live control rather than a fixture. #741's specimen is the arm that
       measured 330 ms alone and 5,855 ms in the directory run, and a deriver
       that could not see it would be answering the wrong question entirely. */
    const specimen = population.find(
      (row) => row.file === "server/castingV2/uploadRefusalCopy.test.ts",
    );
    expect(specimen, "the card's own specimen left the population").toBeDefined();
    expect(specimen?.declares).toBe(true);
  });
});

describe("the reading can be wrong in both directions, and is checked in both (#741)", () => {
  const SWEEPING_HEADER = [
    'import { describe, it, vi } from "vitest";',
    'import { readListedSource } from "./testing/listedSource";',
    'it("x", () => { readListedSource("a.ts"); });',
  ].join("\n");

  it("an IMPORT of the constant is not a declaration — the call is what counts", () => {
    /* ⚠ THE HOLE #548'S OWN FIRST DRAFT SHIPPED, and the reason this arm is
       here rather than assumed. It asked whether the source MENTIONED the
       constant, which the import line does, so a file that imported it and set
       nothing read as compliant. `import is not a call site`. */
    const importOnly =
      'import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";';
    expect(declaresTheFloor(importOnly)).toBe(false);
    expect(
      declaresTheFloor(`${importOnly}\nvi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });`),
    ).toBe(true);
  });

  it("a PER-ARM number is not a declaration — that is the road measured to leak", () => {
    /*
      Not pedantry, and the tree holds the proof twice over:
      `castingV2/faceScanService.test.ts` carries `}, 30_000)` on the one arm
      that went red and nothing on its neighbours, and
      `changeRequestLabels.test.ts` carried `{ timeout: 60_000 }` on one arm of
      many. A hand-typed number is not inherited by the arm somebody writes
      beside it tomorrow; a file-level declaration is.
    */
    /*
      ⚠ THESE FIXTURES USE THE CONSTANT ON PURPOSE, AND THE FIRST DRAFT DID NOT
      — the sabotage run is what said so. With raw numbers in them this arm was
      only re-proving the raw-number arm below, and the sabotage that removed
      the `vi.setConfig` requirement from the predicate came back GREEN. A
      sabotage that changes nothing the arm can see is a green that reads like
      coverage. The case that actually matters is the well-meaning author who
      reaches for the right constant in the wrong place.
    */
    expect(
      declaresTheFloor('it("x", { timeout: CONTENDED_TEST_TIMEOUT_MS }, () => {});'),
    ).toBe(false);
    expect(
      declaresTheFloor('describe("d", { timeout: CONTENDED_TEST_TIMEOUT_MS }, () => {});'),
    ).toBe(false);
    expect(declaresTheFloor('it("x", async () => {}, CONTENDED_TEST_TIMEOUT_MS);')).toBe(false);
  });

  it("either class constant satisfies it — a file already off the default is off it", () => {
    /* Four of this population also spawn a process and already carry #548's
       floor. Making them swap one 30,000 for another would be churn dressed as
       compliance, and the property asserted is "not on the 5 s default". */
    expect(
      declaresTheFloor("vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });"),
    ).toBe(true);
  });

  it("a RAW NUMBER is not a declaration — the figure has one author", () => {
    /* Working law 4 at the smallest scale. A file that sets 30000 by hand is
       off the default and is still a second copy of a number sized from a
       measurement it does not cite; the constant is the only road. */
    expect(declaresTheFloor("vi.setConfig({ testTimeout: 30_000 });")).toBe(false);
  });

  it("a docblock that NAMES the tree reader is not a sweep", () => {
    /* The stripping half, driven directly rather than trusted. Several modules
       in this tree — including `sourceSweepSuites.ts` itself — discuss
       `readListedSource` in prose while never calling it. */
    const prose = [
      "/** A walk lists, then reads: it goes through readListedSource(…). */",
      'import { describe, it } from "vitest";',
      'it("x", () => {});',
    ].join("\n");
    expect(sweepsTheTree(prose, "server/x.test.ts", ROOT)).toBe(false);
    expect(sweepsTheTree(SWEEPING_HEADER, "server/x.test.ts", ROOT)).toBe(true);
  });

  it("an import of the reader with no CALL is not a sweep either", () => {
    const importOnly = [
      'import { readListedSource } from "./testing/listedSource";',
      'it("x", () => {});',
    ].join("\n");
    expect(sweepsTheTree(importOnly, "server/x.test.ts", ROOT)).toBe(false);
  });

  it("sees a DEPTH-2 spelling — the hole the first draft shipped", () => {
    /*
      ⚠ THE REVIEWER'S FINDING, PINNED SO IT CANNOT COME BACK. The first shape
      of the deriver matched a hand-listed array of three spellings; it covered
      every importer alive that day and could never have seen
      `../../testing/listedSource`, which is what a suite two levels deep under
      `server/` must write — and the tree already holds around fifty such files.
      A guard blind in the direction that reports a clean tree is worse than no
      guard, so this arm drives the real depth rather than the one that happened
      to exist.
    */
    const deep = [
      'import { readListedSource } from "../../testing/listedSource";',
      'it("x", () => { readListedSource("a.ts"); });',
    ].join("\n");
    expect(sweepsTheTree(deep, "server/casting/evidence/x.test.ts", ROOT)).toBe(true);

    /* And the same file at depth 1, where that spelling resolves to nothing —
       the resolver is answering about the FILE SYSTEM, not about the string. */
    expect(sweepsTheTree(deep, "server/x.test.ts", ROOT)).toBe(false);
  });
});

describe("the constant itself", () => {
  it("is the figure three independent sizings landed on", () => {
    /* Not a taste check — it pins the relationship the docblock argues, so a
       later edit that lowers one of the two below the measured worst contended
       cost (5,855 ms) has to change this line and read the reasoning. */
    expect(CONTENDED_TEST_TIMEOUT_MS).toBe(30_000);
    /* The relationship the docblock argues, pinned so that lowering it below
       the measured worst contended cost has to change this line and read the
       reasoning. The two constants are NOT asserted equal: they are sized from
       different measurements of different populations and are each free to
       move, which is the whole reason there are two of them. */
    expect(CONTENDED_TEST_TIMEOUT_MS).toBeGreaterThan(5_855 * 4);
  });
});
