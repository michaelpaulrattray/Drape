/**
 * THE INSTRUMENT BEFORE THE NUMBER — which arithmetic the earring court's
 * readings were taken with, and whether it is the arithmetic that will apply
 * them.
 *
 * Shift 80, before building fable-436's per-side floor. Both earring courts
 * (`read-earring-court-coverage-disposable.mts`, `read-earring-side-floor-
 * disposable.mts`) measured with `coverage` — ALPHA-WEIGHTED, the "how much
 * paint lands" arithmetic. The departure gate that consumes the shipped floor
 * uses the same one (`refineService:1083` reads `coverage(seen)`), so that pair
 * is coherent.
 *
 * **The detection side is not obviously coherent.** `detectBornWorn:274` judges
 * with `binaryCoverage` — COUNTING PIXELS, which `maskGeometry` documents as the
 * presence arithmetic and which the glasses floor was measured with
 * (`wearsGlassesByPixels`). Arming the earring class puts a floor measured one
 * way under a reader that applies it the other way — the wrong-boundary class
 * with the boundary swapped for an arithmetic, and this program has paid for
 * that shape five times.
 *
 * The two collapse into one number exactly when the mask is BINARY: if every
 * byte is 0 or 255, `sum/255n === count/n` identically. So the question is
 * structural, not statistical — and it is answered by looking at the bytes.
 *
 *   npx tsx scripts/read-earring-mask-arithmetic-disposable.mts
 *
 * ~3 reads of house money. No credits, no rows, no writes.
 */
import "dotenv/config";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { binaryCoverage, coverage } from "../server/castingV2/maskGeometry";
import type { Mask } from "../server/castingV2/maskedComposite";

const DEV_BASE = "https://pub-7624aa691e414b0889b42bd217b79ec5.r2.dev/casting-v2/candidates";

/* One of each class the court holds, so the answer cannot be an artifact of a
   single kind of picture: a face wearing hoops, a visibly bare one, and one
   whose ears are behind hair. Verbatim keys from the court's own table. */
const SPECIMENS = [
  { label: "p0", key: "0f3b609e-08a8-4d0c-8fed-722c26a07af3", seen: "wearing" },
  { label: "n3", key: "1c535fb0-ca6b-4752-99cc-caf93b101120", seen: "bare, ears visible" },
  { label: "n7", key: "b80308d5-4d6b-45f0-996d-ba158690643f", seen: "ears not visible" },
];

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY ?? "" });

/** Every byte that is neither fully out nor fully in — the whole question. */
function ramp(mask: Mask): { intermediate: number; distinct: number[] } {
  const seen = new Set<number>();
  let intermediate = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    const byte = mask.data[index]!;
    seen.add(byte);
    if (byte !== 0 && byte !== 255) intermediate += 1;
  }
  return { intermediate, distinct: Array.from(seen).sort((a, b) => a - b) };
}

console.log('asked "earring" PER SIDE, and read the BYTES rather than only the total\n');
console.log(
  "face".padEnd(8) + "side".padEnd(8) + "coverage".padEnd(12) + "binary".padEnd(12)
  + "ramp px".padEnd(10) + "distinct byte values",
);
console.log("-".repeat(78));

let anyRamp = false;
let anyDisagreement = false;

for (const specimen of SPECIMENS) {
  const response = await fetch(`${DEV_BASE}/${specimen.key}.png`);
  if (!response.ok) {
    console.log(`${specimen.label.padEnd(8)}image HTTP ${response.status}`);
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const sides = await reader.regionSides!({ image: bytes, name: "earring", absentIsAnswer: true });
  if (sides === null) {
    console.log(`${specimen.label.padEnd(8)}reader gave no sides for this name`);
    continue;
  }
  for (const [side, mask] of [["left", sides.left], ["right", sides.right]] as const) {
    const alpha = coverage(mask);
    const binary = binaryCoverage(mask);
    const { intermediate, distinct } = ramp(mask);
    if (intermediate > 0) anyRamp = true;
    if (alpha !== binary) anyDisagreement = true;
    console.log(
      specimen.label.padEnd(8)
      + side.padEnd(8)
      + `${(alpha * 100).toFixed(4)}%`.padEnd(12)
      + `${(binary * 100).toFixed(4)}%`.padEnd(12)
      + String(intermediate).padEnd(10)
      + (distinct.length > 8 ? `${distinct.length} values, ${distinct[0]}…${distinct[distinct.length - 1]}` : distinct.join(", ")),
    );
  }
}

console.log(
  `\nVERDICT: ${anyRamp ? "THE MASKS CARRY A RAMP" : "every mask is strictly binary (0 / 255 only)"}`
  + ` — the two arithmetics ${anyDisagreement ? "DISAGREE" : "are identical on these readings"}.`,
);
console.log(
  anyRamp || anyDisagreement
    ? "  So the per-side floor must be re-derived with the arithmetic its consumer applies,\n"
      + "  and the court's banked band belongs to `coverage` alone."
    : "  So the court's banked band is a reading in BOTH arithmetics at once, and a floor\n"
      + "  derived from it may be applied by either — stated in the provenance, not assumed.",
);

process.exit(0);
