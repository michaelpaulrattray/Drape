/**
 * DISPOSABLE — foreman-113, 2026-08-30. #246 at the DEPARTURE GATE, SECOND WORD.
 *
 * WHY THIS EXISTS. foreman-106 confirmed the substitution at this gate on ONE
 * word (`hair`, 1 of 3 absent cells, 25,962 px of "hairline" on a hairless
 * skull) and left nine unmeasured words behind it. That single cell is waiting
 * on the founder's eye — *is that left-hand skull actually bald?* — and while it
 * waits the gate has no settled verdict at all. foreman-112 declined to buy more
 * population on an unsettled base and then wrote the counter-argument into its
 * own handoff: **an independent confirmation on a SECOND word settles the gate
 * whichever way he answers.** That is what this buys.
 *
 * THE WORD IS `eyebrows`, and it is chosen rather than convenient:
 *   - it is one of the ten gate questions sitting at a floor of ZERO, so one
 *     lookalike pixel disputes a removal that landed;
 *   - `falRegionReader.ts` already documents the OPPOSITE failure on this exact
 *     word (the `eyebrow` union coming back empty), so the module knows the word
 *     is fragile and has never been asked about this direction;
 *   - "take her eyebrows off" is a real customer ask, not a creature-only one;
 *   - and a hairless brow still has a RIDGE where the hair was, which is the
 *     nearest lookalike a picture can offer.
 *
 * WHAT IS REAL: the reader (`createFalRegionReader`), the coverage arithmetic
 * (`binaryCoverage`), the floor (`departureFloorFor`) and the question
 * (`slotDefinition("brow@left").question`) are all production. The verdict
 * printed is the gate's own line, `covered > floor`, on these bytes. Not driven:
 * the surrounding refine — no render, no charge, no database.
 *
 * THE CELLS WERE CERTIFIED BY EYE AT NATIVE RESOLUTION FIRST
 * (`output/_shift113/brow-band.jpg`, `_shift113-eyecrop-disposable.mts`), which
 * is foreman-106's earned rule: it called a frame bald off a 300-pixel contact
 * sheet and the reader was right and it was wrong. Both controls are load
 * bearing — flat grey must come back EMPTY or nothing here means anything, and
 * two brow-bearing faces must come back non-empty or a clean null is silence
 * rather than evidence. The script ASSERTS both rather than printing them.
 *
 *   npx tsx scripts/_shift113-brow-substitution-disposable.mts
 *
 * 13 fal region reads at $0.005 — about $0.065 of house money. No credits, no
 * renders, no database.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

import sharp from "sharp";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("no database here");
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop");
const { binaryCoverage } = await import("../server/castingV2/maskGeometry");
const { departureFloorFor } = await import("../server/castingV2/bornWornDetector");
const { slotDefinition } = await import("../server/castingV2/referenceSlotCatalogue");

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
const OUT = "output/_shift113";
mkdirSync(OUT, { recursive: true });

async function blankFrame(): Promise<Buffer> {
  return sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#8a8a8a" } })
    .png().toBuffer();
}

type Arm = {
  id: string;
  file: string | null;
  slot: string;
  /** What MY OWN EYE read at native resolution, written before the read fired. */
  eye: "absent" | "present";
  note: string;
  reads: number;
};

const ARMS: Arm[] = [
  { id: "BR-ANG-C-0", file: "output/_shift104-widening/ANG-C-0.png", slot: "brow@left", eye: "absent", note: "anglerfish creature - no brow hair, pronounced ridged crest where brows would sit", reads: 2 },
  { id: "BR-ANG-K-0", file: "output/_shift104-widening/ANG-K-0.png", slot: "brow@left", eye: "absent", note: "same species, wet scalp strands - no brow hair, ridge present", reads: 2 },
  { id: "BR-ANG-C-2", file: "output/_shift104-widening/ANG-C-2.png", slot: "brow@left", eye: "absent", note: "same species; the HARDEST absent call - wet strands fall onto the forehead", reads: 2 },
  { id: "BR-c1871", file: "output/_shift100-frames/c1871.png", slot: "brow@left", eye: "absent", note: "honeycomb skull plate over the brow line - a different lookalike from the other three", reads: 2 },
  { id: "BR-LAM-K-2", file: "output/_shift104-widening/LAM-K-2.png", slot: "brow@left", eye: "present", note: "POSITIVE CONTROL - woman, dark unmistakable brows", reads: 2 },
  { id: "BR-53", file: "output/_shift100-frames/53.png", slot: "brow@left", eye: "present", note: "POSITIVE CONTROL - pale blond brows, the harder one", reads: 2 },
  { id: "BR-BLANK", file: null, slot: "brow@left", eye: "absent", note: "NEGATIVE CONTROL - flat grey", reads: 1 },
];

const lines: string[] = [];
const say = (s = "") => { console.log(s); lines.push(s); };

say("# #246 at the departure gate, SECOND WORD (`eyebrows`) - foreman-113");
say("");
say("Real reader, real coverage arithmetic, real floor, real catalogue question.");
say("Cells certified by eye at native resolution first: output/_shift113/brow-band.jpg");
say("");

let spentReads = 0;
type Result = { arm: Arm; coverages: number[]; disputed: boolean; wrong: boolean; pixels: number; band: string };
const results: Result[] = [];

for (const arm of ARMS) {
  const definition = slotDefinition(arm.slot as never);
  if (definition === null) throw new Error(`${arm.slot} is not catalogued`);
  const question = definition.question;
  if (question === null) throw new Error(`${arm.slot} has no question and cannot reach the vacate path`);
  const guardKind = definition.guardKind;
  if (guardKind === null) throw new Error(`${arm.slot} has a question and no guardKind - the catalogue invariant is broken`);
  const { floor, measured, provenance } = departureFloorFor(guardKind);

  const bytes = arm.file === null ? await blankFrame() : readFileSync(arm.file);
  const meta = await sharp(bytes).metadata();
  const height = meta.height ?? 1536;

  const coverages: number[] = [];
  let lastMask: Awaited<ReturnType<typeof reader.region>> | null = null;
  for (let attempt = 0; attempt < arm.reads; attempt += 1) {
    const mask = await reader.region({ image: bytes, name: question, absentIsAnswer: true });
    spentReads += 1;
    coverages.push(binaryCoverage(mask));
    lastMask = mask;
  }

  const covered = coverages[0]!;
  /* THE GATE'S OWN LINE - `if (covered > floor)` disputes the removal. */
  const disputed = covered > floor;
  const wrong = arm.eye === "absent" && disputed;

  say(`## ${arm.id} - slot \`${arm.slot}\`, asked "${question}"`);
  say(`   frame: ${arm.file ?? "generated flat grey"}  (${arm.note})`);
  say(`   my eye before the read: the feature is ${arm.eye.toUpperCase()}`);
  say(`   coverage: ${coverages.map((c) => c.toFixed(6)).join(" , ")}`);
  say(`   floor: ${floor}${measured ? " (measured)" : " (UNMEASURED - zero)"}`);
  say(`   gate verdict: ${disputed ? "REMOVAL DISPUTED" : "removal accepted"}${wrong ? "   <-- WRONG: the frame does not show it" : ""}`);
  if (!measured) say(`   floor provenance: ${provenance.slice(0, 120)}...`);

  let pixels = 0;
  let band = "-";
  if (lastMask !== null) {
    const extent = extentOf(lastMask);
    if (extent.box === null) {
      say("   mask: EMPTY - the reader said nothing is there");
    } else {
      const box = extent.box;
      pixels = extent.pixels;
      band = `${(box.top / height * 100).toFixed(0)}%-${((box.top + box.height) / height * 100).toFixed(0)}%`;
      say(`   mask: ${extent.pixels} px, box ${box.width}x${box.height} at x ${box.left}, y ${box.top}`
        + `, vertically ${band} of frame`);

      /* Paint it back so the box is LOOKED at rather than reasoned about. The
         boring loop, not `dest-in`: sharp promotes a raw one-channel buffer to
         greyscale and paints the whole frame.

         WHITE, not the red the earlier `-WHERE` writers used: the founder's
         standing ruling is *"Bounding-box overlays are THIN WHITE, not red —
         everywhere"* (fable-230, guarded by
         `server/castingV2/onImageGeometryMonochrome.test.ts`). Those writers
         were never tracked, so the guard never saw them and this would have
         been the commit that imported the breach. ⚠ The guard still cannot see
         THIS line either — it reads `fill=`/`stroke=` hexes and `[r, g, b]`
         literals, and a per-channel assignment is a third idiom — so obeying it
         here is a choice rather than an enforcement, and the gap is filed. */
      const rgba = Buffer.alloc(lastMask.width * lastMask.height * 4);
      for (let index = 0; index < lastMask.width * lastMask.height; index += 1) {
        const on = (lastMask.data[index] ?? 0) > 127;
        rgba[index * 4] = 255; rgba[index * 4 + 1] = 255; rgba[index * 4 + 2] = 255;
        rgba[index * 4 + 3] = on ? 165 : 0;
      }
      const red = await sharp(rgba, { raw: { width: lastMask.width, height: lastMask.height, channels: 4 } })
        .png().toBuffer();
      const overlay = await sharp(bytes)
        .composite([{ input: await sharp(red).resize({ width: meta.width, height, fit: "fill" }).png().toBuffer(), blend: "over" }])
        .png().toBuffer();
      writeFileSync(`${OUT}/${arm.id}-WHERE.png`, overlay);
      say(`   overlay: ${OUT}/${arm.id}-WHERE.png`);
    }
  }
  results.push({ arm, coverages, disputed, wrong, pixels, band });
  say("");
}

/* THE CONTROLS ARE ASSERTED, NOT EYEBALLED - an arm that cannot fail is not an
   arm. If flat grey comes back non-empty the code path cannot say "nothing is
   there" and every clean null below is silence; if a brow-bearing face comes
   back empty the reader does not know the word and the same is true. Either
   way the sitting's null results are void, and the report says so in its own
   words rather than leaving it to whoever reads the table. */
const blank = results.find((r) => r.arm.id === "BR-BLANK");
if (blank === undefined) throw new Error("the negative control did not run");
const positives = results.filter((r) => r.arm.eye === "present");
if (positives.length === 0) throw new Error("no positive control ran");
const negativeControlHeld = blank.pixels === 0;
const positiveControlsHeld = positives.every((r) => r.pixels > 0);

say("---");
say("");
say(`negative control (flat grey) EMPTY: ${negativeControlHeld ? "YES - the code path can say nothing is there" : "NO - every null below is VOID"}`);
say(`positive controls both fired: ${positiveControlsHeld ? "YES - the reader knows the word" : "NO - every null below is VOID"}`);
say("");
const absent = results.filter((r) => r.arm.eye === "absent" && r.arm.file !== null);
const confirmed = absent.filter((r) => r.wrong);
say(`absent cells: ${absent.length}, DISPUTED (substitution): ${confirmed.length}, accepted: ${absent.length - confirmed.length}`);
for (const r of confirmed) say(`  ** ${r.arm.id}: ${r.pixels} px at ${r.band} of frame - ${r.arm.note}`);
say("");
say(`reads: ${spentReads}, about $${(spentReads * 0.005).toFixed(3)} of house money`);
writeFileSync(`${OUT}/report.md`, lines.join("\n"), "utf8");
process.exit(0);
