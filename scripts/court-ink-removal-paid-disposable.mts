/**
 * §10 item 3a's FINISH — one PAID removal on dev, through the real entrance
 * (granted with bounds, fable-1320 §2).
 *
 * The pure drive already returned LETTER A: the matcher finds the ink step, the
 * prune is surgical, and the composed result carries no ink in any of its three
 * halves. What that cannot show is the half that costs money — that the road
 * charges once, renders from the chain it recomposed, and hands back a frame
 * with no tattoo on it.
 *
 * FIXTURE: candidate 232 (verify-bot's own), whose SELECTED variant v500 already
 * wears `ink:upperChest` behind two hair edits. Deliberately NOT the census's
 * outsider cast — that fixture belongs to the seat extending the census on a
 * parallel branch, and a shared dev database is exactly where two seats collide.
 * The hair steps are what make the surgical claim testable: they must survive.
 *
 * BOUNDS: one removal, 25 dev credits, one mechanical retry at most. It reads
 * the ledger in the same sitting and saves the delivered frame to be LOOKED AT,
 * because a render nobody read is a receipt rather than evidence.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { openDatabase } from "./lib/dbConnection.mts";

const BASE = "http://localhost:3000";
const CANDIDATE = "fab8374a-5562-4121-83b1-c9b937e06b86";
const INSTRUCTION = "take his chest tattoo off";

const token = await new SignJWT({ openId: "verify-bot-local", appId: process.env.VITE_APP_ID!, name: "verify bot" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

const db = await openDatabase(process.env.DATABASE_URL!);
const ledger = async () => {
  const [rows] = await db.query(
    /* The ledger is `points`/`point_transactions` — the pre-rename names, which
       is why a table called `credit_transactions` does not exist. */
    `SELECT (SELECT balance FROM points WHERE userId = 823) AS balance,
            COUNT(*) AS rows_, COALESCE(SUM(amount), 0) AS net
       FROM point_transactions WHERE userId = 823`,
  ) as unknown as [Array<Record<string, unknown>>];
  return rows[0];
};
const chainOf = async () => {
  const [rows] = await db.query(
    `SELECT v.id, v.publicId, v.imageKey, v.instructions, v.deltas
       FROM casting_candidate_variants v
       JOIN casting_candidates c ON c.id = v.candidateId
      WHERE c.publicId = ? ORDER BY v.id DESC LIMIT 1`, [CANDIDATE],
  ) as unknown as [Array<Record<string, unknown>>];
  return rows[0];
};

console.log("BEFORE  ledger:", JSON.stringify(await ledger()));
const before = await chainOf();
const beforeDeltas = typeof before!.deltas === "string" ? JSON.parse(before!.deltas as string) : before!.deltas;
console.log("BEFORE  newest variant:", before!.id, "ink:", JSON.stringify(beforeDeltas?.inkDelivered));
console.log("BEFORE  steps:", before!.instructions);

const body = {
  json: {
    clientRequestId: randomUUID(),
    candidateId: CANDIDATE,
    instruction: INSTRUCTION,
  },
};
console.log(`\nSENDING "${INSTRUCTION}" …`);
const started = Date.now();
const response = await fetch(`${BASE}/api/trpc/castingV2.refine`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: `app_session_id=${token}` },
  body: JSON.stringify(body),
});
const text = await response.text();
console.log(`HTTP ${response.status} after ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(text.slice(0, 900));

console.log("\nAFTER   ledger:", JSON.stringify(await ledger()));
const after = await chainOf();
const afterDeltas = typeof after!.deltas === "string" ? JSON.parse(after!.deltas as string) : after!.deltas;
console.log("AFTER   newest variant:", after!.id, "ink:", JSON.stringify(afterDeltas?.inkDelivered ?? null));
console.log("AFTER   steps:", after!.instructions);
console.log("AFTER   free.ink:", JSON.stringify(afterDeltas?.free?.ink ?? null));
console.log("AFTER   hair survived:", JSON.stringify({
  hairCut: afterDeltas?.free?.hairCut ?? null, hairShade: afterDeltas?.free?.hairShade ?? null,
}));

/* THE FRAME, saved to be looked at — the whole point of the bound. */
if (after!.id !== before!.id && after!.imageKey) {
  const bucket = process.env.R2_PUBLIC_URL!;
  const bytes = Buffer.from(await (await fetch(`${bucket}/${after!.imageKey}`)).arrayBuffer());
  await mkdir("output/ink-removal-court", { recursive: true });
  await writeFile(`output/ink-removal-court/after-v${after!.id}.png`, bytes);
  const beforeBytes = Buffer.from(await (await fetch(`${bucket}/${before!.imageKey}`)).arrayBuffer());
  await writeFile(`output/ink-removal-court/before-v${before!.id}.png`, beforeBytes);
  console.log(`\nFRAMES for eyes:\n  C:\Users\Admin\Drape\output\ink-removal-court\before-v${before!.id}.png\n  C:\Users\Admin\Drape\output\ink-removal-court\after-v${after!.id}.png`);
}

await db.end();
process.exit(0);
