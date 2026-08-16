/**
 * THE STACKED-EDIT DRIVER — the instrument whose absence let two defects ship.
 *
 * Every earlier driver tested ONE edit against a fresh candidate, and both of
 * the founder's dogfood defects only exist in a stack:
 *
 *   A. facet collision — a colour edit annihilated a cut, because both lived in
 *      one coarse subject and last-writer-wins did exactly what it says;
 *   B. realization re-roll — the words persisted and the PICTURE of them was
 *      redrawn on every render, so a mullet quietly shortened under an
 *      unrelated eye edit.
 *
 * A single-edit harness cannot see either. **The instrument lesson, recorded:
 * stack the real thing and compare.**
 *
 *   npx tsx scripts/drive-refine-stack.mts
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

/**
 * THE FIXED PAIR — one that must NOW pass, one that must STILL pass.
 *
 * The mullet stack is the defect: three hair instructions where a colour edit
 * annihilated the cut. The fox-eyes stack is the BOUNDARY — it composed and
 * rendered correctly in the same dogfood session, four distinct facets with
 * zero collisions, which is what told us the bug was coarse subject filing
 * rather than composition itself.
 *
 * Keeping both is the point. A fix that made the mullet pass by loosening
 * something the fox-eyes stack depended on would look like success against one
 * stack and be a regression against the other.
 */
const STACKS = [
  {
    name: "mullet",
    must: "MUST NOW PASS — the last frame shows a BLACK MULLET",
    steps: ["change hair to a mullet", "copper hair", "actually black hair"],
  },
  {
    name: "fox-eyes",
    must: "MUST STILL PASS — all four facets present, none annihilated",
    steps: [
      "surgical fox eyes not makeup",
      "more defined cupids bow",
      "glossy nude lip gloss",
      "hair worn down",
    ],
  },
];

const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);
/* One candidate PER STACK. Each stack starts from a clean face, and the
   per-candidate refinement cap cannot make the second stack look like a
   failure when it is only a full ledger. */
const all = await db
  .select()
  .from(castingCandidates)
  .where(and(eq(castingCandidates.userId, bot!.id), eq(castingCandidates.status, "ready")))
  .orderBy(desc(castingCandidates.id))
  .limit(40);
/* Fewest existing refinements first, so a candidate exhausted by earlier
   testing never makes a stack look like a failure when it is a full ledger. */
const counts = new Map<number, number>();
for (const c of all) {
  const rows = await db
    .select({ id: castingCandidateVariants.id })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.candidateId, c.id));
  counts.set(c.id, rows.length);
}
const pool = [...all].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));

async function compose(urls: string[], name: string): Promise<void> {
  const W = 420;
  const cells: Buffer[] = [];
  for (const url of urls) {
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    cells.push(await sharp(bytes).resize(W).toBuffer());
  }
  const meta = await sharp(cells[0]).metadata();
  const out = await sharp({
    create: {
      width: W * cells.length + 10 * (cells.length - 1),
      height: meta.height!,
      channels: 3,
      background: "#111111",
    },
  })
    .composite(cells.map((input, i) => ({ input, left: i * (W + 10), top: 0 })))
    .jpeg({ quality: 86 })
    .toBuffer();
  writeFileSync(`docs/specs/evidence/refine/${name}`, out);
  console.log(`     wrote ${name} — ${cells.length} frames (original, then each edit)`);
}

for (const [index, stack] of STACKS.entries()) {
  const candidate = pool[index];
  if (!candidate) throw new Error("not enough ready candidates for the stacks");
  console.log(`\n=== ${stack.name} — ${stack.must} ===`);
  /* Start from the ORIGINAL, so the stack is the only variable. */
  await selectVariant({
    userId: bot!.id,
    candidatePublicId: candidate!.publicId,
    variantPublicId: null,
  });

  const urls = [storagePublicUrl(candidate!.imageKey!)];
  for (const instruction of stack.steps) {
    const started = Date.now();
    try {
      const result = await refineCandidate({}, {
        userId: bot!.id,
        clientRequestId: randomUUID(),
        candidatePublicId: candidate!.publicId,
        instruction,
      });
      console.log(`OK   "${instruction}" (${Math.round((Date.now() - started) / 1000)}s)`);
      console.log(`     stack now: ${result.instructions.join(" | ")}`);
      urls.push(result.imageUrl);
    } catch (error) {
      console.log(`FAIL "${instruction}" — ${(error as Error).message.slice(0, 160)}`);
      break;
    }
  }
  await compose(urls, `stack-${stack.name}.jpg`);
}
process.exit(0);
