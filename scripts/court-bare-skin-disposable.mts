/**
 * THE CARRY AT THE FRAMES, THEN THE BARE-SKIN READING — 50 dev credits total
 * (fable-1327 §3, re-shaped and re-granted fable-1331 §3).
 *
 * ⚠ STEP 1 IS NOW THE EXPERIMENT, not the setup. **Does a delivered tattoo with
 * a LIVE crop row survive an unrelated edit?** Nobody has ever proven that at
 * the frames on dev. The first attempt at this court used v502, whose delta
 * claimed a delivered chest piece for a crop row the mint never wrote — the
 * freckles step erased the tattoo, which is the known and fenced `upperChest`
 * hole rather than a carry failure. v501 is the same cast with a real row, so
 * this time the carry is the thing under test. **If it fails WITH a row, that
 * is a new unfenced finding and step 2 does not fire.**
 *
 * # The question, and why three earlier courts could not answer it
 *
 * opus-969 removed a tattoo and got the version WITHOUT it back by NAVIGATION,
 * so no render happened and the frame proved nothing about skin. opus-971's
 * mid-chain court did render — on a branch whose ink was recorded and never
 * delivered, so there was no tattoo in the before either. And verify-bot's own
 * inked cast is over the 24-refinement ceiling, so it cannot be given the extra
 * step that makes a never-rendered survivor.
 *
 * So the subject is the outsider's cast 391, whose v502 VISIBLY wears a chest
 * swallow (opus-960's paid words-road render), in two steps:
 *
 *   1  v502 + a freckles step  →  [tattoo, freckles], never rendered   25 credits
 *   2  take the chest tattoo off →  [freckles], never rendered → RE-RENDERS  25
 *
 * # Step 1's frame is the BEFORE and it is READ, not assumed
 *
 * If the carry drops the tattoo at step 1 there is nothing to remove and step 2
 * is not fired — which would itself be a finding rather than a failed court.
 *
 * # Why touching the census's own cast is safe now
 *
 * `ensureInkBranchFixture` pins v502 BY IDENTITY as of this shift, so the
 * variants this court adds are invisible to the census by construction. Under
 * the newest-wins query it replaced, step 1's variant would have BECOME the
 * census's branch fixture.
 *
 * BOUNDS: two renders, no retry, ledger read in the same sitting, both frames
 * saved to be looked at.
 *
 *   npx tsx scripts/court-bare-skin-disposable.mts 1
 *   npx tsx scripts/court-bare-skin-disposable.mts 2
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import sharp from "sharp";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this spends credits");

const BASE = "http://localhost:3000";
const CANDIDATE = "84c9ea26-7b43-49f7-837d-db72e171c6e0";
const INK_VARIANT = "f33e485e-9dfa-4ea0-a7d0-25cfb851ff99"; /* v501 — the LEFT UPPER ARM
  swallow, the only branch on dev whose delivered tattoo has a LIVE crop row
  (`d27c9c99`). v502 was the first subject and its crop row was never written,
  so its tattoo was erased by the setup step (opus-976). */
const OUT = "output/bare-skin-court";
const STEP = process.argv[2] ?? "1";

const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url");
console.log("world:", worldOf(url));
const db = await openDatabase(url);
const account = await ensureOutsider();
const USER = account.id;

const token = await new SignJWT({ openId: account.openId, appId: process.env.VITE_APP_ID!, name: "census outsider" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

const ledger = async () => {
  const [rows] = await db.query(`SELECT balance FROM points WHERE userId = ?`, [USER]) as unknown as [Array<Record<string, any>>];
  return Number(rows[0]!.balance);
};
const rowsSince = async (highWater: number) => {
  const [rows] = await db.query(
    `SELECT id, amount, type, description FROM point_transactions WHERE userId = ? AND id > ? ORDER BY id`,
    [USER, highWater],
  ) as unknown as [Array<Record<string, any>>];
  return rows;
};
const highWater = async () => {
  const [rows] = await db.query(
    `SELECT COALESCE(MAX(id), 0) AS id FROM point_transactions WHERE userId = ?`, [USER],
  ) as unknown as [Array<Record<string, any>>];
  return Number(rows[0]!.id);
};
const newest = async () => {
  const [rows] = await db.query(
    `SELECT MAX(v.id) AS id FROM casting_candidate_variants v
       JOIN casting_candidates c ON c.id = v.candidateId WHERE c.publicId = ?`, [CANDIDATE],
  ) as unknown as [Array<Record<string, any>>];
  return Number(rows[0]!.id);
};

await mkdir(OUT, { recursive: true });
const save = async (key: string, name: string) => {
  const bytes = Buffer.from(await (await fetch(`${process.env.R2_PUBLIC_URL}/${key}`)).arrayBuffer());
  await writeFile(`${OUT}/${name}.png`, bytes);
  await sharp(bytes).resize({ width: 700 }).png().toFile(`${OUT}/small-${name}.png`);
  console.log(`   FRAME  C:\\Users\\Admin\\Drape\\output\\bare-skin-court\\${name}.png`);
};

const pick = async (variantPublicId: string) => {
  const response = await fetch(`${BASE}/api/trpc/castingV2.selectVariant`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `app_session_id=${token}` },
    body: JSON.stringify({ json: { candidateId: CANDIDATE, variantId: variantPublicId } }),
  });
  console.log("select:", response.status, (await response.text()).slice(0, 120));
};

const ask = async (instruction: string) => {
  const started = Date.now();
  console.log(`\nSENDING "${instruction}" …`);
  const response = await fetch(`${BASE}/api/trpc/castingV2.refine`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `app_session_id=${token}` },
    body: JSON.stringify({ json: { clientRequestId: randomUUID(), candidateId: CANDIDATE, instruction } }),
  }).catch((error: unknown) => {
    /* The ~305 s gateway wall met from the client side. The render keeps going;
       the ROW is the fact. Never re-fire — that is how a shift pays twice. */
    console.log("CLIENT TIMED OUT —", error instanceof Error ? error.message : String(error));
    return null;
  });
  if (response) {
    console.log(`HTTP ${response.status} after ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log((await response.text()).slice(0, 700));
  }
};

const before = await ledger();
const mark = await highWater();
const beforeNewest = await newest();
console.log(`STEP ${STEP} · outsider ${USER} · ledger ${before} · newest v${beforeNewest}`);

if (STEP === "1") {
  const [v502] = await db.query(
    `SELECT imageKey FROM casting_candidate_variants WHERE publicId = ?`, [INK_VARIANT],
  ) as unknown as [Array<Record<string, any>>];
  await save(v502[0]!.imageKey, "before-v501-the-arm-swallow");
  await pick(INK_VARIANT);
  await ask("give him light freckles across his nose and cheeks");
} else {
  /* HIS ARM, not his chest — v501's swallow is on his left upper arm, and the
     survivor `[freckles]` has never been rendered, so this must RE-RENDER
     rather than navigate. That is what makes the frame a reading about skin. */
  await ask("take the tattoo off his arm");
}

console.log(`\nledger now ${await ledger()} (was ${before})`);
for (const row of await rowsSince(mark)) {
  console.log(`   #${row.id} ${row.amount > 0 ? "+" : ""}${row.amount} ${row.type} :: ${row.description}`);
}
const afterNewest = await newest();
console.log(`newest variant now v${afterNewest} (was v${beforeNewest})`);
if (afterNewest !== beforeNewest) {
  const [row] = await db.query(
    `SELECT id, status, imageKey, instructions, deltas FROM casting_candidate_variants WHERE id = ?`, [afterNewest],
  ) as unknown as [Array<Record<string, any>>];
  const deltas = typeof row[0]!.deltas === "string" ? JSON.parse(row[0]!.deltas) : row[0]!.deltas;
  console.log(`   v${row[0]!.id} ${row[0]!.status} steps=${JSON.stringify(row[0]!.instructions)}`);
  console.log(`   ink=${JSON.stringify(deltas?.free?.ink ?? null)} delivered=${JSON.stringify(deltas?.inkDelivered ?? null)}`);
  if (row[0]!.imageKey) await save(row[0]!.imageKey, `after-step${STEP}-v${row[0]!.id}`);
}
await db.end();
process.exit(0);
