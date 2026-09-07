/**
 * THE FOUR STATES A DESK CARD CAN BE IN, AND THE ONE QUESTION THE PAGE ASKS OF
 * THEM (#354 — his ruling, Crew reply #159, 2026-09-07).
 *
 * > **"The first. Keep it on my desk until the act is done."**
 *
 * # WHAT WENT WRONG
 *
 * `state` was carrying two different questions under one word:
 *
 *   1. **has he replied?** — what a shift writes `answered` for.
 *   2. **does this still need him?** — what the RENDER uses it for.
 *
 * They agree for most cards, which is why it held. They come apart in exactly
 * one shape, and it is the worst one available: he answers the design question
 * and the card's remaining work is ANOTHER ACT OF HIS — a yes whose next step
 * is his command, an approval that unblocks a ceremony he must run. At that
 * moment the card left *What needs you* and filed itself under *already dealt
 * with*, which means **no action needed**.
 *
 * The measured instance is `pipeline-panel-325`: he approved the shape, a shift
 * correctly marked it `answered`, and the single remaining act — one command
 * only he could run — sat in history until a shift found it by accident.
 *
 * # THE STATES
 *
 *   - `open`      — needs him, never answered.
 *   - `waiting`   — **he answered, and it STILL needs an act from him.**
 *                   Renders in *What needs you*, visibly distinct from a fresh
 *                   ask. This is the state his ruling adds.
 *   - `answered`  — he answered and nothing further is required of him.
 *   - `done`      — its issue closed.
 *
 * The migration is safe in the honest direction: every existing `answered`
 * card keeps its meaning exactly, and a shift opts a card into `waiting`
 * deliberately. Nothing is inferred — the card itself said so: *"does this
 * still need him is not a property of the issue's labels; it is a judgement a
 * shift makes when it writes the card, and a derived view that guesses it will
 * be wrong in both directions."*
 *
 * # ⚠ WHY THIS IS A MODULE AND NOT A FOURTH STRING IN THREE FILES
 *
 * Three separate places asked `state === "open"` to mean *does this still need
 * him*: the Needs You filter, the reply fall-through to the General box, and
 * NEXT UP's "waiting on you" chip. Adding a state to two of three literals is
 * working law 4's exact shape, and every failure it produces is SILENT — a
 * `waiting` card that renders on his desk but whose reply falls into the
 * General box, or that no longer marks its NEXT UP row as blocked on him.
 *
 * So the question has one answer, imported by all three, and the briefing's
 * zod enum is derived from `CREW_CARD_STATES` rather than typed beside it.
 */

/** Every state a needs-you card or eye item may hold, in page order. */
export const CREW_CARD_STATES = ["open", "waiting", "answered", "done"] as const;

export type CrewCardState = (typeof CREW_CARD_STATES)[number];

/**
 * Does this card still want something from him?
 *
 * The single question the desk's three consumers ask. `waiting` is true here
 * and false in every "has he replied" sense — which is the whole point of the
 * split, and why no caller may ask it by comparing to a literal.
 *
 * ⚠ THERE IS DELIBERATELY NO `crewCardAnsweredByHim` BESIDE IT. One was
 * written — the other half of the old word, for a reader asking "has he
 * replied" — and the uncalled-export gate refused the commit, correctly: it
 * had no consumer. An export with no caller is a control that does not exist
 * (invariant 7), and the fact it was meant to carry is stated here instead,
 * where it costs nothing: **`waiting` is TRUE of both questions.** He has
 * replied, and it is still his. A future reader who needs the other half
 * writes it with its call site.
 */
export function crewCardNeedsHim(state: string): boolean {
  return state === "open" || state === "waiting";
}
