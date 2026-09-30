/**
 * WHAT A CHARGED-BUT-UNPLACED CAST TELLS ITS OWNER — #1571.
 *
 * # The defect this exists for
 *
 * A customer asks for a cast on the canvas. They are charged. The render lands.
 * **Putting it on the board then fails — and the screen says nothing at all.**
 *
 * The cast is safe, it is in their Library, and they were not charged twice.
 * The server knows all three and writes them into one sentence
 * (`server/lib/boardOps.ts`, and again in `server/casting/operationRecovery.ts`
 * for a replayed operation), puts it on the response beside a `placed` boolean
 * — and **`grep -rni "placementmessage" client/` returned nothing.** No
 * component, no hook, no toast. The only reader in the whole tree was a server
 * test asserting the field's contents, which is what kept a dead field looking
 * alive.
 *
 * That is invariant 7's shape — *a control that is not invoked does not exist*
 * — on a money-adjacent path, where the sentence's entire job is to tell
 * somebody who was charged that their money is fine and where their cast went.
 *
 * # Why the decision is a function rather than an `if` in the hook
 *
 * This repository has **no DOM environment** — `vitest.config.ts` is
 * `environment: "node"`, its client include ends in `.test.ts`, and there are
 * zero `.test.tsx` files — so a rule left inline in a React hook cannot be
 * driven at all. The house answer (`staffRole.ts`, `section05-guard.test.ts`)
 * is to put the rule where a test can reach it and guard at source that the
 * component still calls it. Wiring a field that has never once been rendered
 * without something able to fail is how it stays unrendered for another
 * thirteen months.
 *
 * # What it deliberately does not do
 *
 * **It does not compose a sentence.** The words are the server's, they were
 * corrected by #1565 — two of the three said *"saved in Models"*, naming a page
 * the rail has called **Library** since the foundation landed — and a second
 * author of them here would be a parallel copy of a sentence that has already
 * drifted once (working law 4).
 *
 * **It does not decide where to navigate.** A *"Take me there"* action would be
 * useful and is a second decision on a surface his eye governs; the card's own
 * done-when is that a charged customer sees the sentence.
 */

/**
 * The shape this rule reads, named structurally rather than imported.
 *
 * ⚠ **Both fields are OPTIONAL and that is not defensiveness.** `placed` is
 * absent from every response on the roads that never place anything, and
 * `placementMessage` is spread in conditionally by the server
 * (`...(placementMessage ? { placementMessage } : {})`), so it is absent rather
 * than empty on the happy path. A rule that assumed either would be a rule
 * about a response shape that does not exist.
 */
export type PlacementOutcome = {
  placed?: boolean;
  placementMessage?: string | null;
};

/**
 * The sentence to announce, or `null` when there is nothing to say.
 *
 * ⚠ **`placed === false`, never `!placed`.** The field is absent on responses
 * that were never about placing anything, and `!undefined` is `true` — so the
 * loose test would announce a failure on every one of them, with no sentence to
 * show, which is the same defect pointed the other way.
 */
export function placementAnnouncement(outcome: PlacementOutcome): string | null {
  if (outcome.placed !== false) return null;
  const message = outcome.placementMessage?.trim();
  /*
    NO SENTENCE, NO TOAST. The server writes one on every road that sets
    `placed: false` today — but a toast with an empty body is a blank rectangle
    appearing over someone's canvas for nine seconds, and inventing a fallback
    here would be authoring the money sentence in the client, which is the one
    thing the header says this file does not do. The failure is still in the
    server's log either way.
  */
  return message ? message : null;
}

/**
 * How long the sentence stays on screen, in milliseconds.
 *
 * 9 s is what this app already gives a money-adjacent failure sentence
 * (`BoardPage.tsx`'s variation failures, `useCastingPackageRefresh`,
 * `useCastGate`) rather than a number chosen here. A two-clause line about
 * where a paid-for cast went is not a four-second read, and it is the only
 * notice its owner gets.
 */
export const PLACEMENT_ANNOUNCEMENT_MS = 9_000;
