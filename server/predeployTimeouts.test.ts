/**
 * #2501 step 2 — the judging half of `scripts/predeploy-timeouts.mts`.
 *
 * The positive control is the real event list Railway returned for
 * `9b3ef98d` (the deployment #2501 was filed on), read 2026-10-14 and copied
 * here step for step with only the error-free payload fields dropped.
 */
import { describe, expect, it } from "vitest";

import {
  eventsFromConnection,
  isReadOnlyDocument,
  judgeDeployment,
  makeQuery,
  pickTarget,
  projectsFromMe,
  reachedPredeploy,
  renderReading,
  summarize,
  type FetchLike,
  type Judged,
} from "../scripts/lib/predeployTimeouts.mts";

const node = (step: string, createdAt: string, completedAt: string, error: string | null = null) => ({
  node: { step, createdAt, completedAt, payload: { attempt: null, detail: null, durationMs: null, error, maxAttempts: null, reason: null, skipped: null } },
});

/** `deploymentEvents(id: "9b3ef98d-…")`, as Railway answered it. */
const TIMED_OUT = {
  edges: [
    node("SNAPSHOT_CODE", "2026-10-14T15:04:49.906Z", "2026-10-14T15:08:39.413Z"),
    node("BUILD_IMAGE", "2026-10-14T15:04:57.759Z", "2026-10-14T15:08:39.416Z"),
    node("PUBLISH_IMAGE", "2026-10-14T15:08:39.423Z", "2026-10-14T15:08:39.351Z"),
    node("PRE_DEPLOY_COMMAND", "2026-10-14T15:08:41.421Z", "2026-10-14T15:18:52.320Z", "Pre-deploy command timed out after 600 seconds"),
  ],
};

const SUCCEEDED = {
  edges: [
    node("BUILD_IMAGE", "2026-10-14T16:00:00.000Z", "2026-10-14T16:03:00.000Z"),
    node("PRE_DEPLOY_COMMAND", "2026-10-14T16:03:02.000Z", "2026-10-14T16:03:04.000Z"),
    node("HEALTHCHECK", "2026-10-14T16:03:05.000Z", "2026-10-14T16:03:20.000Z"),
  ],
};

const SUPERSEDED = { edges: [node("SNAPSHOT_CODE", "2026-10-14T16:00:00.000Z", "2026-10-14T16:00:10.000Z")] };

describe("judgeDeployment — the verdict off one deployment's events", () => {
  it("POSITIVE: the real 9b3ef98d events read as a pre-deploy timeout held 611 s", () => {
    const verdict = judgeDeployment(eventsFromConnection(TIMED_OUT));
    expect(verdict).toEqual({
      kind: "predeploy-timeout",
      error: "Pre-deploy command timed out after 600 seconds",
      heldSeconds: 611,
    });
  });

  it("NEGATIVE: a pre-deploy that FAILED (not timed out) is not counted as a timeout", () => {
    const failed = { edges: [node("PRE_DEPLOY_COMMAND", "2026-09-30T07:40:00Z", "2026-09-30T07:40:05Z", "Pre-deploy command failed")] };
    expect(judgeDeployment(eventsFromConnection(failed))).toEqual({ kind: "predeploy-failed", error: "Pre-deploy command failed" });
  });

  it("NEGATIVE: a clean deployment is no-error, and an error at another step is named by its step", () => {
    expect(judgeDeployment(eventsFromConnection(SUCCEEDED))).toEqual({ kind: "no-error" });
    const build = { edges: [node("BUILD_IMAGE", "2026-09-30T07:40:00Z", "2026-09-30T07:41:00Z", "Build failed")] };
    expect(judgeDeployment(eventsFromConnection(build))).toEqual({ kind: "failed-elsewhere", step: "BUILD_IMAGE", error: "Build failed" });
  });

  it("an unreadable or empty event list is UNREAD — never folded into no-error", () => {
    expect(judgeDeployment(eventsFromConnection(undefined))).toEqual({ kind: "unread" });
    expect(judgeDeployment(eventsFromConnection({ nope: 1 }))).toEqual({ kind: "unread" });
    expect(judgeDeployment(eventsFromConnection({ edges: [] }))).toEqual({ kind: "unread" });
  });

  it("reachedPredeploy is the denominator: a superseded build never reached the step", () => {
    expect(reachedPredeploy(eventsFromConnection(TIMED_OUT))).toBe(true);
    expect(reachedPredeploy(eventsFromConnection(SUCCEEDED))).toBe(true);
    expect(reachedPredeploy(eventsFromConnection(SUPERSEDED))).toBe(false);
    expect(reachedPredeploy(null)).toBe(false);
  });
});

describe("summarize / renderReading", () => {
  const row = (id: string, status: string, createdAt: string, events: unknown): Judged => {
    const parsed = eventsFromConnection(events);
    return { id, status, createdAt, commitHash: "74dfca76587dc857f12ccc9c3c1c47fe0920600e", verdict: judgeDeployment(parsed), reachedPredeploy: reachedPredeploy(parsed) };
  };

  it("counts timeouts against the total and the pre-deploy denominator, with dates", () => {
    const reading = summarize([
      row("9b3ef98d-1ba5", "FAILED", "2026-10-14T15:04:42.499Z", TIMED_OUT),
      row("3c34fa8a-0000", "SUCCESS", "2026-10-14T15:30:00.000Z", SUCCEEDED),
      row("aaaaaaaa-0000", "REMOVED", "2026-10-13T10:00:00.000Z", SUPERSEDED),
    ]);
    expect(reading.total).toBe(3);
    expect(reading.reachedPredeploy).toBe(2);
    expect(reading.timeouts.map((d) => d.id)).toEqual(["9b3ef98d-1ba5"]);
    expect(reading.windowFrom).toBe("2026-10-13T10:00:00.000Z");
    expect(reading.windowTo).toBe("2026-10-14T15:30:00.000Z");
    const text = renderReading(reading, "Drape");
    expect(text).toContain("pre-deploy TIMED OUT: 1");
    expect(text).toContain("2026-10-14 15:04Z  9b3ef98d  74dfca765  held 611s");
    expect(text).not.toContain("FLOOR");
  });

  it("an unread FAILED deployment turns the count into a stated floor", () => {
    const text = renderReading(summarize([row("bbbbbbbb-0000", "FAILED", "2026-10-01T00:00:00Z", null)]), "Drape");
    expect(text).toContain("pre-deploy TIMED OUT: 0");
    expect(text).toContain("FLOOR, not a total");
  });

  it("a reading cut short by --limit says so", () => {
    expect(renderReading(summarize([]), "Drape", true)).toContain("the --limit was reached");
    expect(renderReading(summarize([]), "Drape", false)).not.toContain("the --limit was reached");
  });
});

describe("read-only at the wire", () => {
  it("isReadOnlyDocument admits queries and refuses mutations and subscriptions", () => {
    expect(isReadOnlyDocument("{ me { id } }")).toBe(true);
    expect(isReadOnlyDocument("query ($a: String) { deployment(id: $a) { id } }")).toBe(true);
    expect(isReadOnlyDocument("mutation { deploymentRedeploy(id: \"x\") { id } }")).toBe(false);
    expect(isReadOnlyDocument("query { me { id } } mutation { variableUpsert(input: {}) }")).toBe(false);
    expect(isReadOnlyDocument("subscription { deploymentLogs(deploymentId: \"x\") { message } }")).toBe(false);
    expect(isReadOnlyDocument("")).toBe(false);
  });

  it("makeQuery never calls fetch for a mutation, and sends a query once", async () => {
    const sent: string[] = [];
    const fakeFetch: FetchLike = async (_url, init) => {
      sent.push(init.body);
      return { ok: true, status: 200, json: async () => ({ data: { me: { id: "u" } } }) };
    };
    const query = makeQuery(fakeFetch, "https://example.invalid/graphql", () => "SECRET-TOKEN");
    await expect(query("mutation { serviceInstanceRedeploy(serviceId: \"s\", environmentId: \"e\") }")).rejects.toThrow(/not a plain query/);
    expect(sent).toHaveLength(0);
    await expect(query("{ me { id } }")).resolves.toEqual({ me: { id: "u" } });
    expect(sent).toHaveLength(1);
  });

  it("an API error surfaces the API's message and never the token", async () => {
    const fakeFetch: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ errors: [{ message: "Not Authorized" }] }) });
    const query = makeQuery(fakeFetch, "https://example.invalid/graphql", () => "SECRET-TOKEN");
    const err = await query("{ me { id } }").catch((e: Error) => e);
    expect((err as Error).message).toContain("Not Authorized");
    expect((err as Error).message).not.toContain("SECRET-TOKEN");
  });
});

describe("pickTarget — by name, exactly one, or refuse", () => {
  const me = {
    me: {
      workspaces: [
        {
          projects: {
            edges: [
              { node: { id: "p1", name: "drape-production", services: { edges: [{ node: { id: "s1", name: "Drape" } }, { node: { id: "s2", name: "MySQL" } }] }, environments: { edges: [{ node: { id: "e1", name: "production" } }] } } },
              { node: { id: "p2", name: "drape-dev", services: { edges: [{ node: { id: "s3", name: "MySQL" } }] }, environments: { edges: [{ node: { id: "e2", name: "production" } }] } } },
            ],
          },
        },
      ],
    },
  };

  it("resolves the production Drape service", () => {
    expect(pickTarget(projectsFromMe(me), { project: "drape-production", environment: "production", service: "Drape" })).toEqual({
      projectId: "p1",
      environmentId: "e1",
      serviceId: "s1",
    });
  });

  it("refuses a missing service and names what is there", () => {
    expect(() => pickTarget(projectsFromMe(me), { project: "drape-dev", environment: "production", service: "Drape" })).toThrow(
      /exactly one service named "Drape", found 0 \(have: MySQL\)/,
    );
  });

  it("refuses an empty listing rather than guessing", () => {
    expect(() => pickTarget(projectsFromMe({}), { project: "drape-production", environment: "production", service: "Drape" })).toThrow(/found 0/);
  });
});
