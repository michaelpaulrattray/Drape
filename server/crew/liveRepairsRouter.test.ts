/**
 * THE HEAD DATES REACH HIS PAGE THROUGH THE REAL ROUTER (#1984).
 *
 * `liveRepairs.test.ts` proves the reading; this proves the WIRE — that
 * `crew.getState` asks the head reader for exactly the pull requests the relay
 * spoke on and hands its answer to `deriveLiveDesk`. A reader nothing calls is a
 * control that does not exist (invariant 7), and the measured case is the one
 * driven: a finding with a seat's reply under it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "../_core/context";

vi.mock("../db/crewReplies", () => ({
  listCrewReplies: vi.fn(async () => []),
  insertCrewReply: vi.fn(async () => { throw new Error("not in this suite"); }),
}));

vi.mock("../crew/liveQueue", () => ({
  LIVE_QUEUE_REPO: "michaelpaulrattray/Drape",
  readLiveQueue: vi.fn(async () => ({
    available: true,
    stale: false,
    readAt: "2026-10-08T07:30:00Z",
    truncated: { open: false, recent: false },
    open: [{
      number: 1960, title: "fix(billing): refunds", kind: "pr", status: "open", draft: false,
      labels: ["founder-review"], author: "michaelpaulrattray", assignees: [],
      /* The seat's reply, 31 seconds after the finding, is the newest thing here. */
      createdAt: "2026-10-08T03:00:00Z", updatedAt: "2026-10-08T04:55:15Z", closedAt: null, mergedAt: null,
      holdReason: null, testDrive: [], body: null, url: "https://github.com/michaelpaulrattray/Drape/pull/1960",
    }],
    recent: [],
  })),
}));

vi.mock("../crew/cardActivity", () => ({
  readCardActivity: vi.fn(async () => ({
    available: true,
    stale: false,
    why: null,
    readAt: "2026-10-08T07:30:00Z",
    facts: [{ kind: "finding", card: 1960, at: "2026-10-08T04:54:44Z", note: null }],
  })),
}));

const headCalls: number[][] = [];
let headAnswer: { available: true; stale: false; why: null; heads: { number: number; headSha: string; headCommittedAt: string | null }[] }
  | { available: false; why: string } = { available: false, why: "unset" };

vi.mock("../crew/liveRepairs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./liveRepairs")>();
  return {
    ...actual,
    readPullRequestHeads: vi.fn(async (wanted: ReadonlySet<number>) => {
      headCalls.push(Array.from(wanted).sort((a, b) => a - b));
      return headAnswer;
    }),
  };
});

import { crewRouter } from "../routes/crew";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function contextFor(): TrpcContext {
  const user = {
    id: 1, openId: "admin-open-id", email: "admin@drape.ai", name: "Admin User", displayName: null,
    role: "admin", approved: true, suspendedAt: null, lockedUntil: null, createdAt: new Date(), updatedAt: new Date(),
  } as AuthenticatedUser;
  return { user, correlationId: "test-1984", req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const previousScope = process.env.CREW_TAB_SCOPE;
beforeEach(() => {
  headCalls.length = 0;
  process.env.CREW_TAB_SCOPE = "all";
});
afterEach(() => {
  if (previousScope === undefined) delete process.env.CREW_TAB_SCOPE;
  else process.env.CREW_TAB_SCOPE = previousScope;
});

async function stateOf1960(): Promise<string | undefined> {
  const state = await crewRouter.createCaller(contextFor()).getState();
  if (!state.live.available) throw new Error("live desk unavailable");
  return state.live.desk.pullRequests.find((row) => row.number === 1960)?.state;
}

describe("crew.getState reads the head and holds the replied-under finding (#1984)", () => {
  it("with the head dated, the finding holds the row despite the reply", async () => {
    headAnswer = {
      available: true, stale: false, why: null,
      heads: [{ number: 1960, headSha: "sha", headCommittedAt: "2026-10-08T04:00:00Z" }],
    };
    expect(await stateOf1960()).toBe("finding");
    expect(headCalls).toEqual([[1960]]);
  });

  it("control: with the head reader unanswered, the row falls back to the old reading — and loses it", async () => {
    headAnswer = { available: false, why: "GitHub answered 403 (rate limited)" };
    expect(await stateOf1960()).toBe("held");
  });
});
