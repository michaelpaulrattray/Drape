/**
 * THE PRE-DEPLOY ROAD DECISION (#508 D3) — what blocks a deploy and what does
 * not, driven through the REAL applier rather than hand-built reports, because
 * a fake report proves only that the verdict reads a shape the applier might
 * never produce (fake-reader law).
 *
 * The asymmetry under test: Railway aborts a deploy whose pre-deploy command
 * exits non-zero, and the old build keeps serving. So a failed WRITE must exit
 * 1 (new code never boots ahead of a table the applier could not deliver) and
 * a WAITING ceremony — a destructive statement that is the founder's to run
 * (#322), or a declaration no migration creates — must exit 0, loudly, or his
 * pending decision becomes an outage of the deploy road itself.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  autoApplyMigrations,
  readSchemaGap,
  type MissingObjects,
} from "../scripts/lib/ceremonyAutoApply.mts";
import { predeployVerdict } from "../scripts/lib/predeployVerdict.mts";

const none: MissingObjects = { tables: [], columns: [], indexes: [] };
const wantT: MissingObjects = { tables: ["t"], columns: [], indexes: [] };

const drive = (options: {
  missing: MissingObjects;
  after?: MissingObjects;
  sql: string;
  execute?: (sql: string) => Promise<void>;
}) =>
  autoApplyMigrations({
    missing: options.missing,
    readBack: async () => options.after ?? none,
    execute: options.execute ?? (async () => {}),
    listMigrations: () => [{ name: "0001_fixture.sql", sql: options.sql }],
    dry: false,
  });

describe("predeployVerdict through the real applier", () => {
  it("nothing pending → exit 0", async () => {
    const report = await drive({ missing: none, sql: "CREATE TABLE `t` (`id` int);" });
    const verdict = predeployVerdict(report);
    expect(verdict.exitCode).toBe(0);
    expect(report.blocking).toEqual([]);
  });

  it("an additive statement applied and read back present → exit 0", async () => {
    const report = await drive({ missing: wantT, sql: "CREATE TABLE `t` (`id` int);" });
    expect(report.applied).toBe(1);
    expect(report.blocking).toEqual([]);
    expect(predeployVerdict(report).exitCode).toBe(0);
  });

  it("⚠ a statement that ERRORS blocks the deploy — exit 1, said as BLOCKING", async () => {
    const report = await drive({
      missing: wantT,
      sql: "CREATE TABLE `t` (`id` int);",
      execute: async () => { throw new Error("ER_LOCK_WAIT_TIMEOUT"); },
    });
    expect(report.blocking).toHaveLength(1);
    const verdict = predeployVerdict(report);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.lines.some((line) => line.startsWith("BLOCKING:"))).toBe(true);
    expect(verdict.lines.at(-1)).toContain("REFUSING the deploy");
  });

  it("⚠ a statement that runs without error while the object stays ABSENT blocks — working law 1's read-back", async () => {
    const report = await drive({
      missing: wantT,
      after: wantT, // the read-back still misses it
      sql: "CREATE TABLE `t` (`id` int);",
    });
    expect(report.blocking.some((problem) => problem.includes("STILL ABSENT"))).toBe(true);
    expect(predeployVerdict(report).exitCode).toBe(1);
  });

  it("⚠ a DESTRUCTIVE refusal does NOT block — exit 0, printed as a waiting ceremony", async () => {
    const report = await drive({
      missing: wantT,
      sql: "ALTER TABLE `t` DROP COLUMN `old`, ADD `x` int;",
    });
    expect(report.problems.length).toBeGreaterThan(0);
    expect(report.blocking).toEqual([]);
    const verdict = predeployVerdict(report);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.some((line) => line.startsWith("ceremony waiting (NOT blocking this deploy):"))).toBe(true);
  });

  it("an UNRESOLVED declaration (nothing creates it) does not block either", async () => {
    const report = await drive({
      missing: wantT,
      sql: "CREATE TABLE `unrelated` (`id` int);",
    });
    expect(report.problems.some((problem) => problem.includes("NOTHING in drizzle/*.sql creates it"))).toBe(true);
    expect(report.blocking).toEqual([]);
    expect(predeployVerdict(report).exitCode).toBe(0);
  });

  it("blocking is a SUBSET of problems — the rite's exit accounting is unchanged by the split", async () => {
    const report = await drive({
      missing: wantT,
      sql: "CREATE TABLE `t` (`id` int);",
      execute: async () => { throw new Error("boom"); },
    });
    for (const problem of report.blocking) expect(report.problems).toContain(problem);
  });
});

describe("readSchemaGap — the ONE reading both deploy roads plan writes from (review of #584, f1)", () => {
  /* A minimal real schema source: declaredSchemaFrom parses mysqlTable calls. */
  const SOURCE = `
export const widgets = mysqlTable("widgets", {
  id: int("id").primaryKey(),
  name: varchar("name", { length: 64 }),
});
`;
  const queries = (columns: Array<{ t: string; c: string }>) =>
    async (sql: string): Promise<any[]> =>
      sql.includes("information_schema.COLUMNS") ? columns : [];

  it("computes the gap from declared-minus-live", async () => {
    const gap = await readSchemaGap(SOURCE, queries([{ t: "other", c: "id" }]));
    expect(gap.missing.tables).toContain("widgets");
  });

  it("finds nothing missing when the service holds what the code declares", async () => {
    const gap = await readSchemaGap(SOURCE, queries([
      { t: "widgets", c: "id" },
      { t: "widgets", c: "name" },
    ]));
    expect(gap.missing.tables).toEqual([]);
    expect(gap.missing.columns).toEqual([]);
  });

  it("⚠ REFUSES an empty COLUMNS read — working law 2, and this reader decides a WRITE", async () => {
    await expect(readSchemaGap(SOURCE, queries([]))).rejects.toThrow("no columns at all");
  });

  it("⚠ BOTH deploy roads call it — the drift this extraction exists to prevent", () => {
    expect(readFileSync("scripts/deploy-rite.mts", "utf8")).toContain("readSchemaGap(");
    expect(readFileSync("scripts/predeploy-migrate.mts", "utf8")).toContain("readSchemaGap(");
    /* And neither keeps a private copy of the reading's queries. */
    expect(readFileSync("scripts/deploy-rite.mts", "utf8")).not.toContain("information_schema.COLUMNS");
    expect(readFileSync("scripts/predeploy-migrate.mts", "utf8")).not.toContain("information_schema.COLUMNS");
  });
});

describe("the pre-deploy command is wired, not merely written (invariant 7)", () => {
  const SCRIPT = readFileSync("scripts/predeploy-migrate.mts", "utf8");
  const PACKAGE = readFileSync("package.json", "utf8");
  const WORKFLOW = readFileSync(".github/workflows/deploy-verify.yml", "utf8");

  it("⚠ the script CALLS the applier and the verdict on its road", () => {
    expect(SCRIPT).toContain("await autoApplyMigrations({");
    expect(SCRIPT).toContain("predeployVerdict(report)");
    expect(SCRIPT).toContain("process.exit(code)");
  });

  it("⚠ `pnpm build` bundles it to dist/predeploy.js — the exact name the service setting runs", () => {
    /* The flip card tells the founder to set `node dist/predeploy.js`. A build
       that stops producing that file turns his one-field setting into a failed
       deploy with nothing on this page going red — so the name is pinned where
       CI can see it. */
    expect(PACKAGE).toContain("scripts/predeploy-migrate.mts");
    expect(PACKAGE).toContain("--outfile=dist/predeploy.js");
  });

  it("⚠ it refuses to run OFF the platform — a laptop run would migrate whatever .env names", () => {
    expect(SCRIPT).toContain("RAILWAY_ENVIRONMENT_NAME");
    expect(SCRIPT).toMatch(/if \(!onRailway\)/);
  });

  it("the verify workflow is gated dark until the flip (DEPLOY_ON_MERGE=live)", () => {
    expect(WORKFLOW).toContain("vars.DEPLOY_ON_MERGE == 'live'");
    expect(WORKFLOW).toContain("/api/health");
  });
});
