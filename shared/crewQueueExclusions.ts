/**
 * WHAT THE SWITCH COUNT LEAVES OUT, AND SAYS SO (#324).
 *
 * Founder, 2026-08-31, at the live panel: *"it says 13 bugs etc where do these
 * bugs come from how are they calculated etc? **how do we know they are not
 * already scheduled to be fixed in current pipeline or work?**"*
 *
 * He was right, and it was measured: **two of the thirteen bugs were `#320` and
 * `#316`, both `founder-ordered` and both already sitting in NEXT UP.** The
 * count filtered on the category label alone and excluded nothing, so the same
 * card was offered to him twice — once as work he had queued, and again as
 * background work a shift may pick up on its own judgement. Flip Bugs on and a
 * shift could take something already at the top of his ordered list.
 *
 * # ⚠ THE EXCLUSION IS SHOWN, NEVER SILENT — THAT IS THE WHOLE MODULE
 *
 * His card's own words: *"A count that silently shrinks for an invisible reason
 * is the confident-wrong-number failure this panel already exists to avoid."*
 * So the panel reads **`Bugs (11, 2 already queued)`** rather than `Bugs (11)`.
 * A number that quietly got smaller is indistinguishable from a broken counter,
 * and this panel exists precisely because he could not tell those apart.
 *
 * # WHY A VOCABULARY RATHER THAN A COLUMN PER REASON
 *
 * Two reasons ship today and a third is already carded (#325 groups the other
 * 71 open cards by the labels they carry). A column per reason is working law
 * 4's second list wearing a schema: the reasons would live once in the DDL,
 * once in the writer, once in the reader and once in the panel. One JSON value
 * keyed by reason means a new reason is a row in the array BELOW and nothing
 * else — no migration, no ceremony, no founder act.
 *
 * ⚠ **AND THE REASONS ARE DERIVED FROM LABELS THAT ALREADY EXIST**, exactly as
 * `shared/crewWorkSwitches.ts`'s categories are: `founder-ordered` is the
 * relay's own label and `parked` is the queue's. Not one was invented here, so
 * a card relabelled in GitHub moves between offered and excluded on his page
 * with nobody touching this file.
 *
 * # ⚠ THE PARSE IS HOSTILE-INPUT SAFE, FOR `crewQueueTitles.ts`'s REASON
 *
 * The column holds a JSON string written by a script, and his ENTIRE Crew tab
 * is one `crew.getState` call — a throw in this projection is a blank page for
 * the founder. So a malformed, truncated or half-written value degrades to NO
 * EXCLUSIONS, which draws exactly the panel he has today.
 */

/**
 * One reason a card carrying a category's label is nevertheless not offered.
 *
 * `label` is the words the panel says — lower case, because it is read inside
 * a parenthesis mid-sentence: *(11, 2 already queued)*.
 */
export const QUEUE_EXCLUSION_REASONS = [
  {
    key: "ordered",
    /** The relay's label on a card he asked for by name. */
    queueLabel: "founder-ordered",
    label: "already queued",
    /**
     * ⚠ **THIS IS HIS OWN QUESTION AND IT OUTRANKS `parked`.** A card that is
     * both ordered and parked counts here and not below: what he needs to know
     * about it is that HE queued it, not that it is stopped.
     */
    blurb: "You have already queued it — it is in NEXT UP.",
  },
  {
    key: "parked",
    queueLabel: "parked",
    label: "parked",
    /**
     * ⚠ **`Security (0)` WAS TRUE OF THE LABEL AND FALSE OF THE PRODUCT.**
     * `#45` — the scoped penetration probe — is a real security card, and
     * `(0)` on a security row is the single most reassuring number on the
     * page. It is correctly not OFFERED, because it is parked on a ruling; but
     * *"nothing is queued"* and *"nothing exists"* must not look identical on
     * that row of all rows. Labelling `#45` `seat:warden` and excluding parked
     * cards out loud makes the row read `Security (0), 1 parked` — the true
     * sentence, and the one that stops being reassuring when it should.
     */
    blurb: "Stopped on your own ruling — the card names which.",
  },
] as const;

export type CrewQueueExclusionKey = (typeof QUEUE_EXCLUSION_REASONS)[number]["key"];

/** How many cards each reason took out of a category's count. */
export type CrewQueueExclusions = Readonly<Partial<Record<CrewQueueExclusionKey, number>>>;

/** Every reason key, in the order the panel says them. */
const REASON_KEYS: readonly string[] = QUEUE_EXCLUSION_REASONS.map((reason) => reason.key);

/**
 * Which reason excludes this card, or `null` if it is genuinely on offer.
 *
 * ⚠ **FIRST MATCH WINS, AND THE ORDER IS THE VOCABULARY'S.** A card can carry
 * both labels; counting it twice would make the exclusions sum to more than the
 * cards they came from, which is the arithmetic his panel must never print.
 * `ordered` is first for the reason in its own blurb above.
 *
 * Written to take the raw label list a `gh issue list --json labels` row
 * carries, so the caller does no shaping and cannot shape it differently from
 * the next caller.
 */
export function exclusionFor(labels: readonly string[]): CrewQueueExclusionKey | null {
  for (const reason of QUEUE_EXCLUSION_REASONS) {
    if (labels.includes(reason.queueLabel)) return reason.key;
  }
  return null;
}

/**
 * The stored JSON for one category's row.
 *
 * A reason with ZERO is dropped rather than stored: the value is read back as
 * "which reasons took something out", and a stored zero is a reason that took
 * nothing, which the sentence below would then have to filter anyway.
 */
export function serializeQueueExclusions(exclusions: CrewQueueExclusions): string {
  const kept: Record<string, number> = {};
  for (const key of REASON_KEYS) {
    const value = (exclusions as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) kept[key] = value;
  }
  return JSON.stringify(kept);
}

/**
 * The stored JSON back into counts, or nothing at all.
 *
 * ⚠ **EMPTY IS THE ONLY FAILURE MODE**, for `parseQueueTitles`' reason. `null`
 * (the column exists and no shift has written it), `""`, a truncated string, an
 * array where an object belongs, a reason this vocabulary does not name, a
 * negative or fractional count — every one yields `{}`, which draws the count
 * alone. That is today's panel, so the degraded state is one he has already
 * seen and understood.
 */
export function parseQueueExclusions(raw: unknown): CrewQueueExclusions {
  if (typeof raw !== "string" || raw.trim().length === 0) return {};
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return {};
  const kept: Record<string, number> = {};
  for (const key of REASON_KEYS) {
    const value = (decoded as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) kept[key] = value;
  }
  return kept as CrewQueueExclusions;
}

/**
 * What the panel says after the number — `"2 already queued"`, `"2 already
 * queued, 1 parked"` — or `null` when nothing was excluded.
 *
 * ⚠ **`null` RATHER THAN AN EMPTY STRING**, so the panel draws no comma, no
 * parenthesis and no trailing space for a category that excluded nothing. The
 * common row is `Process (12)` and it must look exactly as it does today.
 */
export function queueExclusionSentence(exclusions: CrewQueueExclusions): string | null {
  const parts: string[] = [];
  for (const reason of QUEUE_EXCLUSION_REASONS) {
    const value = exclusions[reason.key];
    if (typeof value === "number" && value > 0) parts.push(`${value} ${reason.label}`);
  }
  return parts.length === 0 ? null : parts.join(", ");
}
