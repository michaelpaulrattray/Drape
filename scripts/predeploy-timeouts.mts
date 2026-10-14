/**
 * HOW OFTEN DOES THE PRE-DEPLOY TIME OUT? — #2501 step 2 ("Count it").
 *
 * Lists the Drape service's recent Railway deployments and counts those whose
 * pre-deploy command timed out, with dates, beside the total in the same
 * window. Every verdict is made in `scripts/lib/predeployTimeouts.mts`, driven
 * by `server/predeployTimeouts.test.ts`; this file is the door to the API.
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
  judgeDeployment,
  reachedPredeploy,
  pickTarget,
  projectsFromMe,
  renderReading,
  summarize,
  type FetchLike,
  type Judged,
  type ListedDeployment,
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
  console.log(renderReading(summarize(judged), want.service, rows.length >= limit));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`predeploy-timeouts: ${(err as Error).message}`);
    process.exit(1);
  },
);
