/**
 * DISPOSABLE — #1612 part 3's FIRST ACT, and it is deliberately not a court arm.
 *
 * # The one question this answers, and why it gates the design
 *
 * Nano Banana Pro reads its output SHAPE off its references. Measured on the
 * real door in #1278, re-read at the bytes tonight rather than quoted:
 *
 *     frontFull, master only ........................ 1696x2528   (0.6709)
 *     frontFull, master + a 3:4 plate panel ......... 1792x2400   (0.7467)
 *     frontFull, master + plate, aspect_ratio 2:3 ... 1696x2528   restored
 *
 * So an extra reference DRAGS the delivered picture's shape toward its own, and
 * path E therefore pins the ratio only on the two views that carry a plate.
 * **A framing template adds a reference to views that have never carried one.**
 * Unpinned and unmeasured, that ships a five-view package whose views are
 * different shapes from each other — a thing a customer sees at a glance in a
 * strip of five and no test would have failed.
 *
 * The anchor is 1024x1536, which is exactly 2:3, and the templates are made at
 * 1024x1536 for that reason — so the prediction is that nothing moves. A
 * prediction is not a reading.
 *
 * # The three arms
 *
 *   A  anchor only, no pin ............ what this view ships TODAY (the baseline)
 *   B  anchor + template, no pin ...... did the template move it?
 *   C  anchor + template, pinned 2:3 .. does the pin restore A?
 *
 * Ship C only if A !== B; ship B's shape with no pin if A === B. Either way the
 * answer is read off the returned PNG's own header.
 *
 * ⚠ **THE DIMENSIONS ARE READ FROM THE BYTES, NEVER FROM `image.width`.** #1278's
 * own `rows.json` recorded `"width": null` on all five of its renders — the fal
 * door does not always populate it, and its three famous readings were taken off
 * the saved files afterwards. A shape check that trusted that field would have
 * recorded nothing at all and said so in a table.
 *
 * Spends HOUSE money only: 9 renders on the signed-view door at the measured
 * $0.11–$0.15 each, ~$1.20, ~3 minutes. **No customer credits, no database, no
 * storage writes, no judge calls.**
 *
 *   npx tsx scripts/_1612-template-shape-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalIdentityEngine } from "../server/providers/falQueue";
import { composePackageViewPrompt } from "../server/castingV2/castViewPackage";
import { framingTemplateClause } from "../server/castingV2/viewFramingTemplate";
import { pronounsForSex } from "../server/castingV2/castPronouns";
import { PLATE_VIEW_ASPECT_RATIO } from "../server/castingV2/outfitPlate";
import { readFalBalance } from "./lib/falSpend.mts";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY in .env");

const OUT = "output/1612-part3";
mkdirSync(OUT, { recursive: true });

/* Sifr, cast #55 — #1278's own fixture, so arm A is directly comparable to a
   reading already on the record rather than to a fresh unknown. Both values are
   pasted from that court, which read them out of production read-only. */
const ANCHOR_URL =
  "https://pub-990e39d8d995468eb61aced83162123a.r2.dev/casting-v2/casts/"
  + "bc0dc109-932c-477b-8189-3d42c8f2d400/anchor/af95429b-ba5d-40f6-b53b-617fe0a5afd4.png";
const BRIEF =
  "A pale, slightly androgynous cyberpunk woman with short, messy silver-grey hair and heavy "
  + "black makeup that can read as either elegant or damaged depending on the artist. She wears a "
  + "white, body-conscious dress that mixes qipao structure with industrial straps, buckles, and a "
  + "worn graphic on the chest, leaving the exact cut, hardware, and weathering open. Dense tattoos "
  + "cover one arm and parts of her body, but their style, density, and placement can shift. The "
  + "overall presence should feel cold, stylish, and quietly intense — a street-level futurist that "
  + "different versions can interpret without losing the same core look.";

const ANGLES = ["closeUp", "frontFull", "backFull"] as const;
const pronouns = pronounsForSex("female");

const anchorResponse = await fetch(ANCHOR_URL);
if (!anchorResponse.ok) throw new Error(`anchor ${anchorResponse.status}`);
const anchor = {
  bytes: Buffer.from(await anchorResponse.arrayBuffer()),
  contentType: "image/png",
};
const anchorMeta = await sharp(anchor.bytes).metadata();
console.log(`anchor ${anchorMeta.width}x${anchorMeta.height}`);

const engine = createFalIdentityEngine({ apiKey });
const before = await readFalBalance();
console.log(`fal balance BEFORE: ${JSON.stringify(before)}`);

type Row = {
  angle: string;
  arm: string;
  width: number | null;
  height: number | null;
  ratio: string | null;
  reportedWidth: number | null;
  bytes: number;
  latencyMs: number;
  file: string;
};
const rows: Row[] = [];

for (const angle of ANGLES) {
  const templatePath = `assets/views/${angle}-framing-template.png`;
  const template = {
    bytes: readFileSync(templatePath),
    contentType: "image/png",
  };
  const templateMeta = await sharp(template.bytes).metadata();
  console.log(`template ${angle}: ${templateMeta.width}x${templateMeta.height}`);

  const base = composePackageViewPrompt(angle, null, BRIEF, { pronouns });
  /* Ordinal 2 — anchor is 1, no crops and no plate on this fixture. DERIVED
     from the array below in the product; stated here because this script builds
     that array itself. */
  const withTemplate = [base, framingTemplateClause({ ordinal: 2, pronouns })].join("\n");

  const arms = [
    { arm: "A-anchor-only", references: [anchor], prompt: base, pin: false },
    { arm: "B-template", references: [anchor, template], prompt: withTemplate, pin: false },
    { arm: "C-template-pinned", references: [anchor, template], prompt: withTemplate, pin: true },
  ];

  for (const { arm, references, prompt, pin } of arms) {
    writeFileSync(`${OUT}/prompt-${angle}-${arm}.txt`, prompt, "utf8");
    console.log(`rendering ${angle} ${arm} …`);
    const image = await engine.generateView({
      ...(pin ? { aspectRatio: PLATE_VIEW_ASPECT_RATIO } : {}),
      prompt,
      references,
      resolution: "2K",
      viewAngle: angle,
    });
    const file = `shape-${angle}-${arm}.png`;
    writeFileSync(`${OUT}/${file}`, image.bytes);
    const meta = await sharp(image.bytes).metadata();
    const width = meta.width ?? null;
    const height = meta.height ?? null;
    rows.push({
      angle,
      arm,
      width,
      height,
      ratio: width && height ? (width / height).toFixed(4) : null,
      reportedWidth: image.width ?? null,
      bytes: image.bytes.length,
      latencyMs: image.latencyMs,
      file,
    });
    console.log(`  bytes say ${width}x${height} (engine reported ${image.width ?? "null"}), ${image.latencyMs} ms`);
  }
}

const after = await readFalBalance();
console.log(`fal balance AFTER: ${JSON.stringify(after)}`);

writeFileSync(
  `${OUT}/shape-rows.json`,
  JSON.stringify({ card: 1612, part: 3, what: "the shape check", anchor: ANCHOR_URL, balance: { before, after }, rows }, null, 1),
  "utf8",
);

console.log("");
console.log("angle        arm                  bytes say      ratio");
for (const row of rows) {
  console.log(
    `${row.angle.padEnd(12)} ${row.arm.padEnd(20)} ${String(`${row.width}x${row.height}`).padEnd(14)} ${row.ratio}`,
  );
}
console.log("");
for (const angle of ANGLES) {
  const of = (arm: string) => rows.find((row) => row.angle === angle && row.arm.startsWith(arm));
  const a = of("A");
  const b = of("B");
  const c = of("C");
  const same = (x?: Row, y?: Row) => Boolean(x && y && x.width === y.width && x.height === y.height);
  console.log(
    `${angle.padEnd(12)} B moved it: ${same(a, b) ? "NO" : "YES"} · the pin restores A: ${same(a, c) ? "YES" : "NO"}`,
  );
}

process.exit(0);
