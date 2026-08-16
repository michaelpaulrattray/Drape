/**
 * THE PRESERVATION CLAUSE, ON PAID RENDERS (D-166).
 *
 * # This driver exists because the last three did not read the tail
 *
 * The pink case has been "passing" for two rounds. D-159's driver asserted the
 * INSTRUCTION lane — which was correct — while the boilerplate lane quietly said
 * "the same hair" and the model believed it. No instrument in the repo read the
 * tail at all.
 *
 * So this one reads the PERSISTED PROMPT and prints it whole (D-164). The
 * picture is for the eye; the string is the evidence.
 *
 *   npx tsx scripts/drive-preservation.mts
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
const pool = [...all].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));

async function storedPrompt(publicId: string): Promise<string> {
  const [row] = await db!
    .select({ internalPrompt: castingCandidateVariants.internalPrompt })
    .from(castingCandidateVariants)
    .where(eq(castingCandidateVariants.publicId, publicId))
    .limit(1);
  const internal = (row?.internalPrompt ?? {}) as { prompt?: unknown };
  return typeof internal.prompt === "string" ? internal.prompt : "";
}

async function strip(urls: string[], name: string): Promise<void> {
  const W = 400;
  const cells: Buffer[] = [];
  for (const url of urls) {
    cells.push(await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).resize(W).toBuffer());
  }
  const meta = await sharp(cells[0]).metadata();
  const out = await sharp({
    create: { width: W * cells.length + 10 * (cells.length - 1), height: meta.height!, channels: 3, background: "#111111" },
  })
    .composite(cells.map((input, i) => ({ input, left: i * (W + 10), top: 0 })))
    .jpeg({ quality: 86 })
    .toBuffer();
  writeFileSync(`docs/specs/evidence/refine/${name}`, out);
  console.log(`     wrote ${name}`);
}

/* Two faces, because the founder met this on two — one copper-family, one dark. */
const only = process.argv[2];
for (const [index, label] of [[0, "face-a"], [1, "face-b"]] as const) {
  if (only && only !== label) continue;
  const candidate = pool[index]!;
  console.log(`\n=== ${label}: copper, then pastel pink ===`);
  await selectVariant({ userId: bot!.id, candidatePublicId: candidate.publicId, variantPublicId: null });

  const urls = [storagePublicUrl(candidate.imageKey!)];
  let lastId = "";
  for (const instruction of ["copper hair", "pastel pink hair"]) {
    const started = Date.now();
    /* ONE retry on an unreadable reply. The interpreter already re-samples
       internally; an empty completion twice running is the provider having a
       moment, not the instruction being unclear, and it must not read as a
       driver failure. */
    let result;
    try {
      result = await refineCandidate({}, {
        userId: bot!.id, clientRequestId: randomUUID(),
        candidatePublicId: candidate.publicId, instruction,
      });
    } catch (error) {
      console.log(`  retrying "${instruction}" — ${(error as Error).message.slice(0, 60)}`);
      result = await refineCandidate({}, {
        userId: bot!.id, clientRequestId: randomUUID(),
        candidatePublicId: candidate.publicId, instruction,
      });
    }
    console.log(`  "${instruction}" -> ${result.kind} (${Math.round((Date.now() - started) / 1000)}s)`);
    urls.push(result.imageUrl);
    lastId = result.variantId!;
  }

  const prompt = await storedPrompt(lastId);
  /* THE TAIL, read for the first time by any instrument in this repo. */
  check("asks for pink", /pastel pink/i.test(prompt));
  check("never asks for copper", !/copper/i.test(prompt));
  check("does NOT promise the same hair", !/the same hair(?=[,.]| and )/.test(prompt),
    prompt.match(/the same hair[^,.]*/)?.[0] ?? "");
  check("does NOT promise the same hair colour", !/the same hair colour/.test(prompt));
  /* And the untouched siblings ARE still protected — the category broke up
     rather than being abandoned wholesale. */
  check("still protects the haircut", /the same haircut/.test(prompt));
  check("still protects worn things", /anything worn in the reference/.test(prompt));
  check("still protects the shoot", /the same clothing/.test(prompt) && /the same background/.test(prompt));

  console.log("\n  ---- the persisted prompt, whole (D-164) ----");
  console.log(prompt.split(/(?<=\.)\s+/).map((line) => `  ${line}`).join("\n"));
  console.log("  ---- end ----\n");

  await strip(urls, `d166-${label}-copper-then-pink.jpg`);
}

console.log(failures === 0 ? "\nPRESERVATION: ALL CASES PASS." : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
