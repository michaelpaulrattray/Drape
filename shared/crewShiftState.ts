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

/**
 * The states a run can be in, all derived from two timestamps.
 *
 * ⚠ **`stalled` describes the ROW, never the process** (issue #295). It means
 * exactly one thing: *no check-in inside the window, and no terminal stamp.*
 * Whether the shift is dead or is thirty minutes into a build this page cannot
 * see is **not knowable from here** — nothing reports process liveness to the
 * database, and a page that guesses is making a claim rather than a reading
 * (working law 1). The founder read the old copy's guess — *"It has probably
 * died"* — over a shift that had merged a PR half an hour earlier.
 *
 * So the name is kept, its meaning is narrowed, and the surface says the FACT
 * (*no check-in since HH:MM*) and lets him judge.
 */
export type CrewShiftRunState = "running" | "stalled" | "finished";

/**
 * How long a run may go without proving it is alive before the page stops
 * vouching for it.
 *
 * # ⚠ IT WAS ONE HOUR AND THAT FIRED ON ONE SHIFT IN THREE (issue #295)
 *
 * The hour was his own number in #272 — *"A row that is neither updated nor
 * stamped for an hour is itself the signal"* — written before any shift had
 * ever been timed, and the paragraph that carried it already named the risk:
 * *"a tight window would cry stalled at a shift doing exactly what it should."*
 * It did. He opened his page at 20:18 and read **"It has probably died"** over
 * a shift that had merged a PR at 19:46 and shipped a briefing edition at
 * 20:17 — one minute earlier.
 *
 * **Measured over the 83 completed runs the runner has close-stamped**
 * (`.agents/mailbox/*.md`, launch → exit, 2026-08-27 → 2026-08-30):
 *
 * | median | p75 | p90 | p95 | p99 | max |
 * |---|---|---|---|---|---|
 * | 47 min | 67 min | 88 min | 99 min | 115 min | 138 min |
 *
 * **26 of 83 — 31% — ran longer than an hour.** So the alarm was not
 * occasionally wrong, it was wrong about a third of the time, and an alarm at
 * that rate teaches him to scroll past it. The first one he then believes is
 * the false one, which costs more than having no alarm at all.
 *
 * **Three hours.** The bar is that the window must clear the longest run the
 * team has ever recorded — 138 min — measured with NO heartbeat sent at all,
 * because the heartbeat is manual and a shift may skip it; a window chosen
 * against the p99 instead would accuse the tail of legitimate shifts.
 * `server/crewHeartbeat.test.ts` pins it against that measured maximum rather
 * than against a literal, so lowering it back reddens and says why.
 *
 * ⚠ **Two hours was tried first and the arm refused it**, which is the whole
 * value of pinning a bar instead of a number: 120 < 138, so the shift that ran
 * longest would still have been called dead. The guard caught its own author.
 *
 * The ceiling is a judgement rather than a measurement and is stated out loud:
 * a window of a day would never cry wolf and would also never fire on a shift
 * that really died, so it stays inside a night.
 *
 * ⚠ **`drizzle/0055_crew_shift_runs.sql`'s header is SUPERSEDED on this point
 * and is deliberately not edited** — an applied migration is the record of what
 * ran, not a place to keep current. It says the hour is *"coarse enough that
 * the shift's own natural updates (start, close, and `--note` at any point
 * between) carry it"*, and that sentence is the whole mistake in one line: it
 * assumed the `--note` between, and there was never a caller for it. The
 * assumption is what made the hour look safe. This constant and #295 are the
 * current word; the migration is why it took a founder's own eyes to notice.
 *
 * The cost of the coarseness is unchanged and still accepted: a shift that dies
 * in its first minutes reads as running for up to the window. With the
 * heartbeat now sent at every meaningful step (#295), a live shift stamps far
 * more often than this, so the window governs only how long a genuinely dead
 * one goes unnoticed.
 */
export const CREW_SHIFT_STALL_MS = 3 * 60 * 60 * 1000;

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

/**
 * DID THIS RUN EVER CHECK IN? — one owner, because two would disagree (#295).
 *
 * `crew-shift-start.mts` stamps `heartbeatAt` equal to `startedAt` at open, so
 * a run that never sent a `--note` carries the two timestamps IDENTICAL. That
 * is the whole tell, and it is the only evidence there is that the standing
 * orders' heartbeat step was skipped.
 *
 * ⚠ **It is readable ONLY before the close write.** `crew-shift-close.mts`
 * sets `heartbeatAt` to now as it stamps the row terminal, which erases the
 * equality — so the close script reads these two fields in the statement that
 * selects the target, before it updates anything. Read afterwards, every run
 * looks like it checked in.
 *
 * A tolerance of one second absorbs the two `UTC_TIMESTAMP()` calls in the
 * insert landing either side of a tick; it is deliberately not larger, because
 * a real check-in is minutes later, never seconds.
 */
export function hasEverCheckedIn(run: {
  readonly startedAt: Date | string;
  readonly heartbeatAt: Date | string;
}): boolean {
  const started = asMillis(run.startedAt);
  const heartbeat = asMillis(run.heartbeatAt);
  /* An unreadable pair cannot prove a skipped check-in. The safe direction here
     is the OPPOSITE of the stalled verdict's: this drives a finding about a
     shift's discipline, and accusing on a broken read is the worse error. */
  if (!Number.isFinite(started) || !Number.isFinite(heartbeat)) return true;
  return heartbeat - started > 1_000;
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

/**
 * HOW RECENTLY A ROW MUST HAVE CHECKED IN TO COUNT AS *LIVE* (issue #288).
 *
 * Not the same question as `CREW_SHIFT_STALL_MS` and deliberately not derived
 * from it. That one asks *"has this row gone quiet long enough that his page
 * should stop vouching for it"* — a three-hour patience, tuned so a working
 * shift is never called dead. This one asks the opposite and much sharper
 * question: *"did somebody stamp this row so recently that a seat is almost
 * certainly mid-act on it right now?"* A number tuned for the first answers the
 * second badly in both directions.
 *
 * It is used for exactly one thing: `crew-shift-close.mts` refuses to stamp a
 * row terminal while it looks live, unless `--force` says so out loud. The
 * incident is #288's — a close typed as a READ closed a running shift's row and
 * his page went to *"Nothing running"* mid-shift.
 *
 * # ⚠ IT IS A JUDGEMENT, NOT A MEASUREMENT, AND THE REASON IS ITSELF A FINDING
 *
 * The honest bar would be measured: the gap between a shift's LAST real
 * check-in and its close, across the runs already recorded. **That gap is not
 * recoverable from any row.** `crew-shift-close.mts` sets
 * `heartbeatAt = UTC_TIMESTAMP()` in the same UPDATE that stamps `endedAt`, so
 * every closed run in `crew_shift_runs` carries a heartbeat equal to its close
 * and the real last check-in is gone. (`hasEverCheckedIn` survives that only
 * because the close reads the two fields BEFORE it writes.) So the number below
 * cannot be measured today, and saying so is better than dressing an invented
 * figure as evidence.
 *
 * What CAN be argued is the direction, and it is one-sided:
 *
 *   - it must be **shorter than the shortest run of acts between a shift's last
 *     heartbeat and its close.** The standing orders put the last heartbeat at
 *     *edition written*; after it come the deploy rite — which pushes, waits on
 *     a Railway deployment and takes three health readings, minutes at best —
 *     and the mailbox entry. Two minutes clears that comfortably.
 *   - being wrong in the other direction costs **one word.** The refusal names
 *     `--force`, so a shift that really is closing its own fresh row loses a
 *     command, not a close. That asymmetry is why a tight bar is the safe one.
 *
 * ⚠ And it fires ONLY on a row that has genuinely checked in
 * (`hasEverCheckedIn`): at open, `heartbeatAt` equals `startedAt`, so a row
 * opened a minute ago is "fresh" without anybody having stamped anything. A
 * quiet night that opens a row, finds nothing admissible and closes it is the
 * commonest short run there is, and it must not be refused.
 */
export const CREW_SHIFT_LIVE_HEARTBEAT_MS = 2 * 60 * 1000;

/**
 * Does this row look like somebody is mid-act on it?
 *
 * One owner, for the same reason `deriveShiftRunState` has one: the close
 * script guards on it and the reader script PRINTS it, and a guard whose
 * displayed value came from a second implementation would eventually disagree
 * with the refusal an operator is staring at.
 */
export function looksLive(
  run: { readonly startedAt: Date | string; readonly heartbeatAt: Date | string },
  now: number,
): boolean {
  if (!hasEverCheckedIn(run)) return false;
  const heartbeat = asMillis(run.heartbeatAt);
  /* An unreadable heartbeat is not evidence of life — same direction as
     `hasEverCheckedIn`: this drives a REFUSAL, and blocking an operator on a
     broken read is the worse error. */
  if (!Number.isFinite(heartbeat)) return false;
  return now - heartbeat <= CREW_SHIFT_LIVE_HEARTBEAT_MS;
}

/** How a run ended. Three members, exactly as #272 names them. */
export const CREW_SHIFT_OUTCOMES = ["shipped", "stopped", "failed"] as const;
export type CrewShiftOutcome = (typeof CREW_SHIFT_OUTCOMES)[number];
