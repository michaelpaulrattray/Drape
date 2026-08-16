/**
 * REMOVING ONE ITEM OUT OF A STEP THAT HOLDS SEVERAL (D-171).
 *
 * The founder's named case: "hoops and glasses" → "remove the hoops" → the
 * glasses survive in the RECIPE and in the RENDER. Before this, the whole step
 * was deleted and the glasses went with it.
 *
 * Asserted on the stored row (D-164), and the strip is for the eye.
 *
 *   npx tsx scripts/drive-item-removal.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../server/db/connection";
import { castingCandidates, castingCandidateVariants, users } from "../drizzle/schema";
import { refineCandidate } from "../server/castingV2/refineService";
import { selectVariant } from "../server/db/castingV2Variants";
import { storagePublicUrl } from "../server/storage";
import { assertOneWorld } from "./lib/worldGuard.mts";

/*
  One world per process (scripts/lib/worldGuard.mts). Inert outside a Railway
  run; inside one it refuses when dotenv has filled a gap the service does not
  define, which is how a "production" read gets taken from dev.
*/
assertOneWorld(["DATABASE_URL"]);

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);
const all = await db
  .select()
  .from(castingCandidates)
  .where(and(eq(castingCandidates.userId, bot!.id), eq(castingCandidates.status, "ready")))
  .orderBy(desc(castingCandidates.id))
  .limit(40);
const counts = new Map<number, number>();
for (const c of all) {
  const rows = await db
    .select({ id: castingCandidateVariants.id })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.candidateId, c.id));
  counts.set(c.id, rows.length);
}
const candidate = [...all].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0]!;

const urls = [storagePublicUrl(candidate.imageKey!)];
async function ask(instruction: string) {
  const started = Date.now();
  const result = await refineCandidate({}, {
    userId: bot!.id,
    clientRequestId: randomUUID(),
    candidatePublicId: candidate.publicId,
    instruction,
  });
  console.log(`  "${instruction}" -> ${result.kind} (${Math.round((Date.now() - started) / 1000)}s)`);
  if (result.imageUrl) urls.push(result.imageUrl);
  return result;
}

async function row(publicId: string) {
  const [found] = await db!
    .select({
      instructions: castingCandidateVariants.instructions,
      deltas: castingCandidateVariants.deltas,
      stepDeltas: castingCandidateVariants.stepDeltas,
      internalPrompt: castingCandidateVariants.internalPrompt,
    })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.publicId, publicId))
    .limit(1);
  return found!;
}

console.log("\n=== hoops AND glasses, then remove only the hoops ===");
await selectVariant({ userId: bot!.id, candidatePublicId: candidate.publicId, variantPublicId: null });

const worn = await ask("small gold hoop earrings and thin wire glasses");
const before = await row(worn.variantId!);
const items = (before.deltas as { free?: { statedAccessories?: unknown } })?.free?.statedAccessories;
console.log(`     filed as: ${JSON.stringify(items)}`);
check("both items are filed separately", Array.isArray(items) && items.length === 2,
  JSON.stringify(items));

const pruned = await ask("take the hoops off");
check("it rendered rather than deleting the step", pruned.kind === "rendered", String(pruned.kind));

if (pruned.variantId) {
  const after = await row(pruned.variantId);
  const left = (after.deltas as { free?: { statedAccessories?: unknown } })?.free?.statedAccessories;
  const text = JSON.stringify(left);
  console.log(`     now filed as: ${text}`);
  check("the glasses survived in the recipe", /glass/i.test(text ?? ""), text);
  check("the hoops are gone from the recipe", !/hoop/i.test(text ?? ""), text);
  const prompt = (after.internalPrompt as { prompt?: string })?.prompt ?? "";
  check("the glasses reach the prompt", /glass/i.test(prompt));
  check("the hoops never reach the prompt", !/hoop/i.test(prompt));
  console.log("\n  ---- the persisted prompt, whole (D-164) ----");
  console.log(prompt.split(/(?<=\.)\s+/).map((line) => `  ${line}`).join("\n"));
  console.log("  ---- end ----\n");
}

const W = 420;
const cells: Buffer[] = [];
for (const url of urls) {
  cells.push(await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).resize(W).toBuffer());
}
const meta = await sharp(cells[0]).metadata();
const out = await sharp({
  create: { width: W * cells.length + 10 * (cells.length - 1), height: meta.height!, channels: 3, background: "#111111" },
})
  .composite(cells.map((input, i) => ({ input, left: i * (W + 10), top: 0 })))
  .jpeg({ quality: 88 })
  .toBuffer();
writeFileSync("docs/specs/evidence/refine/d171-item-removal.jpg", out);
console.log("     wrote d171-item-removal.jpg (original, +hoops+glasses, hoops removed)");
console.log(failures === 0 ? "\nITEM REMOVAL: ALL CASES PASS." : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
