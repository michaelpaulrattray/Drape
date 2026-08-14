/**
 * WHAT KIND OF MARK A SENTENCE NAMES — V3(b)'s second slot story
 * (fable-537 §2, granted as a DECLARED shortcut).
 *
 * # THIS IS SCAFFOLDING, AND THE REAL SOURCE IS ON THE BOARD
 *
 * One kind ships: **freckles**. Scars, birthmarks and moles are named here with
 * no phrase, so an ask about them refuses exactly as it does today. The per-kind
 * mark vocabulary — every kind with its own words, its own absence sentence and
 * its own court — is the real source, it is owed, and it is filed in V3's map
 * with an owner so this cannot quietly become the ceiling. Said in those words
 * because a lesser path taken silently is the violation; declared, it is
 * ordinary engineering.
 *
 * # Why marks need a KIND at all
 *
 * `marks` folds into the `skin` slot, and `skin` has no question and no guard
 * kind (its region is `face skin` for DISPLAY only). The vacancy lookup is keyed
 * by that guard kind, so for a mark it is keyed by `null` and can never find
 * anything — a freckle removal refuses `uncatalogued` for want of a key, not for
 * want of a capability.
 *
 * And the key may not be "skin". One slot holds freckles, scars, birthmarks and
 * moles the way `statedAccessories` holds earrings, glasses and a nose stud:
 * different absences of different sites, and a single "no marks on her skin"
 * sentence would be the coarse slot that D-142 split hair for.
 *
 * # The code owns the matching
 *
 * Longest match wins, over the user's own words, exactly as `accessoryKindOf`
 * does — three phrasing-list failures in one week made "the code owns the
 * vocabulary" a law rather than a preference, and a model asked "which kind of
 * mark is this" is a model given the composition key.
 */

export type MarkKind = {
  /** What people call it. Longest match wins. */
  readonly words: readonly string[];
  /**
   * The kind id — the key the vacancy phrase is looked up by, and never "skin".
   * A slot is where a fact is filed; a kind is what the fact IS.
   */
  readonly kind: string;
  /**
   * Whether this kind can say it is gone yet.
   *
   * `false` is a written answer rather than an omission: the kind is known, the
   * sentence is not bought, and the ask refuses with the same words it uses
   * today. It is here so the shortcut is visible in the table itself.
   */
  readonly canDepart: boolean;
};

export const MARK_KINDS: readonly MarkKind[] = [
  { words: ["freckle", "freckles", "freckling"], kind: "freckles", canDepart: true },
  /*
    KNOWN AND NOT YET SAYABLE. Each needs its own absence sentence (a scar's site
    is one place, a birthmark's is another) and its own court reading. Listed
    rather than omitted so the gap is in the table where the next person looks.
  */
  { words: ["scar", "scars", "scarring"], kind: "scar", canDepart: false },
  { words: ["birthmark", "birthmarks", "port wine stain"], kind: "birthmark", canDepart: false },
  { words: ["mole", "moles", "beauty spot", "beauty mark"], kind: "mole", canDepart: false },
];

/**
 * The kind a sentence names, or null.
 *
 * Longest match wins so *"beauty spot"* is a mole rather than nothing, and a
 * sentence naming none of them answers null — which the caller must treat as a
 * refusal rather than as a default. The accessory table's own defect is why:
 * a hardcoded fallback once harvested wherever her earrings were.
 */
export function markKindOf(words: string | null | undefined): string | null {
  if (!words) return null;
  const lowered = words.toLowerCase();
  let best: { kind: string; length: number } | null = null;
  for (const entry of MARK_KINDS) {
    for (const word of entry.words) {
      if (!lowered.includes(word)) continue;
      if (best === null || word.length > best.length) best = { kind: entry.kind, length: word.length };
    }
  }
  return best?.kind ?? null;
}

/** Whether this kind may say it is gone — the shortcut, readable. */
export function markCanDepart(kind: string | null | undefined): boolean {
  if (!kind) return false;
  return MARK_KINDS.find((entry) => entry.kind === kind)?.canDepart === true;
}
