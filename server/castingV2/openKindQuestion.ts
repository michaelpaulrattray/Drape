/**
 * WHAT WORD TO ASK A SEGMENTER FOR A THING NOBODY HAS CATALOGUED — the open
 * lane's crop road (courted opus-1044/1045, countersigned fable-1402/1403).
 *
 * # The measurement this module exists because of
 *
 * The founder, looking at his own cast: *"the orb isnt showing up in the
 * features panel"* and *"it doesnt have a bounding box"*. The second sentence
 * traced to a single fact, read at the rows: **no open kind has ever had a crop
 * CUT, in the whole of production.** Two rows exist — an orb and a tail — and
 * both are words-only with no guard reading at all, because the segmenter was
 * asked for the bare noun and answered nothing.
 *
 * Driven on those two frames, house money, sequential:
 *
 * ```
 * "orb"                                        whole frame          0 px
 * "orb"                             inside the head crop            0 px
 * "eyebrows"    ← CONTROL           inside the head crop       1,605 px
 * "glowing red vertical slit orb"              whole frame       1,876 px  37x69
 * "tail"                                       whole frame          0 px
 * "tapered curved tail with dark hexagonal scale texture"      48,032 px  217x616
 * ```
 *
 * The control is the cell that matters: on the SAME pixels, the bare noun
 * answers nothing and a word the reader knows answers. It was never *this crop
 * is unreadable* — it is *this WORD is unreadable*, and **no crop makes an
 * unknown word known** (opus-1044). A longer, descriptive phrase makes it
 * known.
 *
 * # AND THE WHOLE STORED SENTENCE IS THE KEY — no trimmer, measured
 *
 * The court used a hand-trimmed noun phrase. The mint does not hold one: it
 * holds the row's WORDS, which are her whole sentence. Asked before this was
 * designed, because a trimmer is a second component that can be wrong:
 *
 * ```
 *                                                  orb            tail
 * her whole stored sentence                 1,863 px 37x68   48,043 px 217x616
 * the hand-trimmed noun phrase              1,876 px 37x69   48,032 px 217x616
 * ```
 *
 * One pixel apart on one specimen and the identical box on the other. **So the
 * words go to the reader as they are**, and there is no trimmer to get wrong.
 *
 * # THE LADDER, AND WHY THE ROW NEEDS NO NEW COLUMN
 *
 * Three rungs, tried in order, and which one answered must be readable
 * afterwards — an unrecorded ladder has an invisible failure rate, which is the
 * collected-never-asserted shape (condition, fable-1403).
 *
 * It needs no column, because **the row already answers it** and a second field
 * saying what a row can already say is the parallel copy working law 4 forbids:
 *
 * ```
 * rung 1  her own words        a crop, and `guardKind` holds the joined words
 * rung 2  the site she named   a crop, and `guardKind` holds a word that is NOT
 *                              the joined words but IS in her sentence
 * rung 3  words only           no crop at all — today's behaviour, unchanged
 * ```
 *
 * {@link openKindRungOfRow} is that reading, so the derivation lives beside the
 * thing that produces it rather than in whatever script asks the question next.
 *
 * # ⚠ WHAT IS NOT PROVEN, AND IT IS THE WHOLE POPULATION
 *
 * **n = 2.** Two open kinds have ever existed in production and both phrases
 * were RICH — colour, shape and texture. A bare kind whose words are little
 * more than the noun — *"a halo"*, *"wings"* — is **untested**, and the halo is
 * the very kind the open lane's first crop was lost on. Rung 3 is exactly
 * today's behaviour for those, so nothing regresses; what closes the gap is the
 * rung record turning their first arrivals into data rather than anecdote.
 */
import type { Instance } from "./referenceSlots";

/** Which rung of the ladder produced a crop, or that none did. */
export type OpenKindRung = "words" | "site" | "none";

export type OpenKindAsk = {
  /** The string handed to the segmenter. */
  readonly question: string;
  /** Which rung this string came from. */
  readonly rung: Exclude<OpenKindRung, "none">;
};

/**
 * The FIRST rung: everything she has said about this thing, as one phrase.
 *
 * Joined rather than "the newest sentence": the stack is her declarations
 * oldest-first, and a later refinement (*"make it brighter"*) is not a
 * description of the thing on its own. The whole stack is what the row means by
 * the feature, and the measurement above was taken on exactly that string.
 *
 * `null` when she has said nothing — which is a real state (a kind can arrive
 * with an unread stack) and is not something to invent a phrase for.
 */
export function openKindWordsQuestion(words: readonly string[]): string | null {
  const joined = words.map((word) => word.trim()).filter((word) => word !== "").join(", ");
  return joined === "" ? null : joined;
}

/**
 * The SECOND rung: the place her own sentence names.
 *
 * ⚠ **SOURCE CONTAINMENT IS THE WHOLE OF THIS RUNG** (ruled fable-1402): the
 * site must appear in HER OWN WORDS. A site answered from anywhere else is a
 * guess about her body, and this road's failure mode is a rectangle drawn over
 * the wrong pixels — which the panel treats as a promise that clicking there
 * edits that thing.
 *
 * So this takes the site a reader proposed and RETURNS IT ONLY IF SHE SAID IT.
 * Nothing here asks the reader; that call belongs to the caller that has one.
 *
 * ⚠ **THIS HAS NO CALLER, AND IT CARRIES AN EXPIRY RATHER THAN A HOPE**
 * (guard-rail, fable-1406 §3). A helper with no caller and no expiry is the
 * inert-control pattern wearing scaffolding's clothes — the thing this
 * codebase has found four times and written a law about. So the decision point
 * is written here, where whoever next reads the function meets it:
 *
 *   BUILD the site-proposing read   when the rung record shows rung-1 failures
 *                                   arriving — the bare-phrase kinds ("a halo",
 *                                   "wings") that n=2 never tested
 *   DELETE this function            if a quarter's rows say the phrase rung
 *                                   suffices on its own
 *
 * `openKindRungOfRow` over the library's open rows is the reading that decides
 * it. Neither outcome is *leave it here unexamined*.
 */
export function openKindSiteQuestion(
  words: readonly string[],
  proposedSite: string | null | undefined,
): string | null {
  if (!proposedSite) return null;
  const site = proposedSite.trim().toLowerCase();
  if (site === "") return null;
  const said = words.join(" ").toLowerCase();
  /* Word-boundaried, so `ear` cannot be admitted by `beard` — the substring
     trap this repo has paid for in three other vocabularies. */
  const boundary = new RegExp(`(^|[^a-z])${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
  return boundary.test(said) ? site : null;
}

/**
 * THE LADDER, in order — the string to ask and the rung it came from, or `null`
 * when neither rung has anything and the slot files words as it does today.
 */
export function openKindAsk(input: {
  readonly words: readonly string[];
  /** A site a reader proposed, if the caller bought one. Never required. */
  readonly proposedSite?: string | null;
}): OpenKindAsk | null {
  const words = openKindWordsQuestion(input.words);
  if (words !== null) return { question: words, rung: "words" };
  const site = openKindSiteQuestion(input.words, input.proposedSite);
  if (site !== null) return { question: site, rung: "site" };
  return null;
}

/**
 * WHICH RUNG A STORED ROW CAME FROM — derived, never a second column.
 *
 * A row with no crop never cut one, whatever was asked. A row whose recorded
 * question is her joined words came off rung 1; anything else that cut is rung
 * 2, because rung 2 is the only other thing that can produce a question.
 */
export function openKindRungOfRow(row: {
  readonly words: readonly string[];
  readonly guardKind: string | null;
  readonly hasCrop: boolean;
}): OpenKindRung {
  if (!row.hasCrop) return "none";
  const words = openKindWordsQuestion(row.words);
  if (words !== null && row.guardKind === words) return "words";
  return "site";
}

/** Nothing here is per-side; a distributed kind asks the same phrase of each
 *  half, exactly as `earring` does. Declared so the next reader does not go
 *  looking for a side branch that would have no reason to exist. */
export type OpenKindSide = Instance | null;
