/**
 * THE CANVAS PICKER CAN REACH EVERY CHARACTER (#2406).
 *
 * "Your characters" on the canvas used to read the 30 newest rows with drafts
 * and signed characters mixed, cut at 30, and only then put signed characters
 * first; its search filtered that same cut page in the browser. Measured on
 * the dev fixture: 6 signed of at least 14, and an older signed character's
 * name answered "No characters match".
 *
 * Three readings, each at the layer that owns the contract:
 *  1. THE STATEMENT — rendered with drizzle's `toSQL()` (assert at the wire):
 *     owner and lifecycle group in the WHERE, the search a LIKE in that same
 *     WHERE with the customer's wildcards escaped, sorted before LIMIT.
 *  2. THE READ MODEL — `listCastableModels` with the reader driven per group:
 *     a wall of newer drafts cannot push a signed character out.
 *  3. THE PROCEDURE — the search travels from the input to the reader, and an
 *     unknown key is still refused (invariant 4).
 *
 * `mysql.createPool` opens nothing until a query runs, so (1) needs no
 * database — the same trick `adminUserSearch.test.ts` uses.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { desc } from "drizzle-orm";
import mysql from "mysql2/promise";
import type { TrpcContext } from "./_core/context";
import { models } from "../drizzle/schema";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserPickerModels: vi.fn().mockResolvedValue([]),
    getHeadshotsForModels: vi.fn().mockResolvedValue(new Map()),
  };
});
vi.mock("./casting/snapshotReadScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotReadScope")>();
  return { ...actual, captureSnapshotReadMode: vi.fn().mockReturnValue("r6") };
});

import { getUserPickerModels, getHeadshotsForModels } from "./db";
import { pickerModelsWhere, escapeLikeTerm } from "./db/models";
import { listCastableModels, DRAFT_AUTO_NAME } from "./lib/boardOps";
import { appRouter } from "./routers";

// ─── 1. The statement ──────────────────────────────────────────────────────

function render(group: "signed" | "draft", search?: string) {
  const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
  try {
    return drizzle(pool)
      .select({ id: models.id })
      .from(models)
      .where(pickerModelsWhere(41, group, search, DRAFT_AUTO_NAME))
      .orderBy(desc(models.createdAt), desc(models.id))
      .limit(60)
      .toSQL();
  } finally {
    void pool.end().catch(() => undefined);
  }
}

describe("the picker's statement — owner, group and search are all in the WHERE", () => {
  it("signed: scoped to the owner and the minted statuses, no LIKE without a search", () => {
    const { sql, params } = render("signed");
    expect(sql).toContain("`models`.`userId` = ?");
    expect(params[0]).toBe(41);
    // params: owner, the availability set (draft/active/locked), then the group
    expect(params.slice(1, 4)).toEqual(["draft", "active", "locked"]);
    expect(sql).toMatch(/`models`\.`status` in \(\?, \?\)/);
    expect(params.slice(4)).toEqual(["active", "locked", 60]);
    expect(sql).toContain("`models`.`deletedAt` is null");
    expect(sql).not.toMatch(/ like /i);
  });

  it("draft: scoped to the draft status alone, and never reads a minted row", () => {
    const { sql, params } = render("draft");
    expect(sql).toContain("`models`.`userId` = ?");
    expect(sql).toContain("`models`.`status` = ?");
    expect(params.slice(4)).toEqual(["draft", 60]);
  });

  it("a search is a LIKE on the name inside the same statement, sorted before the limit", () => {
    const { sql, params } = render("signed", "  Loop Test ");
    expect(sql).toContain("`models`.`name` like ?");
    expect(params).toContain("%Loop Test%");
    // The order and the limit belong to the same statement, order first —
    // the limit is applied to the sorted, searched set, not before it.
    expect(sql.indexOf("order by")).toBeGreaterThan(sql.indexOf("like"));
    expect(sql.indexOf("limit")).toBeGreaterThan(sql.indexOf("order by"));
  });

  it("the customer's % and _ are literal characters, not wildcards", () => {
    expect(escapeLikeTerm("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    const { params } = render("signed", "%");
    expect(params).toContain("%\\%%");
    expect(params, "a bare % would match every character they own").not.toContain("%%%");
  });

  it("a draft search never answers on the fake auto-name; a signed search is not narrowed by it", () => {
    const draft = render("draft", "draft");
    expect(draft.sql).toContain("`models`.`name` <> ?");
    expect(draft.params).toContain(DRAFT_AUTO_NAME);
    const signed = render("signed", "draft");
    expect(signed.sql).not.toContain("<>");
  });
});

// ─── 2. The read model ─────────────────────────────────────────────────────

const row = (id: number, status: string, name = `Cast ${id}`) => ({ id, userId: 41, status, name });

beforeEach(() => {
  vi.mocked(getUserPickerModels).mockReset().mockResolvedValue([]);
  vi.mocked(getHeadshotsForModels).mockReset().mockImplementation(
    (async (ids: number[]) => new Map(ids.map((id) => [id, `u${id}`]))) as never,
  );
});

describe("listCastableModels — drafts can never use up the signed characters' places", () => {
  it("40 newer drafts and 10 older signed characters: all 10 signed are returned, first", async () => {
    const signed = Array.from({ length: 10 }, (_, i) => row(100 + i, "active"));
    const drafts = Array.from({ length: 40 }, (_, i) => row(200 + i, "draft"));
    vi.mocked(getUserPickerModels).mockImplementation(
      (async (_u: number, group: string, o: { limit: number }) =>
        (group === "signed" ? signed : drafts).slice(0, o.limit)) as never,
    );

    const out = await listCastableModels(41, 30);

    expect(out.filter((m) => !m.draft).map((m) => m.id)).toEqual(signed.map((m) => m.id));
    expect(out.slice(0, 10).every((m) => !m.draft)).toBe(true);
    expect(out.filter((m) => m.draft)).toHaveLength(30); // each group keeps its own limit
  });

  it("each group is read for the caller, with the trimmed search and its own limit", async () => {
    await listCastableModels(41, 30, "r6", "  Loop ");
    const calls = vi.mocked(getUserPickerModels).mock.calls;
    expect(calls.map((c) => c[1]).sort()).toEqual(["draft", "signed"]);
    for (const [userId, , opts] of calls) {
      expect(userId).toBe(41);
      expect(opts).toMatchObject({ search: "Loop", draftAutoName: DRAFT_AUTO_NAME });
      expect(opts.limit).toBeGreaterThanOrEqual(30);
    }
  });

  it("a blank search is no search", async () => {
    await listCastableModels(41, 30, "r6", "   ");
    for (const [, , opts] of vi.mocked(getUserPickerModels).mock.calls) {
      expect(opts.search).toBeUndefined();
    }
  });
});

// ─── 3. The procedure ──────────────────────────────────────────────────────

function authCtx(): TrpcContext {
  return {
    user: {
      id: 41, openId: "u41", email: "u41@example.com", name: "U", loginMethod: "email",
      approved: true, role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => {} },
    correlationId: "picker-reach-test",
  } as unknown as TrpcContext;
}

describe("boardOps.listCastableModels — the search reaches the reader", () => {
  it("passes the search through, scoped to the session's user", async () => {
    await appRouter.createCaller(authCtx()).boardOps.listCastableModels({ limit: 30, search: "Loop Test" });
    const calls = vi.mocked(getUserPickerModels).mock.calls;
    expect(calls.length).toBe(2);
    for (const [userId, , opts] of calls) {
      expect(userId).toBe(41);
      expect(opts.search).toBe("Loop Test");
    }
  });

  it("still refuses an unknown key (invariant 4)", async () => {
    await expect(
      appRouter.createCaller(authCtx()).boardOps.listCastableModels({ limit: 30, userId: 9 } as never),
    ).rejects.toThrow();
  });
});

// ─── 4. The picker asks the server ─────────────────────────────────────────
// A source reading, and it says so: the behaviour is proven above and in the
// rendered frames on the PR; this arm only refuses the old shape coming back
// (a filter over the page in the browser, with the search never sent).

describe("CastPickerModal sends the search instead of filtering a page", () => {
  it("the query input carries the search, and nothing filters names in the browser", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("client/src/features/boards/canvas/CastPickerModal.tsx", "utf8");
    const query = src.slice(src.indexOf("listCastableModels.useQuery("), src.indexOf("// D-42: minted models first"));
    expect(query).toMatch(/search: settledSearch/);
    expect(src).not.toMatch(/\.name \?\? ""\)\.toLowerCase\(\)\.includes/);
    expect(src).not.toMatch(/list\.filter\(\(m\) => \(m\.name/);
  });
});
