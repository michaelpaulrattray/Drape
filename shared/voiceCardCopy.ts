/**
 * WHAT THE VOICE CARD SAYS — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §6.
 *
 * Every customer-facing string on the voice card lives here, and that is a
 * control rather than tidiness. The card's own done-when is *"a test reads
 * every string on the card for vendor and pipeline words"*, and a test can only
 * read a population it can enumerate — strings scattered through a component
 * are a population nothing can be derived from (working law 4's shape: a guard
 * over a hand-listed sample drifts from the surface it is guarding).
 * `shared/voiceCardCopy.test.ts` walks THIS module's exported values.
 *
 * # THE DISAPPEARING-TECHNOLOGY LAW IS THE WHOLE SPECIFICATION HERE
 *
 * Clause 5: **no engine name on a path someone must walk** to reach their
 * picture — or here, their voice. The three places it most easily leaks, and
 * what each one says instead:
 *
 *   · **The loader** names what is happening to their CAST, never what is
 *     doing it (#55's honest-loader line): *"Making voices from your words"*,
 *     *"Recording Pigman's audition"*.
 *   · **A refusal** says what was refused and what to do. It never says
 *     "quota", "slot", "voice limit", "operation" or "clone" — those are the
 *     house's accounting, and a customer has no basis to act on any of them.
 *     {@link VOICE_CANNOT_KEEP} is the worked example: the thing a customer
 *     needs to know is that the voices they made are still there and that Keep
 *     is worth pressing later.
 *   · **The labels** are Voice 1–3. Never a provider id, never "preview",
 *     never "generated voice".
 *
 * ⚠ **AND "VOICE", NEVER "TAKE"** — his written design, to keep it clear of
 * film takes (#2140). A later card adding a fourth label here is adding a
 * second design call per press, which is the design's §1 reading rather than a
 * preference: every design call the spike made returned exactly three.
 *
 * # NOBODY IS GENDERED, AND THE NAMELESS CASE IS A REAL CASE
 *
 * His word, 2026-10-09: *"i dont want my crew being gender specific about
 * anything"*. A cast may also have no name at all, so every sentence that
 * would name one has a fallback that neither genders nor invents
 * ({@link voiceAuditionLoader}, {@link voiceKeptFoot}). The fallback is
 * *"this character"* — the room's own word for a cast with no name
 * (`CastCampaignsCard` passes exactly that string).
 */

/** The label a customer reads for the nth voice. One-based, as it is spoken. */
export function voiceLabel(index: number): string {
  return `Voice ${index + 1}`;
}

/** The play control's accessible name — a button must say what it plays. */
export function voicePlayLabel(index: number): string {
  return `Play ${voiceLabel(index)}`;
}

/** Keep, naming the one being kept, so the press cannot be ambiguous. */
export function voiceKeepLabel(index: number): string {
  return `Keep "${voiceLabel(index)}"`;
}

/**
 * The card's own heading for the three.
 *
 * It says what they ARE rather than what made them: three readings of the
 * customer's own line, which is also why the heading sits under that line.
 */
export const VOICE_CHOICES_LABEL = "LISTEN AND PICK";

/** The press that makes a fresh three from the words as they read now. */
export const VOICE_MAKE_AGAIN = "Make new voices from this text";

/**
 * The first-open loader. About 7–10 seconds, measured (design §3).
 *
 * "Your words" rather than "the voice line": the line is the customer's own
 * writing, and saying so is the honest description of what is being read.
 */
export const VOICE_MAKING_LOADER = "Making voices from your words";

/** The Keep loader. Names the cast, never the recording machinery. */
export function voiceAuditionLoader(name: string | null): string {
  const who = name && name.trim().length > 0 ? `${name.trim()}'s` : "this character's";
  return `Recording ${who} audition`;
}

/** The foot under the player once a voice is kept — it replaces "No voice yet". */
export function voiceKeptFoot(name: string | null): string {
  const who = name && name.trim().length > 0 ? `${name.trim()}'s` : "This character's";
  return `${who} voice`;
}

/** The hint beside that foot: what the clip IS, in a casting director's words. */
export const VOICE_KEPT_HINT = "An audition in their own voice.";

/**
 * A full account or a spent month, in the customer's terms (design §6).
 *
 * ⚠ **It says the made voices are still there, because they are, and that is
 * the only actionable half.** The house's reason — no slot free, or no
 * operations left this period — is two different accounting facts the customer
 * can do nothing about and would have to be taught to read. What they can act
 * on is pressing Keep again later, so that is what it says.
 */
export const VOICE_CANNOT_KEEP =
  "Voices can't be kept right now. The ones you made will still be here — try Keep again later.";

/** A design that did not come through. Says the money part out loud. */
export const VOICE_MAKE_FAILED =
  "Those voices didn't come through. Nothing was charged — try again.";

/** A Keep that did not come through. */
export const VOICE_KEEP_FAILED =
  "That voice couldn't be kept. Nothing was charged — try again.";

/**
 * The line is too short for a voice to be made from it.
 *
 * The engine has its own floor on a description, and it is the one refusal in
 * the set a customer can genuinely fix — so it says what to do rather than that
 * something failed.
 */
export const VOICE_LINE_TOO_SHORT =
  "There aren't enough words here yet to make a voice from. Say a little more about how they sound.";

/**
 * The empty state when the cast has no written voice line at all.
 *
 * It points at the thing above it rather than offering a press that cannot
 * work: the line is what voices are made FROM, so a card with no line has
 * nothing to offer and says which door to open.
 */
export const VOICE_NEEDS_A_LINE =
  "Write how they sound first, and voices can be made from those words.";

/** Every fixed string on the card, for the no-vendor-words reader. */
export const VOICE_CARD_FIXED_STRINGS: readonly string[] = [
  VOICE_CHOICES_LABEL,
  VOICE_MAKE_AGAIN,
  VOICE_MAKING_LOADER,
  VOICE_KEPT_HINT,
  VOICE_CANNOT_KEEP,
  VOICE_MAKE_FAILED,
  VOICE_KEEP_FAILED,
  VOICE_LINE_TOO_SHORT,
  VOICE_NEEDS_A_LINE,
];

/**
 * Every string the card can draw, fixed and composed alike.
 *
 * ⚠ **The composed ones are rendered with real arguments rather than listed as
 * templates**, including the nameless fallback, because that is where a
 * gendered pronoun or an invented noun would hide. A template read as a
 * template passes a reader that the rendered sentence would fail.
 */
export function voiceCardEveryString(): readonly string[] {
  const names: readonly (string | null)[] = ["Pigman", null, "   "];
  const composed: string[] = [];
  for (const name of names) {
    composed.push(voiceAuditionLoader(name), voiceKeptFoot(name));
  }
  for (let index = 0; index < 3; index += 1) {
    composed.push(voiceLabel(index), voicePlayLabel(index), voiceKeepLabel(index));
  }
  return [...VOICE_CARD_FIXED_STRINGS, ...composed];
}
