/**
 * THE RECIPE ASSEMBLER — where D-244, the Edit Law, lives in code.
 *
 * The founder's ruling (2026-08-10, *"this isn't Photoshop"*): **words change,
 * crops carry.** Every edit REGENERATES its feature from that feature's ANCHOR
 * plus its FULL word stack; a feature's own carry crop NEVER rides in its own
 * edit; a feature nobody touched rides its minted crop, pixel-frozen; removal
 * is striking the words and regenerating from the anchor with what survives.
 *
 * This module turns a cast's reference library plus a set of asks into the
 * exact list of references and word stacks one render sends. It is the single
 * place those decisions are made, so there is no second list to drift from it
 * (working law 4).
 *
 * # It REFUSES rather than repairs
 *
 * Three refusals, and each is a `RecipeRefusal` the caller can act on rather
 * than an exception to be swallowed:
 *
 *  - **`carriesItsOwnEdit`** — D-244 line 2. A recipe that hands a feature its
 *    own crop while editing it is the contaminated mint, and the whole law
 *    exists to make it unreachable. Refused structurally, not avoided by
 *    convention.
 *  - **`slotTwiceReferenced`** — fable-174 (founder): one slot, one reference,
 *    per render. Two references claiming one feature are conflicting
 *    instructions, and the assembler makes them impossible to express.
 *  - **`emptyWordStack`** — the one thing D-244 leaves load-bearing. Line 2
 *    regenerates from the FULL stack, so a lost or empty delta is a silently
 *    forgotten edit; an ask that carries no words for a slot with no anchor
 *    would regenerate the feature from the master with nothing said about it,
 *    which is a quiet revert dressed as an edit.
 *
 * # The reference ORDINALS and the prompt sentences are derived together
 *
 * "Reference 2 is her lips" is only true if the lips crop is the second element
 * of the array actually sent. Those two have to be built in one pass or they
 * drift — the class this codebase keeps meeting. So the assembler emits both,
 * from one loop, and nothing downstream is permitted to reorder the references
 * without rebuilding the sentences.
 *
 * # The degenerate case is not an edge case
 *
 * A cast with no library and a words-only ask assembles to **the master alone,
 * plus words**. That is the road every NEW cast travels first (fable-171's
 * condition 1), and it falls out of the same code path rather than being
 * special-cased — a second path for the common case is how a fork hides
 * defects.
 *
 * Nothing calls this yet. It lands dark by having no call site, which is the
 * only kind of dark a pure function needs.
 */

/** A library key is a PANEL SLOT — the stylist's ontology, never `facet@region`
 *  (fable-173). Bilateral features are stored per instance and spoken as pairs
 *  (fable-167): `eye@left`, `earring@right`. */
export type FeatureSlot = string;

export type ReferenceImage = {
  /** Storage key or equivalent handle. The assembler never reads bytes. */
  key: string;
  /** For the record and for byte-identity proofs at the wire. */
  sha?: string;
};

export type ReferenceRole =
  | { kind: "master" }
  /** An introduced item's FROZEN INTRODUCTION REFERENCE (D-192/D-244 line 3):
   *  a tattoo's flash sheet, a makeup look's source image, a lip shape's source
   *  image. Pixel-stable forever; it is what the item's edits regenerate from. */
  | { kind: "anchor"; slot: FeatureSlot }
  /** The crop minted from the last delivery that touched this slot (line 4).
   *  Rides untouched renders byte-identical; never its own slot's edit. */
  | { kind: "carry"; slot: FeatureSlot };

export type LibraryEntry = {
  slot: FeatureSlot;
  /**
   * Present only for INTRODUCED features. Anatomy and surfaces have no anchor
   * entry: their anchor is the master, and the master is always reference 1.
   * Born-worn accessories (her own glasses) are in the master too, so they are
   * anatomy for this purpose (D-244 line 3).
   */
  anchor?: ReferenceImage;
  /** Minted from the frame that last delivered this slot. Absent until one has. */
  carry?: ReferenceImage;
  /** Every word ever accepted about this slot, oldest first. The full stack. */
  words: readonly string[];
  /** How the slot is spoken about in a reference sentence — the stylist's
   *  wording, not the engineer's key. */
  noun: string;
};

export type Ask = {
  slot: FeatureSlot;
  /** The DELTA — what this render adds. Empty only when `remove` is set. */
  words?: string;
  /**
   * Removal is not a rollback: it strikes matching words from the stack and
   * regenerates from the anchor with what survives (D-244 line 5). Each entry
   * must match a word already in the slot's stack.
   */
  remove?: readonly string[];
};

export type AssembleInput = {
  master: ReferenceImage;
  /** The cast's reference library. An empty library is the degenerate case. */
  library: readonly LibraryEntry[];
  asks: readonly Ask[];
};

export type RecipeReference = {
  role: ReferenceRole;
  image: ReferenceImage;
  /** The sentence naming this reference by its ordinal, or null for the master
   *  (whose sentence is the identity clause the caller owns). */
  sentence: string | null;
};

export type Recipe = {
  ok: true;
  /** In send order. Element 0 is always the master. */
  references: readonly RecipeReference[];
  /** The slots this render edits — the DELIVERED column of verification. */
  edited: readonly FeatureSlot[];
  /** The slots riding a minted crop — the CARRIED column. */
  carried: readonly FeatureSlot[];
  /** Per edited slot, the full word stack that regenerates it. */
  wordStacks: ReadonlyMap<FeatureSlot, readonly string[]>;
  /** The reference sentences, in ordinal order, ready to join with the ask. */
  sentences: readonly string[];
};

export type RecipeRefusal = {
  ok: false;
  reason: "carriesItsOwnEdit" | "slotTwiceReferenced" | "emptyWordStack" | "removeNotInStack";
  slot: FeatureSlot;
  detail: string;
};

export type AssembleResult = Recipe | RecipeRefusal;

/**
 * The word stack a slot regenerates from on THIS render.
 *
 * Removal strikes; a delta appends. Both leave one ordered list, and that list
 * is the whole instruction for the feature — the anchor supplies the pixels it
 * started from and nothing else does.
 */
function stackFor(entry: LibraryEntry | undefined, ask: Ask): readonly string[] | { missing: string } {
  const existing = entry?.words ?? [];
  let survived = [...existing];
  for (const strike of ask.remove ?? []) {
    const at = survived.indexOf(strike);
    if (at === -1) return { missing: strike };
    survived.splice(at, 1);
  }
  if (ask.words !== undefined && ask.words.trim() !== "") survived.push(ask.words.trim());
  return survived;
}

export function assembleRecipe(input: AssembleInput): AssembleResult {
  const bySlot = new Map(input.library.map((entry) => [entry.slot, entry]));
  const edited = input.asks.map((ask) => ask.slot);
  const editedSet = new Set(edited);

  const references: RecipeReference[] = [
    { role: { kind: "master" }, image: input.master, sentence: null },
  ];
  const wordStacks = new Map<FeatureSlot, readonly string[]>();
  const claimed = new Set<FeatureSlot>();
  const sentences: string[] = [];

  /** Ordinal in the sent array: the master is 1, so the next is length + 1. */
  const nextOrdinal = () => references.length + 1;

  /* ---- the EDITED slots: anchor + full word stack, never their own crop ---- */

  for (const ask of input.asks) {
    const entry = bySlot.get(ask.slot);
    const stack = stackFor(entry, ask);
    if ("missing" in stack) {
      return {
        ok: false, reason: "removeNotInStack", slot: ask.slot,
        detail: `"${stack.missing}" is not in ${ask.slot}'s word stack, so striking it would change nothing`,
      };
    }
    if (stack.length === 0 && !entry?.anchor) {
      /*
        Nothing to say and nothing introduced: regenerating from the master with
        an empty stack repaints the feature as she was born, which is a revert
        wearing an edit's clothes. The caller must mean a removal of the whole
        introduced thing, and that is a different ask.
      */
      return {
        ok: false, reason: "emptyWordStack", slot: ask.slot,
        detail: `${ask.slot} would regenerate from the master with nothing said about it`,
      };
    }
    wordStacks.set(ask.slot, stack);

    if (!entry?.anchor) continue; /* anatomy — the master is already reference 1 */
    if (claimed.has(ask.slot)) {
      return {
        ok: false, reason: "slotTwiceReferenced", slot: ask.slot,
        detail: `${ask.slot} was given two references in one render (fable-174)`,
      };
    }
    claimed.add(ask.slot);
    sentences.push(`Reference ${nextOrdinal()} is ${entry.noun}, exactly as it was introduced.`);
    references.push({
      role: { kind: "anchor", slot: ask.slot },
      image: entry.anchor,
      sentence: sentences[sentences.length - 1]!,
    });
  }

  /* ---- the CARRIED slots: the minted crop, pixel-frozen ---- */

  const carried: FeatureSlot[] = [];
  for (const entry of input.library) {
    if (!entry.carry) continue;
    if (editedSet.has(entry.slot)) {
      /*
        D-244 line 2, refused structurally. Reaching this branch means a caller
        built an edit that would hand a feature its own crop — the defect the
        law makes unreachable — so nothing is assembled and nothing is painted.
      */
      return {
        ok: false, reason: "carriesItsOwnEdit", slot: entry.slot,
        detail: `${entry.slot} is edited by this render and cannot also carry its own minted crop`,
      };
    }
    if (claimed.has(entry.slot)) {
      return {
        ok: false, reason: "slotTwiceReferenced", slot: entry.slot,
        detail: `${entry.slot} was given two references in one render (fable-174)`,
      };
    }
    claimed.add(entry.slot);
    sentences.push(`Reference ${nextOrdinal()} is ${entry.noun}, exactly as it is now — keep it exactly.`);
    references.push({
      role: { kind: "carry", slot: entry.slot },
      image: entry.carry,
      sentence: sentences[sentences.length - 1]!,
    });
    carried.push(entry.slot);
  }

  return { ok: true, references, edited, carried, wordStacks, sentences };
}
