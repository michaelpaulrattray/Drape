/**
 * WHAT A REAL PERSON WOULD ASK FOR — the sweep's catalogue.
 *
 * Founder directive, 2026-08-07: *"make sure its walks cover literally as much
 * as it possibly can in terms of what a person might ask for in an edit — think
 * what would a stylist or director ask for… don't just think in terms of what's
 * coded, think in terms of what a real user would try."*
 *
 * That is working law 8 pointed at the test suite. The sweep was "one canonical
 * ask per routable class", which measures the vocabulary the code already
 * has — a catalogue written from `allFacets()` can only ever confirm that the
 * implemented things work. **Every sentence here is one a stylist would type**,
 * and where the product has no word for it, that is the finding rather than an
 * omission.
 *
 * # The three tiers, and why the middle one is not softer
 *
 * `deliver`  — Tier A. Paid, and it counts in the delivery denominator. The
 *              95%-per-class bar is sampled across a class's variants, so a
 *              class passes on its behaviour and not on its luckiest phrasing.
 * `question` — Tier B. Must ask, free, with answers. An already-true gate that
 *              spends is a failure here even though nothing looks broken.
 * `refuse`   — Tier B. Must refuse **by name**, free. `wall` is the wall it has
 *              to name; a refusal that cannot say which wall it hit is a
 *              refusal nobody can act on.
 * `honest`   — Tier C. Out of vocabulary. Deliver sensibly, ask, or refuse by
 *              name — any of the three is a pass. **A silent mangle or a
 *              charged no-op is a defect of the same rank as a Tier A miss**,
 *              which is the whole point of probing here.
 *
 * # Intensity pairs are run as pairs
 *
 * `intensity` marks the arms of a deliberate pair (light vs heavy). The faint
 * arm must deliver AND read as delivered — that is the founder's own catch,
 * and the reason the reader now judges strength against her own words. A pair
 * where only the loud arm passes is a class that cannot hear an adjective.
 *
 * # No silent caps
 *
 * Anything dropped from a run is logged with its reason. A coverage table that
 * quietly omits a category reads as "covered" when it is not, which is the
 * failure this whole campaign exists to stop.
 */

export type Tier = "A" | "B" | "C";

export type Ask = {
  /** The class the delivery-rate table cuts by. */
  category: string;
  /** Verbatim, as a person would type it into the box. */
  ask: string;
  tier: Tier;
  expect: "deliver" | "question" | "refuse" | "honest";
  /** The wall a refusal must name, so "it refused" is not enough. */
  wall?: string;
  /** Arms of a deliberate light-versus-heavy pair. */
  intensity?: "light" | "heavy";
  /** Why this is here, where it is not obvious. */
  note?: string;
};

export const CATALOGUE: readonly Ask[] = [
  /* ---- skin: surface and tone ---------------------------------------- */
  { category: "marks", ask: "give her light freckles across her nose and cheeks", tier: "A", expect: "deliver", intensity: "light" },
  { category: "marks", ask: "give her heavy freckles across her nose and cheeks", tier: "A", expect: "deliver", intensity: "heavy" },
  { category: "marks", ask: "give her a beauty mark above her lip", tier: "A", expect: "deliver" },
  { category: "marks", ask: "add a small mole on her cheek", tier: "A", expect: "deliver" },
  { category: "skinCharacter", ask: "give her clear even skin", tier: "A", expect: "deliver" },
  { category: "skinCharacter", ask: "dewy glowing skin", tier: "A", expect: "deliver" },
  { category: "skinCharacter", ask: "matte skin", tier: "A", expect: "deliver" },
  { category: "skinCharacter", ask: "visible skin texture with pores", tier: "A", expect: "deliver" },
  { category: "skinTone", ask: "give her a light tan", tier: "A", expect: "deliver", intensity: "light" },
  { category: "skinTone", ask: "give her a deep tan", tier: "A", expect: "deliver", intensity: "heavy" },
  { category: "skinTone", ask: "make her skin paler", tier: "A", expect: "deliver" },
  { category: "skinCharacter", ask: "flushed cheeks", tier: "A", expect: "deliver" },
  { category: "skinCharacter", ask: "a sun-kissed look", tier: "C", expect: "honest", note: "a mood word, not a facet — must route or ask" },
  { category: "age", ask: "fine lines around her eyes", tier: "C", expect: "honest", wall: "age", note: "age is a wall class; if it refuses it must say so by name" },

  /* ---- hair: colour --------------------------------------------------- */
  { category: "hair.colour", ask: "make her hair platinum blonde", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "honey blonde hair", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "auburn hair", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "jet black hair", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "chocolate brown hair", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "copper red hair", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "silver grey hair", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "pastel pink hair", tier: "A", expect: "deliver" },
  { category: "hair.colour", ask: "add blonde highlights", tier: "C", expect: "honest", note: "two-tone: one colour slot may not hold it" },
  { category: "hair.colour", ask: "balayage", tier: "C", expect: "honest" },
  { category: "hair.colour", ask: "ombre fading to lighter ends", tier: "C", expect: "honest" },
  { category: "hair.colour", ask: "darker roots", tier: "C", expect: "honest" },

  /* ---- hair: cut and length ------------------------------------------- */
  { category: "hair.cut", ask: "give her a blunt bob", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "long layers", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "a pixie cut", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "a buzz cut", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "shoulder-length hair", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "waist-length hair", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "give her curtain bangs", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "give her a blunt fringe", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "a side-swept fringe", tier: "A", expect: "deliver" },
  { category: "hair.cut", ask: "a shaved undercut", tier: "C", expect: "honest", note: "silhouette rules may apply — must refuse by name if so" },

  /* ---- hair: style and texture ---------------------------------------- */
  { category: "hair.texture", ask: "loose waves", tier: "A", expect: "deliver" },
  { category: "hair.texture", ask: "tight curls", tier: "A", expect: "deliver" },
  { category: "hair.texture", ask: "coily afro texture", tier: "A", expect: "deliver" },
  { category: "hair.texture", ask: "poker straight hair", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "slick her hair back", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "put her hair in a messy bun", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "a high ponytail", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "a low ponytail", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "braid her hair", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "space buns", tier: "C", expect: "honest" },
  { category: "hairWorn", ask: "half-up half-down", tier: "A", expect: "deliver" },
  { category: "hairFinish", ask: "wet-look hair", tier: "A", expect: "deliver" },
  { category: "hairFinish", ask: "give her big volume", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "tuck her hair behind her ears", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "a middle part", tier: "A", expect: "deliver" },
  { category: "hairWorn", ask: "a deep side part", tier: "A", expect: "deliver" },

  /* ---- makeup: lips ---------------------------------------------------- */
  { category: "makeup", ask: "classic red lipstick", tier: "A", expect: "deliver" },
  { category: "makeup", ask: "add nude lip gloss", tier: "A", expect: "deliver", note: "the founder's own walk step" },
  { category: "makeup", ask: "a dark berry lip", tier: "A", expect: "deliver" },
  { category: "makeup", ask: "a matte lip finish", tier: "A", expect: "deliver" },
  { category: "makeup", ask: "a glossy lip finish", tier: "A", expect: "deliver" },
  { category: "makeup", ask: "her lips but better, very subtle", tier: "A", expect: "deliver", intensity: "light" },
  { category: "makeup", ask: "overlined lips", tier: "C", expect: "honest" },

  /* ---- makeup: eyes and brows ------------------------------------------ */
  { category: "makeup", ask: "winged eyeliner", tier: "A", expect: "deliver" },
  { category: "makeup", ask: "a soft smudged smoky eye", tier: "A", expect: "deliver", intensity: "light" },
  { category: "makeup", ask: "a dark dramatic smoky eye", tier: "A", expect: "deliver", intensity: "heavy" },
  { category: "makeup", ask: "soft neutral eyeshadow", tier: "A", expect: "deliver" },
  { category: "makeup", ask: "dramatic editorial eyeshadow", tier: "A", expect: "deliver" },
  { category: "lashes", ask: "long lashes", tier: "A", expect: "deliver" },
  { category: "lashes", ask: "a false-lash look", tier: "A", expect: "deliver" },
  { category: "brows", ask: "thick straight brows", tier: "A", expect: "deliver" },
  { category: "brows", ask: "arched brows", tier: "A", expect: "deliver" },
  { category: "brows", ask: "feathered laminated brows", tier: "A", expect: "deliver" },
  { category: "brows", ask: "bleached brows", tier: "C", expect: "honest" },
  { category: "makeup", ask: "just light mascara, nothing else", tier: "A", expect: "deliver", intensity: "light" },

  /* ---- makeup: face ---------------------------------------------------- */
  { category: "makeup", ask: "soft blush", tier: "A", expect: "deliver", intensity: "light" },
  { category: "makeup", ask: "strong dramatic blush", tier: "A", expect: "deliver", intensity: "heavy" },
  { category: "makeup", ask: "strong contour", tier: "A", expect: "deliver" },
  { category: "makeup", ask: "a no-makeup makeup look", tier: "A", expect: "deliver", intensity: "light" },
  { category: "makeup", ask: "full glam", tier: "A", expect: "deliver", intensity: "heavy" },
  { category: "makeup", ask: "remove all her makeup", tier: "A", expect: "deliver" },

  /* ---- eyes ------------------------------------------------------------ */
  { category: "eye.colour", ask: "icy blue eyes", tier: "A", expect: "deliver" },
  { category: "eye.colour", ask: "deep brown eyes", tier: "A", expect: "deliver" },
  { category: "eye.colour", ask: "green eyes", tier: "A", expect: "deliver" },
  { category: "eye.colour", ask: "grey eyes", tier: "A", expect: "deliver" },
  {
    category: "eye.shape", ask: "fox eyes", tier: "B", expect: "question",
    note: "on an already-upswept face this must ask for free; on a measured-FLAT face it is Tier A and must deliver",
  },

  /* ---- jewellery and accessories --------------------------------------- */
  { category: "statedAccessories", ask: "small gold studs", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "gold hoop earrings", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "dangly drop earrings", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "chandelier earrings", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "pearl earrings", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "a silver ear cuff", tier: "C", expect: "honest" },
  { category: "statedAccessories", ask: "mismatched earrings", tier: "C", expect: "honest", note: "bilateral: two questions, deliberately different answers" },
  { category: "statedAccessories", ask: "a nose stud", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "a septum ring", tier: "C", expect: "honest" },
  { category: "statedAccessories", ask: "an eyebrow piercing", tier: "C", expect: "honest" },
  { category: "statedAccessories", ask: "a thin gold necklace", tier: "C", expect: "honest", wall: "the shoot", note: "may be garment territory — must name that wall if so" },
  { category: "statedAccessories", ask: "round wire-frame glasses", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "cat-eye glasses", tier: "A", expect: "deliver" },
  { category: "statedAccessories", ask: "sunglasses", tier: "A", expect: "deliver" },

  /* ---- facial hair (needs a male cast) --------------------------------- */
  { category: "facialHair", ask: "light stubble", tier: "A", expect: "deliver", intensity: "light" },
  { category: "facialHair", ask: "a full beard", tier: "A", expect: "deliver", intensity: "heavy" },
  { category: "facialHair", ask: "clean-shaven", tier: "A", expect: "deliver" },
  { category: "facialHair", ask: "a moustache", tier: "A", expect: "deliver" },
  { category: "facialHair", ask: "tidy up his beard line", tier: "C", expect: "honest" },

  /* ---- ink and marks ---------------------------------------------------- */
  { category: "ink", ask: "a small tattoo on her neck", tier: "B", expect: "refuse", wall: "ink needs a document", note: "ink's qualifier exemption is declared — verify behaviour matches the declaration" },
  { category: "ink", ask: "a small tattoo on her wrist", tier: "B", expect: "refuse", wall: "not a facial landmark" },
  { category: "marks", ask: "give her a birthmark on her temple", tier: "A", expect: "deliver" },

  /* ---- expression (full-frame route) ------------------------------------ */
  { category: "expression", ask: "a soft smile", tier: "A", expect: "deliver", intensity: "light" },
  { category: "expression", ask: "a broad genuine smile", tier: "A", expect: "deliver", intensity: "heavy" },
  { category: "expression", ask: "a serious editorial expression", tier: "A", expect: "deliver" },
  { category: "expression", ask: "make her laugh", tier: "A", expect: "deliver" },

  /* ---- removals: the reveal wall ---------------------------------------- */
  { category: "removal", ask: "remove her glasses", tier: "A", expect: "deliver", note: "the live defect — must pass post-fix" },
  { category: "removal", ask: "remove her earrings", tier: "A", expect: "deliver" },
  { category: "removal", ask: "remove her makeup", tier: "A", expect: "deliver" },
  { category: "removal", ask: "remove the beauty mark", tier: "A", expect: "deliver" },
  { category: "removal", ask: "shave off his beard", tier: "A", expect: "deliver" },
  { category: "removal", ask: "take her hair down", tier: "A", expect: "deliver", note: "inverse of the walk's hair-up; the shrink/reveal path" },

  /* ---- Tier C: honesty probes ------------------------------------------- */
  { category: "probe", ask: "make her look more editorial", tier: "C", expect: "honest" },
  { category: "probe", ask: "give her a 90s supermodel vibe", tier: "C", expect: "honest" },
  { category: "probe", ask: "make her look younger", tier: "C", expect: "refuse", wall: "age" },
  { category: "probe", ask: "make her look like a famous actress", tier: "C", expect: "refuse", wall: "likeness" },
  { category: "probe", ask: "make her thinner", tier: "C", expect: "refuse", wall: "body" },
  { category: "probe", ask: "change her into a redhead with freckles and green eyes", tier: "C", expect: "honest", note: "compound: three facets in one sentence" },
  { category: "probe", ask: "asdf her face", tier: "C", expect: "honest" },
  { category: "probe", ask: "change her top to a red one", tier: "C", expect: "refuse", wall: "the shoot" },
];

/** Everything in a tier, in catalogue order. */
export function tier(which: Tier): readonly Ask[] {
  return CATALOGUE.filter((entry) => entry.tier === which);
}

/** The classes Tier A will produce a delivery rate for. */
export function paidClasses(): string[] {
  return Array.from(new Set(tier("A").map((entry) => entry.category))).sort();
}

/** Both arms of every deliberate light-versus-heavy pair, by class. */
export function intensityPairs(): Array<{ category: string; light: Ask; heavy: Ask }> {
  const pairs: Array<{ category: string; light: Ask; heavy: Ask }> = [];
  for (const category of new Set(CATALOGUE.filter((e) => e.intensity).map((e) => e.category))) {
    const light = CATALOGUE.find((e) => e.category === category && e.intensity === "light");
    const heavy = CATALOGUE.find((e) => e.category === category && e.intensity === "heavy");
    if (light && heavy) pairs.push({ category, light, heavy });
  }
  return pairs;
}
