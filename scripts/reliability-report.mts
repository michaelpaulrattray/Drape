/**
 * THE DELIVERY-RATE READ (D-236), run on demand.
 *
 * Derived entirely from rows the render path already writes — the variant's
 * status, its failure class, and the verdict stored on `internalPrompt`. This
 * script does no classification of its own: it hands rows to the same
 * `summarize` the walk report and the heartbeat use, so three surfaces can
 * never disagree about one number.
 *
 *   npx tsx scripts/reliability-report.mts                # dev database
 *   railway.cmd run --service MySQL npx tsx scripts/…     # production
 *
 * Optional: --since 2026-08-07T00:00:00Z   (a build boundary; see D-236 on why
 * build attribution is by timestamp and what that costs in precision)
 *           --user 1
 */
import { formatReport, summarize } from "../server/castingV2/reliabilityReport.js";
import { readAttemptRows } from "./lib/attemptRows.mjs";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const sinceRaw = arg("since");
const since = sinceRaw ? new Date(sinceRaw) : undefined;
if (sinceRaw && Number.isNaN(since!.getTime())) {
  console.error(`--since is not a date: ${sinceRaw}`);
  process.exit(1);
}
const userId = arg("user");

/* The query and the row shape live in `lib/attemptRows` because the walk reads
   the same rows to score itself. Two SELECTs feeding one number is how the
   on-demand report and the walk report would come to disagree (law 4). */
const attempts = await readAttemptRows({
  since,
  userId: userId ? Number(userId) : undefined,
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

const report = summarize(attempts, {
  windowFrom: since,
  windowLabel: since ? `since ${since.toISOString()}` : "all time",
});
console.log(formatReport(report));

/* The rows behind an ugly number, so the next question can be asked of the
   picture rather than of the summary (working law 1: artifacts are facts). */
const interesting = attempts.filter((row) => {
  const checks = row.verification?.checks ?? [];
  return row.status !== "ready" || checks.some((check) => check.read === true && !check.verified);
});
if (interesting.length > 0) {
  console.log("\nATTEMPTS THAT DID NOT DELIVER CLEANLY");
  for (const row of interesting) {
    const missed = (row.verification?.checks ?? [])
      .filter((check) => check.read === true && !check.verified)
      .map((check) => `${check.facet}="${check.asked}" saw="${check.saw ?? "?"}"`);
    console.log(
      `  ${row.createdAt.toISOString().slice(0, 19)} ${row.operationId.slice(0, 8)} `
      + `${row.status}${row.failureClass ? `/${row.failureClass}` : ""} `
      + `"${(row.requestText ?? "").slice(0, 34)}"${missed.length ? ` — ${missed.join("; ")}` : ""}`,
    );
  }
}
