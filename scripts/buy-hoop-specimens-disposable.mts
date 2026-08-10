/**
 * THREE HOOPS, BOUGHT — the capped batch fable-227 ruled, and nothing else.
 *
 * The centreline door has one positive and one negative, both off ONE render's
 * two ears, and two specimens with a 1.4× worst-case margin is not a bar. This
 * buys the range the kind actually has: a thin wire, a thick gold, a mid-size.
 * Studs and solid earrings stay OUTSIDE this door on purpose — they are
 * area-scorable and belong to the instrument that already works.
 *
 * # What it spends, declared before it spends it
 *
 *   3 paid dev refines          ~75 dev credits + real provider dollars
 *   1 guard read per reference  the mint's own price, already the product's
 *
 * DEV only, user 1, the founder's own candidate. Capped at three by the
 * constant below; there is no loop that can grow it.
 *
 * # The library flag is set FOR THIS PROCESS, which is the whole point
 *
 * Per-side crops exist only where the library minted them, and the library is
 * dark everywhere. `CASTING_REFERENCE_LIBRARY_SCOPE=users:1` is set in-process
 * before the service is touched — the same way the render that produced rows
 * #8/#9 was driven. Nothing about production changes; the variable is this
 * process's and dies with it.
 *
 *   npx tsx scripts/buy-hoop-specimens-disposable.mts --inventory
 *   npx tsx scripts/buy-hoop-specimens-disposable.mts
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

import { assertOneWorld, APP_WRITE_PATH_KEYS } from "./lib/worldGuard.mts";

const USER_ID = 1;
const CANDIDATE_ID = 359;

/** THE CAP, as a constant rather than as a discipline. */
const HOOPS = [
  { style: "thin wire", instruction: "give her thin gold wire hoop earrings" },
  { style: "thick gold", instruction: "give her thick chunky gold hoop earrings" },
  { style: "mid-size", instruction: "give her medium gold hoop earrings" },
] as const;

const INVENTORY = process.argv.includes("--inventory");

console.log(`candidate    ${CANDIDATE_ID}, user ${USER_ID}, DEV database`);
console.log(`renders      ${HOOPS.length} paid — ~${HOOPS.length * 25} dev credits + provider dollars`);
for (const hoop of HOOPS) console.log(`             ${hoop.style.padEnd(12)} "${hoop.instruction}"`);
if (INVENTORY) {
  console.log("\n--inventory: nothing bought.");
  process.exit(0);
}

/* Before the service module is imported, so the flag is live when its scope
   helper first reads the environment. */
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "users:1";
if (!process.env.FAL_KEY) throw new Error("FAL_KEY is required");

const { refineCandidate } = await import("../server/castingV2/refineService");
const { selectVariant } = await import("../server/db/castingV2Variants");
const { captureCastingReferenceLibraryEnabled } = await import("../server/castingV2/castingV2Scope");

/* ARMED, ASSERTED — a batch driven with the flag quietly off would buy three
   renders and mint nothing, and the log line would look identical. */
if (!captureCastingReferenceLibraryEnabled(USER_ID)) {
  throw new Error("the library is not armed for user 1 in this process; the batch would buy three renders and mint no crop");
}
assertOneWorld(APP_WRITE_PATH_KEYS);

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
const [candidates] = await connection.query(
  "select id, publicId from casting_candidates where id=? and userId=?",
  [CANDIDATE_ID, USER_ID],
) as [Array<{ id: number; publicId: string }>, unknown];
const candidate = candidates[0];
if (!candidate) throw new Error(`candidate ${CANDIDATE_ID} is not user ${USER_ID}'s`);

const [before] = await connection.query(
  "select count(*) n from casting_reference_library where userId=?", [USER_ID],
) as [Array<{ n: number }>, unknown];
console.log(`\nlibrary rows before: ${before[0]!.n}`);

for (const hoop of HOOPS) {
  console.log(`\n=== ${hoop.style} — "${hoop.instruction}"`);
  /* From the ORIGINAL every time: a stack would make each hoop a measurement of
     a different face, and the bar is for the KIND. */
  await selectVariant({ userId: USER_ID, candidatePublicId: candidate.publicId, variantPublicId: null });
  const started = Date.now();
  try {
    const result = await refineCandidate({}, {
      userId: USER_ID,
      clientRequestId: randomUUID(),
      candidatePublicId: candidate.publicId,
      instruction: hoop.instruction,
    });
    console.log(`  ${result.kind} in ${Math.round((Date.now() - started) / 1000)}s`
      + ` — variant ${result.variantId ?? "(original)"}`);
  } catch (error) {
    console.log(`  REFUSED — ${(error as Error).message.slice(0, 200)}`);
  }
}

const [after] = await connection.query(
  `select id, slot, refusedReason, refusedCoverage, refusedContentKey is not null hasCrop, variantId
     from casting_reference_library where userId=? order by id`, [USER_ID],
) as [Array<any>, unknown];
console.log(`\nlibrary rows after: ${after.length}`);
for (const row of after) {
  console.log(`  #${row.id} ${String(row.slot).padEnd(16)} v${row.variantId}`
    + ` ${String(row.refusedReason ?? "stored").padEnd(18)}`
    + ` ${row.refusedCoverage === null ? "" : (row.refusedCoverage / 100).toFixed(1) + "%"}`
    + ` ${row.hasCrop ? "· pixels kept" : ""}`);
}
await connection.end();
