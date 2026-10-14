/**
 * HOW OFTEN DOES THE PRE-DEPLOY TIME OUT, AND WHAT DID EACH ONE SAY?
 * — #2501 steps 2 ("Count it") and 3 ("Then diagnose").
 *
 * Lists the Drape service's recent Railway deployments and counts those whose
 * pre-deploy command timed out, with dates, beside the total in the same
 * window — and prints each timeout's OWN DEPLOY LOG under its row. Every
 * verdict is made in `scripts/lib/predeployTimeouts.mts`, driven by
 * `server/predeployTimeouts.test.ts`; this file is the door to the API.
 *
 * ⚠ **THE LOG IS WHY STEP 3 LIVES HERE.** Railway holds a deployment's log
 * about thirty days (measured 2026-10-14, a sharp edge at 2026-09-13/14), and
 * the watchdog's diagnosis — the one line that will ever name what held the
 * process — is printed nowhere else. One of the three timeouts step 2 found is
 * already past that wall. See the lib header's step 3 section; an empty log is
 * never reported as a silent container without a same-day control saying so.
 *
 * # READ-ONLY, at the wire
 *
 * It sends GraphQL QUERIES and nothing else — `isReadOnlyDocument` refuses any
 * other document before `fetch` is called. It never redeploys, never reads or
 * writes a variable, never touches the database. The token is the Railway
 * CLI's own (`~/.railway/config.json` → `user.accessToken`, or
 * `RAILWAY_API_TOKEN` when set) and it is never printed: errors print the
 * API's message, never the request headers.
 *
 * # Run
 *
 *     npx tsx scripts/predeploy-timeouts.mts [--limit 200] [--project drape-production]
 *                                            [--environment production] [--service Drape]
 *
 * Plain, NOT under `railway run` — nothing here needs an injected variable.
 */
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  eventsFromConnection,
  makeQuery,
  judgeDeployLog,
  judgeDeployment,
  logLinesFromResponse,
  reachedPredeploy,
  pickTarget,
  projectsFromMe,
  renderReading,
  summarize,
  type FetchLike,
  type Judged,
  type ListedDeployment,
  type LogControl,
  type LogLine,
} from "./lib/predeployTimeouts.mts";

const ENDPOINT = "https://backboard.railway.com/graphql/v2";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function token(): string {
  const fromEnv = process.env.RAILWAY_API_TOKEN;
  if (fromEnv) return fromEnv;
  const file = path.join(os.homedir(), ".railway", "config.json");
  let parsed: { user?: { accessToken?: unknown } };
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`no Railway credential: set RAILWAY_API_TOKEN or log the CLI in (${file} unreadable)`);
  }
  const t = parsed.user?.accessToken;
  if (typeof t !== "string" || t.length === 0) throw new Error(`no user.accessToken in ${file} — run railway login`);
  return t;
}

const query = makeQuery(fetch as unknown as FetchLike, ENDPOINT, token);

const PROJECTS = `query {
  me { workspaces { projects { edges { node {
    id name
    services { edges { node { id name } } }
    environments { edges { node { id name } } }
  } } } } }
}`;

const DEPLOYMENTS = `query ($input: DeploymentListInput!, $first: Int!, $after: String) {
  deployments(input: $input, first: $first, after: $after) {
    edges { node { id status createdAt meta } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const EVENTS_FIELDS = "edges { node { step createdAt completedAt payload { error } } }";

async function listDeployments(
  ids: { projectId: string; environmentId: string; serviceId: string },
  limit: number,
): Promise<ListedDeployment[]> {
  const out: ListedDeployment[] = [];
  let after: string | null = null;
  while (out.length < limit) {
    type Page = {
      deployments: {
        edges: Array<{ node: { id: string; status: string; createdAt: string; meta: { commitHash?: unknown } | null } }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
    const page: Page = await query<Page>(DEPLOYMENTS, {
      input: ids,
      first: Math.min(50, limit - out.length),
      after,
    });
    for (const { node } of page.deployments.edges) {
      const hash = node.meta && typeof node.meta.commitHash === "string" ? node.meta.commitHash : null;
      out.push({ id: node.id, status: node.status, createdAt: node.createdAt, commitHash: hash });
    }
    if (!page.deployments.pageInfo.hasNextPage) break;
    after = page.deployments.pageInfo.endCursor;
  }
  return out;
}

async function judgeAll(rows: ListedDeployment[]): Promise<Judged[]> {
  const judged: Judged[] = [];
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20);
    const document =
      "query {\n" +
      batch.map((d, k) => `  d${k}: deploymentEvents(id: ${JSON.stringify(d.id)}, first: 50) { ${EVENTS_FIELDS} }`).join("\n") +
      "\n}";
    let data: Record<string, unknown> = {};
    try {
      data = await query<Record<string, unknown>>(document);
    } catch (err) {
      console.error(`  (events for ${batch.length} deployments unreadable: ${(err as Error).message})`);
    }
    batch.forEach((d, k) => {
      const events = eventsFromConnection(data[`d${k}`]);
      judged.push({ ...d, verdict: judgeDeployment(events), reachedPredeploy: reachedPredeploy(events) });
    });
  }
  return judged;
}

/**
 * ONE DEPLOYMENT'S LOG. `null` on any failure — the judging half decides what
 * an empty answer and an unreadable one each mean, and this returns the
 * API's own message with it so a refusal is diagnosable.
 */
async function readLog(id: string): Promise<{ lines: LogLine[] | null; why: string }> {
  try {
    const data = await query<Record<string, unknown>>(
      `query { l: deploymentLogs(deploymentId: ${JSON.stringify(id)}, limit: 500) { timestamp message } }`,
    );
    return { lines: logLinesFromResponse(data.l), why: "the API answered a shape this cannot read" };
  } catch (err) {
    return { lines: null, why: (err as Error).message };
  }
}

/** How many same-day controls to try. See `judgeDeployLog`: one with lines settles it. */
const CONTROLS_PER_TIMEOUT = 3;

/**
 * STEP 3 — THE WORDS, FETCHED ONLY FOR A TIMEOUT.
 *
 * Three rows in 1,430, so the cost is three queries plus their controls rather
 * than one per deployment. The controls are other deployments from the SAME DAY
 * that reached the pre-deploy step, which is a fact `judgeAll` already read —
 * no second events query — and they are what tells an aged-out log from a
 * container that printed nothing. The subject itself is never its own control.
 */
async function attachLogs(judged: Judged[]): Promise<void> {
  const dayOf = (iso: string) => iso.slice(0, 10);
  for (const row of judged) {
    if (row.verdict.kind !== "predeploy-timeout") continue;
    const subject = await readLog(row.id);
    const controls: LogControl[] = [];
    if (subject.lines !== null && subject.lines.length === 0) {
      const candidates = judged.filter(
        (other) => other.id !== row.id && other.reachedPredeploy && dayOf(other.createdAt) === dayOf(row.createdAt),
      );
      for (const candidate of candidates.slice(0, CONTROLS_PER_TIMEOUT)) {
        controls.push({ id: candidate.id, lines: (await readLog(candidate.id)).lines });
        /* One control with lines proves the day readable; stop asking. */
        if (controls[controls.length - 1]!.lines?.length) break;
      }
    }
    row.log = judgeDeployLog(subject.lines, controls, subject.why);
  }
}

async function main(): Promise<void> {
  const want = {
    project: arg("project", "drape-production"),
    environment: arg("environment", "production"),
    service: arg("service", "Drape"),
  };
  const limit = Number.parseInt(arg("limit", "200"), 10);
  if (!Number.isFinite(limit) || limit <= 0) throw new Error("--limit must be a positive number");
  const ids = pickTarget(projectsFromMe(await query(PROJECTS)), want);
  const rows = await listDeployments(ids, limit);
  const judged = await judgeAll(rows);
  await attachLogs(judged);
  console.log(renderReading(summarize(judged), want.service, rows.length >= limit));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`predeploy-timeouts: ${(err as Error).message}`);
    process.exit(1);
  },
);
