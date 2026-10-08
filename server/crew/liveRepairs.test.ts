/**
 * THE REPAIRS OWED ON HIS PAGE ARE THE MERGE TOOL'S REPAIRS OWED (#1984).
 *
 * ⚠ **THE ARM THAT MATTERS IS THE PARITY ARM, AND IT IS DRIVEN END TO END.** One
 * set of raw GitHub comments goes two ways: into `repairsOwedFrom`
 * (`scripts/lib/repairsOwed.mts`, the seat cut's reader) as `gh pr list` rows,
 * and through the page's real road — the card-activity reader over a faked
 * comment listing, the head reader over a faked pulls list, `deriveLiveDesk`,
 * and the client's summary. The two must name the same pull requests. The
 * negative control is the page WITHOUT head dates, which must reproduce the
 * defect the card measured: a reply under a finding makes the page forget it.
 */
import { describe, expect, it } from "vitest";

import { repairsOwedFrom, type RepairPullRequestRow } from "../../scripts/lib/repairsOwed.mts";
import { isHandFinding, isHandVerdict } from "../../shared/handVerdict";
import { crewRepairsOwed } from "../../client/src/features/admin/components/crew/crewRepairsOwed";
import { createCardActivityReader } from "./cardActivity";
import { deriveLiveDesk, headDatesFrom, liveHandReading } from "./liveDesk";
import type { LiveQueueItem, LiveQueueReading } from "./liveQueue";
import {
  createPullRequestHeadReader,
  exactHandReading,
  handReadingsFromFacts,
  headCommitRequest,
  LIVE_REPAIRS_OWNER,
  pullHeadsListRequest,
} from "./liveRepairs";

const OWNER = LIVE_REPAIRS_OWNER;
const REPO = "michaelpaulrattray/Drape";

type RawComment = { pr: number; login: string; at: string; body: string };

type FixturePr = {
  number: number;
  createdAt: string;
  head: string;
  headSha: string;
  labels?: string[];
  /** The newest thing that happened to it — a reply, a label, a push. */
  updatedAt: string;
};

const FINDING = (why: string) => `**Relay finding — HELD** (head abc1234) — ${why}\n\nThe body discusses it.`;
const VERDICT = "**Fable review — by hand** (head abc1234)\n\nRead it; one note, nothing held.";
const REPLY = "**Finding answered — seat-2**\n\nOn it; repair coming.";
const PUSHED = "**Repair pushed — seat-2**\n\nPushed the fix.";

/* The four pull requests the card measured, each in its real shape, plus the
   cases a looser rule would get wrong in the other direction. */
const PRS: FixturePr[] = [
  /* #1960 — a seat answered 31 seconds after the finding. */
  { number: 1960, createdAt: "2026-10-08T03:00:00Z", head: "2026-10-08T04:00:00Z", headSha: "sha1960", updatedAt: "2026-10-08T04:55:15Z" },
  /* #1974 — a reply five minutes later, then a label change. */
  { number: 1974, createdAt: "2026-10-08T05:00:00Z", head: "2026-10-08T06:00:00Z", headSha: "sha1974", labels: ["founder-review"], updatedAt: "2026-10-08T07:10:00Z" },
  /* #1924 — the OLD spelling, a verdict marker with FINDING in its header, and a reply the next morning. */
  { number: 1924, createdAt: "2026-10-07T20:00:00Z", head: "2026-10-07T22:00:00Z", headSha: "sha1924", updatedAt: "2026-10-08T06:24:19Z" },
  /* #1946 — two findings on one head, activity after both. */
  { number: 1946, createdAt: "2026-10-07T23:00:00Z", head: "2026-10-08T00:30:00Z", headSha: "sha1946", updatedAt: "2026-10-08T03:00:00Z" },
  /* A repair PUSHED after the finding — owed by nobody. */
  { number: 2001, createdAt: "2026-10-08T04:00:00Z", head: "2026-10-08T05:30:00Z", headSha: "sha2001", updatedAt: "2026-10-08T05:31:00Z" },
  /* A finding, then the relay's PASS on the same head, then a reply — passed. */
  { number: 2002, createdAt: "2026-10-08T01:00:00Z", head: "2026-10-08T02:00:00Z", headSha: "sha2002", updatedAt: "2026-10-08T03:40:00Z" },
  /* A pass, then the relay changed its mind — held. */
  { number: 2003, createdAt: "2026-10-08T01:00:00Z", head: "2026-10-08T02:00:00Z", headSha: "sha2003", updatedAt: "2026-10-08T03:20:00Z" },
  /* A "finding" by another account — nothing. */
  { number: 2004, createdAt: "2026-10-08T01:00:00Z", head: "2026-10-08T02:00:00Z", headSha: "sha2004", updatedAt: "2026-10-08T03:00:00Z" },
  /* No hand comment at all, review label — waiting for review. */
  { number: 2005, createdAt: "2026-10-08T01:00:00Z", head: "2026-10-08T02:00:00Z", headSha: "sha2005", labels: ["needs-fable"], updatedAt: "2026-10-08T02:00:00Z" },
];

const COMMENTS: RawComment[] = [
  { pr: 1960, login: OWNER, at: "2026-10-08T04:54:44Z", body: FINDING("the refund path double-counts") },
  { pr: 1960, login: OWNER, at: "2026-10-08T04:55:15Z", body: REPLY },
  { pr: 1974, login: OWNER, at: "2026-10-08T06:38:05Z", body: FINDING("the receipt names the wrong plan") },
  { pr: 1974, login: OWNER, at: "2026-10-08T06:43:42Z", body: REPLY },
  { pr: 1924, login: OWNER, at: "2026-10-07T23:53:37Z", body: "**Fable review — by hand, FINDING (head abc1234) — held; the export leaks an email**" },
  { pr: 1924, login: OWNER, at: "2026-10-08T06:24:19Z", body: REPLY },
  { pr: 1946, login: OWNER, at: "2026-10-08T01:37:16Z", body: FINDING("first") },
  { pr: 1946, login: OWNER, at: "2026-10-08T02:10:00Z", body: FINDING("second, same head") },
  { pr: 1946, login: OWNER, at: "2026-10-08T03:00:00Z", body: REPLY },
  { pr: 2001, login: OWNER, at: "2026-10-08T05:00:00Z", body: FINDING("fix the copy") },
  { pr: 2001, login: OWNER, at: "2026-10-08T05:31:00Z", body: PUSHED },
  { pr: 2002, login: OWNER, at: "2026-10-08T03:00:00Z", body: FINDING("tighten it") },
  { pr: 2002, login: OWNER, at: "2026-10-08T03:30:00Z", body: VERDICT },
  { pr: 2002, login: OWNER, at: "2026-10-08T03:40:00Z", body: REPLY },
  { pr: 2003, login: OWNER, at: "2026-10-08T03:00:00Z", body: VERDICT },
  { pr: 2003, login: OWNER, at: "2026-10-08T03:20:00Z", body: FINDING("changed my mind") },
  { pr: 2004, login: "someone-else", at: "2026-10-08T03:00:00Z", body: FINDING("not the relay") },
];

const READ_AT = "2026-10-08T07:30:00Z";

function queueItem(pr: FixturePr): LiveQueueItem {
  return {
    number: pr.number,
    title: `PR ${pr.number}`,
    kind: "pr",
    status: "open",
    draft: false,
    labels: pr.labels ?? [],
    author: OWNER,
    assignees: [],
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    closedAt: null,
    mergedAt: null,
    holdReason: null,
    testDrive: [],
    body: null,
    url: `https://github.com/${REPO}/pull/${pr.number}`,
  };
}

function queueReading(prs: readonly FixturePr[]): LiveQueueReading {
  return { readAt: READ_AT, open: prs.map(queueItem), recent: [], truncated: { open: false, recent: false } };
}

/** The `gh pr list` rows the seat cut reads — every comment, raw. */
function ghRows(prs: readonly FixturePr[], comments: readonly RawComment[]): RepairPullRequestRow[] {
  return prs.map((pr) => ({
    number: pr.number,
    title: `PR ${pr.number}`,
    createdAt: pr.createdAt,
    isDraft: false,
    headRefName: `team/${pr.number}`,
    commits: [{ committedDate: "2026-09-01T00:00:00Z" }, { committedDate: pr.head }],
    comments: comments
      .filter((c) => c.pr === pr.number)
      .map((c, index) => ({ id: `c${index}`, author: { login: c.login }, createdAt: c.at, body: c.body })),
  }));
}

type FakeRoute = (url: string) => { status: number; body: unknown };

function fakeFetch(route: FakeRoute, log: string[] = []) {
  return async (url: string) => {
    log.push(url);
    const { status, body } = route(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
}

/** The page's comment facts, through the REAL card-activity reader. */
async function factsThroughReader(comments: readonly RawComment[]) {
  const reader = createCardActivityReader({
    repo: REPO,
    now: () => Date.parse(READ_AT),
    token: () => undefined,
    fetch: fakeFetch(() => ({
      status: 200,
      body: [...comments]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((c) => ({
          issue_url: `https://api.github.com/repos/${REPO}/issues/${c.pr}`,
          user: { login: c.login },
          created_at: c.at,
          body: c.body,
        })),
    })),
  });
  const activity = await reader.read();
  if (!activity.available) throw new Error(`card activity unavailable: ${activity.why}`);
  return activity.facts;
}

/** The head dates, through the REAL head reader. */
async function headDatesThroughReader(prs: readonly FixturePr[], wanted: ReadonlySet<number>, log: string[] = []) {
  const reader = createPullRequestHeadReader({
    repo: REPO,
    now: () => Date.parse(READ_AT),
    token: () => undefined,
    fetch: fakeFetch((url) => {
      if (url === pullHeadsListRequest(REPO)) {
        return { status: 200, body: prs.map((pr) => ({ number: pr.number, head: { sha: pr.headSha } })) };
      }
      const pr = prs.find((p) => url === headCommitRequest(REPO, p.headSha));
      if (pr) return { status: 200, body: { sha: pr.headSha, committer: { date: pr.head } } };
      return { status: 404, body: {} };
    }, log),
  });
  const heads = await reader.read(wanted);
  if (!heads.available) throw new Error(`heads unavailable: ${heads.why}`);
  return headDatesFrom(heads.heads);
}

describe("his page names the same repairs the seat cut does (#1984)", () => {
  it("parity: the In flight rows and their summary name exactly repairsOwedFrom's pull requests", async () => {
    const facts = await factsThroughReader(COMMENTS);
    const spokenOn = new Set(facts.filter((f) => f.kind === "finding" || f.kind === "verdict").map((f) => f.card));
    const headDates = await headDatesThroughReader(PRS, spokenOn);

    const exact = repairsOwedFrom(ghRows(PRS, COMMENTS), OWNER).repairs.map((r) => r.pullRequest).sort((a, b) => a - b);
    /* Positive control on the fixture itself: the seat cut sees these five. */
    expect(exact).toEqual([1924, 1946, 1960, 1974, 2003].sort((a, b) => a - b));

    const desk = deriveLiveDesk(queueReading(PRS), [], { facts, why: null }, headDates);
    const held = desk.pullRequests.filter((row) => row.state === "finding").map((row) => row.number).sort((a, b) => a - b);
    expect(held).toEqual(exact);
    /* The summary beside the list counts the same rows. */
    expect(crewRepairsOwed(desk.pullRequests).count).toBe(exact.length);

    /* The other states read the same way the merge tool would. */
    const stateOf = (n: number) => desk.pullRequests.find((row) => row.number === n)?.state;
    expect(stateOf(2001)).toBe("gate");
    expect(stateOf(2002)).toBe("passed");
    expect(stateOf(2004)).toBe("gate");
    expect(stateOf(2005)).toBe("held");
  });

  it("negative control: WITHOUT head dates the page reproduces the measured defect — the replied-under findings vanish", async () => {
    const facts = await factsThroughReader(COMMENTS);
    const desk = deriveLiveDesk(queueReading(PRS), [], { facts, why: null });
    const held = desk.pullRequests.filter((row) => row.state === "finding").map((row) => row.number);
    for (const missed of [1924, 1946, 1960, 1974]) expect(held).not.toContain(missed);
    /* #2003's finding is the newest thing on it, so the old bound still saw it. */
    expect(held).toEqual([2003]);
  });

  it("the build phrases on the card rows read the same held state as the In flight rows", async () => {
    const facts = await factsThroughReader(COMMENTS);
    const headDates = await headDatesThroughReader(PRS, new Set(PRS.map((p) => p.number)));
    const cards: LiveQueueItem[] = [{
      ...queueItem(PRS[0]!), number: 1950, kind: "issue", title: "the refund card", url: `https://github.com/${REPO}/issues/1950`,
    }];
    const prs = PRS.map((pr) => (pr.number === 1960 ? { ...queueItem(pr), title: "fix(billing): refunds (Card: #1950)" } : queueItem(pr)));
    const reading: LiveQueueReading = { readAt: READ_AT, open: [...cards, ...prs], recent: [], truncated: { open: false, recent: false } };
    const withHeads = deriveLiveDesk(reading, [], { facts, why: null }, headDates).builds.items.find((v) => v.issueNumber === 1950);
    const without = deriveLiveDesk(reading, [], { facts, why: null }).builds.items.find((v) => v.issueNumber === 1950);
    expect(withHeads?.phrase).not.toEqual(without?.phrase);
    /* The relay's own words travel on the held phrase. */
    expect(withHeads?.phrase).toContain("refund path double-counts");
  });

  it("the row's clock and words are the finding it is held on", async () => {
    const facts = await factsThroughReader(COMMENTS);
    const headDates = await headDatesThroughReader(PRS, new Set(PRS.map((p) => p.number)));
    const item = queueItem(PRS.find((p) => p.number === 1946)!);
    const hand = liveHandReading(item, facts, headDates);
    expect(hand).toEqual({ handVerdict: "finding", note: "held — second, same head", flaggedAt: "2026-10-08T02:10:00Z" });
  });
});

describe("the reading handed to the merge tool's reader", () => {
  it("each fact goes back as a body the SAME predicates classify as what it is", () => {
    const readings = handReadingsFromFacts(7, [
      { kind: "finding", card: 7, at: "2026-10-08T01:00:00Z", note: null },
      { kind: "verdict", card: 7, at: "2026-10-08T02:00:00Z" },
      { kind: "claim", card: 7, seat: "s", at: "2026-10-08T03:00:00Z" },
      { kind: "finding", card: 8, at: "2026-10-08T01:00:00Z", note: null },
    ]);
    expect(readings.map((r) => [isHandFinding(r.body), isHandVerdict(r.body)])).toEqual([[true, false], [false, true]]);
    expect(readings.every((r) => r.authorLogin === OWNER)).toBe(true);
  });

  it("a finding before the head is a repair pushed; a reply after it changes nothing", () => {
    const facts = [{ kind: "finding" as const, card: 9, at: "2026-10-08T05:00:00Z", note: null }];
    expect(exactHandReading({ pullRequest: 9, createdAt: "2026-10-08T00:00:00Z", headCommittedAt: "2026-10-08T04:00:00Z", facts }).handVerdict).toBe("finding");
    expect(exactHandReading({ pullRequest: 9, createdAt: "2026-10-08T00:00:00Z", headCommittedAt: "2026-10-08T06:00:00Z", facts }).handVerdict).toBe("stale");
    expect(exactHandReading({ pullRequest: 9, createdAt: "2026-10-08T00:00:00Z", headCommittedAt: "2026-10-08T04:00:00Z", facts: [] }).handVerdict).toBe("none");
  });
});

describe("the head reader — what it sends and what it spends", () => {
  it("one list read, and a commit read only for the pull requests the relay spoke on; a sha is dated once", async () => {
    const log: string[] = [];
    let clock = Date.parse(READ_AT);
    const reader = createPullRequestHeadReader({
      repo: REPO,
      now: () => clock,
      token: () => undefined,
      fetch: fakeFetch((url) => {
        if (url === pullHeadsListRequest(REPO)) {
          return { status: 200, body: [{ number: 1, head: { sha: "aaa" } }, { number: 2, head: { sha: "bbb" } }] };
        }
        if (url === headCommitRequest(REPO, "aaa")) return { status: 200, body: { committer: { date: "2026-10-08T01:00:00Z" } } };
        return { status: 500, body: {} };
      }, log),
    });
    const first = await reader.read(new Set([1]));
    expect(log).toEqual([
      `https://api.github.com/repos/${REPO}/pulls?state=open&per_page=100&sort=updated&direction=desc`,
      `https://api.github.com/repos/${REPO}/git/commits/aaa`,
    ]);
    expect(first.available && first.heads).toEqual([
      { number: 1, headSha: "aaa", headCommittedAt: "2026-10-08T01:00:00Z" },
      { number: 2, headSha: "bbb", headCommittedAt: null },
    ]);
    /* Inside the TTL: nothing at all is asked again. */
    clock += 60_000;
    await reader.read(new Set([1]));
    expect(log).toHaveLength(2);
    /* Past the TTL: the list again, and the dated sha is NOT. */
    clock += 300_000;
    await reader.read(new Set([1]));
    expect(log).toHaveLength(3);
    expect(log[2]).toContain("/pulls?");
  });

  it("a refused list is `available: false` and says why; a refused commit leaves only that row undated", async () => {
    const refusing = createPullRequestHeadReader({
      repo: REPO, now: () => 0, token: () => undefined,
      fetch: fakeFetch(() => ({ status: 403, body: {} })),
    });
    expect(await refusing.read(new Set([1]))).toEqual({ available: false, why: "GitHub answered 403 (rate limited)" });

    const partly = createPullRequestHeadReader({
      repo: REPO, now: () => 0, token: () => undefined,
      fetch: fakeFetch((url) => (url.includes("/pulls?")
        ? { status: 200, body: [{ number: 1, head: { sha: "aaa" } }] }
        : { status: 403, body: {} })),
    });
    const heads = await partly.read(new Set([1]));
    expect(heads.available && heads.heads).toEqual([{ number: 1, headSha: "aaa", headCommittedAt: null }]);
    expect(heads.available && heads.stale).toBe(true);
  });
});
