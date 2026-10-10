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
 * So the panel reads **`Bugs (11 on offer, 2 already queued)`** rather than `Bugs (11)`
 * (the `on offer` half is #663, which named the number the clause made smaller).
 * A number that quietly got smaller is indistinguishable from a broken counter,
 * and this panel exists precisely because he could not tell those apart.
 *
 * # WHY A VOCABULARY RATHER THAN A COLUMN PER REASON
 *
 * Three reasons shipped first (#325 groups the other open cards by the labels they
 * carry). **The third one is the proof the shape was right**: `blocked` arrived
 * as ONE entry in the array below and nothing else — no migration, no reader
 * change, no panel edit, because every consumer walks this list. A column per
 * reason would have been four edits and a ceremony. A column per reason is working law
 * 4's second list wearing a schema: the reasons would live once in the DDL,
 * once in the writer, once in the reader and once in the panel. One JSON value
 * keyed by reason means a new reason is a row in the array BELOW and nothing
 * else — no migration, no ceremony, no founder act.
 *
 * ⚠ **AND THE REASONS ARE DERIVED FROM LABELS THAT ALREADY EXIST**, exactly as
 * `shared/crewWorkSwitches.ts`'s categories are: `founder-ordered` is the
 * relay's own label, `parked` is the queue's, and `blocked` is the one the desk
 * sweep and the standing orders already write. Not one was invented here, so
 * a card relabelled in GitHub moves between offered and excluded on his page
 * with nobody touching this file.
 *
 * ⚠ **AND THE HOLD ROWS ARE NOT TYPED HERE ANY MORE (#999, 2026-09-16).**
 * `blocked` was a literal in this file while `shared/crewNextUpHold.ts` owns the
 * whole hold vocabulary — `blocked`, `awaiting-fable`, `needs-sitting` — so
 * the two lists had already drifted: a card held for a Fable session or a
 * sitting was COUNTED AS ON OFFER. Measured the night it was found: `#841`
 * (`seat:janitor` + `awaiting-fable`) sat in *Housekeeping (3 on offer)*, a
 * number the park gate reads as work, so the nights kept launching sessions to
 * rediscover that no Opus shift may take it. Each hold row now reads its label
 * from `CREW_HOLD_LABELS`, and an arm holds every hold label to having a row.
 *
 * # ⚠ THE PARSE IS HOSTILE-INPUT SAFE, FOR `crewQueueTitles.ts`'s REASON
 *
 * The column holds a JSON string written by a script, and his ENTIRE Crew tab
 * is one `crew.getState` call — a throw in this projection is a blank page for
 * the founder. So a malformed, truncated or half-written value degrades to NO
 * EXCLUSIONS, which draws exactly the panel he has today.
 */

import { CREW_NOT_BUILT_LABEL } from "./crewCardBuildState";
import { CREW_HOLD_LABELS } from "./crewNextUpHold";

/**
 * HIS RESEARCH TEAM'S OWN LABEL — declared here because THREE readers want it
 * and a fourth would have typed it again (#1548).
 *
 * His Grok team (a project manager, a standing engineering watcher, and Terra on
 * a weekly round) posts proposals to HIS NOTION DESK. Only what he approves
 * reaches this queue, and then it arrives as ORDINARY work opening *"Approved by
 * Michael on the Notion desk"* — **without this label**, which is the relay's
 * scope note on #1548 and the whole reason one label can mean *never work*.
 *
 * So `research` marks **a proposal or a finding nobody has acted on**, and the
 * three readers are: the exclusion row below, the `research` pipeline group that
 * draws it on his page (`shared/crewPipelineGroups.ts`), and the seat cut's
 * ordered-band arm (`scripts/lib/seatBatches.mts`). It is an exported constant
 * rather than a `.find()` over the array below — which is how `PARKED_LABEL` and
 * `ORDERED_BAND_LABEL` are taken — because two of those three readers do not
 * otherwise want this array at all, and a lookup by key is a second spelling of
 * the key.
 */
export const RESEARCH_LABEL = "research";

/**
 * One reason a card carrying a category's label is nevertheless not offered.
 *
 * `label` is the words the panel says — lower case, because it is read inside
 * a parenthesis mid-sentence: *(11 on offer, 2 already queued)*.
 *
 * ⚠ **`holdsOffWork` IS THE FIELD THAT ARRIVED WITH THE SEVENTH ROW, AND IT
 * EXISTS BECAUSE THIS VOCABULARY ACQUIRED A SECOND KIND OF READER** (#2231).
 * For six rows the count's question and the seat cut's question had one answer:
 * *not offered* meant both *subtract it from his number* and *never hand it to a
 * seat*. `refused` separates them — his own ruling is that a refusal ANNOTATES a
 * card and leaves it on offer (`shared/crewCardBuildState.ts`'s
 * `CREW_NOT_BUILT_LABEL`, Crew reply #237, option A), while the number under his
 * switches must stop calling declined work fresh. So every row answers the
 * question out loud: `true` — real work no seat may take; `false` — a reason the
 * COUNT reports and the CUT ignores.
 *
 * ⚠ **IT IS REQUIRED ON EVERY ROW ON PURPOSE AND TYPESCRIPT ENFORCES THAT.**
 * `as const` makes this array a tuple of literal types, so `[number]` is a union
 * and `reason.holdsOffWork` does not typecheck if ONE row omits it — an eighth
 * row cannot be added without answering the question, which is the whole reason
 * it is a field rather than a list of count-only keys kept somewhere else
 * (working law 4, the shape this module's own header is about).
 */
export const QUEUE_EXCLUSION_REASONS = [
  {
    key: "research",
    /**
     * ⚠ **FIRST, AND IT IS THE ONLY ROW HERE THAT SAYS THE CARD IS NOT WORK AT
     * ALL** (#1548). Every other row answers *"real work, not offered right
     * now"* — being built, queued, parked, blocked. This one answers *"this was
     * never a work item"*, and nothing else the card carries changes that: a
     * proposal cannot be built, cannot be parked as work, and cannot be queued
     * by him as work while it still wears this label.
     *
     * **So it outranks even `building`.** If a `research` card ever acquires a
     * pull request, *being built* would read as the work happening and hide the
     * filing mistake; *research* is the honest fact and the one he can act on
     * — the proposal belongs on his Notion desk, and an approved one comes back
     * as its own card without this label.
     *
     * ⚠ **THE SHAPE THIS ROW ACTUALLY GUARDS IS `research` BESIDE A WORK
     * LABEL.** A `research`-only card carries no category, so no switch count
     * ever consults this function about it — the pipeline group draws it
     * instead. What this row is for is the day somebody adds `bug` or
     * `small-fix` to a proposal: `homeWorkCategoryFor` would answer with that
     * category, the card would enter a switch's offered population, and a seat
     * would take his research team's proposal as tonight's work. The exclusion
     * has to be **by name** rather than by the accident of a missing category.
     */
    queueLabel: RESEARCH_LABEL,
    label: "research",
    /* A proposal is not work at all, so it is the strongest no of the seven. */
    holdsOffWork: true,
    blurb: "Your team's proposals — decided on your Notion desk, never work for a seat.",
  },
  {
    key: "building",
    /**
     * ⚠ **THE ONLY ROW THAT IS NOT A LABEL, AND THAT IS WHY IT IS A ROW AT ALL**
     * (#1094 piece 2). His order, 2026-09-26 (terminal), verbatim: ***"work on
     * 1094 and 1307 next so the desk shows whats built"*** — said after this very
     * panel offered him #1231, #1217, #1258, #1248 and #1288 as tonight's work
     * while every one of them had a pull request in the merge queue or a refusal
     * on the card. That is his 2026-08-31 question — *"how do we know they are
     * not already scheduled to be fixed in current pipeline or work?"* — answered
     * for the one case a label cannot answer it for: **nobody labels a card
     * "somebody is building this"; the pull request and the claim comment ARE the
     * fact**, and `shared/crewCardBuildState.ts` is the one judgement that reads
     * them.
     *
     * ⚠ **IT OUTRANKS `ordered`.** A card he queued AND
     * somebody is building is subtracted either way — the offered count is the
     * same number — so the order only decides which sentence he reads, and
     * *being built* is the sharper of the two: *already queued* tells him where
     * the card sits, *being built* tells him the work is happening right now,
     * which is the thing he opened this panel to find out.
     *
     * ⚠ **THIS CLAUSE OPENED *"IT IS FIRST"* UNTIL #1548 PUT `research` ABOVE
     * IT, and the argument above is untouched by that** — it is about this row
     * against `ordered`, and both of those are about REAL WORK. `research` wins
     * only because a proposal is not work at all, which is a different question
     * and is stated in that row rather than here.
     */
    queueLabel: null,
    label: "being built",
    /* An open pull request or a live claim — a second seat on it is the
       collision the board exists to prevent. */
    holdsOffWork: true,
    blurb: "Somebody is on it right now — an open pull request, or a claim on the card.",
  },
  {
    key: "ordered",
    /** The relay's label on a card he asked for by name. */
    queueLabel: "founder-ordered",
    label: "already queued",
    /* The focus lane's, never a seat's — the cut says exactly that. */
    holdsOffWork: true,
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
    /* Stopped on his own ruling; a seat overturning that is not a reading. */
    holdsOffWork: true,
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
  {
    key: "blocked",
    queueLabel: CREW_HOLD_LABELS.blocked,
    label: "blocked",
    holdsOffWork: true,
    /**
     * ⚠ **`Process (5)` WAS TRUE OF THE LABEL AND FALSE OF THE PRODUCT, AND IT
     * IS THE `Security (0)` DEFECT ABOVE WEARING THE OTHER SIGN.** That one was
     * a count too SMALL to be alarming; this one is a count too LARGE to be
     * true. Measured on the live panel: five cards carried a Process seat and
     * **four could be worked** — `#513` waits on an external condition nobody
     * here controls, so a shift flipping Process on was promised a card it
     * would then have to put back. The row reads `Process (4 on offer, 1
     * blocked)` now.
     *
     * ⚠ **AND THE POPULATION IS EXPECTED TO GROW, WHICH IS WHY THIS IS A ROW
     * AND NOT A ONE-OFF.** `blocked` is not an occasional hand label:
     * `crew-desk-sweep.mts` re-derives holds from his desk every close and
     * applies it, and the standing orders instruct shifts to apply it in two
     * more places. **Every card that joins it inflated a count by one.**
     *
     * ⚠ **IT IS LAST, SO `parked` OUTRANKS IT — the same argument the clause
     * above makes.** First match wins, so a card carrying both counts once,
     * and what he needs to know about a card he PARKED is that he parked it;
     * `blocked` is a circumstance, `parked` is his own ruling. There is no such
     * card today (measured: zero open cards carry both), so the order is
     * written down here rather than discovered later.
     *
     * ⚠ **ONE LABEL, TWO MEANINGS, DELIBERATELY NOT SPLIT.** `blocked` covers
     * *waiting on him* and *waiting on another card*. For COUNTING they are the
     * same fact — a shift cannot take either — and the card names which. If the
     * panel should ever say them differently that is a second label and a
     * separate decision, not a second row here.
     */
    blurb: "Waiting on something the card names — you, or another card.",
  },
  {
    key: "fable",
    queueLabel: CREW_HOLD_LABELS.fable,
    label: "awaiting Fable",
    holdsOffWork: true,
    /**
     * ⚠ **THE `blocked` DEFECT AGAIN, ONE LABEL OVER (#999).** `#541`'s rule
     * makes this label mean *a design decision, or a change to what he judges*,
     * and the standing orders bar an Opus shift from both. Counting it kept
     * `check-park.ps1` from parking on nights where it was the only card left.
     *
     * ⚠ **THIS BLOCK SAID *"nothing launches a Fable session for a BACKGROUND
     * card — `next-up-escalation.mts` reads NEXT UP only"* UNTIL #1258, AND
     * THAT SENTENCE IS NOW HALF TRUE.** The gate reads his ordered band AND the
     * urgent band, so a background card carrying `urgent` + `awaiting-fable`
     * IS escalated now. #1222 is the specimen: `bug` + `urgent` + `rung:N2`,
     * judgment-class, frozen because the gate read one band. A background card
     * that is merely switch-reached is still not on offer — it takes his
     * `urgent` to reach the gate.
     *
     * After `blocked`, so a card carrying both reads as blocked: a Fable
     * session could not take it either while the thing it waits on stands.
     */
    blurb: "Needs a Fable session to decide something first — the card says what.",
  },
  {
    key: "sitting",
    queueLabel: CREW_HOLD_LABELS.sitting,
    label: "awaiting a sitting",
    holdsOffWork: true,
    /**
     * The third hold label, included for the same reason and found by the same
     * sweep: no open card carries it today (`#279` did, and closed), so this row
     * costs nothing until one does, and then it cannot inflate a count by one.
     */
    blurb: "Waits on you at the machine — the card says what.",
  },
  {
    key: "refused",
    /**
     * ⚠ **THE ONLY COUNT-ONLY ROW, AND THE FIRST REASON HERE THAT DOES NOT MEAN
     * *nobody may work this*** (#2231, Retro patrol #7's R19). A shift that
     * reads a card and declines it applies `not-built`, and **his ruling is
     * that this neither closes the card nor takes it off offer** (Crew reply
     * #237, option A — a refusal is a shift's READING and readings are
     * overturned here). The argument lives on `CREW_NOT_BUILT_LABEL`.
     *
     * **But the NUMBER under his switches is a different question from the
     * CUT**, and it was answering the cut's. A standing refusal kept a category
     * off zero for as long as the label sat there, so:
     *
     *  - his panel read *Bugs — N open* over cards seats had already declined;
     *  - the park gate's short road (`.agents/foreman/check-park.ps1`, #504)
     *    needs every enabled category at zero on fresh counts, so the team
     *    could not park and **every pass re-offered the card**.
     *
     * **#2198 cost six sessions in one day** — five that wrote on the card and a
     * sixth whose decline survives only in a shift close note — and the seat
     * that got there sixth stopped it BY HAND, by applying `blocked`. A label a
     * shift chose is not a thing the machinery did, which is why this row
     * exists. Measured at the fix (2026-10-11, read at `gh issue list`): three
     * open cards carry `not-built`; `#1736` (`bug` + `not-built`) was the whole
     * of *Bugs — 1 on offer*, and `#1585` carries no work label so no switch
     * count ever consulted this function about it. **The card's own figure of
     * two was true when it was filed and is one at HEAD** — because `#2198` is
     * the card that was stopped by hand.
     *
     * ⚠ **AND IT IS LAST, WHICH IS CORRECTNESS HERE AND NOT PROSE.** First match
     * wins, so a row placed above a work-holding one would hand the cut the word
     * *refused* for a card that is also `parked` or `blocked` — and the cut
     * ignores this row, so it would then OFFER a parked card. Being last makes
     * that unreachable; `workHoldExclusionFor` below makes it unreachable even if
     * somebody reorders the array, and both arms are driven. `#2198` is exactly
     * that shape today (`bug` + `blocked` + `not-built`) and reads as *blocked*.
     *
     * ⚠ **THE TRADEOFF IS HIS AND IT IS STATED RATHER THAN BURIED** (the card's
     * own closing paragraph): the team CAN now park while a refused card sits
     * open. That is the intended effect. A park un-parks on queue activity, a
     * reply, a new pull request or the 24-hour heartbeat, so the refusal is
     * re-looked at on the next real signal instead of being re-read by a fresh
     * session every pass.
     */
    queueLabel: CREW_NOT_BUILT_LABEL,
    label: "refused",
    /**
     * ⚠ **`false`, AND IT IS THE ONLY `false` IN THIS ARRAY.** The card must
     * still reach a seat that wants to overturn the reading — that is his
     * ruling, and this row does not reopen it. `buildStateHoldsOffOffer` is
     * untouched, the refusal still travels into the batch as the seat's
     * `annotation`, and `server/seatBatches.test.ts` keeps the arm that proves a
     * refused card is STILL takeable.
     */
    holdsOffWork: false,
    blurb: "A shift read it and declined — the reason is on the card, and it is still on offer.",
  },
] as const;

export type CrewQueueExclusionKey = (typeof QUEUE_EXCLUSION_REASONS)[number]["key"];

/** How many cards each reason took out of a category's count. */
export type CrewQueueExclusions = Readonly<Partial<Record<CrewQueueExclusionKey, number>>>;

/** Every reason key, in the order the panel says them. */
const REASON_KEYS: readonly string[] = QUEUE_EXCLUSION_REASONS.map((reason) => reason.key);

/**
 * Which reason excludes this card from THE COUNT, or `null` if it is genuinely
 * on offer.
 *
 * ⚠ **THIS IS THE COUNT'S QUESTION AND SINCE #2231 IT IS NOT THE CUT'S.** Every
 * row answers here, including the count-only `refused`; a seat asks
 * `workHoldExclusionFor` above, which never sees that row. The two were one
 * question for six rows and the seventh separated them — his panel must stop
 * calling a declined card fresh work, and the card must still reach a seat that
 * wants to overturn the reading.
 *
 * ⚠ **FIRST MATCH WINS, AND THE ORDER IS THE VOCABULARY'S.** A card can carry
 * both labels; counting it twice would make the exclusions sum to more than the
 * cards they came from, which is the arithmetic his panel must never print.
 * Each row carries its own place in that order and why; `research` is first
 * because it is the one row that says the card is not work at all. ⚠ **This
 * sentence read *"`ordered` is first for the reason in its own blurb above"*
 * until #1548 and was already wrong — `building` went above `ordered` with
 * #1094 and this line was not moved with it.** A docblock naming which row is
 * first is a second copy of the array's order, so it names none of them now.
 * ⚠ **What the order still decides, and it is correctness rather than prose: a
 * count-only row goes LAST**, so a card carrying both a refusal and a real hold
 * answers with the hold. `refused`'s own block carries the reasoning, and
 * `workHoldExclusionFor` makes the cut safe against a reorder either way.
 *
 * Written to take the raw label list a `gh issue list --json labels` row
 * carries, so the caller does no shaping and cannot shape it differently from
 * the next caller.
 */
/**
 * THE REASONS THAT HOLD A CARD OFF A SEAT — the subset the SEAT CUT asks about
 * (#2231).
 *
 * Derived from the field rather than listed, so a row added above cannot quietly
 * join or leave this set, and nothing here is a second copy of the array's
 * order. `scripts/lib/seatBatches.mts` is its one production consumer.
 */
export const WORK_HOLDING_REASONS = QUEUE_EXCLUSION_REASONS.filter((reason) => reason.holdsOffWork);

/**
 * The walk both questions share — first match over whichever rows were handed in.
 *
 * ⚠ **ONE WALKER, TWO POPULATIONS.** The alternative was a second loop in
 * `workHoldExclusionFor`, which is the `beingBuilt` special case written twice
 * — and the day somebody adds a second label-less row, one of the two copies
 * gets it. This module's whole header is about not doing that.
 */
function firstMatchOver(
  rows: readonly { readonly key: string; readonly queueLabel: string | null }[],
  labels: readonly string[],
  beingBuilt: boolean,
): CrewQueueExclusionKey | null {
  for (const reason of rows) {
    if (reason.queueLabel === null) {
      if (reason.key === "building" && beingBuilt) return reason.key as CrewQueueExclusionKey;
      continue;
    }
    if (labels.includes(reason.queueLabel)) return reason.key as CrewQueueExclusionKey;
  }
  return null;
}

/**
 * WHY A SEAT MAY NOT TAKE THIS CARD, or `null` — the CUT's question, which is
 * narrower than the count's (#2231).
 *
 * Same labels, same first-match rule, same `beingBuilt` contract — over the
 * work-holding rows alone. A count-only reason (`refused` today) answers `null`
 * here, which is his ruling that a refusal annotates a card and leaves it on
 * offer; a card carrying BOTH a refusal and a real hold still answers with the
 * hold, because this walk never sees the count-only row at all.
 */
export function workHoldExclusionFor(
  labels: readonly string[],
  beingBuilt: boolean = false,
): CrewQueueExclusionKey | null {
  return firstMatchOver(WORK_HOLDING_REASONS, labels, beingBuilt);
}

export function exclusionFor(
  labels: readonly string[],
  /**
   * Is somebody already building this card? The caller answers it, through
   * `shared/crewCardBuildState.ts`'s `buildStateHoldsOffOffer` — the fact is a
   * pull request and a comment rather than a label, so it cannot be read off the
   * list above. ⚠ **DEFAULT `false`**: a caller that cannot see the board
   * subtracts nothing and draws exactly the panel it drew before this row
   * existed. An unread board must never make a count smaller.
   */
  beingBuilt: boolean = false,
): CrewQueueExclusionKey | null {
  return firstMatchOver(QUEUE_EXCLUSION_REASONS, labels, beingBuilt);
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
