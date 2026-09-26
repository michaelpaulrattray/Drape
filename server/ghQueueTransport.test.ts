import { describe, expect, it } from "vitest";

import {
  type GhExec,
  type IssueListRequest,
  REST_FIELDS,
  isRateLimitRefusal,
  listRowFromRest,
  makeGhTransport,
  parseIssueListArgs,
  restIssuesPath,
  restJqProjection,
  restPageSize,
} from "../scripts/lib/ghQueueTransport.mts";

/**
 * THE REST-FIRST QUEUE TRANSPORT (#1399).
 *
 * # What it is the guard for
 *
 * GitHub's SECONDARY (burst) limiter refused `gh`'s GraphQL calls for hours a day
 * for four days running **with the GraphQL quota 99% unused** — 48 of 5,000
 * points spent — and answered with the PRIMARY limiter's sentence, so four shifts
 * read it as an exhausted quota and waited. The desk sweep skipped all eight of
 * its blocks and his page silently kept the previous day's running order.
 *
 * # ⚠ EVERY ARM DRIVES THE TRANSPORT, NOT A DESCRIPTION OF IT
 *
 * `makeGhTransport` takes its `exec` as an argument for exactly this reason: the
 * arms below hand it a fake that answers, refuses, or refuses twice, and assert
 * on the ARGV it was given and the text it handed back. Nothing here reaches a
 * network, a token or the live queue — and the three failure branches are
 * unreachable from a real tree, which is the shape working law 2 is about.
 *
 * # ⚠ THE ARM THAT MATTERS MOST IS THE LAST ONE
 *
 * A refused read must never read as an EMPTY answer: an empty NEXT UP is one of
 * the two conditions that parks the team on the short road (#504). So the
 * both-roads-down arm asserts a THROW rather than `[]`, which is the property
 * every caller's "the block is left as it was" path depends on.
 */

/** A fake `gh` that records its argv and answers from a queue of replies. */
function fakeGh(replies: Array<string | Error>): { exec: GhExec; calls: string[][] } {
  const calls: string[][] = [];
  let i = 0;
  const exec: GhExec = (args) => {
    calls.push([...args]);
    const reply = replies[i];
    i += 1;
    if (reply === undefined) throw new Error(`fake gh: no reply queued for call ${i}`);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { exec, calls };
}

/** One REST row as the projection emits it, before `listRowFromRest`. */
function restLine(row: Record<string, unknown>): string {
  return JSON.stringify(row);
}

const OPEN_BAND = [
  "issue", "list",
  "--label", "founder-ordered",
  "--state", "open",
  "--limit", "200",
  "--json", "number,title,labels,body,createdAt",
];

describe("which argv it will translate — and it fails CLOSED", () => {
  it("translates the ordered-band read the desk sweep makes", () => {
    const request = parseIssueListArgs(OPEN_BAND);
    expect(request).toEqual<IssueListRequest>({
      state: "open",
      labels: ["founder-ordered"],
      limit: 200,
      fields: ["number", "title", "labels", "body", "createdAt"],
    });
  });

  it("translates the whole-open-queue read the escalation gate makes", () => {
    expect(parseIssueListArgs([
      "issue", "list", "--state", "open", "--limit", "200",
      "--json", "number,title,labels,createdAt",
    ])).toEqual<IssueListRequest>({
      state: "open",
      labels: ["founder-ordered"].slice(0, 0),
      limit: 200,
      fields: ["number", "title", "labels", "createdAt"],
    });
  });

  it("translates the per-label count the switch panel draws from", () => {
    const request = parseIssueListArgs([
      "issue", "list", "--state", "open", "--label", "bug", "--limit", "500",
      "--json", "number,title,createdAt,updatedAt,labels",
    ]);
    expect(request?.labels).toEqual(["bug"]);
    expect(request?.limit).toBe(500);
  });

  it("⚠ passes a `gh` command that is not an issue listing straight through", () => {
    expect(parseIssueListArgs(["pr", "view", "1399", "--json", "state"])).toBeNull();
    expect(parseIssueListArgs(["issue", "view", "1399", "--json", "state"])).toBeNull();
    expect(parseIssueListArgs(["api", "repos/:owner/:repo"])).toBeNull();
    expect(parseIssueListArgs(["issue"])).toBeNull();
  });

  it("⚠ refuses a flag it does not know rather than dropping it", () => {
    /* `--assignee` would silently widen the answer to every open card. */
    expect(parseIssueListArgs([
      "issue", "list", "--state", "open", "--assignee", "@me", "--limit", "50", "--json", "number",
    ])).toBeNull();
  });

  it("⚠ refuses a `--search`, which is a different endpoint with different semantics", () => {
    /* The oldest-open-card read (`crewQueueCount.mts`) is exactly this shape. */
    expect(parseIssueListArgs([
      "issue", "list", "--state", "open", "--limit", "1",
      "--search", "sort:created-asc", "--json", "number,createdAt",
    ])).toBeNull();
  });

  it("⚠ refuses a `--json` field REST does not carry — the allowlist is the fail-closed half", () => {
    for (const field of ["author", "assignees", "milestone", "comments", "stateReason"]) {
      expect(REST_FIELDS[field], `${field} must not be in the allowlist`).toBeUndefined();
      expect(parseIssueListArgs([
        "issue", "list", "--state", "open", "--limit", "50", "--json", `number,${field}`,
      ]), `${field} must pass through`).toBeNull();
    }
  });

  it("⚠ refuses a listing with no `--json` or no `--limit`", () => {
    /* No `--json` is `gh`'s own table, which no caller here parses; no `--limit`
       is `gh`'s undeclared cap of 30, and a floor nobody stated is worse than a
       pass-through. */
    expect(parseIssueListArgs(["issue", "list", "--state", "open", "--limit", "50"])).toBeNull();
    expect(parseIssueListArgs(["issue", "list", "--state", "open", "--json", "number"])).toBeNull();
  });

  it("⚠ refuses a flag whose value is missing, and a nonsense --limit", () => {
    expect(parseIssueListArgs(["issue", "list", "--state"])).toBeNull();
    expect(parseIssueListArgs(["issue", "list", "--limit", "0", "--json", "number"])).toBeNull();
    expect(parseIssueListArgs(["issue", "list", "--limit", "ten", "--json", "number"])).toBeNull();
    expect(parseIssueListArgs(["issue", "list", "--state", "draft", "--limit", "5", "--json", "number"])).toBeNull();
  });

  it("⚠ refuses a positional argument — in `gh` that is a search term", () => {
    expect(parseIssueListArgs([
      "issue", "list", "burst limit", "--state", "open", "--limit", "50", "--json", "number",
    ])).toBeNull();
  });
});

describe("the REST request it builds", () => {
  const request = parseIssueListArgs(OPEN_BAND)!;

  it("names the state, the labels and the page size, and states the sort", () => {
    const path = restIssuesPath(request);
    expect(path).toContain("repos/:owner/:repo/issues?");
    expect(path).toContain("state=open");
    expect(path).toContain("labels=founder-ordered");
    expect(path).toContain("per_page=100");
    /* Stated rather than inherited: both roads answer newest-first today, and a
       default that moved would silently re-order his running order. */
    expect(path).toContain("sort=created");
    expect(path).toContain("direction=desc");
  });

  it("joins several labels the way `gh`'s repeated --label does — AND, not OR", () => {
    const two = parseIssueListArgs([
      "issue", "list", "--state", "open", "--label", "bug", "--label", "urgent",
      "--limit", "50", "--json", "number",
    ])!;
    expect(restIssuesPath(two)).toContain("labels=bug%2Curgent");
  });

  it("omits `labels` entirely for a whole-queue read", () => {
    const all = parseIssueListArgs(["issue", "list", "--state", "open", "--limit", "200", "--json", "number"])!;
    expect(restIssuesPath(all)).not.toContain("labels=");
  });

  it("takes the caller's cap as the page size when it is under REST's ceiling", () => {
    expect(restPageSize(200)).toBe(100);
    expect(restPageSize(30)).toBe(30);
    expect(restPageSize(1)).toBe(1);
  });

  it("projects only the requested fields, plus the pull-request flag", () => {
    const jq = restJqProjection(request.fields);
    expect(jq).toContain("createdAt: .created_at");
    expect(jq).toContain("labels: [.labels[] | {name}]");
    expect(jq).toContain("number");
    expect(jq).toContain('isPullRequest: (has("pull_request"))');
    /* A field nobody asked for is a body nobody needed over the wire. */
    expect(jq).not.toContain("updated_at");
  });
});

describe("one REST row → the row shape `gh issue list --json` hands back", () => {
  const fields = ["number", "title", "labels", "body", "createdAt", "state"];

  it("keeps the `gh` field names, so a caller's reads do not move", () => {
    const row = listRowFromRest({
      number: 1399,
      title: "the burst limit",
      labels: [{ name: "bug" }],
      body: "a body",
      createdAt: "2026-09-26T11:00:00Z",
      state: "open",
      isPullRequest: false,
    }, fields);
    expect(row).toEqual({
      number: 1399,
      title: "the burst limit",
      labels: [{ name: "bug" }],
      body: "a body",
      createdAt: "2026-09-26T11:00:00Z",
      state: "OPEN",
    });
  });

  it("⚠ drops a pull request — the REST issues endpoint returns PRs as issues", () => {
    expect(listRowFromRest({ number: 1400, title: "a PR", isPullRequest: true }, ["number", "title"]))
      .toBeNull();
  });

  it("⚠ upper-cases `state`, the one field whose VALUE differs between the roads", () => {
    expect(listRowFromRest({ state: "closed", isPullRequest: false }, ["state"])).toEqual({ state: "CLOSED" });
    expect(listRowFromRest({ state: "open", isPullRequest: false }, ["state"])).toEqual({ state: "OPEN" });
  });

  it("answers `\"\"` for a body REST reports as null, the way `gh --json body` does", () => {
    expect(listRowFromRest({ body: null, isPullRequest: false }, ["body"])).toEqual({ body: "" });
  });

  it("answers null for a row that is not an object at all", () => {
    expect(listRowFromRest(null, ["number"])).toBeNull();
    expect(listRowFromRest("1399", ["number"])).toBeNull();
  });
});

describe("the rate-limit reading — and it cannot tell primary from burst, on purpose", () => {
  it("recognises the sentence the burst limiter borrows from the primary one", () => {
    expect(isRateLimitRefusal("GraphQL: API rate limit already exceeded")).toBe(true);
    expect(isRateLimitRefusal("API rate limit exceeded for user ID 1234")).toBe(true);
    expect(isRateLimitRefusal("You have exceeded a secondary rate limit")).toBe(true);
    expect(isRateLimitRefusal("You have triggered an abuse detection mechanism")).toBe(true);
    expect(isRateLimitRefusal("were submitted too quickly")).toBe(true);
  });

  it("⚠ does not fire on an ordinary refusal — a false positive would hide a real fault", () => {
    expect(isRateLimitRefusal("could not resolve to a Repository")).toBe(false);
    expect(isRateLimitRefusal("gh: Not Found (HTTP 404)")).toBe(false);
    expect(isRateLimitRefusal("authentication required")).toBe(false);
    expect(isRateLimitRefusal("")).toBe(false);
  });
});

describe("the transport, driven end to end", () => {
  const RATE_LIMITED = new Error("GraphQL: API rate limit already exceeded (rate limit)");

  it("takes the REST road and hands back the `gh issue list` shape", () => {
    const notes: string[] = [];
    const { exec, calls } = fakeGh([
      [
        restLine({ number: 1278, title: "signed views", labels: [{ name: "bug" }], isPullRequest: false }),
        restLine({ number: 1400, title: "a pull request", labels: [], isPullRequest: true }),
        restLine({ number: 55, title: "the honest loader", labels: [{ name: "debt" }], isPullRequest: false }),
      ].join("\n"),
    ]);
    const transport = makeGhTransport({ exec, note: (line) => notes.push(line) });

    const out = transport.run(["issue", "list", "--state", "open", "--limit", "200", "--json", "number,title,labels"]);

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("api");
    expect(JSON.parse(out)).toEqual([
      { number: 1278, title: "signed views", labels: [{ name: "bug" }] },
      { number: 55, title: "the honest loader", labels: [{ name: "debt" }] },
    ]);
    expect(transport.roads).toEqual([{ road: "rest", rows: 2, why: "issue list (open)" }]);
    /* The card asks for the road out loud: "say in the output which road a
       reading took." */
    expect(notes.join("\n")).toContain("→ REST, 2 row(s)");
  });

  it("⚠ adds `--paginate` only when one page cannot hold the cap", () => {
    const capped = fakeGh([""]);
    makeGhTransport({ exec: capped.exec, note: () => {} })
      .run(["issue", "list", "--state", "open", "--limit", "200", "--json", "number"]);
    expect(capped.calls[0]).toContain("--paginate");

    const single = fakeGh([""]);
    makeGhTransport({ exec: single.exec, note: () => {} })
      .run(["issue", "list", "--state", "open", "--limit", "50", "--json", "number"]);
    expect(single.calls[0]).not.toContain("--paginate");
  });

  it("⚠ truncates to `--limit`, so a caller's floor refusal means what it meant", () => {
    /* `crew-desk-sweep`, `next-up-escalation` and `countOpen` all read
       `rows.length >= limit` as "that is a floor, not a list". REST with
       `--paginate` can answer MORE than the cap, and an untruncated answer would
       silently disarm all three. */
    const rows = Array.from({ length: 7 }, (_, i) =>
      restLine({ number: i + 1, isPullRequest: false }));
    const { exec } = fakeGh([rows.join("\n")]);
    const out = makeGhTransport({ exec, note: () => {} })
      .run(["issue", "list", "--state", "open", "--limit", "3", "--json", "number"]);
    expect(JSON.parse(out)).toHaveLength(3);
  });

  it("passes a non-list `gh` command through with its argv untouched", () => {
    const { exec, calls } = fakeGh(['{"state":"OPEN"}']);
    const transport = makeGhTransport({ exec, note: () => {} });
    const out = transport.run(["issue", "view", "1399", "--json", "state"]);
    expect(calls).toEqual([["issue", "view", "1399", "--json", "state"]]);
    expect(out).toBe('{"state":"OPEN"}');
    /* Nothing was translated, so nothing is claimed about a road. */
    expect(transport.roads).toEqual([]);
  });

  it("falls back to GraphQL when REST refuses, and names both roads", () => {
    const notes: string[] = [];
    const { exec, calls } = fakeGh([
      new Error("gh: jq is not installed"),
      JSON.stringify([{ number: 1399, title: "the burst limit", labels: [] }]),
    ]);
    const transport = makeGhTransport({ exec, note: (line) => notes.push(line) });

    const out = transport.run(["issue", "list", "--state", "open", "--limit", "50", "--json", "number,title,labels"]);

    expect(calls[0][0]).toBe("api");
    expect(calls[1]).toEqual(["issue", "list", "--state", "open", "--limit", "50", "--json", "number,title,labels"]);
    expect(JSON.parse(out)).toHaveLength(1);
    expect(transport.roads).toEqual([{ road: "graphql", rows: 1, why: "issue list (open)" }]);
    expect(notes.join("\n")).toContain("REST refused");
    expect(notes.join("\n")).toContain("→ GraphQL, 1 row(s)");
  });

  it("says `rate limited` when REST is the thing that was burst-limited", () => {
    const notes: string[] = [];
    const { exec } = fakeGh([RATE_LIMITED, "[]"]);
    makeGhTransport({ exec, note: (line) => notes.push(line) })
      .run(["issue", "list", "--state", "open", "--limit", "50", "--json", "number"]);
    expect(notes.join("\n")).toContain("REST refused (rate limited)");
  });

  it("⚠ THROWS when BOTH roads are refused — it never answers `[]` for a failure", () => {
    /* THE ARM THIS SUITE EXISTS FOR. Every caller reads a throw as "could not be
       read — leave the block as it was"; an empty list is a VERDICT, and an empty
       NEXT UP is one of the two conditions that parks the team (#504). */
    const { exec, calls } = fakeGh([RATE_LIMITED, RATE_LIMITED]);
    const transport = makeGhTransport({ exec, note: () => {} });
    expect(() => transport.run(["issue", "list", "--state", "open", "--limit", "50", "--json", "number"]))
      .toThrow(/rate limit/i);
    /* Both roads were genuinely tried — a throw from the first call alone would
       pass this arm while never falling back at all. */
    expect(calls).toHaveLength(2);
    expect(transport.roads).toEqual([]);
  });

  it("hands unparsed GraphQL text back for the caller to refuse, rather than inventing rows", () => {
    const { exec } = fakeGh([new Error("rest down"), "not json at all"]);
    const transport = makeGhTransport({ exec, note: () => {} });
    expect(transport.run(["issue", "list", "--state", "open", "--limit", "50", "--json", "number"]))
      .toBe("not json at all");
    expect(transport.roads).toEqual([{ road: "graphql", rows: -1, why: "issue list (open)" }]);
  });

  it("names the label in the road line, so two reads in one run are tellable apart", () => {
    const notes: string[] = [];
    const { exec } = fakeGh(["", ""]);
    const transport = makeGhTransport({ exec, note: (line) => notes.push(line) });
    transport.run(["issue", "list", "--state", "open", "--limit", "50", "--json", "number"]);
    transport.run([
      "issue", "list", "--label", "founder-ordered", "--state", "open", "--limit", "50", "--json", "number",
    ]);
    expect(transport.roads.map((r) => r.why)).toEqual([
      "issue list (open)",
      "issue list (open label=founder-ordered)",
    ]);
    expect(notes.join("\n")).toContain("label=founder-ordered");
  });
});
