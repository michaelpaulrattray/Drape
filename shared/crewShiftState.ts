/**
 * WHAT A SHIFT RUN IS DOING RIGHT NOW — derived, never stored (issue #272).
 *
 * `shared/` because the verdict has exactly ONE owner. The page draws it and
 * the shift's own tools read it; two implementations of "stalled" would drift,
 * and the first anyone would know is his page saying a dead shift is working.
 * Working law 4, applied to a definition rather than to a list.
 *
 * # WHY THERE IS NO `status` COLUMN TO READ INSTEAD
 *
 * #272's bar: *"A shift that dies without stamping its row shows as stalled,
 * not as working."* A shift that dies cannot write that it died — that is what
 * dying means — so a stored status can report every state EXCEPT the one the
 * bar is about. The two timestamps can, because silence moves them without
 * anybody writing anything.
 */

/** The four states a run can be in, all derived from two timestamps. */
export type CrewShiftRunState = "running" | "stalled" | "finished";

/**
 * How long a run may go without proving it is alive before the page calls it
 * stalled.
 *
 * **One hour, and the number is his**: #272 says *"A row that is neither
 * updated nor stamped for an hour is itself the signal."* It is deliberately
 * coarse — a shift legitimately spends a long time inside one build, a test
 * run or a deploy watch, and a tight window would cry stalled at a shift doing
 * exactly what it should. The cost of the coarseness is that a shift that dies
 * in its first minutes reads as running for up to an hour; the cost of the
 * opposite error is that he stops trusting the strip, which is worse.
 */
export const CREW_SHIFT_STALL_MS = 60 * 60 * 1000;

/** The two fields the verdict is derived from — nothing else is consulted. */
export type CrewShiftRunTimes = {
  readonly heartbeatAt: Date | string;
  readonly endedAt: Date | string | null;
};

/** Dates cross the wire as ISO strings through tRPC's serializer; both are accepted. */
function asMillis(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * The verdict.
 *
 * `now` is a PARAMETER rather than a `Date.now()` inside, so the states are
 * drivable in a test without freezing a clock — the "stalled" arm is the whole
 * point of this function and it must be reachable directly (working law 3: a
 * backstop needs a test the model cannot rescue).
 *
 * ⚠ `endedAt` wins over everything. A finished run is finished however old its
 * heartbeat is — otherwise every run in the "last three shifts" list would read
 * as stalled the moment it aged past an hour, which is all of them.
 */
export function deriveShiftRunState(run: CrewShiftRunTimes, now: number): CrewShiftRunState {
  if (run.endedAt !== null && run.endedAt !== undefined) return "finished";

  const heartbeat = asMillis(run.heartbeatAt);
  /* An unparseable heartbeat is not evidence of life. It reads as stalled —
     the safe direction is the one that makes him look, not the one that says
     everything is fine. */
  if (!Number.isFinite(heartbeat)) return "stalled";

  return now - heartbeat > CREW_SHIFT_STALL_MS ? "stalled" : "running";
}

/** The seats that may open a run — the same list `PROGRAM.md` names. */
export const CREW_SHIFT_SEATS = ["foreman", "janitor", "warden", "machinist", "retro"] as const;
export type CrewShiftSeat = (typeof CREW_SHIFT_SEATS)[number];

/**
 * What KIND of work a run is, and it is a closed vocabulary because #277 keys
 * on it.
 *
 * - `focus` — the confirmed milestone in `PROGRAM.md`.
 * - `sidelane` — a founder-authorised lane beside the focus (the lobby redesign).
 * - `patrol` — a seat's clock fired.
 * - `maintenance` — a founder-specified card that is not the focus.
 * - `background` — the bounded list behind his switch (#277). **This member is
 *   the one with a gate on it**: the start script refuses to open a
 *   `background` run while his master switch is off.
 */
export const CREW_SHIFT_WORK_KINDS = ["focus", "sidelane", "patrol", "maintenance", "background"] as const;
export type CrewShiftWorkKind = (typeof CREW_SHIFT_WORK_KINDS)[number];

/** How a run ended. Three members, exactly as #272 names them. */
export const CREW_SHIFT_OUTCOMES = ["shipped", "stopped", "failed"] as const;
export type CrewShiftOutcome = (typeof CREW_SHIFT_OUTCOMES)[number];
