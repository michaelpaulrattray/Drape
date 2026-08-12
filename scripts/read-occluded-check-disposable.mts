/**
 * WHAT AN OCCLUDED CHECK ACTUALLY LOOKS LIKE, FIELD BY FIELD.
 *
 * The reliability report classes a read-but-unverified BINDING check as a false
 * pass, and an ABSENT one as the worst outcome it has. A site the reader cannot
 * see — hair over both earlobes — is neither: the runtime already declines to
 * refuse on it (`isRefusableMiss` is false when `occluded`). Before changing how
 * the report treats it, the check's real shape has to be on the record rather
 * than reasoned about, because the answer turns on whether `absent` rides along
 * with `occluded`.
 *
 * One vision call, no paint, no credits.
 *
 *   npx tsx scripts/read-occluded-check-disposable.mts
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { verifyRender, isMiss, isOccluded, isRefusableMiss } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";
import { storageReadBytes } from "../server/storage";

/** Her earlobes are behind her hair in the master — measured in shift 63. */
const FACE = "2f43a3fc-ed05-4a73-9862-597a4d43359e";
const ASKED = "no earrings — both earlobes bare, nothing hanging from either ear";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const [rows] = await connection.query<any[]>(
  "SELECT imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
);
const bytes = await storageReadBytes(rows[0].imageKey);

/*
  READ MORE THAN ONCE, BECAUSE THE FIRST TWO DISAGREED.

  The same bytes and the same question came back `occluded: true, verified:
  false` on one call and `verified: true` on the next. A borderline site is
  exactly where a reader's stability stops being a footnote: today the first
  answer counts as a false pass in the reliability report and the second counts
  as a compliant delivery, so the founder's zero-false-pass column would be
  decided by a coin. One reading cannot say how often that happens; this says it.
*/
const READINGS = Number(process.env.READINGS ?? 5);
const tally = { verified: 0, occluded: 0, miss: 0, refusable: 0 };
for (let at = 1; at <= READINGS; at += 1) {
  const verdict = await verifyRender({
    bytes: bytes.bytes, contentType: "image/png",
    facts: [{ facet: facetOfSubject("statedAccessories"), asked: ASKED, binding: true, absenceIsTheAsk: true }],
  });
  const check = verdict.checks[0];
  if (check.verified) tally.verified += 1;
  if (isOccluded(check)) tally.occluded += 1;
  if (isMiss(check)) tally.miss += 1;
  if (isRefusableMiss(check)) tally.refusable += 1;
  console.log(
    `reading ${at}: verified ${String(check.verified).padEnd(5)} occluded ${String(check.occluded ?? false).padEnd(5)}`
    + ` absent ${String(check.absent ?? "—").padEnd(5)} refusable ${isRefusableMiss(check)}  "${check.saw}"`,
  );
}
console.log(`\n${READINGS} readings of one frame: verified ${tally.verified} · occluded ${tally.occluded} · miss ${tally.miss} · refusable ${tally.refusable}`);
console.log(`the report today calls the verified ones COMPLIANT and the occluded ones a FALSE PASS — same bytes, same question.`);

await connection.end();
process.exit(0);
