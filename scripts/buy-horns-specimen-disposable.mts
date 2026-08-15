/**
 * BUY THE HORNS SPECIMEN — one paid render on the real mint path.
 * (fable-578: (b) approved, 25 dev credits + one house render.)
 *
 * The calibration stopped one number short on purpose: a crop cut from a mask
 * and scored against a re-read of that mask reads 100.0% — an identity control
 * wearing a specimen's clothes. The mint's crop is the SEGMENT CUT, narrowed by
 * what the edit actually delivered, which is why hair's positive is 94.6%.
 *
 * So the number has to come from a real mint, and this buys one: a horns render
 * on the repaint road (the only road horns is admitted on), which cuts a crop
 * per side, hands each to the guard, and is refused `noSpecimen` — with the
 * reading on the row. Then the crop is looked at, and the number it earned
 * becomes the specimen if the picture deserves it.
 *
 * It also closes the harness-supplied class by purchase rather than by unit
 * test: everything from the ask to the library row runs the shipped path.
 *
 * The scopes are set on THIS process, because `refineCandidate` reads them
 * where it runs. Dev only, and it refuses under any production wrapper.
 *
 *   npx tsx scripts/buy-horns-specimen-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { teeTo } from "./lib/benchKit.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const OUT = "output/horns-specimen";
mkdirSync(OUT, { recursive: true });
const say = teeTo(`${OUT}/purchase.txt`);

if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
  throw new Error("dev only — this SPENDS and renders");
}

const outsider = await ensureOutsider();
/* The roads horns needs, armed for this account only, in this process only. */
process.env.CASTING_REPAINT_SCOPE = `users:${outsider.id}`;
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = `users:${outsider.id}`;
process.env.ENABLE_STORAGE_CLEANUP_WORKER = "true";

const conn = await openDatabase(process.env.DATABASE_URL);
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};

/* An UNSIGNED cast of hers — a signed one is spent. */
const [casts] = await conn.execute(
  `SELECT c.publicId, COUNT(v.id) AS versions
     FROM casting_candidates c LEFT JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = ? AND c.status = 'ready'
    GROUP BY c.id ORDER BY versions DESC LIMIT 1`,
  [outsider.id],
);
const candidatePublicId = (casts as Array<{ publicId: string }>)[0]!.publicId;

const { refineCandidate } = await import("../server/castingV2/refineService.js");

say(`outsider ${outsider.id} · cast ${candidatePublicId} · ${await balance()} credits`);
say("asking for horns on the repaint road…");
const before = await balance();
const started = Date.now();
let outcome = "";
try {
  const result = await refineCandidate({}, {
    userId: outsider.id,
    clientRequestId: randomUUID(),
    candidatePublicId,
    instruction: "give her horns",
  });
  outcome = `${result.kind ?? "?"}${result.note ? ` · ${result.note}` : ""}`;
} catch (error) {
  outcome = `THREW: ${error instanceof Error ? error.message : String(error)}`;
}
const after = await balance();
say(`  ${outcome} · ${before - after} credits · ${Math.round((Date.now() - started) / 1000)}s`);

/* THE ROW IS THE POINT: the refusal, its reason, and the number it read. */
const [library] = await conn.execute(
  `SELECT slot, guardReason, guardKind, guardCoverage, cropKey, createdAt
     FROM casting_reference_library
    WHERE userId = ? ORDER BY id DESC LIMIT 6`,
  [outsider.id],
).catch(() => [[]] as any);
say("");
say("the library's own record:");
for (const row of library as Array<Record<string, unknown>>) {
  say(`  ${String(row.slot).padEnd(14)} ${String(row.guardReason ?? "accepted").padEnd(12)}`
    + ` ${row.guardCoverage === null || row.guardCoverage === undefined
      ? "no reading"
      : `${(Number(row.guardCoverage) * 100).toFixed(1)}%`}`
    + `  ${row.cropKey ? String(row.cropKey).slice(-28) : "no crop kept"}`);
}

writeFileSync(`${OUT}/purchase.json`, `${JSON.stringify({ outcome, spent: before - after, library }, null, 2)}\n`);
say("");
say("LOOK AT THE KEPT CROP BEFORE ITS NUMBER BECOMES A BAR.");
await conn.end();
process.exit(0);
