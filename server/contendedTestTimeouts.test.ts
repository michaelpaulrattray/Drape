import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";
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

  it("the file it could NOT see is in the population now (#1638)", () => {
    /*
      ✅ THE ARM THIS REPLACES ASKED FOR ITS OWN DELETION BY NAME, and it is
      quoted rather than paraphrased: *"If somebody teaches the stripper about
      regex literals, the first half flips and this arm says so, which is the
      moment to delete it."* It asserted that `deployTriggerClaims.test.ts` was
      OUT of the derived population — lost because it carries a REGEX LITERAL
      CONTAINING A BACKTICK, which flipped the stripper into template mode, and
      a template is not ended by a newline, so eleven lines vanished with the
      call in them.

      #1638 taught the stripper. So the assertion is INVERTED rather than
      dropped: the file must be IN, and it must still declare the floor. A
      guard may not go on asserting a defect that has been fixed — and
      deleting it outright would leave the tree with no arm at all on the one
      file whose reading this whole limit was measured at.
    */
    expect(population.map((row) => row.file)).toContain("server/deployTriggerClaims.test.ts");
    expect(
      declaresTheFloor(readFileSync(join(ROOT, "server/deployTriggerClaims.test.ts"), "utf8")),
      "the file the reader could not see must still carry the floor",
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

describe("the hop, and the population it was widened for (#2289)", () => {
  /*
    ⚠ **A WALK PROMOTED OUT OF TWENTY TEST FILES WOULD HAVE TAKEN ALL TWENTY
    OUT OF THIS POPULATION — the guard going green because it is watching
    nobody, which is `directory-population-loses-promoted-subject` arriving by
    the front door.** `sweepsTheTree` reads a suite's OWN import and call of
    `readListedSource`; move the walk behind `testing/sourceTree.ts` and the
    call is in that module instead. So the deriver resolves ONE HOP now, which
    is the shape `childProcessSuites` has always had and whose resolver it
    already shared.

    Measured before it was built, which is why it could be landed without
    indicting anybody: the hop adds **3** suites that have reached the reader
    through `testing/creditDisplaySites.ts`,
    `testing/errorMessageInterpolations.ts` and
    `testing/shellLessPathLaunches.ts` all along, and **0** of them were
    undeclared.

    Its bound is the sibling's, word for word: **exactly one hop, through a
    relative specifier.** The second arm below drives that bound rather than
    stating it, because a reader that silently resolved further would make the
    "every one of them declares it" arm above indict files nobody asked.
  */
  const population = sourceSweepSuites(ROOT);

  it("every suite that reaches the promoted walk is IN the population", () => {
    /*
      ⚠ **THE ARM THE CARD'S OWN COMMENT ASKED FOR, AND IT IS THE ONE THAT
      CANNOT BE SATISFIED BY A HALF-DONE PROMOTION.** The subject is not "does
      the hop work on a fixture" — it is whether the deriver's population still
      CONTAINS the suites that read the tree. The importers are derived from
      the tree (every tracked test file whose source names the module), so a
      suite converted next month joins this arm by being written.
    */
    const tracked = execFileSync("git", ["ls-files", "*.test.ts", "*.test.tsx"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const importers = tracked.filter((file) => {
      const source = readListedSource(join(ROOT, file));
      if (source === null) return false;
      /* The import, not a mention: a docblock naming the module is not a walk,
         and this file's own prose names it twice. */
      return /from\s+["'][^"']*\/sourceTree["']/.test(source);
    });

    /* The instrument before its finding: the conversion really happened. */
    expect(importers.length, "nothing imports the promoted walk — either the conversion was "
      + "reverted or this reader's specifier pattern has stopped matching").toBeGreaterThan(15);

    const members = new Set(population.map((row) => row.file));
    const missing = importers.filter((file) => !members.has(file));
    expect(
      missing,
      "These suites reach the shared tree walk and the deriver cannot see them, so none of them "
        + "is held to the class floor. That is the promotion silently emptying the population.",
    ).toEqual([]);
  });

  it("the hop is reported as a hop, and the promoted walk is really one of them", () => {
    const hops = population.filter((row) => row.via !== "directly");
    expect(hops.length, "no member is reached through a hop — the widening is inert")
      .toBeGreaterThan(3);
    const modules = new Set(hops.map((row) => (row.via as { module: string }).module));
    expect(modules).toContain("server/testing/sourceTree.ts");
    /* And the three that predate #2289, which is the measurement that said the
       widening indicts nobody. */
    expect(modules).toContain("server/testing/creditDisplaySites.ts");
    expect(modules).toContain("server/testing/errorMessageInterpolations.ts");
    expect(modules).toContain("server/testing/shellLessPathLaunches.ts");
  });

  it("ONE hop, and the second is the stated bound rather than a hope", () => {
    /* Driven on the real tree's own shapes: a suite importing the reader
       itself is direct; a suite importing a module that imports it is a hop;
       anything further is invisible, and that is written down rather than
       discovered. `sweepsTheTree` is the per-file half, so the hop is read off
       the population's own `via`. */
    const direct = population.filter((row) => row.via === "directly");
    expect(direct.length, "no member reads the tree itself — the direct half has gone")
      .toBeGreaterThan(50);
    for (const row of population) {
      if (row.via === "directly") continue;
      const module = (row.via as { module: string }).module;
      const source = readListedSource(join(ROOT, module));
      expect(source, `${module} could not be read`).not.toBeNull();
      expect(
        sweepsTheTree(source!, module, ROOT),
        `${module} is recorded as the hop for ${row.file} and does not itself read the tree`,
      ).toBe(true);
    }
  });

  it("the two `suiteClocks` helpers are declarations too — the hole a conversion found", () => {
    /*
      ⚠ **LATENT, AND A CONVERSION WALKED STRAIGHT INTO IT.**
      `allowTreeSweeps()` sets 60 s and `allowColdImports()` 30 s, both at file
      level, both through `vi.setConfig`, and `allowTreeSweeps`'s own docblock
      says it is *"for a file whose tests read the source tree off disk"* —
      exactly this population. `declaresTheFloor` did not read them, so
      `r7-snapshot-selection-contract.test.ts` would have been indicted for not
      declaring a floor it already sets. The property this function asserts is
      "off the 5 s default", and these are a third sanctioned spelling of it.
    */
    expect(declaresTheFloor("allowTreeSweeps();")).toBe(true);
    expect(declaresTheFloor("allowColdImports();")).toBe(true);
    /* And an IMPORT is still not a call site, in this spelling as in the other. */
    expect(
      declaresTheFloor('import { allowTreeSweeps } from "./testing/suiteClocks";'),
    ).toBe(false);
    /* A lookalike that sets nothing does not count. */
    expect(declaresTheFloor("allowTreeSweepsSoon();")).toBe(false);
  });
});

describe("a suite the derived signal cannot see, pinned by name (#2518)", () => {
  /*
    ⚠ **THE POPULATION ABOVE IS SUITES THAT WALK THE TREE, AND A SUITE CAN BE
    SLOW ENOUGH TO REDDEN A DEPLOY WITHOUT WALKING IT.**
    `architectureExpressSurfaces.test.ts` imports the architecture generator and
    reads CLAUDE.md three times; inside the deploy rite its invariant-5 arm hit
    `Test timed out in 5000ms` on a correct push and passed 18 of 18 alone.

    The card chose to declare the floor on this one file rather than widen the
    signal on one instance (the `readdirSync` widening was measured to indict 54
    innocent files to catch 9). So this is a pin, and it says so: a list of one,
    held here because the deriver cannot hold it.
  */
  const FILE = "server/architectureExpressSurfaces.test.ts";

  it("declares the class's timeout", () => {
    expect(
      declaresTheFloor(readFileSync(join(ROOT, FILE), "utf8")),
      `${FILE} is back on vitest's 5 s default and will time out inside the deploy rite (#2518)`,
    ).toBe(true);
  });

  it("CONTROL — the same file without its declaration reads as undeclared", () => {
    /* The reader must be able to say no about THIS file's real source, not
       only about the synthetic one-liners above. */
    const stripped = readFileSync(join(ROOT, FILE), "utf8").replace(
      /vi\s*\.\s*setConfig\s*\(\s*\{[^}]*\}\s*\)\s*;?/g,
      "",
    );
    expect(declaresTheFloor(stripped)).toBe(false);
  });

  it("is still outside the derived population — when it joins, delete this block", () => {
    /* If the signal is ever widened to see it, the arm above is redundant with
       "every one of them declares it", and this says so rather than letting a
       hand-kept pin outlive its reason. */
    expect(sourceSweepSuites(ROOT).map((row) => row.file)).not.toContain(FILE);
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
