import { describe, expect, it } from "vitest";
import { parseSnapshotConvergenceArgs } from "./snapshotConvergence";

const devBase = [
  "--database-url", "mysql://user:pass@example.test/railway",
  "--app-id", "drape-local",
  "--user-id", "7",
  "--expected-model-count", "2",
];

describe("R7-7A bounded snapshot convergence ceremony", () => {
  it("requires a bounded cohort and an exact positive expected count", () => {
    expect(() => parseSnapshotConvergenceArgs([])).toThrow("--database-url is required");
    expect(() => parseSnapshotConvergenceArgs([
      "--database-url", "mysql://user:pass@example.test/railway",
      "--app-id", "drape-local",
      "--expected-model-count", "1",
    ])).toThrow("full-database convergence is refused");
    expect(() => parseSnapshotConvergenceArgs([
      "--database-url", "mysql://user:pass@example.test/railway",
      "--app-id", "drape-local",
      "--user-id", "7",
    ])).toThrow("--expected-model-count is required");
  });

  it("is read-only by default and deduplicates explicit model selectors", () => {
    expect(parseSnapshotConvergenceArgs([
      ...devBase,
      "--model-id", "9",
      "--model-id", "3",
      "--model-id", "9",
    ])).toMatchObject({
      userId: 7,
      modelIds: [3, 9],
      expectedModelCount: 2,
      apply: false,
      allowConvergenceWrite: false,
      allowProductionConvergence: false,
    });
  });

  it("requires explicit write authority and exact app, host and database confirmations for every apply", () => {
    expect(() => parseSnapshotConvergenceArgs([...devBase, "--apply"]))
      .toThrow("requires --allow-convergence-write");
    expect(() => parseSnapshotConvergenceArgs([
      ...devBase,
      "--apply",
      "--allow-convergence-write",
    ]))
      .toThrow("--confirm-app-id must exactly match");
    expect(() => parseSnapshotConvergenceArgs([
      ...devBase,
      "--apply",
      "--allow-convergence-write",
      "--confirm-app-id", "drape-local",
    ])).toThrow("--confirm-host must exactly match");
    expect(() => parseSnapshotConvergenceArgs([
      ...devBase,
      "--apply",
      "--allow-convergence-write",
      "--confirm-app-id", "drape-local",
      "--confirm-host", "example.test",
    ])).toThrow("--confirm-database must exactly match");
    expect(parseSnapshotConvergenceArgs([
      ...devBase,
      "--apply",
      "--allow-convergence-write",
      "--confirm-app-id", "drape-local",
      "--confirm-host", "example.test",
      "--confirm-database", "railway",
    ])).toMatchObject({
      apply: true,
      allowConvergenceWrite: true,
      confirmAppId: "drape-local",
      confirmHost: "example.test",
      confirmDatabase: "railway",
    });
  });

  it("separates production read-only planning from production writes", () => {
    const production = devBase.map((value) => (
      value === "drape-local" ? "drape-production" : value
    ));
    expect(() => parseSnapshotConvergenceArgs(production))
      .toThrow("requires --allow-production-read-only");
    expect(parseSnapshotConvergenceArgs([
      ...production,
      "--allow-production-read-only",
    ])).toMatchObject({ apply: false, allowProductionReadOnly: true });
    expect(() => parseSnapshotConvergenceArgs([
      ...production,
      "--apply",
      "--allow-convergence-write",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "example.test",
      "--confirm-database", "railway",
    ])).toThrow("requires --allow-production-convergence");
    expect(parseSnapshotConvergenceArgs([
      ...production,
      "--apply",
      "--allow-convergence-write",
      "--confirm-app-id", "drape-production",
      "--confirm-host", "example.test",
      "--confirm-database", "railway",
      "--allow-production-convergence",
    ])).toMatchObject({ apply: true, allowProductionConvergence: true });
  });

  it("rejects a convergence-only authorization flag in read-only mode", () => {
    expect(() => parseSnapshotConvergenceArgs([
      ...devBase,
      "--allow-production-convergence",
    ])).toThrow("valid only with --apply");
  });
});
