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

import { crewPipelineRowIsDone } from "./crewPipelineStatus";

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
 * **Three hours.** ~~The bar is that the window must clear the longest run the
 * team has ever recorded — 138 min — measured with NO heartbeat sent at all,
 * because the heartbeat is manual and a shift may skip it; a window chosen
 * against the p99 instead would accuse the tail of legitimate shifts.~~
 * ⚠ **That bar is SUPERSEDED by road A below (#2118, ruled by the relay
 * 2026-10-09): the window now clears the p99, not the all-time maximum** —
 * read the last section of this block for why the maximum was the wrong bar.
 * The struck sentence stays because it is what three hours was chosen against.
 * `server/crewHeartbeat.test.ts` pins the window against the measured bar
 * rather than against a literal, so lowering it back reddens and says why.
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
 *
 * # ⚠ RE-READ ON THE HONEST FIELD, 2026-10-09 (#2086) — AND THE FIELD WAS
 * ALREADY THE HONEST ONE, WHICH IS THE OPPOSITE OF WHAT THAT CARD ASSUMED
 *
 * #2086 was filed on the belief that the figures above are stamp-to-stamp
 * durations — *"`CREW_SHIFT_STALL_MS` … was set from a measurement quoted in
 * its own docblock … Those are stamp-to-stamp durations, so the input to the
 * constant is the inflated figure."* **Read at the artifact, it is not.** The
 * provenance line four paragraphs up names `.agents/mailbox/*.md`, `exit:`
 * minus `shift launched` — the runner's own `## Runner close-stamp` trailer,
 * written after that shift's PROCESS exited (#101). That is a real process
 * lifetime, not a `crew_shift_runs.endedAt` stamp, and no later shift can move
 * it. Re-measured from those trailers in the stated window: **85 entries, all
 * 85 at exit code 0, median 46, max 138** — the same maximum the bar in
 * `server/crewHeartbeat.test.ts` is pinned against.
 *
 * It is also the only field that can answer this question, in either reading.
 * The silence the window measures begins at a shift's last check-in and ends
 * when somebody notices; a shift that never checks in is silent from
 * `startedAt` for as long as its PROCESS lives, and nothing in the database
 * records a process exit. `endedAt` over-reports it (a late close) and
 * `heartbeatAt` cannot see the gaps inside a live run at all.
 *
 * # ⚠ WHAT THE FRESH READING DOES CHANGE, AND IT IS A DECISION RATHER THAN A
 * REPAIR — SO IT IS NAMED HERE AND NOT MADE
 *
 * The same trailers over the whole history, all-time, exit code 0:
 *
 * | n | median | p90 | p95 | p99 | max |
 * |---|---|---|---|---|---|
 * | 589 | 58 min | 102 min | 123 min | 155 min | **247 min** |
 *
 * **The bar this constant is pinned against — *clear the longest run the team
 * has ever recorded* — no longer holds.** 16 of 589 runs exceed the 138 that
 * suite quotes, and **3 of 589 (0.5%) exceed the three-hour window itself**, so
 * those three would have been drawn as stalled while alive.
 * `LONGEST_RECORDED_SHIFT_MINUTES` there is deliberately NOT bumped to 247 in
 * this commit: the arm would go red, exactly as it did when two hours was
 * tried, and the only way to green it is to move this number — which is a
 * judgement about what his page says, not a repair.
 *
 * Both directions cost something and neither is free: a longer window lets a
 * genuinely dead row sit vouched-for for longer (the #548 and #607 incidents
 * are what that costs), and the present window mislabels about one run in two
 * hundred. **0.5% is far from the 31% that made the hour untenable**, so
 * nothing here is urgent and the number stands until the founder or the relay
 * rules on it.
 *
 * # ✅ RULED: ROAD A — THE WINDOW STAYS AT THREE HOURS AND THE BAR MOVES TO
 * THE p99 (#2118, ruled by the relay 2026-10-09)
 *
 * The section above left a vice in `server/crewHeartbeat.test.ts`: one arm
 * needed the window above the longest run ever recorded (248 min by then), the
 * other capped it at four hours (240 min), and no window satisfies both. Three
 * roads were put up — A, re-base the bar on a percentile and leave the window;
 * B, raise the window to 3½ hours and exclude runner recoveries from the bar;
 * C, raise the four-hour ceiling past 248. **The relay ruled A**, verbatim in
 * part: *"A window sized to the all-time max can never catch a dead shift
 * inside the range shifts actually run in. The errors are also not symmetric:
 * a false* stalled *costs one glance, while a false* running *is the #548 /
 * #607 defect."*
 *
 * Re-read when this was built (not quoted from #2118, because the population
 * grows every shift): the same `## Runner close-stamp` trailers, exit code 0,
 * `exit:` minus `shift launched`, **594 runs — median 58, p95 124, p99 161
 * (nearest rank), max 248**; 3 of 594 exceed three hours (207, 209, 248). The
 * suite's bar is now that p99, with its reasoning in its own body. **Nothing
 * this constant does changed** — it was three hours before the ruling and is
 * three hours after it; what changed is the question the suite asks of it.
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
 * ✅ **IT IS READABLE ON A CLOSED ROW AGAIN — #1872, 2026-10-03.** This
 * paragraph read *"readable ONLY before the close write"* and described a real
 * hazard: `crew-shift-close.mts` set `heartbeatAt` to now as it stamped the row
 * terminal, so afterwards every run looked like it checked in. **The write is
 * gone** — nothing had ever read a closed row's heartbeat to decide anything
 * (the census is beside that script's own SELECT), and it was born redundant in
 * the same commit as `deriveShiftRunState`'s *`endedAt` wins* clause. The close
 * still reads these two fields in the statement that selects its target, which
 * is now ordinary care rather than the only road to the answer.
 *
 * ⚠ **AND IT IS STILL UNREADABLE ON EVERY ROW CLOSED BEFORE THAT CHANGE.** The
 * repair cannot reach the record: **565 of 565 rows closed up to 2026-10-03
 * carry `heartbeatAt == endedAt`**, so this function answers `true` for all of
 * them whatever their shift actually did. There is no proxy for THIS question —
 * a row's lifetime cannot distinguish a disciplined shift from a silent one —
 * so a history read of check-in discipline starts at the first row closed after
 * that date and says so.
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
 * check-in and its close, across the runs already recorded. **That gap was not
 * recoverable from any row, and from 2026-10-03 it is recorded again (#1872).**
 * `crew-shift-close.mts` used to set `heartbeatAt = UTC_TIMESTAMP()` in the same
 * UPDATE that stamped `endedAt`, so every closed run carried a heartbeat equal
 * to its close and the real last check-in was gone; that write is removed, and
 * a row closed after that date carries the real gap.
 *
 * ⚠ **SO THIS NUMBER IS STILL A JUDGEMENT TODAY, AND IT IS NOW A JUDGEMENT WITH
 * AN EXPIRY RATHER THAN A PERMANENT ONE.** The rows that could answer it did
 * not exist when it was set: **565 of 565 rows closed up to 2026-10-03 are
 * blind** to the question. Re-reading it is a measurement a later seat can
 * actually take — `endedAt - heartbeatAt` over the rows closed after that
 * date — and the direction below is what to re-argue it against, not to
 * replace. Until there are enough of them, saying this is a judgement is still
 * better than dressing an invented figure as evidence.
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

/* ── A DEAD ROW'S ROAD OUT OF ITSELF (#1863) ──────────────────────────────── */

/**
 * THE LANE A SHIFT ID BELONGS TO — the launcher, with its run stamp dropped.
 *
 * `seat1-20261003-174138` and `seat1-20261004-040542` are two sessions of ONE
 * launcher; `foreman-118` and `foreman-20261004-0320` are two of another. The
 * stamp is whatever the runner put on the end — eight-and-four or
 * eight-and-six digits today, a plain counter for the first 94 rows, sometimes
 * a trailing letter — so the lane is what is LEFT once a trailing
 * `-<digits>[-<digits>][letter]` comes off.
 *
 * ⚠ **IT IS A CONVENTION AND THEREFORE WRONG SOMETIMES, WHICH IS WHY THE
 * VERDICT BELOW IS BUILT ON THE SAME GROUPING RATHER THAN BESIDE IT.** Both
 * directions of error come out as SILENCE:
 *
 *   - **over-grouping** (two launchers that really do run at once read as one
 *     lane) puts their overlapping sessions inside the window, and the verdict
 *     withholds;
 *   - **under-grouping** (a lane split into singletons — `219`,
 *     `fable-531-stripe-domain` and `warden` each read as their own lane today)
 *     leaves no lane-mates to find, and the verdict withholds.
 *
 * Silence is exactly what a shift gets today, so a mis-parsed id costs nothing
 * it was not already paying. Measured on the 562 real rows the day this landed:
 * 14 lanes — `foreman` 438, `seat1` 76, `fable` 16, `seat2` 13, `janitor` 7,
 * `retro`/`machinist`/`seat3` 2 each, and six singletons.
 */
export function shiftLaneOf(shift: string): string {
  const trimmed = shift.trim();
  const lane = trimmed.replace(/-\d{1,8}(-\d{1,6})?[a-z]?$/i, "");
  /* An id that is NOTHING but a stamp (`-123`) keeps its whole self rather than
     becoming the empty lane every other such id would also join. */
  return lane.length > 0 ? lane : trimmed;
}

/**
 * HOW MANY COMPLETED LANE-MATES IT TAKES, AND THE NUMBER IS MEASURED (#1863).
 *
 * Not a judgement like `CREW_SHIFT_LIVE_HEARTBEAT_MS` above. It was read off
 * the whole recorded history by driving the verdict over all 561 closed rows,
 * counting the rows it would have called DEAD using only lane-mates that opened
 * and closed entirely inside that row's own lifetime — every one of which was
 * demonstrably alive at the time, so every hit is a false positive:
 *
 *   - **floor 1 → 3 hits**, and the extra one is **#360**
 *     (`foreman-20260925-1649`), which was alive while **#361** ran beside it.
 *     That is the #1234 incident — two Foreman seats genuinely at once — and it
 *     is precisely the row a death verdict must never be given about.
 *   - **floor 2 → 2 hits**, and both were in fact DEAD: **#548**, this card's
 *     own subject, and **#549**, the power-cut death that was closed on the
 *     relay's written confirmation. Zero genuine false positives.
 *   - **floor 3 → 1 hit**, losing #549 — a true verdict — and buying nothing
 *     the record can show.
 *
 * So 2 is the smallest floor that clears the only false positive the history
 * contains. `server/crewRunSupersession.test.ts` carries all three rows as
 * fixtures, the living one as the negative control.
 *
 * # ⚠ THE MEASUREMENT USED A PROXY, AND RE-TAKING IT MUST USE THE SAME ONE
 *
 * Read the clause above carefully: the floor was counted from each row's own
 * **LIFETIME** (`startedAt` → `endedAt`), while the verdict below opens its
 * window at the row's last check-in (`heartbeatAt`). **Those are two different
 * windows, and on every row closed before 2026-10-03 they had to be** — the
 * close script overwrote `heartbeatAt` with the close instant, so 565 of 565
 * closed rows record a silence that began when they ended, i.e. none at all.
 * Read at that field, the whole history returns **0 superseded rows in 565**,
 * which is the instrument answering a question the record could no longer hold
 * (#1872; the first pass of #1866's measurement did exactly that).
 *
 * The proxy is **conservative in the useful direction** and that is why it was
 * admissible: a real last check-in is at or after `startedAt`, so the lifetime
 * window is a SUPERSET of the heartbeat window and admits at least as many
 * lane-mates — it can over-report a hit, never hide one. A floor chosen against
 * an over-reporting window is therefore at least high enough.
 *
 * **So: a history read spanning rows closed before 2026-10-03 uses the lifetime
 * proxy and says so. A read over rows closed after it should use `heartbeatAt`,
 * because the write that destroyed the field is gone and those rows carry the
 * real answer.** Re-reading this floor on the real field is a measurement a
 * later seat can take; it was not available when the number was set.
 */
export const CREW_SHIFT_SUPERSEDING_RUNS_MIN = 2;

/** What the reading needs off a lane-mate — nothing it could write with. */
export type LaneRunForSupersession = {
  readonly id: number;
  readonly shift: string;
  readonly startedAt: Date | string;
  readonly endedAt: Date | string | null;
  /**
   * Its last check-in, which is where its TRUSTWORTHY life ends — see
   * {@link laneRunLastProofOfLife}. Optional because a caller that cannot
   * supply it gets exactly the reading this file had before #2079.
   */
  readonly heartbeatAt?: Date | string | null;
};

/**
 * WHEN A LANE-MATE WAS LAST KNOWN TO BE ALIVE — and it is NOT `endedAt` (#2079).
 *
 * # The defect, in the words of the two shifts that met it
 *
 * Row **#607** sat on his Working-now table reading as a live shift for **ten
 * hours**, and two consecutive shifts each read the verdict below, correctly
 * declined to stamp it, and left it. The line they were given was:
 *
 * > *3 later `seat1` sessions have closed since it went quiet, but #612 and
 * > #615 overlapped each other — this lane was running two at once inside the
 * > silence, so a completed lane-mate proves nothing about this row.*
 *
 * **They did not overlap.** Read at the rows:
 *
 *   * **#612** last proved it was alive at **15:36:19** and was stamped closed
 *     at **17:20:26 — 104 minutes later**, by a different shift. (Its own log
 *     ends *"You've hit your session limit"*; it was dead the whole time.)
 *   * **#615** opened at **16:24:33** — forty-eight minutes AFTER #612 went
 *     quiet, and fifty-six minutes BEFORE #612's close stamp.
 *
 * So the pair overlaps by the close STAMP and not by any life. The lane was
 * running one at a time throughout, which is exactly what the verdict needed.
 *
 * # ⚠ THE FIELD IT WAS READING IS ONE THIS FILE ALREADY CALLS POISONED
 *
 * `readRunSupersession`'s own header rejected the lane's whole history as a
 * test for precisely this reason — *"`crew-shift-close.mts` stamps
 * `endedAt = UTC_TIMESTAMP()`, so a dead row closed hours late carries a
 * lifetime it never had"* — and it protected the window's START bound against
 * that artifact. **The overlap clause then read the same poisoned field.** One
 * half of the reading was defended and the other was not, which is why the
 * instrument could be blinded by a late close three rows away.
 *
 * # What this returns, and the one case it refuses to sharpen
 *
 * A session's trustworthy life ends at its **last check-in**: the heartbeat is
 * written by the shift itself, so it is a positive proof of life, where
 * `endedAt` is a stamp anybody may apply at any later hour.
 *
 * ⚠ **A lane-mate that NEVER checked in falls back to `endedAt`, which is the
 * reading as it was.** A row with no check-in carries `heartbeatAt ===
 * startedAt`, so reading it literally would collapse its life to a single
 * instant and it could never overlap anything — and a silent shift that really
 * did run beside this row for forty minutes is exactly the concurrency the
 * clause exists to see. No information is no licence to sharpen.
 *
 * # ⚠ IT CANNOT MOVE A VERDICT ABOUT AN OLD ROW, BY CONSTRUCTION
 *
 * Until 2026-10-03 the close overwrote `heartbeatAt` with the close instant, so
 * **565 of the 616 closed rows carry `heartbeatAt === endedAt`** and the two
 * readings are the same number on every one of them. Only the 51 rows closed
 * since can differ at all.
 *
 * # The measurement, because this change can only ever ADD death verdicts
 *
 * Shorter lifetimes mean fewer overlaps mean more rows called dead, which is
 * #288's dangerous direction. So the floor's own false-positive hunt was
 * re-taken over all **619** recorded rows under both readings, by this file's
 * own standard — *a death verdict resting on lane-mates that opened AND closed
 * while the subject was demonstrably alive is wrong by construction*:
 *
 *   * **today's reading: 2 hits.** #548 and #549 — the two recorded TRUE
 *     deaths this header already names.
 *   * **this reading: the same 2 hits, and no others.** The repair adds no
 *     false positive anywhere in the history.
 *   * **#360, the one row the record proves was ALIVE, stays withheld** under
 *     both — it had one lane-mate and the floor is two.
 *   * **no death verdict is lost**: 0 rows go from superseded to unreadable.
 *   * and #607, the subject, moves from *not readable* to **superseded by
 *     #610, #612 and #615** — which is what the card asked for.
 */
export function laneRunLastProofOfLife(run: LaneRunForSupersession): number {
  const ended = run.endedAt === null || run.endedAt === undefined ? NaN : asMillis(run.endedAt);

  if (run.heartbeatAt === null || run.heartbeatAt === undefined) return ended;
  const heartbeat = asMillis(run.heartbeatAt);
  if (!Number.isFinite(heartbeat)) return ended;
  /*
    No check-in is no information — see the ⚠ above.

    ⚠ **AND THIS LINE IS ALSO WHY THERE IS NO `Math.max(startedAt, …)` BELOW,
    which the sabotage pass is what established.** A `Math.max` guard was
    written here against a row whose heartbeat predates its own start, it
    survived deletion with the suite entirely green, and the reason is that it
    could never fire: `hasEverCheckedIn` is false unless the heartbeat is more
    than a second AFTER the start, so anything reaching the return is already
    ordered. A guard no fixture can ask about is either an uncovered line or a
    dead one, and this one was dead.
  */
  if (!hasEverCheckedIn({ startedAt: run.startedAt, heartbeatAt: run.heartbeatAt })) return ended;
  return heartbeat;
}

export type RunSupersession =
  | {
      readonly kind: "superseded";
      readonly lane: string;
      readonly by: readonly LaneRunForSupersession[];
    }
  | { readonly kind: "unreadable"; readonly lane: string; readonly why: string };

/**
 * IS THIS OPEN ROW'S PROCESS DEAD? — the one positive answer there is (#1863).
 *
 * # The gap this closes, in the words of the four shifts that met it
 *
 * A builder seat's row (#548) stopped checking in at 08:07Z and then sat on his
 * **Working now** table reading as a live shift for **9.5 hours**. Four
 * consecutive Foreman shifts met it and **all four declined to close it**, each
 * for the same entirely correct reason: `--id` is for a dead shift's row, and
 * stamping a LIVE seat's row terminal is #288's measured defect — *"no written
 * confirmation of that seat's death exists."* The fourth wrote that three
 * declines in a row was itself the finding: *"either the row is dead and
 * nothing can say so, or the rule needs a road for exactly this case."*
 *
 * **The safe act and the correct act pointed in opposite directions, because
 * nothing in the product could tell a shift which row it was looking at.**
 *
 * # ⚠ IT IS NOT A TIMEOUT, AND THAT IS THE WHOLE DESIGN
 *
 * Reading SILENCE as death is the defect, not the fix — `CREW_SHIFT_STALL_MS`
 * is three hours against a measured p99 shift of 161 minutes and a longest of
 * 248 (re-read 2026-10-09, #2118), and a shift that
 * is merely slow is exactly the row #288 says must not be stamped terminal. So
 * this reads a **POSITIVE** fact instead: *later sessions of the same launcher
 * opened AND CLOSED while this row sat silent.* A launcher that was running one
 * session at a time, repeatedly, through the whole of that silence was not also
 * running this row.
 *
 * # ⚠ THE FIRST DESIGN WAS THE LANE'S WHOLE HISTORY AND IT WAS DEAD ON ARRIVAL
 *
 * The natural test — *"this lane has never run two sessions at once"* — was
 * written, measured, and thrown away, and the measurement is the reason:
 *
 *   - `crew-shift-close.mts` stamps `endedAt = UTC_TIMESTAMP()`, so a dead row
 *     closed hours late carries a lifetime it never had. **Closing #548 on the
 *     measurement that proved it dead put FIVE overlapping pairs into the
 *     `seat1` lane** — so the test that produced #548's verdict could never
 *     have produced it again. An instrument that poisons its own evidence by
 *     being used is not an instrument.
 *   - the `foreman` lane carries 5 such pairs across 438 rows, two of them the
 *     same artifact from row #549, so the biggest lane would have been
 *     disqualified for good.
 *
 * **The window test cannot be poisoned that way**: it reads only sessions that
 * started AFTER this row went quiet, and an older late-closed row started
 * before it. Driven on the real rows it answers both recorded deaths correctly
 * — #548 on the `seat1` lane, #549 on `foreman` — and stays silent on #360,
 * which was alive.
 *
 * # What it will not say
 *
 * Nothing at all about a row that `looksLive`: a death verdict printed beside
 * the refusal an operator is about to meet is the contradiction this file's own
 * header warns about. The two cannot both hold in practice — two complete
 * sessions do not fit inside two minutes — so the clause costs no real verdict
 * and removes the confusing state by construction.
 *
 * ⚠ **It answers, it never acts.** The judgement and the close stay with the
 * shift, which then cites this line; there is no automatic write and no new
 * authority anywhere. That is the card's own shape, and it is why a reading
 * that is sometimes silent is an acceptable instrument.
 */
export function readRunSupersession(input: {
  readonly run: {
    readonly id: number;
    readonly shift: string;
    readonly startedAt: Date | string;
    readonly heartbeatAt: Date | string;
  };
  readonly runs: readonly LaneRunForSupersession[];
  readonly now: number;
}): RunSupersession {
  const lane = shiftLaneOf(input.run.shift);

  if (looksLive(input.run, input.now)) {
    return {
      kind: "unreadable",
      lane,
      why: "it checked in inside the live window, so it is not a dead row to read",
    };
  }

  /* Silence runs from the last check-in. A row that never checked in carries
     `heartbeatAt === startedAt` (see `hasEverCheckedIn`), so the same field is
     the right one either way. */
  const silentSince = asMillis(input.run.heartbeatAt);
  if (!Number.isFinite(silentSince)) {
    return {
      kind: "unreadable",
      lane,
      why: "its own last check-in does not parse, so there is no window to read",
    };
  }

  const inWindow = input.runs
    .filter((candidate) => {
      if (candidate.id === input.run.id) return false;
      if (shiftLaneOf(candidate.shift) !== lane) return false;
      if (candidate.endedAt === null || candidate.endedAt === undefined) return false;
      const started = asMillis(candidate.startedAt);
      const ended = asMillis(candidate.endedAt);
      if (!Number.isFinite(started) || !Number.isFinite(ended)) return false;
      return started > silentSince;
    })
    .sort((a, b) => asMillis(a.startedAt) - asMillis(b.startedAt));

  if (inWindow.length < CREW_SHIFT_SUPERSEDING_RUNS_MIN) {
    return {
      kind: "unreadable",
      lane,
      why:
        `only ${inWindow.length} later \`${lane}\` session${inWindow.length === 1 ? " has" : "s have"}`
        + ` opened and closed since it went quiet, and the floor is ${CREW_SHIFT_SUPERSEDING_RUNS_MIN}`
        + " — row #360 was alive while exactly one lane-mate ran beside it",
    };
  }

  /* ⚠ The lane must have been running ONE AT A TIME inside the window, and this
     is the clause that stops a genuinely concurrent launcher reading as a
     serial one. Measured on the same window the verdict rests on, never on the
     lane's whole history — see the paragraph above for why.

     ⚠ **AND THE END OF A LANE-MATE'S LIFE IS ITS LAST CHECK-IN, NOT ITS CLOSE
     STAMP (#2079)** — `laneRunLastProofOfLife`, whose header carries the
     measurement. Reading `endedAt` here made a row closed 104 minutes after it
     died "overlap" the session that started 48 minutes into that silence, and
     a single late close three rows away blinded this verdict for ten hours. */
  for (let index = 1; index < inWindow.length; index++) {
    const previous = inWindow[index - 1]!;
    const current = inWindow[index]!;
    if (asMillis(current.startedAt) < laneRunLastProofOfLife(previous)) {
      return {
        kind: "unreadable",
        lane,
        why:
          `${inWindow.length} later \`${lane}\` sessions have closed since it went quiet, but #${previous.id}`
          + ` and #${current.id} were both alive at once — #${current.id} opened while #${previous.id} was`
          + " still checking in, so this lane was running two at once inside the silence and a completed"
          + " lane-mate proves nothing about this row",
      };
    }
  }

  return { kind: "superseded", lane, by: inWindow };
}

/**
 * HOW LONG AGO, IN WORDS — one owner, because it already had two (#1866).
 *
 * This was a local `ago()` inside `crew-shift-state.mts` and the seat cut needed
 * the same sentence, which is the moment a second copy gets written (working law
 * 4). It is here rather than there because `crew-shift-state.mts` is a command
 * and the cut cannot import one.
 *
 * ⚠ **An unreadable time says so rather than printing a number.** A fixture row
 * carries no dates at all (`.agents/foreman/drive-runner-seats-1281.ps1` writes
 * `{ shift, cardRef }`), and `NaN min ago` in a sentence a relay acts on is
 * worse than an admission.
 */
export function describeShiftAge(value: Date | string | null | undefined, now: number): string {
  if (value === null || value === undefined) return "(unreadable)";
  const ms = now - asMillis(value);
  if (!Number.isFinite(ms)) return "(unreadable)";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return `${Math.max(0, Math.round(ms / 1000))}s ago`;
  if (minutes < 90) return `${minutes} min ago`;
  return `${(minutes / 60).toFixed(1)} h ago`;
}

/** What the collision sentence needs off a colliding row. Nothing to write. */
export type CollidingShiftRun = {
  readonly shift: string;
  readonly startedAt?: Date | string | null;
  readonly heartbeatAt?: Date | string | null;
  /**
   * The #1863 verdict for this row, when the caller read it — `undefined` when
   * it did not, which is a different sentence from a verdict that came back
   * `unreadable` and is kept apart from it here.
   */
  readonly supersession?: RunSupersession | null;
};

/**
 * WHY A CARD IS NOT ON OFFER, AS A FACT RATHER THAN A CLAIM (#1866).
 *
 * # The sentence this replaces, and what it cost
 *
 * `scripts/cut-seat-batches.mts` withheld every card an open shift row names —
 * correct, and the one guard that stops two seats building one card (#608). What
 * it WROTE about the withholding was *"a seat is sitting on it right now"*, and
 * that is a claim no reader of this file can make: row #548 named #1807 and
 * stayed open for **9.5 hours after its process died**, so for nine of those
 * hours the pass digest told the relay a seat was on a card nobody was on.
 * Nobody looked, because a dead row's collision read exactly like a live one.
 *
 * # ⚠ IT CHANGES WHAT IS SAID AND NOT WHAT IS OFFERED, AND THAT IS DELIBERATE
 *
 * The tempting repair is to let the cut OFFER a card whose only holder is a dead
 * row. It was measured before it was written, over the real rows, and it is not
 * worth having: across all 565 recorded runs exactly two would ever have been
 * called superseded while open, they withheld their cards for 7.42 hours after
 * the verdict became available, and **6.99 of those 7.42 hours were already
 * withheld by a live `CLAIMED` comment** that the board reads anyway — #1807's
 * own window recovers 0.00 h. Twenty-six minutes over the product's whole
 * history is not a reason to change what four autonomous sessions are handed
 * with no human in the loop, on the guard whose failure costs a wasted seat and
 * a conflicting branch.
 *
 * **The recovery that is actually worth having needs no new authority: somebody
 * CLOSES the dead row.** That recovers the whole window AND clears the false
 * sentence from his Working-now table — and it only ever happens if the pass
 * digest says the row is dead, which is what this sentence now does.
 *
 * `deriveShiftRunState` is the reading, not `looksLive`: the live window is two
 * minutes and drives a REFUSAL, so a seat quietly building for half an hour
 * would read as not-live and the sentence would cry wolf on every pass. The
 * three-hour stall window is the one his own page uses.
 */
export function describeCardCollision(runs: readonly CollidingShiftRun[], now: number): string {
  if (runs.length === 0) return "no open shift row names it";
  const parts = runs.map((run) => {
    const state = deriveShiftRunState({ heartbeatAt: run.heartbeatAt ?? "", endedAt: null }, now);
    /* A row whose `heartbeatAt` has never moved off `startedAt` has not checked
       in at all, and saying "last check-in 4 min ago" about it would be reading
       the OPEN as a check-in (#295's own tell). */
    const everCheckedIn = run.startedAt !== null && run.startedAt !== undefined
      && run.heartbeatAt !== null && run.heartbeatAt !== undefined
      && hasEverCheckedIn({ startedAt: run.startedAt, heartbeatAt: run.heartbeatAt });
    const when = everCheckedIn
      ? `last check-in ${describeShiftAge(run.heartbeatAt, now)}`
      : `no check-in yet, opened ${describeShiftAge(run.startedAt, now)}`;
    const dead = run.supersession?.kind === "superseded"
      ? ` — ⚠ its process is DEAD: ${run.supersession.by.length} later \`${run.supersession.lane}\``
        + " sessions opened AND closed while it sat silent, so this row needs closing"
      : "";
    return `${run.shift} (${state}, ${when})${dead}`;
  });
  return `an open shift row names it: ${parts.join("; ")}`;
}

/**
 * THE ONE SENTENCE BOTH READERS PRINT.
 *
 * One owner for the same reason the verdict has one: `crew-shift-state.mts` and
 * the open-run warning inside `crew-shift-start.mts` are the two places a shift
 * MEETS a stale row, and a shift citing this line on a card is quoting it. Two
 * wordings would be two citations of one fact.
 */
export function describeRunSupersession(verdict: RunSupersession): string {
  if (verdict.kind === "unreadable") return `supersession: not readable — ${verdict.why}.`;
  const ids = verdict.by.map((run) => `#${run.id}`).join(", ");
  return (
    `⚠ SUPERSEDED — its process is dead. ${verdict.by.length} later sessions in the \`${verdict.lane}\` lane`
    + ` opened AND closed while this row sat silent (${ids}), none overlapping another, so that launcher was`
    + " running one session at a time while this row still claimed to be running."
  );
}

/**
 * IS ANOTHER OPEN RUN ALREADY ON THIS CARD? (#608)
 *
 * Two seats worked the same founder reply three minutes apart, and the only
 * thing that caught it was a merge conflict at push time — roughly forty
 * minutes of a session spent on work already merged. The shift row that would
 * have said so was WRITTEN by both and READ by neither: invariant 7's shape,
 * a control invoked only by a human who already suspects something.
 *
 * ⚠ **LIVENESS IS DELIBERATELY NOT CONSULTED, AND THAT IS THE WHOLE DESIGN
 * DECISION HERE.** The obvious instrument is `looksLive` above, and it would
 * NOT have fired on the incident this exists for: the other seat's row was
 * three minutes old and had never checked in, so `hasEverCheckedIn` — and
 * therefore every liveness test in this file — reads it as not live. A guard
 * that cannot fire on its own origin incident is not a guard.
 *
 * **An OPEN row naming a card is the declaration.** That is what a shift
 * writes it for, and it is true from the instant it is written.
 *
 * The stale-row objection is real and is answered by the OVERRIDE rather than
 * by narrowing the reading: a dead shift's row costs the next shift one flag,
 * never a night. That is the same asymmetry `CREW_SHIFT_LIVE_HEARTBEAT_MS`
 * argues for one screen up — being wrong toward refusing costs a word, being
 * wrong toward silence costs a session.
 */
export const CARD_REF_STORED_LENGTH = 64;

function normaliseCardRef(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  /* ⚠ TRUNCATE FIRST, AND TO THE LENGTH THE COLUMN ACTUALLY HOLDS.
     `crew-shift-start.mts` stores `--card` as `.slice(0, 64)`; comparing the
     UNTRUNCATED argument against the truncated row means two seats declaring
     the same long free-text ref normalise differently and never collide. That
     is silent on exactly the class this guard defends — a founder-reply
     description rather than a `#NNN`, which is the origin incident's own shape
     (found by the PR #691 review). Both sides see what the column can hold. */
  const trimmed = raw.slice(0, CARD_REF_STORED_LENGTH).trim();
  if (!trimmed) return null;
  /* `#535`, `535`, `#535 ` and `#0535` are one card. Anything else compares as
     itself, lowercased, rather than being dropped — a card ref this cannot
     parse is still worth colliding on. */
  const numbered = trimmed.match(/^#?(\d+)$/);
  if (!numbered) return trimmed.toLowerCase();
  /* Leading zeros are dropped so `#0608` and `#608` are the same card. Guarded
     on length because past 15 digits `Number` stops being exact, and a ref that
     long is not a card number anyway. */
  const digits = numbered[1]!;
  return digits.length <= 15 ? `#${Number(digits)}` : `#${digits}`;
}

/** The open runs already naming this card. Empty when the card is absent. */
export function findCardCollisions<T extends { readonly cardRef: string | null }>(
  openRuns: readonly T[],
  cardRef: string | null | undefined,
): T[] {
  const mine = normaliseCardRef(cardRef);
  if (mine === null) return [];
  return openRuns.filter((run) => normaliseCardRef(run.cardRef) === mine);
}

/** How a run ended. Three members, exactly as #272 names them. */
export const CREW_SHIFT_OUTCOMES = ["shipped", "stopped", "failed"] as const;
export type CrewShiftOutcome = (typeof CREW_SHIFT_OUTCOMES)[number];

/* ── WHOSE ROW A BARE CLOSE CLOSES (#1234) ─────────────────────────────────── */

/** What the resolver needs off an open run — nothing about time, nothing to write. */
export type OpenRunForClose = {
  readonly id: number;
  readonly shift: string;
  readonly seat: string;
  readonly intent: string;
};

export type CloseTargetVerdict =
  | { readonly kind: "one"; readonly run: OpenRunForClose; readonly how: "the shift id" | "the only open run" }
  | { readonly kind: "refuse"; readonly why: string };

function describeRun(run: OpenRunForClose): string {
  return `#${run.id} ${run.shift} (${run.seat}) — ${run.intent}`;
}

/**
 * ⚠ **A BARE CLOSE USED TO CLOSE THE *NEWEST* OPEN RUN, WHICH IS SOMEBODY'S ROW
 * AND NOT NECESSARILY YOURS (#1234).**
 *
 * Measured, 2026-09-25. Row **#360** (`foreman-20260925-1649`) was open from
 * 06:50Z. A second Foreman seat opened row **#361** at 07:45Z. At 07:55Z the
 * first shift ran `crew-shift-close` with no `--id` and the `ORDER BY id DESC
 * LIMIT 1` closed **#361**, stamping the wrong seat's row with the first
 * shift's note while that seat was still mid-shift on a `founder-ordered` card.
 * Its row left his page carrying a false sentence and nothing said so.
 *
 * ⚠ **The existing guard cannot catch it and that is not a gap in the guard.**
 * `looksLive` refuses a row that checked in within the last couple of minutes —
 * a live seat that is simply building looks identical to a dead one, so there is
 * no time-based reading that separates them.
 *
 * **So the default is removed rather than documented harder.** A shift already
 * passes `--shift <id>` at start; passing it at close names its OWN row, which
 * is the only row a shift ever wants. With nothing named:
 *
 *   - exactly one open run  → close it. The single-seat night stays one command.
 *   - more than one         → REFUSE, naming every open run, because a guess
 *                             here is a false sentence on his page.
 *   - none                  → refuse; the finding is that this shift never
 *                             opened a row.
 *
 * ⚠ **It fails toward REFUSING, and the cost of that direction is one re-run
 * with a flag** — against a row on his Working-now table saying a seat stopped
 * when it had not, which is #288's incident with a different cause.
 *
 * `--id` does not come here: it reads a row by id whether open or closed, which
 * is the dead-row recovery road, and the caller refuses an already-closed one.
 *
 * ⚠ **THE HEARTBEAT ASKS THE SAME QUESTION AND NOW ASKS IT HERE (#1281).**
 * `crew-shift-start.mts --note` stamped the NEWEST open run — this card's defect
 * with the other sign — and with several seats in one pass that lands every
 * seat's check-in on the last row opened, so his Working-now table calls the
 * other seats stalled while they work. It is the same population and the same
 * question ("which of the open runs is mine"), so it is the same resolver; a
 * second one would be the drift working law 4 is about, on the very pair of
 * scripts that already drifted once. The name says *Close* because that is
 * where it was first needed, and nothing in it is about closing.
 */
export function resolveCloseTarget(input: {
  readonly openRuns: readonly OpenRunForClose[];
  readonly shift: string | null;
}): CloseTargetVerdict {
  const open = input.openRuns;
  const named = input.shift?.trim() ?? "";

  if (named.length > 0) {
    const mine = open.filter((run) => run.shift === named);
    if (mine.length === 1) return { kind: "one", run: mine[0]!, how: "the shift id" };
    if (mine.length === 0) {
      return {
        kind: "refuse",
        why:
          `no OPEN run for shift "${named}".`
          + (open.length === 0
            ? " Nothing is open at all — if this shift never opened a row, that is the finding."
            : `\n  Open right now:\n    ${open.map(describeRun).join("\n    ")}`
              + "\n  Close a dead shift's stale row with --id <n>, never by leaving --shift off."),
      };
    }
    return {
      kind: "refuse",
      why:
        `${mine.length} open runs carry the shift id "${named}", so naming it does not pick one:`
        + `\n    ${mine.map(describeRun).join("\n    ")}`
        + "\n  Close the one you mean with --id <n>.",
    };
  }

  if (open.length === 0) {
    return {
      kind: "refuse",
      why: "there is no open run to close. If this shift never opened one, that is the finding — say so in the report.",
    };
  }
  if (open.length === 1) return { kind: "one", run: open[0]!, how: "the only open run" };

  return {
    kind: "refuse",
    why:
      `${open.length} runs are open, so a bare close would have to GUESS which is yours — and on`
      + " 2026-09-25 it guessed another seat's and stamped it with this shift's note (#1234):"
      + `\n    ${open.map(describeRun).join("\n    ")}`
      + "\n  Name your own row:            --shift <the id you opened with>"
      + "\n  Or close a dead one by hand:  --id <n>"
      + "\n  To LOOK at what is running:   npx tsx scripts/crew-shift-state.mts",
  };
}

/**
 * IS SOMEBODY ALREADY BUILDING THIS CARD? — the OTHER half of the #608 guard
 * (#1083).
 *
 * `findCardCollisions` above reads open SHIFT ROWS, and that is the whole of
 * what the shift-start sequence could see. It answers *"is another seat's run
 * declared on this card"* — and it is silent whenever the other builder never
 * wrote a row, which is the ordinary case for the relay in his terminal.
 *
 * **Measured, #1083, 2026-09-22.** Another seat opened PR #1080 on card #1079
 * at 12:40:17. At ~12:45 this shift read `gh issue list` and saw #1079 open,
 * `founder-ordered`, no comments, no `blocked`; at 12:47:18 it opened its own
 * run and started building; at 12:48:09 PR #1080 merged; at 13:05 the gate
 * said `CONFLICTING`, because `main` already carried the feature. Thirty-five
 * minutes, and **nothing was disobeyed** — the card was clean, the queue read
 * was correct, and the shift row guard could not fire because the other seat
 * had no row. **The one artifact that knew was `gh pr list`, and no step in the
 * shift-start sequence opened it.**
 *
 * ⚠ **THIS WARNS AND NEVER REFUSES, AND THE CARD RULED IT SO BEFORE IT WAS
 * BUILT.** A refusal keyed on a card number fires on a legitimate FOLLOW-UP PR
 * naming the same card — PR #1082 is exactly that, and a guard that stops a
 * shift from finishing its own card's second half has cost more than the
 * duplicate it prevents. The open-run guard may refuse because an open row is
 * a DECLARATION of intent that only its own seat writes; an open PR is not —
 * it may be finished, superseded, someone's follow-up, or the shift's own.
 * **So this names the PR, says WHERE the number was found, and lets the shift
 * decide.**
 *
 * The match is deliberately wide in one direction and narrow in another:
 * `#1079` in a title or body is a token (`#10790` and `#11079` are not it,
 * `#01079` is), and a branch matches when one of its maximal digit runs IS the
 * number — so `team/relay1079b` matches and `team/relaysmall` does not.
 */
export type CardPullRequestWhere = "title" | "body" | "branch";

export interface CardPullRequestMatch<T> {
  readonly pr: T;
  readonly where: CardPullRequestWhere[];
}

interface PullRequestLike {
  readonly title?: string | null;
  readonly body?: string | null;
  readonly headRefName?: string | null;
}

/** The card as a plain number, or null when the ref is free text. */
export function cardNumberOf(raw: string | null | undefined): number | null {
  const normalised = normaliseCardRef(raw);
  if (normalised === null) return null;
  const numbered = normalised.match(/^#(\d+)$/);
  if (!numbered) return null;
  const value = Number(numbered[1]!);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * `#0*N` not followed or preceded by a digit — the one spelling of "this text
 * names that card".
 *
 * Written out rather than with a lookbehind so the expression reads the same on
 * every engine this file is bundled through, and EXPORTED because
 * `crewCardBuildState.ts` asks the same question of a pull request title with a
 * narrower rule for the body (#1094): a second hand-written copy of this
 * expression is working law 4 in miniature, on the token every card reference
 * in the product turns on.
 */
export function cardNumberToken(card: number): RegExp {
  return new RegExp(`(^|[^0-9])#0*${card}([^0-9]|$)`);
}

/**
 * THE INVERSE OF {@link cardNumberToken} — *which* cards does this text name?
 * (#1877.)
 *
 * `cardNumberToken` answers "does this text name card N" and every caller until
 * now had an N in hand. The heartbeat's foreign-claim probe does not: it is
 * handed a seat's free-prose note and has to find the numbers in it.
 *
 * ⚠ **IT IS DEFINED BY AGREEMENT WITH ITS SIBLING RATHER THAN BY A SECOND
 * EXPRESSION, AND THAT IS THE WHOLE REASON IT LIVES HERE.** A separate
 * `/#(\d+)/g` in a lib three directories away is working law 4 on the token
 * every card reference in the product turns on — and the two would drift on
 * exactly the inputs nobody tests (`#0608`, `v1#12`, `#12x`). So the scan is a
 * candidate pass that is then CONFIRMED by `cardNumberToken` itself, which makes
 * the older function the single owner of the spelling in both directions.
 * `server/crewShiftState.test.ts` holds the two to each other over a corpus.
 *
 * It is deliberately WIDE, in the direction #1094's docblock licenses: a bare
 * `#N` anywhere counts, because the only consumer is a WARNING to a person who
 * is about to read the text anyway. Measured on all 568 production rows the day
 * it was written, **453 of them (79.8%) name a foreign card in their note** —
 * which is why no caller may turn this into a warning on its own. The probe that
 * uses it speaks only once the BOARD has confirmed a live rival claim.
 */
export function cardNumbersNamedIn(text: string | null | undefined): number[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const found: number[] = [];
  /* `exec` in a loop rather than `matchAll`, and an array rather than a `Set`:
     this module is bundled for the client too, and its target makes both of the
     iterator forms a compile error rather than a style note. */
  const scan = /#0*(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = scan.exec(text)) !== null) {
    const value = Number(match[1]);
    if (!Number.isSafeInteger(value) || value <= 0) continue;
    if (found.indexOf(value) !== -1) continue;
    /* The confirmation, not a second opinion: one owner of the spelling. */
    if (cardNumberToken(value).test(text)) found.push(value);
  }
  return found.sort((a, b) => a - b);
}

/** The open PRs naming this card, each with where the number was found. */
export function findCardPullRequests<T extends PullRequestLike>(
  openPrs: readonly T[],
  cardRef: string | null | undefined,
): CardPullRequestMatch<T>[] {
  const card = cardNumberOf(cardRef);
  if (card === null) return [];
  const token = cardNumberToken(card);
  const matches: CardPullRequestMatch<T>[] = [];
  for (const pr of openPrs) {
    const where: CardPullRequestWhere[] = [];
    if (typeof pr.title === "string" && token.test(pr.title)) where.push("title");
    if (typeof pr.body === "string" && token.test(pr.body)) where.push("body");
    /* A branch carries no `#`, so the reading is its digit RUNS: a run that IS
       the number, never a number the run merely contains. */
    if (typeof pr.headRefName === "string"
      && (pr.headRefName.match(/\d+/g) ?? []).some((run) => Number(run) === card)) {
      where.push("branch");
    }
    if (where.length > 0) matches.push({ pr, where });
  }
  return matches;
}

/**
 * CAN THIS OPEN PULL REQUEST STILL BE MERGED? (#1099)
 *
 * `findCardPullRequests` above answers *"is somebody already building this
 * card"*. This answers the question the three shift-facing readers of that
 * list never asked: *"and can the thing they are building still land?"*
 *
 * **Measured, #1078, 2026-09-22.** The PR was finished, green and ready at
 * 11:38Z. By 20:22Z `main` had moved three times underneath it and it was
 * `CONFLICTING`/`DIRTY`. Nothing a shift reads said so — the 19:53Z shift
 * looked straight at it, wrote *"work in flight, not a hold"*, and moved on,
 * correctly given what it was shown. Nine hours.
 *
 * ⚠ **A CONFLICTING PULL REQUEST IS NOT MERELY STUCK, IT IS SILENT.** GitHub
 * creates no merge ref for one, so no `pull_request` workflow fires on it for
 * any event (#566's absent state, measured again on #984 and on #1078). Its
 * checks page keeps showing the last green run, so it looks perfectly healthy
 * for exactly as long as it is broken — which is why a reader has to say it.
 *
 * ⚠ **THREE STATES, NOT TWO, AND THAT IS THE WHOLE CARE HERE.** `mergeable`
 * comes back `UNKNOWN` while GitHub is still computing the merge — a PR pushed
 * seconds ago reads that way routinely. `false` there would be a claim this
 * reader has not earned, and collapsing "could not be read" into "nothing
 * there" is the one thing `cardClaimWarning.mts`'s header is about. So:
 *
 *   - `true`  — `CONFLICTING` or `DIRTY`: it cannot be merged as it stands.
 *   - `null`  — `UNKNOWN`, or the fields absent: say nothing.
 *   - `false` — anything else: GitHub has computed an answer and it is not a
 *               conflict.
 *
 * The shape came from `gate-stall-check.mts`, which read these two fields this
 * way first and whose comment records why (PR #631's review).
 *
 * ⚠ **THIS SENTENCE USED TO SAY "two callers, no second definition" AND IT WAS
 * NEVER TRUE OF THE TREE (#1103).** It described what #1099 added and was
 * silent about the two spellings that already existed — the origin in
 * `gate-stall-check.mts` and two more in `prMergeOrder.mts` — so a reader who
 * trusted it instead of grepping would have believed there was one rule where
 * there were three. Working law 4, on the vocabulary rather than on a list.
 * Both were folded onto this declaration in the same commit, and
 * `server/crewShiftCardClaim.test.ts` now REDDENS on a fourth spelling
 * anywhere under `scripts/` or `shared/`, so the count is derived rather than
 * asserted here.
 *
 * **What is deliberately NOT folded**: `prMergeOrder.mts`'s BEHIND, BLOCKED
 * and UNKNOWN verdicts. That module decides whether to MERGE, not whether to
 * warn, and those three branches carry remedies of their own.
 *
 * ⚠ **AND WHAT IT DRIVES IS A WARNING, NEVER A REFUSAL** — #1083's rule for
 * the line it rides on, and a drifted PR is exactly the case where a shift may
 * legitimately want to pick the card up.
 */
export interface PullRequestMergeability {
  readonly mergeable?: string | null;
  readonly mergeStateStatus?: string | null;
}

/** `true` unmergeable, `false` fine, `null` not yet knowable. */
export function readPullRequestConflict(pr: PullRequestMergeability): boolean | null {
  const mergeable = typeof pr.mergeable === "string" ? pr.mergeable.toUpperCase() : null;
  const state = typeof pr.mergeStateStatus === "string" ? pr.mergeStateStatus.toUpperCase() : null;
  if (mergeable === "CONFLICTING" || state === "DIRTY") return true;
  /* An absent field is not an answer either. A caller whose `--json` list has
     lost these fields must read as "not knowable", never as "fine" — the
     silent direction is the one that cost nine hours. */
  if (mergeable === null && state === null) return null;
  if (mergeable === "UNKNOWN" || state === "UNKNOWN") return null;
  return false;
}

/** The one sentence every reader of the claimed-PR line prints for a conflict. */
export const PR_CONFLICT_NOTE =
  "it can NO LONGER BE MERGED (conflicting) — and a conflicting PR fires no"
  + " workflow run for any event, so it cannot be re-gated or asked anything"
  + " while its checks page still shows green. Re-merge main on its branch"
  + " (#984 step 1) before anything else.";

/**
 * THE SAME QUESTION ASKED OF HIS OWN PAGE (#1101).
 *
 * `readPullRequestConflict` above answers it for the three lists a SHIFT
 * reads. This answers it for the one surface the founder reads: the pipeline
 * rows on `/admin/crew`, written by `scripts/crew-desk-sweep.mts`.
 *
 * **The instance.** Edition 477 put a row on his page for PR #1078 reading
 * `in-review`. That was true when it was written; eleven hours earlier the PR
 * had stopped being mergeable. The sweep's whole reader was
 * `gh pr view <n> --json state`, and `state` is `OPEN`/`MERGED`/`CLOSED` — it
 * cannot express *"open, but it can no longer be merged"*. So a live row had
 * exactly two roads, promote-to-merged or leave alone, and a conflicting PR
 * took the second one silently, through BOTH spells of #1078 being stuck.
 *
 * ⚠ **AND IT CANNOT SAY WHEN IT GOT STUCK, WHICH IS WHY THERE IS NO TIMER
 * HERE.** The card that ordered this proposed *"stuck since 11:38"* with a
 * grace period, so an ordinary twenty-minute merge collision would not shout
 * at him. Read at the tool: `gh pr view --json` offers 31 fields and none of
 * them is *conflicting-since*; `updatedAt` moves on any write, and the head
 * commit's date is not it either — **both** #1078 instances broke while the
 * branch stood still and `main` moved underneath it. A number nobody can
 * derive is not put on his page (law 7b).
 *
 * The honest form of the same intention is not a timer: **he should never read
 * about that collision at all, because the shift clears it.** So this REPORTS
 * to the shift and repairs nothing — the sweep's own standing doctrine for a
 * judgement about work — and the sentence on his row is written by hand, in
 * his terms, only for a PR still stuck after the repair road was walked.
 */
export type PipelineRowPullRequest =
  (PullRequestMergeability & {
    readonly state?: string | null;
    /**
     * When the pull request was closed, for the report only — the sweep never
     * decides anything from it, so an absent value costs nothing (#1439).
     */
    readonly closedAt?: string | null;
  })
  | null;

export type PlannablePipelineRow = {
  id?: string;
  status: string;
  prNumber?: number | null;
};

export type PipelineRowPlan<T extends PlannablePipelineRow = PlannablePipelineRow> = {
  /** The PR merged: safe to write, there is nothing to judge. */
  merged: T[];
  /** Live, and it can no longer land — named for a person, never repaired. */
  stuck: T[];
  /**
   * The PR was CLOSED WITHOUT MERGING, so the row's condition can never become
   * true — named for a person, never repaired, never guessed at (#1439).
   */
  closedUnmerged: Array<T & { closedAt: string | null }>;
  /** `gh` could not answer; never read as "still fine" (working law 2). */
  unreadable: T[];
};

/**
 * ⚠ **A LIVE PIPELINE ROW WITH NO PULL REQUEST, WHOSE CARD HAS CLOSED (#2165).**
 *
 * `planPipelineRowStates` opens with `if (typeof row.prNumber !== "number")
 * continue;` — so **a row that names no PR is invisible to all four of its
 * verdicts by construction.** It cannot be promoted, cannot be called stuck,
 * cannot be called closed-unmerged, and cannot even be called unreadable. It
 * says whatever it was written saying, for ever.
 *
 * **The specimen is live as this is written**: `dead-engine-record-1785` has
 * said `in-review` since its card closed on 2026-10-03 (his word on #1785:
 * *"1758) seal."*), with `prNumber: null`, and five shifts' worth of sweeps
 * have had no rule that could see it. #2165 was filed about a DIFFERENT row —
 * `sign-flat-price-1968`, which had a PR number, was repaired by the reader
 * above, and cleared itself at edition 668 — so this is the half of that card's
 * class that genuinely cannot self-heal.
 *
 * ⚠ **IT REPORTS AND NEVER REPAIRS, which is this reader's whole posture for a
 * judgement.** A card closes for reasons other than its work shipping —
 * refused, superseded, folded into another — so "the card is closed" does not
 * mechanically mean "write `merged`". What the row should say is a judgement
 * about work, and a status nobody meant is worse than a stale one because the
 * next reader believes it.
 */
export type PipelineRowWithoutPullRequest<T extends PlannablePipelineRow = PlannablePipelineRow> = T & {
  /** The cards its title names — every one of them closed, or this is not a finding. */
  readonly cards: readonly number[];
};

/**
 * Every live pipeline row that names no pull request and whose cards have all
 * closed.
 *
 * ⚠ **`isOpen` ANSWERS THREE STATES AND THE THIRD ONE IS THE GUARD.** The
 * caller knows which cards are open from a `gh issue list` it already made, and
 * that list is capped — so a card missing from it is *either* closed *or* past
 * the cap, and those are opposite answers. `null` means "cannot tell", and a
 * row holding any card it cannot tell about is left alone. Without it, a queue
 * that grew past the limit would start reporting live cards as closed, which is
 * the finding-shaped lie this repository has paid for before.
 *
 * ⚠ **A ROW WHOSE TITLE NAMES NO CARD IS NOT A FINDING EITHER.** There is then
 * nothing to judge it against, and inventing one from its `id` — which happens
 * to end in a number — would read a slug as evidence.
 */
export function planPipelineRowsWithoutPullRequests<T extends PlannablePipelineRow & { title?: string }>(
  rows: readonly T[],
  cardsIn: (title: string) => number[],
  isOpen: (card: number) => boolean | null,
): ReadonlyArray<PipelineRowWithoutPullRequest<T>> {
  const found: PipelineRowWithoutPullRequest<T>[] = [];
  for (const row of rows) {
    /* The done test is the ONE declaration of it (law 4). This module held no
       imports before #2165 and its neighbour above inlines the literal; a
       second spelling of *done* is exactly the drift that would outlive
       anyone noticing, so the import is worth the first edge. */
    if (crewPipelineRowIsDone(row.status)) continue;
    /* The population this reader exists for: exactly the rows its neighbour
       skips on its first statement. */
    if (typeof row.prNumber === "number") continue;
    const cards = cardsIn(typeof row.title === "string" ? row.title : "");
    if (cards.length === 0) continue;
    /* EVERY card closed, not any: a row naming a closed card and a live one is
       still describing live work. */
    if (cards.some((card) => isOpen(card) !== false)) continue;
    found.push({ ...row, cards });
  }
  return found;
}

/**
 * Sort every live pipeline row by what its pull request actually is.
 *
 * `readPullRequest` is injected for the same reason `planCardResolutions`
 * injects `issueState`: the script passes its own `gh` reader, the suite
 * passes a table, and the rule is drivable without a network. It is called at
 * most ONCE per row, so a flaky reader cannot answer two ways in one plan.
 *
 * ⚠ A row whose PR has MERGED is never also reported stuck. GitHub answers
 * `UNKNOWN` for a merged PR's mergeability, so the three-state reader would
 * say nothing anyway — but the guard is written rather than inherited, because
 * "it happens not to fire" is not a contract.
 */
export function planPipelineRowStates<T extends PlannablePipelineRow>(
  rows: readonly T[],
  readPullRequest: (prNumber: number) => PipelineRowPullRequest,
): PipelineRowPlan<T> {
  const merged: T[] = [];
  const stuck: T[] = [];
  const closedUnmerged: Array<T & { closedAt: string | null }> = [];
  const unreadable: T[] = [];

  for (const row of rows) {
    if (row.status === "merged") continue;
    if (typeof row.prNumber !== "number") continue;

    const pr = readPullRequest(row.prNumber);
    if (pr === null) {
      unreadable.push(row);
      continue;
    }
    const state = typeof pr.state === "string" ? pr.state.toUpperCase() : null;
    if (state === "MERGED") {
      merged.push(row);
      continue;
    }
    /*
      CLOSED AND NOT MERGED — the one case where the row's own claim has
      definitely stopped being true and the `merged` promotion can never fire
      (#1439). The specimen: `try-again-row-1347` said `in-review` over PR #1353,
      which was closed and REPLACED by #1355 because a commit message carried a
      closing keyword and could not be amended without a force push (#376). The
      sweep was not wrong about it — it was SILENT, having no rule for this state
      — so the row sat telling him a finished thing was waiting on a reviewer.

      ⚠ It returns BEFORE the conflict test, so a closed PR is never also
      reported stuck: GitHub keeps answering `mergeable` on a closed PR, and two
      blocks describing one row is what this script's header says it exists to
      kill.
    */
    if (state === "CLOSED") {
      closedUnmerged.push({
        ...row,
        closedAt: typeof pr.closedAt === "string" ? pr.closedAt : null,
      });
      continue;
    }
    /* `true` only. `null` is "not yet knowable" and says nothing — a PR read
       seconds after a push answers UNKNOWN routinely, and a `--json` list that
       lost the two fields answers the same way rather than "fine". */
    if (readPullRequestConflict(pr) === true) stuck.push(row);
  }

  return { merged, stuck, closedUnmerged, unreadable };
}
