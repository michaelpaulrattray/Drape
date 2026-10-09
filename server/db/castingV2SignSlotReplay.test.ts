import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ONE SIGN, ONE PICTURE PER ANGLE — a replayed Sign view commit (#2082).
 *
 * The fault: `commitPackageSlotAsset`'s transaction commits, its
 * acknowledgement is lost, and the throw (not a `SignPersistenceError`) reaches
 * `renderViewAttempts`. A Sign renders on the sheet road, where that throw is
 * RETRIED: the loop's catch drops the first attempt's bytes, re-stores the same
 * settled panel under a new key, and the commit ran again — inserting a second
 * row for one slot, the first pointing at deleted bytes.
 *
 * Two floors here, because CI has no database (`vitest.setup.ts` strips
 * `DATABASE_URL`):
 *
 * - a BEHAVIOURAL arm that drives the real function through a fake
 *   transaction: what it inserts, what it updates, and what id it answers,
 *   with the rows the fake holds as the only thing varied between arms;
 * - a TEXT arm pinning the order (fences, then the replay read, then the
 *   insert) and the key, sliced so the insert cannot satisfy the read's
 *   assertions.
 *
 * What MySQL does with the locks — a real replay, a race of three, two Signs
 * on one angle — is driven against the dev database by
 * `scripts/_2082-sign-commit-replay-disposable.mts`, whose tally is on the PR.
 */

type AssetRow = { id: number; storageKey: string | null; provenance: unknown };

const state = {
  operationRunning: true,
  modelProvisioning: true,
  assets: [] as AssetRow[],
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  nextId: 500,
};

vi.mock("./connection", async () => {
  const schema = await import("../../drizzle/schema");
  const rowsFor = (table: unknown): unknown[] => {
    if (table === schema.generationOperations) return state.operationRunning ? [{ id: "op" }] : [];
    if (table === schema.models) return state.modelProvisioning ? [{ id: 7 }] : [];
    if (table === schema.modelAssets) return state.assets;
    throw new Error("the fake transaction was asked for a table this test does not know");
  };
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => ({ for: async () => rowsFor(table) }),
          orderBy: () => ({ for: async () => rowsFor(table) }),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updates.push(values);
          return [{ affectedRows: 1 }];
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        $returningId: async () => {
          state.inserts.push(values);
          const id = state.nextId++;
          return [{ id }];
        },
      }),
    }),
  };
  return {
    getDb: async () => null,
    withTransaction: async (run: (handle: unknown) => Promise<unknown>) => run(tx),
  };
});

import { commitPackageSlotAsset } from "./castingV2Sign";

const OPERATION = "11111111-2222-3333-4444-555555555555";

const commit = (overrides: { operationId?: string; storageKey?: string; provenance?: Record<string, unknown> } = {}) => {
  const storageKey = overrides.storageKey ?? "casting/sign/replay.png";
  return commitPackageSlotAsset({
    userId: 1,
    operationId: overrides.operationId ?? OPERATION,
    modelId: 7,
    angle: "backFull",
    storageKey,
    storageUrl: `https://example.invalid/${storageKey}`,
    identityRevisionId: "rev",
    identityText: "her",
    pointsCost: 90,
    provenance: overrides.provenance ?? { source: "castingV2.sign" },
  });
};

beforeEach(() => {
  state.operationRunning = true;
  state.modelProvisioning = true;
  state.assets = [];
  state.inserts = [];
  state.updates = [];
  state.nextId = 500;
});

describe("a Sign view commit replayed after a lost acknowledgement", () => {
  it("CONTROL — a first commit inserts one row, stamped from the typed operation id", async () => {
    const id = await commit({ provenance: { source: "castingV2.sign" } });
    expect(id).toBe(500);
    expect(state.inserts).toHaveLength(1);
    expect(state.updates).toHaveLength(0);
    const provenance = state.inserts[0]!.provenance as Record<string, unknown>;
    expect(provenance.signOperationId).toBe(OPERATION);
    expect(provenance.source).toBe("castingV2.sign");
  });

  it("the stamp is the typed id even when the caller's bag carries a different one", async () => {
    await commit({ provenance: { source: "castingV2.sign", signOperationId: "a-typo" } });
    const provenance = state.inserts[0]!.provenance as Record<string, unknown>;
    expect(provenance.signOperationId).toBe(OPERATION);
  });

  it("THE CARD — a replay answers the existing row's id, inserts nothing, and moves it onto the live bytes", async () => {
    state.assets = [{
      id: 42,
      storageKey: "casting/sign/first-attempt-dropped.png",
      provenance: { source: "castingV2.sign", signOperationId: OPERATION },
    }];
    const id = await commit({ storageKey: "casting/sign/replay-live.png" });
    expect(id).toBe(42);
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toEqual([{
      storageKey: "casting/sign/replay-live.png",
      storageUrl: "https://example.invalid/casting/sign/replay-live.png",
    }]);
  });

  it("a replay with identical bytes moves nothing", async () => {
    state.assets = [{
      id: 42,
      storageKey: "casting/sign/replay.png",
      provenance: { signOperationId: OPERATION },
    }];
    expect(await commit()).toBe(42);
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it("CONTROL — a row stamped by ANOTHER Sign, or not stamped at all, never answers this one", async () => {
    state.assets = [
      { id: 40, storageKey: "casting/sign/other.png", provenance: { signOperationId: "another-sign" } },
      { id: 41, storageKey: "casting/sign/old.png", provenance: { source: "castingV2.sign" } },
      { id: 43, storageKey: null, provenance: null },
    ];
    const id = await commit();
    expect(id).toBe(500);
    expect(state.inserts).toHaveLength(1);
    expect(state.updates).toHaveLength(0);
  });

  it("the fences still come first — a fenced operation is refused before any replay is honoured", async () => {
    state.operationRunning = false;
    state.assets = [{ id: 42, storageKey: "x", provenance: { signOperationId: OPERATION } }];
    expect(await commit({ storageKey: "y" })).toBeNull();
    expect(state.updates).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);

    state.operationRunning = true;
    state.modelProvisioning = false;
    expect(await commit({ storageKey: "y" })).toBeNull();
    expect(state.updates).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });
});

describe("the replay read's place and key, read at the source", () => {
  it("sits after both fences, is locking, keys on the typed operation and the angle, and never inserts", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "server/db/castingV2Sign.ts"), "utf8");
    const anchor = "export async function commitPackageSlotAsset";
    expect(source.split(anchor)).toHaveLength(2);
    const lines = source.split(/\r?\n/);
    const start = lines.findIndex((line) => line.startsWith(anchor));
    const end = lines.findIndex((line, index) => index > start && line === "}");
    const body = lines.slice(start, end + 1).join("\n");

    const replayRead = body.indexOf("const sameAngle = await tx");
    const replayAnswer = body.indexOf("if (already) {");
    const insert = body.indexOf(".insert(modelAssets)");
    expect(replayRead, "the replay read is gone from the Sign's commit").toBeGreaterThan(-1);
    expect(body.indexOf("await requireRunningSignOperationIn(tx, input);")).toBeLessThan(replayRead);
    expect(body.indexOf('if (!model) throw new SignPersistenceError("commit_conflict");')).toBeLessThan(replayRead);
    expect(replayRead).toBeLessThan(replayAnswer);
    expect(replayAnswer).toBeLessThan(insert);

    const replay = body.slice(replayRead, insert);
    expect(replay).toContain('.for("update")');
    expect(replay).toContain("eq(modelAssets.viewType, input.angle)");
    expect(replay).toContain("provenance?.signOperationId === input.operationId");
    expect(replay).toContain("return already.id;");
    expect(replay).toContain("eq(modelAssets.id, already.id)");
    expect(replay).not.toContain(".insert(");

    const written = body.slice(insert);
    const bag = written.indexOf("...input.provenance,");
    const stamp = written.indexOf("signOperationId: input.operationId,");
    expect(bag).toBeGreaterThan(-1);
    expect(stamp).toBeGreaterThan(bag);
  });
});
