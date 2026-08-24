/**
 * The guard on 3g's C/D census instrument (`scripts/subjectless-arm-census.mts`).
 *
 * ⚠ THIS FILE IS THE INSTRUMENT'S TWO FAILURES MADE PERMANENT. The sweep was
 * believed twice before it deserved to be, and both times a control caught it:
 *
 *   POSITIVE — it SKIPPED any file with no product import at all, so a wholly
 *   subjectless file, its strongest possible specimen, was invisible. It read
 *   zero arms and reported zero, which is indistinguishable from a clean run.
 *
 *   NEGATIVE — it was blind to `await import()`, so arms that drive real
 *   guards through a dynamic import read as subjectless. Half of
 *   `changeRequests.test.ts` reaches its subjects that way.
 *
 * Both are arms here now, driven against fixtures written on disk, so the
 * repairs cannot be undone quietly. Working law 2: verify the instrument
 * before believing its finding.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { sweep, testFilesUnder } from "../scripts/subjectless-arm-census.mts";

let dir: string;
const file = (name: string) => path.join(dir, name);

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "arm-census-"));
  mkdirSync(dir, { recursive: true });

  // (a) A WHOLLY SUBJECTLESS FILE — no imports at all. The positive control.
  writeFileSync(
    file("tautology.test.ts"),
    `describe("x", () => {
       it("asserts a literal it just typed", () => {
         const user = { frozenAt: new Date() };
         expect(!!user.frozenAt).toBe(true);
       });
     });`,
  );

  // (b) A file reaching the product through a STATIC import.
  writeFileSync(
    file("static.test.ts"),
    `import { buildTattooMap } from "./wardrobe/tattooAnalysis";
     describe("x", () => {
       it("drives the real thing", () => {
         expect(buildTattooMap({}).hasTattoos).toBe(false);
       });
     });`,
  );

  // (c) A file reaching the product through a DYNAMIC import. The negative control.
  writeFileSync(
    file("dynamic.test.ts"),
    `describe("x", () => {
       it("drives the real thing through a dynamic import", async () => {
         const { getDb } = await import("./db/connection");
         expect(getDb).toBeDefined();
       });
     });`,
  );

  // (d) A file whose arm reaches the product through a module-scope HELPER.
  writeFileSync(
    file("helper.test.ts"),
    `import { buildTattooMap } from "./wardrobe/tattooAnalysis";
     function mapOf(areas) { return buildTattooMap(areas); }
     describe("x", () => {
       it("drives the real thing through a helper", () => {
         expect(mapOf({}).hasTattoos).toBe(false);
       });
     });`,
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("the subjectless-arm census, controlled", () => {
  it("POSITIVE CONTROL — it reports an arm in a file with NO imports at all", () => {
    // The failure this replaces: the sweep skipped such files entirely and
    // read ZERO arms, which looks exactly like a clean run.
    const { read, rows } = sweep([file("tautology.test.ts")]);
    expect(read).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toContain("asserts a literal");
  });

  it("NEGATIVE CONTROL — it does NOT report an arm that reaches the product statically", () => {
    const { read, rows } = sweep([file("static.test.ts")]);
    expect(read).toBe(1);
    expect(rows).toHaveLength(0);
  });

  it("NEGATIVE CONTROL — it does NOT report an arm that reaches the product by DYNAMIC import", () => {
    // The second failure this replaces.
    const { read, rows } = sweep([file("dynamic.test.ts")]);
    expect(read).toBe(1);
    expect(rows).toHaveLength(0);
  });

  it("NEGATIVE CONTROL — it does NOT report an arm that reaches the product through a module-scope helper", () => {
    // The first failure this replaces: 2,614 of 9,045 reported, dominated by
    // exactly this shape.
    const { read, rows } = sweep([file("helper.test.ts")]);
    expect(read).toBe(1);
    expect(rows).toHaveLength(0);
  });

  it("reads the real tree, and a reading of ZERO would be the reader breaking rather than the suite being clean", () => {
    const files = testFilesUnder(["server"]);
    expect(files.length).toBeGreaterThan(100);
    const { read } = sweep(files.slice(0, 40));
    expect(read).toBeGreaterThan(0);
  });
});
