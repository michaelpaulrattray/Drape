/**
 * THE CASTING HERO'S DECK — what it shows, and where those cards come from
 * (#234, his spec `docs/specs/Casting-ui-ux-design/casting-hero.md` §4–§5).
 *
 * The argument of the whole hero is that these are REAL signed performers and
 * those are the REAL words that cast them. So the deck is built from the
 * roster this account already loads — the same rows the grid below draws, not
 * a second list of the same people (working law 4) — and every card carries
 * the brief its own face was cast from, at the same array index, because
 * pairing a face with someone else's sentence is the one failure that would
 * make the block worse than nothing.
 *
 * An account with no signed Cast gets a curated deck instead, and IT SAYS SO:
 * the block's eyebrow reads EXAMPLE CASTS rather than CAST FROM THESE WORDS.
 * Claiming an empty roster has signed performers is a lie the customer catches
 * the moment they scroll (spec §5, and the honest-capability law).
 */

export type HeroDeckEntry = {
  /** Stable key for React and for the tick row. */
  readonly key: string;
  /** The caption's name — a signed Cast's own name, or an example's type. */
  readonly name: string;
  /** Caption metadata: a counted frame total, or `Example`. Never a claim. */
  readonly meta: string;
  /** The sentence this face was cast from. Shown verbatim, in quotes. */
  readonly brief: string;
  readonly imageUrl: string;
  /**
   * Her room, when there is one. `null` on the curated deck: an example is not
   * anybody's property and has nowhere to open — and a card that looks
   * clickable and goes nowhere is exactly the dead control §O forbids.
   */
  readonly castId: string | null;
};

/** Five to seven entries (spec §5); the roster is capped to the top of that. */
export const HERO_DECK_MAX = 7;

export type RosterCast = {
  castId: string;
  name: string | null;
  imageUrl: string | null;
  brief?: string | null;
  frameCount?: number;
  status: "building" | "ready";
};

/**
 * THE CURATED DECK — the founder's own casts, on his own instruction (#234,
 * verbatim: *"I have some really cool casts on my account user-1 you could use
 * as the images. dont use boring ones"*).
 *
 * Every one of these is a real frame this product rendered, cut to 4:5 from
 * the delivered candidate, and every brief below is the real sentence that
 * cast it — read off `casting_rolls.briefText` rather than written for the
 * page. The names are TYPES rather than invented people, because an unsigned
 * candidate has no name and inventing one would be the only fiction on the
 * surface.
 */
export const EXAMPLE_DECK: readonly HeroDeckEntry[] = [
  {
    key: "example-hive",
    name: "Hive-skull being",
    meta: "Example",
    brief:
      "Adult hive-skull being, honeycomb cranial structure, large staring eyes, exposed skeletal jaw with long teeth, comb growth on the shoulders, insect wing. Menacing hive-creature presence.",
    imageUrl: "/casting-hero/deck/hive.webp",
    castId: null,
  },
  {
    key: "example-oni",
    name: "Oni-cyber being",
    meta: "Example",
    brief:
      "Adult oni-cyber being, pale skin, glowing magenta eyes, long black hair, fangs, integrated spiked cranial machinery. Menacing demon-machine presence.",
    imageUrl: "/casting-hero/deck/oni.webp",
    castId: null,
  },
  {
    key: "example-sphinx",
    name: "Feline humanoid",
    meta: "Example",
    brief:
      "Adult feline humanoid, hairless violet-blue skin, large ears, amber eyes, long tail. Powerful sphinx-cat presence. Dark structured armour in bronze, gold and coloured inlay.",
    imageUrl: "/casting-hero/deck/sphinx.webp",
    castId: null,
  },
  {
    key: "example-android",
    name: "Android",
    meta: "Example",
    brief:
      "Female android, youthful, delicate synthetic skin, sculpted pink hair with blunt fringe. Exposed mechanical neck and chest framework with wiring and plating. Sci-fi humanoid robot type, doll-like porcelain android presence.",
    imageUrl: "/casting-hero/deck/android.webp",
    castId: null,
  },
  {
    key: "example-orc",
    name: "Orc warrior",
    meta: "Example",
    brief:
      "a powerful male orc warrior, framed from the chest up. He has rough, textured ashen-gray skin with deep wrinkles, scars, and a light dusting of white powder across his shoulders and chest. His face is broad and intense, with a heavy furrowed brow, short gray-white stubble beard, and two large upward-curving lower tusks. His eyes glow bright golden-yellow.",
    imageUrl: "/casting-hero/deck/orc.webp",
    castId: null,
  },
  {
    key: "example-goth",
    name: "Cyber-goth",
    meta: "Example",
    brief:
      "a young woman with an intense cyber-goth aesthetic, facing the camera directly from the chest up. She has extremely pale porcelain skin and a sharp, androgynous face.",
    imageUrl: "/casting-hero/deck/goth.webp",
    castId: null,
  },
];

/** `6 frames` / `1 frame` / `Building` — counted, never declared. */
export function frameMeta(cast: RosterCast): string {
  if (cast.status === "building") return "Building";
  const frames = cast.frameCount ?? 0;
  if (frames <= 0) return "Signed";
  return frames === 1 ? "1 frame" : `${frames} frames`;
}

/**
 * The deck for this account.
 *
 * A signed Cast joins it only with BOTH a face and a brief: the card is the
 * face and the block is the brief, and half a card would be the pairing defect
 * wearing an empty quote. If none qualify, the curated deck stands in and the
 * caller draws the EXAMPLE CASTS eyebrow.
 */
export function heroDeck(casts: readonly RosterCast[] | undefined): {
  entries: readonly HeroDeckEntry[];
  live: boolean;
} {
  const live = (casts ?? [])
    .filter((cast) => Boolean(cast.imageUrl) && Boolean(cast.brief?.trim()))
    .slice(0, HERO_DECK_MAX)
    .map((cast) => ({
      key: cast.castId,
      /* Same fallback the roster grid uses: one word for one person. */
      name: cast.name ?? "Unnamed",
      meta: frameMeta(cast),
      brief: cast.brief!.trim(),
      imageUrl: cast.imageUrl!,
      castId: cast.castId,
    }));
  return live.length > 0 ? { entries: live, live: true } : { entries: EXAMPLE_DECK, live: false };
}

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
