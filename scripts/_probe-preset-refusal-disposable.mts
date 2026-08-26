/**
 * DISPOSABLE — WHICH CLAUSE OF THE HOUSE FRAMING SENTENCE TRIPS fal's CONTENT CHECKER?
 *
 * The prompt-author court (#125, run2) found: brief (ii) — his 73-word prompt —
 * RAW delivers 8/8; the same words plus the LOW author's ONE added sentence
 * ("Chest-up framing with shoulders running off both edges of the frame, the
 * crop just below the sternum, a small margin of headroom above the hair.")
 * refuse 8/8 with `content_policy_violation`. Arm B is uninterpretable until
 * the clause is named. Two renders per variant; refusal is the datum.
 *
 * ~12 renders × $0.0557 ≈ $0.67. House money, no rows, no credits.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { createFalCreativeEngine } from "../server/providers/falImages";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");
if (process.env.MYSQL_PUBLIC_URL) throw new Error("no database here");

const BRIEF = "A photorealistic high-fashion portrait of a young woman with an intense cyber-goth aesthetic, facing the camera directly from the chest up. She has extremely pale porcelain skin and a sharp, androgynous face. Soft neutral gray studio background with seamless gradient. Dramatic yet soft frontal studio lighting that creates subtle specular highlights on the dark structured fabrics, intricate textures, and skin while keeping deep shadows. Ultra-detailed textures, sharp focus, cinematic high-fashion photography, 8k, photorealistic.";

const VARIANTS: Record<string, string> = {
  full: "Chest-up framing with shoulders running off both edges of the frame, the crop just below the sternum, a small margin of headroom above the hair.",
  chestUp: "Chest-up framing.",
  shoulders: "Shoulders running off both edges of the frame.",
  sternum: "The crop just below the sternum.",
  headroom: "A small margin of headroom above the hair.",
  collarbones: "Chest-up framing with shoulders running off both edges of the frame, the crop just below the collarbones, a small margin of headroom above the hair.",
};
/* The thin brief RAW refused 7/8 in the same run while every rich authored arm delivered
   8/8 - so the second question is whether LEANNESS itself trips the checker. */
const THIN = "goth woman mid 30s";
const THIN_VARIANTS: Record<string, string> = {
  thinRaw: THIN,
  thinPhotoreal: `${THIN}. Photorealistic casting portrait.`,
  thinStudio: `${THIN}. Photorealistic casting portrait, neutral grey seamless studio background, soft frontal studio lighting.`,
  thinWoman: "A woman in her mid 30s with goth styling. Photorealistic casting portrait, neutral grey seamless studio background, soft frontal studio lighting.",
};
const CELLS: Array<[string, string]> = [
  ...Object.entries(VARIANTS).map(([v, t]) => [v, `${BRIEF}

${t}`] as [string, string]),
  ...Object.entries(THIN_VARIANTS).map(([v, t]) => [v, t] as [string, string]),
];
const N = Number(process.argv[2] ?? 2);
const OUT = "output/_shift125/preset-refusal-probe";
mkdirSync(OUT, { recursive: true });
const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY });
const rows: Array<{ variant: string; n: number; refused: boolean; why?: string }> = [];
for (const [variant, prompt] of CELLS) {
  for (let n = 0; n < N; n += 1) {
    try {
      const r = await engine.generateCandidate({ prompt, size: "1024x1536", quality: "medium" } as never);
      writeFileSync(`${OUT}/${variant}-${n}.png`, r.bytes);
      rows.push({ variant, n, refused: false });
      console.log(`${variant.padEnd(12)} ${n}  delivered`);
    } catch (e) {
      const why = (e instanceof Error ? e.message : String(e)).slice(0, 120);
      rows.push({ variant, n, refused: true, why });
      console.log(`${variant.padEnd(12)} ${n}  REFUSED  ${why}`);
    }
  }
}
writeFileSync(`${OUT}/rows.json`, JSON.stringify({ brief: BRIEF, variants: VARIANTS, thin: THIN_VARIANTS, rows }, null, 2), "utf8");
console.log("\nrefused per variant:", CELLS.map(([v]) => `${v} ${rows.filter((r) => r.variant === v && r.refused).length}/${N}`).join(" · "));
