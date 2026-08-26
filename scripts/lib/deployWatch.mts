/**
 * WHICH DEPLOYMENT IS *MINE*?
 *
 * The ceremony watches `railway deployment list` until the newest row reaches a
 * terminal state. That is not enough, and the hole cost a false receipt on
 * 2026-08-19: the push landed, Railway had not created the deployment yet, and
 * the newest row was the PREVIOUS deploy — already SUCCESS. The rite printed
 *
 *     deployment 0ea3207c → SUCCESS after 2s
 *
 * for a commit that was not built for another seven minutes. Every line under
 * it — health, uptime anchor, the flags — was read off the OLD process and was
 * true of it, which is what makes this class dangerous: nothing in the receipt
 * looks wrong.
 *
 * The rite's header already records a "watched claim" incident, repaired by
 * parsing one line as a line. This is the same claim by a different route:
 * the row was parsed correctly and belonged to somebody else. **A deployment is
 * mine only if it did not exist before I pushed.**
 *
 * ⚠ AND THAT RULE ALONE WAS NOT ENOUGH EITHER — the second incident ran the
 * other way (2026-08-26, #148). The rite was invoked as
 * `railway run --service MySQL -- npx tsx scripts/deploy-rite.mts`, and
 * `railway run` injects `RAILWAY_SERVICE_ID` for the service it was given. An
 * unscoped `railway deployment list` honours that variable over the linked
 * service, so the rite read MYSQL's deployment list — one row, SUCCESS since
 * July, never changing — before the push and on every tick after it. "Same id
 * as before the push" was TRUE of that row forever; the watch said `not-mine`
 * for ten minutes while Railway's API held the real deployment SUCCESS on the
 * pushed commit. Driven, not guessed: the same CLI under `run --service Drape`
 * listed Drape's rows, and under `run --service MySQL` listed MySQL's.
 *
 * Three things follow, and each is here rather than in the rite because a
 * watch loop is the hardest thing in this repository to drive by hand, and
 * law 3 asks for a test the model cannot rescue:
 *
 *   1. The listing is read `--json`, and a row carries its COMMIT HASH. A
 *      deployment is mine only if it is new since the push AND it was built
 *      from the commit I pushed. A new row on some other commit — the founder's
 *      own flag-flip redeploy from the dashboard, say — is `foreign`: the watch
 *      keeps waiting rather than adopting it, which the old rule would have
 *      done. A row with no readable hash is `unattributed` and is waited past
 *      too: a deployment that cannot prove it is mine is not mine (invariant 7).
 *   2. The rite scopes the listing with `--service` explicitly, so no injected
 *      context can point it at another service's rows.
 *   3. `foreignServiceContext` refuses to start under a wrapper that names a
 *      different service — the guard that would have turned the ten-minute
 *      silence into a one-line refusal with the plain invocation in it.
 */

export type DeploymentRow = {
  id: string;
  status: string;
  at: string;
  /** `meta.commitHash` off `railway deployment list --json`; null when absent. */
  commitHash: string | null;
} | null;

export type WatchDecision =
  /** The newest row is the one that was there before the push — keep waiting. */
  | { kind: "not-mine" }
  /** New since the push, but built from a commit that is not the one pushed. */
  | { kind: "foreign"; id: string; commitHash: string }
  /** New since the push, and the listing carries no commit to attribute it by. */
  | { kind: "unattributed"; id: string }
  /** Mine, and still going. */
  | { kind: "running"; id: string; status: string }
  /** Mine, and finished. */
  | { kind: "settled"; id: string; status: string }
  /** Nothing could be read at all. */
  | { kind: "unreadable" };

const TERMINAL = ["SUCCESS", "FAILED", "CRASHED", "REMOVED"];

/**
 * `priorId` is the newest deployment id read BEFORE the push, or null when the
 * project had none. `sha` is the full commit hash that was pushed.
 */
export function decideWatch(priorId: string | null, newest: DeploymentRow, sha: string): WatchDecision {
  if (!newest) return { kind: "unreadable" };
  if (priorId !== null && newest.id === priorId) return { kind: "not-mine" };
  if (newest.commitHash === null) return { kind: "unattributed", id: newest.id };
  if (newest.commitHash !== sha) return { kind: "foreign", id: newest.id, commitHash: newest.commitHash };
  return TERMINAL.includes(newest.status)
    ? { kind: "settled", id: newest.id, status: newest.status }
    : { kind: "running", id: newest.id, status: newest.status };
}

/**
 * The first deployment of `railway deployment list --json`. The CLI prints the
 * newest first; the parse refuses (null) rather than guesses when the text is
 * not a non-empty JSON array of rows with an id and a status.
 */
export function newestRow(listingJson: string): DeploymentRow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(listingJson);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const first = parsed[0] as Record<string, unknown>;
  if (typeof first?.id !== "string" || typeof first?.status !== "string") return null;
  const meta = (first.meta ?? null) as Record<string, unknown> | null;
  const hash = meta && typeof meta.commitHash === "string" && meta.commitHash.length > 0
    ? meta.commitHash
    : null;
  return {
    id: first.id,
    status: first.status,
    at: typeof first.createdAt === "string" ? first.createdAt : "",
    commitHash: hash,
  };
}

/**
 * `railway run --service X -- …` injects `RAILWAY_SERVICE_NAME=X` (and the id)
 * into the child. A rite that deploys `service` but runs inside another
 * service's context is the #148 incident before it happens: refuse, and name
 * the plain invocation. Returns the refusal sentence, or null when the process
 * is either unwrapped or wrapped in its own service.
 */
export function foreignServiceContext(
  env: Record<string, string | undefined>,
  service: string,
): string | null {
  const wrapped = env.RAILWAY_SERVICE_NAME;
  if (wrapped === undefined || wrapped === service) return null;
  return `this process is inside \`railway run --service ${wrapped}\` (RAILWAY_SERVICE_NAME=${wrapped}), `
    + `and every unscoped railway command in it is a ${wrapped} command — the watch would read ${wrapped}'s `
    + `deployment list and never see ${service}'s (#148, 2026-08-26). Run the rite plain: `
    + "`npx tsx scripts/deploy-rite.mts` — it reads the production URL by name itself.";
}
