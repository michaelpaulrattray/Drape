/**
 * THE BUG-REPORT INBOX'S BOUNDARY (#255).
 *
 * The founder was asked before this was built, because putting a customer's own
 * prose in front of staff is broader than the access-control grid's default for
 * a resource not in it (*owner-only for users, none for staff*). His ruling,
 * verbatim and entire:
 *
 *   "D is the right long-term answer probably in the admin panel first not the
 *    moderator panel yet. no point taking shortcuts."
 *
 * So there are two boundaries to hold, and only one of them is the obvious one:
 *
 *  1. **ADMIN, not moderator.** Admins pass `moderatorProcedure`
 *     (CLAUDE.md's footnote 1 — "admins inherit the entire moderator surface"),
 *     so declaring these with the moderator builder would have SHIPPED the
 *     surface he deferred while looking exactly like obeying him. There is no
 *     behavioural difference to observe on an admin account; the declaration is
 *     the whole control, so the declaration is what is pinned.
 *  2. **The audit row must never carry the description.** The audit log is a
 *     staff-wide surface with its OWN moderator readers. Copying a customer's
 *     prose into it would widen the exception through a side door, to the exact
 *     role he deferred, with nothing on the bug-report surface looking wrong.
 *
 * # Why these arms drive and read rather than grep for a token
 *
 * `publicInputStrictness.test.ts` records the reason: the Atlas's own
 * `strictInput` was a substring test for months, so a second reader looking for
 * the same string learns nothing the first one already believed. The strictness
 * arms below pull the REAL parser off the REAL router and parse an object with
 * an extra key. The two source arms are source arms because their subject is a
 * field that is present or absent, which no behavioural test can see — the
 * `staffImageBoundary.test.ts` reasoning, and each carries a positive control
 * so a matcher that has stopped matching cannot pass as a clean result.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { bugReportsRouter } from "./routes/admin/bugReports";
import { adminRouter } from "./routes/admin";
import { BUG_REPORT_CATEGORIES, BUG_REPORT_STATUSES } from "../shared/bugReportVocabulary";

const ROUTER_SOURCE = path.join(__dirname, "routes/admin/bugReports.ts");
const DB_SOURCE = path.join(__dirname, "db/bugReports.ts");

/** Comments are stripped before matching: a docblock that STATES the rule would
 *  otherwise satisfy an arm checking the rule is kept — a guard passing on the
 *  promise instead of the breach. */
function code(file: string): string {
  return fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** The zod parser tRPC holds for a procedure, reached without running a handler. */
function parserOf(name: string): { parse: (input: unknown) => unknown } {
  const procedure = (bugReportsRouter as unknown as Record<string, any>)._def.procedures[name];
  if (!procedure) throw new Error(`no procedure named ${name} on the bug-reports router`);
  const inputs = procedure._def.inputs as Array<{ parse: (input: unknown) => unknown }>;
  if (!inputs?.length) throw new Error(`${name} declares no input parser`);
  if (inputs.length !== 1) throw new Error(`${name} declares ${inputs.length} input parsers`);
  return inputs[0];
}

const PROCEDURES = ["getBugReports", "getBugReportCounts", "updateBugReportStatus"] as const;

describe("the bug-report inbox reaches the admin panel and stops there", () => {
  it("finds all three procedures on the real admin router — an arm over an empty set is not an arm", () => {
    const merged = (adminRouter as unknown as Record<string, any>)._def.procedures;
    for (const name of PROCEDURES) {
      expect(merged[name], `${name} is not merged into adminRouter`).toBeDefined();
    }
  });

  it("declares every procedure with adminProcedure, never moderatorProcedure", () => {
    const source = code(ROUTER_SOURCE);

    for (const name of PROCEDURES) {
      expect(
        source,
        `${name} must be declared with adminProcedure — moderatorProcedure would ship the surface he deferred, and an admin account cannot tell the difference`,
      ).toMatch(new RegExp(`${name}:\\s*adminProcedure`));
    }

    expect(
      source,
      "moderatorProcedure must not appear in this router at all: admins inherit it, so it reads as working while being the wrong boundary",
    ).not.toContain("moderatorProcedure");

    /* POSITIVE CONTROL — the absence assertion above is only worth anything if
       the same matcher would FIRE on the thing it is looking for. */
    expect("getBugReports: moderatorProcedure").toContain("moderatorProcedure");
  });

  it("never copies the customer's prose into the audit log", () => {
    const source = code(ROUTER_SOURCE);
    const auditBlock = source.slice(source.indexOf("logAdminAction"));

    expect(auditBlock).toContain("UPDATE_BUG_REPORT_STATUS");
    expect(
      auditBlock,
      "the audit row carries the id and the transition; `description` is the customer's own words and the audit log has moderator readers",
    ).not.toContain("description");

    /* POSITIVE CONTROL — the matcher fires on a row that DID carry it. */
    expect(`details: \`\${report.description}\``).toContain("description");
  });

  it("has no delete and no export — resolved and dismissed both KEEP what she said", () => {
    const dbSource = code(DB_SOURCE);
    const routerSource = code(ROUTER_SOURCE);

    for (const forbidden of ["deleteBugReport", "exportBugReports"]) {
      expect(dbSource, `${forbidden} must not exist`).not.toContain(forbidden);
      expect(routerSource, `${forbidden} must not exist`).not.toContain(forbidden);
    }

    expect(
      dbSource,
      "no delete statement against bug_reports — removing a person's words is a founder decision, not a queue button",
    ).not.toMatch(/\.delete\(\s*bugReports\s*\)/);

    /* POSITIVE CONTROL — the delete matcher is not simply blind. */
    expect("await tx.delete(bugReports).where(eq(bugReports.id, id))").toMatch(
      /\.delete\(\s*bugReports\s*\)/,
    );
  });

  it("returns an explicit projection rather than a spread row (invariant 8)", () => {
    const dbSource = code(DB_SOURCE);
    const listing = dbSource.slice(dbSource.indexOf("export async function listBugReports"));

    expect(listing, "the reader must name its columns").toContain("description: bugReports.description");
    expect(
      listing,
      "a bare select() carries whatever a future migration adds, onto a staff surface, with nobody deciding it should",
    ).not.toMatch(/\.select\(\s*\)/);

    /* POSITIVE CONTROL — the bare-select matcher fires on a bare select. */
    expect("const rows = await db.select().from(bugReports)").toMatch(/\.select\(\s*\)/);
  });
});

describe("a state never wears a control's clothes", () => {
  /**
   * Found in the running app, not by an assertion: `reviewing` shipped as a
   * white pill with a dark border, which is the treatment of the three OUTLINED
   * workflow buttons on the same row — the card read as having four buttons and
   * one of them did nothing.
   *
   * ⚠ **THE MECHANISM CHANGED UNDER THIS ARM AND THE ARM SAID SO** (brief 06,
   * 2026-09-02). The card became a table row, so `STATUS_STYLES` — a map of
   * hex fills this arm read line by line — no longer exists, and the arm's own
   * *"the arm is reading nothing"* control fired the moment it went. That is
   * the one thing an arm must do when its subject is deleted, and it is why
   * this file is being rewritten rather than deleted.
   *
   * **The defect is now prevented structurally rather than by a rule about
   * fills**: a state is a `StatePill` in a CELL, an action is a `Button` in the
   * EXPANSION, and the two are never on the same line — so the resemblance the
   * founder saw cannot be drawn. The arms below hold that separation, which is
   * a stronger claim than the colour one it replaces.
   */
  const PAGE = path.join(__dirname, "../client/src/pages/AdminBugReports.tsx");

  it("draws status as a state pill, never as anything button-shaped", () => {
    const source = code(PAGE);

    expect(source, "the arm is reading nothing").toContain("ATTENTION_STATUS");
    expect(
      source,
      "the status cell must be a StatePill — the one place the accent rule lives",
    ).toMatch(/<StatePill[^>]*label=\{STATUS_LABELS\[status\]\}/);

    expect(
      source,
      "a status must never be rendered as a <button> or a Button — that is what made the card read as having four buttons",
    ).not.toMatch(/<[Bb]utton[^>]*>\s*\{STATUS_LABELS\[status\]\}/);

    /* POSITIVE CONTROL — the matcher fires on the shape that shipped and was
       wrong, written here as the button form of the same expression. */
    expect("<Button size=\"small\">{STATUS_LABELS[status]}</Button>").toMatch(
      /<[Bb]utton[^>]*>\s*\{STATUS_LABELS\[status\]\}/,
    );
  });

  it("puts the workflow actions in the expansion, where no state pill sits", () => {
    const source = code(PAGE);

    /* Every action is a `RowAction` in `actions:`, which `ExpandableRow` draws
       inside the panel. A state cannot reach that array: `RowAction` has no
       pill shape, and the cells array has no Button in it. */
    const cells = source.slice(source.indexOf("cells: ["), source.indexOf("facts: ["));
    expect(cells, "the arm is reading nothing").toContain("StatePill");
    expect(
      cells,
      "no control may sit in a row's cells — the Actions column is exactly what this brief removed",
    ).not.toMatch(/<Button|onClick=/);

    const actions = source.slice(source.indexOf("actions: STATUSES.filter"));
    expect(actions, "the arm is reading nothing").toContain("Mark ${STATUS_LABELS[s].toLowerCase()}");
    expect(
      actions,
      "an action's label must read as an instruction, not as a bare state name",
    ).toContain("`Mark ");

    /* POSITIVE CONTROL — the cells matcher fires on a cell carrying a control. */
    expect('cells: [<Button onClick={x}>Manage</Button>], facts: [').toMatch(/<Button|onClick=/);
  });
});

describe("both inputs reject an undeclared field (invariant 4), driven at the real parser", () => {
  it("getBugReports accepts its declared shape and refuses an extra key", () => {
    const parser = parserOf("getBugReports");
    expect(() => parser.parse({ status: "new", limit: 25, offset: 0 })).not.toThrow();
    expect(() => parser.parse({})).not.toThrow();
    expect(
      () => parser.parse({ status: "new", limit: 25, offset: 0, userId: 2 }),
      "an unknown key on a staff reader is how a filter nobody declared reaches the WHERE",
    ).toThrow();
  });

  it("updateBugReportStatus accepts its declared shape and refuses an extra key", () => {
    const parser = parserOf("updateBugReportStatus");
    expect(() => parser.parse({ id: 1, status: "resolved" })).not.toThrow();
    expect(() => parser.parse({ id: 1, status: "resolved", userId: 2 })).toThrow();
  });

  it("refuses a status outside the declared workflow", () => {
    const parser = parserOf("updateBugReportStatus");
    expect(() => parser.parse({ id: 1, status: "deleted" })).toThrow();
    expect(() => parser.parse({ id: 0, status: "new" }), "ids are positive").toThrow();
  });

  it("the shared vocabulary and the database column are ONE list, both ways", () => {
    /* The move to `shared/` is only worth anything if something proves the two
       stay together — a shared list that drifts from its column is the same
       defect as a copied one, wearing a better address. Asserted in BOTH
       directions: a value added to the column and not the list is as broken as
       the reverse, and a one-way check passes on half of them. */
    const schema = fs.readFileSync(path.join(__dirname, "../drizzle/schema.ts"), "utf8");
    const table = schema.slice(schema.indexOf('bugReports = mysqlTable("bug_reports"'));
    const block = table.slice(0, table.indexOf("(table) =>"));

    const columnValues = (field: string): string[] => {
      const m = block.match(new RegExp(`${field}:\\s*mysqlEnum\\("${field}",\\s*\\[([^\\]]+)\\]`));
      if (!m) throw new Error(`bug_reports.${field} not found in the schema — this arm is reading nothing`);
      return [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]).sort();
    };

    expect([...BUG_REPORT_STATUSES].sort()).toEqual(columnValues("status"));
    expect([...BUG_REPORT_CATEGORIES].sort()).toEqual(columnValues("category"));
  });

  it("the status vocabulary is the one the COLUMN declares, not a second copy", () => {
    /* Working law 4. The enum the procedure validates against and the enum the
       database column allows must be one list; two lists drift, and the drift
       shows up as a 500 on a support queue rather than as a failing test. */
    const schema = fs.readFileSync(path.join(__dirname, "../drizzle/schema.ts"), "utf8");
    const column = schema.match(/status:\s*mysqlEnum\("status",\s*\[([^\]]+)\]\)[^\n]*\n\s*createdAt[^\n]*\n\}, \(table\) => \[\s*index\("idx_bug_reports_user"\)/);
    expect(column, "could not find bug_reports.status in the schema — the arm is reading nothing").not.toBeNull();

    const declared = [...column![1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    expect(declared).toEqual(["new", "reviewing", "resolved", "dismissed"]);

    const parser = parserOf("updateBugReportStatus");
    for (const status of declared) {
      expect(() => parser.parse({ id: 1, status }), `${status} is a column value the API refuses`).not.toThrow();
    }
  });
});
