/**
 * DO FILED CROPS RIDE THE NEXT RENDER? — the reproduction. (fable-590 §3: 50
 * dev credits, approved, after the free readings.)
 *
 * His shape, exactly: one ask that delivers a pair (the crops file), then an
 * unrelated edit. The question the database cannot answer is what the second
 * render CARRIED, because nothing stores it — so this runs the real service
 * in-process and reads the render's own line about itself.
 *
 * ```
 * 1  "give her dangly cross earrings"   → both sides file, with crops
 * 2  "her right eye — fiery red"        → what did it carry?
 * ```
 *
 * Every line is teed to disk as it happens, because this SPENDS: a run whose
 * output has to be re-read is a run somebody pays for twice.
 *
 *   npx tsx scripts/reproduce-carry-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

import { teeTo } from "./lib/benchKit.mts";
import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const OUT = "output/carry-reproduction";
mkdirSync(OUT, { recursive: true });
const say = teeTo(`${OUT}/run.txt`);
const LOG = `${OUT}/server.log`;
writeFileSync(LOG, "");

if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
  throw new Error("dev only — this SPENDS and renders");
}

const outsider = await ensureOutsider();
process.env.CASTING_REPAINT_SCOPE = `users:${outsider.id}`;
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = `users:${outsider.id}`;
process.env.ENABLE_STORAGE_CLEANUP_WORKER = "true";
process.env.LOG_LEVEL = "debug";

/* THE RENDER'S OWN LINE ABOUT ITSELF, kept: the service says what it carried
   and nothing persists it, so the log IS the artifact here. */
const stdout = process.stdout.write.bind(process.stdout);
(process.stdout as unknown as { write: typeof stdout }).write = ((chunk: unknown, ...rest: unknown[]) => {
  try { appendFileSync(LOG, typeof chunk === "string" ? chunk : String(chunk)); } catch { /* the log is a courtesy */ }
  return stdout(chunk as never, ...(rest as []));
}) as typeof stdout;

const conn = await openDatabase(process.env.DATABASE_URL);
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};
const [casts] = await conn.execute(
  `SELECT c.publicId, COUNT(v.id) AS versions
     FROM casting_candidates c LEFT JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE c.userId = ? AND c.status = 'ready'
    GROUP BY c.id ORDER BY versions DESC LIMIT 1`,
  [outsider.id],
);
const candidatePublicId = (casts as Array<{ publicId: string }>)[0]!.publicId;
const { refineCandidate } = await import("../server/castingV2/refineService.js");

const ask = async (instruction: string) => {
  const before = await balance();
  const started = Date.now();
  let kind = "";
  try {
    const result = await refineCandidate({}, {
      userId: outsider.id, clientRequestId: randomUUID(), candidatePublicId, instruction,
    });
    kind = result.kind ?? "?";
  } catch (error) {
    kind = `THREW: ${error instanceof Error ? error.message.slice(0, 90) : String(error)}`;
  }
  const after = await balance();
  say(`  "${instruction}" → ${kind} · ${before - after} credits · ${Math.round((Date.now() - started) / 1000)}s`);
  return { kind, spent: before - after };
};

say(`outsider ${outsider.id} · cast ${candidatePublicId} · ${await balance()} credits`);
say("");
say("STEP 1 — the pair");
await ask("give her dangly cross earrings");

const [filed] = await conn.execute(
  `SELECT slot, storageKey IS NOT NULL AS crop, digest IS NOT NULL AS digest, refusedReason
     FROM casting_reference_library WHERE userId = ? ORDER BY id DESC LIMIT 4`,
  [outsider.id],
);
say("  the library now holds:");
for (const row of filed as Array<Record<string, unknown>>) {
  say(`    ${String(row.slot).padEnd(16)} ${row.refusedReason ? `REFUSED ${row.refusedReason}` : "filed"}`
    + ` · crop ${row.crop ? "yes" : "no"} · digest ${row.digest ? "yes" : "no"}`);
}

say("");
say("STEP 2 — an unrelated edit, and what it carried");
await ask("her right eye — fiery red");

const lines = (await import("node:fs")).readFileSync(LOG, "utf8").split("\n");
const repaints = lines.filter((line) => line.includes("repainted the whole frame"));
say("");
say("the render's own line about itself:");
for (const line of repaints.slice(-2)) {
  try {
    const parsed = JSON.parse(line);
    say(`  edited ${JSON.stringify(parsed.edited)} · carried ${JSON.stringify(parsed.carried)}`
      + ` · standing ${JSON.stringify(parsed.standing)} · keys ${(parsed.keys ?? []).length}`);
  } catch {
    say(`  ${line.slice(0, 200)}`);
  }
}
say("");
say(`ledger: ${await balance()} credits left`);
writeFileSync(`${OUT}/repaints.json`, `${JSON.stringify(repaints, null, 2)}\n`);
await conn.end();
process.exit(0);
