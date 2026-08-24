/**
 * ARM V2 OF THE FRAMING BUILD — does asking for room ABOVE THE HEAD open the
 * feasible interval for a common `R`?
 * (Ordered fable-1563 §1 on opus-1204 §4(a). The court proper is CLOSED at
 * $4.09; this is the BUILD's own prerequisite and is fenced on its own line.)
 *
 * # The question, and why it is the build's blocker rather than a refinement
 *
 * A common headroom `R` has to satisfy TWO inequalities on every frame:
 *
 *   R <= headroom     or the crop starts above the frame's own top edge
 *   R >= head gap     or the top of her hair is inside the crop line
 *
 * so the feasible set is `[max gap, min headroom]`. On arm M's clause cells it
 * is **EMPTY** — `basics-clause` wants `R >= 0.508` and `suit-clause` cannot give
 * more than `0.352`. Condition 1 of the closed court (take `R` from the widest
 * head gap as well as the tightest headroom) is therefore NECESSARY and, on the
 * evidence in hand, UNSATISFIABLE. Dropping the single worst frame does not fix
 * it: 0.359 against 0.352, still empty by 0.007.
 *
 * ⚠ **AND MORE MARGIN MAKES IT WORSE, WHICH IS THE PART THAT MAKES THIS A COURT
 * RATHER THAN A PATCH.** Both quantities are divided by face height, so a looser
 * frame — a SMALLER face — inflates the hair gap while headroom follows only if
 * the engine chooses to put the head higher. Measured paired, same seeds, the v1
 * clause the only variable: mean headroom −0.069 (BASICS) and −0.054 (SUIT),
 * mean gap +0.037 and −0.017, and `basics-control` went from FEASIBLE
 * [0.328, 0.433] to EMPTY [0.508, 0.447] under the clause. **Margin bought in the
 * frame is spent on the hair measurement.**
 *
 * # The hypothesis, which is one word of the clause's own wording
 *
 * v1 says *"a little extra room below and at the sides is correct"* — **BELOW and
 * at the SIDES, never ABOVE.** It buys margin in the two directions that cannot
 * help the one constraint that is failing, and the failing one is about hair,
 * which is what `FRAMING_FIXED` asks for in its own words.
 *
 *   v1  ...include MORE of the body rather than less — a little extra room below
 *       and at the sides is correct.
 *   v2  ...include MORE of the body rather than less — a little extra room below
 *       and at the sides is correct, and always leave clear space above the top
 *       of the hair.
 *
 * ⚠ **v2 is v1 PLUS a clause, and this campaign has a scar exactly there**:
 * ROUND2's specimen was an ADDED framing sentence that doubled its own
 * population's spread, and *context is not additive* is a written lesson here. So
 * the perturbation evidence is read on this run too, and a v2 that opens the
 * interval by wrecking the spread is not a win. It is an addition rather than a
 * swap because the thing being tested IS the added permission; there is no way to
 * ask this question by substitution.
 *
 * # The bar, pre-registered BEFORE the run (opus-1204 §4(a), ruled fable-1563)
 *
 *   FEASIBLE   [max gap, min headroom] is NON-EMPTY on suit-v2, on basics-v2,
 *              AND across the two together. This is the whole point; a cell that
 *              opens alone and closes across buys nothing, because across-cast is
 *              the thing the founder asked for.
 *   MARGIN     `T_min` across both v2 cells stays inside PASS (<= 26.0%) — the
 *              revision must not spend the court's own result to buy the
 *              interval.
 *   SPREAD     within-sheet share spread is REPORTED against v1's, against the
 *              0.2pt replicate floor arm M measured. Not a pass/fail here: the
 *              floor was measured on SUIT at one size and this is a different
 *              comparison, so it is evidence and it is named as evidence.
 *   WHERE      ⚠ the guard fable-1563 §1 added: gap AND headroom are read on
 *              every frame and printed paired against v1, so if the ABOVE
 *              permission spends its room somewhere unexpected, the run SAYS
 *              WHERE rather than leaving a null to be interpreted.
 *
 * # What it spends
 *
 *   16 images at 1536x2304        ~$1.24 at arm M's measured $0.0777
 *   32 reads (face + head)        ~$0.16
 *   0 interpreter compiles        — the prompts are arm M's own, read back
 *   ---------------------------------------------------------------
 *   ~$1.40 against a $2.00 ceiling   ·   NO CREDITS, NO ROWS
 *
 * The prompts are READ BACK from arm M's `prompts.json` rather than recompiled,
 * for the reason that has now bitten this court twice: the interpreter is a
 * language model, so a second compile is a different sheet, and "same seeds, same
 * people" is only true if the prompts are the same bytes.
 *
 *   npx tsx scripts/_framing-armv2-disposable.mts --prove-guard
 *   npx tsx scripts/_framing-armv2-disposable.mts --dry-run
 *   npx tsx scripts/_framing-armv2-disposable.mts
 *   npx tsx scripts/_framing-armv2-disposable.mts --resume
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

const OUT = "output/framing-court/armV2";
const ARM_M = "output/framing-court/armM";
const RESUME_LOGS = ["output/_armV2-run.log"];
const SIZE = { width: 1536, height: 2304 };

/* ── THE TWO CLAUSES. v2 is v1 plus one permission, and nothing else. ── */
const V1 = "Frame from the hips up in a 2:3 portrait. If in doubt include MORE of the body "
  + "rather than less — a little extra room below and at the sides is correct.";
const V2 = "Frame from the hips up in a 2:3 portrait. If in doubt include MORE of the body "
  + "rather than less — a little extra room below and at the sides is correct, and always "
  + "leave clear space above the top of the hair.";

const TMIN_PASS = 26.0;
/** Arm M's measured price at this size, over the 13 that delivered. */
const MEASURED_EACH = 0.0777;
const CEILING = 2.00;
const SPENT_SO_FAR = 0.00;   /* this court's own line; the $5.00 court is closed */

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

/**
 * ⚠ THE SINGLE-VARIABLE ASSERTION. Two prompt lists differ by the clause and by
 * NOTHING ELSE, checked on the outgoing text rather than on the constants beside
 * it. Same shape as arm M's, aimed at a different pair of sentences.
 */
function assertClauseIsTheOnlyDifference(v1: readonly string[], v2: readonly string[]): void {
  if (v1.length !== v2.length) {
    throw new Error(`the two cells hold ${v1.length} and ${v2.length} prompts — not a pair`);
  }
  const wrong: string[] = [];
  for (let i = 0; i < v1.length; i += 1) {
    const before = v1[i]!;
    const after = v2[i]!;
    if (!before.includes(V1)) { wrong.push(`${i}: the v1 prompt does not carry the v1 clause`); continue; }
    if (!after.includes(V2)) { wrong.push(`${i}: the v2 prompt does not carry the v2 clause`); continue; }
    if (before.replace(V1, V2) !== after) {
      wrong.push(`${i}: the two prompts differ somewhere OTHER than the clause`);
    }
  }
  if (wrong.length > 0) {
    throw new Error("the clause is not the only variable — buying nothing:\n  " + wrong.join("\n  "));
  }
}

/** The court's own ceiling, in a function so it can be DRIVEN. */
function assertWithinCeiling(spentSoFar: number, expected: number, ceiling: number): void {
  if (spentSoFar + expected > ceiling) {
    throw new Error("REFUSING: this run's upper price would take this court to "
      + `$${(spentSoFar + expected).toFixed(2)} past its $${ceiling.toFixed(2)} ceiling `
      + "(fable-1563 §1) — stop and report");
  }
}

/**
 * ⚠ THE MEASURE THIS COURT EXISTS FOR, and the only copy of it.
 *
 * `[max gap, min headroom]` — the set of common headrooms that both CLEAR every
 * head and FIT inside every frame. Empty is the finding, not an error, so it
 * returns rather than throws and the caller prints which frame set each edge.
 */
type Feasible = {
  n: number; lo: number; hi: number; empty: boolean;
  loAt: string; hiAt: string; width: number;
};
function feasibleR(rows: ReadonlyArray<{ pos: string; headroom: number; gap: number | null }>): Feasible {
  const withGap = rows.filter((r): r is typeof r & { gap: number } => r.gap !== null);
  if (withGap.length === 0) throw new Error("no frame answered `head` — the feasible interval is undefined, not empty");
  const lo = Math.max(...withGap.map((r) => r.gap));
  const hi = Math.min(...rows.map((r) => r.headroom));
  return {
    n: rows.length, lo, hi, empty: lo > hi, width: hi - lo,
    loAt: withGap.find((r) => r.gap === lo)!.pos,
    hiAt: rows.find((r) => r.headroom === hi)!.pos,
  };
}

/** A provider refusal of the prompt is tolerated; every other failure is not. */
function refusalOf(error: unknown): { providerRef: string } | null {
  const provider = error as { failureClass?: unknown; providerRef?: unknown };
  if (provider?.failureClass !== "content_policy") return null;
  return { providerRef: typeof provider.providerRef === "string" ? provider.providerRef : "unnamed" };
}

const NEWLINE_RE = new RegExp("\\r?\\n");
const LOG_CELL = /^════ (\S+) ════$/;
const LOG_ROW = new RegExp(
  "^ {2}pos(\\d+) {2}(\\d+)x(\\d+) {2}face (\\d+)x(\\d+) at (\\d+),(\\d+)"
  + " {2}share ([\\d.]+)% {2}headroom ([\\d.]+)(?: {2}head top (\\d+) {2}gap (-?[\\d.]+)| {2}head ABSENT)"
  + "(?: · recovered)?$",
);
const LOG_REFUSAL = /^ {2}pos(\d+) {2}⚠ REFUSED content_policy · providerRef (\S+)/;

type Recovered = {
  rows: Array<{ cell: string; group: string; pos: string; share: number; headroom: number; below: number; gap: number | null; line: string }>;
  refusals: Array<{ cell: string; pos: number; providerRef: string }>;
  disagreements: string[];
};

/**
 * Recovery from a dead run's log — the anti-transcription shape arm M bought:
 * every derived field RECOMPUTED from the printed box, the log's own printed
 * figure asserted against the recomputation, the raw frame required on disk, and
 * the line kept verbatim so a recovered row can be re-said with its box intact
 * (a short summary line silently costs downstream consumers the face box).
 */
function recoverFromLog(
  text: string,
  groupOf: (cell: string) => string | undefined,
  frameOnDisk: (cell: string, pos: number) => boolean,
  into: Recovered = { rows: [], refusals: [], disagreements: [] },
): Recovered {
  const byPos = new Map(into.rows.map((row) => [`${row.cell}/${row.pos}`, row]));
  const refusedBy = new Map(into.refusals.map((one) => [`${one.cell}/pos${one.pos}`, one]));
  const disagreements = into.disagreements;
  let cell: string | null = null;
  for (const line of text.split(NEWLINE_RE)) {
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
    const [, posText, , frameHText, , faceHText, , faceTopText, shareText, headroomText, headTopText, gapText] = row;
    const pos = Number(posText);
    const frameH = Number(frameHText);
    const faceH = Number(faceHText);
    const faceTop = Number(faceTopText);
    if (!frameOnDisk(cell, pos)) {
      disagreements.push(`${cell}/pos${pos}: the log has a row and the raw frame is NOT on disk`);
      continue;
    }
    const share = faceH / frameH;
    const headroom = faceTop / faceH;
    const gap = headTopText === undefined ? null : (faceTop - Number(headTopText)) / faceH;
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
      below: (frameH - faceTop - faceH) / faceH, gap,
      line: `${line.replace(/ · recovered$/, "")} · recovered`,
    });
  }
  for (const key of byPos.keys()) refusedBy.delete(key);
  return { rows: [...byPos.values()], refusals: [...refusedBy.values()], disagreements };
}

function assertRecoveryAgrees(recovered: Recovered): void {
  if (recovered.disagreements.length > 0) {
    throw new Error("REFUSING to resume — the recovered rows do not survive their own recomputation:\n  "
      + recovered.disagreements.join("\n  "));
  }
}

/*
  ⚠ THE POSITIVE CONTROL, before the network. A run that passes its assertions is
  a negative arm and cannot find an assertion that never refuses.
*/
if (PROVE) {
  const base = `blah ${V1} blah wearing a suit. tail`;
  const swap = (t: string) => t.replace(V1, V2);
  const arms: Array<{ what: string; run: () => void; expect: RegExp }> = [
    { what: "the v2 permission never got added", expect: /does not carry the v2 clause/,
      run: () => assertClauseIsTheOnlyDifference([base, base], [base, base]) },
    { what: "the v1 cell was handed the v2 clause", expect: /does not carry the v1 clause/,
      run: () => assertClauseIsTheOnlyDifference([swap(base), swap(base)], [swap(base), swap(base)]) },
    { what: "something ELSE moved beside the clause", expect: /differ somewhere OTHER than the clause/,
      run: () => assertClauseIsTheOnlyDifference([base, base], [swap(base), `${swap(base)} and a hat`]) },
    { what: "the two cells are different lengths", expect: /not a pair/,
      run: () => assertClauseIsTheOnlyDifference([base], [swap(base), swap(base)]) },
    { what: "the run would take this court one cent past its ceiling", expect: /\$2\.01 past its \$2\.00 ceiling/,
      run: () => assertWithinCeiling(0, 2.01, 2.00) },
    { what: "a recovered row's printed figure disagrees with its own box", expect: /share recomputes to 20\.0 and the log printed 19\.2/,
      run: () => assertRecoveryAgrees(recoverFromLog(
        `════ suit-v2 ════\n  pos0  1536x2304  face 396x461 at 578,203  share 19.2%  headroom 0.440  head top 105  gap 0.213\n`,
        () => "SUIT", () => true)) },
    { what: "a recovered row whose RAW FRAME is not on disk", expect: /raw frame is NOT on disk/,
      run: () => assertRecoveryAgrees(recoverFromLog(
        `════ suit-v2 ════\n  pos0  1536x2304  face 396x442 at 578,203  share 19.2%  headroom 0.459  head top 105  gap 0.222\n`,
        () => "SUIT", () => false)) },
    { what: "the feasible interval is asked of frames with NO head read at all", expect: /undefined, not empty/,
      run: () => { feasibleR([{ pos: "pos0", headroom: 0.5, gap: null }]); } },
  ];
  console.log("--prove-guard: arm V2's assertions, driven to REFUSE. No network call.");
  for (const arm of arms) {
    let threw: string | null = null;
    try { arm.run(); } catch (error) { threw = (error as Error).message; }
    if (threw === null) throw new Error(`THE GUARD DID NOT REFUSE: ${arm.what}`);
    if (!arm.expect.test(threw)) throw new Error(`refused for the WRONG REASON on "${arm.what}":\n  ${threw}`);
    console.log(`  REFUSED, and named it — ${arm.what}`);
    console.log(`    ${threw.split("\n").join(" / ")}`);
  }
  assertClauseIsTheOnlyDifference([base, base], [swap(base), swap(base)]);
  assertWithinCeiling(0, 2.00, 2.00);   /* exactly AT the ceiling must pass */

  /*
    ⚠ AND THE MEASURE ITSELF GETS A YES CASE AND A NO CASE. `feasibleR` is the
    thing this whole court turns on; an instrument that can only say one of its
    two answers has never been shown to say the other. The EMPTY fixture is arm
    M's own basics-clause figures, so the arm is anchored on a real reading.
  */
  const yesNo: Array<[string, boolean]> = [
    ["a FEASIBLE set reads feasible", !feasibleR([
      { pos: "pos0", headroom: 0.433, gap: 0.328 }, { pos: "pos1", headroom: 0.500, gap: 0.200 },
    ]).empty],
    ["arm M's real basics-clause edges read EMPTY", feasibleR([
      { pos: "pos6", headroom: 0.766, gap: 0.508 }, { pos: "pos7", headroom: 0.447, gap: 0.359 },
    ]).empty],
    ["the edges name the frames that SET them", (() => {
      const f = feasibleR([{ pos: "pos6", headroom: 0.766, gap: 0.508 }, { pos: "pos7", headroom: 0.447, gap: 0.359 }]);
      return f.loAt === "pos6" && f.hiAt === "pos7";
    })()],
    ["a `content_policy` failure is TOLERATED", refusalOf({ failureClass: "content_policy" }) !== null],
    ["every OTHER class still kills the run", refusalOf({ failureClass: "rate_limit" }) === null],
  ];
  for (const [what, held] of yesNo) {
    if (!held) throw new Error(`THE DECISION WENT THE WRONG WAY: ${what}`);
    console.log(`  held — ${what}`);
  }
  console.log(`  and every one passes the well-formed case — ${arms.length} refusals, 2 acceptances`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

say(`ARM V2 — does asking for room ABOVE THE HEAD open the feasible interval?`);
say(`  v1  ...${V1.slice(V1.indexOf("— a little"))}`);
say(`  v2  ...${V2.slice(V2.indexOf("— a little"))}`);
say();

/* ── THE PROMPTS: arm M's own v1 clause prompts, with ONE clause swapped ── */
const stored = JSON.parse(readFileSync(`${ARM_M}/prompts.json`, "utf8")) as {
  clause: { from: string; to: string }; suitClause: string[]; basicsClause: string[];
};
if (stored.clause?.to !== V1) {
  throw new Error("arm M's stored prompts were not built against the v1 clause this run pairs against");
}
const suitV1 = stored.suitClause;
const basicsV1 = stored.basicsClause;
const suitV2 = suitV1.map((p) => p.replace(V1, V2));
const basicsV2 = basicsV1.map((p) => p.replace(V1, V2));
assertClauseIsTheOnlyDifference(suitV1, suitV2);
assertClauseIsTheOnlyDifference(basicsV1, basicsV2);
say(`  SUIT   ${suitV2.length} prompts · BASICS ${basicsV2.length} prompts`
  + " · read back from arm M, clause swapped, single-variable PROVEN");
say("  no interpreter compile: a second compile is a different sheet");
say();

const CELLS = [
  { id: "suit-v2", group: "SUIT", prompts: suitV2 },
  { id: "basics-v2", group: "BASICS", prompts: basicsV2 },
] as const;

const groupOfCell = (id: string) => CELLS.find((c) => c.id === id)?.group;
const frameOnDisk = (cell: string, pos: number) => existsSync(`${OUT}/${cell}-pos${pos}-raw.png`);
let recovered: Recovered = { rows: [], refusals: [], disagreements: [] };
const logsRead: string[] = [];
if (RESUME) {
  for (const log of RESUME_LOGS) {
    if (!existsSync(log)) continue;
    logsRead.push(log);
    recovered = recoverFromLog(readFileSync(log, "utf8"), groupOfCell, frameOnDisk, recovered);
  }
  if (recovered.rows.length === 0 && recovered.refusals.length === 0) {
    throw new Error(`REFUSING: --resume read ${logsRead.length} log(s) and recovered NOTHING`
      + " — a broken parse, not an empty court, and continuing would re-buy every frame on disk");
  }
}
assertRecoveryAgrees(recovered);

const settledAlready = new Map<string, Set<number>>();
for (const cell of CELLS) settledAlready.set(cell.id, new Set());
for (const row of recovered.rows) settledAlready.get(row.cell)!.add(Number(row.pos.replace("pos", "")));
for (const one of recovered.refusals) settledAlready.get(one.cell)!.add(one.pos);
const toDispatch = CELLS.flatMap((c) => c.prompts.map((_, i) => i)
  .filter((i) => !settledAlready.get(c.id)!.has(i)).map((i) => `${c.id}/pos${i}`));
if (RESUME) {
  say(`  RESUME  recovered ${recovered.rows.length} rows and ${recovered.refusals.length} refusals`
    + ` from ${logsRead.join(" + ")}, every one recomputed from its own box`);
}

const EXPECTED = toDispatch.length * MEASURED_EACH + toDispatch.length * 2 * 0.005;
const before = await readFalBalance();
if (!before.ok) throw new Error(`cannot read the balance: ${before.why}`);
say(`  ${toDispatch.length} to dispatch · expected $${EXPECTED.toFixed(4)}`
  + ` · fal balance before $${before.remaining.toFixed(4)}`);
say(`  against this court's own $${CEILING.toFixed(2)} ceiling (the $5.00 court is CLOSED at $4.09)`);
assertWithinCeiling(SPENT_SO_FAR, EXPECTED, CEILING);
const room = before.remaining - 2 * EXPECTED;
say(`  top-up guard: balance - 2 x expected = $${room.toFixed(4)} against a $12 floor`);
if (room <= 12) throw new Error(`REFUSING: $${room.toFixed(2)} of headroom is inside the top-up's observed window`);
say();

writeFileSync(`${OUT}/prompts.json`, JSON.stringify({
  clause: { v1: V1, v2: V2 }, suitV1, suitV2, basicsV1, basicsV2,
}, null, 2), "utf8");

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

type Row = FramingFrame & { cell: string; gap: number | null };
const rows: Row[] = recovered.rows.map((r) => r as unknown as Row);
const refusals = [...recovered.refusals];
let images = 0;
let reads = 0;
let dispatched = 0;

for (const cell of CELLS) {
  say(`════ ${cell.id} ════`);
  const tiles: Buffer[] = [];
  for (let pos = 0; pos < cell.prompts.length; pos += 1) {
    if (settledAlready.get(cell.id)!.has(pos)) {
      const had = recovered.rows.find((r) => r.cell === cell.id && r.pos === `pos${pos}`);
      const refused = refusals.find((o) => o.cell === cell.id && o.pos === pos);
      if (refused) {
        say(`  pos${pos}  ⚠ REFUSED content_policy · providerRef ${refused.providerRef} · no frame, not retried (recovered)`);
        continue;
      }
      say(had!.line);
      const boxesPath = `${OUT}/${cell.id}-pos${pos}-boxes.png`;
      if (existsSync(boxesPath)) {
        tiles.push(await sharp(readFileSync(boxesPath))
          .resize({ width: 320, height: 480, fit: "contain", background: "#141414" }).png().toBuffer());
      }
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
    const gap = head === null ? null : (face.top - head.top) / face.height;
    rows.push({
      cell: cell.id, group: cell.group, pos: `pos${pos}`, share, headroom,
      below: (frameH - face.top - face.height) / face.height, gap,
    } as Row);
    say(`  pos${pos}  ${frameW}x${frameH}  face ${face.width}x${face.height} at ${face.left},${face.top}`
      + `  share ${(share * 100).toFixed(1)}%  headroom ${headroom.toFixed(3)}`
      + (head === null ? "  head ABSENT" : `  head top ${head.top}  gap ${gap!.toFixed(3)}`));
    const boxes = [face, ...(head ? [head] : [])].map((b) => ({ x: b.left, y: b.top, width: b.width, height: b.height }));
    const drawn = await sharp(result.bytes)
      .composite([{ input: Buffer.from(boxOutlineSvg(frameW, frameH, boxes)) }]).png().toBuffer();
    writeFileSync(`${OUT}/${cell.id}-pos${pos}-boxes.png`, drawn);
    tiles.push(await sharp(drawn).resize({ width: 320, height: 480, fit: "contain", background: "#141414" }).png().toBuffer());
  }
  if (tiles.length > 0) {
    writeFileSync(`${OUT}/CONTACT-${cell.id}.png`, await sharp({
      create: { width: 320 * tiles.length, height: 480, channels: 3, background: "#141414" },
    }).composite(tiles.map((t, i) => ({ input: t, left: 320 * i, top: 0 }))).png().toBuffer());
    say(`  kept ${OUT}/CONTACT-${cell.id}.png`);
  }
  const here = refusals.filter((o) => o.cell === cell.id);
  say(`  ${here.length} of ${cell.prompts.length} REFUSED by the content checker`
    + (here.length === 0 ? "" : ` — ${here.map((o) => `pos${o.pos}`).join(", ")}`));
  say();
}

/* ── THE READING, AGAINST A BAR WRITTEN BEFORE THE RUN ── */
const armM = JSON.parse(readFileSync(`${ARM_M}/armM.json`, "utf8")) as {
  rows: Array<{ cell: string; pos: string; share: number; headroom: number; below: number; gap: number | null }>;
};
const v1Rows = (cell: string) => armM.rows.filter((r) => r.cell === cell);
const v2Rows = (cell: string) => rows.filter((r) => r.cell === cell);

say("THE FEASIBLE INTERVAL — the bar this court was bought for");
say("  R must be >= every head gap (or the hair is cut) and <= every headroom");
say("  (or the crop starts above the frame's own top edge)");
say();
const report = (label: string, set: ReadonlyArray<{ pos: string; headroom: number; gap: number | null }>) => {
  const f = feasibleR(set);
  say(`  ${label.padEnd(22)} n=${f.n}  R >= ${f.lo.toFixed(3)} (${f.loAt} hair)`
    + `  and <= ${f.hi.toFixed(3)} (${f.hiAt} top edge)`
    + `   →  ${f.empty ? "⚠ EMPTY" : `FEASIBLE, width ${f.width.toFixed(3)}`}`);
  return f;
};
const v1Suit = report("v1 suit-clause", v1Rows("suit-clause"));
const v1Basics = report("v1 basics-clause", v1Rows("basics-clause"));
const v1Across = report("v1 ACROSS", [...v1Rows("suit-clause"), ...v1Rows("basics-clause")]);
say();
const v2Suit = report("v2 suit-v2", v2Rows("suit-v2"));
const v2Basics = report("v2 basics-v2", v2Rows("basics-v2"));
const v2Across = report("v2 ACROSS", [...v2Rows("suit-v2"), ...v2Rows("basics-v2")]);
say();

const feasiblePass = !v2Suit.empty && !v2Basics.empty && !v2Across.empty;
say(`FEASIBLE BAR   non-empty on BOTH cells AND across  →  ${feasiblePass ? "PASS" : "FAIL"}`);
say(`  v1 was ${[v1Suit, v1Basics, v1Across].map((f) => (f.empty ? "EMPTY" : "feasible")).join(" / ")}`
  + ` · v2 is ${[v2Suit, v2Basics, v2Across].map((f) => (f.empty ? "EMPTY" : "feasible")).join(" / ")}`);
say("  ⚠ a cell that opens ALONE and closes ACROSS buys nothing — across-cast is what he asked for");
say();

const across = tMinOf([...v2Rows("suit-v2"), ...v2Rows("basics-v2")]);
const tMinPct = across.tMin * 100;
say(`MARGIN BAR     T_min across both v2 cells = ${tMinPct.toFixed(1)}%  →  `
  + `${tMinPct <= TMIN_PASS ? "PASS" : "FAIL"} (must stay <= ${TMIN_PASS.toFixed(1)})`);
say(`  arm M's v1 figure was 22.7%; the revision must not spend the court's result to buy the interval`);
say();

say("WHERE THE ROOM WENT — paired per position, v1 → v2, the guard fable-1563 §1 added");
for (const [v1Cell, v2Cell] of [["suit-clause", "suit-v2"], ["basics-clause", "basics-v2"]] as const) {
  say(`  ${v1Cell} → ${v2Cell}`);
  const dh: number[] = []; const dg: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = v1Rows(v1Cell).find((r) => r.pos === `pos${i}`);
    const b = v2Rows(v2Cell).find((r) => r.pos === `pos${i}`);
    if (!a || !b || a.gap === null || b.gap === null) { say(`    pos${i}  — one side absent, dropped from the pairing`); continue; }
    dh.push(b.headroom - a.headroom); dg.push(b.gap - a.gap);
    say(`    pos${i}  headroom ${a.headroom.toFixed(3)} → ${b.headroom.toFixed(3)}`
      + `  ${b.headroom - a.headroom >= 0 ? "+" : ""}${(b.headroom - a.headroom).toFixed(3)}`
      + `   ·  gap ${a.gap.toFixed(3)} → ${b.gap.toFixed(3)}`
      + `  ${b.gap - a.gap >= 0 ? "+" : ""}${(b.gap - a.gap).toFixed(3)}`
      + `   ·  share ${(a.share * 100).toFixed(1)}% → ${(b.share * 100).toFixed(1)}%`);
  }
  const mean = (xs: number[]) => (xs.length === 0 ? NaN : xs.reduce((s, x) => s + x, 0) / xs.length);
  say(`    n=${dh.length}  mean headroom ${mean(dh) >= 0 ? "+" : ""}${mean(dh).toFixed(3)}`
    + `  ·  mean gap ${mean(dg) >= 0 ? "+" : ""}${mean(dg).toFixed(3)}`
    + `  — the interval opens only if headroom rises FASTER than the gap`);
}
say();

say("SPREAD — reported, not a bar (the 0.2pt floor was measured on SUIT at one size)");
for (const [v1Cell, v2Cell] of [["suit-clause", "suit-v2"], ["basics-clause", "basics-v2"]] as const) {
  /* Arm M's stored rows carry no `group` — it lives on the cell, not the row —
     so the group is SUPPLIED here rather than the type being asserted past. */
  const a = tMinOf(v1Rows(v1Cell).map((r) => ({ ...r, group: v1Cell })));
  const b = tMinOf(v2Rows(v2Cell));
  say(`  ${v2Cell.padEnd(12)} v1 ${(a.shareSpread * 100).toFixed(1)}pt → v2 ${(b.shareSpread * 100).toFixed(1)}pt`
    + `  (${b.shareSpread >= a.shareSpread ? "+" : ""}${((b.shareSpread - a.shareSpread) * 100).toFixed(1)}pt)`
    + `  · n ${a.n}/${b.n}`);
}
say("  ⚠ v2 is v1 PLUS a clause, and ROUND2's added framing sentence doubled its own");
say("     population's spread — a v2 that opens the interval by wrecking the picture is not a win");
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
if (dispatched === 0) { say("nothing was dispatched, so there is no ledger move to wait for"); }
else {
  say("waiting for the ledger to settle — two consecutive equal reads after a move");
  settledAfter = await settled(after.remaining);
}
const spent = before.remaining - settledAfter;
say(`fal spent $${spent.toFixed(4)} for ${images} images and ${reads} reads`);
say(`THIS COURT CUMULATIVE $${(SPENT_SO_FAR + spent).toFixed(4)} against its $${CEILING.toFixed(2)} ceiling`
  + `  ${SPENT_SO_FAR + spent > CEILING ? "⚠ OVER — STOP AND REPORT" : "— clear"}`);

writeFileSync(`${OUT}/armV2.log`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/armV2.json`, JSON.stringify({
  clause: { v1: V1, v2: V2 }, rows, refusals, images, dispatched, reads,
  feasible: { v1: { suit: v1Suit, basics: v1Basics, across: v1Across },
    v2: { suit: v2Suit, basics: v2Basics, across: v2Across } },
  feasiblePass, tMinAcrossPct: tMinPct,
  balanceBefore: before.remaining, balanceSettledAfter: settledAfter, spent,
}, null, 2), "utf8");
say();
say(`kept: ${OUT}/armV2.log, armV2.json, ${rows.length} measured frames, ${refusals.length} refused`);

process.exit(0);
