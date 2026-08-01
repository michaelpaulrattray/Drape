/**
 * The golden briefs — the sentences this product must never get wrong again.
 *
 * Every entry is a brief a founder actually typed, kept with what it must
 * produce. The list is the regression memory of the casting compiler: each one
 * is here because it failed once, in production, on a real roll.
 *
 * `category: true` means the sentence names an occupation, type or kind of
 * person, so `role` must come back non-null AND the echo must carry its
 * "cast as" clause. That pair is the assertion the founder added after a
 * high-fashion editorial brief came back as generic women — `role` is the only
 * field that produces the CASTING CATEGORY block, and gate B5's
 * category-owns-physique rule reads it.
 *
 * Shared by the offline suite (which checks the deterministic repair and the
 * echo) and the LIVE harness (`scripts/drive-golden-briefs.mts`, which checks
 * the interpreter itself). The live half exists because the last regression
 * hid behind stubs: every test drove a hand-written intent that already
 * contained what the bug removed.
 */

export type GoldenBrief = {
  brief: string;
  /** The sentence names a castable category, so `role` must survive. */
  category: boolean;
  /** Why it is on the list. */
  because: string;
};

export const GOLDEN_BRIEFS: readonly GoldenBrief[] = [
  {
    brief: "female mid 20's high-fashion editorial model",
    category: true,
    because:
      "Persisted role: null with archetype 'raw editorial' — the category was routed into the closed direction vocabulary and the user's words dropped. The sheet read as generic women.",
  },
  {
    brief: "An East Asian model with long pastel pink hair",
    category: true,
    because:
      "Echoed as a fragment opening on a comma, because no category reached the opener — the same missing clause, seen from the other end.",
  },
  {
    brief: "A beauty creator in her late 20s, bleached brows",
    category: true,
    because: "A brow statement must not read as a hair statement; the sheet twinned when it did.",
  },
  {
    brief: "runway model, early 20s, shaved head",
    category: true,
    because: "Coverage is all-or-nothing: eight shaved heads, and no authored cut anywhere.",
  },
  {
    brief: "A skincare founder in his 40s, silver at the temples",
    category: true,
    because: "The brief that exposed full-axis hair deference collapsing a sheet to one haircut.",
  },
  {
    brief: "a 30 year old heavy metal bogan",
    category: true,
    because:
      "The styling-tier brief. A named cut competes with a subcultural category and wins, so the sheet came back as eight tidy haircuts wearing the wrong casting. Bar: visibly subcultural AND at least four distinct silhouettes.",
  },
  {
    brief: "a redhead in her 30s",
    category: false,
    because:
      "A colour word is not an occupation. Kept as the counter-case so the category assertion cannot be satisfied by backfilling every null role.",
  },
  {
    brief: "a wiry cyclist in her 20s",
    category: true,
    because: "The lock validator's permanent fixture — 'her' must hold across all eight.",
  },
] as const;
