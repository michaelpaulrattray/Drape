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
 * # ⚠ TWO QUESTIONS HERE READ TWO DIFFERENT FIELDS FOR A RUN'S END, ON PURPOSE
 *
 * `endedAt` is not a lifetime — it is a STAMP any later shift may apply at any
 * hour, and `shared/crewShiftState.ts` says so in its own words: *"a dead row
 * closed hours late carries a lifetime it never had"*. Measured on production's
 * 54 honestly-stamped rows (the 565 closed before #1872 had `heartbeatAt`
 * overwritten by their own close and cannot be read): the gap between a row's
 * last proof of life and its close stamp runs **median 17 min, p90 32 min, max
 * 678 min**.
 *
 * **The OVERLAP test therefore reads the last proof of life**
 * (`laneRunLastProofOfLife`), because its question is purely *"were two runs
 * ALIVE at the same moment"* and a close stamp cannot answer that. Measured
 * before and after on the real rows: **48 overlapping pairs by close stamp,
 * 24 by proof of life** over those 54; **182 → 158** over all 619 closed rows.
 * Twenty-four of the forty-eight never overlapped.
 *
 * **The ATTRIBUTION window deliberately keeps `endedAt`, and #2086 asked for
 * both halves to move.** The second half was driven before it was written and
 * it is REFUSED, because a shift's own merge routinely lands AFTER its last
 * heartbeat: the standing orders put that heartbeat at *edition written*, and
 * the merge, the rite and the close all come after it.
 *
 *   * narrowing the window to the proof of life sends **35 of 80 merged PRs
 *     (44%) to `unattributed`** — the unattributed count goes 6 → 41 and the
 *     card's own headline figure is then computed over half the work;
 *   * the gentler variant — keep the window, but prefer a session that was
 *     still alive at the merge — moves only 2 of 80, and **one of those two is
 *     provably wrong against the row's own columns**: run #604 carries
 *     `branch = team/1953-plan-features` and `prNumber = 1970`, and PR #1970
 *     merged at 06:29:19, six minutes after that run's last heartbeat and
 *     seventeen before its close. The close stamp is the only bound that
 *     contains a shift's own merge.
 *
 * So the honest remainder is named rather than patched: the defect #2086
 * describes in attribution is real (a dead row's late close can out-rank a live
 * run for a merge inside it) and **a time window cannot fix it** — the fields
 * that can are `prNumber` and `branch`, which anchor a PR to a run with no
 * clock at all. That is a design change, filed separately, not smuggled in
 * here.
 *
 * Pure: readings in, figures out. No `gh`, no database, no network — the
 * reader that fetches lives in `machinist-ledger-read.mts`, so this whole
 * decision is driveable from fixtures (law 3).
 */
import { laneRunLastProofOfLife } from "../../shared/crewShiftState.js";

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
  /**
   * ISO — the run's last check-in, which is where its TRUSTWORTHY life ends.
   * The OVERLAP test reads it; the attribution window does not (see the header).
   *
   * Optional, and absence gets exactly the reading this file had before #2086:
   * `laneRunLastProofOfLife` falls back to `endedAt`. A caller joining rows it
   * did not select this column from is therefore not silently sharpened.
   */
  heartbeatAt?: string | null;
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

type AttributedSession = {
  run: ShiftRunReading;
  prs: MergedPrReading[];
};

export type ShiftLedgerReading = {
  /** Closed runs only — an open run has no upper bound to attribute inside. */
  sessions: AttributedSession[];
  /** PRs that fit no closed session's window. Reported, never dropped. */
  unattributed: MergedPrReading[];
  /**
   * Runs that were ALIVE at the same moment as another — `startedAt` to last
   * proof of life, never to the close stamp (#2086).
   *
   * ⚠ **IT IS NO LONGER EXPECTED TO BE EMPTY, and this comment said it should
   * be.** That sentence was true of a runner launching one shift per pass;
   * `.agents/foreman/foreman-runner.ps1` has launched up to `MAX_SEATS = 4`
   * builder seats per pass since #1281, so concurrency is the design rather
   * than an anomaly — 24 genuine overlapping pairs sit in the 54 honestly
   * stamped rows. What the figure still means is what it always meant: the
   * attribution below is AMBIGUOUS for any PR merged inside an overlap, and
   * the caller is told rather than left to assume.
   */
  overlappingRunIds: number[];
};

const at = (iso: string): number => new Date(iso).getTime();

/**
 * WHEN A RUN WAS LAST KNOWN TO BE ALIVE — one owner, in `shared/`, because the
 * seat cut, his page and this ledger must not disagree about what a lifetime is
 * (working law 4, applied to a definition). The never-checked-in fallback and
 * the reason it exists are in that function's own header.
 */
const lifeEndOf = (run: ShiftRunReading): number =>
  laneRunLastProofOfLife({
    id: run.id,
    shift: run.shift,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    heartbeatAt: run.heartbeatAt ?? null,
  });

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

  /*
    ⚠ THE BOUND HERE IS A LIFETIME, NOT A CLOSE STAMP (#2086) — and that is the
    identical clause shape #2079 repaired one file away. "Did these two runs
    overlap" asks whether both were ALIVE at one moment; a row stamped closed
    hours after it went quiet answers yes to a question nobody asked. Measured
    on production: 48 pairs by close stamp, 24 by proof of life, over the 54
    rows whose check-in survives.
  */
  const overlapping = new Set<number>();
  for (let i = 0; i < closed.length; i += 1) {
    for (let j = i + 1; j < closed.length; j += 1) {
      const a = closed[i]!;
      const b = closed[j]!;
      if (at(b.startedAt) < lifeEndOf(a) && at(a.startedAt) < lifeEndOf(b)) {
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
      /*
        ⚠ `endedAt` AND NOT THE LIFETIME, which is the opposite of the overlap
        clause above and is the header's refusal of #2086's second half: a
        shift's own merge lands after its last heartbeat, so narrowing this
        bound sends 44% of merged PRs to `unattributed`.
      */
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
      `  ⚠ shift runs ALIVE at the same moment as another: ${reading.overlappingRunIds.join(", ")}` +
        " — up to four builder seats run per pass, so this is the design and not an anomaly." +
        " What it means is that attribution for a PR merged inside the overlap is ambiguous;" +
        " it goes to the later-starting run. Read from each run's last check-in, never from" +
        " its close stamp (#2086).",
    );
  }
  return lines.join("\n");
}
