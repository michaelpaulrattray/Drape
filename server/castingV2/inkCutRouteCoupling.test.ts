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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { castingInkDesigns } from "../../drizzle/schema";
import { INK_CUT_ROUTES, isInkCutRoute } from "../../shared/inkCutRoute";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

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

  it("is written by the upload's own step, from the cutter's answer", () => {
    /*
      ASSERTED AT THE WIRE'S SOURCE (working law 5's spirit): the column exists
      to carry a fact, and a column nothing writes is the shape this program
      keeps rediscovering. `cut?.route ?? null` is the whole contract — the
      cutter's answer when it ran, and the honest null when it did not.
    */
    const service = read("server/castingV2/inkUploadService.ts");
    expect(service).toContain("cutRoute: cut?.route ?? null,");
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
