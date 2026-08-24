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
 * # ⚠ THE FIRST RUN DIED, AND WHAT IT DIED OF HAD A PUBLISHED BASE RATE
 *
 * `basics-control/pos2` came back 422 `content_policy` — the provider refusing
 * the PROMPT — and the throw killed a run with both SUIT cells already paid for.
 * That refusal is not a surprise: `server/castingV2/wardrobeLine.ts`, the file
 * this harness copies `BASICS_LINE` out of, carries the measurement directly
 * above its return statement — *about one slice in four, 6 refused of 24, every
 * one `content_policy`* — a cost the founder was shown and accepted, with *do
 * not "fix" this by raising the neckline* beside it. At 25%, sixteen BASICS
 * slices arrive intact with probability 0.75^16 = **1.0%**.
 *
 * So the version of this harness that ran had a 99% chance of dying, and the
 * tolerance it DID carry was for a frame the reader finds no face on — a failure
 * with no measured rate at all. **Guard the failure you have measured, not the
 * failure you imagined.** Three repairs followed (opus-1199, ruled fable-1558):
 *
 *   TOLERANCE  a `content_policy` refusal is FILED with its `providerRef` and the
 *              cell continues; every other class still kills the run. Not
 *              retried — `providerQueue.ts:119` — so a refusal is one throw and
 *              no repeat spend.
 *   SYMMETRIC  a position refused in EITHER half of a population leaves BOTH
 *   DROP       halves' PAIRED numbers, and the paired n prints beside the bar.
 *              The perturbation bar compares `max − min` between two cells and
 *              the expected value of a RANGE grows with n, so an unequal-n
 *              comparison reads sample size as a clause effect. `T_min` is read
 *              the other way — AS DELIVERED, because a refused slice is a frame
 *              the customer never receives — with its own n-bias named and a
 *              matched-n sensitivity band printed beside it, and a pre-registered
 *              NULL below n=6.
 *   RESUME     `--resume` recovers every position the dead run's log records,
 *              dispatches only what is missing, and prices only what it
 *              dispatches. The recovery is NOT a transcription: every derived
 *              field is recomputed from the printed BOX and the log's own printed
 *              figure is asserted against it, the raw frame must be on disk, and
 *              `identityHolds` checks `below` independently further down. A
 *              resumed run reads the STORED prompts rather than recompiling —
 *              the same requirement as the SUIT reuse above, arriving through a
 *              different door: a second compile is a different sheet.
 *
 *   npx tsx scripts/_framing-armm-disposable.mts --size small
 *   npx tsx scripts/_framing-armm-disposable.mts --size large
 *   npx tsx scripts/_framing-armm-disposable.mts --size large --resume
 *   npx tsx scripts/_framing-armm-disposable.mts --size small --prove-guard
 *   npx tsx scripts/_framing-armm-disposable.mts --size large --resume --dry-run
 */

import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
/**
 * ⚠ RESUME — the first run died at `basics-control/pos2` with both SUIT cells
 * already paid for (opus-1199, ruled fable-1558 §1(f)). With this flag the run
 * recovers every position the dead run's log records, dispatches only what is
 * missing, and prices only what it dispatches.
 */
const RESUME = process.argv.includes("--resume");
/**
 * ⚠ EVERY LOG THIS COURT HAS WRITTEN, IN ORDER — not just the last one. The dead
 * run's log holds the 18 frames it bought; the resumed run's holds the rest. A
 * resume that read only the most recent log would re-buy the frames the first one
 * paid for, which is the whole thing this flag exists to prevent.
 */
const RESUME_LOGS = ["output/_armM-run-dead.log", "output/_armM-run.log", "output/_armM-resume.log"];

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

/* ────────────────────────────────────────────────────────────────────────────
   ⚠ THE FAILURE THIS HARNESS HAD NO ARM FOR — AND THE ONLY ONE IN THIS
   POPULATION WITH A PUBLISHED BASE RATE (added opus-1199, after the first run
   died on it at `basics-control/pos2`).

   The provider refused the PROMPT: 422, `content_policy`, naming `body.prompt`.
   That is not the provider misbehaving and it is not a surprise —
   `server/castingV2/wardrobeLine.ts`, the file this harness copies `BASICS_LINE`
   out of, carries the measurement DIRECTLY ABOVE its return statement: *"about
   one slice in four … 6 refused of 24 slices … every one `content_policy`"*
   (opus-1121), a cost the founder was shown and accepted (fable-1465), with
   `do not "fix" this by raising the neckline` written beside it.

   At 25%, sixteen BASICS slices arrive intact with probability 0.75^16 = 1.0%.
   **So the run had a 99% chance of dying**, and what the harness DID have a
   tolerance for was a frame the READER finds no face on — a failure with no
   measured rate at all. Guard the failure you have measured, not the failure you
   imagined.

   Three things follow and only the first is about not crashing.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * (1) A provider refusal of the prompt is TOLERATED; every other failure still
 * kills the run. `providerQueue.ts:119` does not retry this class, so a refusal
 * is one throw and no repeat spend — the position is FILED rather than lost.
 */
function refusalOf(error: unknown): { providerRef: string } | null {
  const provider = error as { failureClass?: unknown; providerRef?: unknown };
  if (provider?.failureClass !== "content_policy") return null;
  return { providerRef: typeof provider.providerRef === "string" ? provider.providerRef : "unnamed" };
}

/**
 * (2) ⚠ THE REFUSAL BITES THE BAR, NOT ONLY THE RUN — SYMMETRIC DROP.
 *
 * §6.2's perturbation bar compares `max − min` share spread between a control
 * cell and a clause cell, and **the expected value of a RANGE grows with n.** A
 * control cell landing 6 frames against a clause cell's 8 makes the clause look
 * wider BY SAMPLE SIZE ALONE, and the bar would read that as the clause
 * degrading the picture it widens. So a position refused in EITHER half of a
 * population leaves BOTH halves' paired numbers, and the paired n prints beside
 * the bar rather than being left to be inferred.
 */
function droppedPositions(
  refusals: readonly { cell: string; pos: number }[],
  cellsOfPopulation: readonly string[],
): Set<number> {
  const out = new Set<number>();
  for (const refusal of refusals) {
    if (cellsOfPopulation.includes(refusal.cell)) out.add(refusal.pos);
  }
  return out;
}

/** The label a row carries, from the position a refusal carries. */
const posLabel = (pos: number) => `pos${pos}`;
const posNumber = (label: string) => Number(label.replace("pos", ""));

/**
 * (3) ⚠ RESUMING WITHOUT RE-RENDERING, AND WITHOUT TRANSCRIBING.
 *
 * The 16 SUIT frames cost $1.27 and are on disk; `armM.json` was never written
 * because the crash came before the reading section. Their rows therefore come
 * out of the dead run's printed log — and **a TRANSCRIPTION is the provenance
 * defect opus-1195 §2(b) caught in the arm-H evidence**, so this is not one:
 * every derived field is RECOMPUTED from the printed BOX, and the printed figure
 * is asserted against the recomputation to its own printed precision. The log's
 * numbers are the CONTROL on the parse rather than its source. `below` has no
 * printed figure of its own and is not left unchecked either — `identityHolds`
 * evaluates `below = 1/share − headroom − 1` on every recovered row further
 * down, which is an independent arithmetic control on exactly that field.
 *
 * A row is admitted only if its RAW FRAME IS ON DISK. A refusal line is
 * recovered too, so a second resume does not re-dispatch a prompt the provider
 * has already refused — at a 25% base rate a resumed run meeting another
 * refusal is the expected case, not the corner.
 */
/** Split that survives either ending — these logs are written on Windows. */
const NEWLINE_RE = new RegExp("\r?\n");
const LOG_CELL = /^════ (\S+) ════$/;
const LOG_ROW = new RegExp(
  "^ {2}pos(\\d+) {2}(\\d+)x(\\d+) {2}face (\\d+)x(\\d+) at (\\d+),(\\d+)"
  + " {2}share ([\\d.]+)% {2}headroom ([\\d.]+)(?: {2}head top (\\d+) {2}gap (-?[\\d.]+)| {2}head ABSENT)"
  /* A recovered row is re-said in the SAME shape with a marker, so the log of a
     resumed run is one uniform log — and so a second resume can read its own
     output. The suffix is optional here and never load-bearing. */
  + "(?: · recovered)?$",
);
const LOG_REFUSAL = /^ {2}pos(\d+) {2}⚠ REFUSED content_policy · providerRef (\S+)/;

/**
 * ⚠ THE BOX TRAVELS WITH THE ROW, and it is not decoration.
 *
 * The court's own numbers are all VERTICAL, so `share`/`headroom`/`below` would
 * be enough for every bar. The STRIPS are a picture: they centre each crop on the
 * face box's own horizontal centre, because measured on arm R's frames that
 * centre sits up to ~42 px off the frame's middle, which is plainly visible once
 * the crop is narrower than the frame. The strips read that centre out of the
 * printed LOG. So a recovered row that dropped the box would have quietly
 * demoted every SUIT frame in the founder's strip to a centred fallback — the
 * numbers all correct and the picture wrong.
 */
type RecoveredRow = {
  cell: string; group: string; pos: string;
  share: number; headroom: number; below: number; gap: number | null;
  /** Exactly what the line printed, so a recovered row can be RE-SAID verbatim. */
  line: string;
};
type Recovered = {
  rows: RecoveredRow[];
  refusals: Array<{ cell: string; pos: number; providerRef: string }>;
  disagreements: string[];
};

function recoverFromLog(
  text: string,
  groupOf: (cell: string) => string | undefined,
  frameOnDisk: (cell: string, pos: number) => boolean,
  into: Recovered = { rows: [], refusals: [], disagreements: [] },
): Recovered {
  /*
    ⚠ LOGS ARE READ OLDEST FIRST, AND A LATER LINE ABOUT ONE POSITION IS A LATER
    ATTEMPT AT IT. Two rules follow, and the second is the one the real run
    needed: the LAST row for a position wins, and A ROW BEATS A REFUSAL — because
    a position the checker refused and a later dispatch DELIVERED is a frame that
    exists, and reading it as refused would discard a paid frame.
  */
  const byPos = new Map<string, RecoveredRow>(into.rows.map((row) => [`${row.cell}/${row.pos}`, row]));
  const refusedBy = new Map<string, { cell: string; pos: number; providerRef: string }>(
    into.refusals.map((one) => [`${one.cell}/${posLabel(one.pos)}`, one]));
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
      refusedBy.set(`${cell}/${posLabel(Number(refused[1]))}`,
        { cell, pos: Number(refused[1]), providerRef: refused[2]! });
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
    /* THE CONTROL ON THE PARSE: recompute, then insist the log's own printed
       figure agrees to the precision it was printed at. */
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
    byPos.set(`${cell}/${posLabel(pos)}`, {
      cell, group, pos: posLabel(pos), share, headroom,
      below: (frameH - faceTop - faceH) / faceH, gap,
      line: `${line.replace(/ · recovered$/, "")} · recovered`,
    });
  }
  /* A row beats a refusal — see the header. */
  for (const key of byPos.keys()) refusedBy.delete(key);
  return { rows: [...byPos.values()], refusals: [...refusedBy.values()], disagreements };
}

/** A recovery that disagrees with itself is not a recovery. */
function assertRecoveryAgrees(recovered: Recovered): void {
  if (recovered.disagreements.length > 0) {
    throw new Error("REFUSING to resume — the recovered rows do not survive their own recomputation:\n  "
      + recovered.disagreements.join("\n  "));
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
    /*
      THE THREE ARMS OF THE REFUSAL REPAIR (opus-1199). The tolerance, the
      symmetric drop and the log recovery are new code on a court's critical
      path, and a court's own instrument gets a negative and a positive control
      before its verdicts count for anything.
    */
    { what: "a recovered row's printed SHARE disagrees with its own box",
      expect: /share recomputes to 20\.0 and the log printed 19\.2/,
      run: () => assertRecoveryAgrees(recoverFromLog(
        `════ suit-clause ════\n  pos0  1536x2304  face 396x461 at 578,203  share 19.2%  headroom 0.440  head top 105  gap 0.213\n`,
        () => "SUIT", () => true)) },
    { what: "a recovered row's printed HEADROOM disagrees with its own box",
      expect: /headroom recomputes to 0\.459 and the log printed 0\.999/,
      run: () => assertRecoveryAgrees(recoverFromLog(
        `════ suit-clause ════\n  pos0  1536x2304  face 396x442 at 578,203  share 19.2%  headroom 0.999  head top 105  gap 0.222\n`,
        () => "SUIT", () => true)) },
    { what: "a recovered row's printed GAP disagrees with its own box",
      expect: /gap recomputes to 0\.222 and the log printed 0\.888/,
      run: () => assertRecoveryAgrees(recoverFromLog(
        `════ suit-clause ════\n  pos0  1536x2304  face 396x442 at 578,203  share 19.2%  headroom 0.459  head top 105  gap 0.888\n`,
        () => "SUIT", () => true)) },
    { what: "a recovered row whose RAW FRAME is not on disk", expect: /raw frame is NOT on disk/,
      run: () => assertRecoveryAgrees(recoverFromLog(
        `════ suit-clause ════\n  pos0  1536x2304  face 396x442 at 578,203  share 19.2%  headroom 0.459  head top 105  gap 0.222\n`,
        () => "SUIT", () => false)) },
  ];
  console.log("--prove-guard: arm M's assertions, driven to REFUSE. No network call.");
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
  const good = `════ suit-clause ════
  pos0  1536x2304  face 396x442 at 578,203  share 19.2%  headroom 0.459  head top 105  gap 0.222
  pos1  1536x2304  face 387x461 at 588,222  share 20.0%  headroom 0.482  head top 131  gap 0.197
  pos2  ⚠ REFUSED content_policy · providerRef 01a03288 · no frame, not retried
`;
  const recovered = recoverFromLog(good, () => "SUIT", () => true);
  assertRecoveryAgrees(recovered);
  if (recovered.rows.length !== 2 || recovered.refusals.length !== 1) {
    throw new Error(`the well-formed log recovered ${recovered.rows.length} rows and ${recovered.refusals.length} refusals, not 2 and 1`);
  }
  /*
    ⚠ AND THE TWO-LOG CASE, WHICH IS THE ONE THE REAL RUN NEEDED. A position the
    checker REFUSED in the first log and a later dispatch DELIVERED must read as
    a frame that exists — the alternative discards a paid frame, and it is not
    hypothetical: `basics-control/pos2` was refused at 16:50 and rendered from the
    SAME STORED BYTES at 17:17.
  */
  const later = `════ suit-clause ════
  pos2  1536x2304  face 402x477 at 553,187  share 20.7%  headroom 0.392  head top 104  gap 0.174
`;
  const merged = recoverFromLog(later, () => "SUIT", () => true, recovered);
  assertRecoveryAgrees(merged);
  const secondPass = [
    /* The arm that would have caught the discarded-return defect: a merge must
       CARRY what it was handed, and the caller must be handed it back. */
    ["a merge carries the rows it was handed forward", merged.rows.length >= recovered.rows.length],
    ["a later ROW beats an earlier refusal for the same position",
      merged.rows.some((row) => row.pos === "pos2") && merged.refusals.length === 0],
    ["and the earlier rows are still there, not duplicated", merged.rows.length === 3],
    ["a recovered row keeps its FULL LINE, box and all, to be re-said verbatim",
      merged.rows.every((row) => / face \d+x\d+ at \d+,\d+/.test(row.line))],
    ["and the marker is idempotent — re-reading a re-said line does not stack it",
      recoverFromLog(`════ suit-clause ════\n${merged.rows[0]!.line}\n`, () => "SUIT", () => true)
        .rows[0]!.line.match(/· recovered/g)!.length === 1],
  ] as const;
  for (const [what, held] of secondPass) {
    if (!held) throw new Error(`THE RECOVERY WENT THE WRONG WAY: ${what}`);
    console.log(`  held — ${what}`);
  }
  console.log(`  and every one passes the well-formed case — ${arms.length} refusals, 3 acceptances`);

  /*
    ⚠ AND TWO CONTROLS THAT ARE NOT REFUSALS, said plainly rather than dressed as
    guard arms. `refusalOf` and `droppedPositions` are pure decisions, so what
    they need is a YES case and a NO case — the negative-arm-cannot-find-YES-
    defects lesson, applied at the two decisions the refusal repair turns on.
  */
  const yesNo: Array<[string, boolean]> = [
    ["a `content_policy` failure is TOLERATED", refusalOf({ failureClass: "content_policy", providerRef: "x" }) !== null],
    ["every OTHER class still kills the run", refusalOf({ failureClass: "rate_limit", providerRef: "x" }) === null],
    ["a plain Error still kills the run", refusalOf(new Error("socket hang up")) === null],
    ["one cell's refusal drops the position from BOTH halves",
      droppedPositions([{ cell: "basics-control", pos: 2 }], ["basics-control", "basics-clause"]).has(2)],
    ["and with no refusal NOTHING is dropped",
      droppedPositions([], ["basics-control", "basics-clause"]).size === 0],
    ["a refusal in the OTHER population is not this population's drop",
      droppedPositions([{ cell: "suit-clause", pos: 3 }], ["basics-control", "basics-clause"]).size === 0],
  ];
  for (const [what, held] of yesNo) {
    if (!held) throw new Error(`THE DECISION WENT THE WRONG WAY: ${what}`);
    console.log(`  held — ${what}`);
  }
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

/*
  BASICS: one compile, both halves derived from it.

  ⚠ AND ON A RESUME THE COMPILE IS SKIPPED — WHICH IS A CORRECTNESS REQUIREMENT
  AND NOT A SAVING, exactly as the SUIT reuse above is. The interpreter is a
  language model: recompiling this brief would produce a DIFFERENT sheet, so the
  two `basics-control` frames the dead run already rendered would be paired
  against six frames from other prompts — the single-variable defect this whole
  harness is built to refuse, arriving through the resume door. So a resumed run
  reads the prompts the dead run STORED and asserts they are the same clause and
  the same wardrobe line. It also saves the openrouter compile, which is the
  by-product rather than the reason (opus-1199; the same argument fable-1552 §2
  accepted for the SUIT cell).
*/
let basicsControl: string[];
if (RESUME) {
  const stored = JSON.parse(readFileSync(`${OUT}/prompts.json`, "utf8")) as {
    clause: { from: string; to: string }; basicsControl: string[];
  };
  if (stored.clause?.from !== FRAMING_FROM || stored.clause?.to !== FRAMING_TO) {
    throw new Error("the stored prompts were built against a DIFFERENT clause — resuming would mix two courts");
  }
  basicsControl = stored.basicsControl;
  say(`  BASICS ${basicsControl.length} prompts READ BACK from the dead run's prompts.json`
    + " — not recompiled, because a second compile is a different sheet");
} else {
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
  basicsControl = (compiled.candidates ?? []).map((candidate: any) => candidate.prompt ?? "");
  say(`  wardrobeLine="${compiled.wardrobeLine}"`);
}
if (basicsControl.length !== 8) throw new Error(`BASICS holds ${basicsControl.length} prompts, not 8`);
const basicsClause = basicsControl.map((prompt) => prompt.replace(FRAMING_FROM, FRAMING_TO));
assertWardrobe(basicsControl, BASICS_LINE, "BASICS control");
assertWardrobe(basicsClause, BASICS_LINE, "BASICS clause");
assertClauseIsTheOnlyDifference(basicsControl, basicsClause);
say(`  BASICS ${basicsControl.length} prompts ${RESUME ? "read back" : "compiled once"}`
  + " · clause swapped · single-variable PROVEN"
  + " · wardrobe line asserted present on every prompt of both halves");

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

/*
  ⚠ WHAT THE DEAD RUN ALREADY BOUGHT — recovered before anything is priced,
  because the price of this run is the price of what it DISPATCHES.

  The recovery is the anti-transcription shape ruled at fable-1558 §1(f): every
  derived field recomputed from the printed box, the log's own printed figure
  asserted against it, and the raw frame required on disk. It keeps the ORIGINAL
  reading of those frames rather than buying a second opinion about extent.
*/
const groupOfCell = (id: string) => CELLS.find((cell) => cell.id === id)?.group;
const frameOnDisk = (cell: string, pos: number) => existsSync(`${OUT}/${cell}-pos${pos}-raw.png`);
let recovered: Recovered = { rows: [], refusals: [], disagreements: [] };
const logsRead: string[] = [];
if (RESUME) {
  for (const log of RESUME_LOGS) {
    if (!existsSync(log)) continue;
    logsRead.push(log);
    recovered = recoverFromLog(readFileSync(log, "utf8"), groupOfCell, frameOnDisk, recovered);
  }
  if (logsRead.length === 0) throw new Error(`no log to resume from — looked for ${RESUME_LOGS.join(", ")}`);
  /*
    ⚠ A RESUME THAT RECOVERS NOTHING IS A BROKEN PARSE, NOT AN EMPTY LOG — and
    this is not hypothetical: the merge rewrite returned a new object while the
    caller discarded it, so `--resume` read three real logs and recovered ZERO.
    What caught it was the MONEY guard, at $6.31 against a $5.00 ceiling — the
    right refusal for the wrong reason, and only because the re-buy happened to
    be large. A cheaper arm would have sailed through and silently re-bought
    everything it already owned. So the recovery now proves its own subject.
  */
  if (recovered.rows.length === 0 && recovered.refusals.length === 0) {
    throw new Error(`REFUSING: --resume read ${logsRead.length} log(s) and recovered NOTHING`
      + " — that is a broken parse, not an empty court, and continuing would re-buy every frame"
      + ` already on disk (${logsRead.join(", ")})`);
  }
}
assertRecoveryAgrees(recovered);

/** Positions this run does NOT have to buy again: a row, or a refusal. */
const settledAlready = new Map<string, Set<number>>();
for (const cell of CELLS) settledAlready.set(cell.id, new Set());
for (const row of recovered.rows) settledAlready.get(row.cell)!.add(posNumber(row.pos));
for (const refusal of recovered.refusals) settledAlready.get(refusal.cell)!.add(refusal.pos);

const toDispatch = CELLS.flatMap((cell) => cell.prompts
  .map((_, pos) => pos)
  .filter((pos) => !settledAlready.get(cell.id)!.has(pos))
  .map((pos) => `${cell.id}/pos${pos}`));

if (RESUME) {
  say(`  RESUME  recovered ${recovered.rows.length} rows and ${recovered.refusals.length} refusals`
    + ` from ${logsRead.join(" + ")}, every one recomputed from its own box`);
  for (const cell of CELLS) {
    const have = settledAlready.get(cell.id)!.size;
    say(`    ${cell.id.padEnd(15)} ${have}/${cell.prompts.length} settled · ${cell.prompts.length - have} to dispatch`);
  }
  /*
    ⚠ NOTHING LEFT TO DISPATCH IS A LEGITIMATE RUN, NOT AN ERROR. It is how the
    court's artifact is REBUILT from logs written across two runs — one uniform
    `armM.log` with every box in it, which is what the strips read their
    horizontal centres out of. It buys nothing and spends nothing.
  */
  if (toDispatch.length === 0) {
    say("    nothing left to dispatch — this run READS and REPORTS, and spends $0.00");
  }
}

const EXPECTED_SPEND = toDispatch.length * MEASURED_EACH[wanted] + toDispatch.length * 2 * 0.005;

/*
  ⚠ THE COURT'S OWN CEILING — $5.00 total, hard, granted fable-1555 §2 after this
  court ate TWO price corrections. It is a STOP-AND-REPORT, not a judgement call:
  the remaining arms wait on a fresh grant rather than on somebody deciding the
  overrun is small.
*/
const COURT_CEILING = 5.00;
/*
  Every figure at a SETTLED ledger rather than from memory: arms H+R are $1.34
  (arm H $0.10 + arm R $1.24); arm M's dead first run took $27.3300 → $25.7200 =
  $1.6100 (opus-1199 §3); its resumed run took a further $1.1400 for 13 images
  and 26 reads, printed by this script's own settle. Court settled: $4.0900.

  ⚠ It is a LIST rather than a running total on purpose — a court that has died
  once will be resumed again, and a single number nobody can decompose is how the
  ceiling stops meaning anything.
*/
const COURT_SETTLED = [1.34, 1.61, 1.14];
const COURT_SPENT = RESUME ? COURT_SETTLED.reduce((a, b) => a + b, 0) : COURT_SETTLED[0]!;

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
/** Every row the run will read, recovered ones first so a cell's numbers are in
 *  dispatch order however they were bought. */
const rows: Row[] = recovered.rows.map((row) => row as unknown as Row);
/** A refusal is FILED rather than lost — cell, position, and the provider's own
 *  reference, so a reader can take the refusal back to the provider. */
const refusals: Array<{ cell: string; pos: number; providerRef: string }> = [...recovered.refusals];
let images = 0;
let reads = 0;
/** What this run DISPATCHED, refused or not — the number the price divides by,
 *  because whether a refused dispatch is charged is an honest unknown
 *  (opus-1199 §3, accepted fable-1558 §1). */
let dispatched = 0;

for (const cell of CELLS) {
  say(`════ ${cell.id} ════`);
  const tiles: Buffer[] = [];
  for (let pos = 0; pos < cell.prompts.length; pos += 1) {
    /* ── ALREADY BOUGHT: the recovered half, re-said here so the log of the
       resumed run reads as one whole run rather than as a fragment. ── */
    if (settledAlready.get(cell.id)!.has(pos)) {
      const had = recovered.rows.find((row) => row.cell === cell.id && row.pos === posLabel(pos));
      const refused = refusals.find((one) => one.cell === cell.id && one.pos === pos);
      if (refused) {
        say(`  pos${pos}  ⚠ REFUSED content_policy · providerRef ${refused.providerRef}`
          + ` · no frame, not retried (recovered)`);
        continue;
      }
      /*
        ⚠ RE-SAID VERBATIM, plus a marker — the log of a resumed run is ONE
        UNIFORM LOG. A shorter "RECOVERED" line would have read fine and quietly
        dropped the FACE BOX, which no bar in this court uses and the founder's
        own strips centre every crop on: all eight SUIT frames would have fallen
        back to the frame's middle, up to ~42 px off, numbers all correct and the
        picture wrong.
      */
      if (!had) throw new Error(`${cell.id}/pos${pos}: settled with neither a row nor a refusal`);
      say(had.line);
      /* Its annotated frame is on disk; the contact sheet is rebuilt from it so
         the sheet shows the whole cell rather than only what this run bought. */
      const boxesPath = `${OUT}/${cell.id}-pos${pos}-boxes.png`;
      if (existsSync(boxesPath)) {
        tiles.push(await sharp(readFileSync(boxesPath))
          .resize({ width: 320, height: 480, fit: "contain", background: "#141414" })
          .png().toBuffer());
      }
      continue;
    }

    /* ── THE ONE FAILURE WITH A PUBLISHED BASE RATE (fable-1558 §1(a)) ── */
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
      say(`  pos${pos}  ⚠ REFUSED content_policy · providerRef ${refusal.providerRef}`
        + ` · no frame, not retried (providerQueue.ts:119)`);
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
  /* The refusal count on its own line, per cell — ruled fable-1558 §1(a). At a
     25% base rate this is the expected shape of a BASICS cell, not a corner. */
  const refusedHere = refusals.filter((one) => one.cell === cell.id);
  say(`  ${refusedHere.length} of ${cell.prompts.length} REFUSED by the content checker`
    + (refusedHere.length === 0 ? "" : ` — ${refusedHere.map((one) => `pos${one.pos}`).join(", ")}`));
  say();
}

/* ── THE READING, AGAINST BARS WRITTEN BEFORE THE RUN ── */

/* The SUIT control is arm R's own cell at this size — the reason arm R rendered
   eight per size. Its rows carry `pos` as a number; this arm's carry a label. */
const suitControlFrames: FramingFrame[] = armR.rows
  .filter((row) => row.size === wanted && Number.isFinite(row.share))
  .map((row) => ({ group: "SUIT", pos: `pos${row.pos}`, share: row.share, headroom: row.headroom, below: row.below }));

const cellFrames = (id: string): FramingFrame[] => rows.filter((row) => row.cell === id);

/*
  ⚠ THE TWO POPULATIONS EACH READ TWICE — AS DELIVERED, AND PAIRED.
  (Ruled fable-1558 §1(b) and (c).)

  AS DELIVERED is the customer's own sheet: a slice the content checker refused
  is a frame she never receives, so the headline `T_min` is read on what landed.
  PAIRED drops a position refused in EITHER half of a population from BOTH
  halves, because the perturbation bar compares `max − min` share spread between
  two cells and the expected value of a RANGE grows with n — an unequal-n
  comparison reads sample size as a clause effect.
*/
const CELLS_OF = {
  SUIT: ["suit-clause", "suit-control-b"],
  BASICS: ["basics-control", "basics-clause"],
} as const;
const dropOf = (group: keyof typeof CELLS_OF) => droppedPositions(refusals, CELLS_OF[group]);
const pairedFrames = (id: string, group: keyof typeof CELLS_OF): FramingFrame[] => {
  const dropped = dropOf(group);
  return cellFrames(id).filter((frame) => !dropped.has(posNumber(frame.pos)));
};
const pairedControlSuit = (): FramingFrame[] => {
  const dropped = dropOf("SUIT");
  return suitControlFrames.filter((frame) => !dropped.has(posNumber(frame.pos)));
};

say("THE READING — every number on the RAW frame, and no bar on a quantity the cut sets");
say();
for (const group of ["SUIT", "BASICS"] as const) {
  const dropped = [...dropOf(group)].sort((a, b) => a - b);
  say(`  ${group.padEnd(7)} refused positions ${dropped.length === 0 ? "none" : dropped.map(posLabel).join(", ")}`
    + `  →  paired readings drop ${dropped.length} position(s) from BOTH halves`);
}
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

/*
  ⚠ THE PRE-REGISTERED NULL ON n, REGISTERED BEFORE THE SPEND (opus-1199 §4(d),
  ruled fable-1558 §1(d)). Fewer than six usable `basics-clause` frames and the
  across-cast reading is NULL — this court does not establish the across-cast
  number. The bar is NOT relaxed to fit, which is the whole reason the line
  exists: moving a bar after seeing what it would have said is optional stopping.
*/
const ACROSS_MIN_N = 6;
const acrossReadable = basicsClauseRead.n >= ACROSS_MIN_N;

/* THE MARGIN BAR — three-way, and PARTIAL never ships. */
const tMinPct = across.tMin * 100;
const verdict = !acrossReadable ? "NULL"
  : tMinPct <= TMIN_PASS ? "PASS" : tMinPct <= TMIN_PARTIAL ? "PARTIAL" : "FAIL";
say(`MARGIN BAR   T_min across both clause cells = ${tMinPct.toFixed(1)}%  →  ${verdict}`);
if (!acrossReadable) {
  say(`  ⚠ NULL — the BASICS clause cell landed n=${basicsClauseRead.n} against the `
    + `pre-registered floor of ${ACROSS_MIN_N}. The figure above is PRINTED, not a verdict;`);
  say("     this court does not establish the across-cast number, and the bar is not");
  say("     relaxed to fit (opus-1199 §4(d), ruled fable-1558 §1(d)).");
}

/*
  ⚠ AND THE n-BIAS IS NAMED RATHER THAN LEFT TO BE NOTICED (fable-1558 §1(c)).

  `T_min` is a MAX-type statistic: the tightest frame sets it, so a sheet with
  fewer frames has a LOWER `T_min` — biased toward PASS, which is the unsafe
  direction. The band below is what the across figure would have read with the
  SAME NUMBER of positions dropped from the SUIT cell, over every choice of
  which — best case and worst case. It costs nothing (the SUIT rows are already
  bought) and it shows a reader how much of any PASS is sample size.
*/
const droppedFromBasics = 8 - basicsClauseRead.n;
if (droppedFromBasics > 0) {
  const suitFrames = cellFrames("suit-clause");
  const basicsFrames = cellFrames("basics-clause");
  const combos: number[] = [];
  const walk = (start: number, chosen: FramingFrame[]) => {
    if (chosen.length === droppedFromBasics) {
      const kept = suitFrames.filter((frame) => !chosen.includes(frame));
      if (kept.length > 0) combos.push(tMinOf([...kept, ...basicsFrames]).tMin * 100);
      return;
    }
    for (let i = start; i < suitFrames.length; i += 1) walk(i + 1, [...chosen, suitFrames[i]!]);
  };
  walk(0, []);
  say(`  MATCHED-n SENSITIVITY   drop ${droppedFromBasics} of SUIT's 8 as well, every choice `
    + `(${combos.length} of them):`);
  say(`    across T_min ranges ${Math.min(...combos).toFixed(1)}% – ${Math.max(...combos).toFixed(1)}%`
    + `  against the delivered ${tMinPct.toFixed(1)}%`);
  say("    T_min is a MAX-type statistic, so fewer frames reads LOWER — the bias runs");
  say("    toward PASS, which is the unsafe direction. Printed, never subtracted.");
}
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
/* Paired, like every other cross-cell comparison here — SUIT carries no
   refusal today, so this is the same number, and it stays paired so that a
   future refusal in a SUIT cell cannot quietly turn the floor into an
   unequal-n reading. */
const floorPt = Math.abs(
  tMinOf(pairedFrames("suit-control-b", "SUIT")).shareSpread * 100
  - tMinOf(pairedControlSuit()).shareSpread * 100,
);
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
/*
  ⚠ READ ON THE PAIRED CELLS, NOT THE DELIVERED ONES (fable-1558 §1(b)). The
  paired n prints beside every row, because an unequal-n range comparison reads
  sample size as a clause effect and a reader cannot see that from the deltas.
*/
for (const [label, clauseFrames, controlFrames] of [
  ["SUIT", pairedFrames("suit-clause", "SUIT"), pairedControlSuit()],
  ["BASICS", pairedFrames("basics-clause", "BASICS"), pairedFrames("basics-control", "BASICS")],
] as const) {
  const clauseRead = tMinOf(clauseFrames);
  const controlRead = tMinOf(controlFrames);
  const clauseSpread = clauseRead.shareSpread * 100;
  const controlSpread = controlRead.shareSpread * 100;
  const delta = clauseSpread - controlSpread;
  const paired = clauseRead.n === controlRead.n;
  say(`  ${label.padEnd(7)} control spread ${controlSpread.toFixed(1)}pt → clause ${clauseSpread.toFixed(1)}pt`
    + `  ·  ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pt (bar +${PERTURBATION_BAR_PT.toFixed(1)})`
    + `  ${readable ? (delta <= PERTURBATION_BAR_PT ? "PASS" : "FAIL") : "reported, NOT a verdict"}`);
  say(`          paired n=${controlRead.n} against n=${clauseRead.n}`
    + (paired ? " — equal, so the comparison is a comparison"
      : " ⚠ UNEQUAL AFTER THE SYMMETRIC DROP — this row is NOT a verdict, whatever the bar says"));
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
/* A run that dispatched nothing has no move to wait for, and `settled` waits for
   ONE — twelve minutes of polling for an event that cannot happen. */
let settledAfter = after.remaining;
if (dispatched === 0) {
  say("nothing was dispatched, so there is no ledger move to wait for");
} else {
  say("waiting for the ledger to settle — two consecutive equal reads after a move");
  settledAfter = await settled(after.remaining);
}
const spent = before.remaining - settledAfter;
say(`fal spent $${spent.toFixed(4)} for ${images} images and ${reads} reads at ${wanted}`);
const cumulative = COURT_SPENT + spent;
say(`COURT CUMULATIVE $${cumulative.toFixed(4)} against the $${COURT_CEILING.toFixed(2)} ceiling`
  + `  ${cumulative > COURT_CEILING ? "⚠ OVER — STOP AND REPORT, the remaining arms wait on a fresh grant" : "— clear"}`);
/*
  ⚠ THE PER-IMAGE PRICE IS PRINTED BOTH WAYS, BECAUSE WHETHER A REFUSED DISPATCH
  IS CHARGED IS AN HONEST UNKNOWN (opus-1199 §3, accepted fable-1558 §1). One
  balance cannot separate the two worlds, so both are printed and neither is
  called the reading. If they ever differ enough to separate, that is free
  evidence and belongs in the report.
*/
const refusedThisRun = dispatched - images;
say(`  reads at $0.005 -> $${(reads * 0.005).toFixed(4)}; images therefore`);
say(`    $${((spent - reads * 0.005) / Math.max(1, images)).toFixed(4)} each over the ${images} that DELIVERED`);
if (refusedThisRun > 0) {
  say(`    $${((spent - reads * 0.005) / Math.max(1, dispatched)).toFixed(4)} each over all ${dispatched} DISPATCHED`
    + ` (${refusedThisRun} refused)`);
}
say(`    against an expected $${SIZE.each.toFixed(4)}`);

writeFileSync(`${OUT}/armM.log`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/armM.json`, JSON.stringify({
  size: wanted, clause: { from: FRAMING_FROM, to: FRAMING_TO },
  rows, suitControlFrames, images, dispatched, reads, refusals,
  resumed: RESUME, recoveredRows: recovered.rows.length, recoveredRefusals: recovered.refusals.length,
  balanceBefore: before.remaining, balanceSettledAfter: settledAfter, spent,
  verdict, acrossReadable, acrossMinN: ACROSS_MIN_N, tMinAcrossPct: tMinPct,
  floorPt, perturbationReadable: readable,
  courtSpentBefore: COURT_SPENT, courtCeiling: COURT_CEILING,
}, null, 2), "utf8");
say();
say(`kept: ${OUT}/armM.log, armM.json, ${rows.length} measured frames`
  + `, ${refusals.length} refused, ${CELLS.length} contact sheets`);

/* And the last statement ends the process. */
process.exit(0);
