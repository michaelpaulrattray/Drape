/**
 * CAN THE PRODUCT SAY "THIS EAR"? — the asymmetric bench fable-329 made the
 * condition of filing a per-instance vacant phrase.
 *
 * Shift 63 found that an earring removal cannot be RECORDED: the pair phrase
 * ("no earrings — both earlobes bare…") is a claim about both sides and a
 * per-side slot may not file one, so the removal refuses into the refund. The
 * proposed repair is a second phrase in the catalogue, said per instance. Fable
 * approved it on one condition: it is measured on the ASYMMETRIC specimen —
 * one ear vacated, the other keeping its earring — because a bench that strips
 * both ears cannot fail a phrase that means "her ears" when it says "this ear".
 *
 * # The thing this bench found before it spent a render
 *
 * A vacancy's sentence reaches the painter as its WORDS ALONE — the assembler
 * emits `${entry.words.join(", ")}.` for a vacancy and `ask.vacate.says` for
 * the edit-time clause. Neither carries the slot's noun. So the approved
 * wording arrives at the engine as *"no earring on this ear — the earlobe bare,
 * nothing hanging from it."* with nothing whatever to say WHICH ear. That may
 * be enough (the master shows both, and one sentence about one of them is
 * incoherent) or it may not be — it is a question for pixels, not for taste.
 *
 * So both candidate wordings are benched side by side on the same specimen:
 *
 *   PLAIN   "no earring on this ear — the earlobe bare, nothing hanging from it"
 *   SIDED   "no earring on her left ear — that earlobe bare, nothing hanging
 *            from it"   (the side derived from the slot's own instance, never
 *                        authored at a call site — fable-195)
 *
 * # Her left is HER left
 *
 * `earring@left` is her left ear, which is the RIGHT half of a frame she faces
 * the camera in (`falRegionReader.regionSides`: "left IS her left"). The per-ear
 * reader splits the frame in image order. The mapping is done once, here, and
 * every line printed below is in HER terms.
 *
 * # The specimen, and its delta in both directions
 *
 *   BEFORE   her master must read NEITHER ear wearing a hoop
 *   AFTER    the synthetic specimen must read BOTH ears wearing one
 *   CONTROL  the same later ask with NO vacancy must leave both hoops on
 *
 * Only then does an arm's asymmetry mean anything. Off the ledger: no refine,
 * no credits, no rows, no storage writes.
 *
 *   npx tsx scripts/bench-per-instance-vacancy-disposable.mts
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { askedObjectOnEachEar, type EarReading } from "./lib/askedObject.mts";
import { repaintAsksFor } from "../server/castingV2/repaintAsks";
import { assembleRecipe } from "../server/castingV2/recipeAssembler";
import { deriveLibrary, libraryWithoutEditedCrops, type StoredReference } from "../server/castingV2/referenceLibrary";
import { EDIT_PROSE } from "../server/castingV2/refineService";
import { repaint, type ReferenceBytes } from "../server/castingV2/repaintRender";
import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { slotDefinition } from "../server/castingV2/referenceSlotCatalogue";
import { slotWordsRefusal } from "../server/castingV2/slotWordShape";
import { storageReadBytes } from "../server/storage";

const OUT = "output/shift64-per-instance-vacancy";
/** The face the synthesis arm proved an earring can be put on and taken off. */
const FACE = process.env.FACE ?? "4c98c7fc-453c-4666-9a2c-86a393ade900";
/** Her ears wearing hoops, painted by shift 63 and read at 6× that night. */
const SPECIMEN = process.env.SPECIMEN
  ?? "output/shift63-removal-synthesis/4c98c7fc-earring-00-specimen.png";
/** The object the per-ear reader is asked about, one ear at a time. */
const ASKED = "a small gold hoop earring";
/** An ordinary later ask that says nothing whatever about her ears. */
const LATER = { hairColour: "copper" } as any;

const PLAIN = "no earring on this ear — the earlobe bare, nothing hanging from it";
const sided = (side: "left" | "right") =>
  `no earring on her ${side} ear — that earlobe bare, nothing hanging from it`;

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const connection = await openDatabase(process.env[key]!);
const where = new URL((process.env[key] ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: ${key} → ${where.hostname}:${where.port}`);
await mkdir(OUT, { recursive: true });

const [faces] = await connection.query<any[]>(
  "SELECT id, publicId, imageKey FROM casting_candidates WHERE publicId = ?", [FACE],
);
const face = faces[0];
if (!face) throw new Error(`no candidate ${FACE} in this world`);

const specimenBytes = await readFile(SPECIMEN);
const meta = await sharp(specimenBytes).metadata();
const width = meta.width ?? 1024;
const height = meta.height ?? 1536;
const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY ?? "" });

/**
 * The two ears, in HER terms. `askedObjectOnEachEar` labels image halves; the
 * product's laterality is the subject's own, so image-left is her RIGHT.
 */
type Ears = { hers: { left: EarReading; right: EarReading } };
const readEars = async (bytes: Buffer): Promise<Ears> => {
  const readings = await askedObjectOnEachEar(bytes, ASKED, Math.round(width / 2));
  const atImageLeft = readings.find((r) => r.side === "left")!;
  const atImageRight = readings.find((r) => r.side === "right")!;
  return { hers: { left: atImageRight, right: atImageLeft } };
};
const say = (ears: Ears): string =>
  `her left ${ears.hers.left.wearing ? "WEARING" : "bare   "} · her right ${ears.hers.right.wearing ? "WEARING" : "bare   "}`;
const quote = (ears: Ears): string =>
  `        her left:  "${ears.hers.left.saw}"\n        her right: "${ears.hers.right.saw}"`;

/* ── the delta, both directions, before any arm counts ─────────────────────── */

const masterBytes = await storageReadBytes(face.imageKey);
const masterEars = await readEars(masterBytes.bytes);
console.log(`\nBEFORE   her master        ${say(masterEars)}`);
console.log(quote(masterEars));
if (masterEars.hers.left.wearing || masterEars.hers.right.wearing) {
  console.log("\nVOID — the master already reads as wearing a hoop, so the add proves nothing.");
  await connection.end();
  process.exit(1);
}

const specimenEars = await readEars(specimenBytes);
console.log(`\nAFTER    the specimen      ${say(specimenEars)}`);
console.log(quote(specimenEars));
if (!specimenEars.hers.left.wearing || !specimenEars.hers.right.wearing) {
  console.log("\nVOID — the specimen does not wear a hoop on both ears, so there is no asymmetry to make.");
  await connection.end();
  process.exit(1);
}

/* ── the arms ──────────────────────────────────────────────────────────────── */

const SYNTHETIC = `synthetic:${face.publicId.slice(0, 8)}:earrings`;

const vacancyRow = (slot: "earring@left" | "earring@right", phrase: string): StoredReference => {
  const definition = slotDefinition(slot as any);
  if (!definition) throw new Error(`no slot definition for ${slot}`);
  /* THE DOOR, ASKED BEFORE THE ROW EXISTS — the same call `refineService` makes
     before it files a vacancy. A phrase that cannot be filed cannot be
     benched, and finding that out in pixels would be the expensive way. */
  const refusal = slotWordsRefusal(slot, [phrase]);
  if (refusal !== null) throw new Error(`${slot} would refuse "${phrase}": ${refusal.reason} — ${refusal.detail}`);
  return {
    id: -1, publicId: `in-memory:${slot}`, candidateId: face.id, variantId: null,
    role: "vacancy", slot: slot as any, tier: definition.tier, noun: definition.noun,
    words: [phrase],
    storageKey: null, maskKey: null, digest: null, geometry: null, guard: null,
    refusal: null, version: 99, retiredAt: null, createdAt: new Date(),
  };
};

type Arm = { label: string; rows: StoredReference[]; want: (ears: Ears) => boolean; wants: string };
const bothWearing = (ears: Ears) => ears.hers.left.wearing && ears.hers.right.wearing;
const onlyRightWearing = (ears: Ears) => !ears.hers.left.wearing && ears.hers.right.wearing;
const onlyLeftWearing = (ears: Ears) => ears.hers.left.wearing && !ears.hers.right.wearing;
const neitherWearing = (ears: Ears) => !ears.hers.left.wearing && !ears.hers.right.wearing;

const ARMS: Arm[] = [
  { label: "control-no-vacancy", rows: [], want: bothWearing, wants: "both hoops stay on" },
  {
    label: "plain-her-left",
    rows: [vacancyRow("earring@left", PLAIN)],
    want: onlyRightWearing, wants: "her LEFT bare, her right still wearing",
  },
  {
    label: "sided-her-left",
    rows: [vacancyRow("earring@left", sided("left"))],
    want: onlyRightWearing, wants: "her LEFT bare, her right still wearing",
  },
  {
    label: "plain-her-right",
    rows: [vacancyRow("earring@right", PLAIN)],
    want: onlyLeftWearing, wants: "her RIGHT bare, her left still wearing",
  },
  {
    label: "sided-her-right",
    rows: [vacancyRow("earring@right", sided("right"))],
    want: onlyLeftWearing, wants: "her RIGHT bare, her left still wearing",
  },
  {
    /* THE SHIPPING CASE, which is not the discriminating one: "take her earrings
       off" vacates both slots and files a row under each. Benched because it is
       what a customer will actually buy, and reported apart from the arms that
       can tell "this ear" from "her ears". */
    label: "plain-both-ears",
    rows: [vacancyRow("earring@left", PLAIN), vacancyRow("earring@right", PLAIN)],
    want: neitherWearing, wants: "both earlobes bare",
  },
  {
    label: "sided-both-ears",
    rows: [vacancyRow("earring@left", sided("left")), vacancyRow("earring@right", sided("right"))],
    want: neitherWearing, wants: "both earlobes bare",
  },
];

const results: any[] = [];
for (const arm of ARMS) {
  const asks = repaintAsksFor({ delta: LATER, prose: EDIT_PROSE, restore: { state: LATER, slots: [] } });
  if (!asks.ok) throw new Error(`${arm.label}: the asks refused — ${asks.reason}: ${asks.detail}`);
  const recipe = assembleRecipe({
    master: { key: SYNTHETIC },
    pronouns: { subject: "she", object: "her", possessive: "her", plural: false },
    library: libraryWithoutEditedCrops(deriveLibrary(arm.rows), new Set(asks.asks.map((a) => a.slot))),
    asks: asks.asks,
  });
  if (!recipe.ok) throw new Error(`${arm.label}: the recipe refused — ${recipe.reason}`);

  /* ASSERTED AT THE WIRE: the sentence that is about to be SENT, read off the
     recipe rather than off the row that produced it. */
  const saidIt = arm.rows.every((row) => recipe.prompt.includes(row.words[0]!));
  const mentions = (recipe.prompt.match(/no earring on/gi) ?? []).length;
  console.log(`\n${arm.label} — want ${arm.wants}`);
  console.log(`  the prompt carries the phrase ${mentions} time(s)${arm.rows.length > 0 && !saidIt ? "  ← IT DOES NOT SAY IT" : ""}`);
  console.log(`  "${recipe.prompt.replace(/\s+/g, " ")}"`);

  const painted = await repaint({
    recipe, engine, width, height,
    load: async (image): Promise<ReferenceBytes> => (
      image.key === SYNTHETIC
        ? { bytes: specimenBytes, contentType: "image/png" }
        : await storageReadBytes(image.key)
    ),
  });
  if (!painted.ok) throw new Error(`${arm.label}: refused at the door — ${painted.reason}`);

  const ears = await readEars(painted.frame.bytes);
  const passed = arm.want(ears);
  const file = path.join(OUT, `${arm.label}-${passed ? "as-wanted" : "WRONG"}.png`);
  await writeFile(file, painted.frame.bytes);
  console.log(`  → ${say(ears)}   ${passed ? "AS WANTED" : "NOT WHAT WAS WANTED"} → ${file}`);
  console.log(quote(ears));
  results.push({
    arm: arm.label, wants: arm.wants, saidIt, mentions, passed, file,
    prompt: recipe.prompt,
    hers: {
      left: { wearing: ears.hers.left.wearing, absent: ears.hers.left.absent, read: ears.hers.left.read, saw: ears.hers.left.saw },
      right: { wearing: ears.hers.right.wearing, absent: ears.hers.right.absent, read: ears.hers.right.read, saw: ears.hers.right.saw },
    },
  });
}

/* ── the verdict, per wording, and it needs the control ────────────────────── */

const control = results.find((row) => row.arm === "control-no-vacancy");
const armsOf = (prefix: string) => results.filter((row) => row.arm.startsWith(prefix) && !row.arm.endsWith("both-ears"));
console.log(`\n${"=".repeat(96)}`);
if (!control?.passed) {
  console.log("THE BENCH IS VOID — with no vacancy at all the hoops did not survive the later ask, so an\n"
    + "ear that comes back bare says nothing about the phrase.");
} else {
  for (const wording of ["plain", "sided"]) {
    const arms = armsOf(wording);
    const won = arms.filter((row) => row.passed).length;
    console.log(`${wording.toUpperCase().padEnd(6)} ${won}/${arms.length} asymmetric arms delivered "this ear" and not "her ears"`
      + `   [${arms.map((row) => `${row.arm.replace(`${wording}-`, "")}: ${row.passed ? "ok" : "no"}`).join(" · ")}]`);
  }
  for (const row of results.filter((entry) => entry.arm.endsWith("both-ears"))) {
    console.log(`${row.arm.padEnd(16)} the shipping case: ${row.passed ? "both earlobes bare" : "NOT both bare"} (reported apart)`);
  }
}
console.log("=".repeat(96));
await writeFile(path.join(OUT, "bench.json"), JSON.stringify({
  face: face.publicId, specimen: SPECIMEN, asked: ASKED,
  master: masterEars, specimenEars, results,
}, null, 2));
await connection.end();
process.exit(0);
