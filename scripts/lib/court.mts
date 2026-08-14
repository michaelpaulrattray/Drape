/**
 * THE PROMOTION KIT'S COURT (V2 — `docs/specs/VOCABULARY_OVERHAUL_REVIEW.md`).
 *
 * V2's remit is four standard courts packaged so one shift can run them for any
 * kind — departure floor, detection, removal phrasing, carry survival — with
 * one output rule: **measured numbers or a named refusal, never a guess.**
 *
 * This is the shape they share, extracted from the one that has actually run:
 * the skin-carrier bench (fable-361 §1, ruled in 409/410). Everything here was
 * load-bearing in that court and every clause below is a defect it or its
 * siblings met:
 *
 *  1. **The status-quo arm is not optional.** Without "what already ships" in
 *     the field, a court can crown a carrier worse than the thing it replaces.
 *  2. **The floor is measured before anything is judged.** Two renders of one
 *     face differ for reasons that are not the ask. A signal inside its own
 *     noise convicts and exonerates equally, so a court whose signal does not
 *     clear its floor by the declared ratio REFUSES with that in words.
 *  3. **An arm whose subject never reached the wire is VOID, not failed.** Two
 *     benches in this program passed while the thing under test was inert.
 *  4. **"Nothing qualified" is a first-class verdict.** No arm at the bar means
 *     the status quo stands, written plainly and without a consolation hunt.
 *  5. **The ledger is read at both ends** (`benchKit.openLedgerWatch`), because
 *     "house money" is an assertion rather than a hope.
 *
 * A court is DESIGNED before it is run: the bars are pre-registered
 * (`benchKit.preRegisterBars`) and this module refuses a reading filed against
 * a bar nobody declared.
 */
import { preRegisterBars, type Bar, type BarVerdict } from "./benchKit.mts";

/** What one arm did, in the court's own units. */
export type ArmReading = {
  /** The arm's own id, as declared. */
  arm: string;
  /**
   * What the arm SAW at the wire — the proof its subject was actually there.
   *
   * Null means it was not, and the arm is VOID: it tested nothing, which is a
   * different thing from testing something and failing.
   */
  sawAtTheWire: string | null;
  /** The numbers, in whatever units this court measures. */
  readings: Readonly<Record<string, number>>;
  /** The court's own classification of this arm — its vocabulary, not ours. */
  outcome: string;
};

export type CourtArm = {
  id: string;
  label: string;
  /** Exactly one arm must be the thing that already ships. */
  statusQuo?: boolean;
  run: () => Promise<ArmReading>;
};

export type CourtDesign = {
  /** The kind being promoted — the report is per kind. */
  kind: string;
  /** What this court answers, in one sentence. */
  question: string;
  /** Written before the first call; a reading citing an undeclared bar throws. */
  bars: readonly Bar[];
  /**
   * THE NOISE FLOOR, AND THE RATIO THE SIGNAL MUST CLEAR IT BY.
   *
   * `measure` returns `{ floor, signal }` in the court's units. Nothing is
   * judged until `signal >= floor * ratio`; below it the court refuses with
   * `the ask did not land`, which is a finding rather than a failure.
   */
  floor: {
    ratio: number;
    measure: () => Promise<{ floor: number; signal: number; saw: string }>;
  };
  arms: readonly CourtArm[];
  /**
   * Which outcomes count as a pass, in the court's own vocabulary.
   *
   * Named rather than inferred: `SURVIVED` and `MELTED` are both readings, and
   * only one of them is a promotion.
   */
  qualifies: (reading: ArmReading) => boolean;
  /** Lower is better, for tie-breaks between qualifying arms. */
  rank?: (reading: ArmReading) => number;
};

export type CourtVerdict =
  | {
    kind: string;
    outcome: "measured";
    winner: string | null;
    /** Null winner means nothing qualified — the status quo stands. */
    statusQuoStands: boolean;
    floor: { floor: number; signal: number; saw: string };
    readings: readonly ArmReading[];
    void: readonly string[];
    bars: readonly BarVerdict[];
    report: string;
  }
  | {
    kind: string;
    outcome: "refused";
    /** The named refusal — never a guess dressed as a result. */
    reason: string;
    detail: string;
    report: string;
  };

/**
 * Run one court and answer with numbers or a named refusal.
 *
 * The order is the discipline: bars registered, floor measured, arms run, and
 * only then a verdict. Nothing here decides anything the design did not.
 */
export async function runCourt(design: CourtDesign): Promise<CourtVerdict> {
  const statusQuo = design.arms.filter((arm) => arm.statusQuo);
  if (statusQuo.length !== 1) {
    throw new Error(
      `a court needs exactly ONE status-quo arm — what already ships must be in the field, `
      + `or it can crown something worse than itself (${design.kind} declared ${statusQuo.length})`,
    );
  }
  const court = preRegisterBars(design.bars);

  const floor = await design.floor.measure();
  if (!(floor.signal >= floor.floor * design.floor.ratio)) {
    const detail = `signal ${floor.signal} against floor ${floor.floor} — `
      + `${design.floor.ratio}x was required. ${floor.saw}`;
    return {
      kind: design.kind,
      outcome: "refused",
      reason: "the ask did not land",
      detail,
      report: [
        `COURT ${design.kind} — ${design.question}`,
        `  REFUSED: the ask did not land`,
        `  ${detail}`,
        `  Nothing was judged: a signal inside its own noise convicts and exonerates equally.`,
      ].join("\n"),
    };
  }

  const readings: ArmReading[] = [];
  for (const arm of design.arms) readings.push(await arm.run());

  const voided = readings.filter((reading) => reading.sawAtTheWire === null).map((r) => r.arm);
  const judged = readings.filter((reading) => reading.sawAtTheWire !== null);
  const qualifying = judged.filter((reading) => design.qualifies(reading));
  const ranked = design.rank
    ? [...qualifying].sort((a, b) => design.rank!(a) - design.rank!(b))
    : qualifying;
  const winner = ranked[0]?.arm ?? null;

  for (const reading of judged) {
    for (const [name, value] of Object.entries(reading.readings)) {
      if (design.bars.some((bar) => bar.name === `${reading.arm}:${name}`)) {
        court.file(`${reading.arm}:${name}`, value, reading.sawAtTheWire ?? "");
      }
    }
  }

  const lines = [
    `COURT ${design.kind} — ${design.question}`,
    `  floor ${floor.floor} · signal ${floor.signal} · cleared ${design.floor.ratio}x`,
    ...readings.map((reading) => `  ${reading.arm.padEnd(12)} ${reading.outcome.padEnd(10)} `
      + Object.entries(reading.readings).map(([name, value]) => `${name}=${value}`).join(" ")
      + (reading.sawAtTheWire === null ? "   VOID — its subject never reached the wire" : "")),
    winner === null
      ? "  NOTHING QUALIFIED — the status quo stands."
      : `  WINNER: ${winner}`,
  ];

  return {
    kind: design.kind,
    outcome: "measured",
    winner,
    statusQuoStands: winner === null || Boolean(design.arms.find((arm) => arm.id === winner)?.statusQuo),
    floor,
    readings,
    void: voided,
    bars: court.judge(),
    report: lines.join("\n"),
  };
}
