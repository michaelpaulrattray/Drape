import { describe, expect, it } from "vitest";
import {
  buildSnapshotCohortInventory,
  parseSnapshotCohortInventoryArgs,
  publicSnapshotCohortInventory,
} from "./snapshotCohortInventory";

const devArgs = [
  "--database-url", "mysql://user:pass@example.test/railway",
  "--app-id", "drape-local",
  "--max-users", "25",
];

function expectNumericLeaves(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isSafeInteger(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) expectNumericLeaves(item);
    return;
  }
  expect(value).not.toBeNull();
  expect(typeof value).toBe("object");
  for (const child of Object.values(value as Record<string, unknown>)) {
    expectNumericLeaves(child);
  }
}

describe("R7-7B7 snapshot cohort inventory", () => {
  it("requires the exact read-only ceremony and rejects loose integer syntax", () => {
    expect(() => parseSnapshotCohortInventoryArgs([]))
      .toThrow("--database-url is required");
    expect(() => parseSnapshotCohortInventoryArgs(devArgs.slice(0, -2)))
      .toThrow("--max-users is required");
    for (const value of ["0", "-1", "01", "1.5", "1e2", "0x10", " 2", "9007199254740992"]) {
      expect(() => parseSnapshotCohortInventoryArgs([
        ...devArgs.slice(0, -1),
        value,
      ])).toThrow();
    }
    expect(() => parseSnapshotCohortInventoryArgs([
      ...devArgs,
      "--max-users", "30",
    ])).toThrow("Duplicate argument: --max-users");
    expect(() => parseSnapshotCohortInventoryArgs([
      ...devArgs,
      "--all", "true",
    ])).toThrow("Unknown argument: --all");
    expect(() => parseSnapshotCohortInventoryArgs(
      devArgs.map((value) => value === "drape-local" ? "drape-production" : value),
    )).toThrow("requires --allow-production-read-only");
  });

  it("accepts an explicitly authorized production read-only inventory", () => {
    expect(parseSnapshotCohortInventoryArgs([
      ...devArgs.map((value) => value === "drape-local" ? "drape-production" : value),
      "--allow-production-read-only",
    ])).toEqual({
      databaseUrl: "mysql://user:pass@example.test/railway",
      appId: "drape-production",
      maxUsers: 25,
      allowProductionReadOnly: true,
    });
  });

  it("sorts deterministic numeric-only summaries and derives headless counts", () => {
    const result = buildSnapshotCohortInventory(2, [
      {
        userId: "9",
        liveModels: "4",
        mintedModels: "2",
        modelsWithSnapshotHead: "3",
      },
      {
        userId: 3,
        liveModels: 2,
        mintedModels: 0,
        modelsWithSnapshotHead: 1,
      },
    ], 10);
    const output = publicSnapshotCohortInventory(result);
    expect(output).toEqual({
      totalUsers: 2,
      users: [
        {
          userId: 3,
          liveModels: 2,
          mintedModels: 0,
          modelsWithSnapshotHead: 1,
          modelsWithoutSnapshotHead: 1,
        },
        {
          userId: 9,
          liveModels: 4,
          mintedModels: 2,
          modelsWithSnapshotHead: 3,
          modelsWithoutSnapshotHead: 1,
        },
      ],
    });
    expectNumericLeaves(output);
  });

  it("returns only the aggregate user count when the cap is exceeded", () => {
    const result = buildSnapshotCohortInventory(11, [
      {
        userId: 99,
        liveModels: 100,
        mintedModels: 100,
        modelsWithSnapshotHead: 100,
      },
    ], 10);
    const output = publicSnapshotCohortInventory(result);
    expect(output).toEqual({ totalUsers: 11 });
    expect("users" in output).toBe(false);
    expectNumericLeaves(output);
  });

  it("refuses inconsistent or duplicate grouped results", () => {
    expect(() => buildSnapshotCohortInventory(2, [], 10))
      .toThrow("grouped-user count changed");
    expect(() => buildSnapshotCohortInventory(2, [
      { userId: 7, liveModels: 1, mintedModels: 0, modelsWithSnapshotHead: 0 },
      { userId: 7, liveModels: 1, mintedModels: 0, modelsWithSnapshotHead: 0 },
    ], 10)).toThrow("duplicate user");
    expect(() => buildSnapshotCohortInventory(1, [
      { userId: 7, liveModels: 1, mintedModels: 2, modelsWithSnapshotHead: 0 },
    ], 10)).toThrow("aggregate counts are inconsistent");
    expect(() => buildSnapshotCohortInventory(1, [
      { userId: 7, liveModels: 1, mintedModels: 0, modelsWithSnapshotHead: 2 },
    ], 10)).toThrow("aggregate counts are inconsistent");
    expect(() => buildSnapshotCohortInventory(1, [
      { userId: 7, liveModels: 1, mintedModels: null, modelsWithSnapshotHead: 0 },
    ], 10)).toThrow("non-negative safe integer");
    expect(() => buildSnapshotCohortInventory(1, [
      { userId: 7, liveModels: 1, mintedModels: -1, modelsWithSnapshotHead: 0 },
    ], 10)).toThrow("non-negative safe integer");
  });
});
