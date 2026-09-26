/**
 * ONE GH TRANSPORT FOR THE QUEUE READS — REST first for the shape GitHub's
 * burst limiter refuses, GraphQL for everything else (#1399).
 *
 * # WHAT WAS BROKEN
 *
 * For four days running, `gh`'s GraphQL calls were refused for hours at a time
 * **with the account's GraphQL quota 99% unused** — measured on 2026-09-26:
 * 48 of 5,000 points spent, every GraphQL call refused. That is GitHub's
 * SECONDARY (burst) limiter, and it answers with the PRIMARY limiter's error
 * text (`API rate limit already exceeded`), which is exactly why four shifts
 * read it as *"we ran out of quota"* and waited.
 *
 * ⚠ **AND THE FOUNDER'S OWN RE-MEASUREMENT FORTY MINUTES LATER NARROWED IT TO
 * THE LIST SHAPE, WHICH IS WHY THIS MODULE TRANSLATES ONE COMMAND AND NOT ALL
 * OF THEM** (#1399, his comment):
 *
 * | call | at 11:15Z | at 11:55Z |
 * |---|---|---|
 * | `gh issue view N --json …` | refused | **works** |
 * | `gh pr view N --json …` | refused | **works** |
 * | `gh pr checks N` | refused | **works** |
 * | the open-issue LIST read | refused | **still refused** |
 *
 * So the refused shape is the list, and the list is what moves. Everything else
 * passes straight through — which is the card's own second condition:
 * *"Fall back, do not switch blindly. REST is a different quota (`core`,
 * 5,000/hr) and a shift that hammers it will exhaust the primary limit, which is
 * a real outage rather than a burst."*
 *
 * # WHAT IT COST, AND WHY A LIB RATHER THAN FIVE EDITS
 *
 * `crew-desk-sweep.mts` skipped **all eight of its blocks** — NEXT UP, the
 * ladder, two pipeline rows, two eye items, two needs-you rows — so his page
 * silently kept the previous day's running order. Measured that night: it showed
 * `[1278, 1240]` where the live band was `[1278, 1373, 1394, 55, 180, 509]`.
 * That is the failure #290/#291/#292 were written to end, arriving through a
 * door none of them could see.
 *
 * The card names the shape of the repair and the reason: *"`pr-merge-in-order`
 * and `crew-desk-sweep` each have their own [`gh` helper] today, which is
 * working law 4's shape: two copies that will not both get fixed."*
 *
 * # ⚠ IT IS A TRANSPORT, NOT A READER — THAT IS THE WHOLE DESIGN DECISION
 *
 * Every caller keeps its own `JSON.parse`, its own `--limit` floor refusal, its
 * own empty-answer cross-examination and its own field reads. **Nothing about
 * what a caller BELIEVES moves; only the wire under it does.** The alternative —
 * a new rows-returning reader each site calls — was declined, and the card's own
 * footnote is why:
 *
 * > *"The first draft built rows with `labels`/`number` where `OrderedBandRow`
 * > wants `urgent`/`issueNumber`, so `urgent` was `undefined` on every row, the
 * > comparator's urgent limb could not fire, and all three of his urgent cards
 * > sorted LAST — the exact defect #718 was filed about, reintroduced by a
 * > CALLER rather than by the comparator."*
 *
 * A transport cannot make that mistake, because it hands back the same field
 * names the caller already reads. `planNextUpItems` stays the one thing that
 * ranks the band, reached the way it always was.
 *
 * # ⚠ A REFUSED READ IS STILL NEVER AN EMPTY ANSWER
 *
 * The card's first condition, and it is preserved by construction rather than
 * re-implemented: REST answering is a list, REST failing falls back to GraphQL,
 * and **both failing THROWS**, exactly as a bare `gh` call does today. So every
 * caller's existing *"could not be read — the block is left as it was"* path
 * fires on the same road it always did. This module never returns `[]` for a
 * failure and never can: an empty list is only ever produced by a `gh` that
 * answered.
 *
 * That property is load-bearing beyond one page: an empty NEXT UP is one of the
 * two conditions that PARKS THE TEAM on the short road (#504).
 *
 * # WHAT IT REFUSES TO TRANSLATE, AND IT FAILS CLOSED
 *
 * `parseIssueListArgs` returns `null` — pass through to `gh` untouched — for any
 * argv it cannot answer FAITHFULLY: a flag it does not know, a `--json` field
 * REST does not carry, a `--search` (a different endpoint with different
 * semantics), a `--jq`/`--template` of its own. An unrecognised shape keeps
 * today's behaviour, which is the direction a translation layer must fail in.
 *
 * # HOW THE CAP KEEPS MEANING WHAT IT MEANT
 *
 * Callers use `rows.length >= limit` as *"that is a floor, not a list"*. So the
 * REST road truncates to the same `--limit`: `--paginate` walks until a short
 * page and the answer is then sliced, so the floor refusal fires on exactly the
 * populations it fired on before. A `--limit` far above the population costs the
 * population, not the limit.
 */

/** What `gh issue list` was asked for, reduced to what REST can answer. */
export type IssueListRequest = {
  /** `OPEN` / `CLOSED` / `ALL`, normalised — REST spells these lowercase. */
  state: "open" | "closed" | "all";
  /** Every `--label`, in the order given. REST's `labels=` is AND, as `gh`'s is. */
  labels: string[];
  /** `--limit`, and the truncation point of the answer. */
  limit: number;
  /** The `--json` fields, already checked against `REST_FIELDS`. */
  fields: string[];
};

/**
 * THE FIELDS THIS TRANSPORT CAN ANSWER, mapped `gh --json name` → REST name.
 *
 * ⚠ It is an ALLOWLIST and that is the fail-closed half: a caller asking for
 * `author`, `assignees`, `milestone`, `comments` or `stateReason` gets the
 * GraphQL road untouched rather than a row quietly missing a field. Adding one
 * means checking REST actually carries it, which is a reading, not a rename.
 */
export const REST_FIELDS: Readonly<Record<string, string>> = {
  number: "number",
  title: "title",
  body: "body",
  state: "state",
  createdAt: "created_at",
  updatedAt: "updated_at",
  closedAt: "closed_at",
  labels: "labels",
  url: "html_url",
};

/** Every flag of `gh issue list` this transport understands. Anything else → pass through. */
const KNOWN_FLAGS = new Set(["--state", "--label", "--limit", "--json"]);

/**
 * Is this argv a queue LIST read this transport can answer over REST?
 *
 * `null` means *hand it to `gh` exactly as it came* — the safe direction, and
 * the answer for every `gh` command that is not an issue listing.
 */
export function parseIssueListArgs(args: readonly string[]): IssueListRequest | null {
  if (args.length < 2) return null;
  if (args[0] !== "issue") return null;
  if (args[1] !== "list") return null;

  let state: IssueListRequest["state"] = "open";
  const labels: string[] = [];
  let limit: number | null = null;
  let fields: string[] | null = null;

  for (let i = 2; i < args.length; i += 1) {
    const flag = args[i];
    /* A positional argument to a listing is a search term in `gh`. Not ours. */
    if (!flag.startsWith("-")) return null;
    if (!KNOWN_FLAGS.has(flag)) return null;
    const value = args[i + 1];
    if (value === undefined) return null;
    i += 1;
    if (flag === "--state") {
      const lowered = value.toLowerCase();
      if (lowered !== "open" && lowered !== "closed" && lowered !== "all") return null;
      state = lowered;
    } else if (flag === "--label") {
      labels.push(value);
    } else if (flag === "--limit") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) return null;
      limit = parsed;
    } else {
      /* `--json` with no field is `gh`'s own error, not a shape to guess at. */
      const requested = value.split(",").map((name) => name.trim()).filter((name) => name !== "");
      if (requested.length === 0) return null;
      if (requested.some((name) => REST_FIELDS[name] === undefined)) return null;
      fields = requested;
    }
  }

  /* Without `--json` the answer is `gh`'s own table, not JSON — and every caller
     here parses JSON. Without `--limit` `gh` caps at 30, which is a floor nobody
     declared; refusing both is narrower than inventing a default. */
  if (fields === null || limit === null) return null;
  return { state, labels, limit, fields };
}

/** REST's page size: its own ceiling, or the caller's cap when that is smaller. */
export function restPageSize(limit: number): number {
  return Math.min(100, Math.max(1, limit));
}

/** The REST path for a request — `:owner/:repo`, which `gh api` resolves itself. */
export function restIssuesPath(request: IssueListRequest): string {
  const query = new URLSearchParams();
  query.set("state", request.state);
  if (request.labels.length > 0) query.set("labels", request.labels.join(","));
  query.set("per_page", String(restPageSize(request.limit)));
  /* Stated rather than inherited: `gh issue list` answers newest-first and so
     does this endpoint by default, but a default that moved would silently
     re-order his running order. */
  query.set("sort", "created");
  query.set("direction", "desc");
  return `repos/:owner/:repo/issues?${query.toString()}`;
}

/**
 * The `--jq` that projects one line of JSON per issue.
 *
 * Only the requested fields ride, plus `isPullRequest` — the REST issues
 * endpoint returns pull requests AS issues, and a PR is not a card.
 */
export function restJqProjection(fields: readonly string[]): string {
  const parts = fields.map((name) => {
    if (name === "labels") return "labels: [.labels[] | {name}]";
    const restName = REST_FIELDS[name];
    return restName === name ? name : `${name}: .${restName}`;
  });
  parts.push('isPullRequest: (has("pull_request"))');
  return `.[] | {${parts.join(", ")}} | @json`;
}

/**
 * One projected REST row → the row shape `gh issue list --json` hands back, or
 * `null` when it is not a card.
 *
 * ⚠ **THE PULL-REQUEST FILTER IS HERE AS WELL AS IN THE JQ**, because the jq
 * side cannot be driven without a network and this side can. It is the card's
 * own first footnote: *"the REST issues endpoint returns PRs as issues; a
 * `pull_request` key present means the row is not a card."*
 *
 * ⚠ **AND `state` IS RE-CASED.** REST answers `open`, GraphQL answers `OPEN`,
 * and a caller comparing against `"OPEN"` would read every open card as
 * unreadable. That is the one field whose VALUE differs between the two roads
 * rather than only its name.
 */
export function listRowFromRest(raw: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.isPullRequest === true) return null;
  const out: Record<string, unknown> = {};
  for (const name of fields) {
    const value = row[name];
    if (name === "state") {
      out.state = typeof value === "string" ? value.toUpperCase() : value;
      continue;
    }
    /* `body` is `null` on an issue filed with none; `gh --json body` says "". */
    if (name === "body") {
      out.body = typeof value === "string" ? value : "";
      continue;
    }
    out[name] = value ?? null;
  }
  return out;
}

/**
 * Is this refusal the rate limiter — primary quota or secondary burst?
 *
 * ⚠ **THE TWO ARE INDISTINGUISHABLE IN THE TEXT AND THAT IS THE WHOLE FINDING**:
 * the burst limiter answers with the primary limiter's sentence, so four shifts
 * read *"API rate limit already exceeded"* as an exhausted quota and waited while
 * 4,952 of 5,000 points sat unspent. Callers use this to say *"this is a burst,
 * not an outage"* rather than to decide anything about a card.
 */
export function isRateLimitRefusal(text: string): boolean {
  const lowered = text.toLowerCase();
  return lowered.includes("rate limit")
    || lowered.includes("abuse detection")
    || lowered.includes("submitted too quickly");
}

/** Which road a reading took, for the line the card asks every caller to print. */
export type QueueRoad = "rest" | "graphql";

/** `execFileSync`-shaped, so the arms can drive every branch with no network. */
export type GhExec = (args: readonly string[], options?: { readonly maxBuffer?: number }) => string;

export type GhTransport = {
  /** The drop-in `gh` wrapper: same argv in, same JSON text out. */
  run: GhExec;
  /** Which road each translated list read took, in order — for a receipt line. */
  roads: ReadonlyArray<{ road: QueueRoad; rows: number; why: string }>;
};

/**
 * THE TRANSPORT. `run` is a drop-in for a caller's own `gh` helper.
 *
 * - a queue list read it can answer  → REST, falling back to GraphQL
 * - anything else                    → straight through, untouched
 * - both roads refused               → THROWS, exactly as `gh` does today
 *
 * `note` receives one line per translated read naming the road, because the card
 * asks for it out loud: *"say in the output which road a reading took."*
 */
export function makeGhTransport(options: {
  exec: GhExec;
  note?: (line: string) => void;
}): GhTransport {
  const { exec } = options;
  const note = options.note ?? ((line: string) => console.error(line));
  const roads: Array<{ road: QueueRoad; rows: number; why: string }> = [];

  const describe = (request: IssueListRequest): string => {
    const label = request.labels.length > 0 ? ` label=${request.labels.join("+")}` : "";
    return `issue list (${request.state}${label})`;
  };

  const run: GhExec = (args, execOptions) => {
    const request = parseIssueListArgs(args);
    if (request === null) return exec(args, execOptions);

    const restArgs = ["api", restIssuesPath(request), "--jq", restJqProjection(request.fields)];
    /* `--paginate` only when one page cannot hold the cap: an extra flag on a
       single-page read is a second request nobody asked for. */
    if (request.limit > restPageSize(request.limit)) restArgs.splice(1, 0, "--paginate");

    let restRefusal: string | null = null;
    try {
      const out = exec(restArgs, execOptions);
      const rows: Array<Record<string, unknown>> = [];
      for (const line of out.split(/\r?\n/)) {
        if (line.trim() === "") continue;
        const row = listRowFromRest(JSON.parse(line), request.fields);
        if (row !== null) rows.push(row);
        if (rows.length >= request.limit) break;
      }
      roads.push({ road: "rest", rows: rows.length, why: describe(request) });
      note(`[gh] ${describe(request)} → REST, ${rows.length} row(s)`);
      return JSON.stringify(rows);
    } catch (cause) {
      restRefusal = (cause as Error).message ?? String(cause);
    }

    /*
      ⚠ FALL BACK, NEVER GIVE UP. REST failing is not a verdict about the queue
      either: a token without `repo` scope, a `jq` that is not installed, a repo
      that cannot be resolved. GraphQL answers all three, and when GraphQL is the
      thing that is down this re-raises — which is the caller's existing
      unreadable path, unchanged.
    */
    const burst = isRateLimitRefusal(restRefusal);
    note(
      `[gh] ${describe(request)} → REST refused (${burst ? "rate limited" : "see below"}), falling back to GraphQL`
      + `\n      ${restRefusal.split(/\r?\n/)[0]}`,
    );
    const out = exec(args, execOptions);
    let count = -1;
    try {
      const parsed = JSON.parse(out);
      if (Array.isArray(parsed)) count = parsed.length;
    } catch {
      /* Not our parse to make — hand the text back and let the caller refuse it. */
    }
    roads.push({ road: "graphql", rows: count, why: describe(request) });
    note(`[gh] ${describe(request)} → GraphQL, ${count < 0 ? "unparsed" : `${count} row(s)`}`);
    return out;
  };

  return { run, roads };
}
