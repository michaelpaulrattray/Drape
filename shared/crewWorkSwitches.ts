/**
 * THE BACKGROUND-WORK SWITCHES — one vocabulary, shared (issue #277).
 *
 * `shared/` because four things key on this list: the mutation that validates
 * what he sets, the panel that draws it, the shift tool that reads it, and the
 * counter that fills the numbers. Four copies of one string list drift, and the
 * first anyone would know is a category he can switch that no shift consults.
 *
 * # WHAT THE SWITCH IS FOR
 *
 * Founder-ordered 2026-08-30: with nothing named as the focus and no side lane
 * running, a shift **stops** unless he has turned this on. It inverts today's
 * default — MAINTENANCE MODE is currently what a shift falls into on its own
 * judgement — and it guards a failure he named himself: *"we need to ensure if
 * they are waiting a long time for me they dont completly over engineer
 * security or anything because they are bored."*
 *
 * Idle is a legitimate state for an autonomous team. Inventing work is not.
 */

/**
 * The seven categories, each DERIVED FROM A LABEL THAT ALREADY EXISTS.
 *
 * ⚠ **`queueLabel` is the whole anti-drift design** (working law 4, and his
 * card says it in capitals): the panel's categories and counts come from the
 * queue's own labels, so **a card relabelled in GitHub moves category on his
 * page without anyone touching the panel.** Not one of these labels was
 * invented for this feature — the first five were already in use by the seats,
 * and the two added by #429 were applied to eighteen existing cards by the
 * relay before the switches existed, so neither row was ever born at zero.
 *
 * A sixth category is a row and a line here, never a migration. ⚠ **THE SIXTH
 * AND SEVENTH ARRIVED 2026-09-04 (#429) AND PROVED THAT SENTENCE AT THE BYTES**
 * — two entries below, no DDL, no ceremony, no founder command. `off` still
 * holds by construction, because off is the ABSENCE of a row in
 * `crew_work_switches` and neither key has one.
 *
 * ⚠ **AND THEY ARE TWO ROWS RATHER THAN ONE, WHICH IS THE POINT OF THEM** (his
 * card): casting is frozen while a milestone is gated on his eye, so a single
 * "small fixes" switch would let a quiet shift touch the casting road on the
 * night he wants it left alone. Two switches let him run Small fixes with
 * Casting upkeep off.
 */
export const CREW_WORK_CATEGORIES = [
  {
    key: "bugs",
    label: "Bugs",
    queueLabel: "bug",
    blurb: "A defect with a named symptom, already filed.",
  },
  {
    key: "security",
    label: "Security",
    queueLabel: "seat:warden",
    blurb: "The Warden's carded findings — never a new security programme.",
  },
  {
    key: "performance",
    label: "Performance",
    queueLabel: "seat:machinist",
    blurb: "The Machinist's ledger — a number before and after, or it is not one.",
  },
  {
    key: "housekeeping",
    label: "Housekeeping",
    queueLabel: "seat:janitor",
    blurb: "The Janitor's list — litter, unused code, the output/ remainder.",
  },
  {
    key: "process",
    label: "Process",
    queueLabel: "seat:retro",
    blurb: "The team's fixes to its own failures.",
  },
  {
    key: "smallFixes",
    label: "Small fixes",
    queueLabel: "small-fix",
    blurb: "Self-contained product and tooling fixes that are neither bugs nor litter.",
  },
  {
    key: "castingUpkeep",
    label: "Casting upkeep",
    queueLabel: "casting-upkeep",
    blurb: "Small casting-road items inside existing behaviour — off while a milestone waits on your eye.",
  },
] as const;

export type CrewWorkCategoryKey = (typeof CREW_WORK_CATEGORIES)[number]["key"];

/**
 * THE ONE CATEGORY A CARD IS HOMED IN — his question, 2026-09-25 (terminal),
 * verbatim: *"why are there so many double-up cards? for example bugs [#1221]
 * is also under casting upkeep. its inflating the card count"*.
 *
 * Until then the live desk listed a card under EVERY category whose label it
 * carried, so a card filed `bug` + `casting-upkeep` was drawn twice and
 * counted twice in the "on offer" numbers (measured: 2 of 53 open cards, one
 * of them the relay's own). The not-on-any-road total was never inflated —
 * it already homes a card once, by its pipeline group — so this makes the
 * categories agree with it.
 *
 * The home is the FIRST category in `CREW_WORK_CATEGORIES` order whose label
 * the card carries, so the precedence is the list's own order and not a
 * second list: a bug is a bug wherever else it lives. `null` for a card with
 * no work label at all — those are the pipeline groups' business, never a
 * category's.
 *
 * ⚠ **The filing rule this makes cheap: ONE work label per card.** The page
 * no longer needs it to draw correctly, but a second label still says
 * something false to a shift reading labels directly, and the stored
 * fallback counts (`scripts/lib/crewQueueCount.mts`, a GitHub search per
 * label) cannot express "first match" and would count the card twice while
 * the live read is unavailable. Zero double-labelled cards is the state to
 * keep, and `server/crewWorkSwitches.test.ts` drives this deriver both ways.
 */
export function homeWorkCategoryFor(labels: readonly string[]): CrewWorkCategoryKey | null {
  for (const category of CREW_WORK_CATEGORIES) {
    if (labels.includes(category.queueLabel)) return category.key;
  }
  return null;
}

/**
 * THE TWO CATEGORIES WHOSE WORK IS A FIX TO LIVE BEHAVIOUR (#1553).
 *
 * `PROGRAM.md`'s MAINTENANCE MODE names exactly this work as what runs when
 * there is no focus at all: *bugs filed by the gate, the patrols, in-app
 * reports, or the founder*, and *improvements that stay INSIDE existing
 * behaviour*. Nothing here decides anything on its own — it is read by the seat
 * lane's rung gate, where a `rung:` label on one of these cards is a LOCATOR
 * (whose territory the fix lives in) rather than a claim that the fix is
 * milestone work.
 *
 * ⚠ **The keys are held to the category list by the compiler, not by care.**
 * `satisfies readonly CrewWorkCategoryKey[]` means renaming or removing a
 * category breaks the build here rather than quietly emptying this set — which
 * is the drift `homeWorkCategoryFor` above exists to avoid, one list further on.
 *
 * ⚠ **`castingUpkeep` is deliberately NOT in it, and that is fail-closed rather
 * than an oversight.** It is also inside-existing-behaviour work, so the
 * argument for it is real; but the card that asked for this named `bug` and
 * `small-fix` and no third thing, and a casting card wearing a rung label is
 * the one shape where "this is the milestone's own work" is most often true.
 * Widening it is a second decision with its own reading.
 */
export const CREW_FIX_CATEGORY_KEYS = [
  "bugs",
  "smallFixes",
] as const satisfies readonly CrewWorkCategoryKey[];

/**
 * Is this card's work a fix to live behaviour?
 *
 * Asked of the card's ONE home category (his rule: one work label per card), so
 * a card filed `bug` + `casting-upkeep` answers on `bug` — a bug is a bug
 * wherever else it lives, which is `homeWorkCategoryFor`'s own precedence and
 * not a second opinion about it. A card with no work label at all answers
 * `false`: those are the pipeline groups' business.
 */
export function isFixWork(labels: readonly string[]): boolean {
  const home = homeWorkCategoryFor(labels);
  return home !== null && (CREW_FIX_CATEGORY_KEYS as readonly string[]).includes(home);
}

/**
 * THE LABEL THAT SAYS A FIX IS THE CREW'S OWN MACHINERY, NOT THE PRODUCT
 * (#1647, his *"i like your idea"*, 2026-10-01).
 *
 * Seven cards filed `bug` or `small-fix` ran all night — #1620 → #1623 → #1625
 * → #1629 → #1635 → #1636 → #1638 — about comment strippers, the child-process
 * guard and the gate's own rules. Real defects, every one found while fixing the
 * one before, and **not one of them a thing a customer can hit.** Meanwhile N2
 * waited on him. His question, verbatim: *"i feel like the crew must have been
 * working background cards while n2 was stuck?"*
 *
 * # ⚠ WHY A LABEL AND NOT THE PATHS THE CARD'S BODY NAMES
 *
 * The card asked for *"a `tooling` label OR a derived reading of the paths the
 * card body names, whichever the seat cut already does for areas — state which,
 * and why."* The derived reading was MEASURED against the card's own positive
 * control, using the seat cut's own `pathsNamedIn`, and **it disagrees on 5 of
 * the 10 cards — every one of them in the direction of OFFERING**, which is the
 * hole this closes:
 *
 * | card | the rule says | the card says | the product path it named |
 * |---|---|---|---|
 * | #1625 | offered | held | `client/src` |
 * | #1629 | offered | held | `client/src` |
 * | #1635 | offered | held | `client/src/features/boards/BoardPage.tsx`, `shared/pictureFormats.ts` |
 * | #1636 | offered | held | `shared/crewNextUpHold.ts` + 7 more |
 * | #1638 | offered | held | `server/casting/evidence/evidenceComposerSchema.ts` |
 *
 * **The reason is structural and no regex fixes it: a tooling card names product
 * paths as the files its INSTRUMENT READS, not as files it changes.** #1635
 * names `BoardPage.tsx` because that is a file whose comments the stripper
 * mis-reads. A card's prose cannot distinguish its SUBJECT from its SPECIMENS.
 *
 * So the gate reads this label — a deliberate act, like `founder-ordered` — and
 * the path reading survives only as a REPORT (`toolingPathReading` in
 * `scripts/lib/seatBatches.mts`), which never holds a card.
 *
 * ⚠ **ABSENT, IT MEANS PRODUCT, and that is the card's own instruction** —
 * *"A card naming no path is product (fail toward offering a real bug)."* An
 * unlabelled tooling card costs the focus one card; an unlabelled customer bug
 * held by a guess costs a customer.
 */
export const CREW_TOOLING_LABEL = "tooling";

/** Is this card's subject the crew's own machinery rather than the product? */
export function isToolingWork(labels: readonly string[]): boolean {
  return labels.includes(CREW_TOOLING_LABEL);
}

/**
 * THE SECOND EXEMPTION — THE ROAD IS DOWN (#1647, his question on #1645,
 * 2026-10-01, verbatim: *"if somthing like this appeared under the new bugs rule
 * because its not customer facing wouldnt the crew be stuck until it was
 * fixed?"*).
 *
 * Yes it would, so a tooling fix still jumps the queue when nothing can merge,
 * deploy or build, or the crew's own machinery is down: the gate, the merge
 * tool, the deploy rite, a required check, the Foreman, the seat gate, the Desk.
 * **An outage of the road is not refinement of it.**
 *
 * ⚠ **IT IS A LABEL BECAUSE IT IS A STATE, NOT A PROPERTY OF THE CARD'S TEXT,
 * and #1645 beside #1620 is the proof.** Both are about `.github/`; one was a
 * required check answering nothing and one was a stripper reading a comment
 * wrong. No reading of either card's prose or paths tells them apart — the
 * difference is whether the line is moving right now, which only a person
 * looking knows. So it is applied deliberately, the way `founder-ordered` is,
 * and its absence means the ordinary rule.
 */
export const CREW_BLOCKS_LINE_LABEL = "blocks-the-line";

/** Is the crew's own road DOWN because of this card — not merely improvable? */
export function blocksTheLine(labels: readonly string[]): boolean {
  return labels.includes(CREW_BLOCKS_LINE_LABEL);
}

/**
 * MAY THIS FIX JUMP THE FOCUS? — the whole of #1647's rule, in one predicate so
 * both gates ask one question rather than two that can drift (working law 4).
 *
 * A `bug` or `small-fix` card jumps the milestone and the focus when EITHER
 * holds, and nothing else does:
 *
 *  1. **a customer can hit it** — it is not tooling; or
 *  2. **it blocks the line** — the road is down.
 *
 * Everything else labelled `bug`/`small-fix` is tooling REFINEMENT: still work,
 * still real, and it waits behind the focus like a switch card.
 *
 * ⚠ **A card with no work label at all answers `false` here and that is not a
 * hold** — `isFixWork` is what the callers ask first, and a feature-shaped card
 * was never exempt in the first place.
 */
export function fixJumpsTheQueue(labels: readonly string[]): boolean {
  if (!isFixWork(labels)) return false;
  return blocksTheLine(labels) || !isToolingWork(labels);
}

/** The master switch's key. Off here means nothing runs, whatever the rest say. */
export const CREW_WORK_MASTER_KEY = "master";

/** Every key the store accepts — the master plus every category above. */
export const CREW_WORK_SWITCH_KEYS = [
  CREW_WORK_MASTER_KEY,
  ...CREW_WORK_CATEGORIES.map((category) => category.key),
] as const;

export type CrewWorkSwitchKey = (typeof CREW_WORK_SWITCH_KEYS)[number];

/*
 * ⚠ There is deliberately NO `isCrewWorkSwitchKey` guard here, and its absence
 * is a decision rather than an omission. One was written and then deleted when
 * the uncalled-export sweep found it had no caller: the wire is validated by
 * `z.enum(CREW_WORK_SWITCH_KEYS)` in `server/routes/crew.ts`, and both
 * shift-side readers filter against the same array directly. Inventing a
 * consumer to satisfy the sweep would have been the sweep working backwards.
 */

/** The switches as the page and the shift tools see them: key → on/off. */
export type CrewWorkSwitchState = Readonly<Record<string, boolean>>;

/**
 * Whether a shift may take background work in this category RIGHT NOW.
 *
 * ⚠ **THE MASTER IS AN AND, NOT A DEFAULT.** Master off means nothing runs
 * however many categories are on — which is what makes one tap from bed
 * actually stop the team, rather than requiring him to find and clear every
 * switch one at a time.
 *
 * ⚠ **AND A MISSING KEY IS FALSE, WHICH IS HIS BAR** — *"a fresh install, a
 * lost row, an unreadable value: OFF."* `?? false` rather than `?? true` is the
 * single most important character in this file: the failure direction is the
 * one where nothing runs.
 */
export function backgroundWorkAllowed(
  switches: CrewWorkSwitchState,
  category: CrewWorkCategoryKey,
): boolean {
  return (switches[CREW_WORK_MASTER_KEY] ?? false) && (switches[category] ?? false);
}

/** Whether ANY background work is permitted — the question a shift asks first. */
export function anyBackgroundWorkAllowed(switches: CrewWorkSwitchState): boolean {
  return CREW_WORK_CATEGORIES.some((category) => backgroundWorkAllowed(switches, category.key));
}
