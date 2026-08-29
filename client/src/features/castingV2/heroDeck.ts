/**
 * THE CASTING HERO'S DECK — A SHOWCASE, NOT A SHELF
 * (#240, founder correction 2026-08-29, verbatim: *"oh you messed up the
 * casting hero, it's not meant to actually take people to a signed cast these
 * are just images of potential casts you can make in the studio otherwise when
 * a fresh user comes to the casting page they wouldnt see any images?"*).
 *
 * The deck the shift first built read the account's own roster and fell back to
 * a curated set. It was what his spec §5 said, and it was wrong for the reason
 * he gives: **the person who needs this section is the one who has cast nobody
 * yet**, and showing somebody their own existing casts persuades nobody. So
 * there is ONE deck, it is the same for every account, and it does not vary
 * with what anyone owns. `casting-hero.md` §4/§5/§7 were corrected in the same
 * commit so the next reader is not sent back down the roster road.
 *
 * Two properties follow from that and are the whole file:
 *
 *   - **Nothing here is anybody's property, so no card opens a room.** The
 *     `castId` field is gone rather than nulled — a field that is always null
 *     is an invitation to wire it back up.
 *   - **A click fills the prompt with that card's brief and does not submit**
 *     (his ruling on the same card: *"i agree with your reccomendation"*),
 *     exactly as the TRY chips behave. That is what turns a showcase into an
 *     invitation, and it is why every entry still carries the REAL sentence
 *     that cast its own face — a card whose words did not produce its picture
 *     would teach the customer a brief that does not work.
 */

export type HeroDeckEntry = {
  /** Stable key for React and for the tick row. */
  readonly key: string;
  /** The caption's name — the TYPE this frame is, never an invented person. */
  readonly name: string;
  /** Caption metadata. `Example` on every card, because that is what it is. */
  readonly meta: string;
  /** The sentence this face was cast from. Shown verbatim, and it is what a click puts in the box. */
  readonly brief: string;
  readonly imageUrl: string;
};

/**
 * THE SHOWCASE — the founder's own casts, on his own instruction (#234,
 * verbatim: *"I have some really cool casts on my account user-1 you could use
 * as the images. dont use boring ones"*).
 *
 * Every one of these is a real frame this product rendered, cut to 4:5 from
 * the delivered candidate, and every brief below is the real sentence that
 * cast it — read off `casting_rolls.briefText` rather than written for the
 * page. The names are TYPES rather than invented people, because an unsigned
 * candidate has no name and inventing one would be the only fiction on the
 * surface.
 *
 * It is a named constant so the set can be re-picked in one edit (#240).
 */
export const SHOWCASE_DECK: readonly HeroDeckEntry[] = [
  {
    key: "example-hive",
    name: "Hive-skull being",
    meta: "Example",
    brief:
      "Adult hive-skull being, honeycomb cranial structure, large staring eyes, exposed skeletal jaw with long teeth, comb growth on the shoulders, insect wing. Menacing hive-creature presence.",
    imageUrl: "/casting-hero/deck/hive.webp",
  },
  {
    key: "example-oni",
    name: "Oni-cyber being",
    meta: "Example",
    brief:
      "Adult oni-cyber being, pale skin, glowing magenta eyes, long black hair, fangs, integrated spiked cranial machinery. Menacing demon-machine presence.",
    imageUrl: "/casting-hero/deck/oni.webp",
  },
  {
    key: "example-sphinx",
    name: "Feline humanoid",
    meta: "Example",
    brief:
      "Adult feline humanoid, hairless violet-blue skin, large ears, amber eyes, long tail. Powerful sphinx-cat presence. Dark structured armour in bronze, gold and coloured inlay.",
    imageUrl: "/casting-hero/deck/sphinx.webp",
  },
  {
    key: "example-android",
    name: "Android",
    meta: "Example",
    brief:
      "Female android, youthful, delicate synthetic skin, sculpted pink hair with blunt fringe. Exposed mechanical neck and chest framework with wiring and plating. Sci-fi humanoid robot type, doll-like porcelain android presence.",
    imageUrl: "/casting-hero/deck/android.webp",
  },
  {
    key: "example-orc",
    name: "Orc warrior",
    meta: "Example",
    brief:
      "a powerful male orc warrior, framed from the chest up. He has rough, textured ashen-gray skin with deep wrinkles, scars, and a light dusting of white powder across his shoulders and chest. His face is broad and intense, with a heavy furrowed brow, short gray-white stubble beard, and two large upward-curving lower tusks. His eyes glow bright golden-yellow.",
    imageUrl: "/casting-hero/deck/orc.webp",
  },
  {
    key: "example-goth",
    name: "Cyber-goth",
    meta: "Example",
    brief:
      "a young woman with an intense cyber-goth aesthetic, facing the camera directly from the chest up. She has extremely pale porcelain skin and a sharp, androgynous face.",
    imageUrl: "/casting-hero/deck/goth.webp",
  },
];

/**
 * Which slots are drawn, given how many entries there are.
 *
 * Three cards is the fan the spec describes. With two, the same face would sit
 * in the centre and in a peek at once; with one it would be all three. So a
 * short deck simply draws fewer cards — the geometry never repeats a face,
 * which is what makes the peeks read as other people rather than as an effect.
 */
export function deckOffsets(count: number): readonly number[] {
  if (count <= 1) return [0];
  if (count === 2) return [0, 1];
  return [-1, 0, 1];
}

/** The entry at an offset from the current index, wrapping. */
export function entryAt(
  entries: readonly HeroDeckEntry[],
  index: number,
  offset: number,
): HeroDeckEntry {
  const count = entries.length;
  return entries[(((index + offset) % count) + count) % count]!;
}
