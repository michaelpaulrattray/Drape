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
 * So the id of the newest row is read BEFORE the push and passed in here. The
 * decision is a pure function because a watch loop is the hardest thing in this
 * repository to drive by hand, and law 3 asks for a test the model cannot
 * rescue.
 */

export type DeploymentRow = { id: string; status: string; at: string } | null;

export type WatchDecision =
  /** The newest row is the one that was there before the push — keep waiting. */
  | { kind: "not-mine" }
  /** Mine, and still going. */
  | { kind: "running"; id: string; status: string }
  /** Mine, and finished. */
  | { kind: "settled"; id: string; status: string }
  /** Nothing could be read at all. */
  | { kind: "unreadable" };

const TERMINAL = ["SUCCESS", "FAILED", "CRASHED", "REMOVED"];

/**
 * `priorId` is the newest deployment id read BEFORE the push, or null when the
 * project had none.
 */
export function decideWatch(priorId: string | null, newest: DeploymentRow): WatchDecision {
  if (!newest) return { kind: "unreadable" };
  if (priorId !== null && newest.id === priorId) return { kind: "not-mine" };
  return TERMINAL.includes(newest.status)
    ? { kind: "settled", id: newest.id, status: newest.status }
    : { kind: "running", id: newest.id, status: newest.status };
}

/** The first row of `railway deployment list` that is a deployment. */
export function newestRow(listing: string): DeploymentRow {
  const line = listing.split("\n")
    .map((entry) => entry.trim())
    .find((entry) => /^[0-9a-f-]{36} \| [A-Z]+ \|/.test(entry));
  if (!line) return null;
  const [id, status, at] = line.split("|").map((field) => field.trim());
  return { id: id!, status: status!, at: at! };
}
