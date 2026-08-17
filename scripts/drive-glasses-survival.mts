/**
 * BRIEF-STATED GLASSES MUST SURVIVE A REMOVAL (D-166, founder-authorized roll).
 *
 * # Why this one needs a fresh roll
 *
 * The preservation clause protects worn things PIXEL-CONDITIONALLY — "anything
 * worn in the reference … still worn and unchanged" — rather than by naming
 * them, because brief-stated accessories never reach the candidate row and
 * naming an absent thing would invite the model to add it.
 *
 * That clause can therefore only be tested against pixels that carry a worn
 * thing the REFINE recipe did not put there. No dev candidate had one, so this
 * casts a sheet whose brief states glasses and then removes something else.
 *
 *   npx tsx scripts/drive-glasses-survival.mts cast    — roll the sheet (160 cr)
 *   npx tsx scripts/drive-glasses-survival.mts <id>    — run the removal test
 */
import "dotenv/config";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../server/db/connection";
import { castingCandidates, castingCandidateVariants, users } from "../drizzle/schema";
import { createCastingSession } from "../server/db/castingV2";
import { createRoll } from "../server/castingV2/rollService";
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

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);

const BRIEF = "A woman in her thirties who wears thin round wire-framed glasses, "
  + "warm and unfussy, for an independent bookshop's about page.";

if (process.argv[2] === "cast") {
  const session = await createCastingSession({ userId: bot!.id });
  console.log(`session ${session.publicId}`);
  const result = await createRoll({}, {
    userId: bot!.id,
    clientRequestId: randomUUID(),
    sessionPublicId: session.publicId,
    briefText: BRIEF,
  });
  console.log(`roll ${result.rollPublicId} — waiting for candidates…`);
  /* Poll until the sheet settles; a roll lands its eight independently. */
  for (let i = 0; i < 90; i += 1) {
    await new Promise((r) => setTimeout(r, 10_000));
    const rows = await db
      .select({ publicId: castingCandidates.publicId, status: castingCandidates.status })
      .from(castingCandidates)
      .where(eq(castingCandidates.sessionId, session.id));
    const ready = rows.filter((r) => r.status === "ready");
    const settled = rows.filter((r) => r.status !== "queued" && r.status !== "dispatched");
    console.log(`  ${ready.length} ready / ${settled.length} settled of ${rows.length}`);
    if (rows.length > 0 && settled.length === rows.length) {
      console.log("\nready candidates:");
      for (const row of ready) console.log(`  ${row.publicId}`);
      break;
    }
  }
  process.exit(0);
}

/* ---------------------------------------------------- the removal test */

const candidateId = process.argv[2];
if (!candidateId) throw new Error("pass a candidate public id, or `cast`");

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

const [candidate] = await db
  .select()
  .from(castingCandidates)
  .where(and(eq(castingCandidates.publicId, candidateId), eq(castingCandidates.userId, bot!.id)))
  .limit(1);
if (!candidate) throw new Error("no such candidate");

await selectVariant({ userId: bot!.id, candidatePublicId: candidateId, variantPublicId: null });

const urls = [storagePublicUrl(candidate.imageKey!)];
async function ask(instruction: string) {
  const started = Date.now();
  const result = await refineCandidate({}, {
    userId: bot!.id,
    clientRequestId: randomUUID(),
    candidatePublicId: candidateId,
    instruction,
  });
  console.log(`  "${instruction}" -> ${result.kind} (${Math.round((Date.now() - started) / 1000)}s)`);
  if (result.imageUrl) urls.push(result.imageUrl);
  return result;
}

console.log("\n=== brief-stated glasses survive a removal of something else ===");
/*
  A SECOND, UNRELATED STEP is what makes this a real test. Removing the ONLY
  step lands back on the original, which trivially still wears the glasses — so
  the chain has to keep something after the removal, forcing a RENDER whose only
  claim on the glasses is the pixel-conditional preservation clause.
*/
await ask("small gold hoop earrings");
await ask("thick straight brows");
const removed = await ask("take the hoops off");

const [row] = await db
  .select({ internalPrompt: castingCandidateVariants.internalPrompt })
  .from(castingCandidateVariants)
  .where(eq(castingCandidateVariants.publicId, removed.variantId ?? ""))
  .limit(1);
const prompt = typeof (row?.internalPrompt as { prompt?: unknown })?.prompt === "string"
  ? (row!.internalPrompt as { prompt: string }).prompt
  : "";

check("it rendered rather than selecting", removed.kind === "rendered", String(removed.kind));
check("the prompt protects worn things", /anything worn in the reference/.test(prompt));
/* The glasses are NOT in the recipe — nothing here may name them, or the test
   is proving the instruction lane rather than the preservation clause. */
check("the recipe never names the glasses", !/ACCESSORIES:/.test(prompt), prompt.slice(0, 0));
check("the hoops are gone from the recipe", !/hoop/i.test(prompt));
check("the surviving step is still asked for", /BROWS:/.test(prompt));

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
writeFileSync("docs/specs/evidence/refine/d166-glasses-survival.jpg", out);
console.log("     wrote d166-glasses-survival.jpg (original, +hoops, after removal)");
console.log("\n  The glasses are a PIXEL claim — read the strip, not the string.");
process.exit(failures === 0 ? 0 : 1);
