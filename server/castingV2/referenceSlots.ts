/**
 * THE LIBRARY'S KEYS — the panel's slots, never the ledger's.
 *
 * `facet@region` is the UNDO LEDGER's key and the library must not inherit it
 * (fable-173). The ledger's key answers *which instruction wrote these pixels*;
 * the library's answers *what is this a picture of*. They look alike and they
 * are not, and the production store shows what happens when the difference is
 * left implicit: `marks@face skin` and `makeup@face skin` produced byte-identical
 * crops under two names, and *"add nude lip gloss"* filed itself at
 * `makeup@face skin` on one render and `makeup@lips` on the next.
 *
 * A library key is a **feature slot**, in the stylist's ontology (working law 8):
 *
 *   skin · lips · hair · eye@left · eye@right · brow@left · brow@right
 *   earring@left · earring@right · glasses · tattoo@forearm …
 *
 * Makeup is worn STATE on those slots (fable-168), not a slot of its own — so
 * the collision the ledger has cannot be expressed here: the skin slot holds one
 * crop of her skin as it currently is.
 *
 * # Instances are stored; pairs are spoken
 *
 * **Stored as instances, spoken as pairs, split on divergence** (fable-167,
 * fable-162). One crop per instance — free by construction from the split-frame
 * bilateral reader, and the same mechanism that fixed D-238's laterality.
 *
 * **And divergence is DERIVED, never a flag maintained beside the instances**
 * (working law 4). A flag saying "these two match" is a second list, and a
 * second list drifts: the earrings would be made different by an edit, the flag
 * would stay true, and the panel would go on saying "her earrings" about two
 * things that no longer are.
 *
 * Divergence is derived from the **words**, not from the pixels. Two crops of
 * two ears are never byte-identical even when the earrings are a matched pair —
 * different light, different occlusion, different hair. A pixel comparison would
 * report every pair as diverged, which is the flattering-to-the-machine answer
 * and the wrong one for the stylist.
 */

/** The instances the product knows. A key's suffix is one of these or nothing. */
export const INSTANCES = ["left", "right"] as const;
export type Instance = (typeof INSTANCES)[number];

/**
 * THE OPEN LANE'S PREFIX — and why it is `:` rather than `@`.
 *
 * An uncatalogued kind carries by synthesizing a slot key (fable-760 §2, shape
 * (a)), so that an open crop rides the ordinary library lifecycle instead of
 * needing a second carrier. The ruling left the spelling to the code, and the
 * code has an opinion: **`@` is not a separator in this grammar, it is the
 * INSTANCE separator**, and `parseSlot` checks its suffix against a two-member
 * closed list. `open@horns` therefore fails to parse outright, and the only way
 * to make it work would be to widen `INSTANCES` — at which point `earring@horns`
 * parses too, which is the closed grammar breached in exactly the place bound
 * (b) exists to protect.
 *
 * So the prefix rides a separator the slot grammar does not use, and is
 * recognised BEFORE `parseSlot` is ever reached. The two forms cannot be
 * confused because they cannot both parse — which makes the separation
 * structural rather than tested.
 */
export const OPEN_SLOT_PREFIX = "open:";

/**
 * Is this key in the open lane's namespace?
 *
 * String shape only — whether the noun after the prefix is one the open lane
 * would accept is the normalizer's question, and it is asked one layer along in
 * `openKindPolicy`. This answers the one thing every caller outside the
 * catalogue needs: *is this a key the closed catalogue was never meant to own*.
 */
export function isOpenSlot(key: string): boolean {
  return key.startsWith(OPEN_SLOT_PREFIX);
}

/**
 * The slot key an open kind carries under — spelled ONCE, here.
 *
 * Beside the predicate that recognises one, so the lane that mints a key and
 * the catalogue that resolves it cannot come to disagree about a prefix by one
 * of them being written out at a call site (working law 4). It does not
 * validate: whether `kind` is a key the open lane could have minted is
 * `isOpenKindKey`'s question, asked where the answer is acted on.
 */
export function openSlotKey(kind: string): string {
  return `${OPEN_SLOT_PREFIX}${kind}`;
}

/**
 * WHICH FRAME A SLOT'S QUESTION MAY BE ASKED OF.
 *
 * `ownSide` is not a hint. A bilateral slot asked of the WHOLE frame gets back
 * whichever instance the segmenter felt like naming — and worse, the reader
 * unions both sides into one mask, so `earring@left` and `earring@right` would
 * be cut from the same pixels, scored against the same union, and each read
 * "complete" while containing both of her earrings.
 *
 * It lives HERE rather than in the catalogue because the catalogue and the mint
 * both need it and the catalogue imports the mint's `SlotSpec` — one direction
 * of a dependency, not a cycle.
 */
export type SlotFrame = "wholeFrame" | "ownSide";

export type ParsedSlot = {
  /** The feature: `eye`, `earring`, `hair`. */
  feature: string;
  /** Absent for a feature that has one of itself. */
  instance?: Instance;
};

export function slotKey(feature: string, instance?: Instance): string {
  return instance === undefined ? feature : `${feature}@${instance}`;
}

/**
 * Parse a key, or refuse it.
 *
 * `null` for anything that is not a feature slot — which is how a ledger key
 * gets caught at the door rather than stored and puzzled over later. The
 * suffix vocabulary is CLOSED: `eye@left` parses, `makeup@face skin` does not,
 * and that one rule is the whole difference between the two key spaces.
 */
export function parseSlot(key: string): ParsedSlot | null {
  const trimmed = key.trim();
  if (trimmed === "" || trimmed !== key) return null;
  const at = trimmed.indexOf("@");
  if (at === -1) return trimmed.includes(" ") ? null : { feature: trimmed };
  const feature = trimmed.slice(0, at);
  const suffix = trimmed.slice(at + 1);
  if (feature === "" || feature.includes(" ")) return null;
  if (!INSTANCES.includes(suffix as Instance)) return null;
  return { feature, instance: suffix as Instance };
}

export function isFeatureSlot(key: string): boolean {
  return parseSlot(key) !== null;
}

/** The two halves of one bilateral feature, as the library stores them. */
export type InstancePair<T> = {
  feature: string;
  left: T;
  right: T;
};

/**
 * Is this pair still one thing, in the stylist's sense?
 *
 * Same words in the same order means the pair is matched and the panel speaks
 * about it as one row. Any difference at all splits it: a mismatched pair is a
 * FEATURE, in the founder's own words (fable-162), not a defect to reconcile.
 */
export function pairHasDiverged(pair: InstancePair<{ words: readonly string[] }>): boolean {
  const left = pair.left.words;
  const right = pair.right.words;
  if (left.length !== right.length) return true;
  return left.some((word, index) => word !== right[index]);
}

export type PairPresentation = {
  /** One row while matched, two after divergence. */
  rows: readonly { key: string; noun: string }[];
  diverged: boolean;
};

/**
 * How the pair is spoken about, derived from the instances every time.
 *
 * Re-merging falls out for free: make the instances match again and this
 * returns one row again, because there was never a flag to clear.
 */
export function presentPair(
  pair: InstancePair<{ words: readonly string[] }>,
  nouns: { paired: string; left: string; right: string },
): PairPresentation {
  if (!pairHasDiverged(pair)) {
    return { rows: [{ key: pair.feature, noun: nouns.paired }], diverged: false };
  }
  return {
    rows: [
      { key: slotKey(pair.feature, "left"), noun: nouns.left },
      { key: slotKey(pair.feature, "right"), noun: nouns.right },
    ],
    diverged: true,
  };
}
