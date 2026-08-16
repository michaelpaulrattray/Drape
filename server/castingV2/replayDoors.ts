/**
 * WHICH DOORS A FRESH TAKE WALKS THROUGH — the class, written down once
 * (fable-733 §2, after the third strike).
 *
 * # Why this is a list and not a fourth patch
 *
 * Regenerate means *"the same ask again, landed differently"* (the founder's
 * regenerate-in-place ruling). The founder has now been stopped by three
 * different doors on that one journey:
 *
 * ```
 * 1. the per-side gate          a side named with no rectangle behind it
 * 2. the confirm-chip rectangle the scope was not replayed with the sentence
 * 3. the already-has door       "She already has her right eye fiery red —
 *                                this would have changed nothing"
 * ```
 *
 * Each was fixed where it was found. Working law 7 says a bug found once is a
 * pattern until proven unique, and three is not once — so the answer stops
 * being "fix this door" and becomes "say what a replay IS, and make every door
 * declare which side of it they are on".
 *
 * # THE RULE
 *
 * A door is **state-comparing** when its refusal ground is *her current frame
 * already satisfies this ask*. On a replay that ground is the premise, not a
 * reason: she has it BECAUSE of the version being regenerated. Those doors are
 * skipped.
 *
 * Everything else is **unchanged**. A replay is not a bypass. Safety and
 * content doors, word-level doors, and infrastructure failures behave on a
 * fresh take exactly as they behave on a fresh ask — including the ones that
 * happen to read the picture, because reading the picture is not the same as
 * comparing the ask against it.
 *
 * # THE BORDERLINE MEMBER, NAMED RATHER THAN BURIED
 *
 * `glasses-hide-eyes` reads her frame and refuses, which makes it look like a
 * state door. It is not: its ground is *we could not READ her eyes, so we will
 * not spend*, which is instrument readability. The replay premise says nothing
 * about it — her master wears frames on the fifth take exactly as it did on
 * the first — so it stays on, and it is free and answerable rather than a dead
 * end. Recorded here because it is the member most likely to be reclassified
 * later, and a future reader should find the reasoning rather than re-derive
 * it.
 *
 * # WHY THE LIST IS EXPORTED AT ALL
 *
 * So a NEW door has to declare its class. `replayDoors.test.ts` pins these
 * entries verbatim; adding a door that judges an ask against her current state
 * without adding it here is a failing test rather than a fourth report from
 * the founder.
 */

/** What a door refuses ON — the thing that decides its side of the rule. */
export type DoorGround =
  /** Her current frame already satisfies the ask. */
  | "state-comparison"
  /** The sentence itself — a typo, a colour with no referent. */
  | "words"
  /** What may be drawn at all, or what our own inputs did. */
  | "safety-or-infrastructure"
  /** An instrument could not take a reading, so we decline to spend. */
  | "readability";

export type ReplayDoor = {
  /** Stable key. Named for the refusal, not for the function. */
  readonly key: string;
  readonly ground: DoorGround;
  /** Where it lives, so the sweep can be re-run against the code. */
  readonly site: string;
};

/**
 * Every door between the Regenerate click and dispatch.
 *
 * Ordered as the request meets them, which is the order somebody re-running
 * the sweep will read the file in.
 */
export const REPLAY_DOORS: readonly ReplayDoor[] = [
  { key: "did-you-mean", ground: "words", site: "refineService: didYouMeanReask" },
  { key: "which-facet", ground: "words", site: "refineService: whichFacetReask" },
  { key: "colour-needs-referent", ground: "words", site: "refineService: needsColourReferent" },
  { key: "interpreter-refusal", ground: "safety-or-infrastructure", site: "refineService: refusalMessage(parsed)" },
  { key: "already-true", ground: "state-comparison", site: "refineService: saysNothingNew" },
  { key: "same-ask-again-offer", ground: "state-comparison", site: "refineService: repeatsThisVersion" },
  { key: "already-upswept", ground: "state-comparison", site: "refineService: alreadyUpswept" },
  { key: "glasses-hide-eyes", ground: "readability", site: "refineService: wearsGlassesByPixels" },
  { key: "forbidden-recipe", ground: "safety-or-infrastructure", site: "repaintRender: recipe doors" },
  { key: "reference-bytes-moved", ground: "safety-or-infrastructure", site: "repaintRender: reference digest" },
] as const;

/**
 * Does a replay skip this door?
 *
 * One predicate, asked by the doors rather than known by them — the same shape
 * `refusesAfterRender` uses for the refund contract, and for the same reason: a
 * door holding a private opinion about whether it applies to replays is how the
 * list and the behaviour come to disagree.
 */
export function skippedOnReplay(key: string): boolean {
  return REPLAY_DOORS.some((door) => door.key === key && door.ground === "state-comparison");
}
