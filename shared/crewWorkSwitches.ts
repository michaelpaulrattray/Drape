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
    blurb: "Small casting-road items inside existing behaviour; off while a casting milestone waits on your eye.",
  },
] as const;

export type CrewWorkCategoryKey = (typeof CREW_WORK_CATEGORIES)[number]["key"];

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
