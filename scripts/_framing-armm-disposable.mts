/**
 * ARM M OF THE FRAMING CONSISTENCY COURT — does the margin clause buy a common
 * frame, and what does it cost the picture?
 * (Designed `docs/specs/CASTING_FRAMING_CONSISTENCY_COURT.md` §9, countersigned
 * fable-1552 §2, the `head` reads granted fable-1553 Q1.)
 *
 * # The four cells, and the one variable inside each
 *
 *   suit + clause      8   the founder's own population, the TIGHT end
 *   suit control B     8   arm R's OWN prompts rendered a second time — the
 *                          NOISE FLOOR, granted fable-1555 Q1
 *   basics + clause    8   the other end of the measured across-cast gap
 *   basics control     8   same path, same seeds, clause as the ONLY variable
 *
 * **The SUIT control is arm R's own cell at the same size** — same sitting, same
 * seeds, same wardrobe line — which is why arm R rendered eight per size rather
 * than the two a price reading needed.
 *
 * ⚠ **AND THE SUIT CLAUSE CELL REUSES ARM R'S STORED PROMPTS RATHER THAN
 * RECOMPILING ITS BRIEF, WHICH IS A REQUIREMENT AND NOT A SAVING.** The
 * interpreter is a language model: compiling the same brief again would produce a
 * different sheet, so "same seeds, same people" is only true if the PROMPTS are
 * the same bytes. Recompiling would have quietly turned the SUIT pair into an
 * across-population comparison — the exact defect this campaign has spent a
 * fortnight finding. It also means the court spends ONE interpreter compile here
 * instead of two.
 *
 * # The clause, quoted from the design
 *
 * A landmark SWAP rather than an added sentence, because ROUND2's specimen is an
 * added framing sentence that widened its own population's spread by 5.0 points,
 * and this campaign has measured that a SUBSET of prompt context raised the stage
 * wall twice as often as its superset.
 *
 *   from   "Frame from mid-torso up in a 2:3 portrait."
 *   to     "Frame from the hips up in a 2:3 portrait. If in doubt include MORE
 *          of the body rather than less — a little extra room below and at the
 *          sides is correct."
 *
 * ⚠ **"Clause as the only variable" is PROVEN rather than promised**: within each
 * population the two prompt sets come from ONE prompt list, and the harness
 * asserts `control.replace(from, to) === clause` on every position before it
 * dispatches anything. A cell whose two halves differ anywhere else buys nothing.
 *
 * # The bars, all of them written before the run (design §6)
 *
 *   MARGIN        T_min across BOTH clause cells, three-way and pre-registered
 *                   PASS     <= 26.0%   the split works — build it
 *                   PARTIAL  <= 29.0%   ⚠ NEVER SHIPS. Its only exit is his eyes
 *                                       on the strips, never a shift's judgement
 *                                       that 29 is close enough to 26.
 *                   FAIL      > 29.0%   prose is not a margin source
 *   MEDIAN        the common frame lands inside the band of medians his eye has
 *                 accepted (22.3 / 23.5 / 26.4 / 27.3) and no sheet moves more
 *                 than 2.5 points to reach it
 *   PERTURBATION  raw within-sheet share spread under the clause <= that
 *                 population's CONTROL spread + 2.0 pt. ROUND2's own clause
 *                 moved its population 6.0 -> 11.0, so it would fail this two
 *                 and a half times over — a bar no shipped lever could fail is
 *                 not a bar.
 *
 * Every one of them is on the RAW frame. **No bar in this arm is measured on a
 * quantity the cut determines**, which is the direct repair of the failed
 * court's first defect.
 *
 * # What it spends, and the ceiling it will not cross
 *
 *   32 images   at the MEASURED price, not arm 1's — arm R's settled ledger says
 *               that reading is low by 28.6%, and this prices against the UPPER
 *               of the two candidate readings because under-pricing is how a
 *               court dies mid-run
 *   32 `face` reads + 32 `head` reads  at ~$0.005
 *   1 interpreter compile (BASICS only)                        openrouter
 *   ------------------------------------------------------------
 *   ~$3.36 at 1536x2304   ·   NO CREDITS, NO ROWS
 *
 * ⚠ **THE COURT HAS A $5.00 HARD CEILING** (fable-1555 §2, set after this court
 * ate two price corrections). $1.34 is spent. The run REFUSES rather than
 * starting if its own upper price would cross it, and prints the cumulative
 * against the ceiling once the ledger settles. It is a stop-and-report, not a
 * judgement call — and `--prove-guard` drives it refusing at $5.01 and passing
 * at exactly $5.00, because a money backstop nobody has watched refuse is a
 * backstop nobody has tested.
 *
 *   npx tsx scripts/_framing-armm-disposable.mts --size small
 *   npx tsx scripts/_framing-armm-disposable.mts --size large
 *   npx tsx scripts/_framing-armm-disposable.mts --size small --prove-guard
 *   npx tsx scripts/_framing-armm-disposable.mts --size small --dry-run
 */

import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";
import {
  PAIRED_HEADROOM_BAR, PAIRED_SHARE_BAR_PT,
  type FramingFrame, identityHolds, pairedSizeDelta, tMinOf,
} from "./lib/framingTmin.mts";
import { boxOutlineSvg } from "./lib/termsPalette.mts";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const DRY = process.argv.includes("--dry-run");
const PROVE = process.argv.includes("--prove-guard");

const OUT = "output/framing-court/armM";
const ARM_R = "output/framing-court/armR";

/* ── THE CLAUSE ── */
const FRAMING_FROM = "Frame from mid-torso up in a 2:3 portrait.";
const FRAMING_TO = "Frame from the hips up in a 2:3 portrait. If in doubt include MORE of the body "
  + "rather than less — a little extra room below and at the sides is correct.";

/* ── THE POPULATIONS ── */
const SUIT_LINE = "a plain dark suit jacket over a white collared shirt, dark tailored trousers, "
  + "black leather dress shoes";
const SUIT_SEED = "framing-court-suit";

const BASICS_BRIEF = "A woman in her mid thirties, shoulder-length dark brown hair worn loose, "
  + "warm mid-tone skin, brown eyes, natural brows, relaxed neutral expression, "
  + "looking straight into the lens.";
const BASICS_LINE = "a plain black scoop-neck sports top cut well below the collarbones so the "
  + "whole upper chest and sternum are bare, plain black fitted shorts, barefoot";
const BASICS_SEED = "framing-court-basics";

/* The medians his eye has accepted, from the record (design §4). */
const ACCEPTED_BAND = [22.3, 23.5, 26.4, 27.3] as const;
const MEDIAN_MOVE_BAR_PT = 2.5;
const PERTURBATION_BAR_PT = 2.0;
const TMIN_PASS = 26.0;
const TMIN_PARTIAL = 29.0;

const SIZES = {
  small: { width: 1024, height: 1536, each: 0.0400 },
  large: { width: 1536, height: 2304, each: 0.0650 },
} as const;

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

/**
 * ⚠ THE SINGLE-VARIABLE ASSERTION, and the only copy of it.
 *
 * Two prompt lists differ by the clause and by NOTHING ELSE, or the cell is
 * measuring two populations. Checked on the outgoing text — the prompts about to
 * be dispatched — rather than on the constants beside them.
 */
function assertClauseIsTheOnlyDifference(control: readonly string[], clause: readonly string[]): void {
  if (control.length !== clause.length) {
    throw new Error(`the two cells hold ${control.length} and ${clause.length} prompts — not a pair`);
  }
  const wrong: string[] = [];
  for (let i = 0; i < control.length; i += 1) {
    const before = control[i]!;
    const after = clause[i]!;
    if (!before.includes(FRAMING_FROM)) { wrong.push(`${i}: the control prompt does not carry the landmark sentence`); continue; }
    if (after.includes(FRAMING_FROM)) { wrong.push(`${i}: the clause prompt STILL carries the old landmark sentence`); continue; }
    if (!after.includes(FRAMING_TO)) { wrong.push(`${i}: the clause prompt does not carry the new sentence`); continue; }
    if (before.replace(FRAMING_FROM, FRAMING_TO) !== after) {
      wrong.push(`${i}: the two prompts differ somewhere OTHER than the clause`);
    }
  }
  if (wrong.length > 0) {
    throw new Error("the clause is not the only variable — buying nothing:\n  " + wrong.join("\n  "));
  }
}

/**
 * ⚠ THE COURT'S CEILING, in a function so it can be DRIVEN.
 *
 * A hard stop nobody has watched refuse is law 3's shape exactly: *a backstop
 * needs a test the model cannot rescue.* This one guards a money ceiling a
 * reviewer set after two price corrections, so the arm that proves it refuses is
 * cheaper than the run that proves it does not.
 */
function assertWithinCourtCeiling(spentSoFar: number, expected: number, ceiling: number): void {
  if (spentSoFar + expected > ceiling) {
    throw new Error("REFUSING: this run's upper price would take the court to "
      + `$${(spentSoFar + expected).toFixed(2)} past its $${ceiling.toFixed(2)} ceiling `
      + "(fable-1555 §2) — stop and report, the remaining arms wait on a fresh grant");
  }
}

/** The wardrobe line must reach every prompt, on both sides of the swap. */
function assertWardrobe(prompts: readonly string[], wardrobeLine: string, what: string): void {
  const missing = prompts
    .map((prompt, index) => (prompt.includes(wardrobeLine) ? null : index))
    .filter((index): index is number => index !== null);
  if (missing.length > 0) {
    throw new Error(`${what}: the wardrobe line is ABSENT from prompt(s) ${missing.join(", ")}`
      + " — buying nothing (design §7(2))");
  }
}

/*
  ⚠ THE POSITIVE CONTROL, and it runs before the network does.

  A run that PASSES its assertions is a negative arm and cannot find an
  assertion that never refuses. These drive the same two functions over inputs
  built to fail, one defect at a time, and insist each throws AND names its own
  reason. No network call, no spend.
*/
if (PROVE) {
  const base = `blah ${FRAMING_FROM} blah wearing ${SUIT_LINE}. tail`;
  const swap = (text: string) => text.replace(FRAMING_FROM, FRAMING_TO);
  const arms: Array<{ what: string; run: () => void; expect: RegExp }> = [
    { what: "the clause never got swapped in", expect: /STILL carries the old landmark sentence/,
      run: () => assertClauseIsTheOnlyDifference([base, base], [base, base]) },
    { what: "the control cell was handed the clause", expect: /control prompt does not carry the landmark sentence/,
      run: () => assertClauseIsTheOnlyDifference([swap(base), swap(base)], [swap(base), swap(base)]) },
    { what: "something ELSE moved beside the clause", expect: /differ somewhere OTHER than the clause/,
      run: () => assertClauseIsTheOnlyDifference([base, base], [swap(base), `${swap(base)} and a hat`]) },
    { what: "the two cells are different lengths", expect: /not a pair/,
      run: () => assertClauseIsTheOnlyDifference([base], [swap(base), swap(base)]) },
    { what: "one prompt lost the wardrobe line", expect: /wardrobe line is ABSENT from prompt\(s\) 1\b/,
      run: () => assertWardrobe([base, base.replace(SUIT_LINE, "a hat")], SUIT_LINE, "cell") },
    /* The money ceiling, driven — a backstop nobody has watched refuse. */
    { what: "the run would take the court ONE CENT past its ceiling", expect: /\$5\.01 past its \$5\.00 ceiling/,
      run: () => assertWithinCourtCeiling(1.34, 3.67, 5.00) },
    { what: "the court is already over before the run starts", expect: /past its \$5\.00 ceiling/,
      run: () => assertWithinCourtCeiling(5.01, 0.00, 5.00) },
  ];
  console.log("--prove-guard: arm M's three assertions, driven to REFUSE. No network call.");
  for (const arm of arms) {
    let threw: string | null = null;
    try { arm.run(); } catch (error) { threw = (error as Error).message; }
    if (threw === null) throw new Error(`THE GUARD DID NOT REFUSE: ${arm.what}`);
    if (!arm.expect.test(threw)) {
      throw new Error(`refused for the WRONG REASON on "${arm.what}":\n  ${threw}`);
    }
    console.log(`  REFUSED, and named it — ${arm.what}`);
    console.log(`    ${threw.split("\n").join(" / ")}`);
  }
  /* And the negative half in the same run, or the five above only prove that
     these functions throw at everything. */
  assertClauseIsTheOnlyDifference([base, base], [swap(base), swap(base)]);
  assertWardrobe([base, base], SUIT_LINE, "cell");
  /* Exactly AT the ceiling must PASS. A guard that refuses the very run it was
     sized for is the misaimed-guard class, and that one fails both ways. */
  assertWithinCourtCeiling(1.34, 3.66, 5.00);
  console.log(`  and ALL THREE pass the well-formed case — ${arms.length} refusals, 3 acceptances`);
  process.exit(0);
}

/* ── WHICH SIZE, AND WHY IT IS NOT MINE TO CHOOSE ── */

const wanted = process.argv[process.argv.indexOf("--size") + 1];
if (wanted !== "small" && wanted !== "large") {
  throw new Error("say which size: --size small or --size large. It is arm R's verdict, not a preference");
}
const SIZE = SIZES[wanted];

/*
  Arm R's rows, and its verdict RE-DERIVED here through different code (see
  `pairedSizeDelta`'s docblock). If size moves composition, the clause has to be
  calibrated at the ship size and a `--size small` run would produce numbers
  about a frame we do not ship.
*/
const armR = JSON.parse(readFileSync(`${ARM_R}/armR.json`, "utf8")) as {
  rollSeed: string; wardrobeLine: string;
  rows: Array<{ size: string; pos: number; share: number; headroom: number; below: number; gap: number | null }>;
};
const sizeVerdict = pairedSizeDelta(armR.rows, "small", "large");

mkdirSync(OUT, { recursive: true });

say(`ARM M — the margin clause, at ${wanted} (${SIZE.width}x${SIZE.height})`);
say(`  arm R's verdict, re-derived from its ${armR.rows.length} stored rows through different code:`);
say(`    ${sizeVerdict.pairs} pairs · median |dShare| ${sizeVerdict.medianAbsShare.toFixed(2)}pt (bar ${PAIRED_SHARE_BAR_PT})`
  + ` · median |dHeadroom| ${sizeVerdict.medianAbsHeadroom.toFixed(3)} (bar ${PAIRED_HEADROOM_BAR})`);
say(`    → size ${sizeVerdict.moves ? "MOVES" : "does NOT move"} composition`);
if (sizeVerdict.moves && wanted !== "large") {
  throw new Error("arm R says size MOVES composition, so the clause must be calibrated at the SHIP "
    + "size — refusing to render the cheap cell and call it the court");
}
say();

/* ── THE PROMPTS ── */

const { castingBriefCompiler } = await import("../server/castingV2/briefCompiler");

/* SUIT: arm R's own stored prompts, not a recompile (see the header). */
const suitStored = JSON.parse(readFileSync(`${ARM_R}/prompts.json`, "utf8")) as {
  rollSeed: string; wardrobeLine: string; prompts: string[];
};
if (suitStored.rollSeed !== SUIT_SEED || suitStored.wardrobeLine !== SUIT_LINE) {
  throw new Error("arm R's stored sheet is not the SUIT population this arm pairs against:"
    + `\n  seed ${suitStored.rollSeed} / line ${suitStored.wardrobeLine}`);
}
const suitControl = suitStored.prompts;
const suitClause = suitControl.map((prompt) => prompt.replace(FRAMING_FROM, FRAMING_TO));
assertWardrobe(suitControl, SUIT_LINE, "SUIT control (arm R's)");
assertWardrobe(suitClause, SUIT_LINE, "SUIT clause");
assertClauseIsTheOnlyDifference(suitControl, suitClause);
say(`  SUIT   ${suitControl.length} prompts reused from arm R · clause swapped · single-variable PROVEN`);

/* BASICS: one compile, both halves derived from it. */
const compiled = await castingBriefCompiler({
  briefText: BASICS_BRIEF,
  candidateCount: 8,
  rollSeed: BASICS_SEED,
  inheritedWardrobe: { path: "basics", line: BASICS_LINE },
} as never) as Record<string, any>;
if ((compiled.compiledBrief as Record<string, any>)?.interpreted !== true) {
  throw new Error("the fallback compiled BASICS — no sheet to measure");
}
if (compiled.wardrobeLine !== BASICS_LINE) {
  throw new Error(`BASICS resolved a different wardrobe line:\n  want ${BASICS_LINE}\n  got  ${compiled.wardrobeLine}`);
}
const basicsControl: string[] = (compiled.candidates ?? []).map((candidate: any) => candidate.prompt ?? "");
if (basicsControl.length !== 8) throw new Error(`BASICS compiled ${basicsControl.length} prompts, not 8`);
const basicsClause = basicsControl.map((prompt) => prompt.replace(FRAMING_FROM, FRAMING_TO));
assertWardrobe(basicsControl, BASICS_LINE, "BASICS control");
assertWardrobe(basicsClause, BASICS_LINE, "BASICS clause");
assertClauseIsTheOnlyDifference(basicsControl, basicsClause);
say(`  BASICS ${basicsControl.length} prompts compiled once · clause swapped · single-variable PROVEN`);
say(`  wardrobeLine="${compiled.wardrobeLine}"`);

const CELLS = [
  { id: "suit-clause", group: "SUIT", prompts: suitClause },
  /*
    ⚠ THE FLOOR CELL (granted fable-1555 Q1). Arm R's `large` SUIT prompts
    rendered a SECOND time — identical bytes, same size, same sitting — so the
    spread difference between it and arm R's own cell is PURE ENGINE NOISE at the
    ship size.

    That is exactly the floor the perturbation bar needs and never had: the
    control and clause prompt sets differ ONLY by the clause, so everything else
    about them is byte-identical, and the noise between two renders of one prompt
    set is the resolution limit of the comparison. Without it a PASS on that bar
    means nothing and so does a FAIL — the one free observation available
    (2.6 pt between two clause-free rolls) already exceeded the +2.0 pt bar.
  */
  { id: "suit-control-b", group: "SUIT", prompts: suitControl },
  { id: "basics-control", group: "BASICS", prompts: basicsControl },
  { id: "basics-clause", group: "BASICS", prompts: basicsClause },
] as const;

/*
  ⚠ THE PRICE IS THE UPPER OF TWO READINGS, ON PURPOSE. Arm R's settled ledger
  says arm 1's fresh figures are low by 28.6%, and the two sizes cannot be
  separated from one balance. So this prices at `small held at $0.0400 → large
  $0.0950` rather than the gentler `ratio held → $0.0836`. Under-pricing is how a
  court dies mid-run.
*/
const MEASURED_EACH = { small: 0.0514, large: 0.0950 } as const;
const EXPECTED_SPEND = CELLS.length * 8 * MEASURED_EACH[wanted] + CELLS.length * 8 * 2 * 0.005;

/*
  ⚠ THE COURT'S OWN CEILING — $5.00 total, hard, granted fable-1555 §2 after this
  court ate TWO price corrections. It is a STOP-AND-REPORT, not a judgement call:
  the remaining arms wait on a fresh grant rather than on somebody deciding the
  overrun is small.
*/
const COURT_CEILING = 5.00;
const COURT_SPENT = 1.34;   /* arm H $0.10 + arm R $1.24, both settled */

writeFileSync(`${OUT}/prompts.json`, JSON.stringify({
  size: wanted, clause: { from: FRAMING_FROM, to: FRAMING_TO },
  suitControl, suitClause, basicsControl, basicsClause,
}, null, 2), "utf8");

const before = await readFalBalance();
if (!before.ok) throw new Error(`cannot read the balance: ${before.why}`);
say();
say(`  expected spend $${EXPECTED_SPEND.toFixed(4)}  ·  fal balance before $${before.remaining.toFixed(4)}`);

say(`  court so far $${COURT_SPENT.toFixed(2)} + this run's upper $${EXPECTED_SPEND.toFixed(2)}`
  + ` = $${(COURT_SPENT + EXPECTED_SPEND).toFixed(2)} against a $${COURT_CEILING.toFixed(2)} ceiling`);
assertWithinCourtCeiling(COURT_SPENT, EXPECTED_SPEND, COURT_CEILING);

/* ⚠ THE TOP-UP GUARD. $20 is the AMOUNT, not the trigger. */
const FLOOR = 12;
const room = before.remaining - 2 * EXPECTED_SPEND;
say(`  top-up guard: balance - 2 x expected = $${room.toFixed(4)} against a $${FLOOR} floor`);
if (room <= FLOOR) {
  throw new Error(`REFUSING: $${room.toFixed(2)} of headroom is inside the top-up's observed window `
    + "($8.67-$10.01 trigger, $20 amount)");
}
say();

if (DRY) {
  say("--dry-run: every assertion passed and NOTHING was dispatched.");
  writeFileSync(`${OUT}/armM-dryrun.log`, lines.join("\n"), "utf8");
  process.exit(0);
}

/* ── THE RENDERS ── */

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop.js");

const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

/** `extentOf` returns pixels and a box; only the box is wanted here, and giving
 *  it a name keeps the read sites readable. */
const extentOfBox = (mask: Parameters<typeof extentOf>[0]) => extentOf(mask).box;

type Row = FramingFrame & { cell: string; pos: number; gap: number | null };
const rows: Row[] = [];
let images = 0;
let reads = 0;

for (const cell of CELLS) {
  say(`════ ${cell.id} ════`);
  const tiles: Buffer[] = [];
  for (let pos = 0; pos < cell.prompts.length; pos += 1) {
    const result = await engine.generateCandidate({
      prompt: cell.prompts[pos]!, size: `${SIZE.width}x${SIZE.height}`, quality: "medium",
    } as never);
    images += 1;
    writeFileSync(`${OUT}/${cell.id}-pos${pos}-raw.png`, result.bytes);

    const frameW = result.width;
    const frameH = result.height;
    if (typeof frameW !== "number" || typeof frameH !== "number") {
      throw new Error(`${cell.id}/pos${pos}: the engine reported no frame size — every share divides by it`);
    }

    const face = extentOfBox(await reader.region({ image: result.bytes, name: "face", absentIsAnswer: true }));
    reads += 1;
    const head = extentOfBox(await reader.region({ image: result.bytes, name: "head", absentIsAnswer: true }));
    reads += 1;

    if (face === null) {
      say(`  pos${pos}  NO FACE FOUND — the frame is kept, and dropped from the numbers`);
      continue;
    }
    const share = face.height / frameH;
    const headroom = face.top / face.height;
    const below = (frameH - face.top - face.height) / face.height;
    const gap = head === null ? null : (face.top - head.top) / face.height;
    rows.push({ cell: cell.id, group: cell.group, pos: `pos${pos}`, share, headroom, below, gap } as Row);
    say(`  pos${pos}  ${frameW}x${frameH}  face ${face.width}x${face.height} at ${face.left},${face.top}`
      + `  share ${(share * 100).toFixed(1)}%  headroom ${headroom.toFixed(3)}`
      + (head === null ? "  head ABSENT" : `  head top ${head.top}  gap ${gap!.toFixed(3)}`));

    const boxes = [face, ...(head ? [head] : [])].map((box) => ({
      x: box.left, y: box.top, width: box.width, height: box.height,
    }));
    const drawn = await sharp(result.bytes)
      .composite([{ input: Buffer.from(boxOutlineSvg(frameW, frameH, boxes)) }])
      .png().toBuffer();
    writeFileSync(`${OUT}/${cell.id}-pos${pos}-boxes.png`, drawn);
    tiles.push(await sharp(drawn)
      .resize({ width: 320, height: 480, fit: "contain", background: "#141414" })
      .png().toBuffer());
  }
  if (tiles.length > 0) {
    const sheet = await sharp({
      create: { width: 320 * tiles.length, height: 480, channels: 3, background: "#141414" },
    })
      .composite(tiles.map((tile, index) => ({ input: tile, left: 320 * index, top: 0 })))
      .png().toBuffer();
    writeFileSync(`${OUT}/CONTACT-${cell.id}.png`, sheet);
    say(`  kept ${OUT}/CONTACT-${cell.id}.png — the cell, both boxes, in dispatch order`);
  }
  say();
}

/* ── THE READING, AGAINST BARS WRITTEN BEFORE THE RUN ── */

/* The SUIT control is arm R's own cell at this size — the reason arm R rendered
   eight per size. Its rows carry `pos` as a number; this arm's carry a label. */
const suitControlFrames: FramingFrame[] = armR.rows
  .filter((row) => row.size === wanted && Number.isFinite(row.share))
  .map((row) => ({ group: "SUIT", pos: `pos${row.pos}`, share: row.share, headroom: row.headroom, below: row.below }));

const cellFrames = (id: string): FramingFrame[] => rows.filter((row) => row.cell === id);

say("THE READING — every number on the RAW frame, and no bar on a quantity the cut sets");
say();

const clauseCells = [...cellFrames("suit-clause"), ...cellFrames("basics-clause")];
if (clauseCells.length === 0) throw new Error("no clause frame carried a face — there is nothing to read");

const across = tMinOf(clauseCells);
const suitClauseRead = tMinOf(cellFrames("suit-clause"));
const basicsClauseRead = tMinOf(cellFrames("basics-clause"));
const basicsControlRead = tMinOf(cellFrames("basics-control"));
const suitControlRead = tMinOf(suitControlFrames);
/* The replicate — arm R's own prompts, rendered again. */
const suitControlBRead = tMinOf(cellFrames("suit-control-b"));

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
for (const [label, read] of [
  ["SUIT clause", suitClauseRead], ["BASICS clause", basicsClauseRead],
  ["BASICS control", basicsControlRead], ["SUIT control (arm R)", suitControlRead],
  ["SUIT control B (replicate)", suitControlBRead],
  ["BOTH clause cells", across],
] as const) {
  say(`  ${label.padEnd(22)} n=${read.n}  share med ${pct(read.shareMedian)} spread ${(read.shareSpread * 100).toFixed(1)}pt`
    + `  ·  R ${read.usableR.toFixed(2)}  T_min ${pct(read.tMin)}  binding ${read.binding.group}/${read.binding.pos}`);
}
say();

/* THE MARGIN BAR — three-way, and PARTIAL never ships. */
const tMinPct = across.tMin * 100;
const verdict = tMinPct <= TMIN_PASS ? "PASS" : tMinPct <= TMIN_PARTIAL ? "PARTIAL" : "FAIL";
say(`MARGIN BAR   T_min across both clause cells = ${tMinPct.toFixed(1)}%  →  ${verdict}`);
say(`  PASS <= ${TMIN_PASS.toFixed(1)} · PARTIAL <= ${TMIN_PARTIAL.toFixed(1)} · FAIL above`);
if (verdict === "PARTIAL") {
  say("  ⚠ PARTIAL NEVER SHIPS. Its only exit is his eyes on the strips — never a");
  say("     shift's judgement that this is close enough to the PASS line.");
}
say(`  today's untouched figure was 31.6% (arm 0, no clause), so the clause bought `
  + `${(31.6 - tMinPct).toFixed(1)} points of the ${(31.6 - TMIN_PASS).toFixed(1)} it needed`);
say();

/* THE MEDIAN BAR — the reshaped one (design §4, countersigned fable-1552 §1). */
const bandLow = Math.min(...ACCEPTED_BAND);
const bandHigh = Math.max(...ACCEPTED_BAND);
const inBand = tMinPct >= bandLow && tMinPct <= bandHigh;
say(`MEDIAN BAR   a common frame at ${tMinPct.toFixed(1)}% against the accepted band `
  + `${bandLow.toFixed(1)}-${bandHigh.toFixed(1)}%  →  ${inBand ? "INSIDE" : "OUTSIDE"}`);
for (const [label, read] of [["SUIT", suitClauseRead], ["BASICS", basicsClauseRead]] as const) {
  const move = Math.abs(tMinPct - read.shareMedian * 100);
  say(`  ${label.padEnd(7)} median ${pct(read.shareMedian)} → common frame moves it `
    + `${move.toFixed(1)}pt  (bar ${MEDIAN_MOVE_BAR_PT.toFixed(1)})  ${move <= MEDIAN_MOVE_BAR_PT ? "PASS" : "FAIL"}`);
}
say();

/*
  THE NOISE FLOOR, FIRST — because it decides whether the next bar can be read at
  all. Two renders of ONE prompt set, so the only difference between them is the
  engine (granted fable-1555 Q1).
*/
const floorPt = Math.abs(suitControlBRead.shareSpread * 100 - suitControlRead.shareSpread * 100);
say("NOISE FLOOR   arm R's SUIT prompts rendered twice — the engine alone, no clause");
say(`  run A (arm R) spread ${(suitControlRead.shareSpread * 100).toFixed(1)}pt`
  + `  ·  run B (replicate) spread ${(suitControlBRead.shareSpread * 100).toFixed(1)}pt`
  + `  →  floor ${floorPt.toFixed(1)}pt`);
say(`  the one prior observation was 2.6pt between two clause-free ROLLS (arm 0 vs arm R)`);
say();

/*
  THE PERTURBATION BAR — read INSIDE each population, never across the two, and
  read AT ALL only if the floor is below it.

  ⚠ PRE-REGISTERED BEFORE THE SPEND (opus-1197 §7, ruled fable-1555 Q1): if the
  measured floor is at or above the bar, the reading is NULL — this court does not
  establish the clause's effect on spread — and the bar is NOT widened to fit.
  Moving a bar after seeing what it would have said is optional stopping;
  declaring NULL is a reading.
*/
say("PERTURBATION BAR   the clause must not degrade the picture it widens");
const readable = floorPt < PERTURBATION_BAR_PT;
if (!readable) {
  say(`  ⚠ NULL — the floor (${floorPt.toFixed(1)}pt) is at or above the bar `
    + `(+${PERTURBATION_BAR_PT.toFixed(1)}pt), so neither a PASS nor a FAIL on it would`);
  say("     mean anything. This court does NOT establish the clause's effect on spread.");
  say("     The bar is not widened to fit — that pre-registration is why this line exists.");
}
for (const [label, clauseRead, controlRead] of [
  ["SUIT", suitClauseRead, suitControlRead],
  ["BASICS", basicsClauseRead, basicsControlRead],
] as const) {
  const clauseSpread = clauseRead.shareSpread * 100;
  const controlSpread = controlRead.shareSpread * 100;
  const delta = clauseSpread - controlSpread;
  say(`  ${label.padEnd(7)} control spread ${controlSpread.toFixed(1)}pt → clause ${clauseSpread.toFixed(1)}pt`
    + `  ·  ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pt (bar +${PERTURBATION_BAR_PT.toFixed(1)})`
    + `  ${readable ? (delta <= PERTURBATION_BAR_PT ? "PASS" : "FAIL") : "reported, NOT a verdict"}`);
}
say(`  ROUND2's own shipped clause moved its population +5.0pt and would fail this `
  + `${(5.0 / PERTURBATION_BAR_PT).toFixed(1)}x over — a bar no shipped lever could fail is not a bar`);
say();

/* THE HEAD GAP, on RAW frames, which is the whole point of §8c's added reads. */
say("HEAD GAP on RAW frames (§8c: 4 of 15 CUT suit frames was all that existed)");
for (const cell of CELLS) {
  const gaps = rows.filter((row) => row.cell === cell.id).map((row) => row.gap)
    .filter((gap): gap is number => gap !== null);
  const read = tMinOf(cellFrames(cell.id));
  if (gaps.length === 0) { say(`  ${cell.id.padEnd(15)} no head answered — the cut has no landmark here`); continue; }
  const worst = Math.max(...gaps);
  const clearance = read.usableR - worst;
  say(`  ${cell.id.padEnd(15)} n=${gaps.length}  widest gap ${worst.toFixed(3)}  ·  R ${read.usableR.toFixed(2)}`
    + `  →  clearance ${clearance >= 0 ? "+" : ""}${clearance.toFixed(3)} face-heights  `
    + `${clearance > 0 ? "CLEARS" : "⚠ CLIPS — the hair clause cannot be met at this R"}`);
}
say("  ⚠ CLEARS is NOT-CLIPPING. `FRAMING_FIXED` asks for CLEAR SPACE above the hair,");
say("     and whether the margin READS as air is his eye and not this number (law 9).");
say();

const identity = identityHolds([...clauseCells, ...cellFrames("basics-control"), ...cellFrames("suit-control-b")]);
say(`identity  below = 1/share - headroom - 1  holds on ${identity.held}/${identity.of} frames`);
say();

/* ── THE PRICE, AT A SETTLED LEDGER ── */

async function settled(from: number): Promise<number> {
  let last = from;
  let stable = 0;
  let now = from;
  for (let poll = 1; poll <= 12; poll += 1) {
    await sleep(60_000);
    const read = await readFalBalance();
    if (!read.ok) throw new Error(`balance unreadable: ${read.why}`);
    now = read.remaining;
    stable = now === last ? stable + 1 : 0;
    last = now;
    if (stable >= 2 && now < from) break;
  }
  return now;
}

const after = await readFalBalance();
if (!after.ok) throw new Error(`cannot read the balance after: ${after.why}`);
say("waiting for the ledger to settle — two consecutive equal reads after a move");
const settledAfter = await settled(after.remaining);
const spent = before.remaining - settledAfter;
say(`fal spent $${spent.toFixed(4)} for ${images} images and ${reads} reads at ${wanted}`);
const cumulative = COURT_SPENT + spent;
say(`COURT CUMULATIVE $${cumulative.toFixed(4)} against the $${COURT_CEILING.toFixed(2)} ceiling`
  + `  ${cumulative > COURT_CEILING ? "⚠ OVER — STOP AND REPORT, the remaining arms wait on a fresh grant" : "— clear"}`);
say(`  reads at $0.005 -> $${(reads * 0.005).toFixed(4)}; images therefore `
  + `$${((spent - reads * 0.005) / Math.max(1, images)).toFixed(4)} each against an expected $${SIZE.each.toFixed(4)}`);

writeFileSync(`${OUT}/armM.log`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/armM.json`, JSON.stringify({
  size: wanted, clause: { from: FRAMING_FROM, to: FRAMING_TO },
  rows, suitControlFrames, images, reads,
  balanceBefore: before.remaining, balanceSettledAfter: settledAfter, spent,
  verdict, tMinAcrossPct: tMinPct, floorPt, perturbationReadable: readable,
  courtSpentBefore: COURT_SPENT, courtCeiling: COURT_CEILING,
}, null, 2), "utf8");
say();
say(`kept: ${OUT}/armM.log, armM.json, ${images} raw frames, ${images} annotated, 3 contact sheets`);

/* And the last statement ends the process. */
process.exit(0);
