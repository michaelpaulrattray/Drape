import { afterEach, describe, expect, it } from "vitest";
import {
  SNAPSHOT_RESTORE_SCOPE_ENV,
  captureSnapshotRestoreEnabled,
  parseSnapshotRestoreScope,
  snapshotRestoreEnabledForUser,
  validateSnapshotRestoreEnvironment,
} from "./snapshotRestoreScope";

const previous = process.env[SNAPSHOT_RESTORE_SCOPE_ENV];

afterEach(() => {
  if (previous === undefined) delete process.env[SNAPSHOT_RESTORE_SCOPE_ENV];
  else process.env[SNAPSHOT_RESTORE_SCOPE_ENV] = previous;
});

describe("R7-7F snapshot restore scope", () => {
  it("defaults off and parses exact sorted allowlists", () => {
    expect(parseSnapshotRestoreScope(undefined)).toEqual({ kind: "off" });
    expect(parseSnapshotRestoreScope("off")).toEqual({ kind: "off" });
    expect(parseSnapshotRestoreScope("all")).toEqual({ kind: "all" });
    expect(parseSnapshotRestoreScope("users:9,1")).toEqual({
      kind: "users",
      userIds: [1, 9],
    });
  });

  it.each([
    " users:1",
    "users:1 ",
    "users:",
    "users:01",
    "users:1,1",
    "users:0",
    "users:-1",
    "everyone",
  ])("fails closed for malformed scope %s", (raw) => {
    expect(() => parseSnapshotRestoreScope(raw)).toThrow(
      "R7_SNAPSHOT_RESTORE_SCOPE",
    );
  });

  it("requires restore scope to be a subset of snapshot reads", () => {
    expect(() => validateSnapshotRestoreEnvironment({
      restoreScope: "users:1",
      snapshotScope: "users:1,2",
    })).not.toThrow();
    expect(() => validateSnapshotRestoreEnvironment({
      restoreScope: "all",
      snapshotScope: "users:1,2",
    })).toThrow("must be a subset");
    expect(() => validateSnapshotRestoreEnvironment({
      restoreScope: "users:2",
      snapshotScope: "users:1",
    })).toThrow("must be a subset");
  });

  it("captures one server-owned answer for the authenticated user", () => {
    process.env[SNAPSHOT_RESTORE_SCOPE_ENV] = "users:1";
    expect(captureSnapshotRestoreEnabled(1)).toBe(true);
    expect(captureSnapshotRestoreEnabled(2)).toBe(false);
    expect(snapshotRestoreEnabledForUser({ kind: "all" }, 99)).toBe(true);
    expect(() => snapshotRestoreEnabledForUser({ kind: "all" }, 0)).toThrow();
  });
});
