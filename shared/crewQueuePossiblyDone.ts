/**
 * THE CARDS THAT MAY ALREADY BE DONE — the switch count's blind spot (#494).
 *
 * Founder, 2026-09-04, at the BACKGROUND WORK panel, verbatim: *"are they all
 * still relelvant like does the agent know when a bug or any other category
 * item has already been fixed etc? i dont want want it trying to fix an
 * irrelevant bug or somthing already ordered in the next up que or feature plan
 * roadmap or whatever . otherweise if i turn background work on when the shift
 * has nothing to do it might end up breaking things or doing uneccesary work."*
 *
 * `shared/crewQueueExclusions.ts` (#324) answered the *"already ordered"* half:
 * a card he has queued, or one parked on his own ruling, is taken out of the
 * offer and NAMED. This module answers the other half — **a card whose fix
 * already landed and which nobody closed.** The 2 September triage found five
 * of them in one sitting (#57, #59, #69, #80, #111): the work was done, the
 * card stayed open, and the count offered it as a night's work.
 *
 * # ⚠ IT FLAGS FOR A RE-READ. IT NEVER SUBTRACTS, AND IT NEVER CLOSES.
 *
 * This is the one line that separates it from an exclusion, and his card says
 * it in as many words: *"No card closes from this instrument; closing stays a
 * shift's act with a receipt, by hand."* A flagged card is still OFFERED and is
 * still inside `openCount` — the panel reads **`Bugs (14, 2 possibly fixed)`**,
 * where the 2 are two of the 14 rather than two taken out of them. The shift's
 * standing order (re-read a background card at the code before taking it) is
 * the control; this only says which ones to re-read FIRST.
 *
 * # THE RULE, AND WHY IT IS THIS ONE — MEASURED, NOT REASONED
 *
 * A card is flagged when **a pull request that merged AFTER the card was filed
 * names it, and nobody has touched the card since that pull request merged.**
 *
 * Both halves were measured against the real queue on the day this shipped,
 * because the obvious rule is a bad instrument:
 *
 *   * *"named by a merged PR"* alone flags **18 of 52** offered cards. Almost
 *     all of the extra are cards that get CITED rather than worked — #8 (the
 *     purge) is named by ten merged PRs, #129 (the refusal patrol) by ten,
 *     #376 (the PR-body rule) by eight. A flag that fires on a third of the
 *     queue trains a shift to ignore it, which is worse than no flag.
 *   * adding *"and untouched since"* takes it to **14 of 78 open**, and every
 *     one of the chronic citations drops out for a principled reason: a comment
 *     or a label on the card IS somebody having looked at it in light of that
 *     work. The ones that remain are exactly the ones nobody answered.
 *   * *"named in the PR's TITLE"* — the tempting stronger signal — flags **8 of
 *     78** alone and **0 of 78** combined with untouched, because a card whose
 *     title a PR quotes always gets a comment afterwards. It is not the
 *     discriminator it looks like.
 *
 * ⚠ **AND IT DOES NOT READ THE PROSE, WHICH IS HIS CARD'S OWN BAR:** *"a body
 * naming it inside 'filed, not fixed' prose is STILL reported (the reader flags
 * for a re-read; it does not judge)."* Nothing here parses a sentence. #376 —
 * whose entire subject is PR bodies that explain they are not closing a card —
 * is flagged by this rule today, and that is correct behaviour.
 *
 * # ⚠ THE READING IS A FLOOR, NEVER COVERAGE — STATED, NOT DISCOVERED LATER
 *
 * Driven against the five cards the triage found: **#80 and #111 are named by a
 * merged PR, #69 by one, and #57 and #59 BY NOTHING AT ALL.** Two of five would
 * have been invisible to this instrument on its best day, and a fix that landed
 * by the deploy rite's direct push to main has no pull request to be named in.
 *
 * So an empty flag list means *this reading found nothing*, and never *nothing
 * is stale*. The standing re-read-before-take order is the control; this is a
 * cheap pointer at the front of it. The un-wiring differ's docblock states its
 * limits the same way and for the same reason.
 *
 * # `shared/` FOR `crewQueueTitles.ts`'s REASON
 *
 * Three things key on this shape: the shift tool that writes the row
 * (`scripts/crew-count-queue.mts`), the reader that projects it
 * (`server/db/crewWorkSwitches.ts`), and the panel that draws it. Three copies
 * of one JSON shape drift, and the first anyone would know is a flag that
 * silently stopped rendering — which on this panel looks exactly like a queue
 * with nothing stale in it, the most reassuring wrong answer available.
 *
 * # ⚠ THE PARSE IS HOSTILE-INPUT SAFE
 *
 * The column holds a JSON string written by a script, and his ENTIRE Crew tab
 * is one `crew.getState` call — a throw in this projection is a blank page for
 * the founder. Every malformed, truncated or half-written value degrades to NO
 * FLAGS, which draws exactly the panel he has today.
 */

/**
 * How many card numbers are kept in the row.
 *
 * ⚠ **THE COUNT IS STORED BESIDE THEM RATHER THAN DERIVED FROM THEM**, which is
 * the whole reason this value is an object and not an array. A category with
 * thirty flagged cards must still say *"30 possibly fixed"*; a capped array
 * read as its own total would quietly say twelve. `crewQueueTitles.ts` gets
 * this for free because its total is `openCount`; this one has no such column
 * to lean on, so it carries its own.
 */
export const QUEUE_POSSIBLY_DONE_CAP = 12;

/** What one category's row holds: how many were flagged, and which of them are named. */
export type CrewQueuePossiblyDone = {
  /** Every flagged card in the category — the number the panel says. */
  readonly count: number;
  /** Up to `QUEUE_POSSIBLY_DONE_CAP` of their card numbers, in the writer's order. */
  readonly cards: readonly number[];
};

/** Nothing flagged — and the value a broken read degrades to. */
export const NO_POSSIBLY_DONE: CrewQueuePossiblyDone = { count: 0, cards: [] };

/** A card number, or `null`. Shared by the serializer and the parser so they cannot differ. */
function readCard(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

/**
 * The stored JSON for one category's row.
 *
 * The caller passes EVERY flagged card; the cap is applied here, at the write,
 * so the row stays small and can never become a second copy of the queue —
 * `serializeQueueTitles`' rule, for its reason.
 */
export function serializePossiblyDone(cards: readonly number[]): string {
  const clean: number[] = [];
  const seen = new Set<number>();
  for (const value of cards) {
    const card = readCard(value);
    /* Deduped at the write. A card carrying two labels is counted once per
       CATEGORY row, and a card named by three merged PRs is still one card —
       a count that exceeded the cards it came from is the arithmetic this
       panel must never print (`crewQueueExclusions.ts`'s first-match rule,
       pointed at a different double-count). */
    if (card === null || seen.has(card)) continue;
    seen.add(card);
    clean.push(card);
  }
  return JSON.stringify({ n: clean.length, cards: clean.slice(0, QUEUE_POSSIBLY_DONE_CAP) });
}

/**
 * The stored JSON back into a reading, or nothing at all.
 *
 * ⚠ **EMPTY IS THE ONLY FAILURE MODE.** `null` (the column exists and no shift
 * has written it yet), `""`, a truncated string, an array where an object
 * belongs, a negative or fractional count, a `cards` value that is not a list —
 * every one yields `NO_POSSIBLY_DONE`, which draws the count alone. That is
 * today's panel, so the degraded state is one the founder has already seen.
 *
 * ⚠ **AND A COUNT SMALLER THAN THE CARDS IT CARRIES IS RAISED, NOT TRUSTED.**
 * The two are written in one statement and cannot legitimately disagree, so a
 * pair that does is a corrupt value — and of the two possible repairs, the one
 * that shows him MORE flagged cards is the safe direction here. Silently
 * dropping named cards to satisfy a wrong number is how a count goes quiet.
 */
export function parsePossiblyDone(raw: unknown): CrewQueuePossiblyDone {
  if (typeof raw !== "string" || raw.trim().length === 0) return NO_POSSIBLY_DONE;
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return NO_POSSIBLY_DONE;
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return NO_POSSIBLY_DONE;
  const { n, cards } = decoded as { n?: unknown; cards?: unknown };
  /* ⚠ BOTH FIELDS ARE REQUIRED AND BOTH ARE SHAPE-CHECKED. The writer always
     writes the pair, so `n` without a `cards` LIST is a corrupt value rather
     than a count-only row — and reading it as "N flagged, none of them
     nameable" would put a number on his panel with nothing behind it. Junk
     INSIDE a real list is different and is simply dropped: the shape held, the
     entries did not. */
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return NO_POSSIBLY_DONE;
  if (!Array.isArray(cards)) return NO_POSSIBLY_DONE;
  const kept = cards
    .map(readCard)
    .filter((card): card is number => card !== null)
    .slice(0, QUEUE_POSSIBLY_DONE_CAP);
  /* Deduped without spreading a Set: `shared/` compiles to a target the client
     shares, and an iterator spread here is a build error rather than a
     preference. */
  const deduped: number[] = [];
  for (const card of kept) if (deduped.indexOf(card) === -1) deduped.push(card);
  if (n === 0 && deduped.length === 0) return NO_POSSIBLY_DONE;
  return { count: Math.max(n, deduped.length), cards: deduped };
}

/**
 * What the panel says after the number — `"2 possibly fixed"` — or `null` when
 * nothing was flagged.
 *
 * ⚠ **`null` RATHER THAN AN EMPTY STRING**, for `queueExclusionSentence`'s
 * reason: the common row is `Process (12)` and it must look exactly as it does
 * today, with no comma, no dangling parenthesis and no trailing space.
 *
 * His card's own words for the shape: *"the panel reads `Bugs (15, 2 possibly
 * fixed)` in the same shape as `2 already queued`"*. It is drawn AFTER the
 * exclusions in that parenthesis, and the order carries the meaning — what was
 * subtracted first, then what is still in the number and worth a second look.
 */
export function possiblyDoneSentence(reading: CrewQueuePossiblyDone): string | null {
  return reading.count > 0 ? `${reading.count} possibly fixed` : null;
}

/**
 * One pull request naming one card: which PR, and when it merged.
 *
 * Deliberately not the PR's title, body or branch — nothing downstream reads
 * the prose, and a shape that carried it would invite something to.
 */
export type CardNaming = {
  readonly pr: number;
  /** Epoch milliseconds. */
  readonly mergedAt: number;
};

/**
 * THE RULE ITSELF, as a pure function, so the suite can drive it without `gh`.
 *
 * A card is flagged when some naming pull request merged **after** the card was
 * filed and **at or after** the last time anybody touched the card.
 *
 * ⚠ **THE SECOND COMPARISON IS `>=` AND NOT `>`, AND THAT IS THE LOAD-BEARING
 * ONE.** GitHub stamps a card's `updatedAt` when a merged PR's own reference
 * lands on it, so the commonest true positive in this repository has the two
 * timestamps within the same second — a strict `>` would drop precisely the
 * cards this instrument exists to find, and it would do it silently. A shift
 * that later commented, labelled or edited the card moves `updatedAt` past the
 * merge by minutes or hours, which is the case that must NOT flag.
 *
 * ⚠ **AN UNREADABLE TIMESTAMP FAILS DIFFERENTLY DEPENDING ON WHICH ONE IT IS,
 * AND THE TWO ARE NOT THE SAME QUESTION.** Both directions were written the
 * lazy way first — `NaN` comparisons are false, so the code "just worked" — and
 * the suite caught the docblock and the code disagreeing about which way.
 *
 *   * **`filedAt` unreadable ⇒ NEVER flags.** *"A pull request merged after the
 *     card was filed"* is the PRECONDITION, and without a filing date it cannot
 *     be established at all. There is no finding to make, only a guess.
 *   * **`updatedAt` unreadable ⇒ still flags**, provided that precondition
 *     holds. Here the finding is established and only the DISCRIMINATOR — has
 *     anybody looked since — is unreadable. Failing quiet there would drop a
 *     real finding to save a shift one re-read, and the re-read is thirty
 *     seconds.
 *
 * A naming with no parseable merge date is skipped, for the `filedAt` reason:
 * it cannot be placed relative to anything.
 */
export function isPossiblyDone(
  filedAt: number,
  updatedAt: number,
  namings: readonly CardNaming[],
): boolean {
  if (!Number.isFinite(filedAt)) return false;
  for (const naming of namings) {
    if (!Number.isFinite(naming.mergedAt)) continue;
    if (naming.mergedAt <= filedAt) continue;
    if (!Number.isFinite(updatedAt) || naming.mergedAt >= updatedAt) return true;
  }
  return false;
}

/**
 * Every `#123` in a piece of text, as card numbers.
 *
 * ⚠ **THE PULL REQUEST'S OWN NUMBER IS THE CALLER'S TO DROP, NOT THIS
 * FUNCTION'S** — a PR body legitimately names its own number, and a reader that
 * silently removed it here would be doing half of the caller's filtering in a
 * place the caller cannot see. `scripts/crew-count-queue.mts` passes `self`.
 *
 * `\b` after the digits so `#12x` yields nothing rather than 12, and a leading
 * `(?<![\w#])` so a git object like `abc#12` and a doubled `##12` do not read as
 * a card reference. Deliberately NOT anchored to a keyword: `Closes #12` and
 * `see #12` are the same fact to this reader, which is his no-judging bar.
 */
export function cardNumbersIn(text: string, self?: number): number[] {
  const out: number[] = [];
  /* An `exec` loop rather than `matchAll`, and `indexOf` rather than a Set:
     `shared/` is compiled at the client's target, where iterating a match
     iterator or spreading a Set is a build error rather than a preference.
     `lastIndex` advances between calls because the pattern is global. */
  const pattern = /(?<![\w#])#(\d+)\b/g;
  let match: RegExpExecArray | null = pattern.exec(text ?? "");
  while (match !== null) {
    const card = Number(match[1]);
    if (Number.isInteger(card) && card > 0 && card !== self && out.indexOf(card) === -1) out.push(card);
    match = pattern.exec(text ?? "");
  }
  return out;
}
