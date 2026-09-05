/**
 * THE TWO NUMBERS THAT SAY WHETHER THE OVERLAP DESIGN WORKED (#543 item 4,
 * founder-ordered and urgent).
 *
 * His order was *"investigate our current process and optimize it as urgent"*.
 * The investigation's baseline, read off 53 shifts joined to their PRs'
 * GitHub timestamps (2026-09-01 → 09-05):
 *
 *   build   shift start → PR opened          median 30 min   41% of the mean
 *   WAIT    PR opened → merged               median 27 min   52% of the mean
 *   close   merged → shift end               median 12 min    6% of the mean
 *   gate runs per merged PR                  3.1, at ~7 min each
 *
 * The card's own words for what this module is: *"The join script from this
 * investigation is the reader; make it a tracked `scripts/lib` reader with a
 * fixture arm, not a disposable."* — because a number quoted week after week
 * must come from a script and never from a memory (INSTRUMENT_DOCTRINE entry
 * 5), and the investigation's own join was a throwaway.
 *
 * The two numbers, and the targets that say the design worked:
 *
 *   CARDS LANDED PER SESSION    ≥ 3 on a small-card night
 *   GATE MINUTES PER CARD       ≤ 10
 *
 * ⚠ THE ATTRIBUTION IS BY TIME WINDOW, AND THAT IS A DECISION WITH A REASON.
 * `crew_shift_runs.prNumber` holds ONE pr number per run, and the founder
 * removed the batch cap on 2026-09-05 — a shift now lands as many small cards
 * as it can, so the column cannot answer "how many". A PR is therefore
 * attributed to the CLOSED shift run whose `startedAt … endedAt` window
 * contains its merge.
 *
 * ⚠ AND EVERY PR THAT FITS NO WINDOW IS REPORTED, NEVER DROPPED. A join that
 * silently discards its misses reads as a clean, small population — the
 * failure mode a denominator exists to prevent. The unattributed list is part
 * of the output, with its own count.
 *
 * Pure: readings in, figures out. No `gh`, no database, no network — the
 * reader that fetches lives in `machinist-ledger-read.mts`, so this whole
 * decision is driveable from fixtures (law 3).
 */

/** One row of `crew_shift_runs`, reduced to what the join uses. */
export type ShiftRunReading = {
  id: number;
  shift: string;
  seat: string;
  /** ISO. */
  startedAt: string;
  /** ISO, or null while the run is still open. */
  endedAt: string | null;
  /** shipped | stopped | failed, or null while open. */
  outcome: string | null;
};

/** One merged pull request, with the gate time it consumed. */
export type MergedPrReading = {
  number: number;
  /** ISO. */
  mergedAt: string;
  /**
   * Total minutes of `gate.yml` run time across every gate run on this PR's
   * branch between its opening and its merge — the compute the card's "3.1
   * gate runs per PR at ~7 minutes each" is counting.
   */
  gateMinutes: number;
  /** How many gate runs those minutes came from, so the mean is checkable. */
  gateRuns: number;
};

export type AttributedSession = {
  run: ShiftRunReading;
  prs: MergedPrReading[];
};

export type ShiftLedgerReading = {
  /** Closed runs only — an open run has no upper bound to attribute inside. */
  sessions: AttributedSession[];
  /** PRs that fit no closed session's window. Reported, never dropped. */
  unattributed: MergedPrReading[];
  /**
   * Runs whose windows overlap another's. One runner launches shifts, so this
   * should be empty; if it is not, the attribution below is ambiguous for any
   * PR inside the overlap and the caller is told rather than left to assume.
   */
  overlappingRunIds: number[];
};

const at = (iso: string): number => new Date(iso).getTime();

/**
 * The join. A PR belongs to the closed run whose window contains its merge;
 * where two windows overlap, the one that started LATER wins, because a shift
 * that began after another was still open is the one actually doing the work.
 */
export function attributePrsToSessions(
  runs: readonly ShiftRunReading[],
  prs: readonly MergedPrReading[],
): ShiftLedgerReading {
  const closed = runs
    .filter((r): r is ShiftRunReading & { endedAt: string } => r.endedAt !== null)
    .sort((a, b) => at(a.startedAt) - at(b.startedAt));

  const overlapping = new Set<number>();
  for (let i = 0; i < closed.length; i += 1) {
    for (let j = i + 1; j < closed.length; j += 1) {
      const a = closed[i]!;
      const b = closed[j]!;
      if (at(b.startedAt) < at(a.endedAt) && at(a.startedAt) < at(b.endedAt)) {
        overlapping.add(a.id);
        overlapping.add(b.id);
      }
    }
  }

  const sessions: AttributedSession[] = closed.map((run) => ({ run, prs: [] }));
  const unattributed: MergedPrReading[] = [];

  for (const pr of [...prs].sort((a, b) => at(a.mergedAt) - at(b.mergedAt))) {
    const merged = at(pr.mergedAt);
    let chosen: AttributedSession | null = null;
    for (const session of sessions) {
      const { startedAt, endedAt } = session.run;
      if (merged < at(startedAt) || merged > at(endedAt!)) continue;
      // Later-starting run wins an overlap; `sessions` is in start order, so a
      // straight overwrite is that rule.
      chosen = session;
    }
    if (chosen === null) unattributed.push(pr);
    else chosen.prs.push(pr);
  }

  return { sessions, unattributed, overlappingRunIds: [...overlapping].sort((a, b) => a - b) };
}

export type LedgerFigures = {
  /** Closed sessions in the window. The denominator, stated. */
  sessions: number;
  /** Sessions that landed at least one card — the population the mean is over. */
  landingSessions: number;
  cards: number;
  /** cards ÷ landingSessions. `null` when nothing landed. */
  cardsPerLandingSession: number | null;
  /** cards ÷ sessions, including the quiet ones. */
  cardsPerSession: number | null;
  gateMinutes: number;
  gateRuns: number;
  /** gateMinutes ÷ cards. `null` when nothing landed. */
  gateMinutesPerCard: number | null;
  /** gateRuns ÷ cards — the 3.1 baseline this card was filed on. */
  gateRunsPerCard: number | null;
  unattributedPrs: number;
};

/**
 * ⚠ TWO CARDS-PER-SESSION FIGURES ARE REPORTED, NOT ONE, BECAUSE THEY ANSWER
 * DIFFERENT QUESTIONS AND ONLY ONE OF THEM IS THE CARD'S TARGET.
 *
 * The card's bar is *"≥3 small cards per session ON A SMALL-CARD NIGHT"*. A
 * quiet night that correctly lands nothing is a CORRECT shift (the founder's
 * own anti-boredom rule) and would drag a flat mean down while nothing was
 * wrong — so the target is read against sessions that landed something, and
 * the all-sessions figure sits beside it so the quiet nights are visible
 * rather than hidden.
 */
export function summarise(reading: ShiftLedgerReading): LedgerFigures {
  const sessions = reading.sessions.length;
  const landing = reading.sessions.filter((s) => s.prs.length > 0);
  const cards = reading.sessions.reduce((n, s) => n + s.prs.length, 0);
  const gateMinutes = reading.sessions.reduce(
    (n, s) => n + s.prs.reduce((m, p) => m + p.gateMinutes, 0),
    0,
  );
  const gateRuns = reading.sessions.reduce(
    (n, s) => n + s.prs.reduce((m, p) => m + p.gateRuns, 0),
    0,
  );
  return {
    sessions,
    landingSessions: landing.length,
    cards,
    cardsPerLandingSession: landing.length === 0 ? null : cards / landing.length,
    cardsPerSession: sessions === 0 ? null : cards / sessions,
    gateMinutes,
    gateRuns,
    gateMinutesPerCard: cards === 0 ? null : gateMinutes / cards,
    gateRunsPerCard: cards === 0 ? null : gateRuns / cards,
    unattributedPrs: reading.unattributed.length,
  };
}

/** The card's own targets, verbatim from its build item 4. */
export const TARGETS = {
  cardsPerLandingSession: 3,
  gateMinutesPerCard: 10,
  /** The baseline the card was filed on, kept so drift from it is visible. */
  baselineGateRunsPerCard: 3.1,
} as const;

export type TargetVerdict = {
  name: string;
  figure: number | null;
  target: number;
  /** `null` when there is nothing to judge — never a silent pass. */
  met: boolean | null;
  note: string;
};

/**
 * ⚠ AN EMPTY WINDOW RETURNS `met: null`, NEVER `met: true`. A target that
 * passes on no data is the shape that lets an instrument report success while
 * measuring nothing (`null-result-needs-a-fixture`).
 */
export function judge(figures: LedgerFigures): TargetVerdict[] {
  return [
    {
      name: "cards landed per session (sessions that landed something)",
      figure: figures.cardsPerLandingSession,
      target: TARGETS.cardsPerLandingSession,
      met:
        figures.cardsPerLandingSession === null
          ? null
          : figures.cardsPerLandingSession >= TARGETS.cardsPerLandingSession,
      note:
        `${figures.cards} card(s) across ${figures.landingSessions} landing session(s) ` +
        `of ${figures.sessions} closed`,
    },
    {
      name: "gate minutes per card",
      figure: figures.gateMinutesPerCard,
      target: TARGETS.gateMinutesPerCard,
      met:
        figures.gateMinutesPerCard === null
          ? null
          : figures.gateMinutesPerCard <= TARGETS.gateMinutesPerCard,
      note: `${figures.gateMinutes.toFixed(1)} gate minutes over ${figures.gateRuns} run(s)`,
    },
    {
      name: "gate runs per card (the 3.1 baseline)",
      figure: figures.gateRunsPerCard,
      target: TARGETS.baselineGateRunsPerCard,
      met:
        figures.gateRunsPerCard === null
          ? null
          : figures.gateRunsPerCard <= TARGETS.baselineGateRunsPerCard,
      note: "preflight (#543 item 1) is what should move this; 1.5 is the card's aim",
    },
  ];
}

/** The block the Machinist ledger prints and appends, figures and denominators. */
export function renderLedgerBlock(reading: ShiftLedgerReading, windowLabel: string): string {
  const f = summarise(reading);
  const lines: string[] = [];
  const num = (v: number | null, digits = 2) => (v === null ? "—" : v.toFixed(digits));

  lines.push(`G. THE SHIFT PROCESS — cards per session and gate minutes per card (${windowLabel})`);
  lines.push("");
  if (f.sessions === 0) {
    // Doctrine entry 1: a window with no rows says so rather than printing zeros.
    lines.push("  NO CLOSED SHIFT RUNS IN THIS WINDOW — nothing to read, which is not the same as zero.");
    return lines.join("\n");
  }
  lines.push(`  closed sessions          ${f.sessions}`);
  lines.push(`  of those, landed a card  ${f.landingSessions}`);
  lines.push(`  cards landed             ${f.cards}`);
  lines.push(`  gate runs / gate minutes ${f.gateRuns} / ${f.gateMinutes.toFixed(1)}`);
  lines.push("");
  for (const v of judge(f)) {
    const mark = v.met === null ? "  ?  " : v.met ? "  OK " : " MISS";
    lines.push(`  ${mark}  ${v.name}: ${num(v.figure)}  (target ${v.target})  — ${v.note}`);
  }
  if (f.unattributedPrs > 0) {
    lines.push("");
    lines.push(
      `  ⚠ ${f.unattributedPrs} merged PR(s) fit no closed session's window and are NOT in the ` +
        "figures above: " +
        reading.unattributed.map((p) => `#${p.number} (${p.mergedAt})`).join(", "),
    );
    lines.push(
      "    A PR merged by hand, or during a shift whose row was never closed, lands here — as " +
        "does one merged by a shift that both started AND ended outside this window, which is a " +
        "boundary artifact rather than an anomaly. It is printed rather than dropped so the " +
        "denominator stays honest.",
    );
  }
  if (reading.overlappingRunIds.length > 0) {
    lines.push("");
    lines.push(
      `  ⚠ shift runs with overlapping windows: ${reading.overlappingRunIds.join(", ")} — one ` +
        "runner launches shifts, so this should be empty. Attribution inside the overlap goes " +
        "to the later-starting run.",
    );
  }
  return lines.join("\n");
}
