/**
 * THE CARD CATEGORY READER — stage 1 of #1224, and it is a CHECK (his ruling
 * 2026-09-25: *"Where-ever jev can genuinely improve my agents workflow it
 * should be used."*).
 *
 * It asks Jev which of the crew's work categories a card is, records the answer
 * beside the label the card actually carries, and WRITES NOTHING. Stage 2 — a
 * writer for cards that arrive with no work label at all — is gated on this
 * stage's controls reporting, which is working law 2 in its plainest form: a
 * new reader gets a negative control and a positive control before its verdicts
 * count for anything.
 *
 * # THE POPULATION IS DERIVED; THE CRITERIA ARE NOT, AND THAT IS DELIBERATE
 *
 * `CREW_WORK_CATEGORIES` is the source of truth for WHICH categories exist, and
 * the option list below is built from it — so a category added there is asked
 * about here without anyone touching this file, and `categoryCriteria` REFUSES
 * if a category exists with no criterion or a criterion names no category.
 *
 * ⚠ **The `blurb` on each category is NOT reused as the criterion, and that is
 * the interesting half.** Working law 4 says derive rather than mirror, but it
 * has a precondition that has bitten this repository before: deriving from a
 * shared set that answers a DIFFERENT question is a silent behaviour change
 * wearing a refactor's clothes. A blurb answers *"what happens when the founder
 * turns this switch on"* — "The Warden's carded findings — never a new security
 * programme" is about a seat's remit, not about what a card IS. The criteria
 * below answer *"what makes a card belong to this category"*, which is the
 * question actually being asked. The LIST is derived; the DESCRIPTIONS are
 * written for the question, and the guard keeps them in step with the list.
 *
 * # WHAT THE READER IS NOT SHOWN
 *
 * ⚠ **The card's labels never go on the wire.** A reader shown the answer
 * agrees with it, and every agreement number this produces would be worthless.
 * `buildCardState` carries the title and body only, and an arm asserts the
 * request contains no work label. The honest limit that remains is stated
 * rather than hidden: a card's BODY may mention its own category in prose, and
 * the check measures and reports how many do rather than claiming it cannot
 * happen.
 */
import { CREW_WORK_CATEGORIES, type CrewWorkCategoryKey } from "../../shared/crewWorkSwitches.js";
import { buildSystemOneRequest, type JevChoiceQuestion } from "./jev.mjs";

/** The answer a card gets when no category fits. Named, so it is never a silent default. */
export const NO_CATEGORY = "none of these";

export const CARD_CATEGORY_QUESTION_ID = "workCategory";

/**
 * What makes a card belong to each category — written for the classification
 * question, keyed by the category's own key so the list cannot drift.
 */
const CRITERIA_BY_KEY: Record<CrewWorkCategoryKey, string> = {
  bugs: "Something in the SHIPPED PRODUCT behaves wrongly for a CUSTOMER using it: a wrong number on screen, a control that does not work, data shown that should not be, a crash. If what is behaving wrongly is the team's own tooling, scripts or records rather than the product a customer uses, this is not the category. If the fault is that someone can reach data they are not entitled to, that is security rather than this.",
  security: "Access control, authentication, sessions, secrets, abuse prevention, or hardening against an attacker. Who is allowed to see or do what.",
  performance: "Something is measurably slow, wasteful or expensive, and the card is about making it faster or cheaper. A speed or cost number is the point of it.",
  housekeeping: "Removing what is no longer used: dead code, leftover files, stale documents, unused exports. Tidying that changes no behaviour at all.",
  process: "The team's OWN tooling and records rather than the product a customer uses: build scripts, test guards, instruments, the queue, the shift workflow, the crew page's machinery, documentation of how the team works. A fault IN that tooling belongs here and not under a product defect.",
  smallFixes: "A small, self-contained correction to the product or its tooling that is neither a visible defect nor removal of dead material: a wording change, a constant, one property, a tidier shape.",
  castingUpkeep: "Maintenance of the casting studio road specifically — prompts, rolls, candidates, signing, the casting sheet — inside behaviour that already exists, rather than a new casting capability.",
};

/**
 * THE COVERAGE GUARD, AS ITS OWN FUNCTION SO IT CAN BE DRIVEN DIRECTLY.
 *
 * ⚠ **It was originally a pair of loops inside `categoryCriteria`, and the
 * sabotage run caught that** (working law 3: a backstop needs a test the model
 * cannot rescue). Every category has a criterion at the real tree, so the throw
 * branch never executes on the happy path — neutering it changed nothing any
 * arm could see, and the suite stayed green at 19 while the guard was gone.
 * A guard reachable only through data that never occurs is not a guard.
 *
 * Both directions matter and they fail differently. A category with no
 * criterion is dropped from the option list, so Jev **cannot choose it** — and
 * that reads as "the reader never files anything there", a finding about the
 * categories that is really a hole in the reader. A criterion naming no live
 * category is a leftover that quietly offers Jev an answer the desk cannot
 * home.
 */
export function assertCriteriaCover(
  categoryKeys: readonly string[],
  criterionKeys: readonly string[],
): void {
  for (const key of categoryKeys) {
    if (!criterionKeys.includes(key)) {
      throw new Error(`jevCardCategory: category "${key}" has no criterion`);
    }
  }
  for (const key of criterionKeys) {
    if (!categoryKeys.includes(key)) {
      throw new Error(`jevCardCategory: criterion "${key}" names no live category`);
    }
  }
}

/** The option set put to Jev: every live category, plus an explicit way out. */
export function categoryCriteria(): Record<string, string> {
  const categoryKeys = CREW_WORK_CATEGORIES.map((category) => category.key);
  assertCriteriaCover(categoryKeys, Object.keys(CRITERIA_BY_KEY));
  const criteria: Record<string, string> = {};
  for (const key of categoryKeys) {
    criteria[key] = CRITERIA_BY_KEY[key as CrewWorkCategoryKey];
  }
  criteria[NO_CATEGORY] = "None of the above describes this card.";
  return criteria;
}

/**
 * ⚠ **THE PRECEDENCE SENTENCE IS DERIVED FROM THE LIST ORDER, because the desk
 * homes a card that way and the two must not be able to disagree.**
 * `homeWorkCategoryFor` returns the FIRST category in `CREW_WORK_CATEGORIES`
 * order whose label a card carries — "a bug is a bug wherever else it lives".
 * A reader asked to pick "the one a person would file it under first" without
 * being told that order will differ from the desk on exactly the cards where
 * two categories fit, and every such difference would be read as a finding
 * about the LABEL when it is really a disagreement about the question.
 *
 * This was measured rather than reasoned: the first control run read a
 * casting-road defect as `bugs` where the fixture expected `castingUpkeep`,
 * at 0.62 against 0.95+ everywhere else. Jev was RIGHT by the desk's own
 * precedence and the fixture was wrong.
 */
function precedenceSentence(): string {
  const order = CREW_WORK_CATEGORIES.map((category) => category.key).join(", then ");
  return `When more than one category genuinely fits, the earliest of these wins, in this exact order: ${order}.`;
}

export function categoryQuestion(): Record<string, JevChoiceQuestion> {
  return {
    [CARD_CATEGORY_QUESTION_ID]: {
      type: "choice",
      instructions:
        "This is one card from a software team's work queue. Decide which single work category it belongs to, judging what the card is ASKING FOR rather than which part of the system it mentions. " +
        precedenceSentence() +
        " If none of the categories fits, say so.",
      criteria: categoryCriteria(),
    },
  };
}

/** How much of a card body goes on the wire. Long bodies are the norm here. */
export const CARD_BODY_CHAR_CAP = 6000;

export type CardForReading = {
  readonly number: number;
  readonly title: string;
  readonly body: string;
};

/**
 * The state Jev sees: title and body, and NOTHING that names the card's own
 * category. An arm reads this function's output for every work label.
 */
export function buildCardState(card: CardForReading): { card: { title: string; body: string } } {
  return {
    card: {
      title: card.title,
      body: (card.body ?? "").slice(0, CARD_BODY_CHAR_CAP),
    },
  };
}

export function buildCardCategoryRequest(card: CardForReading) {
  return buildSystemOneRequest(buildCardState(card), categoryQuestion());
}

/**
 * Does this card's own text name the category it is filed under? Measured and
 * reported rather than asserted away — it is the one leak `buildCardState`
 * cannot close, because the prose belongs to the card.
 */
export function bodyNamesItsOwnCategory(card: CardForReading, homeKey: CrewWorkCategoryKey | null): boolean {
  if (!homeKey) return false;
  const category = CREW_WORK_CATEGORIES.find((entry) => entry.key === homeKey);
  if (!category) return false;
  const haystack = `${card.title}\n${card.body ?? ""}`.toLowerCase();
  return haystack.includes(category.queueLabel.toLowerCase());
}
