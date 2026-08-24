/**
 * ARM R OF THE FRAMING CONSISTENCY COURT — does RENDER SIZE change composition?
 * (Designed `docs/specs/CASTING_FRAMING_CONSISTENCY_COURT.md` §9, countersigned
 * fable-1552 §2 Q4; the `head` read added from §8c and granted fable-1553 Q1,
 * $2.9 -> $3.1 fal. The bar below is pre-registered where the design left arm R
 * barless, granted fable-1553 Q2.)
 *
 * # The question, and why it is a prerequisite rather than a curiosity
 *
 * The cut needs pixels to spend, so the shipping render cannot BE the delivered
 * size — it has to be larger, and the frame is then cropped IN. **If size moves
 * composition, the margin clause must be calibrated at the size we ship**, and
 * every number arm M produced at one size would be a number about the other.
 * So this runs first: eight prompts, dispatched at BOTH sizes, size as the only
 * variable.
 *
 * ⚠ **Its eight 1024x1536 frames ARE arm M's SUIT CONTROL CELL** — same sitting,
 * same seeds, same wardrobe line. That is why it renders eight per size rather
 * than the two a price reading would need.
 *
 * # The bar, pre-registered here before the run
 *
 *   median paired |dShare|     <= 1.5 pt              size does NOT move it
 *   median paired |dHeadroom|  <= 0.10 face-heights
 *
 * PAIRED, because the same prompt is rendered twice and the pair is the whole
 * design — an unpaired comparison of two eight-frame spreads would drown a real
 * size effect in the wobble the court exists to measure. 1.5 pt is the tolerance
 * this program already uses on a median it has accepted; 0.10 face-heights is a
 * third of the failed court's own headroom spread bar.
 *
 * Beyond either: the clause is calibrated at the SHIP size and arm M renders
 * there. Inside both: either size will do and arm M takes the cheaper one.
 *
 * # What it spends
 *
 *   8 images at 1024x1536      ~$0.0400 each   ~$0.32   fal
 *   8 images at 1536x2304      ~$0.0650 each   ~$0.52   fal
 *   16 `face` reads            ~$0.005 each    ~$0.08   fal   the court's measure
 *   16 `head` reads            ~$0.005 each    ~$0.08   fal   the CUT's landmark
 *   1 interpreter compile      ~$0.08                   openrouter
 *
 * **NO CREDITS AND NO ROWS.** It composes through the product's own entrance
 * (`castingBriefCompiler`) and dispatches straight at the engine; the candidate
 * row and the charge are the only absentees, and neither bears on whether two
 * sizes frame alike.
 *
 * # The three defects of the failed court, made structural (design §7)
 *
 * 1. **The wardrobe line never reached the prompts.** It is passed exactly as
 *    `createRoll` does — `inheritedWardrobe`, the real FOLLOW path, so the line
 *    is DETERMINISTIC and is the founder's own suit rather than whatever the
 *    interpreter picks tonight — and **every one of the eight composed prompts
 *    is asserted to CONTAIN it before a single image is dispatched.** It throws
 *    and buys nothing if not.
 * 2. **The raw is kept beside everything derived** (§8b's lesson: the failed
 *    court wrote only cut frames, so a finding about the cut had nothing to
 *    compare against). This arm cuts nothing, and it still keeps the raw bytes
 *    and an annotated copy of every frame.
 * 3. **The top-up guard.** `$20` in doctrine #25 is the top-up AMOUNT, not the
 *    trigger; the only observation this account has puts the trigger between
 *    $8.67 and $10.01. So the run refuses unless
 *    `balance - 2 * expectedSpend > $12` — the observed ceiling with margin —
 *    because a top-up landing mid-run destroys the price reading, which is
 *    exactly what happened last time.
 *
 * # And a frame is OPENED before a number is read (law 9)
 *
 * Every frame is written with its `face` and `head` boxes outlined through
 * `boxOutlineSvg` — the shared owner of what a box on a photograph looks like,
 * THIN WHITE, founder ruling fable-230. A contact sheet per size sits beside
 * them for comparing eight at once.
 *
 *   npx tsx scripts/_framing-armr-disposable.mts             # dispatches, spends
 *   npx tsx scripts/_framing-armr-disposable.mts --dry-run    # asserts only; one compile
 */

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";
import { boxOutlineSvg } from "./lib/termsPalette.mts";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const DRY = process.argv.includes("--dry-run");
const PROVE = process.argv.includes("--prove-guard");

const { castingBriefCompiler } = await import("../server/castingV2/briefCompiler");
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop.js");

const OUT = "output/framing-court/armR";

/*
  The SUIT population — the founder's own, and the tight end of the measured
  across-cast gap. Brief and wardrobe line are the ones the round-5 roll
  actually rendered and stored (`output/two-paths-court-round5/
  arm3-wardrobe-covered.json`), so this is that population rather than a
  lookalike.
*/
const BRIEF = "A retail bank manager in his forties, close-cropped greying hair, clean-shaven, "
  + "lined forehead, brown eyes, a tired but courteous set to the mouth, looking straight "
  + "into the lens.";
const SUIT_LINE = "a plain dark suit jacket over a white collared shirt, dark tailored trousers, "
  + "black leather dress shoes";
/* One seed for every SUIT cell in this court, so arm M's clause cell and this
   control cell resolve the same eight people. */
const ROLL_SEED = "framing-court-suit";

/* The control framing sentence, quoted from `FRAMING_FIXED`. Asserted present
   here so arm M's swap has a proven starting point rather than a hopeful one. */
const CONTROL_FRAMING = "Frame from mid-torso up in a 2:3 portrait.";

const SIZES = [
  { id: "small", width: 1024, height: 1536, expectedEach: 0.0400 },
  { id: "large", width: 1536, height: 2304, expectedEach: 0.0650 },
] as const;

const PER_SIZE = 8;
const EXPECTED_IMAGES = SIZES.reduce((sum, size) => sum + size.expectedEach * PER_SIZE, 0);
const EXPECTED_SPEND = EXPECTED_IMAGES + SIZES.length * PER_SIZE * 2 * 0.005;

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

mkdirSync(OUT, { recursive: true });

/**
 * ⚠ THE ASSERTION THE FAILED COURT DID NOT HAVE, and the only copy of it.
 *
 * A resolved wardrobe line that never reaches the prompt is a population nobody
 * rendered — the failed court's second defect — so it is checked **on the
 * outgoing text** rather than on the constant sitting beside it (invariant 5's
 * shape: assert at the wire). The control framing sentence is checked in the
 * same breath, because arm M's swap needs a proven starting point rather than a
 * hopeful one.
 *
 * It lives in a function so `--prove-guard` drives THIS code rather than a
 * second copy of it that agrees with me. A guard proven through a paraphrase is
 * a guard nobody has tested.
 */
function assertPromptsCarry(candidatePrompts: readonly string[], wardrobeLine: string): void {
  const missingWardrobe = candidatePrompts
    .map((prompt, index) => (prompt.includes(wardrobeLine) ? null : index))
    .filter((index): index is number => index !== null);
  if (missingWardrobe.length > 0) {
    throw new Error(`the wardrobe line is ABSENT from prompt(s) ${missingWardrobe.join(", ")}`
      + " — buying nothing (design §7(2))");
  }
  const missingFraming = candidatePrompts
    .map((prompt, index) => (prompt.includes(CONTROL_FRAMING) ? null : index))
    .filter((index): index is number => index !== null);
  if (missingFraming.length > 0) {
    throw new Error(`the control framing sentence is ABSENT from prompt(s) ${missingFraming.join(", ")}`
      + " — arm M's swap would have no proven starting point");
  }
}

/*
  ⚠ THE POSITIVE CONTROL, and it runs before the network does.

  `--dry-run` proves the guard PASSES on the compiler's real output. That is a
  negative arm and it cannot find a guard that never refuses — an
  absence-only expectation is green when the thing it checks is missing. So this
  arm drives the same function over prompts built to fail, one defect at a time,
  and insists each one throws AND names its own reason. It calls no network and
  spends nothing.
*/
if (PROVE) {
  const good = `blah blah ${CONTROL_FRAMING} blah wearing ${SUIT_LINE}. blah`;
  const arms: Array<{ what: string; prompts: string[]; expect: RegExp }> = [
    { what: "one prompt of eight has lost the wardrobe line", expect: /wardrobe line is ABSENT from prompt\(s\) 5\b/,
      prompts: Array.from({ length: 8 }, (_, i) => (i === 5 ? good.replace(SUIT_LINE, "a hat") : good)) },
    { what: "every prompt has lost the wardrobe line", expect: /wardrobe line is ABSENT from prompt\(s\) 0, 1, 2, 3, 4, 5, 6, 7/,
      prompts: Array.from({ length: 8 }, () => good.replace(SUIT_LINE, "a hat")) },
    { what: "one prompt of eight has lost the control framing sentence", expect: /control framing sentence is ABSENT from prompt\(s\) 2\b/,
      prompts: Array.from({ length: 8 }, (_, i) => (i === 2 ? good.replace(CONTROL_FRAMING, "Frame it nicely.") : good)) },
    { what: "the line is present but TRUNCATED — a substring is not the line", expect: /wardrobe line is ABSENT/,
      prompts: Array.from({ length: 8 }, () => good.replace(SUIT_LINE, SUIT_LINE.slice(0, -6))) },
  ];
  console.log("--prove-guard: the wardrobe/framing assertion, driven to REFUSE. No network call.");
  let held = 0;
  for (const arm of arms) {
    let threw: string | null = null;
    try { assertPromptsCarry(arm.prompts, SUIT_LINE); } catch (error) { threw = (error as Error).message; }
    if (threw === null) throw new Error(`THE GUARD DID NOT REFUSE: ${arm.what}`);
    if (!arm.expect.test(threw)) {
      throw new Error(`the guard refused for the WRONG REASON on "${arm.what}":\n  ${threw}`);
    }
    held += 1;
    console.log(`  REFUSED, and named it — ${arm.what}`);
    console.log(`    ${threw}`);
  }
  /* And the negative half in the same run: the real shape must PASS, or the
     four arms above are only proving that the function throws at everything. */
  assertPromptsCarry(Array.from({ length: 8 }, () => good), SUIT_LINE);
  console.log(`  and it PASSES the well-formed sheet — ${held} refusals, 1 acceptance`);
  process.exit(0);
}

/**
 * Poll until the ledger stops moving — two equal reads after a move. fal's
 * balance settles ~3 minutes late, and one change is the middle of settlement
 * rather than the end of it.
 */
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

const before = await readFalBalance();
if (!before.ok) throw new Error(`cannot read the balance: ${before.why}`);

say("ARM R — does render size change composition? SUIT, eight prompts, both sizes");
say(`  expected spend $${EXPECTED_SPEND.toFixed(4)}  ·  fal balance before $${before.remaining.toFixed(4)}`);

/*
  ⚠ THE TOP-UP GUARD. $20 is the AMOUNT, not the trigger; the trigger is known
  only to sit between $8.67 and $10.01. Refuse rather than let a replenishment
  land inside the reading.
*/
const FLOOR = 12;
const headroom = before.remaining - 2 * EXPECTED_SPEND;
say(`  top-up guard: balance - 2 x expected = $${headroom.toFixed(4)} against a $${FLOOR} floor`);
if (headroom <= FLOOR) {
  throw new Error(`REFUSING: $${headroom.toFixed(2)} of headroom is inside the top-up's observed window `
    + "($8.67-$10.01 trigger, $20 amount) — a replenishment mid-run destroys the price reading");
}
say();

/* ─── THE COMPILE, AND THE ASSERTIONS THAT RUN BEFORE ANY IMAGE IS BOUGHT ─── */

const compiled = await castingBriefCompiler({
  briefText: BRIEF,
  candidateCount: PER_SIZE,
  rollSeed: ROLL_SEED,
  /* Exactly as `createRoll` hands a FOLLOW its parent's pair. Deterministic,
     and it is the founder's suit rather than tonight's pick. */
  inheritedWardrobe: { path: "wardrobe", line: SUIT_LINE },
} as never) as Record<string, any>;

const blob = (compiled.compiledBrief ?? {}) as Record<string, any>;
if (blob.interpreted !== true) throw new Error("the fallback compiled it — no sheet to measure");

const prompts: string[] = (compiled.candidates ?? []).map((candidate: any) => candidate.prompt ?? "");
if (prompts.length !== PER_SIZE) throw new Error(`expected ${PER_SIZE} prompts, got ${prompts.length}`);

if (compiled.wardrobeLine !== SUIT_LINE) {
  throw new Error("the compiler resolved a different wardrobe line:"
    + `\n  want ${SUIT_LINE}\n  got  ${compiled.wardrobeLine}`);
}
assertPromptsCarry(prompts, SUIT_LINE);
say("  compiled 8 prompts · interpreted · wardrobe line in 8/8 · control framing in 8/8");
say(`  wardrobeLine="${compiled.wardrobeLine}"`);
writeFileSync(
  `${OUT}/prompts.json`,
  JSON.stringify({ rollSeed: ROLL_SEED, wardrobeLine: compiled.wardrobeLine, prompts }, null, 2),
  "utf8",
);
say();

if (DRY) {
  say("--dry-run: every assertion passed and NOTHING was dispatched. One openrouter compile spent.");
  writeFileSync(`${OUT}/armR-dryrun.log`, lines.join("\n"), "utf8");
  process.exit(0);
}

/* ─── THE RENDERS ─── */

const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

type Row = {
  size: string; pos: number; frameW: number; frameH: number;
  share: number; headroom: number; below: number;
  gap: number | null; headTop: number | null;
};
const rows: Row[] = [];
let images = 0;
let reads = 0;

for (const size of SIZES) {
  say(`════ ${size.id} — ${size.width}x${size.height} ════`);
  const tiles: Buffer[] = [];
  for (let pos = 0; pos < prompts.length; pos += 1) {
    const result = await engine.generateCandidate({
      prompt: prompts[pos]!, size: `${size.width}x${size.height}`, quality: "medium",
    } as never);
    images += 1;
    /* The RAW bytes, kept before anything is derived from them (§7(2)). */
    writeFileSync(`${OUT}/${size.id}-pos${pos}-raw.png`, result.bytes);

    /*
      ⚠ THE DELIVERED SIZE IS READ OFF THE RESULT AND REFUSED IF ABSENT, rather
      than assumed to be the size that was asked for. Every share in this arm is
      a ratio whose denominator is the frame height, so a missing dimension is
      the difference between a number and a silent NaN — and the engine's own
      type says it is optional.
    */
    const frameW = result.width;
    const frameH = result.height;
    if (typeof frameW !== "number" || typeof frameH !== "number") {
      throw new Error(`${size.id}/pos${pos}: the engine reported no frame size — every share here divides by it`);
    }

    const faceMask = await reader.region({ image: result.bytes, name: "face", absentIsAnswer: true });
    reads += 1;
    const face = extentOf(faceMask).box;
    const headMask = await reader.region({ image: result.bytes, name: "head", absentIsAnswer: true });
    reads += 1;
    const head = extentOf(headMask).box;

    if (face === null) {
      say(`  pos${pos}  NO FACE FOUND — the frame is kept, and dropped from the numbers`);
      rows.push({
        size: size.id, pos, frameW, frameH,
        share: NaN, headroom: NaN, below: NaN, gap: null, headTop: head?.top ?? null,
      });
      continue;
    }
    const share = face.height / frameH;
    const room = face.top / face.height;
    const below = (frameH - face.top - face.height) / face.height;
    const gap = head === null ? null : (face.top - head.top) / face.height;
    rows.push({
      size: size.id, pos, frameW, frameH,
      share, headroom: room, below, gap, headTop: head?.top ?? null,
    });
    say(`  pos${pos}  ${frameW}x${frameH}  face ${face.width}x${face.height} at ${face.left},${face.top}`
      + `  share ${(share * 100).toFixed(1)}%  headroom ${room.toFixed(3)}`
      + (head === null ? "  head ABSENT" : `  head top ${head.top}  gap ${gap!.toFixed(3)}`));

    /* THE FRAME, OPENED. Both boxes, thin white, through the shared owner. */
    const boxes = [face, ...(head ? [head] : [])].map((box) => ({
      x: box.left, y: box.top, width: box.width, height: box.height,
    }));
    const drawn = await sharp(result.bytes)
      .composite([{ input: Buffer.from(boxOutlineSvg(frameW, frameH, boxes)) }])
      .png().toBuffer();
    writeFileSync(`${OUT}/${size.id}-pos${pos}-boxes.png`, drawn);
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
    writeFileSync(`${OUT}/CONTACT-${size.id}.png`, sheet);
    say(`  kept ${OUT}/CONTACT-${size.id}.png — eight frames, both boxes, in dispatch order`);
  }
  say();
}

/* ─── THE READING ─── */

const stat = (values: number[]) => {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  return {
    n: sorted.length,
    med: sorted[Math.floor(sorted.length / 2)]!,
    min: sorted[0]!,
    max: sorted.at(-1)!,
    spread: sorted.at(-1)! - sorted[0]!,
  };
};

say("THE READING");
for (const size of SIZES) {
  const mine = rows.filter((row) => row.size === size.id && Number.isFinite(row.share));
  if (mine.length === 0) { say(`  ${size.id}: no frame carried a face`); continue; }
  const shares = stat(mine.map((row) => row.share * 100));
  const rooms = stat(mine.map((row) => row.headroom));
  const gaps = mine.map((row) => row.gap).filter((gap): gap is number => gap !== null);
  say(`  ${size.id.padEnd(6)} n=${mine.length}  share med ${shares.med.toFixed(1)}% spread ${shares.spread.toFixed(1)}pt`
    + `  ·  headroom med ${rooms.med.toFixed(3)} spread ${rooms.spread.toFixed(3)}`);
  say(`         gap  n=${gaps.length}`
    + (gaps.length === 0
      ? "  — `head` answered on nothing, and the cut has no landmark on this cell"
      : `  med ${stat(gaps).med.toFixed(3)}  max ${stat(gaps).max.toFixed(3)}`
        + `  ·  §8c's measured cell was 0.215-0.289 on CUT suit frames`));
}
say();

/* THE PAIRED DELTA — the whole design. Same prompt, two sizes. */
say("PAIRED — same prompt, size as the only variable (large minus small)");
const dShare: number[] = [];
const dRoom: number[] = [];
for (let pos = 0; pos < PER_SIZE; pos += 1) {
  const small = rows.find((row) => row.size === "small" && row.pos === pos);
  const large = rows.find((row) => row.size === "large" && row.pos === pos);
  if (!small || !large || !Number.isFinite(small.share) || !Number.isFinite(large.share)) {
    say(`  pos${pos}  incomplete pair — excluded`);
    continue;
  }
  const deltaShare = (large.share - small.share) * 100;
  const deltaRoom = large.headroom - small.headroom;
  dShare.push(deltaShare);
  dRoom.push(deltaRoom);
  say(`  pos${pos}  dShare ${deltaShare >= 0 ? "+" : ""}${deltaShare.toFixed(1)}pt`
    + `   dHeadroom ${deltaRoom >= 0 ? "+" : ""}${deltaRoom.toFixed(3)}`);
}
say();
if (dShare.length === 0) {
  say("  ⚠ NO COMPLETE PAIR — arm R has no answer and arm M must not be calibrated on it");
} else {
  const absShare = stat(dShare.map(Math.abs)).med;
  const absRoom = stat(dRoom.map(Math.abs)).med;
  const signedShare = stat(dShare).med;
  const signedRoom = stat(dRoom).med;
  say(`  median SIGNED    dShare ${signedShare >= 0 ? "+" : ""}${signedShare.toFixed(2)}pt`
    + `   dHeadroom ${signedRoom >= 0 ? "+" : ""}${signedRoom.toFixed(3)}`);
  say(`  median ABSOLUTE  dShare ${absShare.toFixed(2)}pt (bar 1.50)`
    + `   dHeadroom ${absRoom.toFixed(3)} (bar 0.100)`);
  const moves = absShare > 1.5 || absRoom > 0.10;
  say(`  BAR (pre-registered in this script's header, n=${dShare.length} pairs):`);
  say(moves
    ? "    ⚠ SIZE MOVES COMPOSITION — arm M is calibrated at the SHIP size and nowhere else"
    : "    SIZE DOES NOT MOVE COMPOSITION — arm M may render at either size");
}
say();

/* ─── THE PRICE, AT A SETTLED LEDGER ─── */

const after = await readFalBalance();
if (!after.ok) throw new Error(`cannot read the balance after: ${after.why}`);
say("waiting for the ledger to settle — two consecutive equal reads after a move");
const settledAfter = await settled(after.remaining);
const spent = before.remaining - settledAfter;
const imagesOnly = spent - reads * 0.005;
say(`fal spent $${spent.toFixed(4)} for ${images} images and ${reads} reads`);
say(`  reads at $0.005 -> $${(reads * 0.005).toFixed(4)}; images therefore $${imagesOnly.toFixed(4)} across two sizes`);
say("  ⚠ TWO SIZES CANNOT BE SEPARATED FROM ONE BALANCE. The per-size figures stay");
say("     the expected ones unless the total contradicts them:");
say(`     expected images $${EXPECTED_IMAGES.toFixed(4)}  against measured $${imagesOnly.toFixed(4)}`);
say("  the 2026-07-30 planning constant is $0.099 for 1024x1536 and is not used here");

writeFileSync(`${OUT}/armR.log`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/armR.json`, JSON.stringify({
  rollSeed: ROLL_SEED, wardrobeLine: compiled.wardrobeLine, rows, images, reads,
  balanceBefore: before.remaining, balanceSettledAfter: settledAfter, spent,
}, null, 2), "utf8");
say();
say(`kept: ${OUT}/armR.log, armR.json, ${images} raw frames, ${images} annotated, 2 contact sheets`);

/* And the last statement ends the process. */
process.exit(0);
