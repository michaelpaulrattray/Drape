/**
 * WHY A NEXT UP ROW WAS SKIPPED — one owner for the verdict (issue #298).
 *
 * Founder, 2026-08-30, looking at his own page: *"on my desk it says [8 items]
 * but its currently working on [#280] did it skip things or what happened just
 * trying to make sense of how it works"*.
 *
 * It skipped five and every skip was correct. The block rendered exactly ONE
 * availability state — *Waiting on you* — while those five were stuck for four
 * different reasons, none of which was that. So a correct running order read as
 * a queue being ignored from the top.
 *
 * # `shared/` BECAUSE THE VERDICT HAS ONE OWNER
 *
 * `scripts/crew-desk-sweep.mts` reads the queue and writes the state onto the
 * briefing; the page draws it. Two implementations of *"blocked"* would drift,
 * and the first anyone would know is his page saying a card is takeable while
 * every shift declines it. Working law 4, pointed at a definition — the same
 * argument `shared/crewShiftState.ts` makes for `stalled`.
 *
 * # ⚠ THE STATE IS A LABEL AND THE REASON IS PROSE, AND THAT SPLIT IS THE FIX
 *
 * #298's own rule: *"Derive it, never type it … A row whose reason is stale is
 * this bug again."* `#278` is the proof — its body said BLOCKED for two shifts
 * after the fact, because the state lived in a sentence nobody re-reads.
 *
 * So the two halves are held to different standards:
 *
 * - **The STATE is a GitHub label.** One field, changed by one act, and
 *   unblocking a card is *removing the label* rather than editing a paragraph.
 *   A label cannot be half-removed and cannot disagree with itself.
 * - **The REASON is one line of the body**, and it is shown **only while the
 *   label says the hold is live**. That is what makes a rotting reason
 *   harmless: the moment the label goes, the sentence stops being rendered
 *   whatever it still says. A stale reason can never outlive its state,
 *   because the state is the thing that renders it.
 *
 * A held card with no marker line still shows its state — the label alone is a
 * complete answer to *"why was this skipped"*, and demanding prose would mean a
 * filer's omission silently un-holds a card.
 *
 * # WHAT IS NOT HERE
 *
 * **`you` is not a label.** *Waiting on you* is derived from HIS OWN DESK — an
 * open `needsYou` card naming the issue — which is #291's rule and the one
 * definition of "he is blocking this". It stays derived; putting it in a label
 * would let the queue claim he owes an answer he has already given.
 */

/**
 * The label that puts a card in each held state.
 *
 * ⚠ **`awaiting-fable`, NOT the existing `needs-fable`.** That one already
 * means *"force the full Fable review on this PR"* — a PR-scoped instruction to
 * the gate. Overloading it would make a card asking for a review and a card
 * waiting on the review arm indistinguishable, and one of those is takeable.
 */
export const CREW_HOLD_LABELS = {
  blocked: "blocked",
  fable: "awaiting-fable",
  sitting: "needs-sitting",
} as const;

/** A hold that comes from a label on the card. */
export type CrewHeldState = keyof typeof CREW_HOLD_LABELS;

/**
 * The same three, as the tuple `z.enum` wants — **derived from the labels
 * above rather than retyped**, so a fourth hold cannot exist in one list and
 * not the other (working law 4, and the whole reason this file exists).
 */
export const CREW_HELD_STATES = Object.keys(CREW_HOLD_LABELS) as [CrewHeldState, ...CrewHeldState[]];

/** Every reason a row is not takeable, including the one derived from his desk. */
export type CrewHoldKind = "you" | CrewHeldState;

/**
 * ⚠ **PRECEDENCE, and `you` is first on purpose.** A card can carry a label AND
 * have an open question on his desk; when it does, the answer he can act on is
 * the one worth showing him. The rest are ordered by how far the work is from
 * being takeable.
 */
export const CREW_HOLD_ORDER: readonly CrewHoldKind[] = ["you", "blocked", "fable", "sitting"];

/**
 * What the chip says. Short, because it sits at the end of a title line — and
 * plain, because he is not code-savvy: *Needs Fable* rather than
 * `judgment-class`.
 */
export const CREW_HOLD_WORD: Record<CrewHoldKind, string> = {
  you: "Waiting on you",
  blocked: "Blocked",
  fable: "Needs Fable",
  sitting: "Needs a sitting",
};

/**
 * The one line a filer writes in the card body to say what the hold is on.
 *
 * Visible markdown rather than an HTML comment, deliberately: a human opening
 * the card must read the same sentence his page shows him. A hidden marker is a
 * second copy that only a script can check.
 */
export const CREW_HOLD_MARKER = "**Waiting on:**";

/** Reasons longer than this are truncated by the writer, not by the page. */
export const CREW_HOLD_REASON_MAX = 160;

/**
 * The held state a card's labels put it in, or `null` when nothing does.
 *
 * Two labels is a filing mistake rather than a state, and the answer is the
 * FURTHEST from takeable — a card that is both blocked and needs a sitting is
 * not takeable for either reason, and the softer word would overstate it.
 */
export function heldStateFromLabels(labels: readonly string[]): CrewHeldState | null {
  const present = new Set(labels);
  const held = (Object.keys(CREW_HOLD_LABELS) as CrewHeldState[])
    .filter((state) => present.has(CREW_HOLD_LABELS[state]));
  if (held.length === 0) return null;
  return held.sort((a, b) => CREW_HOLD_ORDER.indexOf(b) - CREW_HOLD_ORDER.indexOf(a))[0];
}

/**
 * The reason line out of a card body, or `null`.
 *
 * ⚠ **It reads the FIRST marker line and stops.** A body that says it twice is
 * a card mid-edit; taking the first keeps the answer stable while somebody is
 * typing, and taking "the last one" would let a quoted example at the bottom of
 * a card win over the filer's own line.
 */
export function holdReasonFromBody(body: string): string | null {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(CREW_HOLD_MARKER)) continue;
    const reason = trimmed.slice(CREW_HOLD_MARKER.length).trim();
    if (reason.length === 0) return null;
    return reason.length > CREW_HOLD_REASON_MAX
      ? `${reason.slice(0, CREW_HOLD_REASON_MAX - 1).trimEnd()}…`
      : reason;
  }
  return null;
}

/** What a NEXT UP row shows about why it was skipped, or `null` when takeable. */
export type CrewHold = {
  kind: CrewHoldKind;
  /** The chip word — `CREW_HOLD_WORD[kind]`, resolved here so no caller retypes it. */
  word: string;
  /** The filer's sentence, when there is one. Never shown without a live hold. */
  because: string | null;
};

/**
 * The whole verdict for one row.
 *
 * `blockedOnYou` is the desk's answer (#291); `held` is what the sweep wrote
 * off the labels. Absent both, the row is takeable and carries no chip at all —
 * ⚠ **and that silence is load-bearing.** The first build of this block put a
 * word on every row and he could not see the order for the labels; the position
 * is the answer to his question, so only an exception gets a word.
 */
export function resolveHold(row: {
  blockedOnYou: boolean;
  held: { state: CrewHeldState; because?: string | null } | null | undefined;
}): CrewHold | null {
  if (row.blockedOnYou) {
    return { kind: "you", word: CREW_HOLD_WORD.you, because: row.held?.because ?? null };
  }
  if (!row.held) return null;
  return {
    kind: row.held.state,
    word: CREW_HOLD_WORD[row.held.state],
    because: row.held.because ?? null,
  };
}
