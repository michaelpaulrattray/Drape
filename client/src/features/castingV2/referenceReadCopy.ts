/**
 * WHAT SHE READS WHEN THE PICTURE SHE ATTACHED IS READ FOR HER — the words,
 * apart from the component that draws them.
 *
 * # These sentences serve TWO readers now, and that is the point
 *
 * They were the makeup link's copy. The link is deleted (founder ruling,
 * fable-1051) and the reading it performed lives inside the universal road,
 * where a hair colour is read by the same mechanism — so one caption, one
 * `Use`, one sentence about what did not come across, spoken identically
 * whichever reader answered. Two lanes with two sets of words is how a product
 * comes to make the same promise two ways.
 *
 * # Why the copy is a module with a suite
 *
 * The UI milestone contract (founder, 2026-08-01): every user-visible string is
 * re-derived against current capability before it ships, and the mechanizable
 * half of that lives as assertions rather than as review memory. These sentences
 * make CAPABILITY CLAIMS — what was taken from her picture, and what was not —
 * so a string that drifts from what the server actually did is a promise the
 * product cannot keep.
 *
 * # The bound every line here is written under (fable-940)
 *
 * The sentence a reader writes is a SUGGESTION, never a setting. It is shown to
 * her, she adopts or edits it, and only then does it travel as an ordinary
 * makeup ask that costs what any other ask costs. Nothing here may read as
 * *"we have changed her"*, because nothing has: no credit has been spent, no
 * render has run, and the words are not even in the box until she says so.
 *
 * That is also what makes the road legal rather than merely polite: `refineDelta`
 * requires a makeup value to appear in the customer's OWN instruction, so a
 * sentence routed around her would be refused by a guard that has stood there
 * since D-172. The chip is the door through which the words become hers.
 *
 * # And the honesty about what did NOT come across
 *
 * A read names the surfaces it used and the surfaces it dropped. A dropped
 * surface said nothing at all would be the quiet-truncation shape this program
 * keeps paying for — she would see four things in her photograph and three in
 * her sentence, with nothing anywhere saying which one went missing or that she
 * may simply type it.
 */

/** The surfaces a makeup read can speak for, as the server names them.
 *
 *  A hair reading's blocks arrive already in English ("copper at the ends"),
 *  spelled on the server so this surface holds ONE list of strings rather than
 *  two shapes and a branch — they fall through the lookup below unchanged,
 *  which is exactly what its fallback is for. */
export const MAKEUP_SURFACE_WORDS: Readonly<Record<string, string>> = Object.freeze({
  eyes: "eyes",
  lips: "lips",
  brows: "brows",
  complexion: "complexion",
});

/**
 * The surface's own word, or the key itself when the catalogue has not met it.
 *
 * A fallback rather than a throw: a server that grows a fifth surface should
 * show the customer an honest word she can read, not break the panel — and the
 * word it shows is the server's own, which is at worst plain rather than wrong.
 */
export function makeupSurfaceWord(surface: string): string {
  return MAKEUP_SURFACE_WORDS[surface] ?? surface;
}

/** "eyes and lips" · "eyes, lips and brows" — an English list, not a join. */
export function spokenList(words: readonly string[]): string {
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * The one line above the sentence: what this is, and that it has cost nothing.
 *
 * "Read from your photo" rather than "AI suggestion" — the founder's ontology
 * governs (law 8): she gave us a picture and we looked at it. The tense is past
 * and the object is the PICTURE, so nothing in it can be mistaken for a claim
 * about her Cast.
 *
 * It names no feature, which is what lets one caption serve both readers.
 */
export const READ_CAPTION = "Read from your photo — nothing has changed yet";

/**
 * What did not survive the read, in her words, or `null` when nothing was lost.
 *
 * Never a code, never a count on its own: the surfaces are NAMED, because the
 * only useful thing she can do with this sentence is type the missing one
 * herself.
 */
export function droppedNote(dropped: readonly string[]): string | null {
  if (dropped.length === 0) return null;
  const words = spokenList(dropped.map(makeupSurfaceWord));
  return dropped.length === 1
    ? `The ${words} didn't come across — type it yourself if you want it.`
    : `The ${words} didn't come across — type them yourself if you want them.`;
}

/**
 * The word on the button that fills the box.
 *
 * The same word, in the same place, as the chip that offers a version's own
 * request back — because it does the same thing: it PREFILLS AND STOPS. Two
 * controls that behave identically must read identically, or the second one
 * teaches her that the first might send.
 */
export const READ_USE = "Use";
