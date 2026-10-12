/**
 * WHY A NEXT UP ROW WAS SKIPPED — one owner for the verdict (issue #298).
 *
 * Founder, 2026-08-30, looking at his own page: *"on my desk it says [8 items]
 * but its currently working on [#280] did it skip things or what happened just
 * trying to make sense of how it works"*.
 *
 * It skipped five and every skip was correct. The block rendered exactly ONE
 * availability state — *Waiting on you* — while those five were stuck for four
 * different reasons, none of which was that. So a correct running order read as
 * a queue being ignored from the top.
 *
 * # `shared/` BECAUSE THE VERDICT HAS ONE OWNER
 *
 * `scripts/crew-desk-sweep.mts` reads the queue and writes the state onto the
 * briefing; the page draws it. Two implementations of *"blocked"* would drift,
 * and the first anyone would know is his page saying a card is takeable while
 * every shift declines it. Working law 4, pointed at a definition — the same
 * argument `shared/crewShiftState.ts` makes for `stalled`.
 *
 * # ⚠ THE STATE IS A LABEL AND THE REASON IS PROSE, AND THAT SPLIT IS THE FIX
 *
 * #298's own rule: *"Derive it, never type it … A row whose reason is stale is
 * this bug again."* `#278` is the proof — its body said BLOCKED for two shifts
 * after the fact, because the state lived in a sentence nobody re-reads.
 *
 * So the two halves are held to different standards:
 *
 * - **The STATE is a GitHub label.** One field, changed by one act, and
 *   unblocking a card is *removing the label* rather than editing a paragraph.
 *   A label cannot be half-removed and cannot disagree with itself.
 * - **The REASON is one line of the body**, and it is shown **only while the
 *   label says the hold is live**. That is what makes a rotting reason
 *   harmless: the moment the label goes, the sentence stops being rendered
 *   whatever it still says. A stale reason can never outlive its state,
 *   because the state is the thing that renders it.
 *
 * A held card with no marker line still shows its state — the label alone is a
 * complete answer to *"why was this skipped"*, and demanding prose would mean a
 * filer's omission silently un-holds a card.
 *
 * # WHAT IS NOT HERE
 *
 * **`you` is not a label.** *Waiting on you* is derived from HIS OWN DESK — an
 * open `needsYou` card naming the issue — which is #291's rule and the one
 * definition of "he is blocking this". It stays derived; putting it in a label
 * would let the queue claim he owes an answer he has already given.
 */
import { decoratedLines } from "./crewMarkdownLead";

/**
 * The label that puts a card in each held state.
 *
 * ⚠ **`awaiting-fable`, NOT the existing `needs-fable`.** That one already
 * means *"force the full Fable review on this PR"* — a PR-scoped instruction to
 * the gate. Overloading it would make a card asking for a review and a card
 * waiting on the review arm indistinguishable, and one of those is takeable.
 *
 * ⚠ **AND `awaiting-fable` HAS A WRITTEN RULE SINCE 2026-09-05 (#541,
 * founder-ordered and urgent), BECAUSE IT WAS BEING APPLIED AS "THIS LOOKS
 * HARD".** His question, verbatim: *"a bunch of next up in que says need fable
 * are these blocked? we have acesss to fable?"* Measured that morning: **five**
 * of his own ordered cards carried it (#508, #530, #534, #535, #539) and **two
 * of the five were never judgment-class at all** — #530 is a court and #539 is
 * one clause in an instruction; the relay removed those two labels on his word.
 * The other three sat behind a hold that nothing in the product could clear,
 * because the marker that reaches Fable was only ever written by hand and no
 * shift ever wrote it.
 *
 * **The rule, and it is short on purpose:**
 *
 * - **`awaiting-fable` means a DESIGN DECISION, or a change to WHAT HE JUDGES.**
 *   Those two things only.
 * - **A court, a clause, a guard arm, a copy fix, a relabel is Opus work,
 *   whatever card it hangs off.** Difficulty is not the test; being asked to
 *   decide something is.
 * - **A shift that applies the label writes the `CREW_HOLD_MARKER` line saying
 *   WHICH of the two it is.** A label without that line is removed by the next
 *   shift's re-read — by a person reading the card, never by a script, because
 *   removing a hold is the act that lets work start.
 *
 * The road out is now automatic: `scripts/next-up-escalation.mts` is consulted
 * at every shift launch and writes the Fable marker itself when a card carrying
 * this label is the next one a shift would take. That is the invariant-7 half
 * of the repair — a hold with no road out is not a hold, it is a freezer.
 */
export const CREW_HOLD_LABELS = {
  blocked: "blocked",
  fable: "awaiting-fable",
  sitting: "needs-sitting",
} as const;

/** A hold that comes from a label on the card. */
export type CrewHeldState = keyof typeof CREW_HOLD_LABELS;

/**
 * The same three, as the tuple `z.enum` wants — **derived from the labels
 * above rather than retyped**, so a fourth hold cannot exist in one list and
 * not the other (working law 4, and the whole reason this file exists).
 */
export const CREW_HELD_STATES = Object.keys(CREW_HOLD_LABELS) as [CrewHeldState, ...CrewHeldState[]];

/** Every reason a row is not takeable, including the one derived from his desk. */
export type CrewHoldKind = "you" | CrewHeldState;

/**
 * ⚠ **PRECEDENCE, and `you` is first on purpose.** A card can carry a label AND
 * have an open question on his desk; when it does, the answer he can act on is
 * the one worth showing him. The rest are ordered by how far the work is from
 * being takeable.
 */
export const CREW_HOLD_ORDER: readonly CrewHoldKind[] = ["you", "blocked", "fable", "sitting"];

/**
 * What the chip says. Short, because it sits at the end of a title line — and
 * plain, because he is not code-savvy: *Needs Fable* rather than
 * `judgment-class`.
 */
export const CREW_HOLD_WORD: Record<CrewHoldKind, string> = {
  you: "Waiting on you",
  blocked: "Blocked",
  fable: "Needs Fable",
  sitting: "Needs a sitting",
};

/**
 * The one line a filer writes in the card body to say what the hold is on.
 *
 * Visible markdown rather than an HTML comment, deliberately: a human opening
 * the card must read the same sentence his page shows him. A hidden marker is a
 * second copy that only a script can check.
 */
export const CREW_HOLD_MARKER = "**Waiting on:**";

/** Reasons longer than this are truncated by the writer, not by the page. */
export const CREW_HOLD_REASON_MAX = 160;

/**
 * EVERY held state a card's labels put it in, furthest-from-takeable first.
 *
 * ⚠ **THIS EXISTS BECAUSE THE COLLAPSE BELOW IS LOSSY, AND A CALLER THAT NEEDS
 * TO ASK ABOUT ONE PARTICULAR HOLD MUST NOT ASK THE COLLAPSED ANSWER** (found
 * by the reviewer on PR #544, 2026-09-05, before it shipped).
 *
 * The chip on his page wants one word, so `heldStateFromLabels` picks one. But
 * `blocked` + `awaiting-fable` collapses to **`fable`** — the ranking puts
 * `fable` further from takeable than `blocked` — so a caller asking *"is this
 * card Fable's to take?"* gets **yes** for a card that is also blocked. That is
 * a natural filing ("needs a design decision AND waits on something external"),
 * and the caller that would have been wrong is the auto-escalation gate, which
 * spends an expensive Fable session when it answers yes.
 *
 * Derive, never mirror (working law 4): the one-word answer is the first
 * element of this list rather than a second implementation of the same sort.
 */
export function heldStatesFromLabels(labels: readonly string[]): CrewHeldState[] {
  const present = new Set(labels);
  return (Object.keys(CREW_HOLD_LABELS) as CrewHeldState[])
    .filter((state) => present.has(CREW_HOLD_LABELS[state]))
    .sort((a, b) => CREW_HOLD_ORDER.indexOf(b) - CREW_HOLD_ORDER.indexOf(a));
}

/**
 * The held state a card's labels put it in, or `null` when nothing does.
 *
 * Two labels is a filing mistake rather than a state, and the answer is the
 * FURTHEST from takeable — a card that is both blocked and needs a sitting is
 * not takeable for either reason, and the softer word would overstate it.
 *
 * ⚠ **This is the answer for a CHIP, which shows one word. A caller deciding
 * whether it may ACT on a card asks `heldStatesFromLabels` and reads the whole
 * list** — see that function for the pair that makes the difference.
 */
export function heldStateFromLabels(labels: readonly string[]): CrewHeldState | null {
  return heldStatesFromLabels(labels)[0] ?? null;
}

/**
 * The reason line out of a card body, or `null`.
 *
 * ⚠ **It reads the FIRST marker line and stops.** A body that says it twice is
 * a card mid-edit; taking the first keeps the answer stable while somebody is
 * typing, and taking "the last one" would let a quoted example at the bottom of
 * a card win over the filer's own line.
 *
 * ⚠ **AND IT COULD NOT SEE A MARKER INSIDE A BLOCKQUOTE UNTIL #1559.** It read
 * `line.trim().startsWith(CREW_HOLD_MARKER)`, and #1414's line is
 * `> **Waiting on:** YOU — your eye on two frames`: after `.trim()` that starts
 * with `>`, not with `**`, so the marker was invisible and **the card was held
 * on his eye with nothing on his desk asking for it.** That is the exact
 * silence this module's own docblock is about — *a question he could not see is
 * the silence direction, and it is the one this repository keeps paying for* —
 * happening one function below the sentence.
 *
 * The decoration is stripped by `shared/crewMarkdownLead.ts`, the same reader
 * `crewCardBuildState.ts` uses. ⚠ **It strips BLOCK decoration only and never
 * inline emphasis, which this function depends on absolutely**: the marker it
 * looks for literally begins with `**`, so a stripper that ate leading
 * asterisks would make this line unfindable again by the other road.
 */
export function holdReasonFromBody(body: string): string | null {
  for (const line of decoratedLines(body)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(CREW_HOLD_MARKER)) continue;
    const reason = trimmed.slice(CREW_HOLD_MARKER.length).trim();
    if (reason.length === 0) return null;
    return reason.length > CREW_HOLD_REASON_MAX
      ? `${reason.slice(0, CREW_HOLD_REASON_MAX - 1).trimEnd()}…`
      : reason;
  }
  return null;
}

/** What a NEXT UP row shows about why it was skipped, or `null` when takeable. */
export type CrewHold = {
  kind: CrewHoldKind;
  /** The chip word — `CREW_HOLD_WORD[kind]`, resolved here so no caller retypes it. */
  word: string;
  /** The filer's sentence, when there is one. Never shown without a live hold. */
  because: string | null;
};

/**
 * The whole verdict for one row.
 *
 * `blockedOnYou` is the desk's answer (#291); `held` is what the sweep wrote
 * off the labels. Absent both, the row is takeable and carries no chip at all —
 * ⚠ **and that silence is load-bearing.** The first build of this block put a
 * word on every row and he could not see the order for the labels; the position
 * is the answer to his question, so only an exception gets a word.
 */
export function resolveHold(row: {
  blockedOnYou: boolean;
  held: { state: CrewHeldState; because?: string | null } | null | undefined;
}): CrewHold | null {
  if (row.blockedOnYou) {
    return { kind: "you", word: CREW_HOLD_WORD.you, because: row.held?.because ?? null };
  }
  if (!row.held) return null;
  return {
    kind: row.held.state,
    word: CREW_HOLD_WORD[row.held.state],
    because: row.held.because ?? null,
  };
}

/**
 * ⚠ **MAKING THE LABELS TRUE — the sweep's half of the hold rule (#586).**
 *
 * The header above says `you` is derived from his desk and deliberately is not
 * a label. That is right for the PAGE, and it left a hole everywhere else:
 * **the gate that launches shifts, and every `gh issue list` reader, derive
 * holds from LABELS ONLY.** They cannot see his desk.
 *
 * Measured 2026-09-06. The #508 Fable shift parked its card on his desk
 * (`deploy-flip-508`, waiting on three Railway fields), removed
 * `awaiting-fable`, and applied nothing in its place. Twenty-one minutes later
 * the runner asked `scripts/next-up-escalation.mts` and got **`NONE: the next
 * card is #508, which an Opus shift can take`** — so an Opus shift launched and
 * **#535, the next `awaiting-fable` card in his own order, was not escalated.**
 * #534 sat one row down in the same state. **A desk-held card with no label
 * reads as takeable, and every Fable card behind it freezes** — #541's pattern
 * in a new shape, one day after #541 closed.
 *
 * So the label is not a second copy of the desk; it is the desk's answer
 * TRANSLATED into the one vocabulary the other readers have, re-derived every
 * shift from the same source the page uses, which is what stops it drifting
 * (working law 4 — derive, never mirror).
 *
 * # ⚠ IT APPLIES AND IT NEVER REMOVES, AND THAT ASYMMETRY IS THE WHOLE DESIGN
 *
 * Applying is the cheaper mistake: a wrongly applied hold delays one card and
 * nothing else. ⚠ **But it does NOT heal itself, and saying so was the first
 * shape's second inaccuracy** (PR #613 review, finding 2): the next sweep only
 * NAMES a hold it should not have applied — clearing it is a person's act,
 * because this function never removes. The road out is the stale report plus
 * somebody reading it, and a docblock that promised the sweep would undo its
 * own mistake is the kind of confident sentence this repository has watched
 * become the next incident's root cause. **Removing automatically is worse
 * still.** `blocked` is applied by hand
 * for reasons that have nothing to do with his desk — #404 is blocked on #391's
 * ladder fold — and a script that stripped it because the desk was silent would
 * un-hold a card nobody had read. The standing orders say so in as many words:
 * *removing a hold is the act that lets work start*, and it is done by a person
 * reading the card.
 *
 * The rot the header warns about — *"the queue claiming he owes an answer he
 * has already given"* — is therefore answered by REPORTING rather than by
 * removing. **Every open `founder-ordered` card carrying `blocked` that his
 * desk does not hold is reported**, and the report says whether the card
 * carries a written reason, because that changes what a person should do with
 * it rather than whether they should look.
 *
 * ⚠ **THE FIRST SHAPE OF THIS USED THE MARKER LINE AS A DISCRIMINATOR AND IT
 * DOES NOT WORK** (PR #613 review, finding 1). It rested on *"a hold applied by
 * hand always carries its marker line; one this function applied never does"* —
 * and the second half is false for any card whose body EVER carried one.
 * `holdReasonFromBody` reads the first marker line whatever its age, and #298's
 * design deliberately leaves a rotted line in place when a label is removed,
 * because nothing renders it. So a card once hand-blocked, later unblocked, then
 * parked on his desk and answered would have carried `blocked` for ever and
 * been named to nobody — **the exact freeze this report exists to prevent.**
 *
 * ⚠ **AND THAT FOSSIL HAD A SECOND SYMPTOM THAT FIRED SOONER: THE WRONG
 * SENTENCE ON HIS PAGE.** The sweep renders a hold's reason from the body, so a
 * hold applied HERE would have adopted an unrelated older sentence and shown it
 * beside a live chip — *"a stale reason outliving its state"*, which is the one
 * bug #298 was built to kill. `apply` therefore carries `bodyCarriesFossil`, and
 * the sweep gives an applied hold its reason from **the desk card**, never from
 * the body.
 */
export type DeskHoldPlan = {
  /** Cards his desk holds that carry no hold label at all — apply `blocked`. */
  readonly apply: ReadonlyArray<{
    readonly issueNumber: number;
    readonly deskCardId: string;
    /**
     * The body already holds a `CREW_HOLD_MARKER` line from some EARLIER hold.
     * The caller must not render it as this hold's reason, and says so out loud.
     */
    readonly bodyCarriesFossil: boolean;
  }>;
  /**
   * Cards carrying `blocked` that his desk no longer names. Reported for a
   * person; NEVER unlabelled here.
   *
   * `hasWrittenReason` changes the LOUDNESS, never whether it is reported — a
   * card with a reason is probably held on something real (#404 is held on
   * #391's ladder fold) and a card without one is probably this sweep's own
   * hold outliving its cause. Filtering the first kind out is what froze cards
   * in the first shape of this function.
   */
  readonly stale: ReadonlyArray<{
    readonly issueNumber: number;
    readonly hasWrittenReason: boolean;
  }>;
};

export function planDeskHoldLabels(input: {
  /** The open `founder-ordered` queue, as `gh issue list` returns it. */
  readonly ordered: ReadonlyArray<{
    readonly issueNumber: number;
    readonly labels: readonly string[];
    readonly body: string;
  }>;
  /** OPEN `needsYou` cards on the briefing, by the issue each one names. */
  readonly deskOpen: ReadonlyArray<{ readonly issueNumber: number; readonly cardId: string }>;
}): DeskHoldPlan {
  const deskByIssue = new Map<number, string>();
  for (const card of input.deskOpen) {
    /* First card wins: two open cards naming one issue is his desk asking twice,
       and either id explains the hold. */
    if (!deskByIssue.has(card.issueNumber)) deskByIssue.set(card.issueNumber, card.cardId);
  }

  const apply: Array<{ issueNumber: number; deskCardId: string; bodyCarriesFossil: boolean }> = [];
  const stale: Array<{ issueNumber: number; hasWrittenReason: boolean }> = [];

  for (const row of input.ordered) {
    const onDesk = deskByIssue.get(row.issueNumber) ?? null;
    const held = heldStateFromLabels(row.labels);
    const writtenReason = holdReasonFromBody(row.body) !== null;
    if (onDesk !== null) {
      /* ⚠ ANY hold label is enough. A card already carrying `awaiting-fable` is
         not takeable, which is the only thing this repair is about — piling
         `blocked` on top would add a second chip and change nothing. */
      if (held === null) {
        apply.push({
          issueNumber: row.issueNumber,
          deskCardId: onDesk,
          bodyCarriesFossil: writtenReason,
        });
      }
      continue;
    }
    if (row.labels.includes(CREW_HOLD_LABELS.blocked)) {
      stale.push({ issueNumber: row.issueNumber, hasWrittenReason: writtenReason });
    }
  }

  return { apply, stale };
}

/**
 * ⚠ **WHO THE HOLD IS WAITING ON, READ FROM THE FILER'S OWN SENTENCE (#1467).**
 *
 * The header above says `you` is not a label and must stay derived, for a
 * reason that still holds: a label would let the queue claim he owes an answer
 * he has already given. **What it derived `you` FROM was the edition's
 * hand-written needs-you list, and that half rotted exactly the way every other
 * hand-kept list in this repository has.** Measured on edition 575, the night
 * this landed: **143 of 143 needs-you cards and 117 of 117 eye items were
 * marked `done`**, so his *What needs you* section was EMPTY — while two open
 * cards said in as many words that they were waiting on him (#1434: *"you — a
 * yes or no, and no is a fine answer."*; #1492: *"Michael's ruling on the retry
 * shape"*). **A question he could not see is the silence direction, and it is
 * the one this repository keeps paying for.**
 *
 * So `you` is still derived — from the card's OWN hold sentence rather than
 * from a file a shift rewrites at 3am. The hold label says the hold is live
 * (#298's split: the state is a label, the reason is prose shown only while the
 * label stands), and this says whose it is.
 *
 * # ⚠ IT IS ANCHORED ON THE FIRST WORD, AND THAT IS THE WHOLE INSTRUMENT
 *
 * The negative control is on the record and it is why a `contains` test is
 * never written here: **#129's live reason ENDS with the words *"Not waiting on
 * him."*** — a sentence whose whole point is that the card is NOT his. Any
 * reader scanning for a pronoun anywhere puts that card on his desk while its
 * own filer is saying the opposite. The marker line's grammar is *"waiting on
 * WHOM"*, so the answer is the first word after it and nothing else.
 *
 * A leading article and light markdown emphasis are stepped over (*"the
 * founder's word"*, *"**you** — a yes or no"*); a possessive is trimmed
 * (*"Michael's ruling"*). Everything else is `other`, and an absent or empty
 * reason is `unknown` — ⚠ **never `you`**. A held card whose filer did not say
 * whose it is has not said it is his, and the remainder is reported to a shift
 * by `crew-desk-sweep.mts` rather than guessed at on his page.
 */
export type CrewHoldOwner = "you" | "other" | "unknown";

/**
 * The first words that mean HIM. Small on purpose: this list is the difference
 * between a row on his desk and silence, so every entry is a word a filer has
 * actually opened the sentence with.
 */
const FOUNDER_HOLD_WORDS: ReadonlySet<string> = new Set([
  "you", "your", "yours", "michael", "founder", "his", "him", "he",
]);

/** Stepped over before the first word is read — never part of the answer. */
const HOLD_REASON_ARTICLES: ReadonlySet<string> = new Set(["the", "a", "an"]);

export function holdOwnerFromReason(reason: string | null | undefined): CrewHoldOwner {
  if (typeof reason !== "string") return "unknown";
  /* Emphasis, quoting and the strike-through a superseded line carries are
     punctuation around the sentence rather than part of it. */
  const words = reason
    .toLowerCase()
    .replace(/[*_~`"'’(\[]/g, " ")
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return "unknown";
  const first = HOLD_REASON_ARTICLES.has(words[0]) ? words[1] : words[0];
  if (first === undefined) return "unknown";
  return FOUNDER_HOLD_WORDS.has(first) ? "you" : "other";
}

/**
 * ⚠ **THE CARDS THAT ARE HIS OWN, NOT THE CREW'S — #2117, 2026-10-10.**
 *
 * A card here is one the founder keeps for himself and has forbidden the team
 * to touch. `planUnreadableHolds` still finds it — it genuinely has a live hold
 * and no readable sentence — but it is marked rather than put in the repair
 * band, because **both repairs the sweep offers are things a seat is barred
 * from doing**: writing a `**Waiting on:**` line into the body is editing his
 * card, and dropping the hold label is the one act his order names outright.
 *
 * **The cost of not having this was measured before it was built: five
 * consecutive shifts met the same row and each one correctly did nothing**
 * (`foreman-20261009-0115`, `-1240`, `-1604`, `-1626`, `-1740`). A checker
 * whose finding is always the same and always unactionable teaches its reader
 * to skim, and the other rows in that block are real — which is the one thing a
 * close-of-shift sweep cannot afford.
 *
 * ⚠ **WHY A DECLARATION HERE AND NOT A LABEL ON THE CARD.** A label is the
 * tidier shape and it was the card's own first suggestion — and applying one to
 * #1995 means editing #1995, which is precisely what his order forbids
 * (*"dont let the crew touch it"*). The relay could apply it; no seat can. So
 * the fact lives where the reader is, and it is a DECLARATION rather than a
 * mirror of some other machine-readable source — there is no such source, which
 * is why nothing could see this before.
 *
 * ⚠ **AND IT CANNOT ROT QUIETLY, WHICH IS THE ONLY THING THAT MAKES A LIST
 * HERE DEFENSIBLE UNDER WORKING LAW 4.** `planFounderHeldDrift` reports an
 * entry that no longer names an open card, so an exemption outliving its card
 * is itself a finding rather than a silent permanent pass. Entries carry his
 * words and the date so the next reader can check the sentence is still true.
 */
export const FOUNDER_HELD_CARDS: ReadonlyMap<number, string> = new Map([
  [
    1995,
    "his own prototyping with his team — 2026-10-08, verbatim: \"dont let the crew "
      + "touch it , this is just prototyping im working on with my team\"",
  ],
]);

/** One held card whose hold sentence cannot say whose hold it is. */
export type UnreadableHold = {
  readonly issueNumber: number;
  /** Which hold labels are live on it, so the report names the state it is in. */
  readonly heldStates: readonly CrewHeldState[];
  /**
   * The sentence that could not be read as a person, or `null` when the body
   * carries no `CREW_HOLD_MARKER` line at all. The two are different repairs —
   * one is a sentence to rewrite, the other is a sentence to write — so the
   * report distinguishes them rather than saying "unreadable" about both.
   */
  readonly reason: string | null;
  /**
   * Why this one is HIS, or `null` for an ordinary card (#2117).
   *
   * ⚠ **IT IS A FIELD AND NOT A FILTER, deliberately.** Dropping his cards from
   * the population would make the sweep silent about a live hold nothing draws,
   * which is the exact silence `planUnreadableHolds` was written to end. The
   * row still appears; what changes is that it is not asked to be repaired.
   */
  readonly founderHeld: string | null;
};

/**
 * ⚠ **THE HELD CARDS NOTHING DRAWS AND NOTHING NAMED (#1467 slice 2).**
 *
 * `liveWaitingOnYou` puts a held card on his page when its own `**Waiting on:**`
 * sentence names HIM, and that is the whole of what slice 1 built. Its stated
 * remainder is this function: **a card whose hold is live and whose sentence
 * cannot be read as a person is drawn by nothing** — correctly, because
 * `holdOwnerFromReason` never guesses `you` — **and until now it was named by
 * nothing either.** A hold with no reason anybody can read is #541's freezer
 * wearing a label: not on his desk, not takeable by a shift, and silent.
 *
 * **Measured on the real queue the day this landed (42 open cards, read with
 * these same three readers rather than a grep): 6 held cards — 2 name him
 * (#1492, #1434, both drawn since slice 1), 2 name something that is not a
 * person and are correctly not drawn (#1098 waits on the Janitor's clock, #129
 * on data), and 2 carry `blocked` with no `**Waiting on:**` line at all
 * (#1468, #1337).** Those last two are this function's population.
 *
 * ⚠ **IT REPORTS AND NEVER REPAIRS, for `planDeskHoldLabels`' own reason one
 * type above: what a hold is waiting on is a judgement about work.** Writing a
 * sentence nobody meant would make the silence worse, because the next reader
 * would believe it.
 *
 * ⚠ **AND IT IS DERIVED FROM `holdOwnerFromReason` RATHER THAN FROM "HAS NO
 * SENTENCE", WHICH IS THE SAME ANSWER TODAY AND THE RIGHT ONE TOMORROW.** With
 * a sentence present that reader returns `you` or `other` and never `unknown`,
 * so the two rules currently select exactly the same two cards. Keying on the
 * reader means a future `unknown` — a sentence of pure punctuation, an emphasis
 * marker alone — joins this population on the day it becomes possible, instead
 * of passing as readable because a body line exists. That is working law 4:
 * this asks the question the page asks, not a second question that happens to
 * agree.
 */
export function planUnreadableHolds(input: {
  /** Every OPEN card, with the labels and body `gh issue list` returns. */
  readonly open: ReadonlyArray<{
    readonly issueNumber: number;
    readonly labels: readonly string[];
    readonly body: string;
  }>;
}): readonly UnreadableHold[] {
  const found: UnreadableHold[] = [];
  for (const row of input.open) {
    const heldStates = heldStatesFromLabels(row.labels);
    /* No live hold label, no hold — the sentence is not asked for and a rotted
       one is not a finding (#298 leaves it in place on purpose). */
    if (heldStates.length === 0) continue;
    const reason = holdReasonFromBody(row.body);
    if (holdOwnerFromReason(reason) !== "unknown") continue;
    found.push({
      issueNumber: row.issueNumber,
      heldStates,
      reason,
      founderHeld: FOUNDER_HELD_CARDS.get(row.issueNumber) ?? null,
    });
  }
  return found.sort((a, b) => a.issueNumber - b.issueNumber);
}

/** One live hold whose sentence anybody can read — a re-read, never a finding. */
export type LiveHoldReRead = {
  readonly issueNumber: number;
  /** Which hold labels are live, so the row names the state it is in. */
  readonly heldStates: readonly CrewHeldState[];
  /**
   * The sentence his page shows of this card — the SAME truncation the page
   * applies, because the question a shift is asked here is whether the thing
   * HE reads is still true.
   *
   * ⚠ **IT IS NULLABLE AND TODAY IT IS NEVER NULL, WHICH IS THE POINT.** The
   * filter below is `holdOwnerFromReason(reason) !== "unknown"`, and that reader
   * answers `unknown` for an absent reason and nothing else — so every row here
   * carries words. It is typed nullable anyway so that a future change to
   * `holdOwnerFromReason` cannot make a held card fall out of BOTH this
   * population and `planUnreadableHolds`' at once: a card already invisible to
   * both readers can never be seen to become invisible, which is the silence
   * `CLAUDE.md`'s un-wiring differ paid four months for.
   */
  readonly reason: string | null;
  /** `you` or `other` — never `unknown`, which is the other reader's population. */
  readonly owner: CrewHoldOwner;
  /** Why this one is HIS, or `null` for an ordinary card (#2117). */
  readonly founderHeld: string | null;
};

/**
 * ⚠ **THE HOLD SENTENCE NOTHING RE-READS — #2303, four instances in four days.**
 *
 * `planUnreadableHolds` one type up finds a live hold whose sentence says
 * nothing anybody can act on. **This is its complement, and it is the larger
 * half**: a live hold whose sentence is perfectly readable, written once by one
 * shift, rendered on his page ever since, and re-read by nothing.
 *
 * **The measured repeat (#2303, filed by `foreman-20261012-0917`):**
 *
 * | card | the sentence named | discharged | repaired | late by |
 * |---|---|---|---|---|
 * | #1952 | `PR #1924 and card #1968` | PR merged, card closed 2026-10-08 | 2026-10-09 | 1 day |
 * | #1921 | **YOU** — a dark-ink Klieg lockup | his reply #272, 2026-10-11 04:02Z | 2026-10-11 | ~8 h |
 * | #1882 | the Janitor's next run | patrol #14, 2026-10-11 | 2026-10-12 | 2 days |
 * | #1774 | Yuna's pass on the final wording | the pass landed 2026-10-09 | 2026-10-12 | 3 days |
 *
 * **Four different KINDS of blocker — a numbered artifact, him, a seat, a
 * teammate — and that is what decides what can be mechanised.** Each was
 * repaired by a different shift, and every one of those shifts had done
 * everything else right: the whole class sat behind one instruction to a human,
 * `crew-desk-sweep.mts`' *"Worth a glance only, to check the sentence is still
 * true"*, printed beside a card NUMBER and no words.
 *
 * # ⚠ WHAT THIS IS: THE SENTENCE, PRINTED. WHAT IT IS NOT: A VERDICT.
 *
 * It judges nothing. It puts the words in front of the shift so the glance is
 * READING rather than opening GitHub, and it is honest that three of the four
 * above could not have been caught by any machine in this repository.
 *
 * **The population is the other half of the fix, and it is the half the card
 * under-rated.** The existing quiet band is `planDeskHoldLabels`' `stale`, whose
 * population is the **`founder-ordered`** queue carrying `blocked` with a silent
 * desk — so **#1882 and #1921 were never in it**, being `seat:janitor` and
 * `bug` respectively. Measured on the real queue the day this landed: **50 open
 * cards, 12 with a live hold, 6 of the 12 in that band and 6 outside it.** This
 * reads the WHOLE open queue, exactly as `planUnreadableHolds` does and for the
 * same stated reason.
 *
 * Driven coverage of the four, stated rather than implied: **#1952, #1882 and
 * #1774 all appear here with their words.** **#1921 does not**, and the reason
 * is #298's design rather than a gap — its `blocked` label came off at
 * 2026-10-11 04:04:11Z, two minutes after his reply, so from that moment
 * nothing rendered the sentence at all and the rot that remained was a body
 * line a SHIFT reads under law 7c. Reporting rotted lines on UNHELD cards
 * fights #298 head-on (*"a stale reason can never outlive its state, because
 * the state is the thing that renders it"*), so it is deliberately out of scope.
 *
 * # ⚠ THE THREE MECHANICAL SHAPES WERE ALL DECLINED, EACH ON A MEASUREMENT
 *
 * The card offered three and this is the fourth. The reasons live here rather
 * than only on the card, because the next reader to think *"surely a guard
 * could just…"* should meet the numbers first.
 *
 * **1 · The closed-artifact reference** — report a hold naming a CLOSED card or
 * a MERGED pull request. Cheap, no judgement, and it would have caught #1952.
 * ⚠ **Driven over the 12 real held cards it fires ONCE and that firing is
 * WRONG**: #129's sentence is *"slice 1's rows — PR #1007 merged (9d517932);
 * slice 2's patrol needs refused AND passed prompts on record first"* — the
 * sentence SAYS the pull request merged, and the hold is on something else
 * entirely. ⚠ **And a second false-positive shape is already latent**:
 * `cardNumbersIn` reads #1882's *"patrol #14"* as **card #14**, because
 * `NON_CARD_SEQUENCE_WORDS` is `["reply", "run"]` and *patrol* is not in it — so
 * the day card #14 closes, a correct hold is reported as discharged.
 * **Precision today: 0 true positives, 1 false, 1 latent.** A block that cries
 * wolf on a healthy board teaches its reader to skim the rows beside it that
 * are real, which is #2117's own measured lesson one type up.
 *
 * **2 · The un-re-read hold** — report any sentence not edited in N days.
 * It misses the fastest-rotting kind outright (#1921, stale in eight hours),
 * and ⚠ **measured, it would report two correct holds for ever**: #1835 waits on
 * the workspace #1788, which he has never ordered, and #1609 is parked on his
 * own word until launch day. **2 of 12 rows permanently wrong.**
 *
 * **3 · A Jev read of the sentence against the facts.** The judge is not the
 * hard half; assembling the facts is. ⚠ **And the one fact the him-direction
 * needs — his newest reply — is a production database row, which
 * `crew-desk-sweep.mts` deliberately cannot read**: it is `gh`-only, by its own
 * header, so the cheapest shape of #1921's check is not available to it at any
 * price in judgement. A verdict of *"this hold is discharged"* is also one step
 * from un-holding a card, which `planDeskHoldLabels` refuses to automate on
 * #586's measured grounds (*"removing a hold is the act that lets work start"*).
 *
 * ⚠ **So the class is PARTLY UNGUARDABLE, and that is the finding rather than a
 * failure to find a guard.** What is mechanisable is the population and the
 * printing; the judgement stays a person's, and this makes it a cheap one.
 *
 * ⚠ **AND IT IS DERIVED AS THE COMPLEMENT, NEVER AS A SECOND FILTER**
 * (working law 4). Both readers walk the held set and both key on
 * `holdOwnerFromReason`; this takes the rows that answer anything but
 * `unknown`, and that one takes the rows that answer `unknown`. The suite
 * drives the PARTITION — every held card lands in exactly one — so a filter
 * that drifts in either reader reddens rather than quietly dropping a card
 * from both.
 */
export function planLiveHoldReRead(input: {
  /** Every OPEN card, with the labels and body `gh issue list` returns. */
  readonly open: ReadonlyArray<{
    readonly issueNumber: number;
    readonly labels: readonly string[];
    readonly body: string;
  }>;
}): readonly LiveHoldReRead[] {
  const found: LiveHoldReRead[] = [];
  for (const row of input.open) {
    const heldStates = heldStatesFromLabels(row.labels);
    /* No live hold label, no hold — and #298 leaves a rotted sentence in place
       on purpose once the label is gone, because nothing renders it. */
    if (heldStates.length === 0) continue;
    const reason = holdReasonFromBody(row.body);
    const owner = holdOwnerFromReason(reason);
    /* The complement of `planUnreadableHolds`, keyed on the SAME reader so the
       two can never both drop a card. */
    if (owner === "unknown") continue;
    found.push({
      issueNumber: row.issueNumber,
      heldStates,
      reason,
      owner,
      founderHeld: FOUNDER_HELD_CARDS.get(row.issueNumber) ?? null,
    });
  }
  return found.sort((a, b) => a.issueNumber - b.issueNumber);
}

/**
 * ⚠ **AN EXEMPTION THAT NO LONGER NAMES AN OPEN CARD (#2117).**
 *
 * The one failure a hand-written exemption list can have, and the reason the
 * list is allowed to exist: a card he kept gets closed, or handed back, and the
 * entry sits here for ever quietly excusing something that is not there. That
 * would be working law 4's drift arriving by the slow road.
 *
 * So the list is checked against the queue every run. An entry naming a card
 * the open queue does not hold is REPORTED — the shift deletes the line, and
 * deleting it is the whole repair.
 *
 * ⚠ **IT TAKES THE OPEN QUEUE AND NOT THE HELD SUBSET.** A card of his that is
 * open but has dropped its hold label is not drift — it has simply stopped
 * being flagged, and the exemption costs nothing while it waits. Keying on the
 * held subset would report every such card as stale the moment its hold lifted,
 * which is noise about a correct state.
 *
 * ⚠ **A READ THAT FAILED IS NEVER DRIFT.** The caller passes `null` when the
 * queue could not be read, and this answers with nothing rather than declaring
 * every entry stale — a `gh` outage must not read as "he no longer keeps any of
 * these."
 */
export function planFounderHeldDrift(input: {
  readonly openIssueNumbers: readonly number[] | null;
}): ReadonlyArray<{ readonly issueNumber: number; readonly why: string }> {
  if (input.openIssueNumbers === null) return [];
  const open = new Set(input.openIssueNumbers);
  return Array.from(FOUNDER_HELD_CARDS)
    .filter(([issueNumber]) => !open.has(issueNumber))
    .map(([issueNumber, why]) => ({ issueNumber, why }))
    .sort((a, b) => a.issueNumber - b.issueNumber);
}
