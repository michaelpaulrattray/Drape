/**
 * The covering channel, verified on paid pictures (D-124).
 *
 * Compiles a brief through the REAL compiler and generates its eight
 * candidates through the REAL transport, then lays them out as one contact
 * sheet to look at. No database, no credits ledger, no roll rows — the only
 * thing under test is the prompt, so everything downstream of it is noise.
 *
 * Live compiler on purpose: a stub is how the last regression hid.
 *
 * **Run BOTH directions or neither.** The stated case proves the channel
 * renders the garment; the unstated case proves nothing was inferred from a
 * faith, and that second half is the one a change to this area is most likely
 * to break. A pass on one alone proves very little.
 *
 *   BRIEF="a woman in her 30s wearing a hijab" OUT=stated   npx tsx scripts/drive-stated-covering.mts
 *   BRIEF="a Muslim woman in her 30s"          OUT=unstated npx tsx scripts/drive-stated-covering.mts
 *
 * Costs sixteen paid images for the pair, which is why it is a driver rather
 * than part of `pnpm test`.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

import { castingBriefCompiler } from "../server/castingV2/briefCompiler";
import { castingCreativeEngine } from "../server/castingV2/rollEngine";

const brief = process.env.BRIEF ?? "a woman in her 30s wearing a hijab";
const out = process.env.OUT ?? "covering";
const dir = "docs/specs/evidence/faith-presentation";

const compiled = await castingBriefCompiler({
  briefText: brief,
  candidateCount: 8,
  rollSeed: `covering-${out}`,
});

const withDirective = compiled.candidates.filter((c) => c.prompt.includes("STATED COVERING:")).length;
console.log(`[covering] brief: "${brief}"`);
console.log(`[covering] prompts carrying the directive: ${withDirective}/${compiled.candidates.length}`);
console.log(`[covering] size ${compiled.size} quality ${compiled.quality}`);

const engine = castingCreativeEngine();
const images = await Promise.all(
  compiled.candidates.map(async (spec) => {
    const result = await engine.generateCandidate({
      prompt: spec.prompt,
      size: compiled.size,
      quality: compiled.quality,
    });
    console.log(`[covering] candidate ${spec.position} landed (${result.latencyMs}ms)`);
    return result.bytes;
  }),
);

/* Four across, two down — the shape a sheet is read in. */
const CELL = 512;
const cells = await Promise.all(
  images.map((bytes) => sharp(bytes).resize(CELL, Math.round(CELL * 1.5), { fit: "cover" }).toBuffer()),
);
const sheet = await sharp({
  create: {
    width: CELL * 4,
    height: Math.round(CELL * 1.5) * 2,
    channels: 3,
    background: "#111111",
  },
})
  .composite(
    cells.map((input, i) => ({
      input,
      left: (i % 4) * CELL,
      top: Math.floor(i / 4) * Math.round(CELL * 1.5),
    })),
  )
  .jpeg({ quality: 82 })
  .toBuffer();

await mkdir(dir, { recursive: true });
await writeFile(`${dir}/covering-${out}.jpg`, sheet);
console.log(`[covering] wrote ${dir}/covering-${out}.jpg`);
process.exit(0);
