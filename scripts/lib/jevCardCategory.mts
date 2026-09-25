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
import { CREW_PIPELINE_GROUPS, pipelineGroupFor } from "../../shared/crewPipelineGroups.js";
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

/* ── STAGE 2: THE WRITER'S DECISION ────────────────────────────────────────
   Everything below is the writer half of #1224. The ACT of writing lives in
   `scripts/jev-card-category-file.mts`; the DECISION lives here, as a pure
   function, so the one arm the card names — *refuses to write below
   threshold, driven directly, not through Jev* — can drive it without a
   network, a model, or a mock standing in for either (working law 3). */

/**
 * THE GATE, AND IT IS A MEASURED NUMBER RATHER THAN A CHOSEN ONE.
 *
 * ⚠ **The controls cannot set this and the stage-1 script says so out loud.**
 * With no control WRONG, a fixture sweep only shows the reader was right
 * everywhere it was looked at; its "lowest correct" figure is a FLOOR, and it
 * moved 0.47 / 0.52 / 0.58 / 0.64 across four runs of identical fixtures.
 *
 * This figure comes from the live queue, read three times over on
 * 2026-09-25 (63 open cards x 3 passes, $0.0125, recorded on #1224):
 *
 *   - **CHOICE is stable**: 62 of 63 cards gave the same answer on all three
 *     passes. The single flip was #129, at 0.22 — nowhere near this gate.
 *   - **CONFIDENCE wobbles a little**: spread per card median 0.030, worst
 *     0.110.
 *   - **Seven confident disagreements, seven times the LABEL was wrong** —
 *     the six of #1245 plus #1179, each read at the card by hand. Zero
 *     confident errors.
 *   - **Every error the reader has made sat at or below 0.61** (#1212 0.52,
 *     #1218 0.41, and the arguable band below that).
 *
 * So the gate is set where it has 0.24 of headroom over the highest measured
 * error, which is more than twice the reader's own worst wobble — no error
 * yet seen could drift across it. **And on the day it was set, no unlabelled
 * card's confidence straddled it**: the population ran 0.90 and up, then a
 * clean gap, then 0.80 and down.
 *
 * ⚠ **It is a floor for WRITING, never a claim that a lower reading is
 * wrong.** Below it the card is left exactly as it arrived, for a person.
 */
export const CARD_CATEGORY_WRITE_THRESHOLD = 0.85;

export type FilingSkipReason =
  | "already filed"
  | "homed elsewhere"
  | "no category fits"
  | "below threshold"
  | "not a live category";

export type FilingDecision =
  | { readonly act: "file"; readonly category: CrewWorkCategoryKey; readonly queueLabel: string }
  | { readonly act: "skip"; readonly reason: FilingSkipReason; readonly detail: string };

/**
 * ⚠ **THE WRITER FILES ONLY WHAT THE DESK ITSELF CALLS UNTRIAGED. EVERY OTHER
 * GROUP IS SOMEBODY'S, AND THIS LIST GOT THERE IN TWO STEPS — BOTH MEASURED,
 * AND THE SECOND ONE IS A REVIEW FINDING ON THE PR THAT BUILT IT.**
 *
 * **Step one — the ladder.** At a 0.85 gate the writer's first live population
 * was six cards, and two were **#14** (the Pinterest-style reference selector)
 * and **#30** (the auto-discovery scan) — unbuilt product features on
 * `rung:N3`. Jev read both as `process` at **0.92**, confident and wrong, with
 * correct readings at 0.92–0.98 beside them. **No threshold separates those.**
 * It is barely even a mis-read: both bodies are mostly prose ABOUT the team's
 * own filing (*"it fell through the flag-derived register"*, *"naming it here
 * is the point"*), so the text reads as process work while what the card asks
 * for is a feature build.
 *
 * **Step two — everything else his desk homes.** The ladder guard stopped one
 * group short, and the first apply run walked straight into the gap: **#1196
 * is `debt`**, the writer filed it `seat:retro` at 0.94, and the group's own
 * blurb reads *"Carded cleanup — it needs your word because the scope varies."*
 * `scope-change` (*"yours to rule on"*) and `blocked` (*"waiting on something
 * the card names"*) sit the same way; `lost-and-found` is a catalogue and
 * `patrol` is a clock, and a work label would make either into a queue item.
 *
 * **Why the consequence is structural rather than cosmetic**, read at
 * `pipelineGroupFor`: **a switch label is matched BEFORE every other group.**
 * So filing any of these takes the card out of the section that was holding it
 * for him and files it under *On offer above* — a machine moving work into the
 * population a background shift may take. That is the milestone gate (*"the
 * team NEVER selects the next feature"*) and the card's own rule: **never a
 * rung or a road.**
 *
 * ⚠ **AND THE TEMPTING DERIVATION IS THE ONE TRAP THIS MODULE HAS ALREADY
 * FALLEN INTO ONCE.** `CrewPipelineGroup` carries a `backgroundWork` flag that
 * looks made for this, and it is not: it answers *"could a shift work this if
 * only a switch reached it"*, which is **`true` on `debt` and `toolbelt`** —
 * the two groups this list most needs to refuse. Its own field and its own
 * blurb disagree about `debt` in the same object. Deriving from it would be
 * working law 4 applied where its precondition fails, exactly as reusing the
 * switch `blurb`s as Jev's criteria would have been (see the header). **So the
 * list is NAMED, with its reason, and an arm holds every entry to being a real
 * group key** — which catches a rename, the only drift a named list can take.
 *
 * ⚠ **It narrows the card's stated population, declared rather than quiet.**
 * #1224 says *"cards that arrive with no work label (the Unfiled row; 0
 * today)"* — two different populations in one sentence, since the Unfiled row
 * is cards with no labels at all. This lands on the parenthetical: the Unfiled
 * row, plus `other`, whose blurb is *"worth a look, they may want a category"*.
 */
export const CARD_CATEGORY_TRIAGE_GROUPS: readonly string[] = ["unfiled", "other"];

/**
 * Should this card be filed, and under which label?
 *
 * ⚠ **"already filed" is checked FIRST and it is the whole safety property of
 * stage 2.** The writer only ever ADDS a label to a card carrying none, so it
 * is structurally unable to move a card between switches — which is the act
 * that changes what a shift takes and what his page shows him. A reader that
 * could relabel would need a human in front of every verdict; one that can
 * only fill a blank is reversible by deleting one label.
 *
 * The other three refusals are ordered after it because they are about the
 * READING, and a card that is already filed is not read at all.
 */
export function decideCardFiling(input: {
  readonly labels: readonly string[];
  readonly choice: string;
  readonly confidence: number;
  readonly threshold?: number;
}): FilingDecision {
  const threshold = input.threshold ?? CARD_CATEGORY_WRITE_THRESHOLD;

  const home = CREW_WORK_CATEGORIES.find((category) => input.labels.includes(category.queueLabel));
  if (home) {
    return { act: "skip", reason: "already filed", detail: `carries ${home.queueLabel}` };
  }
  /* Only the two triage groups are filed — see the block above this function.
     `pipelineGroupFor` answers `switched` first for any card carrying a work
     label, so this reading is only ever reached once we know there is none,
     which is exactly when it says which section of his desk draws the card. */
  const group = pipelineGroupFor(input.labels);
  if (!CARD_CATEGORY_TRIAGE_GROUPS.includes(group)) {
    const drawn = CREW_PIPELINE_GROUPS.find((candidate) => candidate.key === group);
    return {
      act: "skip",
      reason: "homed elsewhere",
      detail: `his desk draws it under "${drawn?.label ?? group}"`,
    };
  }
  if (input.choice === NO_CATEGORY) {
    return { act: "skip", reason: "no category fits", detail: "the reader declined" };
  }
  const category = CREW_WORK_CATEGORIES.find((entry) => entry.key === input.choice);
  /* A choice naming no live category is REFUSED rather than passed to `gh`,
     which would either fail the run or — worse, if the string happened to be
     a real label — file the card somewhere the desk cannot home. */
  if (!category) {
    return { act: "skip", reason: "not a live category", detail: `read "${input.choice}"` };
  }
  if (!(input.confidence >= threshold)) {
    return {
      act: "skip",
      reason: "below threshold",
      detail: `${input.confidence.toFixed(2)} < ${threshold.toFixed(2)}`,
    };
  }
  return { act: "file", category: category.key, queueLabel: category.queueLabel };
}

/**
 * THE WRITER MUST NOT START A RUN IT CANNOT FINISH.
 *
 * `gh issue edit --add-label` fails on a label the repository does not have,
 * so a missing label turns a sweep into a half-applied sweep — some cards
 * filed, some not, and no record of which. Read the repository's labels once
 * and refuse the whole run instead.
 */
export function assertQueueLabelsExist(repoLabels: readonly string[]): void {
  const missing = CREW_WORK_CATEGORIES.map((category) => category.queueLabel).filter(
    (label) => !repoLabels.includes(label),
  );
  if (missing.length > 0) {
    throw new Error(
      `jevCardCategory: the repository has no label ${missing.map((l) => `"${l}"`).join(", ")} — ` +
        "refusing the run rather than filing some cards and failing on others",
    );
  }
}

/** The comment a filed card gets: what was done, how sure, and how to undo it. */
export function filingComment(category: CrewWorkCategoryKey, confidence: number): string {
  const entry = CREW_WORK_CATEGORIES.find((candidate) => candidate.key === category)!;
  return [
    `**Filed by the card-category reader** (#1224 stage 2, his ruling of 2026-09-25: *"Where-ever jev can genuinely improve my agents workflow it should be used"*).`,
    "",
    `This card arrived with no work label, so nothing on the crew page knew which switch it belonged under. It reads as **${entry.label}** — \`${entry.queueLabel}\` — at ${confidence.toFixed(2)} confidence, above the ${CARD_CATEGORY_WRITE_THRESHOLD.toFixed(2)} the reader is allowed to write at.`,
    "",
    `The reader only ever ADDS a label to a card that had none, so nothing was moved off this card and no work changed hands. If this is the wrong switch, swap the label and say so here — the reader is never consulted twice about the same card.`,
  ].join("\n");
}

/**
 * A CALIBRATION READ MAY LOWER THE GATE. A WRITE MAY NOT.
 *
 * `--threshold` exists so the gate itself can be re-measured against the live
 * queue — which is how the number above was arrived at, and how it will be
 * re-arrived at when the reader or the criteria change. Combined with
 * `--apply` it would be a road to filing the whole queue at 0.2 from one
 * mistyped flag, so the two are refused together. Raising the gate for a
 * cautious run is allowed, because that direction only files less.
 */
export function assertApplyThreshold(apply: boolean, threshold: number): void {
  if (apply && threshold < CARD_CATEGORY_WRITE_THRESHOLD) {
    throw new Error(
      `jevCardCategory: refusing to WRITE at ${threshold.toFixed(2)} — the measured gate is ` +
        `${CARD_CATEGORY_WRITE_THRESHOLD.toFixed(2)}. Lower it for a report, never for an apply.`,
    );
  }
}
