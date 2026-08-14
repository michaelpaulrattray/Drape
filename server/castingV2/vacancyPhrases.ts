/**
 * WHAT A FACE LOOKS LIKE WITH THE THING GONE — one home, keyed by KIND
 * (V3 slice (b), fable-531 §1).
 *
 * # Why this moved out of the accessory table
 *
 * The sentence lived on `LANDMARK_OF_ACCESSORY`, the table that says where a
 * worn object sits. That made it an ACCESSORY property, and the consequence was
 * not a missing feature but a silent refusal: `facialHair` is a departable
 * subject with a slot, a question and a guard kind, and a beard in the original
 * photograph could not be removed **for want of a phrase whose home was
 * wrong** — `repaintAsks` refuses `uncatalogued` when a slot's kind has none.
 *
 * That is V1's own diagnosis one layer down. The four silent lists were fields
 * that decided by absence; this is a fifth nobody had counted, deciding by
 * PLACEMENT. So the vacancy sentence is now a property of a kind — any kind —
 * and the accessory table has no opinion about it.
 *
 * # The strings did not change in the move
 *
 * The three accessory phrases are byte-identical to what they were, and
 * `vacancyPin.test.ts` holds them to that against a golden captured before the
 * move. A refactor that rewrites a sentence in a paid prompt is a behaviour
 * change wearing a refactor's clothes; this one is a move.
 *
 * # What a phrase must be
 *
 * A STATE, never an instruction ("no earrings — both earlobes bare", never
 * "remove the earrings"), so it passes the assembler's declarative marker by
 * construction rather than by care. And it must name the SITE as well as the
 * absence — "no glasses" alone leaves a painter looking at a photograph of her
 * in glasses with nothing to look AT. Both are proved in the tests beside this,
 * over every entry, so a kind added later cannot skip them.
 */

export type VacancyPhrase = {
  /** The whole absence, said about the kind: what is gone and where it was. */
  says: string;
  /**
   * The same absence about ONE INSTANCE, for a kind worn in twos.
   *
   * `{side}` is filled from the SLOT's own instance, never from a caller's
   * opinion. It is a record of which lobe is empty and not a steering
   * instruction — the mirror bench of 2026-08-12 is why that distinction is
   * written down: told "no earring on her left ear", the painter clears the ear
   * in the image's RIGHT half whichever ear that is, six paints, both framings.
   * So a both-sides vacancy speaks with the PAIR phrase (the assembler collapses
   * it) and a one-sided one is not offered at all.
   */
  perInstance?: string;
};

/**
 * Keyed by the kind id — which is a slot's `guardKind`, and therefore the same
 * word for an accessory ("earring") and for anatomy ("facial hair"). One key
 * space, so a caller cannot look in the wrong table because there is no second
 * table to look in.
 */
export const VACANCY_BY_KIND: Readonly<Record<string, VacancyPhrase>> = {
  earring: {
    says: "no earrings — both earlobes bare, nothing hanging from either ear",
    perInstance: "no earring on her {side} ear — that earlobe bare, nothing hanging from it",
  },
  glasses: {
    says: "no glasses — her face uncovered, no frames, no lenses and no rim shadow on her cheeks or brows",
  },
  "nose stud": {
    says: "no nose jewellery — her nose and septum bare, with no piercing visible",
  },
  /*
    THE FIRST NON-ACCESSORY MEMBER, and the reason this file exists (V3(b)).

    A beard is not worn and cannot be taken off a table of worn things, but it
    departs exactly the way they do: the master is reference 1, so a face that
    HAD a beard grows it back on every later render unless the recipe says
    otherwise. Everything else `facialHair` needed already existed.

    Written like the others: a state, naming the site. "Clean-shaven" alone
    would tell a painter what to conclude rather than where to look, and the
    skin under a beard is the part a render gets wrong — it comes back shadowed,
    or textured, or a different colour from the cheek above it.
  */
  "facial hair": {
    says: "no beard, moustache or stubble — his jaw, chin and upper lip clean-shaven, "
      + "the skin there the same tone as the rest of his face with no shadow or stubble texture",
  },
};

/**
 * The phrase for a kind, or NOTHING — never an improvisation.
 *
 * A caller with no phrase must refuse. An absence sentence invented at a call
 * site is a paid render saying something untrue about her face, and it is the
 * free-floating parallel prose fable-195 ruled against.
 */
export function vacantPhraseFor(
  kind: string | null | undefined,
  instance?: "left" | "right" | null,
): string | null {
  if (!kind) return null;
  const entry = VACANCY_BY_KIND[kind];
  if (!entry) return null;
  if (instance && entry.perInstance) return entry.perInstance.replace("{side}", instance);
  return entry.says;
}

/** Every kind that can say it is gone — for the sweeps that must cover them all. */
export const VACANCY_KINDS: readonly string[] = Object.keys(VACANCY_BY_KIND);
