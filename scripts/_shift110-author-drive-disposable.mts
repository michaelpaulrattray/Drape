/**
 * DISPOSABLE — DRIVE THE REAL MAX AUTHOR N TIMES PER SEED AND KEEP EVERY DRAFT
 * (#242, the rate the card asked for).
 *
 * # Why a drive, when the card said a census would do it
 *
 * #242's own next step was *"a census over production rows is a read, not a
 * drive"*. It was tried first and it does not answer the question: read at
 * both databases this shift, the ENTIRE recorded author-text population is
 * **five drafts** (four production, one dev) and none of them carries a
 * candidate clause. The card's specimen was never a roll — it came from
 * foreman-101's #237 drive, and lives in `output/_shift101-lane/author-3.txt`.
 * A rate cannot be taken from five rows, so it is bought instead, at text
 * prices.
 *
 * # What it spends, stated before it fires (THE SPEND THRESHOLD)
 *
 * `AUTHOR CALLS = SEEDS × N` text calls and NOTHING else — no render, no
 * segmenter read, no credit, no row. Estimated **~$0.35** at 24 calls
 * (~2,000 in / ~500 out per call, Sonnet 5 through OpenRouter); far under the
 * $50 line, so it runs and reports rather than asking. The balance is read
 * before and after so the ACTUAL lands beside the estimate.
 *
 * # The cells, and why each is on the record rather than invented
 *
 *   A  the sphinx seed — production roll 235's and 232's own brief, byte for
 *      byte, driven in the CREATURE lane. It is the cell that produced the
 *      specimen, so it is the one cell with a known positive.
 *   B  the founder's FINISHED cyber-goth specimen (#171's drive). The
 *      finished-seed rule — keep the facts, add no new nouns — is where the
 *      instruction most invites the author to narrate what it did not add, so
 *      this is the highest-prior cell.
 *   C  the thin seed (#171's other cell). The ordinary case, and the control
 *      for "does this happen at all when the author has room to invent".
 *
 * Nothing is judged here. Drafts are written to disk and read by
 * `_shift110-selfnarration-census-disposable.mts --drafts <dir>`, which holds
 * the ONE cue list (working law 4 — the detector does not get a second copy).
 *
 * ⚠ TEE THE RUN. The re-ask REASON is written by `promptAuthor`'s logger and is
 * not on the manifest — the first run of this script was read from its tail and
 * two of eighteen refusal reasons were lost, which turned an exact breakdown
 * into a floor. Until the manifest carries the reason, the log IS the artifact:
 *
 *   npx tsx scripts/_shift110-author-drive-disposable.mts --n 8 2>&1 | tee output/_shift110-author-drive/run.log
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { authorPrompt } from "../server/castingV2/promptAuthor";
import { interpreterEngine } from "../server/castingV2/interpreter";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

const flag = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
};
const N = Number(flag("n") ?? 8);
const OUT = "output/_shift110-author-drive";

/** Production roll 235's seed, byte for byte (and roll 232's) — quoted from foreman-101's lane drive. */
const SPHINX =
  "Adult feline humanoid, hairless violet-blue skin, large ears, amber eyes, long tail. "
  + "Powerful sphinx-cat presence. Dark structured armour in bronze, gold and coloured inlay.";

/** The founder's own finished specimen, quoted from `_drive-author-5g-disposable.mts` (#171). */
const FINISHED =
  "A photorealistic high-fashion portrait of a young woman with an intense cyber-goth aesthetic, facing the camera "
  + "directly from the chest up. She has extremely pale porcelain skin and a sharp, androgynous face. Soft neutral "
  + "gray studio background with seamless gradient. Dramatic yet soft frontal studio lighting that creates subtle "
  + "specular highlights on the dark structured fabrics, intricate textures, and skin while keeping deep shadows. "
  + "Ultra-detailed textures, sharp focus, cinematic high-fashion photography, 8k, photorealistic.";

/** The thin seed, quoted from the same drive. */
const THIN = "goth woman mid 30s";

const CELLS = [
  { key: "A-sphinx", briefText: SPHINX, lane: "creature" as const, statedAge: null },
  { key: "B-finished", briefText: FINISHED, lane: "human" as const, statedAge: null },
  { key: "C-thin", briefText: THIN, lane: "human" as const, statedAge: { band: "30s", phase: "mid" } },
];

const engine = interpreterEngine();
if (!engine) {
  console.error("no text engine configured (OPENROUTER_API_KEY) — nothing driven, nothing spent");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

/*
  ⚠ A POSITION, NOT A SPEND METER — `openrouterBalance.mts`'s own docblock and
  INSTRUMENT DOCTRINE #25. A before/after difference is the cost of this run
  ONLY if the charge has landed and nothing else moved the account, and neither
  holds by default. It is printed as an INDICATION beside the estimate, and a
  delta that is zero or negative is reported as UNMEASURED rather than cheap.
*/
const before = await readOpenRouterBalance().catch(() => null);
console.log(`balance before: ${before ? JSON.stringify(before) : "UNREAD"}`);
console.log(`driving ${CELLS.length} cells × ${N} = ${CELLS.length * N} MAX author calls`);
console.log("");

const manifest: Array<Record<string, unknown>> = [];
let failures = 0;

for (const cell of CELLS) {
  for (let i = 0; i < N; i += 1) {
    const label = `${cell.key}-${i}`;
    try {
      const out = await authorPrompt({
        engine,
        briefText: cell.briefText,
        imagination: "max",
        lane: cell.lane,
        statedAge: cell.statedAge as never,
      });
      const content = out.content ?? "";
      const file = `${OUT}/${label}.txt`;
      writeFileSync(file, content, "utf8");
      manifest.push({
        label,
        cell: cell.key,
        mode: out.mode,
        attempts: out.attempts,
        addedWords: out.addedWords,
        allowance: out.allowance,
        latencyMs: out.latencyMs,
        words: content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length,
        file,
      });
      console.log(
        `${label.padEnd(14)} mode ${String(out.mode).padEnd(9)} attempts ${out.attempts} `
        + `${String(content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length).padStart(4)}w ${out.latencyMs}ms`,
      );
    } catch (error) {
      failures += 1;
      console.log(`${label.padEnd(14)} THREW — ${(error as Error).message.slice(0, 120)}`);
      manifest.push({ label, cell: cell.key, threw: (error as Error).message.slice(0, 200) });
    }
  }
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2), "utf8");

const after = await readOpenRouterBalance().catch(() => null);
console.log("");
console.log(`balance after:  ${after ? JSON.stringify(after) : "UNREAD"}`);
if (before?.ok && after?.ok) {
  const delta = after.used - before.used;
  console.log(
    delta > 0
      ? `INDICATED SPEND: $${delta.toFixed(4)} over ${CELLS.length * N} calls (a position delta, not a meter)`
      : `INDICATED SPEND: UNMEASURED — the delta is ${delta.toFixed(4)}; the ledger settles late and can move on its own`,
  );
}
console.log(`drafts written to ${OUT} · ${failures} call(s) threw`);

process.exit(failures > 0 ? 1 : 0);
