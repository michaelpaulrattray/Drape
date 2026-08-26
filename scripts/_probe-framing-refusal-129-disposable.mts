/**
 * DISPOSABLE — #129 THE REFUSAL PATROL: which clause of the numeric framing
 * sentence trips fal's content checker?
 *
 * The framing court (#130) measured the three numeric framing sentences at
 * 5/24 refused against 0/40 for today's collarbones line (both courts, all
 * arms on the locked block; Fisher p = 0.0056). F2 is the recommendation on
 * his eye item, so its refusal cost is a live question. Three arms, the brief
 * and the block byte-identical, ONLY `AUTHOR_ROAD_FRAMING[1]` swapped:
 *
 *   F2   — the court's F2 sentence verbatim (replicates 2/8)
 *   F2N  — F2's NUMBERS kept, its "crop line across the chest" clause swapped
 *          back to today's "the crop just below the collarbones"
 *   F2C  — today's sentence with ONLY the crop clause swapped to F2's
 *          "the crop line across the chest below the collarbones"
 *
 * Refusal is the datum. 24 renders × $0.0557 ≈ $1.34 ceiling (a refused
 * render is not charged). No region reads, no rows, no credits.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("this probe touches no database — refusing a production wrapper");
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const { HOUSE_BLOCK, AUTHOR_ROAD_FRAMING, DROPPED_FROM_BLOCK } = await import("../server/castingV2/houseBlock");
const { neverWrittenIn, staticPrompt } = await import("../server/castingV2/promptAuthor");

const N = Number(process.argv[2] ?? 8);
const CONCURRENCY = 6;
const BRIEF = "goth woman mid 30s";
const OUT = "output/_shift129/probe";
mkdirSync(OUT, { recursive: true });

const TODAY = AUTHOR_ROAD_FRAMING[1]!;
const K = staticPrompt(BRIEF);
if (!K.endsWith(HOUSE_BLOCK)) throw new Error("staticPrompt does not end with HOUSE_BLOCK — the road moved");
if (K.split(TODAY).length !== 2) throw new Error("today's framing line is not exactly once in the static prompt");

const TODAY_CROP = "the crop just below the collarbones";
const F2_CROP = "the crop line across the chest below the collarbones";
const F2 =
  "Frame from the chest up in a 2:3 portrait: the face takes up about a quarter of the frame's height, the eyes about 30% of the way down from the top edge, a small margin of headroom above the hair, the crop line across the chest below the collarbones, shoulders running off both edges of the frame.";
if (!F2.includes(F2_CROP)) throw new Error("F2 does not carry the chest-line clause");
if (!TODAY.includes(TODAY_CROP)) throw new Error("today's line does not carry the collarbones clause");

const ARMS: Array<{ id: string; line: string }> = [
  { id: "F2", line: F2 },
  { id: "F2N", line: F2.replace(F2_CROP, TODAY_CROP) },
  { id: "F2C", line: TODAY.replace(TODAY_CROP, F2_CROP) },
];
const cells = ARMS.map((a) => {
  const prompt = K.replace(TODAY, a.line);
  if (prompt === K) throw new Error(`${a.id}: swap did nothing`);
  if (prompt.replace(a.line, TODAY) !== K) throw new Error(`${a.id}: swap back is not byte-identical`);
  const hit = neverWrittenIn(prompt);
  if (hit) throw new Error(`${a.id}: NEVER_WRITTEN hit "${hit}"`);
  const lower = prompt.toLowerCase();
  for (const { phrase, from } of DROPPED_FROM_BLOCK) {
    if (lower.includes(phrase.toLowerCase())) throw new Error(`${a.id}: "${phrase}" (dropped from ${from}) is in the text`);
  }
  if (!lower.includes("collarbones")) throw new Error(`${a.id}: the suite pins "collarbones"`);
  writeFileSync(`${OUT}/prompt-${a.id}.txt`, prompt, "utf8");
  return { ...a, prompt };
});
console.log(`arms: ${cells.map((c) => `${c.id}(${c.prompt.length})`).join(" ")}; ${N} each`);

const before = await readFalBalance();
console.log(`fal balance before: ${before.ok ? `$${before.remaining.toFixed(2)}` : before.why}`);
const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY! });

type Row = { arm: string; n: number; refused: boolean; why?: string };
const rows: Row[] = [];
const jobs: Array<() => Promise<void>> = [];
for (const c of cells) {
  for (let n = 0; n < N; n += 1) {
    jobs.push(async () => {
      try {
        const r = await engine.generateCandidate({ prompt: c.prompt, size: "1024x1536", quality: "medium" } as never);
        writeFileSync(`${OUT}/${c.id}-${n}.png`, r.bytes);
        rows.push({ arm: c.id, n, refused: false });
        console.log(`${c.id.padEnd(4)} ${n}  delivered`);
      } catch (e) {
        const why = (e instanceof Error ? e.message : String(e)).slice(0, 160);
        rows.push({ arm: c.id, n, refused: true, why });
        console.log(`${c.id.padEnd(4)} ${n}  REFUSED  ${why}`);
      }
    });
  }
}
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      await job();
    }
  }),
);

const summary = ARMS.map((a) => {
  const mine = rows.filter((r) => r.arm === a.id);
  return { arm: a.id, n: mine.length, refused: mine.filter((r) => r.refused).length };
});
console.log("\narm  n  refused");
for (const s of summary) console.log(`${s.arm.padEnd(4)} ${s.n}  ${s.refused}`);
const after = await readFalBalance();
console.log(`fal balance after: ${after.ok ? `$${after.remaining.toFixed(2)}` : after.why}  (settles ~3 min late)`);
writeFileSync(
  `${OUT}/rows.json`,
  JSON.stringify({ brief: BRIEF, arms: ARMS, summary, rows, balance: { before, after } }, null, 2),
  "utf8",
);
console.log("PROBE EXIT");
/* The script guard: a disposable ends by ending the process (scriptExitDiscipline). */
process.exit(0);
