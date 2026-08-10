/**
 * DID HER FRECKLES ACTUALLY COME AND GO? — counted, not argued.
 *
 * Run-12's `marks` scored 25% and the first story was "the reader is broken".
 * The reader's own court then acquitted it on the negative control, on both
 * redhead positives and on one of the olive-skinned frames — and eyeballing the
 * four crops at 3× says frame 04 really is close to bare while 05 is the densest
 * of the set. Two stories in one number, and the last two stories I was
 * confident about both died on measurement.
 *
 * So this counts. Every render in the chain is base-anchored (D-86), so each one
 * re-renders her freckles from the recipe's own word for them — and if that word
 * buys a different density every time, a customer paid at step 1 for something
 * step 4 handed back without.
 *
 * # How it counts, and what it refuses to do
 *
 * A freckle is a small dark speck against LOCAL skin, not against a global
 * threshold: her cheek is lit differently from her nose and both are lit
 * differently from the frame next door. So the baseline is a blur of her own
 * skin in that frame — every count is relative to the face it is on, and a
 * frame the painter rendered a shade warmer cannot inflate its own score.
 *
 * The patches are the two CHEEK-AND-NOSE bands, derived from the segmenter's own
 * read of her face rather than from fractions of the frame (the crop law). They
 * are written out beside the numbers, because a count over a patch nobody looked
 * at is a claim about a region that might contain her nostril.
 *
 * # What it found, once it was given her own bare face (2026-08-08)
 *
 * The first version had no baseline of HER — a supposed 404 on her master (in
 * fact a dev-bucket URL; see row 00) forced a different person into the
 * negative-control slot, which is the one comparison this counter cannot make.
 * With her master in the chart and two biases removed, the reading changes
 * shape:
 *
 *     00 her master   3.84   the floor: pores and fine lines, no pigment
 *     01 freckles     4.28   +11%
 *     03 lip gloss    4.28   +11%   (identical to 01 — nothing happened here)
 *     04 hoops        3.49    −9%   BELOW her own bare face
 *     05 removal      5.03   +31%
 *
 * So it was never a *fluctuation around* a delivered density. Frame 04 is at
 * her untouched floor: the freckles she paid for at step 1 are simply not in
 * it. And 05 carries 2.7× the density that step 1 delivered. One bare noun,
 * three answers: nothing, a little, and three times a little.
 *
 * # The limit, unchanged and now measured on her
 *
 * Her clear skin reads 3.84, not zero, so this counter still cannot answer
 * "is this face freckled". It answers "how far above her own untouched skin",
 * and only for frames of HER. The two cross-face rows are kept to keep that
 * honest: a clear-skinned stranger scores 6.02, higher than any frame of hers.
 *
 * # And why it takes a `--run` (2026-08-09)
 *
 * Run-15 asked the same question of a different woman, and the answer to
 * *"did her freckles come and go"* is not transferable between faces — the
 * counter's declared limit is that it can only ORDER FRAMES OF ONE FACE. So the
 * bench holds one frame set per walk, each with its own master as row 00, and
 * neither borrows the other's floor. Run-12 stays the default so every number
 * already quoted from this script reproduces without an argument.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/calibration/freckle-density.mts
 *   npx tsx scripts/calibration/freckle-density.mts --run 15
 *   (no database needed — plain `npx tsx` is fine; FAL_KEY supplies the face)
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
/* ONE implementation of the counter, shared with the benches — never a second
   copy of a courted instrument (law 4). Its declared limit travels with it. */
import { cheekBand as readCheekBand, countSpecks } from "./lib/speckDensity.mjs";

const OUT = "output/marks-court";
mkdirSync(OUT, { recursive: true });

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required — the patch comes from a segmentation, never from a fraction");
const reader = createFalRegionReader({ apiKey });

/**
 * One frame on the bench. `hers` says whose skin it is: only frames of the
 * walk's OWN woman may be read against her floor, and the cross-face controls
 * exist to keep that limit visible rather than to be compared through it.
 */
type Frame = { name: string; file: string; hers?: boolean };

const RUN_12_FRAMES: Frame[] = [
  /*
    HER OWN BARE FACE — the baseline this counter was specified to have, and
    could not have until 2026-08-08.

    The first run reported that her master "404s on the public bucket" and fell
    back to a DIFFERENT clear-skinned face, which is precisely the comparison
    the counter cannot make: on someone else's skin it counts their pores. The
    404 was not real. The probe had run under `railway run --service MySQL`,
    whose service defines no `R2_PUBLIC_URL`, so `dotenv` filled it from the
    developer's `.env` and the script asked the DEV bucket for a PRODUCTION
    key. Her master is present and served, HTTP 200, 2,442,471 bytes
    (`scripts/probe-candidate-master-disposable.mts`, and
    `scripts/lib/worldGuard.mts` now refuses that mixture rather than
    answering through it).

    So the negative control is finally her: same person, same lighting, same
    pose, same camera — the whole point — before anybody asked for freckles.
    Everything her skin scores here is texture rather than pigment, and every
    frame below is only interesting by how far it rises above it.

    Downloaded once and kept on disk so the court re-runs for free and without
    a bucket:
      curl -o output/marks-court/MASTER-run12.png \
        https://pub-990e39d8d995468eb61aced83162123a.r2.dev/casting-v2/candidates/606208e9-4889-4bee-b981-d4d79219be34.png
  */
  { name: "00 HER MASTER — before any freckles were asked for", file: "output/marks-court/MASTER-run12.png", hers: true },
  { name: "01 after 'give her freckles'", file: "output/walk/run-12/01-delivered.png", hers: true },
  { name: "03 after lip gloss", file: "output/walk/run-12/03-delivered.png", hers: true },
  { name: "04 after hoops", file: "output/walk/run-12/04-delivered.png", hers: true },
  { name: "05 after the removal", file: "output/walk/run-12/05-delivered.png", hers: true },
  /*
    06 — THE ONE PAID RENDER THAT SETTLES IT (approved, fable-048).

    A `statedAccessories` addition, the same class as the step that lost her
    freckles, with `marks` CARRIED rather than written — the exact condition
    frame 04 failed under. The only difference is the lane fix: the caption is
    now spoken inside the instruction rather than asserted beside it.

    Frame 04 read 3.49, BELOW her 3.84 floor. If this reads at the floor too,
    the fix did not save it and the coin-flip theory needs its retry.
  */
  { name: "06 a necklace, AFTER the lane fix", file: "output/caption-governs/delivered.png", hers: true },
  /*
    THE COUNTER'S OWN CONTROLS, because a count nobody has calibrated is worth
    what an unproven reader is worth — and this shift has now been burnt twice
    by believing an instrument that had never been made to fail.

    `neg` is the clear-skinned specimen the READER also calls clear, so the two
    instruments agree on a case with no freckles in it. `pos` is the redhead the
    roll itself freckled heavily, which both instruments should find loud. If
    the counter cannot separate those two, no number above it means anything.
  */
  /*
    THE CROSS-FACE CONTROLS, AND THE LIMIT THEY ESTABLISHED — kept in the run
    rather than deleted, because the finding is the limit.

    The clear-skinned specimen scores AS HIGH as the densest freckled frame, so
    **this counter cannot answer "is this face freckled" in absolute terms**: on
    a different person it is counting pores and fine lines as readily as
    pigment. What it can do is ORDER FRAMES OF ONE FACE, because her own
    texture, pose and lighting are constant across them and cancel — which is
    the only comparison anything above actually makes.

    That limit is unchanged by row 00 arriving. Row 00 does not repair the
    absolute scale; it puts her own zero ON that ordering, which is the only
    place the scale was ever usable.
  */
  { name: "neg CONTROL — a DIFFERENT clear-skinned face", file: "output/masked/specimens/fresh-02.png" },
  { name: "pos CONTROL — heavily freckled redhead", file: "output/walk/run-11/05-delivered.png" },
];

/**
 * RUN-15 — the same four questions of a different woman, and the reason the
 * bench grew a second set.
 *
 * Her stored verdicts read PASS, MISS, MISS, PASS on `marks` across the four
 * delivered frames, and the shift that bought them declared by eye that the
 * freckles are present in all four. That declaration is exactly the one this
 * counter overturned on run-12's frame 04, on the same class of frame, so it
 * gets the same measurement before it is believed either way.
 *
 * Her master carries the same two controls as run-12's: the same clear-skinned
 * stranger and the same heavily-freckled redhead, so the two sets are read on
 * one calibrated instrument rather than on two.
 */
const RUN_15_FRAMES: Frame[] = [
  { name: "00 HER MASTER — before any freckles were asked for", file: "output/marks-court/MASTER-run15.png", hers: true },
  { name: "01 after 'give her freckles'", file: "output/walk/2026-08-08T19-59-45-742Z/01-delivered.png", hers: true },
  { name: "03 after lip gloss", file: "output/walk/2026-08-08T19-59-45-742Z/03-delivered.png", hers: true },
  { name: "04 after hoops", file: "output/walk/2026-08-08T19-59-45-742Z/04-delivered.png", hers: true },
  { name: "05 after the removal", file: "output/walk/2026-08-08T19-59-45-742Z/05-delivered.png", hers: true },
  { name: "neg CONTROL — a DIFFERENT clear-skinned face", file: "output/masked/specimens/fresh-02.png" },
  { name: "pos CONTROL — heavily freckled redhead", file: "output/walk/run-11/05-delivered.png" },
];

const runFlag = process.argv.indexOf("--run");
const RUN = runFlag > -1 ? String(process.argv[runFlag + 1]) : "12";
const BENCH: Record<string, { master: string; frames: Frame[] }> = {
  "12": { master: "output/marks-court/MASTER-run12.png", frames: RUN_12_FRAMES },
  "15": { master: "output/marks-court/MASTER-run15.png", frames: RUN_15_FRAMES },
};
const bench = BENCH[RUN];
if (!bench) throw new Error(`no frame set for run ${RUN} — the benches are ${Object.keys(BENCH).join(", ")}`);
const FRAMES = bench.frames;

/*
  ONE POPULATION FOR ALL FIVE OF HER FRAMES — the master's.

  Shift 3's own hardest-won instrument law: *a before/after whose POPULATION
  moves between the before and the after is not a comparison*. Segmenting each
  frame separately would do exactly that, and worst of all in the one place it
  matters: frame 05 has had her glasses REMOVED, so its own skin mask covers
  ground no earlier frame's does, and 05 is the frame the whole finding turns
  on.

  Every frame is a base-anchored composite of this master at this pose, so the
  master's skin is the right ground for all of them — and the ground where her
  glasses were is excluded from every frame equally, including the one where
  they are gone.
*/
const HER_MASTER = bench.master;
const herPopulation = await readCheekBand(reader, HER_MASTER);
if (!herPopulation) throw new Error("no face read on her master — nothing below can be compared");
console.log(`her population: ${herPopulation.pixels} skin px inside a `
  + `${herPopulation.patch.width}x${herPopulation.patch.height} band `
  + `(${((herPopulation.pixels / (herPopulation.patch.width * herPopulation.patch.height)) * 100).toFixed(0)}% of the box — `
  + `the rest is her glasses, hair and nostrils, and used to be counted)\n`);

/*
  HER FLOOR IS NOT ZERO, AND THAT IS THE ONLY HONEST WAY TO READ ANY OF THIS.

  The specification for this control said a clear-skinned face "should read ~0".
  Hers reads ~3.8, because pores, fine lines and the down on a cheek are all
  small dark specks against local skin and no threshold separates them from
  pigment. That is not repairable by tuning; it is what the measurement is.

  So the counter never gets to say "this face has freckles". What it says is
  **how far above her own untouched skin a frame sits**, and the floor is the
  first row so nobody can quote a number without it.
*/
const rows: Record<string, unknown>[] = [];
let floor: number | null = null;
console.log("frame                              skin px    specks   per 1000    vs her floor");
console.log("-".repeat(90));
for (const frame of FRAMES) {
  /* The cross-face controls are different people, so they cannot borrow her
     ground; they take their own, and their limit is declared above. */
  /* `hers` is declared per frame rather than sniffed from the path — the path
     test worked while there was one walk on the bench and would have silently
     given run-15's frames their own ground, which is the population law's own
     failure mode. */
  const population = frame.hers ? herPopulation : await readCheekBand(reader, frame.file);
  if (!population) { console.log(`${frame.name.padEnd(34)} NO FACE READ`); continue; }
  const save = `${OUT}/PATCH-${frame.name.slice(0, 2)}.png`;
  const result = await countSpecks(frame.file, population, save);
  if (floor === null) floor = result.perThousand;
  /* Only her own frames may be read against her floor; a different person's
     skin has its own, and comparing across them is the limit declared above. */
  const ownGround = population === herPopulation;
  const relative = ownGround
    ? `${result.perThousand >= floor ? "+" : "−"}${Math.abs(result.perThousand - floor).toFixed(2)}`
      + `  (${(((result.perThousand / floor) - 1) * 100).toFixed(0)}%)`
    : "— different face, her floor does not apply";
  console.log(`${frame.name.padEnd(34)} ${String(result.area).padStart(8)}`
    + `${String(result.specks).padStart(10)}   ${result.perThousand.toFixed(2).padStart(8)}    ${relative}`);
  rows.push({
    frame: frame.name, file: frame.file, patch: population.patch, ...result,
    aboveHerFloor: ownGround ? result.perThousand - floor : null, saved: save,
  });
}
writeFileSync(`${OUT}/freckle-density.json`, `${JSON.stringify({ rows }, null, 2)}\n`);
console.log(`\npatches written to ${OUT} — look at them before believing the numbers`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
