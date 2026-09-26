import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE SERVER TEST TREE IS TYPECHECKED, AND ITS REMAINDER ONLY SHRINKS (#1182).
 *
 * # What was wrong
 *
 * `tsconfig.json` excludes `**​/*.test.ts` everywhere, and the only project that
 * overrode that exclude included `server/castingV2/**` alone. So **475 server
 * test files outside `server/castingV2` were checked by nothing at all**, and a
 * deleted or renamed symbol in any of them reddened no instrument.
 *
 * ⚠ **And vitest could not stand in for the typechecker, which is the half that
 * makes this worth a project rather than a note.** The 23 `*-db.test.ts` suites
 * are `describe.skip` without `TEST_DATABASE_URL`, CI has none, and a skipped
 * suite is never imported — so a broken import raises nothing. #1160 slice 3
 * deleted six exports from `server/db/castingV2Segments.ts`; `pnpm check` went
 * green and `server/castingV2-segment-store-db.test.ts`, which calls all six
 * through a namespace import, typechecked clean because nothing typechecked it.
 * That is the *"a test surface that reports green by not running"* class one
 * level up, at the compiler instead of the database.
 *
 * # Why there is a named remainder rather than a clean sweep
 *
 * Measured at `79f37168` before anything was written: **414 pre-existing type
 * errors across 88 of the 475 files.** A shift that turns a green baseline red
 * and cannot finish is the failure #335 documents, so the 88 are excluded BY
 * NAME in `tsconfig.server-tests.json` and the other **387 are covered from that
 * commit**. The card's fallback was to arm this directory by directory; read at
 * the measurement that covers LESS for the same work, because 52 of the 88 sit
 * directly in `server/` and a directory-wise arm would have to exclude
 * `server/**`.
 *
 * # What this file is for
 *
 * A named-remainder list is a second list shadowing the tree, and those drift
 * (working law 4). Every assertion below exists to stop one way this can rot:
 *
 *   - an entry naming a file that no longer exists (the list outliving its
 *     subject — the shape that let a dead control keep a live reputation);
 *   - the list GROWING, which would turn a debt into a parking space;
 *   - the project's `include` being narrowed, or a blanket test glob being put
 *     back into its `exclude`, either of which would make the whole thing green
 *     by covering nothing;
 *   - nothing RUNNING the project (invariant 7).
 *
 * The 88 are a debt, not an exemption. The honest way to read this file is: the
 * ceiling below is the number of test files this repository still cannot
 * typecheck, and it is allowed to move in one direction.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The remainder as it stood when the project was created. Lower this line when
 * you fix files; never raise it. A new test file is covered the moment it
 * exists, so nothing legitimate ever needs it to go up.
 */
const KNOWN_REMAINDER_CEILING = 88;

/** The population the project is supposed to cover, walked rather than counted. */
async function serverTestFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await serverTestFiles(full, out);
    else if (entry.name.endsWith(".test.ts")) out.push(path.relative(repoRoot, full).replaceAll("\\", "/"));
  }
  return out;
}

async function project(): Promise<{ include: string[]; exclude: string[] }> {
  /* JSON with comments: the `//`-prefixed keys are the file's own docblock, and
     they are legal JSON keys, so no stripping is needed. */
  const raw = await readFile(path.join(repoRoot, "tsconfig.server-tests.json"), "utf8");
  const parsed = JSON.parse(raw) as { include?: string[]; exclude?: string[] };
  return { include: parsed.include ?? [], exclude: parsed.exclude ?? [] };
}

describe("the server test tree is inside a typecheck project", () => {
  it("something actually runs it — a project nothing invokes does not exist", async () => {
    const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const runner = Object.entries(pkg.scripts)
      .find(([, command]) => command.includes("tsconfig.server-tests.json"));
    expect(runner, "no script runs tsconfig.server-tests.json").toBeDefined();

    /* And it is reached by `pnpm check`, which is what a shift and the gate both
       run. `check` fans out over every script whose name starts `check:`, so the
       NAME is the wiring — a script called something else would be green here
       and unreached in practice. */
    expect(runner![0]).toMatch(/^check:/);
    expect(pkg.scripts.check).toContain("/^check:/");
  });

  it("covers the server test tree, and the remainder is the only gap", async () => {
    const { include, exclude } = await project();
    const tests = await serverTestFiles(path.join(repoRoot, "server"));

    /* Positive control: the walker found the tree. Every assertion below is
       about a SET DIFFERENCE, and an empty population satisfies all of them. */
    expect(tests.length, "the walker found no server test files at all")
      .toBeGreaterThanOrEqual(600);

    expect(include).toContain("server/**/*.ts");
    /* A blanket test glob back in the exclude would cover nothing and go green.
       Named files are how the remainder is written; a pattern is not. */
    for (const pattern of exclude) {
      expect(pattern, `${pattern} is a blanket exclusion, not a named remainder`)
        .not.toMatch(/\*.*\.test\.ts$/);
    }

    const excludedTests = exclude.filter((entry) => entry.endsWith(".test.ts"));
    const covered = tests.filter((file) => !excludedTests.includes(file));
    expect(covered.length, "the project covers almost none of the tree")
      .toBeGreaterThanOrEqual(500);
  });

  it("the named remainder only shrinks, and every entry still exists", async () => {
    const { exclude } = await project();
    const excludedTests = exclude.filter((entry) => entry.endsWith(".test.ts"));
    const tests = new Set(await serverTestFiles(path.join(repoRoot, "server")));

    expect(excludedTests.length, "the remainder GREW — a debt is not a parking space")
      .toBeLessThanOrEqual(KNOWN_REMAINDER_CEILING);

    /* The other direction, so the list cannot outlive its subject: a file that
       was deleted or renamed leaves an entry excusing nothing, and the next
       reader of that list believes 88 files are broken when fewer are. */
    const stale = excludedTests.filter((file) => !tests.has(file));
    expect(stale, "an excluded file no longer exists — delete its line").toEqual([]);

    /* And the ceiling is not allowed to sit above the list either: a fix that
       removes entries without lowering this constant leaves room for the debt
       to grow back in silence. */
    expect(
      KNOWN_REMAINDER_CEILING - excludedTests.length,
      "the ceiling is above the list — lower KNOWN_REMAINDER_CEILING to match",
    ).toBeLessThanOrEqual(0);
  });

  it("the three sibling projects still exclude what this one covers", async () => {
    /*
      The premise this project rests on, pinned so the day it stops being true is
      the day this file turns red rather than the day it becomes redundant. If
      `tsconfig.json` ever stops excluding test files, the whole named remainder
      is being checked by `check:root` anyway and 414 errors arrive there.
    */
    const root = JSON.parse(await readFile(path.join(repoRoot, "tsconfig.json"), "utf8")) as {
      exclude: string[];
    };
    expect(root.exclude).toContain("**/*.test.ts");

    const casting = JSON.parse(
      await readFile(path.join(repoRoot, "tsconfig.casting-tests.json"), "utf8"),
    ) as { include: string[] };
    expect(casting.include).toContain("server/castingV2/**/*.ts");
  });
});
