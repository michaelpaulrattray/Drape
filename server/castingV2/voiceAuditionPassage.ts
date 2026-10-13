/**
 * THE HOUSE AUDITION PASSAGE — N4b-1 (#2469), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §4.
 *
 * One passage for every cast, written once and kept here. His design's own
 * reason, and both halves of it are load-bearing:
 *
 *   · **Comparable.** Every kept voice reads the same words, so two casts can
 *     be heard against each other and a re-mint can be heard against its
 *     original (N4b-4's court is exactly that comparison, to his ear — law 9).
 *     A per-cast passage would make every pair of clips differ in two ways at
 *     once, and no listener could say which difference they were hearing.
 *   · **A good cloning source.** The slot is a cache and the clip is the asset,
 *     so the clip is what a re-mint is built from. That wants breadth of sound
 *     rather than breadth of meaning: long vowels and short, plosives,
 *     sibilants, a question, a list, a quiet line and a loud one, numbers, and
 *     sentences of very different lengths so pace and breath are both audible.
 *
 * # WHAT IT DELIBERATELY IS NOT
 *
 * ⚠ **It carries NO customer content and NO cast name**, and that is the whole
 * of why it is a constant in the repository rather than a template. The moment
 * a name is interpolated the clips stop being comparable, the passage becomes a
 * second place a customer's words can travel, and the text of every stored clip
 * has to be stored beside it to know what was said. The cast's own voice LINE
 * is what the voices are designed from (that is the customer's writing, and it
 * is stored beside the clip); the passage is what the chosen voice then reads.
 *
 * It names no person, place, product or brand; it genders nobody (his word,
 * 2026-10-13); and it says nothing a customer would hear as a claim about their
 * cast. It is a read-aloud exercise, and it is meant to sound like one.
 *
 * # LENGTH IS A MEASUREMENT, NOT A TARGET
 *
 * The design asks for "about 90 seconds". Speech rate is the engine's, not
 * ours, so the honest shape is a fixed text whose DELIVERED length is measured
 * and recorded rather than a text trimmed until a stopwatch agrees.
 *
 * ⚠ **AND IT IS MEASURED NOW, SO THE DESIGN'S "~90 s" IS SUPERSEDED BY A REAL
 * NUMBER: 1,348 characters delivered 2,202,688 bytes of `mp3_44100_128`, which
 * at a constant 128 kbps is 137.7 SECONDS — about 2 minutes 18, not 90 seconds**
 * (the first real clip, driven on 2026-10-13 through the real entrance; the
 * audition call took 29.3 s to produce it). Measured rate: **9.8 characters a
 * second**, so a genuinely 90-second passage would be about 880 characters.
 *
 * **The text is deliberately NOT cut to hit the design's figure**, and the
 * reason is the clip's job rather than inertia: it exists to be a re-mint
 * SOURCE and the comparison his ear judges in N4b-4, and a third of the
 * phonetic breadth is exactly what a 35% trim would remove. 2.1 MB per cast and
 * 1,348 characters of speech are both cheap. **So the figure is what moves, not
 * the passage** — and it is the DESIGN document that now carries a stale "90 s"
 * (its correction rides #2474, with the other figures that went stale when his
 * plan was upgraded, because correcting a design is not a shift's act). If his
 * ear finds it long, the text moves on his word and this constant is the one
 * place it moves.
 */

/**
 * The passage, verbatim. ⚠ **Changing this text changes what every FUTURE clip
 * says while every stored clip keeps the old words**, so a clip records the
 * passage version it read ({@link VOICE_AUDITION_PASSAGE_VERSION}) and a
 * comparison across versions is not a like-for-like comparison.
 */
export const VOICE_AUDITION_PASSAGE = [
  "Let me take it from the top, and I will keep going until you tell me to stop.",
  "The room is quiet. Outside, a bus pulls away from the kerb, and somewhere further off a dog starts up and thinks better of it.",
  "I have read this page eleven times now — four this morning, seven since lunch — and it still catches me in the same place.",
  "Here is the part I want you to hear.",
  "Soft things first: a hush, a whisper, the slow sound of someone deciding not to answer.",
  "Then the hard edges. Stop. Back. Pick it up. Put it down. Try that again, properly, with both hands.",
  "Was it ever going to be simple? No. But it was always going to be worth it.",
  "I can go louder, if you want louder, and I can take it right down to almost nothing, like this, so that you have to lean in.",
  "Count with me: one, two, three, nineteen, forty, a hundred and six.",
  "The list, in order: salt, sugar, vinegar, flour, matches, string, and a very long piece of wire.",
  "Some sentences are short.",
  "Others wander off, double back on themselves, remember something they meant to say three sentences ago, and arrive late and slightly out of breath at the end of the thought they started with.",
  "Ask me anything. Ask me twice, if the first answer sounded rehearsed.",
  "That is the whole of it — the shape of a voice, said plainly, with nothing hidden and nothing added.",
  "Thank you. I am ready whenever you are.",
].join(" ");

/**
 * Bumped whenever {@link VOICE_AUDITION_PASSAGE} changes, and stored on every
 * clip. A version is how a later reader knows two clips are not comparable; the
 * clip's own stored text would be a second copy of this constant and would
 * drift from it (working law 4).
 */
export const VOICE_AUDITION_PASSAGE_VERSION = 1;

/** Words in the passage, derived — a receipt figure, never a budget. */
export function voiceAuditionPassageWordCount(): number {
  return VOICE_AUDITION_PASSAGE.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * What the three PREVIEWS read while a customer is choosing.
 *
 * Short on purpose: the previews are for picking by ear and arrive before
 * anything is kept, so they do not need the cloning breadth the audition needs
 * — and the engine's own floor is 100 characters when the text is supplied at
 * all (`ELEVENLABS_PREVIEW_TEXT_MIN_CHARS`), which this clears with room to
 * spare. The opening of the passage, so the voice a customer picks is heard
 * saying the first thing it will later say at length.
 */
export const VOICE_PREVIEW_TEXT = [
  "Let me take it from the top, and I will keep going until you tell me to stop.",
  "The room is quiet. Outside, a bus pulls away from the kerb, and somewhere further off a dog starts up and thinks better of it.",
].join(" ");
