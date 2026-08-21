/**
 * DOES THE FAILURE FOLLOW THE WORD OR THE SIDE OF THE PICTURE? — the mirror
 * experiment, and it is the only cheap way to name the cause.
 *
 * On this specimen the sided vacant phrase is perfect when her LEFT ear is
 * vacated (4 of 4: her left bare, her right keeps its hoop) and useless when
 * her RIGHT is (0 of 4: both ears stripped). Two very different things produce
 * that:
 *
 *   THE WORD    the engine understands "her left" and not "her right" — a fact
 *               about language, which would survive a mirror
 *   THE PICTURE the engine is really acting on a side of the FRAME, and "her
 *               left" happens to be the side it acts on — which a mirror flips
 *
 * So the specimen is flopped horizontally (her left lobe now sits in the image's
 * LEFT half) and both sentences are said to it again. If "her left" still
 * clears her left ear, the word is what is being obeyed. If the cleared ear
 * stays on the same side of the FRAME, the words were never doing the work.
 *
 * Nothing is written to the library and no credits are spent. Verdicts are
 * taken by eye from the band crops; the reader's lines are advisory, having
 * produced three false passes on this bench already.
 *
 *   npx tsx scripts/bench-mirror-laterality-disposable.mts
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { deriveLibrary, libraryWithoutEditedCrops, type StoredReference } from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { repaint, type ReferenceBytes } from "../server/castingV2/repaintRender";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { slotDefinition } from "../server/castingV2/referenceSlotCatalogue";

const OUT = "output/shift64-mirror-laterality";
const FACE = "4c98c7fc-453c-4666-9a2c-86a393ade900";
const SPECIMEN = "output/shift63-removal-synthesis/4c98c7fc-earring-00-specimen.png";
const PAINTS = Number(process.env.PAINTS ?? 2);
const LATER = { hairColour: "copper" } as any;
const sided = (side: "left" | "right") =>
  `no earring on her ${side} ear — that earlobe bare, nothing hanging from it`;

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const [faces] = await connection.query<any[]>(
  "SELECT id FROM casting_candidates WHERE publicId = ?", [FACE],
);
const face = faces[0];
await connection.end();
await mkdir(OUT, { recursive: true });

/* THE MIRROR. `flop` is a horizontal flip: every anatomical side swaps the half
   of the frame it lives in, and nothing else about the picture changes. */
const original = await readFile(SPECIMEN);
const mirrored = await sharp(original).flop().png().toBuffer();
await writeFile(path.join(OUT, "00-mirrored-specimen.png"), mirrored);
const meta = await sharp(mirrored).metadata();
const width = meta.width ?? 1024;
const height = meta.height ?? 1536;
const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });
const SYNTHETIC = "synthetic:4c98c7fc:mirrored";

const vacancyRow = (side: "left" | "right"): StoredReference => {
  const slot = `earring@${side}`;
  const definition = slotDefinition(slot as any)!;
  return {
    id: -1, publicId: `in-memory:${slot}`, candidateId: face.id, variantId: null,
    role: "vacancy", slot: slot as any, tier: definition.tier, noun: definition.noun,
    words: [sided(side)],
    storageKey: null, maskKey: null, digest: null, geometry: null, guard: null,
    refusal: null, version: 99, retiredAt: null, createdAt: new Date(),
  };
};

const band = async (bytes: Buffer, into: string): Promise<void> => {
  await sharp(bytes).extract({ left: 200, top: 300, width: 624, height: 400 })
    .resize({ width: 1250 }).png().toFile(into);
};

console.log("MIRRORED SPECIMEN — her LEFT lobe is now in the image's LEFT half.");
console.log("Judge by eye: which ear lost its hoop, and on which side of the frame.\n");

for (const side of ["left", "right"] as const) {
  for (let at = 1; at <= PAINTS; at += 1) {
    const rows = [vacancyRow(side)];
    const asks = repaintAsksFor({ pronouns: { subject: "she", object: "her", possessive: "her", plural: false }, delta: LATER, prose: EDIT_PROSE, restore: { state: LATER, slots: [] } });
    if (!asks.ok) throw new Error(`the asks refused — ${asks.reason}`);
    const recipe = assembleRecipe({
      master: { key: SYNTHETIC },
      pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
      library: libraryWithoutEditedCrops(deriveLibrary(rows), new Set(asks.asks.map((ask) => ask.slot))),
      asks: asks.asks,
    });
    if (!recipe.ok) throw new Error(`the recipe refused — ${recipe.reason}`);
    if (!recipe.prompt.includes(sided(side))) throw new Error("the phrase is not in the prompt");

    const painted = await repaint({
      recipe, engine, width, height,
      load: async (image): Promise<ReferenceBytes> => (
        image.key === SYNTHETIC ? { bytes: mirrored, contentType: "image/png" } : (() => { throw new Error("unexpected reference"); })()
      ),
    });
    if (!painted.ok) throw new Error(`refused at the door — ${painted.reason}`);
    const look = path.join(OUT, `mirrored-her-${side}-${String(at).padStart(2, "0")}-BAND.png`);
    await writeFile(path.join(OUT, `mirrored-her-${side}-${String(at).padStart(2, "0")}.png`), painted.frame.bytes);
    await band(painted.frame.bytes, look);
    console.log(`"her ${side} ear", paint ${at} → ${look}`);
  }
}

console.log("\nEvery frame above is mirrored: her LEFT ear is in the image's LEFT half.");
process.exit(0);
