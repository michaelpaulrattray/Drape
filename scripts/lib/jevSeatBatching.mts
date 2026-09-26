/**
 * THE BATCH CUTTER'S TIE-BREAKER — two fixed-answer questions on TEXT, asked
 * only where the mechanical reading is genuinely silent (#1281).
 *
 * His ruling, 2026-09-25, verbatim: *"Where-ever jev can genuinely improve my
 * agents workflow it should be used."* The cutter has exactly two questions a
 * calibrated fixed-answer reader is better at than a regular expression, and
 * both are about a card's own prose:
 *
 *  1. **does this card build on another OPEN card?** — the mechanical reading
 *     (`readIndependence`) answers it outright in the two easy directions: a
 *     dependency phrase beside an open `#N` is *dependent*, and citing no open
 *     card at all is *independent*. What it cannot judge is the middle — a card
 *     that names an open card in prose and never says what the relationship is.
 *  2. **which product area is this card's work in?** — the mechanical reading
 *     is the files the body names and then its labels. A card that names no
 *     file and carries no area-bearing label is silent, and an area is what
 *     keeps two seats off the same files.
 *
 * # ⚠ WHAT JEV IS NOT ASKED, AND IT IS THE WHOLE OF THE CARD'S RULE
 *
 * **It decides no priority and reads no code.** It never ranks his band, never
 * chooses which card a seat takes first, never says whether a card is worth
 * doing, and is never shown the repository. It reads a card's title and body
 * and answers one of the two closed questions above. **And it never moves a
 * card onto the focus lane** — that lane's card is the top of his ordered band,
 * decided by `compareOrderedBand` and nothing else.
 *
 * ⚠ **THE CARD'S LABELS DO NOT GO ON THE WIRE**, for `jevCardCategory.mts`'s
 * own reason: a reader shown the mechanical answer agrees with it, and every
 * control number would then be worthless. `buildSeatCardState` carries the
 * title, the body and the open cards it cites, and an arm asserts no label
 * reaches the request.
 *
 * # WHERE A LOW-CONFIDENCE ANSWER GOES, AND WHY THE TWO DIFFER
 *
 * Both fall to a SAFE DEFAULT, and the safe default is not the same word for
 * the two questions:
 *
 * - **Area below the gate ⇒ no area.** A background card with no area goes to
 *   the smallest batch, which is exactly where a card naming no area goes
 *   already. Nothing new happens, and no seat is created for it.
 * - **Dependency below the gate ⇒ held.** A card that MIGHT build on another
 *   open card is not handed out at all, because his sentence is *"a card that
 *   cites another open card waits until that one closes"*. An ordered card with
 *   no area is held for the same reason: an unknown area cannot be proven to
 *   differ from the focus card's.
 *
 * ⚠ **AND IF JEV IS UNREACHABLE THE CUTTER RUNS ON THE MECHANICAL FACTS ALONE
 * AND SAYS SO.** No key, an HTTP error, a timeout, an unparsable reply — each
 * one leaves every `unclear` card exactly as the mechanical reading left it,
 * and the pass digest carries the line. A tie-breaker that can stop a pass is
 * worse than no tie-breaker.
 */
import { askJev, type JevChoiceAnswer, type JevChoiceQuestion } from "./jev.mjs";

export const DEPENDENCY_QUESTION_ID = "buildsOnAnotherCard";
export const AREA_QUESTION_ID = "productArea";

/** The answer that means "this card stands alone". */
export const DEPENDENCY_NO = "no";
/** The answer that means "it builds on one of the cards it names". */
export const DEPENDENCY_YES = "yes";
/** The area answer that means none of the Atlas's domains fits. */
export const NO_AREA = "none of these";

/**
 * THE GATE, AND IT IS BORROWED RATHER THAN MEASURED — SAID OUT LOUD.
 *
 * ⚠ `CARD_CATEGORY_WRITE_THRESHOLD` is 0.85 and this is the same number, and it
 * is deliberately NOT imported from there. That figure was measured on a
 * DIFFERENT question — 63 open cards read three times, every error at or below
 * 0.61 — and this repository has been bitten before by deriving from a shared
 * value that answers a different question (a correct-looking derivation wearing
 * a refactor's clothes). Importing it would claim a measurement these two
 * questions have not had.
 *
 * So: it is a FLOOR taken from the sibling reader's calibration on the same
 * model, and the honest state is that the controls in
 * `scripts/jev-seat-batching-check.mts` are what justify it for THESE questions.
 * Below it nothing happens that would not have happened without Jev at all,
 * which is what makes borrowing it safe rather than convenient.
 *
 * ⚠ **AND THE CONTROLS' FIRST RUN SAYS THE TWO QUESTIONS DO NOT BEHAVE ALIKE,
 * WHICH IS A FINDING RATHER THAN A PROBLEM** (2026-09-26, twelve controls,
 * $0.0004):
 *
 * - **DEPENDENCY: 6 of 6 right, and all six clear the gate.** The three cards
 *   that plainly build on another read `yes` at **1.00**; the three that cite a
 *   precedent, a sibling fault or a ruling read `no` at **0.86 / 0.99 / 0.94**.
 *   This is the limb the cutter actually needs, and it works.
 * - **AREA: 5 of 6 right on the CHOICE, and only one cleared the gate.** The
 *   correct answers came in at 0.74 (casting), 0.79 (boards), 0.95 (billing) and
 *   0.78 / 0.71 (no area); the one MISS — a garment card read as `studio` — sat
 *   at **0.50 and was refused by the gate.** Twenty-nine options spread the
 *   probability mass, so a figure calibrated on a seven-option question is a
 *   high bar here.
 *
 * **The gate stays at 0.85 and the area limb therefore fires rarely.** That is
 * the correct trade and not a compromise: a card whose area Jev cannot name
 * confidently goes to the smallest batch, which is exactly where it went before
 * this reader existed, and the one wrong answer the run produced is the one the
 * gate threw away. Lowering it to 0.70 would have admitted three more correct
 * areas — and a floor measured once, on a set with a miss in it, is precisely
 * the number the sibling reader's docblock says not to set.
 */
export const SEAT_BATCHING_CONFIDENCE_GATE = 0.85;

/**
 * ⚠ **THE CEILING ON ONE ASK, AND THE REASON IT IS SHORT.** A tie-breaker may
 * cost a pass a few seconds and must never cost it an hour: the review of
 * 2026-09-26 measured the shape — the area loop asking about forty arealess
 * cards, each waiting out undici's ~300 s header timeout, is nearly three hours
 * before a single seat launches. Twenty seconds is well past a live call (the
 * controls' twelve asks took about a second each) and short enough that the
 * worst case is one wasted breath per card. And the FIRST failure stops the
 * asking entirely (`failure` below), so the worst case is one timeout per pass.
 */
export const JEV_ASK_TIMEOUT_MS = 20_000;

/** How much of a card body goes on the wire — the category reader's own cap. */
export const SEAT_CARD_BODY_CHAR_CAP = 6000;

export interface SeatCardForReading {
  readonly number: number;
  readonly title: string;
  readonly body?: string | null;
  /** The open cards this one's text names — the mechanical citation list. */
  readonly cites: readonly number[];
}

/**
 * The state Jev sees. Title, body, and the open card numbers the text names —
 * and NOTHING else. No labels, no file list, no repository.
 */
export function buildSeatCardState(card: SeatCardForReading): {
  card: { title: string; body: string; namesOpenCards: readonly number[] };
} {
  return {
    card: {
      title: card.title,
      body: (card.body ?? "").slice(0, SEAT_CARD_BODY_CHAR_CAP),
      namesOpenCards: [...card.cites].sort((a, b) => a - b),
    },
  };
}

export function dependencyQuestion(): Record<string, JevChoiceQuestion> {
  return {
    [DEPENDENCY_QUESTION_ID]: {
      type: "choice",
      instructions:
        "This is one card from a software team's work queue. It names one or more OTHER cards that are still open"
        + " (the numbers are in `namesOpenCards`). Decide whether this card BUILDS ON one of them — whether the work"
        + " described here cannot be finished until one of those cards is finished first. Judge only the relationship;"
        + " do not judge whether the work is worth doing, how urgent it is, or which should go first.",
      criteria: {
        [DEPENDENCY_YES]:
          "The card says or plainly implies that its work sits on top of one of those open cards: it continues it, is a"
          + " later part of it, waits for it, or cannot be done until that one lands.",
        [DEPENDENCY_NO]:
          "The card mentions those cards only as background — a precedent, a rule it follows, a related fault, a place"
          + " the same mistake was made, an example. Its own work could be done today whatever happens to them.",
      },
    },
  };
}

/**
 * The area question, with the option list DERIVED from the Atlas's own domain
 * names (`docs/architecture/drape-architecture.json`). A domain the Atlas adds
 * is offered here without anyone touching this file; a taxonomy invented here
 * would be a second list of the product's shape (working law 4).
 */
export function areaQuestion(domains: readonly string[]): Record<string, JevChoiceQuestion> {
  const criteria: Record<string, string> = {};
  for (const domain of [...domains].sort()) {
    criteria[domain] = `The work described lands mainly in the product's ${domain} area.`;
  }
  criteria[NO_AREA] = "The card names no part of the product clearly enough to say, or it spans everything.";
  return {
    [AREA_QUESTION_ID]: {
      type: "choice",
      instructions:
        "This is one card from a software team's work queue for a fashion-imaging web product. Decide which single part"
        + " of the product the work described would land in. Judge where the CHANGE would be made, not every part the"
        + " card mentions. If it is not clear, say so rather than guessing.",
      criteria,
    },
  };
}

/* ── THE DECISIONS, PURE, SO THE GATE IS DRIVEN DIRECTLY ────────────────────
   Working law 3: if the only test of a gate runs through the model, the gate is
   untested. Both functions below take an answer object and return the cutter's
   verdict, so `server/seatBatchingJev.test.ts` drives them with fabricated
   replies — including the one that matters, a correct choice one hundredth
   below the gate. */

export type JevDependencyVerdict =
  | { readonly kind: "independent"; readonly confidence: number }
  | { readonly kind: "held"; readonly why: string; readonly confidence: number };

export function dependencyVerdict(
  answer: JevChoiceAnswer,
  gate: number = SEAT_BATCHING_CONFIDENCE_GATE,
): JevDependencyVerdict {
  if (answer.confidence < gate) {
    return {
      kind: "held",
      why: `Jev read it as "${answer.choice}" at ${answer.confidence.toFixed(2)}, below the ${gate} gate`,
      confidence: answer.confidence,
    };
  }
  if (answer.choice === DEPENDENCY_NO) return { kind: "independent", confidence: answer.confidence };
  if (answer.choice === DEPENDENCY_YES) {
    return {
      kind: "held",
      why: `Jev read it as building on a card it names (${answer.confidence.toFixed(2)})`,
      confidence: answer.confidence,
    };
  }
  return {
    kind: "held",
    why: `Jev answered "${answer.choice}", which is neither ${DEPENDENCY_YES} nor ${DEPENDENCY_NO}`,
    confidence: answer.confidence,
  };
}

/** The area, or `null` for "no area" — below the gate, an unknown option, or the explicit way out. */
export function areaVerdict(
  answer: JevChoiceAnswer,
  domains: readonly string[],
  gate: number = SEAT_BATCHING_CONFIDENCE_GATE,
): { readonly area: string | null; readonly why: string; readonly confidence: number } {
  const confidence = answer.confidence;
  if (confidence < gate) {
    return { area: null, why: `Jev read it as "${answer.choice}" at ${confidence.toFixed(2)}, below the ${gate} gate`, confidence };
  }
  if (answer.choice === NO_AREA) return { area: null, why: "Jev found no clear area", confidence };
  if (!domains.includes(answer.choice)) {
    return { area: null, why: `Jev answered "${answer.choice}", which is not one of the Atlas's domains`, confidence };
  }
  return { area: answer.choice, why: `Jev read it as ${answer.choice} (${confidence.toFixed(2)})`, confidence };
}

/* ── THE TWO CALLS, EACH FAILING TOWARD THE MECHANICAL ANSWER ──────────────── */

/** One line the pass digest prints for every card Jev was asked about. */
export interface JevSeatReading {
  readonly card: number;
  readonly question: "dependency" | "area";
  readonly answer: string;
  readonly confidence: number;
  readonly used: boolean;
  readonly note: string;
}

export interface JevSeatAsk {
  readonly dependency: (card: SeatCardForReading) => Promise<JevDependencyVerdict | null>;
  readonly area: (card: SeatCardForReading) => Promise<{ area: string | null } | null>;
  readonly readings: readonly JevSeatReading[];
  /** Set the first time a call fails, so the digest can say the cutter ran mechanically. */
  readonly failure: () => string | null;
  readonly inputTokens: () => number;
}

/**
 * The live asker. `null` from either call means *Jev could not be consulted* —
 * distinct from a verdict, because the two get different sentences in the
 * digest and the same behaviour in the cut.
 */
export function jevSeatAsk(options: {
  readonly domains: readonly string[];
  readonly gate?: number;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}): JevSeatAsk {
  const readings: JevSeatReading[] = [];
  let failure: string | null = null;
  let inputTokens = 0;
  const gate = options.gate ?? SEAT_BATCHING_CONFIDENCE_GATE;

  const ask = async (
    card: SeatCardForReading,
    questions: Record<string, JevChoiceQuestion>,
    id: string,
  ): Promise<JevChoiceAnswer | null> => {
    /* ⚠ ONE FAILURE ENDS THE ASKING. Without this every card in a loop pays the
       same timeout, and a caller that forgets to check `failure()` pays it forty
       times — which is exactly the wedge the review measured. The gate is here,
       in the asker, rather than only at the call sites, because a control that
       depends on every caller remembering is not a control. */
    if (failure !== null) return null;
    try {
      const reply = await askJev(buildSeatCardState(card), questions, {
        apiKey: options.apiKey,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs ?? JEV_ASK_TIMEOUT_MS,
      });
      inputTokens += reply.usage.input_tokens;
      return reply.answers[id] ?? null;
    } catch (error) {
      /* ⚠ The message is kept and the KEY never is — `askJev` reads the key and
         never returns it, and nothing here prints a header. */
      if (failure === null) failure = error instanceof Error ? error.message : String(error);
      return null;
    }
  };

  return {
    readings,
    failure: () => failure,
    inputTokens: () => inputTokens,
    dependency: async (card) => {
      const answer = await ask(card, dependencyQuestion(), DEPENDENCY_QUESTION_ID);
      if (answer === null) return null;
      const verdict = dependencyVerdict(answer, gate);
      readings.push({
        card: card.number,
        question: "dependency",
        answer: answer.choice,
        confidence: answer.confidence,
        used: verdict.kind === "independent",
        note: verdict.kind === "independent" ? "offered to a seat" : verdict.why,
      });
      return verdict;
    },
    area: async (card) => {
      const answer = await ask(card, areaQuestion(options.domains), AREA_QUESTION_ID);
      if (answer === null) return null;
      const verdict = areaVerdict(answer, options.domains, gate);
      readings.push({
        card: card.number,
        question: "area",
        answer: answer.choice,
        confidence: answer.confidence,
        used: verdict.area !== null,
        note: verdict.why,
      });
      return { area: verdict.area };
    },
  };
}
