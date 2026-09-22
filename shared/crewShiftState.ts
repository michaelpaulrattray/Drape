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

/** The open PRs naming this card, each with where the number was found. */
export function findCardPullRequests<T extends PullRequestLike>(
  openPrs: readonly T[],
  cardRef: string | null | undefined,
): CardPullRequestMatch<T>[] {
  const card = cardNumberOf(cardRef);
  if (card === null) return [];
  /* `#0*N` not followed or preceded by a digit. Written out rather than with a
     lookbehind so the expression reads the same on every engine this file is
     bundled through. */
  const token = new RegExp(`(^|[^0-9])#0*${card}([^0-9]|$)`);
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
