/**
 * THE CUT DISPOSITION IS ONE LIST, IN THREE PLACES THAT MUST AGREE.
 *
 * Migration 0047 made `InkCutRoute` a database column, so the vocabulary now
 * lives in `shared/inkCutRoute.ts` — the cutter that DECIDES a route, the
 * column that KEEPS one, and the condition that READS one all have to describe
 * the same two members. Two spellings of a closed vocabulary is working law 4's
 * copy, and it drifts the first time a third route is measured.
 *
 * The sibling arm for this shape already exists one table along
 * (`inkPlacementCoupling.test.ts`, ordered fable-1112 §3) and it exists because
 * a door and a column silently disagreeing is how a customer's word reaches a
 * statement that cannot hold it.
 *
 * # AND THE NULL IS ASSERTED AS HARD AS THE MEMBERS
 *
 * fable-1137 §4's containment condition is stated over the ABSENCE: a design
 * whose disposition is NULL never rides to a render. So a NOT NULL column, or a
 * DEFAULT, or a third member spelled `notLookedAt`, would each quietly convert
 * "no reading was taken" into a recorded claim about what was done to a
 * customer's picture. Each is asserted against here.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { castingInkDesigns } from "../../drizzle/schema";
import { INK_CUT_ROUTES, isInkCutRoute } from "../../shared/inkCutRoute";
import { readListedSource } from "../testing/listedSource";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

/**
 * The production modules that could write a design row — the two directories a
 * design's columns are decided in, tests excluded.
 *
 * A directory walk rather than a list of filenames, for the reason the arm that
 * uses it gives: the writer of this column moved once already, when the ink
 * studio's upload retired (#1158 slice 2), and a named file is the thing that
 * went stale.
 */
function designWriterSources(): Array<{ file: string; source: string }> {
  const out: Array<{ file: string; source: string }> = [];
  for (const dir of ["server/castingV2", "server/db"]) {
    for (const name of readdirSync(path.join(repoRoot, dir))) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      /* THROUGH THE HELPER, not a bare read (#223). An entry a walk listed can
         be gone by the time it is opened — a rebase, a clean tree, another
         shift's deletion — and the ENOENT lands on the deploy rite rather than
         on whoever is looking. `null` means it went; skip it. */
      const source = readListedSource(path.join(repoRoot, dir, name));
      if (source === null) continue;
      out.push({ file: `${dir}/${name}`, source: code(source) });
    }
  }
  return out;
}

/**
 * The source with its PROSE removed — block comments and line comments both.
 *
 * Without this the reading below indicts `inkDesignForAsk.ts`, whose only
 * `cutRoute: null` is inside a paragraph EXPLAINING that null is a recorded fact
 * rather than an unset one. A guard that cannot tell a sentence about the code
 * from the code is the shape this repository has paid for repeatedly, and it
 * fails toward accusing the most carefully documented file in the family.
 */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the cut disposition's vocabulary", () => {
  it("is the two members the cutter can decide, and no third", () => {
    expect([...INK_CUT_ROUTES]).toEqual(["cut", "rideWhole"]);
    /* The absence is NOT a member — see the header. */
    expect(isInkCutRoute("notLookedAt")).toBe(false);
    expect(isInkCutRoute(null)).toBe(false);
    expect(isInkCutRoute(undefined)).toBe(false);
  });

  it("is the SAME list the column holds, derived rather than retyped", () => {
    /*
      Read off the drizzle column rather than off a constant beside it: the
      failure being guarded against is somebody widening one and not the other,
      and a test comparing two copies of the same literal cannot see that.
    */
    const column = castingInkDesigns.cutRoute;
    expect([...(column.enumValues ?? [])]).toEqual([...INK_CUT_ROUTES]);
  });

  it("keeps the column NULLABLE, with no default — NULL means nobody looked", () => {
    const column = castingInkDesigns.cutRoute;
    expect(column.notNull, "a NOT NULL disposition cannot say 'nobody looked'").toBe(false);
    expect(column.hasDefault, "a default here is a guess about a customer's picture").toBe(false);
  });

  it("is spelled ONCE — the cutter re-exports it rather than declaring it", () => {
    /*
      The cutter used to declare `export type InkCutRoute = "cut" | "rideWhole"`.
      It cannot any more: `drizzle/schema.ts` needs the list and cannot import
      from `server/`, so a declaration here would be the second copy this file
      exists to prevent.
    */
    const cutter = read("server/castingV2/inkReferenceCutter.ts");
    expect(cutter).not.toMatch(/export type InkCutRoute\s*=\s*"/);
    expect(cutter).toContain('from "../../shared/inkCutRoute"');
  });

  it("⚠ is still written by SOMETHING, from the cutter's answer — derived, not named", () => {
    /*
      ASSERTED AT THE WIRE'S SOURCE (working law 5's spirit): the column exists
      to carry a fact, and a column nothing writes is the shape this program
      keeps rediscovering.

      ⚠ THIS ARM NAMED `inkUploadService.ts` AND `cut?.route ?? null` UNTIL
      2026-09-24, and that spelling was the STUDIO UPLOAD's. His ruling retired
      it (#1158 slice 2), so the hand-named writer went away — and a guard whose
      subject is deleted is exactly the shape that either reddens for the wrong
      reason or gets quietly removed. The claim it was really making is the one
      below, and it survives the retirement untouched: **the column has a writer,
      and that writer takes the value from the cutter rather than inventing it.**

      Anchored on `recordInkDesign` — the table's ONLY writer — rather than on a
      text pattern for the column. Two weaker readings were tried first and both
      are named because each fails in a way that looks like diligence: a regex
      for `cutRoute:` over the two directories indicts `inkDesignForAsk.ts`, whose
      only instance is inside a paragraph explaining what null MEANS, and tying
      the value to an object literal indicts `recipeAssembler.ts`, which passes a
      row's value onward and writes nothing. **Who writes the row is a fact about
      imports, and imports are what this asks.**

      Today the one writer is `inkReferenceMint.ts` — the take from an attached
      picture, HELD and moved to N3 (Crew reply #213) — and it writes
      `cutRoute: taken.cut.route`, never null, for the reason its own docblock
      gives. A second road minting designs inherits this arm by construction.
    */
    const writers = designWriterSources()
      .filter(({ source }) => /\brecordInkDesign\b/.test(source))
      .filter(({ file }) => file !== "server/db/castingV2InkDesigns.ts");
    /* The control: a reading that found nothing would make the assertion below
       vacuous, and "no writer" is precisely the finding this arm exists to
       raise — so it must be able to tell the two apart. */
    expect(writers.map(({ file }) => file), "nothing calls recordInkDesign — the column carries no fact")
      .not.toEqual([]);
    /* And the value comes from the cutter's own answer in every one of them. */
    for (const { file, source } of writers) {
      expect(source, `${file} calls the recorder without taking cutRoute from the cut`)
        .toMatch(/cutRoute:\s*[^,\n]*\bcut[.?]/);
    }
  });

  it("has a migration and a ceremony naming the same column", () => {
    /* A ceremony that applied a different file, or named a different column,
       would report success over a database the condition cannot read. */
    const migration = read("drizzle/0047_ink_design_cut_route.sql");
    expect(migration).toContain("ALTER TABLE `casting_ink_designs` ADD COLUMN `cutRoute`");
    expect(migration).toContain("enum('cut','rideWhole') NULL");
    /* NULL and no DEFAULT, in the DDL itself. */
    expect(migration).not.toMatch(/cutRoute`?\s+enum[^;]*DEFAULT/i);

    const ceremony = read("scripts/ceremony-ink-cut-route.mts");
    expect(ceremony).toContain("drizzle/0047_ink_design_cut_route.sql");
    expect(ceremony).toContain('const COLUMN = "cutRoute"');
  });
});
