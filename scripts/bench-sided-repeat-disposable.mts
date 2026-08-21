/**
 * THE SIDED PHRASE, THREE TIMES A SIDE — because 1-of-2 is not a verdict.
 *
 * The first pass of the asymmetric bench put one paint on each side. The plain
 * wording stripped both ears on both sides; the sided wording delivered a clean
 * asymmetry on her LEFT and stripped both ears on her RIGHT. A rate whose n is
 * one paint is not a rate, and the campaign has paid for that lesson twice, so
 * each side is repainted three times here and every frame is adjudicated BY EYE
 * from a band crop rather than by a reader that has already produced two false
 * passes on these very frames (its readings are printed beside, advisory).
 *
 * Same specimen, same later ask, same library shape as the first pass — only
 * the count changes.
 *
 *   npx tsx scripts/bench-sided-repeat-disposable.mts
 *   PAINTS=2 SIDES=left npx tsx scripts/bench-sided-repeat-disposable.mts
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { askedObjectOnEachEar } from "./lib/askedObject.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { deriveLibrary, libraryWithoutEditedCrops, type StoredReference } from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { repaint, type ReferenceBytes } from "../server/castingV2/repaintRender";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { slotDefinition } from "../server/castingV2/referenceSlotCatalogue";
import { slotWordsRefusal } from "../server/castingV2/slotWordShape";

const OUT = "output/shift64-sided-repeat";
const FACE = "4c98c7fc-453c-4666-9a2c-86a393ade900";
const SPECIMEN = "output/shift63-removal-synthesis/4c98c7fc-earring-00-specimen.png";
const PAINTS = Number(process.env.PAINTS ?? 3);
const SIDES = (process.env.SIDES ?? "left,right").split(",") as Array<"left" | "right" | "both">;
const ASKED = "a small gold hoop earring";
const LATER = { hairColour: "copper" } as any;
const sided = (side: "left" | "right") =>
  `no earring on her ${side} ear — that earlobe bare, nothing hanging from it`;

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const [faces] = await connection.query<any[]>(
  "SELECT id, publicId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
);
const face = faces[0];
await connection.end();
await mkdir(OUT, { recursive: true });

const specimenBytes = await readFile(SPECIMEN);
const meta = await sharp(specimenBytes).metadata();
const width = meta.width ?? 1024;
const height = meta.height ?? 1536;
const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });
const SYNTHETIC = "synthetic:4c98c7fc:earrings";

const vacancyRow = (side: "left" | "right"): StoredReference => {
  const slot = `earring@${side}`;
  const definition = slotDefinition(slot as any)!;
  const phrase = sided(side);
  const refusal = slotWordsRefusal(slot, [phrase]);
  if (refusal !== null) throw new Error(`${slot} would refuse "${phrase}": ${refusal.reason}`);
  return {
    id: -1, publicId: `in-memory:${slot}`, candidateId: face.id, variantId: null,
    role: "vacancy", slot: slot as any, tier: definition.tier, noun: definition.noun,
    words: [phrase],
    storageKey: null, maskKey: null, digest: null, geometry: null, guard: null,
    refusal: null, version: 99, retiredAt: null, createdAt: new Date(),
  };
};

/** The ear band, wide enough that a lobe cannot fall outside it. */
const band = async (bytes: Buffer, into: string): Promise<void> => {
  await sharp(bytes).extract({ left: 200, top: 300, width: 624, height: 400 })
    .resize({ width: 1250 }).png().toFile(into);
};

const report: any[] = [];
for (const side of SIDES) {
  for (let at = 1; at <= PAINTS; at += 1) {
    /* "both" is the shipping case — "take her earrings off" vacates each lobe
       and files a row under each, so the recipe says a per-side sentence twice. */
    const rows = side === "both"
      ? [vacancyRow("left"), vacancyRow("right")]
      : [vacancyRow(side)];
    const asks = repaintAsksFor({ pronouns: { subject: "she", object: "her", possessive: "her", plural: false }, delta: LATER, prose: EDIT_PROSE, restore: { state: LATER, slots: [] } });
    if (!asks.ok) throw new Error(`the asks refused — ${asks.reason}`);
    const recipe = assembleRecipe({
      master: { key: SYNTHETIC },
      pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
      library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((ask) => ask.slot))),
      asks: asks.asks,
    });
    if (!recipe.ok) throw new Error(`the recipe refused — ${recipe.reason}`);
    for (const row of rows) {
      if (!recipe.prompt.includes(row.words[0]!)) throw new Error("a phrase is not in the prompt — nothing below would mean anything");
    }

    const painted = await repaint({
      recipe, engine, width, height,
      load: async (image): Promise<ReferenceBytes> => (
        image.key === SYNTHETIC ? { bytes: specimenBytes, contentType: "image/png" } : (() => { throw new Error(`unexpected reference ${image.key}`); })()
      ),
    });
    if (!painted.ok) throw new Error(`refused at the door — ${painted.reason}`);

    const file = path.join(OUT, `her-${side}-${String(at).padStart(2, "0")}.png`);
    await writeFile(file, painted.frame.bytes);
    const look = path.join(OUT, `her-${side}-${String(at).padStart(2, "0")}-BAND.png`);
    await band(painted.frame.bytes, look);

    /* Advisory only — the verdict on these frames is taken by eye from the band
       crop. Printed because a reader that disagrees with the picture is itself
       a finding worth keeping. */
    const readings = await askedObjectOnEachEar(painted.frame.bytes, ASKED, Math.round(width / 2));
    const hers = {
      left: readings.find((reading) => reading.side === "right")!,
      right: readings.find((reading) => reading.side === "left")!,
    };
    console.log(`her ${side}, paint ${at} → ${look}`);
    console.log(`  reader says: her left ${hers.left.occluded ? "hidden" : hers.left.wearing ? "WEARING" : "bare"}`
      + ` · her right ${hers.right.occluded ? "hidden" : hers.right.wearing ? "WEARING" : "bare"}`);
    console.log(`    her left:  "${hers.left.saw}"`);
    console.log(`    her right: "${hers.right.saw}"`);
    report.push({ side, at, file, look, hers });
  }
}

await writeFile(path.join(OUT, "repeat.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.length} paints. The verdict is taken from the BAND crops by eye; the reader's lines above are advisory.`);
process.exit(0);
