/**
 * HOW OFTEN DOES THE PRE-DEPLOY TIME OUT? — #2501 step 2 ("Count it").
 *
 * The judging half of `scripts/predeploy-timeouts.mts`. That script is the door
 * to Railway's API and nothing else; every verdict about a deployment is made
 * here, by pure functions `server/predeployTimeouts.test.ts` drives.
 *
 * # Where the answer lives, read at the API rather than assumed
 *
 * `railway deployment list --json` carries `id`, `status`, `createdAt` and
 * `meta` — and NO failure stage. `Deployment.diagnosis` exists on the GraphQL
 * schema and read `null` for the very deployment #2501 was filed on
 * (`9b3ef98d`). What carries it is `deploymentEvents(id)`: one node per step,
 * and the failing step's `payload.error` holds Railway's own sentence —
 * `PRE_DEPLOY_COMMAND` · `"Pre-deploy command timed out after 600 seconds"`
 * for `9b3ef98d`, read 2026-10-14. So the population is the deployment list
 * and the verdict is that deployment's events.
 *
 * # A deployment with no readable events is NOT a deployment that did not time out
 *
 * It is `unread`, counted on its own line, and the summary refuses to call the
 * window clean while any FAILED deployment is unread. A reading that folds the
 * unreadable into the negative reports a floor as a total (working law 2).
 */

export const PRE_DEPLOY_STEP = "PRE_DEPLOY_COMMAND";

export type DeploymentEvent = {
  step: string;
  createdAt: string | null;
  completedAt: string | null;
  error: string | null;
};

export type ListedDeployment = {
  id: string;
  status: string;
  createdAt: string;
  commitHash: string | null;
};

export type Verdict =
  /** The pre-deploy step failed and Railway's sentence says it timed out. */
  | { kind: "predeploy-timeout"; error: string; heldSeconds: number | null }
  /** The pre-deploy step failed for some other stated reason. */
  | { kind: "predeploy-failed"; error: string }
  /** Another step carried the error. */
  | { kind: "failed-elsewhere"; step: string; error: string }
  /** Events were read and no step carried an error. */
  | { kind: "no-error" }
  /** No events could be read for this deployment. */
  | { kind: "unread" };

/** Railway's own wording: "Pre-deploy command timed out after 600 seconds". */
export function isTimeoutSentence(error: string): boolean {
  return /timed out/i.test(error);
}

function secondsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 1000);
}

/**
 * The verdict for one deployment from its events. `null` (or an empty list)
 * means the events could not be read and is `unread`, never `no-error`.
 */
export function judgeDeployment(events: DeploymentEvent[] | null): Verdict {
  if (!events || events.length === 0) return { kind: "unread" };
  const pre = events.find((e) => e.step === PRE_DEPLOY_STEP && e.error);
  if (pre && pre.error) {
    return isTimeoutSentence(pre.error)
      ? { kind: "predeploy-timeout", error: pre.error, heldSeconds: secondsBetween(pre.createdAt, pre.completedAt) }
      : { kind: "predeploy-failed", error: pre.error };
  }
  const other = events.find((e) => e.error);
  if (other && other.error) return { kind: "failed-elsewhere", step: other.step, error: other.error };
  return { kind: "no-error" };
}

/**
 * The `deploymentEvents` connection off the GraphQL response, flattened. Any
 * shape that is not the expected connection reads as `null` (unread) — never
 * as an empty list of events, which would also read as unread but for the
 * wrong reason being invisible.
 */
export function eventsFromConnection(connection: unknown): DeploymentEvent[] | null {
  const edges = (connection as { edges?: unknown } | null | undefined)?.edges;
  if (!Array.isArray(edges)) return null;
  const out: DeploymentEvent[] = [];
  for (const edge of edges) {
    const node = (edge as { node?: Record<string, unknown> } | null)?.node;
    if (!node || typeof node.step !== "string") continue;
    const payload = (node.payload ?? null) as Record<string, unknown> | null;
    out.push({
      step: node.step,
      createdAt: typeof node.createdAt === "string" ? node.createdAt : null,
      completedAt: typeof node.completedAt === "string" ? node.completedAt : null,
      error: payload && typeof payload.error === "string" && payload.error.length > 0 ? payload.error : null,
    });
  }
  return out;
}

export type Judged = ListedDeployment & {
  verdict: Verdict;
  /** Railway reached the pre-deploy step at all — the denominator a timeout rate is OF. */
  reachedPredeploy: boolean;
};

/** Did this deployment reach the pre-deploy step? A superseded build never does. */
export function reachedPredeploy(events: DeploymentEvent[] | null): boolean {
  return !!events && events.some((e) => e.step === PRE_DEPLOY_STEP);
}

export type Reading = {
  total: number;
  windowFrom: string | null;
  windowTo: string | null;
  byStatus: Record<string, number>;
  timeouts: Judged[];
  otherPredeployFailures: Judged[];
  failedElsewhere: Judged[];
  reachedPredeploy: number;
  /** FAILED or CRASHED deployments whose events could not be read. */
  unreadFailures: Judged[];
  unread: number;
};

export function summarize(judged: Judged[]): Reading {
  const byStatus: Record<string, number> = {};
  for (const d of judged) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
  const times = judged.map((d) => d.createdAt).filter((t) => Number.isFinite(Date.parse(t))).sort();
  const bad = (s: string) => s === "FAILED" || s === "CRASHED";
  return {
    total: judged.length,
    windowFrom: times[0] ?? null,
    windowTo: times[times.length - 1] ?? null,
    byStatus,
    timeouts: judged.filter((d) => d.verdict.kind === "predeploy-timeout"),
    otherPredeployFailures: judged.filter((d) => d.verdict.kind === "predeploy-failed"),
    failedElsewhere: judged.filter((d) => d.verdict.kind === "failed-elsewhere"),
    reachedPredeploy: judged.filter((d) => d.reachedPredeploy).length,
    unreadFailures: judged.filter((d) => d.verdict.kind === "unread" && bad(d.status)),
    unread: judged.filter((d) => d.verdict.kind === "unread").length,
  };
}

/** The reading as plain lines. Counts, dates, ids and short commits only. */
export function renderReading(reading: Reading, service: string, truncated = false): string {
  const lines: string[] = [];
  const day = (iso: string | null) => (iso ? iso.replace(/:\d\d\.\d+Z$/, "Z").replace("T", " ") : "?");
  lines.push(`Pre-deploy timeouts on service ${service}`);
  lines.push(`  window: ${day(reading.windowFrom)} → ${day(reading.windowTo)} (by deployment createdAt, UTC)`);
  lines.push(`  deployments in the window: ${reading.total}`);
  const statuses = Object.entries(reading.byStatus).sort((a, b) => b[1] - a[1]);
  lines.push(`  by status: ${statuses.map(([s, n]) => `${s} ${n}`).join(", ") || "none"}`);
  if (truncated) lines.push("  ⚠ the --limit was reached: older deployments exist and were not read");
  lines.push(`  of which reached the pre-deploy step: ${reading.reachedPredeploy}`);
  lines.push(`  pre-deploy TIMED OUT: ${reading.timeouts.length}`);
  for (const d of reading.timeouts) {
    const v = d.verdict as Extract<Verdict, { kind: "predeploy-timeout" }>;
    lines.push(
      `    ${day(d.createdAt)}  ${d.id.slice(0, 8)}  ${d.commitHash ? d.commitHash.slice(0, 9) : "no-commit"}  ` +
        `held ${v.heldSeconds ?? "?"}s  "${v.error}"`,
    );
  }
  lines.push(`  pre-deploy failed for another reason: ${reading.otherPredeployFailures.length}`);
  for (const d of reading.otherPredeployFailures) {
    const v = d.verdict as Extract<Verdict, { kind: "predeploy-failed" }>;
    lines.push(`    ${day(d.createdAt)}  ${d.id.slice(0, 8)}  ${d.status}  "${v.error}"`);
  }
  const elsewhere: Record<string, number> = {};
  for (const d of reading.failedElsewhere) {
    const step = (d.verdict as Extract<Verdict, { kind: "failed-elsewhere" }>).step;
    elsewhere[step] = (elsewhere[step] ?? 0) + 1;
  }
  const steps = Object.entries(elsewhere).map(([s, n]) => `${s} ${n}`).join(", ");
  lines.push(`  failed at another step: ${reading.failedElsewhere.length}${steps ? ` (${steps})` : ""}`);
  lines.push(`  deployments whose events could not be read: ${reading.unread}`);
  if (reading.unreadFailures.length > 0) {
    lines.push(
      `  ⚠ ${reading.unreadFailures.length} FAILED/CRASHED deployment(s) are unread, so the timeout count is a FLOOR, not a total:`,
    );
    for (const d of reading.unreadFailures) lines.push(`    ${day(d.createdAt)}  ${d.id.slice(0, 8)}  ${d.status}`);
  }
  return lines.join("\n");
}

/**
 * The reading is READ-ONLY by construction, not by intention: the one function
 * that sends a GraphQL document refuses any document that is not a plain
 * query. The token this script borrows is the CLI's own and can redeploy,
 * change variables and delete services, so the refusal sits at the wire.
 */
export function isReadOnlyDocument(document: string): boolean {
  const body = document.replace(/#[^\n]*/g, "").trim();
  if (/\b(mutation|subscription)\b/i.test(body)) return false;
  return body.startsWith("{") || /^query\b/.test(body);
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * The ONE sender. Refuses a non-query document before `fetchImpl` is called,
 * and its errors carry the API's message and never the headers (the token).
 */
export function makeQuery(fetchImpl: FetchLike, endpoint: string, token: () => string) {
  return async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    if (!isReadOnlyDocument(document)) throw new Error("refusing to send a GraphQL document that is not a plain query");
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
      body: JSON.stringify({ query: document, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: Array<{ message?: string }> };
    if (json.errors?.length) throw new Error(`Railway API: ${json.errors.map((e) => e.message).join("; ")}`);
    if (!res.ok || !json.data) throw new Error(`Railway API answered ${res.status} with no data`);
    return json.data;
  };
}

type Named = { id: string; name: string };
type ProjectNode = {
  id: string;
  name: string;
  services: Named[];
  environments: Named[];
};

/**
 * Picks the one project/environment/service by NAME out of the workspaces
 * listing. Zero or several matches at any level is a refusal naming what was
 * there — never a guess, because the same CLI token also reaches the dev
 * project and another product.
 */
export function pickTarget(
  projects: ProjectNode[],
  want: { project: string; environment: string; service: string },
): { projectId: string; environmentId: string; serviceId: string } {
  const one = <T extends Named>(list: T[], name: string, what: string): T => {
    const hits = list.filter((x) => x.name === name);
    if (hits.length !== 1) {
      throw new Error(
        `expected exactly one ${what} named "${name}", found ${hits.length} (have: ${list.map((x) => x.name).join(", ") || "none"})`,
      );
    }
    return hits[0];
  };
  const project = one(projects, want.project, "project");
  return {
    projectId: project.id,
    environmentId: one(project.environments, want.environment, "environment").id,
    serviceId: one(project.services, want.service, "service").id,
  };
}

/** The `me { workspaces { projects … } }` response, flattened to ProjectNodes. */
export function projectsFromMe(data: unknown): ProjectNode[] {
  const workspaces = (data as { me?: { workspaces?: unknown } } | null)?.me?.workspaces;
  if (!Array.isArray(workspaces)) return [];
  const nodes = (conn: unknown): Record<string, unknown>[] => {
    const edges = (conn as { edges?: unknown } | null)?.edges;
    return Array.isArray(edges)
      ? edges.map((e) => (e as { node?: Record<string, unknown> })?.node).filter((n): n is Record<string, unknown> => !!n)
      : [];
  };
  const named = (n: Record<string, unknown>): Named | null =>
    typeof n.id === "string" && typeof n.name === "string" ? { id: n.id, name: n.name } : null;
  const out: ProjectNode[] = [];
  for (const ws of workspaces) {
    for (const p of nodes((ws as { projects?: unknown })?.projects)) {
      const base = named(p);
      if (!base) continue;
      out.push({
        ...base,
        services: nodes(p.services).map(named).filter((x): x is Named => !!x),
        environments: nodes(p.environments).map(named).filter((x): x is Named => !!x),
      });
    }
  }
  return out;
}
