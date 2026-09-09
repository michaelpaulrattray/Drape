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
 * still inside `openCount` — the panel reads **`Bugs (14 on offer, 2 possibly fixed)`**,
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
 * ⚠ **AND IT OVER-REPORTS IN A SYSTEMATIC DIRECTION TOO — THE HALF THIS
 * DOCBLOCK WAS MISSING (#728).** The paragraph above states the under-reporting
 * honestly and says nothing about the other side, so the limit that was
 * measured five-for-five went unwritten: **the flag fires hardest on the pull
 * requests whose bodies say, in words, that the work was NOT done.** A shift
 * that files a card from its own sweep and says so is the discipline this
 * repository requires, and doing it guarantees the card is named by that merged
 * pull request forever. `evidenceTextOf` removes the pasted-output shape of
 * this (#716's fence); the prose shape — *"all filed as #455, none taken"* —
 * SURVIVES on purpose, because telling it from a real fix needs a vocabulary of
 * English phrases and that is a judgement about wording, not a reading.
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
  return qualifyingNamings(filedAt, updatedAt, namings).length > 0;
}

/**
 * A MERGED PULL REQUEST THAT NAMES THIS MANY CARDS IS CITING THEM, NOT FIXING
 * THEM — and its mentions are not evidence about any single one of them (#514).
 *
 * ⚠ **THE INSTRUMENT'S OWN PULL REQUEST BECAME ITS LOUDEST FALSE SIGNAL.** PR
 * #498 built this flag, and its body argues about the reading by citing
 * sixteen cards as examples. Every one of the sixteen turned *possibly fixed*
 * on his panel the moment it merged — Bugs went 5 flagged to 6 and Housekeeping
 * 1 to 2, and the added ones were cards that PR merely mentioned.
 *
 * This is a REPEAT of a class this repository has already ruled on: #360 fixed
 * the quiet-shift detector for exactly this shape, where a shift writing ABOUT
 * quiet nights was counted as having had one. **A mention read as a
 * declaration**, twice, in two different readers.
 *
 * ⚠ **DERIVED, NOT CHOSEN BY FEEL.** Measured over all 220 merged pull requests
 * on 2026-09-06 (the card's own reading of 183 agreed):
 *
 * | cards named by one merged PR | |
 * |---|---|
 * | p50 | 3 |
 * | p75 | 4 |
 * | p90 | 6 |
 * | **p95** | **8** |
 * | max | 16 (PR #498) |
 *
 * A pull request that FIXES a card names one or two. A pull request that CITES
 * examples — a law-7 sweep, a triage, a patrol report, a design argument —
 * names eight to sixteen. The ceiling is p95, the top of the card's stated
 * 6–8 range, because the failure worth avoiding is the other one: dropping a
 * real finding to remove noise.
 *
 * ⚠ **THE NEGATIVE CONTROL DECIDED THE BOUNDARY, NOT THE PERCENTILE.** Driven
 * over the live queue the day this landed — 92 open cards against 220 merged
 * pull requests — the rule moves **14 flags to 13**, and the single flag it
 * removes is `#532`, named by PR #533. **PR #533 is the Machinist's patrol
 * report, and it FILED #532**; it did not fix it. So the one flag this costs is
 * exactly the noise it was built to remove, and no genuine finding dies.
 * Ceilings of 7, 8 and 9 were identical on that queue; 6 lost two real ones.
 *
 * ⚠ **IT NARROWS NOISE — IT ADDS NO COVERAGE.** A card nobody has re-read is
 * still only *possibly* done, and this instrument remains a floor.
 */
export const CITED_CARDS_CEILING = 8;

export function isCitingRatherThanFixing(namedCards: number): boolean {
  return namedCards > CITED_CARDS_CEILING;
}

/**
 * WHICH pull requests satisfied the rule — the receipt behind the flag.
 *
 * ⚠ **THE FLAG AND ITS RECEIPT COME FROM ONE PREDICATE, and they did not until
 * the reviewer caught it (PR #498, finding 1).** `crew-count-queue.mts` built
 * the log's *"named by merged PR #488"* list with its own inline copy of the two
 * comparisons, one line after calling `isPossiblyDone` — working law 4's second
 * list, in the smallest possible form. The failure it invites is quiet and
 * specific: edit the discriminator here (the `>=` the suite pins at both
 * boundaries) and the copy is left behind, so a card flags with an EMPTY
 * receipt and the 3am log prints *"#486 may already be done — named by merged
 * PR "* with nothing after it. The one line a shift actually acts on would be
 * the one line that silently emptied.
 *
 * So this is the rule, and `isPossiblyDone` is a question asked of it.
 */
export function qualifyingNamings(
  filedAt: number,
  updatedAt: number,
  namings: readonly CardNaming[],
): CardNaming[] {
  if (!Number.isFinite(filedAt)) return [];
  const qualifying: CardNaming[] = [];
  for (const naming of namings) {
    if (!Number.isFinite(naming.mergedAt)) continue;
    if (naming.mergedAt <= filedAt) continue;
    if (!Number.isFinite(updatedAt) || naming.mergedAt >= updatedAt) qualifying.push(naming);
  }
  return qualifying;
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
/**
 * THE TEXT A CARD REFERENCE COUNTS AS EVIDENCE IN — everything except a fenced
 * block and a table row (#728).
 *
 * ⚠ **THE INSTRUMENT FIRED HARDEST ON THE PULL REQUESTS WHOSE BODIES SAY, IN
 * WORDS, THAT THE WORK WAS NOT DONE.** Measured five for five on 2026-09-09,
 * each read at the artifact: a shift that files a card from its own sweep and
 * says so is the discipline this repository requires, and doing it guaranteed
 * the card was named by that merged pull request forever.
 *
 * `CITED_CARDS_CEILING` already drops a body naming more than eight cards, and
 * it works — but **it is a COUNT heuristic where the signal is TEXTUAL**, so a
 * body naming exactly one card in a pasted list slips under it, and no ceiling
 * can ever catch that. PR #716's shape is the specimen: it pastes the priority
 * view's own sample output inside a fence, `#711` is one row of it, and the
 * card turned *possibly fixed* on his panel.
 *
 * # WHAT IS STRIPPED, AND WHY ONLY THESE TWO
 *
 *   * **A closed fenced block** (``` or ~~~) — pasted tool output, a log, a
 *     sample. #360 established this exact rule for the quiet-shift detector,
 *     which strips fences before testing. ⚠ **That precedent lives in the
 *     untracked `.agents/` standing-orders territory (`is-quiet-entry.ps1`), so
 *     no guard in this repository can hold the citation honest** (PR #736
 *     review, note 2) — it is named as provenance for the idea, and the arms
 *     below are what actually prove the behaviour here.
 *   * **A table row** — a line whose first non-space character is `|` and which
 *     holds at least two of them. A triage or patrol report tabulates the cards
 *     it is FILING; #728's own body is that shape.
 *
 * Nothing else. The four remaining specimens (#455 by PR #456, #481/#482 by PR
 * #717, #655 by PR #656) name their cards in ordinary prose — *"all filed as
 * #455, none taken"*, *"logged, not done here"* — and they SURVIVE this strip
 * and still flag. That is deliberate: separating those from a real fix needs a
 * vocabulary of English phrases, which is a judgement about wording and belongs
 * on its own card rather than smuggled in here. A blockquote is likewise NOT
 * stripped, though `is-quiet-entry.ps1` strips one: a quoted founder ruling is
 * not the same object as pasted machine output, and widening this without a
 * measurement is how a noise filter starts swallowing findings.
 *
 * # ⚠ AN UNTERMINATED FENCE STRIPS NOTHING, AND THAT DIRECTION IS THE WHOLE
 * POINT
 *
 * The card's bar: *"It must keep failing toward FLAGGING."* A fence opened and
 * never closed is a malformed body, and the tempting reading — everything after
 * it is code — would silently delete every card reference in the rest of the
 * text, which removes evidence and un-flags real findings. So an unclosed fence
 * is left entirely alone: a false flag costs one re-read, a missed one costs
 * him a card that is already done.
 */
export function evidenceTextOf(text: string): string {
  const lines = (text ?? "").split("\n");
  /* TWO PASSES, because whether a fence closes is not knowable at the line that
     opens it. The first pass marks the lines of CLOSED fences only; an opener
     with no partner leaves its region unmarked and therefore intact. */
  const fenced: boolean[] = new Array(lines.length).fill(false);
  let openedAt = -1;
  let openMarker = "";
  for (let at = 0; at < lines.length; at += 1) {
    const marker = /^\s{0,3}(```|~~~)/.exec(lines[at]);
    if (marker === null) continue;
    if (openedAt === -1) {
      openedAt = at;
      openMarker = marker[1];
      continue;
    }
    /* ⚠ A FENCE CLOSES ONLY ON ITS OWN CHARACTER, WHICH IS COMMONMARK'S RULE
       AND ALSO THE ONLY SHAPE THAT FAILS THE RIGHT WAY (PR #736 review, note
       1). Toggling on either marker was the first cut, and a bare `~~~` pasted
       INSIDE a ``` block closed it early and inverted the parity of every later
       marker — so in a body shaped ```/~~~/code/```/prose/```/code/``` the
       PROSE line was stripped while GitHub renders it as prose. That silently
       un-flags a real reference, which is the one direction this card forbids.
       Every other mixed-marker shape strips LESS than the renderer shows as
       code, which is the safe side. */
    if (marker[1] !== openMarker) continue;
    for (let mark = openedAt; mark <= at; mark += 1) fenced[mark] = true;
    openedAt = -1;
    openMarker = "";
  }
  const kept: string[] = [];
  for (let at = 0; at < lines.length; at += 1) {
    if (fenced[at]) continue;
    const line = lines[at];
    /* A table row: first non-space character is a pipe, and at least two pipes
       in the line. The second condition is what stops a stray leading `|` in
       prose from reading as a table. */
    const trimmed = line.replace(/^\s+/, "");
    if (trimmed.charAt(0) === "|" && (line.match(/\|/g) ?? []).length >= 2) continue;
    kept.push(line);
  }
  return kept.join("\n");
}

/**
 * The card numbers a pull request body names AS EVIDENCE — `cardNumbersIn`
 * asked of `evidenceTextOf` rather than of the raw body (#728).
 *
 * ⚠ **THIS IS A SECOND READING OF ONE BODY, ON PURPOSE, AND THE FIRST ONE IS
 * NOT REPLACED.** `CITED_CARDS_CEILING` stays pointed at the RAW mention count,
 * because that is the population its 8 was derived from — p95 over 220 merged
 * pull requests — and because a patrol report that tabulates twelve cards is
 * exactly the thing that ceiling exists to catch. Stripping its table first
 * would make it read as a one-card fix and quietly undo the measurement.
 *
 * So the two questions are asked separately and each of the two readings is
 * used for the one it answers: *how many cards does this body mention at all*
 * (the calibrated noise heuristic) and *which cards does it name in prose* (the
 * evidence behind a flag).
 */
export function namedAsEvidenceIn(text: string, self?: number): number[] {
  return cardNumbersIn(evidenceTextOf(text), self);
}

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
