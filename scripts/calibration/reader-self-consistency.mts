/**
 * HOW OFTEN DOES THE READER AGREE WITH ITSELF?
 *
 * Every arm-(a) position in the trial was verified twice by the same reader
 * with the same prompt: once by the service, before it delivered, and once by
 * the harness, re-reading the delivered image. Two samplings of one question
 * about one picture.
 *
 * Where they disagree, the net's verdict was a coin-flip at that margin — and
 * that number decides how much weight D-185's refusal can honestly carry. If
 * disagreement is common, retry-before-refuse is not generosity but the only
 * thing standing between a fallible reader and a wrongly refunded render.
 *
 *   npx tsx scripts/calibration/reader-self-consistency.mts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { readFileSync, writeFileSync } from "node:fs";

import { getDb } from "../../server/db/connection";
import { castingCandidateVariants, castingCandidates, users } from "../../drizzle/schema";

const OUT = "output/two-reference-trial";
type Cell = {
  chain: number;
  position: number;
  instruction: string;
  aChecks: Array<{ facet: string; asked: string; verified: boolean; binding?: boolean }>;
};

const cells: Cell[] = JSON.parse(readFileSync(`${OUT}/results.json`, "utf8"));
const db = await getDb();
if (!db) throw new Error("no db");
const [bot] = await db.select().from(users).where(eq(users.openId, "verify-bot-local")).limit(1);

const rows = await db
  .select({
    requestText: castingCandidateVariants.requestText,
    internalPrompt: castingCandidateVariants.internalPrompt,
    createdAt: castingCandidateVariants.createdAt,
  })
  .from(castingCandidateVariants)
  .innerJoin(castingCandidates, eq(castingCandidates.id, castingCandidateVariants.candidateId))
  .where(eq(castingCandidateVariants.userId, bot!.id))
  .orderBy(castingCandidateVariants.id);

/* Newest first, so a re-used instruction resolves to this trial's render. */
const stored = new Map<string, Array<{ facet: string; asked: string; verified: boolean }>>();
for (const row of rows) {
  const prompt = row.internalPrompt as {
    verification?: { checks?: Array<{ facet: string; asked: string; verified: boolean }> };
  } | null;
  const checks = prompt?.verification?.checks;
  if (row.requestText && checks) stored.set(row.requestText, checks);
}

let agreed = 0;
let disagreed = 0;
const detail: string[] = [];

for (const cell of cells) {
  const serviceChecks = stored.get(cell.instruction);
  if (!serviceChecks) continue;
  for (const reread of cell.aChecks) {
    const original = serviceChecks.find((check) => check.facet === reread.facet
      && check.asked === reread.asked);
    if (!original) continue;
    if (original.verified === reread.verified) agreed += 1;
    else {
      disagreed += 1;
      detail.push(
        `chain ${cell.chain} #${cell.position} ${reread.facet} "${reread.asked}": `
        + `service said ${original.verified}, re-read said ${reread.verified}`,
      );
    }
  }
}

const total = agreed + disagreed;
const lines = [
  "# Reader self-consistency",
  "",
  `Same reader, same prompt, same image, two samplings — ${total} paired judgements.`,
  "",
  `- agreed: **${agreed}** (${total ? Math.round((agreed / total) * 100) : 0}%)`,
  `- disagreed: **${disagreed}** (${total ? Math.round((disagreed / total) * 100) : 0}%)`,
  "",
  ...(detail.length ? ["## Where it changed its mind", "", ...detail.map((line) => `- ${line}`)] : []),
];
const report = lines.join("\n");
writeFileSync(`${OUT}/reader-self-consistency.md`, report);
console.log(report);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
