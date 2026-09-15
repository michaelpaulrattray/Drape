/**
 * DISPOSABLE — DRIVE THE REAL RE-IMAGINE AUTHOR N TIMES PER SEED AND KEEP
 * EVERY DRAFT (#242, re-pointed at the road that actually exists).
 *
 * # Why this is not the 2026-08-30 drive re-run
 *
 * #242 was measured once, at `c792d07f`, against the MAX author. **That road
 * is gone** — #535/PR #598 deleted the imagination meter and there is no
 * author call at the roll any more (`promptAuthor.ts` header; `briefCompiler
 * .ts:1322` "NO TEXT CALL HAPPENS HERE SINCE #535"). The author survives as a
 * VISIBLE press on the brief box (`reimagine.ts`), and the card's own
 * 2026-09-05 note says the re-measure runs on the NEW author "when it exists".
 * It has existed since 2026-09-06 and nobody has measured it.
 *
 * ⚠ **AND THE CARD'S CHEAP ROAD IS CLOSED ON THIS ONE.** #242 says *"a census
 * over production rows is a read, not a drive"*; that was true of MAX, whose
 * drafts landed in `register.content`. The Re-imagine procedure
 * (`routes/castingV2.ts:1396`) returns the text to the box and **persists
 * nothing** — an explicit projection, by design. So there is no population to
 * read and a drive is the only instrument left.
 *
 * # What it spends, stated before it fires (THE SPEND THRESHOLD)
 *
 * `SEEDS × N` PRESSES and nothing else — no render, no segmenter read, no
 * credit, no row, no database of any kind. A press is one text call, or two
 * when the first draft is refused and re-asked. At 3 × 8 = 24 presses that is
 * 24–48 calls; the 2026-08-30 drive indicated **$0.2641 over 24 calls**, so
 * the estimate here is **~$0.40**. Far under the $50 line, so it runs and
 * reports rather than asking. The balance is read before and after so an
 * ACTUAL lands beside the estimate.
 *
 * # The cells — the SAME three seeds, byte for byte
 *
 * Quoted from `_shift110-author-drive-disposable.mts` (recovered from
 * `c792d07f`) precisely so the two roads are comparable. A new seed here would
 * confound the road change with a brief change.
 *
 *   A  the sphinx seed — production roll 235/232's own brief. The cell that
 *      produced #242's specimen on the old road.
 *   B  the founder's FINISHED cyber-goth specimen (#171's drive).
 *   C  the thin seed — **the worst cell on the old road** (2 of 6), and the
 *      one the 2026-08-30 finding says to watch: the author narrates what it
 *      is leaving OPEN, and a thin brief leaves most open.
 *
 * Nothing is judged here. Drafts are written to disk and read by
 * `_shift110-selfnarration-census-disposable.mts --drafts <dir>`, which holds
 * the ONE cue list (working law 4 — the detector does not get a second copy).
 *
 * ⚠ TEE THE RUN. The re-ask reason is returned on `refusals` here (the old
 * road's was logger-only, which cost that run two of eighteen reasons), but
 * the engine's own warnings are still log-side:
 *
 *   npx tsx scripts/_242-reimagine-drive-disposable.mts --n 8 2>&1 | tee output/_242-reimagine-drive/run.log
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { reimagineBrief } from "../server/castingV2/reimagine";
import { authorTextEngine } from "../server/castingV2/promptAuthor";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

const flag = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
};
const N = Number(flag("n") ?? 8);
const OUT = "output/_242-reimagine-drive";

/** Production roll 235's seed, byte for byte (and roll 232's). */
const SPHINX =
  "Adult feline humanoid, hairless violet-blue skin, large ears, amber eyes, long tail. "
  + "Powerful sphinx-cat presence. Dark structured armour in bronze, gold and coloured inlay.";

/** The founder's own finished specimen (#171). */
const FINISHED =
  "A photorealistic high-fashion portrait of a young woman with an intense cyber-goth aesthetic, facing the camera "
  + "directly from the chest up. She has extremely pale porcelain skin and a sharp, androgynous face. Soft neutral "
  + "gray studio background with seamless gradient. Dramatic yet soft frontal studio lighting that creates subtle "
  + "specular highlights on the dark structured fabrics, intricate textures, and skin while keeping deep shadows. "
  + "Ultra-detailed textures, sharp focus, cinematic high-fashion photography, 8k, photorealistic.";

/** The thin seed, from the same drive. */
const THIN = "goth woman mid 30s";

const CELLS = [
  { key: "A-sphinx", briefText: SPHINX },
  { key: "B-finished", briefText: FINISHED },
  { key: "C-thin", briefText: THIN },
];

const engine = authorTextEngine();
if (!engine) {
  console.error("no text engine configured (OPENROUTER_API_KEY) — nothing driven, nothing spent");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

/*
  ⚠ A POSITION, NOT A SPEND METER — `openrouterBalance.mts`'s own docblock and
  INSTRUMENT DOCTRINE #25. A before/after difference is this run's cost ONLY if
  the charge has landed and nothing else moved the account, and neither holds
  by default. Printed as an INDICATION beside the estimate; a delta that is
  zero or negative is reported UNMEASURED rather than cheap.
*/
const before = await readOpenRouterBalance().catch(() => null);
console.log(`balance before: ${before ? JSON.stringify(before) : "UNREAD"}`);
console.log(`driving ${CELLS.length} cells × ${N} = ${CELLS.length * N} Re-imagine presses (1–2 calls each)`);
console.log("");

const manifest: Array<Record<string, unknown>> = [];
let nothings = 0;
let reasked = 0;

for (const cell of CELLS) {
  for (let i = 0; i < N; i += 1) {
    const label = `${cell.key}-${i}`;
    const outcome = await reimagineBrief({ engine, briefText: cell.briefText });
    if (outcome.attempts > 1) reasked += 1;
    if (outcome.kind === "idea") {
      const file = `${OUT}/${label}.txt`;
      writeFileSync(file, outcome.text, "utf8");
      const words = outcome.text.trim().length === 0 ? 0 : outcome.text.trim().split(/\s+/).length;
      manifest.push({
        label,
        cell: cell.key,
        kind: "idea",
        attempts: outcome.attempts,
        refusals: outcome.refusals,
        model: outcome.model,
        latencyMs: outcome.latencyMs,
        words,
        file,
      });
      console.log(
        `${label.padEnd(14)} idea     attempts ${outcome.attempts} ${String(words).padStart(4)}w `
        + `${outcome.latencyMs}ms${outcome.refusals.length > 0 ? `  re-asked: ${outcome.refusals[0].slice(0, 70)}` : ""}`,
      );
    } else {
      /*
        `nothing` is the new road's honest failure and it is VISIBLE: the box
        keeps her own words and the surface says so. On the old road the same
        double refusal silently became LOW while the sheet still said "Max"
        (#252) — which is the thing #535 deleted, so this number is not
        comparable to the old 21% and is not reported as if it were.
      */
      nothings += 1;
      manifest.push({
        label,
        cell: cell.key,
        kind: "nothing",
        attempts: outcome.attempts,
        refusals: outcome.refusals,
        latencyMs: outcome.latencyMs,
      });
      console.log(
        `${label.padEnd(14)} NOTHING  attempts ${outcome.attempts} — ${outcome.refusals.map((r) => r.slice(0, 60)).join(" | ")}`,
      );
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
      ? `INDICATED SPEND: $${delta.toFixed(4)} over ${CELLS.length * N} presses (a position delta, not a meter)`
      : `INDICATED SPEND: UNMEASURED — the delta is ${delta.toFixed(4)}; the ledger settles late and can move on its own`,
  );
}
console.log("");
console.log(`presses            ${CELLS.length * N}`);
console.log(`  re-asked once    ${reasked}`);
console.log(`  returned nothing ${nothings}  (visible on the new road — her words stand)`);
console.log(`drafts written to ${OUT}`);

process.exit(0);
