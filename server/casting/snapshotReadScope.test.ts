import { describe, expect, it } from "vitest";
import {
  SnapshotReadScopeConfigurationError,
  parseSnapshotReadScope,
  snapshotReadModeForUser,
} from "./snapshotReadScope";

describe("R7-7B1 snapshot read scope", () => {
  it("defaults missing and empty values to off", () => {
    expect(parseSnapshotReadScope(undefined)).toEqual({ kind: "off" });
    expect(parseSnapshotReadScope("")).toEqual({ kind: "off" });
    expect(parseSnapshotReadScope("off")).toEqual({ kind: "off" });
  });

  it("accepts all and canonical exact-user scopes", () => {
    expect(parseSnapshotReadScope("all")).toEqual({ kind: "all" });
    expect(parseSnapshotReadScope("users:46,1,7")).toEqual({
      kind: "users",
      userIds: [1, 7, 46],
    });
  });

  it.each([
    "OFF",
    " all",
    "all ",
    "users:",
    "users:0",
    "users:-1",
    "users:01",
    "users:1,",
    "users:,1",
    "users:1, 2",
    "users:1,1",
    "users:1.5",
    `users:${Number.MAX_SAFE_INTEGER + 1}`,
    "founder",
  ])("rejects malformed or ambiguous value %s", (raw) => {
    expect(() => parseSnapshotReadScope(raw))
      .toThrow(SnapshotReadScopeConfigurationError);
  });

  it("resolves one captured scope without client input", () => {
    const scope = parseSnapshotReadScope("users:1,46");
    expect(snapshotReadModeForUser(scope, 1)).toBe("snapshot");
    expect(snapshotReadModeForUser(scope, 46)).toBe("snapshot");
    expect(snapshotReadModeForUser(scope, 2)).toBe("r6");
    expect(snapshotReadModeForUser({ kind: "all" }, 999)).toBe("snapshot");
    expect(snapshotReadModeForUser({ kind: "off" }, 1)).toBe("r6");
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid request user id %s",
    (userId) => {
      expect(() => snapshotReadModeForUser({ kind: "all" }, userId))
        .toThrow("positive integer user id");
    },
  );
});
