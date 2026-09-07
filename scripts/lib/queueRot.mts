/**
 * WHAT NOBODY HAS LOOKED AT — and why a label is not looking (#516).
 *
 * The briefing's queue line tells the founder how many open cards have "gone a
 * week untouched". His standing order says the raw open count is not the useful
 * part: *"what is ROTTING (open, untouched for a week, never re-read against
 * the code)"*.
 *
 * # The incident
 *
 * On 2026-09-03 that figure read NINE (#10 #14 #18 #22 #23 #30 #55 #61 #65).
 * The next night it read ZERO, and **nobody had re-read a single one of them**.
 * The ladder pass had applied `rung:*` labels across the roadmap cards and the
 * desk sweep had cross-referenced them; GitHub's `updatedAt` moves on any write
 * to an issue, so a bulk relabel reset the clock on all nine at once.
 *
 * **The number was true of the metric and false of the thing the metric stands
 * for.** It failed in the direction that HIDES work — he was told the debt had
 * cleared itself — and nothing looked wrong while it did.
 *
 * # What counts as somebody engaging, and what deliberately does not
 *
 * ENGAGEMENT: a comment, a close, a reopen, or a commit that references the
 * card. Each of those is a person having done something to the card itself.
 *
 * NOT ENGAGEMENT: a label, an unlabel, an assignment, a rename, a milestone, a
 * pin — every one of which a housekeeping pass applies in bulk without reading
 * a word of the card.
 *
 * ⚠ **AND A CROSS-REFERENCE IS DELIBERATELY NOT ENGAGEMENT EITHER, WHICH IS THE
 * ONE JUDGEMENT CALL IN HERE.** A PR that genuinely fixes a card cross-
 * references it, so excluding them can report a card as rotting on the night
 * its fix was opened. The other direction is worse and it is measured: #514 is
 * this repository's own instance of a PR that merely CITED a list of cards
 * being read as a PR that FIXED them, and the desk sweep cross-references cards
 * mechanically every single run. So the rule is that this reading OVER-reports
 * rather than under-reports, because the failure it exists to stop is a debt
 * figure that clears itself. The PR that fixes a card almost always comments or
 * closes it within a day anyway.
 *
 * # The sentence changed with the reading, on purpose
 *
 * "Untouched" is a claim no available signal supports. What is measurable is
 * *no comment, close, reopen or commit in N days*, and that is what the line
 * says now — so a relabel cannot make the sentence false, whatever the reading
 * does. #516's own recommendation was options 1 AND 3 together for exactly this
 * reason: filter to events that mean somebody engaged, and name what is being
 * measured in the sentence he reads.
 *
 * # ⚠ What this still cannot see
 *
 * **A shift re-reading a card against the code and saying nothing leaves no
 * trace anywhere**, so it reads here as rot. That is #516's option 2 — record
 * when a shift last re-read a card — and it needs a mechanism that something
 * actually calls, which is invariant 7's own trap. Stated rather than
 * discovered; the direction is again the safe one.
 */

/**
 * The timeline event kinds that mean a person engaged with the card.
 *
 * ⚠ ONE TABLE, THREE VIEWS — working law 4, and it is not theoretical here.
 * GitHub spells the same event twice: `ISSUE_COMMENT` in the `itemTypes`
 * argument and `IssueComment` in `__typename`, and a query also needs an inline
 * fragment per kind to reach `createdAt`. Three lists of four things is three
 * chances for one of them to drift, and the failure would be SILENT: an event
 * kind asked for but missing its fragment comes back with no date, so a card
 * that was commented on yesterday reads as never engaged with.
 */
const ENGAGEMENT = [
  { typename: "IssueComment", itemType: "ISSUE_COMMENT" },
  { typename: "ClosedEvent", itemType: "CLOSED_EVENT" },
  { typename: "ReopenedEvent", itemType: "REOPENED_EVENT" },
  { typename: "ReferencedEvent", itemType: "REFERENCED_EVENT" },
] as const;

/** `__typename` as it comes back on a timeline node. */
export const ENGAGEMENT_EVENTS: readonly string[] = ENGAGEMENT.map((kind) => kind.typename);

/** The same kinds spelled the way `timelineItems(itemTypes:)` wants them. */
export const ENGAGEMENT_ITEM_TYPES: readonly string[] = ENGAGEMENT.map((kind) => kind.itemType);

/** …and the inline fragments that reach each kind's `createdAt`. */
export const ENGAGEMENT_FRAGMENTS: string = ENGAGEMENT
  .map((kind) => `... on ${kind.typename} { createdAt }`)
  .join("\n            ");

export type TimelineEvent = { readonly type: string; readonly at: string };

export type QueueCard = {
  readonly number: number;
  readonly title: string;
  readonly createdAt: string;
  readonly labels: readonly string[];
  readonly events: readonly TimelineEvent[];
};

/**
 * Timeline nodes as GraphQL returns them, narrowed to the ones this can date.
 *
 * ⚠ A node with no `createdAt` is an event kind the query asked for and no
 * fragment reaches. It is DROPPED rather than kept undated: `Date.parse(
 * undefined)` is NaN, every comparison against NaN is false, and a NaN day
 * count would quietly remove a card from the reading. Dropping it means the
 * card falls back to an older engagement or to its creation — the over-report
 * direction, which is the one this whole reading fails toward.
 */
export function eventsFrom(nodes: readonly unknown[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const node of nodes) {
    const record = node as { __typename?: unknown; createdAt?: unknown };
    if (typeof record.createdAt !== "string" || typeof record.__typename !== "string") continue;
    events.push({ type: record.__typename, at: record.createdAt });
  }
  return events;
}

export type RotReading = {
  readonly card: QueueCard;
  /** The newest moment a person engaged — or the card's own creation. */
  readonly lastEngagedAt: string;
  /** Whole days between that moment and `now`. */
  readonly quietDays: number;
};

/**
 * The newest engagement on a card, falling back to its CREATION.
 *
 * The fallback is not a convenience: a card filed this morning with no events
 * at all has been engaged with — somebody wrote it — and reporting it as
 * quiet-since-the-epoch would put every new card at the top of the rot list.
 */
export function lastEngagedAt(card: QueueCard): string {
  const engagements = card.events
    .filter((event) => (ENGAGEMENT_EVENTS as readonly string[]).includes(event.type))
    .map((event) => event.at);
  return [card.createdAt, ...engagements].reduce((newest, at) => (at > newest ? at : newest));
}

/**
 * Every card quiet for `windowDays` or more, newest-quiet last.
 *
 * `now` is a parameter rather than a `Date.now()` inside, so the arms can drive
 * a boundary rather than sleeping to reach one.
 */
export function quietCards(
  cards: readonly QueueCard[],
  now: Date,
  windowDays: number,
): RotReading[] {
  const readings: RotReading[] = [];
  for (const card of cards) {
    const at = lastEngagedAt(card);
    const quietDays = Math.floor((now.getTime() - Date.parse(at)) / (24 * 60 * 60 * 1000));
    if (quietDays >= windowDays) readings.push({ card, lastEngagedAt: at, quietDays });
  }
  return readings.sort((a, b) => b.quietDays - a.quietDays);
}

/**
 * The sentence for the briefing's queue line — it names what was MEASURED.
 *
 * The line it replaces said "untouched", which is the word the incident made
 * false. A reader of this sentence can tell what would have reset the clock.
 */
export function quietSentence(count: number, windowDays: number): string {
  return count === 0
    ? `no open card has been silent for ${windowDays} days — every one has a comment, close or commit inside the window`
    : `${count} open ${count === 1 ? "card has" : "cards have"} had no comment, close or commit for ${windowDays} days`;
}
