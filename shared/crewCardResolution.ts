/**
 * A CARD WHOSE ISSUE HAS CLOSED IS FINISHED, WHATEVER STATE A SHIFT LEFT IT IN
 * (issue #604).
 *
 * Seen on his page 2026-09-06 22:55 AEST, edition 277: the card
 * `deploy-flip-508` still read OPEN, asking him to enter three Railway fields.
 * He had entered them at 17:26; #508 closed at 18:48; his reply on that very
 * card — *"its been flipped already"* — was acknowledged the same evening. The
 * page kept asking for a chore he had already done, and he had to ask the relay
 * whether he had replied to everything.
 *
 * # WHY THE SWEEP DID NOT CATCH IT
 *
 * `crew-desk-sweep.mts` §2 promoted `answered` → `done` when the issue closed,
 * and ONLY from `answered`. His reply never moved that card to `answered` — the
 * acknowledgement lived in `acknowledgedReplyIds`, which is a different field —
 * so the closed-issue rule never looked at it. The same field one list over is
 * how the eye item `brief-chips-535-frames` came to sit `open` on a feature he
 * had deleted, and a shift set that one by hand (foreman-20260907-0035).
 *
 * The repair is to stop keying the promotion on the state a shift happened to
 * type, and key it on the record instead: **the issue's own OPEN/CLOSED is the
 * fact, and it settles both roads.**
 *
 * # ⚠ AND THE CARD'S OWN "FIX (SMALL)" WOULD HAVE BROKEN HIS PAGE
 *
 * `answered` → `done` is safe by construction, which is why nothing had to
 * think about it: the briefing schema already forbids an open eye item beside
 * an `answered` card (#133) and forbids a `waiting-founder` row naming anything
 * but an `open` card (#291). An `open` card has neither protection — it is
 * exactly the state those two rules are written FOR. So promoting one to `done`
 * can leave behind:
 *
 *   - an `open` eye item whose card is no longer open — refused at the parse by
 *     #133's refinement, and
 *   - a `waiting-founder` pipeline row naming a card that is no longer open —
 *     refused at the parse by #291's.
 *
 * Either one is a briefing that cannot be shipped, found at the validate step
 * rather than here. So a promotion that would orphan a dependant is **HELD and
 * reported**, never written — the sweep's own standing doctrine for pass 4,
 * applied to a road that can now produce the same shape (*"what a stale row
 * should become is a judgement about work, and guessing it is how a wrong state
 * gets laundered into a confident one"*).
 *
 * An eye item holds nothing up, so it never needs the guard.
 *
 * # `shared/` BECAUSE IT IS A RULE, NOT A SCRIPT STEP
 *
 * The same argument `crewNextUpHold.ts` makes: a second implementation of *"is
 * this finished"* would drift from the first, and the drift is invisible until
 * his page says a chore is owed that the queue says is done.
 */

/** OPEN | CLOSED | null when the record could not be read. */
export type IssueState = "OPEN" | "CLOSED" | null;

export type ResolvableCard = {
  id: string;
  state: string;
  issueNumber: number | null;
};

export type ResolvableEyeItem = ResolvableCard & {
  /** The needs-you card whose question these frames answer, when one does. */
  cardId?: string | null;
};

export type ResolvablePipelineRow = {
  id?: string;
  status: string;
  cardId?: string | null;
};

export type ResolvableBriefing = {
  needsYou?: ResolvableCard[];
  eyeItems?: ResolvableEyeItem[];
  pipeline?: ResolvablePipelineRow[];
};

export type CardList = "needsYou" | "eyeItems";

export type Promotion = {
  list: CardList;
  id: string;
  /** The state it is promoted FROM — `open` and `answered` read differently. */
  from: string;
  issueNumber: number;
};

export type Hold = {
  list: CardList;
  id: string;
  issueNumber: number;
  /** Plain English, for the shift that has to decide what the dependant becomes. */
  reason: string;
};

export type Unreadable = {
  list: CardList;
  id: string;
  issueNumber: number;
};

export type ResolutionPlan = {
  /** Safe to write: nothing on the page depends on these staying open. */
  promote: Promotion[];
  /** Finished by the record, but promoting would orphan something. */
  held: Hold[];
  /** `gh` could not answer — never read as "not closed" (working law 2). */
  unreadable: Unreadable[];
};

/** The two states that can still be promoted; `done` is already the end. */
const PROMOTABLE = new Set(["open", "answered"]);

/**
 * Plan every `open`/`answered` card and eye item whose issue has CLOSED.
 *
 * `issueState` is injected rather than called directly so the rule can be
 * driven without a network: the script passes its own `gh` reader, the suite
 * passes a table.
 */
export function planCardResolutions(
  briefing: ResolvableBriefing,
  issueState: (issueNumber: number) => IssueState,
): ResolutionPlan {
  const cards = briefing.needsYou ?? [];
  const eyeItems = briefing.eyeItems ?? [];
  const pipeline = briefing.pipeline ?? [];

  const promote: Promotion[] = [];
  const held: Hold[] = [];
  const unreadable: Unreadable[] = [];

  /* One read per issue: a card and its eye item usually name the same one, and
     a failed read must give the same answer both times it is consulted. */
  const seen = new Map<number, IssueState>();
  const stateOf = (issueNumber: number): IssueState => {
    if (!seen.has(issueNumber)) seen.set(issueNumber, issueState(issueNumber));
    return seen.get(issueNumber) ?? null;
  };

  const closing = (item: ResolvableCard, list: CardList): boolean => {
    if (!PROMOTABLE.has(item.state)) return false;
    if (typeof item.issueNumber !== "number") return false;
    const state = stateOf(item.issueNumber);
    if (state === null) {
      unreadable.push({ list, id: item.id, issueNumber: item.issueNumber });
      return false;
    }
    return state === "CLOSED";
  };

  /* Eye items first: whether one of them is closing decides whether the card it
     names is safe to close, so the answer has to exist before the cards are
     judged. Nothing depends on an eye item, so none of them is ever held. */
  const eyeClosing = new Set<string>();
  for (const item of eyeItems) {
    if (!closing(item, "eyeItems")) continue;
    eyeClosing.add(item.id);
    promote.push({
      list: "eyeItems",
      id: item.id,
      from: item.state,
      issueNumber: item.issueNumber as number,
    });
  }

  for (const card of cards) {
    if (!closing(card, "needsYou")) continue;
    const issueNumber = card.issueNumber as number;

    /* ⚠ EVERY reason is collected, not just the first (review of PR #609,
       finding 2). A card can be held by BOTH, and naming one of them sends the
       shift to settle it only to meet the other on the next sweep. */
    const reasons: string[] = [];

    /* #133: an eye item that will STILL be open needs its card open. One that
       is closing in this same plan is not a dependant — both land together. */
    const orphanedEye = eyeItems.find(
      (item) => item.cardId === card.id && item.state === "open" && !eyeClosing.has(item.id),
    );
    if (orphanedEye) {
      reasons.push(
        `eye item '${orphanedEye.id}' is still open and names this card (#133) — `
        + `settle the frames, or close its issue, before the card can be marked done`,
      );
    }

    /* #291: a `waiting-founder` row NAMES the open card it waits on. What that
       row should become — merged, in review, blocked, deleted — is a judgement
       about work, so it is reported and never guessed. (A row whose PR has
       merged is already repaired by the pass ABOVE this one, so it cannot
       still be holding anything here.) */
    const claimingRow = pipeline.find(
      (row) => row.status === "waiting-founder" && row.cardId === card.id,
    );
    if (claimingRow) {
      reasons.push(
        `pipeline row '${claimingRow.id ?? "(unnamed)"}' still says he is blocking it (#291) — `
        + `give that row its real status before the card can be marked done`,
      );
    }

    if (reasons.length > 0) {
      held.push({ list: "needsYou", id: card.id, issueNumber, reason: reasons.join("; and ") });
      continue;
    }

    promote.push({ list: "needsYou", id: card.id, from: card.state, issueNumber });
  }

  return { promote, held, unreadable };
}

/** The sentence his shift reads in the sweep's report, per promotion. */
export function promotionLine(promotion: Promotion): string {
  return promotion.from === "answered"
    ? `${promotion.list} ${promotion.id}: answered → done (#${promotion.issueNumber} is closed)`
    : `${promotion.list} ${promotion.id}: open → done — resolved by the card's issue closing `
      + `(#${promotion.issueNumber})`;
}
