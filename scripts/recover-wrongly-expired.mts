/**
 * Recover candidates the lineage-purge defect wrongly released.
 *
 * **The defect** (fixed in `45c4fb70`): deleting a Cast released every unsigned
 * candidate on her session, even while that sheet was still OPEN and in use.
 * Those rows read `status='expired'` and render as "Didn't arrive · refunded",
 * which is false twice — they arrived, and nothing was refunded.
 *
 * **The predicate is exact.** `expiredReason='retention'` is only ever written
 * when a session is being expired or abandoned, and both of those transitions
 * leave the session NOT open. So a retention-expired candidate on an `open`
 * session cannot have been produced by any correct path.
 *
 * Narrow exception, worth knowing: the retention sweep expires candidates
 * BEFORE stamping the session, so a sweep that crashed between the two would
 * leave rows matching this predicate. Restoring them is harmless — the next
 * sweep expires them again.
 *
 * **This never deletes and never touches an object.** It flips a status back
 * and reports. Run with `--apply` to write; without it, it only counts.
 *
 * # Which world it writes to is declared, because it CAN write to production
 *
 * `getDb()` reads `DATABASE_URL`, and inside a Railway run of a service that
 * does not define it, `dotenv` fills it from the developer's local `.env` — so
 * a run that says "production" in every console line can quietly restore rows
 * in dev, or, pointed the other way, write to production when nobody meant to.
 * That exact substitution cast a paid sheet into the wrong database twice this
 * week. This script restores rows on real customer accounts, so it says out
 * loud which database it relies on rather than accepting whichever one arrives.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/recover-wrongly-expired.mts
 */
import "dotenv/config";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { castingCandidates, castingRolls, castingSessions } from "../drizzle/schema";
import { getDb } from "../server/db/connection";
import { assertDefinedByService, assertOneWorld } from "./lib/worldGuard.mts";

/* Pointed first, then proven: `--service MySQL` supplies the public URL under a
   different name and defines no `DATABASE_URL` at all, so the guard could not
   fire on its absence — only on a local value still sitting there. */
if (process.env.MYSQL_PUBLIC_URL) process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL;
assertDefinedByService(["DATABASE_URL"]);
assertOneWorld(["DATABASE_URL", "MYSQL_PUBLIC_URL"]);

const APPLY = process.argv.includes("--apply");
const db = await getDb();
if (!db) throw new Error("no database");

const wrong = await db
  .select({
    id: castingCandidates.id,
    userId: castingCandidates.userId,
    sessionId: castingCandidates.sessionId,
    imageKey: castingCandidates.imageKey,
    keptAt: castingCandidates.keptAt,
    sessionPublic: castingSessions.publicId,
  })
  .from(castingCandidates)
  .innerJoin(castingSessions, eq(castingSessions.id, castingCandidates.sessionId))
  .where(and(
    eq(castingCandidates.status, "expired"),
    eq(castingCandidates.expiredReason, "retention"),
    eq(castingSessions.status, "open"),
    isNull(castingCandidates.signedCastId),
  ));

console.log(`wrongly-expired candidates on OPEN sheets: ${wrong.length}`);
const bySheet = new Map<string, number>();
for (const row of wrong) bySheet.set(row.sessionPublic, (bySheet.get(row.sessionPublic) ?? 0) + 1);
for (const [sheet, n] of bySheet) console.log(`  sheet ${sheet.slice(0, 8)} — ${n}`);

const withImage = wrong.filter((row) => row.imageKey);
console.log(`of those, ${withImage.length} still name an image key`);

/*
  ONLY RESTORE WHAT CAN STILL BE SEEN.

  The cleanup worker has been deleting these objects since the moment they were
  wrongly expired, so some are already gone. Restoring a row whose image has
  been purged would put a broken tile on the sheet — a different lie in place of
  the current one. Each candidate is checked against the bucket first.
*/
const { storagePublicUrl } = await import("../server/storage");
const restorable: number[] = [];
const lost: number[] = [];
for (const row of withImage) {
  const url = storagePublicUrl(row.imageKey!);
  try {
    const response = await fetch(url, { method: "HEAD" });
    (response.ok ? restorable : lost).push(row.id);
  } catch {
    lost.push(row.id);
  }
}
console.log(`still in the bucket: ${restorable.length}   already purged: ${lost.length}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to restore.");
  process.exit(0);
}

const ids = restorable;
if (ids.length === 0) {
  console.log("nothing to restore");
  process.exit(0);
}
const result = await db
  .update(castingCandidates)
  .set({ status: "ready", expiredReason: null })
  .where(and(
    inArray(castingCandidates.id, ids),
    eq(castingCandidates.status, "expired"),
    isNull(castingCandidates.signedCastId),
  ));
console.log(`restored ${(result as unknown as { affectedRows: number }).affectedRows} candidates to ready`);
process.exit(0);
