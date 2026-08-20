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
 * THE SAME KIND, ONE SIDE OF IT — the distributed class's key, spelled here and
 * nowhere else (founder ruling fable-987 §1, shape ruled fable-1001 §1/§2).
 *
 * # Why a distributed kind is filed twice
 *
 * The locality class (fable-951) splits a kind three ways, and `distributed`
 * means the instances sit on OPPOSITE SIDES — wings, not fangs. One crop cannot
 * hold both of those honestly: the union's rectangle spans her whole torso and
 * would be filed as her wings, and the completeness guard cannot fail it, since
 * its own read finds ONE wing and any rectangle containing that wing scores
 * 1.0. A guard that passes the honest crop and the defective one equally is not
 * a guard. So a distributed kind files the earring architecture — one row per
 * side, each a picture of exactly what its name says.
 *
 * # The grammar composes; it is not concatenated
 *
 * `open:wings@left` is `slotKey(openSlotKey("wings"), "left")` — the open lane's
 * prefix and the closed grammar's instance suffix, in that order, and neither
 * spelling is written out at a call site. `parseSlot` already reads it without a
 * change: `open:wings` holds no space, so the feature half parses and the suffix
 * is checked against the same closed two-member list every other instance is.
 *
 * **This is a LIBRARY key, and the distinction is load-bearing** (fable-1001
 * §5): the sides are where the pixels are stored, never how the product speaks.
 * The panel says *her wings* and derives its boxes from the two rows, exactly as
 * one earring shows one box on the ear that wears it, and the scope door goes on
 * refusing an open key — a kind nobody has catalogued stays unscopable, which is
 * what the catalogue's `instance: null` note has always meant by *promotion buys
 * per-instance geometry*. What promotion buys is the SURFACE; this buys the
 * honest crop underneath it.
 */
export function openSideSlotKey(kind: string, side: Instance): string {
  return slotKey(openSlotKey(kind), side);
}

/**
 * EVERY KEY AN OPEN KIND MAY BE FILED UNDER — sideless, and its two sides.
 *
 * The one derivation for callers that answer *what could this kind's crops be
 * called* without knowing its locality. A delta says which kinds a chain
 * carries; it never says where their instances sit, because that lives in the
 * property store one read away. So a chain-side caller names all three and lets
 * the MINT — which has the locality in hand — decide which it ever files under.
 *
 * Generous in the direction this product has already chosen twice
 * (`prunedCarries`' own note): over-supporting keeps a crop that could have been
 * dropped, under-supporting takes a feature off a customer's face.
 */
export function openSlotKeysFor(kind: string): readonly string[] {
  return [openSlotKey(kind), ...INSTANCES.map((side) => openSideSlotKey(kind, side))];
}

/**
 * IS THIS KIND CARRIED BY CROPS THIS RENDER — one derivation, both localities.
 *
 * A sideless row carries a `single` or `coLocated` kind. A distributed kind is
 * carried only when BOTH sides are present: one wing in the library is the
 * half-picture the counting gate exists to refuse, and treating it as a carry
 * would take the other one off her — the words must still ride.
 *
 * It lives beside the grammar because it is the same question the grammar
 * answers, and a caller re-deriving it from a spelling is how the first open
 * crop was dropped one door after it was minted.
 */
export function openKindCarriedByCrops(kind: string, cropped: ReadonlySet<string>): boolean {
  if (cropped.has(openSlotKey(kind))) return true;
  return INSTANCES.every((side) => cropped.has(openSideSlotKey(kind, side)));
}

/**
 * THE KIND AND SIDE BEHIND A LIBRARY KEY — the parser half of the grammar.
 *
 * `null` for anything outside the open namespace. `side: null` is the sideless
 * key, which is a real answer and not a missing one: a `single` kind files
 * exactly there.
 */
export function openKindOfSlot(key: string): { kind: string; side: Instance | null } | null {
  if (!isOpenSlot(key)) return null;
  const rest = key.slice(OPEN_SLOT_PREFIX.length);
  const at = rest.indexOf("@");
  if (at === -1) return { kind: rest, side: null };
  const side = rest.slice(at + 1);
  if (!(INSTANCES as readonly string[]).includes(side)) return null;
  return { kind: rest.slice(0, at), side: side as Instance };
}

/* ------------------------------------------------------------------ *
 * THE INK NAMESPACE — a tattoo at a place, and it never sees the       *
 * library                                                              *
 * ------------------------------------------------------------------ */

/**
 * THE INK LANE'S PREFIX — spelled once, here, beside the open lane's.
 *
 * Same separator argument, arrived at for the same reason: `@` is the INSTANCE
 * separator and nothing else, so a second namespace rides `:` rather than
 * widening `INSTANCES` — at which point `earring@neck` parses too, and the
 * closed grammar is breached in the one place it exists to hold.
 *
 * # Why ink needs a namespace at all
 *
 * `ink` is not a feature of her the way `lips` is. It is a DESIGN at a PLACE,
 * and the facet card said so before anybody built it: *"ink is per placement
 * and its question comes from the placement rather than from a region table"*
 * (`facetCards.ts`, the `notASlot` reason). One `tattoo` slot would ask a
 * segmenter an open question, which is D-213's own caution written on the card.
 * So there is a slot per placement, and the placement is the token after this
 * prefix.
 *
 * # AND IT IS THE FENCE, NOT ONLY A SPELLING (ruled fable-1137 §3)
 *
 * Ink NEVER writes `casting_reference_library`. The design already has a
 * durable, digest-verified, purge-pathed home of its own
 * (`casting_ink_designs.storageKey`), and a library copy would be the second
 * list that drifts from a source of truth — with the drift being bytes of a
 * customer's design (working law 4). This prefix is what makes that refusable
 * at the database door rather than merely intended: `parseSlot` accepts
 * `ink:neck` the same way it accepts `open:wings`, so the door needs a reason
 * to tell them apart, and the reason is this string.
 */
export const INK_SLOT_PREFIX = "ink:";

/**
 * Is this key in the ink lane's namespace?
 *
 * String shape only, exactly like {@link isOpenSlot}: whether the token after
 * the prefix names a placement the vocabulary has measured is the catalogue's
 * question, asked one layer along where the answer is acted on.
 */
export function isInkSlot(key: string): boolean {
  return key.startsWith(INK_SLOT_PREFIX);
}

/**
 * The slot key a design at one placement carries under — spelled ONCE, here.
 *
 * Takes a string rather than an `InkPlacement` on purpose. The customer's own
 * word for a surface nobody has measured is a legal placement on this road
 * (fable-1078: a reference-tattoo ask is never refused on placement), so a
 * signature that only accepted the closed three would push every open caller
 * into spelling the prefix itself — which is the one thing this function
 * exists to prevent.
 */
export function inkSlotKey(placement: string): string {
  return `${INK_SLOT_PREFIX}${placement}`;
}

/**
 * The same placement, one side of her — the closed grammar's instance suffix on
 * the ink lane's prefix, composed rather than concatenated.
 *
 * `ink:upperArm@left` is `slotKey(inkSlotKey("upperArm"), "left")`, and neither
 * spelling is written out at a call site. It is per-side because the vocabulary
 * says so (`InkPlacementEntry.sides`) and because the side is this road's
 * measured failure: the legacy ink road refunded 300 credits twice for a design
 * on the wrong anatomical side (DECISION_LOG R7-7G).
 */
export function inkSideSlotKey(placement: string, side: Instance): string {
  return slotKey(inkSlotKey(placement), side);
}

/**
 * The placement and side behind an ink key — the parser half of the grammar.
 *
 * `null` for anything outside the namespace. `side: null` is a real answer and
 * not a missing one: a placement there is one of (`neck`, `upper chest`) files
 * exactly there.
 */
export function inkPlacementOfSlot(
  key: string,
): { placement: string; side: Instance | null } | null {
  if (!isInkSlot(key)) return null;
  const rest = key.slice(INK_SLOT_PREFIX.length);
  const at = rest.indexOf("@");
  if (at === -1) return { placement: rest, side: null };
  const side = rest.slice(at + 1);
  if (!(INSTANCES as readonly string[]).includes(side)) return null;
  return { placement: rest.slice(0, at), side: side as Instance };
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
