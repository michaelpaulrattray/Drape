/**
 * THE CLAUSE-ONLY COURT, AT THE SHIP SIZE — does the clause hold at 1024×1536?
 * (Ordered fable-1566 on the founder's own words, 2026-08-24: *"i honestly dont
 * understand why we even need to be cropping STRIP-A Suit raw looks absolutely
 * fine every image obeyed the frame same with the STRIP B basics raw."*)
 *
 * # Why this is the last question and not another arm
 *
 * His eye accepted the CLAUSE CELLS' RAW FRAMES as delivered product. Those rows
 * already carry the campaign's headline — across-cast gap 0.9pt inside a 1.2pt
 * floor, within-sheet spread 3.5/3.6pt against today's 6.6–7.4 — so **the cut's
 * only marginal purchase is 3.5pt → ~0, and the judge law 9 names has looked at
 * the 3.5pt row and called it fine.** If the clause holds without the cut, the
 * framing fix is ONE SENTENCE in `FRAMING_FIXED` and the whole build — the larger
 * render, the crop, the head-gap `R` policy, the tall-hair outlier ruling, the
 * latency and the extra spend per sheet — retires unbuilt.
 *
 * **The one unknown is size.** Every clause frame was rendered at 1536×2304
 * because the CUT needed the margin; a clause-only ship renders at 1024×1536, and
 * arm R measured that size moves composition (median |dShare| 3.10pt, 8 pairs).
 * So the clause's numbers do not transfer and have to be bought once more.
 *
 * # Single variable: SIZE, and it is proven rather than promised
 *
 * The prompts are arm M's own clause prompts read back from `prompts.json` and
 * asserted BYTE-IDENTICAL. No recompile — the interpreter is a language model and
 * a second compile is a different sheet, which is the requirement that has now
 * bitten this campaign twice from two different directions.
 *
 * # The bar, pre-registered before the run (fable-1566, quoted)
 *
 *   SPREAD      <= 4.5pt per cell. His accepted rows carry 3.5/3.6 at large; the
 *               bar gives the size shift room without letting the wobble regress
 *               toward today's 6.6-7.4.
 *   GAP         across-cast median gap <= 2.0pt. Loose against the measured 0.9,
 *               honest against a floor measured n=1 at another size.
 *   HAIR        no clipped hair AS DELIVERED — the engine's own framing, same
 *               CROP clause on the wire. Expected to hold; asserted anyway, at
 *               the frames, because `FRAMING_FIXED` asking for it is not evidence
 *               that it happened.
 *   HIS STRIPS  raw contact rows at ship size, same construction as STRIP-A/B.
 *               What he accepted is a LOOK, and the ship-size look is what he
 *               has to see. No number substitutes for it (law 9).
 *
 *   npx tsx scripts/_framing-shipsize-disposable.mts --prove-guard
 *   npx tsx scripts/_framing-shipsize-disposable.mts --dry-run
 *   npx tsx scripts/_framing-shipsize-disposable.mts
 *   npx tsx scripts/_framing-shipsize-disposable.mts --resume
 */

import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";
import { type FramingFrame, identityHolds, tMinOf } from "./lib/framingTmin.mts";
import { boxOutlineSvg } from "./lib/termsPalette.mts";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const DRY = process.argv.includes("--dry-run");
const PROVE = process.argv.includes("--prove-guard");
const RESUME = process.argv.includes("--resume");

const OUT = "output/framing-court/shipsize";
const ARM_M = "output/framing-court/armM";
const RESUME_LOGS = ["output/_shipsize-run.log"];
/** The size a roll actually delivers today. */
const SIZE = { width: 1024, height: 1536 };

/* ── THE BARS, and every one of them written above before it was coded ── */
const SPREAD_BAR_PT = 4.5;
const GAP_BAR_PT = 2.0;

/**
 * ⚠ THE PRICE, AND IT IS THE UPPER OF WHAT IS KNOWN. `small` has never been
 * settled on its own — arm R rendered both sizes against one balance. What IS
 * settled is `large`: expected $0.0650, actual $0.0777–$0.0800, a factor of
 * ~1.23. Applying that factor to small's own fresh reading ($0.0514) gives
 * ~$0.063, and this prices there rather than at $0.0514. Under-pricing is how a
 * court dies mid-run, and this one has already watched that happen.
 */
const MEASURED_EACH = 0.0630;
/**
 * ⚠ THE CEILING AND WHAT HAS ALREADY BEEN DRAWN AGAINST IT. fable-1563 reserved
 * $2.00 for the build's prerequisite courts; arm V2 drew $0.8900 of it before I
 * could stop a process that outlived its own task. So the room is $1.11, not
 * $2.00, and this run's own price decides whether that is enough — the guard
 * answers it rather than a memory.
 */
const CEILING = 2.50;
const DRAWN_ALREADY = 0.89;
/*
  ⚠ $2.00 → $2.50, RESTATED RATHER THAN DRIFTED PAST (fable-1568 §2). The guard
  below refused this run at $2.00 — $0.89 drawn plus $1.17 upper is $2.06 — and
  that refusal is why the number moved by a ruling instead of by a shift deciding
  $0.06 was small. Same hard-stop semantics: a settled reading past it stops the
  court.
*/

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

/** The prompts must be arm M's, to the byte. Size is the only variable. */
function assertByteIdentical(mine: readonly string[], theirs: readonly string[], what: string): void {
  if (mine.length !== theirs.length) {
    throw new Error(`${what}: ${mine.length} prompts against arm M's ${theirs.length} — not the same sheet`);
  }
  const wrong = mine.map((p, i) => (p === theirs[i] ? null : i)).filter((i): i is number => i !== null);
  if (wrong.length > 0) {
    throw new Error(`${what}: prompt(s) ${wrong.join(", ")} are NOT byte-identical to arm M's`
      + " — size would not be the only variable");
  }
}

function assertWithinCeiling(drawn: number, expected: number, ceiling: number): void {
  if (drawn + expected > ceiling) {
    throw new Error(`REFUSING: $${drawn.toFixed(2)} is already drawn and this run's upper price is `
      + `$${expected.toFixed(2)}, which would take this court to $${(drawn + expected).toFixed(2)} past its `
      + `$${ceiling.toFixed(2)} ceiling — stop and report`);
  }
}

/** A provider refusal of the prompt is tolerated; every other failure is not. */
function refusalOf(error: unknown): { providerRef: string } | null {
  const provider = error as { failureClass?: unknown; providerRef?: unknown };
  if (provider?.failureClass !== "content_policy") return null;
  return { providerRef: typeof provider.providerRef === "string" ? provider.providerRef : "unnamed" };
}

/**
 * ⚠ IS THE HAIR CLIPPED, AS DELIVERED? The `head` box touching the frame's top
 * edge is the signal arm H's §8b used, on a frame the last court's own cut
 * produced. `headTop === 0` means the reader found head pixels in the topmost
 * row, which is what a crown running off the top looks like to a segmenter.
 *
 * It is a SUSPICION and it is named as one: the bar is *no clipped hair*, and the
 * verdict on a frame goes in front of eyes. This flags which frames to open.
 */
const clippedAsDelivered = (headTop: number | null) => headTop === 0;

/* Regex LITERALS, never `new RegExp("...")` — a heredoc collapses `\\d` to `\d`
   inside a JS string, where it means a literal `d`, and the parse then finds
   nothing and says so quietly. */
const LOG_CELL = /^════ (\S+) ════$/;
const LOG_ROW = /^ {2}pos(\d+) {2}(\d+)x(\d+) {2}face (\d+)x(\d+) at (\d+),(\d+) {2}share ([\d.]+)% {2}headroom ([\d.]+)(?: {2}head top (\d+) {2}gap (-?[\d.]+)| {2}head ABSENT)(?: · recovered)?$/;
const LOG_REFUSAL = /^ {2}pos(\d+) {2}⚠ REFUSED content_policy · providerRef (\S+)/;

type Rec = {
  rows: Array<{ cell: string; group: string; pos: string; share: number; headroom: number; below: number; gap: number | null; headTop: number | null; line: string }>;
  refusals: Array<{ cell: string; pos: number; providerRef: string }>;
  disagreements: string[];
};

function recoverFromLog(
  text: string,
  groupOf: (cell: string) => string | undefined,
  frameOnDisk: (cell: string, pos: number) => boolean,
  into: Rec = { rows: [], refusals: [], disagreements: [] },
): Rec {
  const byPos = new Map(into.rows.map((r) => [`${r.cell}/${r.pos}`, r]));
  const refusedBy = new Map(into.refusals.map((o) => [`${o.cell}/pos${o.pos}`, o]));
  const disagreements = into.disagreements;
  let cell: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const header = LOG_CELL.exec(line);
    if (header) { cell = header[1]!; continue; }
    if (cell === null) continue;
    const group = groupOf(cell);
    if (group === undefined) continue;
    const refused = LOG_REFUSAL.exec(line);
    if (refused) {
      refusedBy.set(`${cell}/pos${refused[1]}`, { cell, pos: Number(refused[1]), providerRef: refused[2]! });
      continue;
    }
    const row = LOG_ROW.exec(line);
    if (!row) continue;
    const pos = Number(row[1]);
    const frameH = Number(row[3]);
    const faceH = Number(row[5]);
    const faceTop = Number(row[7]);
    if (!frameOnDisk(cell, pos)) {
      disagreements.push(`${cell}/pos${pos}: the log has a row and the raw frame is NOT on disk`);
      continue;
    }
    /* Groups, named once rather than counted at each use — the first draft of
       this block read `row[9]` for BOTH headroom and head-top, which would have
       recovered a head-top of "0.459" and called the frame clipped. */
    const [, , , , , , , , shareText, headroomText, headTopText, gapText] = row;
    const share = faceH / frameH;
    const headroom = faceTop / faceH;
    const headTop = headTopText === undefined ? null : Number(headTopText);
    const gap = headTop === null ? null : (faceTop - headTop) / faceH;
    /* THE CONTROL ON THE PARSE: recompute, then insist the log's own printed
       figure agrees to the precision it was printed at. */
    if ((share * 100).toFixed(1) !== shareText) {
      disagreements.push(`${cell}/pos${pos}: share recomputes to ${(share * 100).toFixed(1)} and the log printed ${shareText}`);
    }
    if (headroom.toFixed(3) !== headroomText) {
      disagreements.push(`${cell}/pos${pos}: headroom recomputes to ${headroom.toFixed(3)} and the log printed ${headroomText}`);
    }
    if (gap !== null && gapText !== undefined && gap.toFixed(3) !== gapText) {
      disagreements.push(`${cell}/pos${pos}: gap recomputes to ${gap.toFixed(3)} and the log printed ${gapText}`);
    }
    byPos.set(`${cell}/pos${pos}`, {
      cell, group, pos: `pos${pos}`, share, headroom,
      below: (frameH - faceTop - faceH) / faceH, gap, headTop,
      line: `${line.replace(/ · recovered$/, "")} · recovered`,
    });
  }
  for (const key of byPos.keys()) refusedBy.delete(key);
  return { rows: [...byPos.values()], refusals: [...refusedBy.values()], disagreements };
}

function assertRecoveryAgrees(rec: Rec): void {
  if (rec.disagreements.length > 0) {
    throw new Error("REFUSING to resume — the recovered rows do not survive their own recomputation:\n  "
      + rec.disagreements.join("\n  "));
  }
}

if (PROVE) {
  const armMPrompts = JSON.parse(readFileSync(`${ARM_M}/prompts.json`, "utf8")) as { suitClause: string[] };
  const arms: Array<{ what: string; run: () => void; expect: RegExp }> = [
    { what: "a prompt drifted from arm M's by one character", expect: /prompt\(s\) 1 are NOT byte-identical/,
      run: () => assertByteIdentical([armMPrompts.suitClause[0]!, `${armMPrompts.suitClause[1]!} `],
        [armMPrompts.suitClause[0]!, armMPrompts.suitClause[1]!], "SUIT") },
    { what: "the sheet is a different length", expect: /not the same sheet/,
      run: () => assertByteIdentical([armMPrompts.suitClause[0]!], armMPrompts.suitClause.slice(0, 2), "SUIT") },
    { what: "the run would cross what is LEFT of the ceiling", expect: /\$0\.89 is already drawn/,
      run: () => assertWithinCeiling(0.89, 1.12, 2.00) },
    { what: "a recovered row's raw frame is not on disk", expect: /raw frame is NOT on disk/,
      run: () => assertRecoveryAgrees(recoverFromLog(
        `════ suit-ship ════\n  pos0  1024x1536  face 264x295 at 385,135  share 19.2%  headroom 0.458  head top 70  gap 0.220\n`,
        () => "SUIT", () => false)) },
  ];
  console.log("--prove-guard: the ship-size court's assertions, driven to REFUSE. No network call.");
  for (const arm of arms) {
    let threw: string | null = null;
    try { arm.run(); } catch (error) { threw = (error as Error).message; }
    if (threw === null) throw new Error(`THE GUARD DID NOT REFUSE: ${arm.what}`);
    if (!arm.expect.test(threw)) throw new Error(`refused for the WRONG REASON on "${arm.what}":\n  ${threw}`);
    console.log(`  REFUSED, and named it — ${arm.what}`);
    console.log(`    ${threw.split("\n").join(" / ")}`);
  }
  assertByteIdentical(armMPrompts.suitClause, armMPrompts.suitClause, "SUIT");
  assertWithinCeiling(0.89, 1.11, 2.00);   /* exactly AT the remaining room must pass */
  const yesNo: Array<[string, boolean]> = [
    ["a head box on the top row reads as CLIPPED", clippedAsDelivered(0)],
    ["a head box below the top row does not", !clippedAsDelivered(37)],
    ["and an ABSENT head is not silently called clipped", !clippedAsDelivered(null)],
    ["a `content_policy` failure is TOLERATED", refusalOf({ failureClass: "content_policy" }) !== null],
    ["every OTHER class still kills the run", refusalOf({ failureClass: "timeout" }) === null],
  ];
  for (const [what, held] of yesNo) {
    if (!held) throw new Error(`THE DECISION WENT THE WRONG WAY: ${what}`);
    console.log(`  held — ${what}`);
  }
  console.log(`  and every one passes the well-formed case — ${arms.length} refusals, 2 acceptances`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
say(`THE CLAUSE-ONLY COURT, at the SHIP size ${SIZE.width}x${SIZE.height}`);
say("  his words: \"i honestly dont understand why we even need to be cropping\"");
say();

const stored = JSON.parse(readFileSync(`${ARM_M}/prompts.json`, "utf8")) as {
  clause: { from: string; to: string }; suitClause: string[]; basicsClause: string[];
};
const CELLS = [
  { id: "suit-ship", group: "SUIT", prompts: stored.suitClause },
  { id: "basics-ship", group: "BASICS", prompts: stored.basicsClause },
] as const;
assertByteIdentical(CELLS[0].prompts, stored.suitClause, "SUIT");
assertByteIdentical(CELLS[1].prompts, stored.basicsClause, "BASICS");
say(`  SUIT ${CELLS[0].prompts.length} · BASICS ${CELLS[1].prompts.length} prompts — arm M's own, BYTE-IDENTICAL`);
say("  size is the only variable; no recompile, because a second compile is a different sheet");
say();

const groupOfCell = (id: string) => CELLS.find((c) => c.id === id)?.group;
const frameOnDisk = (cell: string, pos: number) => existsSync(`${OUT}/${cell}-pos${pos}-raw.png`);
let recovered: Rec = { rows: [], refusals: [], disagreements: [] };
if (RESUME) {
  const read: string[] = [];
  for (const log of RESUME_LOGS) {
    if (!existsSync(log)) continue;
    read.push(log);
    recovered = recoverFromLog(readFileSync(log, "utf8"), groupOfCell, frameOnDisk, recovered);
  }
  if (recovered.rows.length === 0 && recovered.refusals.length === 0) {
    throw new Error(`REFUSING: --resume read ${read.length} log(s) and recovered NOTHING`
      + " — a broken parse, not an empty court");
  }
  say(`  RESUME  recovered ${recovered.rows.length} rows and ${recovered.refusals.length} refusals from ${read.join(" + ")}`);
}
assertRecoveryAgrees(recovered);

const settledAlready = new Map<string, Set<number>>();
for (const c of CELLS) settledAlready.set(c.id, new Set());
for (const r of recovered.rows) settledAlready.get(r.cell)!.add(Number(r.pos.replace("pos", "")));
for (const o of recovered.refusals) settledAlready.get(o.cell)!.add(o.pos);
const toDispatch = CELLS.flatMap((c) => c.prompts.map((_, i) => i)
  .filter((i) => !settledAlready.get(c.id)!.has(i)).map((i) => `${c.id}/pos${i}`));

const EXPECTED = toDispatch.length * MEASURED_EACH + toDispatch.length * 2 * 0.005;
const before = await readFalBalance();
if (!before.ok) throw new Error(`cannot read the balance: ${before.why}`);
say(`  ${toDispatch.length} to dispatch · expected $${EXPECTED.toFixed(4)}`
  + ` · fal balance before $${before.remaining.toFixed(4)}`);
say(`  ceiling $${CEILING.toFixed(2)} · already drawn $${DRAWN_ALREADY.toFixed(2)} (arm V2)`
  + ` · room $${(CEILING - DRAWN_ALREADY).toFixed(2)}`);
assertWithinCeiling(DRAWN_ALREADY, EXPECTED, CEILING);
const room = before.remaining - 2 * EXPECTED;
say(`  top-up guard: balance - 2 x expected = $${room.toFixed(4)} against a $12 floor`);
if (room <= 12) throw new Error(`REFUSING: $${room.toFixed(2)} of headroom is inside the top-up's observed window`);
say();

if (DRY) {
  say("--dry-run: every assertion passed and NOTHING was dispatched.");
  writeFileSync(`${OUT}/dryrun.log`, lines.join("\n"), "utf8");
  process.exit(0);
}

/* ── THE RENDERS ── */
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop.js");
const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
const extentOfBox = (mask: Parameters<typeof extentOf>[0]) => extentOf(mask).box;

type Row = FramingFrame & { cell: string; gap: number | null; headTop: number | null };
const rows: Row[] = recovered.rows.map((r) => r as unknown as Row);
const refusals = [...recovered.refusals];
let images = 0;
let reads = 0;
let dispatched = 0;

for (const cell of CELLS) {
  say(`════ ${cell.id} ════`);
  const tiles: Buffer[] = [];
  const raws: Buffer[] = [];
  for (let pos = 0; pos < cell.prompts.length; pos += 1) {
    if (settledAlready.get(cell.id)!.has(pos)) {
      const had = recovered.rows.find((r) => r.cell === cell.id && r.pos === `pos${pos}`);
      const refused = refusals.find((o) => o.cell === cell.id && o.pos === pos);
      if (refused) {
        say(`  pos${pos}  ⚠ REFUSED content_policy · providerRef ${refused.providerRef} · no frame, not retried (recovered)`);
        continue;
      }
      say(had!.line);
      const bp = `${OUT}/${cell.id}-pos${pos}-boxes.png`;
      if (existsSync(bp)) tiles.push(await sharp(readFileSync(bp)).resize({ width: 320, height: 480, fit: "contain", background: "#141414" }).png().toBuffer());
      const rp = `${OUT}/${cell.id}-pos${pos}-raw.png`;
      if (existsSync(rp)) raws.push(await sharp(readFileSync(rp)).resize({ width: 300, height: 450, fit: "contain", background: "#141414" }).png().toBuffer());
      continue;
    }
    let result: Awaited<ReturnType<typeof engine.generateCandidate>>;
    try {
      result = await engine.generateCandidate({
        prompt: cell.prompts[pos]!, size: `${SIZE.width}x${SIZE.height}`, quality: "medium",
      } as never);
      dispatched += 1;
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal === null) throw error;
      dispatched += 1;
      refusals.push({ cell: cell.id, pos, providerRef: refusal.providerRef });
      say(`  pos${pos}  ⚠ REFUSED content_policy · providerRef ${refusal.providerRef} · no frame, not retried (providerQueue.ts:119)`);
      continue;
    }
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
    if (face === null) { say(`  pos${pos}  NO FACE FOUND — the frame is kept, and dropped from the numbers`); continue; }
    const share = face.height / frameH;
    const headroom = face.top / face.height;
    const headTop = head === null ? null : head.top;
    const gap = head === null ? null : (face.top - head.top) / face.height;
    rows.push({
      cell: cell.id, group: cell.group, pos: `pos${pos}`, share, headroom,
      below: (frameH - face.top - face.height) / face.height, gap, headTop,
    } as Row);
    say(`  pos${pos}  ${frameW}x${frameH}  face ${face.width}x${face.height} at ${face.left},${face.top}`
      + `  share ${(share * 100).toFixed(1)}%  headroom ${headroom.toFixed(3)}`
      + (head === null ? "  head ABSENT" : `  head top ${head.top}  gap ${gap!.toFixed(3)}`)
      + (clippedAsDelivered(headTop) ? "  ⚠ HEAD BOX ON THE TOP ROW — open this frame" : ""));
    const boxes = [face, ...(head ? [head] : [])].map((b) => ({ x: b.left, y: b.top, width: b.width, height: b.height }));
    const drawn = await sharp(result.bytes)
      .composite([{ input: Buffer.from(boxOutlineSvg(frameW, frameH, boxes)) }]).png().toBuffer();
    writeFileSync(`${OUT}/${cell.id}-pos${pos}-boxes.png`, drawn);
    tiles.push(await sharp(drawn).resize({ width: 320, height: 480, fit: "contain", background: "#141414" }).png().toBuffer());
    raws.push(await sharp(result.bytes).resize({ width: 300, height: 450, fit: "contain", background: "#141414" }).png().toBuffer());
  }
  if (tiles.length > 0) {
    writeFileSync(`${OUT}/CONTACT-${cell.id}.png`, await sharp({
      create: { width: 320 * tiles.length, height: 480, channels: 3, background: "#141414" },
    }).composite(tiles.map((t, i) => ({ input: t, left: 320 * i, top: 0 }))).png().toBuffer());
  }
  /* HIS STRIP: the RAW row, no boxes — what he actually accepted was a look. */
  if (raws.length > 0) {
    writeFileSync(`${OUT}/STRIP-${cell.id}-raw.png`, await sharp({
      create: { width: 300 * raws.length, height: 450, channels: 3, background: "#141414" },
    }).composite(raws.map((t, i) => ({ input: t, left: 300 * i, top: 0 }))).png().toBuffer());
    say(`  kept ${OUT}/STRIP-${cell.id}-raw.png — the raw row, no boxes, ship size`);
  }
  const here = refusals.filter((o) => o.cell === cell.id);
  say(`  ${here.length} of ${cell.prompts.length} REFUSED by the content checker`
    + (here.length === 0 ? "" : ` — ${here.map((o) => `pos${o.pos}`).join(", ")}`));
  say();
}

/* ── THE READING, AGAINST BARS WRITTEN BEFORE THE RUN ── */
const cellRows = (id: string) => rows.filter((r) => r.cell === id);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const armM = JSON.parse(readFileSync(`${ARM_M}/armM.json`, "utf8")) as {
  rows: Array<{ cell: string; pos: string; share: number; headroom: number; below: number; gap: number | null }>;
};
const armMCell = (id: string) => armM.rows.filter((r) => r.cell === id);

say("THE READING — at the SHIP size, against bars written before the run");
say();
for (const [ship, large] of [["suit-ship", "suit-clause"], ["basics-ship", "basics-clause"]] as const) {
  const a = tMinOf(cellRows(ship));
  /* Arm M's stored rows carry no `group` — it lives on the cell, not the row —
     so the group is SUPPLIED here rather than the type being asserted past.
     A cast would have compiled under the loose tsconfig and failed under
     `pnpm check`'s scripts pass, which is where it did fail. */
  const b = tMinOf(armMCell(large).map((r) => ({ ...r, group: large })));
  say(`  ${ship.padEnd(12)} n=${a.n}  share med ${(a.shareMedian * 100).toFixed(1)}%`
    + `  spread ${(a.shareSpread * 100).toFixed(1)}pt  (bar ${SPREAD_BAR_PT.toFixed(1)})`
    + `  ${a.shareSpread * 100 <= SPREAD_BAR_PT ? "PASS" : "FAIL"}`);
  say(`  ${"".padEnd(12)} at large it was  med ${(b.shareMedian * 100).toFixed(1)}%`
    + `  spread ${(b.shareSpread * 100).toFixed(1)}pt  ·  today's untouched sheets carry 6.6-7.4pt`);
}
say();

const suitMed = median(cellRows("suit-ship").map((r) => r.share)) * 100;
const basicsMed = median(cellRows("basics-ship").map((r) => r.share)) * 100;
const gapPt = Math.abs(suitMed - basicsMed);
say(`  ACROSS-CAST GAP   SUIT ${suitMed.toFixed(1)}%  BASICS ${basicsMed.toFixed(1)}%`
  + `  →  ${gapPt.toFixed(1)}pt  (bar ${GAP_BAR_PT.toFixed(1)})  ${gapPt <= GAP_BAR_PT ? "PASS" : "FAIL"}`);
say(`  at large it was 0.9pt, against a 1.2pt run-to-run floor · today's sheets: 6.2pt`);
say();

const suspect = rows.filter((r) => clippedAsDelivered(r.headTop));
say(`  HAIR AS DELIVERED   ${suspect.length} of ${rows.length} frames have the head box on the top row`
  + `  →  ${suspect.length === 0 ? "PASS" : "⚠ OPEN THESE FRAMES"}`);
for (const one of suspect) say(`    ⚠ ${one.cell}/${one.pos}`);
say("  ⚠ a head box on the top row is a SUSPICION and a pointer to look, never the");
say("     verdict — the bar is *no clipped hair*, and that is judged at the frames (law 9)");
say();

const spreadPass = [cellRows("suit-ship"), cellRows("basics-ship")]
  .every((set) => tMinOf(set).shareSpread * 100 <= SPREAD_BAR_PT);
const verdict = spreadPass && gapPt <= GAP_BAR_PT && suspect.length === 0;
say(`VERDICT (numbers only — his eye rules the strips)  ${verdict ? "PASS" : "FAIL"}`);
say(`  spread ${spreadPass ? "PASS" : "FAIL"} · gap ${gapPt <= GAP_BAR_PT ? "PASS" : "FAIL"}`
  + ` · hair ${suspect.length === 0 ? "PASS" : "SUSPECT"}`);
say();
const identity = identityHolds(rows);
say(`identity  below = 1/share - headroom - 1  holds on ${identity.held}/${identity.of} frames`);
say();

/* ── THE PRICE, AT A SETTLED LEDGER ── */
async function settled(from: number): Promise<number> {
  let last = from; let stable = 0; let now = from;
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
let settledAfter = after.remaining;
if (dispatched === 0) say("nothing was dispatched, so there is no ledger move to wait for");
else {
  say("waiting for the ledger to settle — two consecutive equal reads after a move");
  settledAfter = await settled(after.remaining);
}
const spent = before.remaining - settledAfter;
say(`fal spent $${spent.toFixed(4)} for ${images} images and ${reads} reads at the ship size`);
say(`THIS COURT CUMULATIVE $${(DRAWN_ALREADY + spent).toFixed(4)} against its $${CEILING.toFixed(2)} ceiling`
  + `  ${DRAWN_ALREADY + spent > CEILING ? "⚠ OVER — STOP AND REPORT" : "— clear"}`);
if (images > 0) {
  say(`  reads at $0.005 -> $${(reads * 0.005).toFixed(4)}; images therefore `
    + `$${((spent - reads * 0.005) / images).toFixed(4)} each — the FIRST settled reading of this size alone`);
}

writeFileSync(`${OUT}/shipsize.log`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/shipsize.json`, JSON.stringify({
  size: SIZE, rows, refusals, images, dispatched, reads,
  bars: { spreadBarPt: SPREAD_BAR_PT, gapBarPt: GAP_BAR_PT },
  suitMed, basicsMed, gapPt, spreadPass, suspect: suspect.map((s) => `${s.cell}/${s.pos}`), verdict,
  balanceBefore: before.remaining, balanceSettledAfter: settledAfter, spent,
}, null, 2), "utf8");
say();
say(`kept: ${OUT}/shipsize.log, shipsize.json, ${rows.length} measured frames, 2 raw strips`);

process.exit(0);
