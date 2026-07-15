/**
 * Batch B — shared model-lifecycle read-model units (R6 execution plan, FR-4).
 *
 * The full status table, proven for every predicate:
 *
 *   | status     | draft | minted | available |
 *   |------------|-------|--------|-----------|
 *   | draft      | yes   | no     | yes       |
 *   | active     | no    | yes    | yes       |
 *   | locked     | no    | yes    | yes       |  ← legacy minted alias
 *   | archived   | no    | no     | no        |  ← deleted everywhere
 *   | (unknown)  | no    | no     | no        |  ← conservative, never a fallback
 *
 * Plus the agencyId rule: agencyId is detail/integrity data and NEVER the
 * read-model discriminator for minted state.
 */
import { describe, it, expect } from "vitest";
import {
  MODEL_LIFECYCLE_STATUSES,
  MODEL_MINTED_STATUSES,
  isModelLifecycleStatus,
  isModelDraftStatus,
  isModelMintedStatus,
  isModelArchivedStatus,
  isModelAvailableStatus,
} from "../shared/modelLifecycle";

describe("model lifecycle status domain", () => {
  it("the domain is exactly draft | active | locked | archived", () => {
    expect(MODEL_LIFECYCLE_STATUSES).toEqual(["draft", "active", "locked", "archived"]);
  });

  it("the minted-status list is exactly active + locked (query filters read this)", () => {
    expect(MODEL_MINTED_STATUSES).toEqual(["active", "locked"]);
  });

  it("isModelLifecycleStatus accepts exactly the four statuses", () => {
    for (const s of MODEL_LIFECYCLE_STATUSES) expect(isModelLifecycleStatus(s)).toBe(true);
    for (const bad of ["", "ACTIVE", "Draft", "deleted", "minted", null, undefined, 42, {}]) {
      expect(isModelLifecycleStatus(bad)).toBe(false);
    }
  });
});

describe("the read-model table", () => {
  const table: Array<[string, boolean, boolean, boolean, boolean]> = [
    // status,     draft, minted, archived, available
    ["draft",      true,  false, false, true],
    ["active",     false, true,  false, true],
    ["locked",     false, true,  false, true], // legacy minted alias (FR-4)
    ["archived",   false, false, true,  false], // deleted everywhere (FR-4)
  ];

  it.each(table)("%s → draft=%s minted=%s archived=%s available=%s", (status, draft, minted, archived, available) => {
    expect(isModelDraftStatus(status)).toBe(draft);
    expect(isModelMintedStatus(status)).toBe(minted);
    expect(isModelArchivedStatus(status)).toBe(archived);
    expect(isModelAvailableStatus(status)).toBe(available);
  });

  it("draft and minted are mutually exclusive and never both true for any known status", () => {
    for (const s of MODEL_LIFECYCLE_STATUSES) {
      expect(isModelDraftStatus(s) && isModelMintedStatus(s)).toBe(false);
    }
  });
});

describe("unknown status fails conservatively — never draft, never minted, never available", () => {
  const unknowns: unknown[] = ["", "ACTIVE", "Locked", "deleted", "pending", "minted", null, undefined, 0, 1, {}, []];

  it.each(unknowns.map((u) => [u]))("%o is not draft / minted / archived / available", (u) => {
    expect(isModelDraftStatus(u)).toBe(false);
    expect(isModelMintedStatus(u)).toBe(false);
    expect(isModelArchivedStatus(u)).toBe(false);
    expect(isModelAvailableStatus(u)).toBe(false);
  });

  it("an unknown status is unavailable even though it is not literally archived", () => {
    // The conservative direction: unrecognized rows must not surface as
    // workable, but availability is the predicate that says so — a consumer
    // deriving available as !isModelArchivedStatus would fail open here.
    expect(isModelArchivedStatus("future_status")).toBe(false);
    expect(isModelAvailableStatus("future_status")).toBe(false);
  });
});

describe("agencyId is NEVER the read-model discriminator", () => {
  // Model-shaped fixtures: the read model must key off status alone.
  const withStray = { status: "draft", agencyId: "MOD-26-STRAY0" };
  const activeNoId = { status: "active", agencyId: null };
  const lockedNoId = { status: "locked", agencyId: null };
  const lockedWithId = { status: "locked", agencyId: "MOD-26-LEGACY" };
  const archivedWithId = { status: "archived", agencyId: "MOD-26-GONE00" };

  it("a draft carrying a stray agencyId still reads as a draft, not minted", () => {
    expect(isModelDraftStatus(withStray.status)).toBe(true);
    expect(isModelMintedStatus(withStray.status)).toBe(false);
  });

  it("active without agencyId still reads minted for read-state purposes", () => {
    // The operation-specific integrity contracts (registry/export require the
    // ID) keep their own fail-closed checks — see batchB-status-readmodel.
    expect(isModelMintedStatus(activeNoId.status)).toBe(true);
    expect(isModelDraftStatus(activeNoId.status)).toBe(false);
  });

  it("legacy locked reads minted with or without the ID", () => {
    expect(isModelMintedStatus(lockedNoId.status)).toBe(true);
    expect(isModelMintedStatus(lockedWithId.status)).toBe(true);
    expect(isModelDraftStatus(lockedNoId.status)).toBe(false);
  });

  it("archived stays unavailable regardless of agencyId", () => {
    expect(isModelArchivedStatus(archivedWithId.status)).toBe(true);
    expect(isModelAvailableStatus(archivedWithId.status)).toBe(false);
    expect(isModelMintedStatus(archivedWithId.status)).toBe(false);
    expect(isModelDraftStatus(archivedWithId.status)).toBe(false);
  });
});
