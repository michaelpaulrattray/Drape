/**
 * HIS "NOT RELEVANT" TAP — one vocabulary, shared (issue #325, second half).
 *
 * Founder-ordered 2026-08-31: *"should there be a delete icon next to them so i
 * can close them or remove them myself if they are not relevant?"* — then
 * **"yes"** to the shape his card describes.
 *
 * `shared/` because four things key on this list: the mutation that validates
 * what he taps, the panel that draws the state back to him, the shift tool that
 * reads what is waiting, and the tests. Four copies of four strings drift, and
 * the first anyone would know is a tap his page records and no shift reads.
 *
 * # ⚠ A TAP IS AN INTENT, NEVER A REPO WRITE — and that is the whole design
 *
 * His card settles it and the reasoning stands: closing the card from the
 * server needs a token with **write** access to the repository living in
 * production — a larger exposure than the read token already declined on #285,
 * and one that can CHANGE things rather than only read them. That is a
 * credential decision and it is his, not a side effect of a convenience button.
 *
 * So the tap records the intent in his own tables exactly as the switches do,
 * and **the next shift closes the card** after checking it is genuinely stale.
 * Two things that buys, and the second is the one worth the wait:
 *
 *   1. no credential in production — nothing changes about the app's exposure;
 *   2. **a second pair of eyes before a card disappears.** He found four
 *      already-finished cards himself on 2026-08-30 by reading them; a shift
 *      confirming beats a fast tap that removes a card somebody is mid-way
 *      through.
 *
 * Cost: an hour or so instead of instant, named on his card so he can overrule
 * it.
 *
 * # ⚠ CLOSE, NEVER DELETE — and nothing here deletes a row either
 *
 * His card: *"Closed is recoverable, keeps the history, and is what the desk
 * sweep already reads. Deleting an issue is irreversible and buys nothing."*
 * The same rule is applied to the intent itself: withdrawing a tap sets
 * `withdrawnAt` rather than removing the row, so **there is no DELETE anywhere
 * on this road** — not in the mutation, not in the shift tool. A tap he took
 * back is still a thing he once said about that card, and a shift that already
 * acted has its reason preserved beside it.
 */

/**
 * What a tap can mean. ONE value today, and a list rather than a boolean so a
 * second meaning is a line here rather than a migration and a founder ceremony
 * — `shared/crewQueueExclusions.ts` made the same choice for the same reason.
 */
export const CREW_CARD_INTENTS = [
  {
    key: "close",
    /** What his tap says, in his words on the panel. */
    label: "Not relevant",
    /** What the page tells him he has just asked for. */
    pending: "Marked not relevant — a shift will check it and close it.",
  },
] as const;

export type CrewCardIntentKey = (typeof CREW_CARD_INTENTS)[number]["key"];

export const CREW_CARD_INTENT_KEYS = CREW_CARD_INTENTS.map((intent) => intent.key) as readonly CrewCardIntentKey[];

/**
 * How a shift answered.
 *
 * ⚠ **`declined` EXISTS BECAUSE THE SECOND PAIR OF EYES HAS TO BE ABLE TO SAY
 * NO, AND HE HAS TO SEE IT.** A road where a shift can only agree is not a
 * check — it is a slow repo write with extra steps. His card's own bar says so:
 * *"the next shift acts on the intents, closes what it confirms, and REPORTS
 * anything it declined to close and why."* The note is that report, and it
 * lands on the panel he tapped from rather than in a mailbox entry he does not
 * read.
 */
export const CREW_INTENT_RESOLUTIONS = ["closed", "declined"] as const;

export type CrewIntentResolution = (typeof CREW_INTENT_RESOLUTIONS)[number];

/** The longest note a shift may write back. Matches the column. */
export const CREW_INTENT_NOTE_MAX = 500;

/** One card's intent, as the page and the shift tools see it. */
export type CrewCardIntentView = {
  readonly issueNumber: number;
  readonly intent: string;
  readonly markedAt: Date | string;
  /** Set once he takes the tap back; the row stays, which is the point. */
  readonly withdrawnAt: Date | string | null;
  /** `null` until a shift has acted. */
  readonly resolution: CrewIntentResolution | null;
  /** Why, when a shift declined. Empty and absent are the same thing here. */
  readonly resolutionNote: string | null;
  readonly resolvedAt: Date | string | null;
};

/**
 * Whether a shift still owes him an answer on this row.
 *
 * ⚠ **WITHDRAWN IS NOT PENDING, AND IT IS NOT RESOLVED EITHER.** A tap he took
 * back must not reach a shift's work list — acting on it would close a card he
 * decided to keep — and it must not read as "a shift answered", because nobody
 * did. Both halves are one `&&` here so the panel and the shift tool can never
 * disagree about which rows are waiting.
 */
export function intentIsPending(intent: CrewCardIntentView): boolean {
  return intent.withdrawnAt === null && intent.resolution === null;
}

/**
 * What the page says about a card he has touched — or `null` for a card he has
 * not, which is every card until he taps one.
 *
 * ⚠ **`null` IS RETURNED FOR A WITHDRAWN ROW ON PURPOSE.** Taking a tap back
 * puts the card exactly where it was; a lingering "you took this back" line
 * would make undo cost him a second reading. The row survives for the record,
 * not for the page.
 */
export function intentSentence(intent: CrewCardIntentView | null | undefined): string | null {
  if (!intent) return null;
  if (intent.withdrawnAt !== null) return null;
  if (intent.resolution === "closed") return "Closed by a shift.";
  if (intent.resolution === "declined") {
    /* His card's bar is that a decline is REPORTED with its reason. A decline
       whose note went missing still says it was declined rather than silently
       reading like a pending tap — the failure direction that matters is the
       one where he thinks a shift has not looked yet. */
    const why = (intent.resolutionNote ?? "").trim();
    return why.length > 0 ? `Kept open by a shift — ${why}` : "Kept open by a shift.";
  }
  return CREW_CARD_INTENTS.find((entry) => entry.key === intent.intent)?.pending
    ?? "Marked — a shift will check it.";
}

/**
 * Index a list of intents by card number, for a panel that draws many cards.
 *
 * A `Map` rather than a `find` per row: the pipeline panel draws up to five
 * titles across thirteen groups, and a linear scan per title is the shape that
 * quietly becomes slow once he has tapped a few dozen.
 */
export function indexIntentsByCard(
  intents: readonly CrewCardIntentView[],
): ReadonlyMap<number, CrewCardIntentView> {
  return new Map(intents.map((intent) => [intent.issueNumber, intent]));
}
