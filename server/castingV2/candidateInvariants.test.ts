import { describe, expect, it, vi } from "vitest";

/**
 * The tripwire for a state the candidate laws forbid.
 *
 * Two rows turned up on dev both `signed` to a living Cast and `expired` — a
 * combination no writer can produce, since every writer of `expired` guards
 * `signedCastId IS NULL` inside the statement that writes. They were traced to
 * an intermediate build during a day of rapid iteration.
 *
 * "It cannot happen any more" without a tripwire is how it happens again
 * quietly, so the invariant gets a standing check rather than a memory.
 */

const rows = { count: 0 };

vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [{ n: rows.count }],
        }),
      }),
    }),
  }),
}));

const errors: string[] = [];
vi.mock("../logging/logger", () => ({
  createModuleLogger: () => ({
    error: (_fields: unknown, message: string) => errors.push(message),
    warn: () => undefined,
    info: () => undefined,
  }),
}));

const { checkCandidateInvariants } = await import("./candidateInvariants");

describe("no signed candidate is ever expired", () => {
  it("reports clean when the laws hold", async () => {
    rows.count = 0;
    errors.length = 0;

    const report = await checkCandidateInvariants();

    expect(report).toEqual({ expiredWhileSigned: 0, ok: true });
    expect(errors).toEqual([]);
  });

  it("alarms in the roll alarm's shape when it does not", async () => {
    /*
      Error, not warn, and worded as "stop and look at the plumbing" rather than
      "something was wrong with this Cast" — the same shape the provider-account
      alarm takes, for the same reason: no user action fixes it and nothing on
      the product surface shows it.
    */
    rows.count = 2;
    errors.length = 0;

    const report = await checkCandidateInvariants();

    expect(report).toEqual({ expiredWhileSigned: 2, ok: false });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("FORBIDDEN STATE");
  });

  it("repairs nothing", async () => {
    /*
      Deliberately inert. A row in a forbidden state is EVIDENCE, and a check
      that silently tidied it away would destroy the only trace of whatever
      wrote it — which is the one thing anybody investigating would need.
    */
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./candidateInvariants.ts", import.meta.url), "utf8"));
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
  });

  it("runs before the sweep writes, never after", async () => {
    /*
      The sweep's own work is what turns candidates into `expired`. Checking
      afterwards would be checking our own output, and a guard lost inside the
      sweep would be reported as a pre-existing condition.
    */
    const sweep = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./candidateRetention.ts", import.meta.url), "utf8"));
    const body = sweep.slice(sweep.indexOf("export async function runCandidateRetentionSweep"));
    expect(body.indexOf("checkCandidateInvariants"))
      .toBeLessThan(body.indexOf("expireSessionCandidates("));
  });
});
