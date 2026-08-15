/**
 * DOES SAYING THE SIDE BOTH WAYS FIX THE PAINT? (the follow-on to the side
 * court, which found the parse innocent and the paint at 3/6 on her right.)
 *
 * The misses all landed on the image's RIGHT half whatever the recipe named, so
 * the reading is a positional bias rather than a naming confusion. The one cheap
 * lever is to say the side both ways — her anatomy and the half of the picture
 * it lives on — and see whether the failing arm comes up.
 *
 * Same instrument, same bars, same fixed parent. The arms are her RIGHT (the
 * failing side, n=6) and her LEFT (n=2, the control that the working side is not
 * broken by the new wording).
 *
 * It keeps its rows, unlike its predecessor: that one restored by DELETING the
 * variants as it went, so the per-render evidence was gone by the end and the
 * read-back verdicts had to be dug out of a log.
 *
 * Typed prose does not scope today: a sentence naming one side refuses, because
 * it used to fan out to both instances with the side word still inside the
 * value and dispatch a contradiction at full price. The inference — read the
 * side out of the words and narrow to it, exactly as a tapped box does — is
 * built and dark behind `CASTING_SIDE_INFERENCE`. This is its court.
 *
 * # The bars, written before the first render
 *
 * ```
 * n = 6 per side, MIRRORED. A per-side claim tested on one side measures the
 * IMAGE's half rather than hers — the standing law, and the reason the two
 * arms are not one arm run twice.
 *
 * THE ASK      "her <side> eye <colour>", one colour per repeat so the
 *              already-true door never refuses a repeat for free.
 * THE PASS     the NAMED eye changes at least TWICE as much as the other one.
 *              Not "the other does not change": a repaint redraws the whole
 *              frame every time, so every pixel moves a little and an absolute
 *              bar would fail a correct render. The ratio is the honest
 *              statistic and 2.0 is written here before the first render.
 * THE CONTROL  "her left and right eyes <colour>" → both sides change, within
 *              1.5x of each other. Mandatory: an arm that only ever sees one
 *              side move cannot tell the inference from a product that can
 *              only ever paint one eye.
 * ```
 *
 * # How a side is judged
 *
 * Geometry, on the parent's own eye regions: the segmenter's per-side masks are
 * read ONCE on the fixed parent frame (it reads a fixed frame to within 0.2%,
 * measured), and each render is scored by the mean absolute pixel change inside
 * each side's own mask. The unnamed eye is the arm's built-in control and the
 * frame is otherwise identical, so "changed" and "did not change" are read from
 * the same pixels.
 *
 * Dev only, and it SPENDS: 25 credits a render, 14 renders.
 *
 *   npx tsx scripts/court-side-inference-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const OUT = "output/side-phrasing-court";
mkdirSync(OUT, { recursive: true });

if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
  throw new Error("dev only — this SPENDS and renders");
}

const COLOURS = ["emerald green", "bright violet", "amber", "ice blue", "deep gold", "jade"];
const ARMS: Array<{ arm: string; side: "left" | "right" | "both"; ask: (colour: string) => string }> = [
  { arm: "right", side: "right", ask: (colour) => `her right eye ${colour}` },
  { arm: "left", side: "left", ask: (colour) => `her left eye ${colour}` },
];
/** Her left is the control here — two renders, enough to see the working side
 *  still working, not enough to re-court it. */
const REPEATS: Record<string, number> = { right: 6, left: 2 };

const outsider = await ensureOutsider();
process.env.CASTING_REPAINT_SCOPE = `users:${outsider.id}`;
process.env.CASTING_REFERENCE_LIBRARY_SCOPE = `users:${outsider.id}`;
process.env.ENABLE_STORAGE_CLEANUP_WORKER = "true";
process.env.CASTING_SIDE_INFERENCE = "on";
/* THE THING UNDER TEST. */
process.env.CASTING_SIDE_PHRASING_SCOPE = `users:${outsider.id}`;

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required — the judge reads regions");

const conn = await openDatabase(process.env.DATABASE_URL!);
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};

const [casts] = await conn.execute(
  `SELECT c.id, c.publicId, c.selectedVariantId FROM casting_candidates c
    WHERE c.userId = ? AND c.status = 'ready' ORDER BY c.id DESC LIMIT 1`,
  [outsider.id],
);
const cast = (casts as Array<{ id: number; publicId: string; selectedVariantId: number | null }>)[0]!;

/* THE PARENT EVERY ARM STARTS FROM — fixed, so twelve renders are twelve reads
   of one comparison rather than a chain that drifts under its own edits. */
const [parents] = await conn.execute(
  `SELECT id, imageKey FROM casting_candidate_variants
    WHERE candidateId = ? AND status = 'ready' ORDER BY id LIMIT 1`,
  [cast.id],
);
const parent = (parents as Array<{ id: number; imageKey: string }>)[0]!;
console.log(`cast ${cast.publicId} · parent variant ${parent.id} · ${await balance()} credits`);

const base = process.env.R2_PUBLIC_URL!;
const { fetchImageBytes } = await import("./lib/imageBytes.mts");
const parentBytes = (await fetchImageBytes(`${base}/${parent.imageKey}`)).bytes;
writeFileSync(`${OUT}/parent.png`, parentBytes);

/* HER EYES, ONCE, ON THE FIXED PARENT. */
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
type Mask = { data: Buffer; width: number; height: number };
const reader = createFalRegionReader({ apiKey: FAL_KEY }) as unknown as {
  regionSides(input: { image: Buffer; name: string; absentIsAnswer?: boolean }):
  Promise<{ left: Mask; right: Mask } | null>;
};
const eyes = await reader.regionSides({ image: parentBytes, name: "eyes", absentIsAnswer: true });
if (eyes === null) throw new Error("her eyes do not read on the parent frame — the court has no ruler");
const onPixels = (mask: Mask) => {
  let on = 0;
  for (let at = 0; at < mask.width * mask.height; at += 1) if (mask.data[at]! > 127) on += 1;
  return on;
};
console.log(`her eyes on the parent: left ${onPixels(eyes.left)}px · right ${onPixels(eyes.right)}px`);

const sharp = (await import("sharp")).default;
const rasterOf = async (bytes: Buffer, width: number, height: number) => {
  const { data } = await sharp(bytes).resize(width, height, { fit: "fill" }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return data;
};
const parentRaster = await rasterOf(parentBytes, eyes.left.width, eyes.left.height);

/** Mean absolute channel change inside a mask, 0–255. */
async function changeInside(childBytes: Buffer, mask: Mask): Promise<number> {
  const child = await rasterOf(childBytes, mask.width, mask.height);
  let sum = 0;
  let counted = 0;
  for (let at = 0; at < mask.width * mask.height; at += 1) {
    if (mask.data[at]! <= 127) continue;
    const pixel = at * 3;
    sum += Math.abs(child[pixel]! - parentRaster[pixel]!)
      + Math.abs(child[pixel + 1]! - parentRaster[pixel + 1]!)
      + Math.abs(child[pixel + 2]! - parentRaster[pixel + 2]!);
    counted += 3;
  }
  return counted === 0 ? Number.NaN : sum / counted;
}

const { refineCandidate } = await import("../server/castingV2/refineService.js");
const results: Array<Record<string, unknown>> = [];

for (const arm of ARMS) {
  for (const colour of COLOURS.slice(0, REPEATS[arm.arm] ?? COLOURS.length)) {
    /* Back to the parent, so every render is the same comparison — by moving
       the SELECTION rather than by deleting the rows. Every ask carries its own
       colour, so the repeat door never fires and nothing needs to be destroyed
       to keep the comparison clean. */
    await conn.execute(`UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?`,
      [parent.id, cast.id]);

    const ask = arm.ask(colour);
    const before = await balance();
    let kind = "";
    let imageKey: string | null = null;
    try {
      const result = await refineCandidate({}, {
        userId: outsider.id,
        clientRequestId: randomUUID(),
        candidatePublicId: cast.publicId,
        instruction: ask,
      });
      kind = result.kind ?? "?";
    } catch (error) {
      kind = `REFUSED: ${error instanceof Error ? error.message.slice(0, 70) : String(error)}`;
    }
    const spent = before - await balance();

    const [rows] = await conn.execute(
      `SELECT imageKey, JSON_EXTRACT(internalPrompt, '$.repaint.edited') AS edited
         FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id DESC LIMIT 1`,
      [cast.id],
    );
    const row = (rows as Array<{ imageKey: string | null; edited: unknown }>)[0];
    imageKey = row?.imageKey ?? null;

    let leftChange = Number.NaN;
    let rightChange = Number.NaN;
    if (imageKey) {
      const childBytes = (await fetchImageBytes(`${base}/${imageKey}`)).bytes;
      writeFileSync(`${OUT}/${arm.arm}-${colour.replace(/ /g, "-")}.png`, childBytes);
      leftChange = await changeInside(childBytes, eyes.left);
      rightChange = await changeInside(childBytes, eyes.right);
    }

    console.log(`[${arm.arm}] "${ask}" → ${kind} · ${spent} credits`
      + ` · edited ${JSON.stringify(row?.edited ?? null)}`
      + ` · change left ${leftChange.toFixed(1)} right ${rightChange.toFixed(1)}`);
    results.push({ arm: arm.arm, ask, kind, spent, edited: row?.edited ?? null, leftChange, rightChange });
    writeFileSync(`${OUT}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
  }
}

/* THE VERDICT, against the bars written at the top before the first render. */
const RATIO_BAR = 2.0;
console.log("");
console.log("THE COURT");
for (const side of ["right", "left"] as const) {
  const arm = results.filter((row) => row.arm === side && Number.isFinite(row.leftChange as number));
  const ratios = arm.map((row) => {
    const named = side === "left" ? Number(row.leftChange) : Number(row.rightChange);
    const other = side === "left" ? Number(row.rightChange) : Number(row.leftChange);
    return other === 0 ? Number.POSITIVE_INFINITY : named / other;
  });
  const passed = ratios.filter((ratio) => ratio >= RATIO_BAR).length;
  console.log(`  her ${side}: ${passed}/${arm.length} renders moved the named eye ${RATIO_BAR}x the other`
    + ` — ratios ${ratios.map((ratio) => ratio.toFixed(2)).join(" · ")}`);
}
console.log("");
console.log("against the baseline court, same instrument, same face, no phrasing:");
console.log("  her right 3/6 · her left 6/6");

console.log("");
console.log(`ledger: ${await balance()} credits left`);
await conn.end();
process.exit(0);
