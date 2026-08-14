/**
 * What must NOT change — composed per render, facet-aware (D-166).
 *
 * # The tail used to be boilerplate, and boilerplate argued with the edits
 *
 * Every render carried the same sentence: *"…the same person, the same bone
 * structure, the same skin, the same hair, the same expression…"*. So a prompt
 * that said "Change the hair: coloured pastel pink" also said "the same hair",
 * and the model sided with the tail. Measured on production rows before this
 * existed: **19 of the 25 most recent variants protected the hair while the
 * edits changed it.**
 *
 * That is D-142's disease with a new author — us. Every earlier instance was one
 * drawer overwriting another, and facet discipline in the instruction lane fixed
 * those. This one was the template contradicting the instruction, which no
 * amount of discipline in the instruction lane could ever reach.
 *
 * # So protection is subtraction
 *
 * The clause enumerates the protected categories MINUS the facets this render
 * edits. A hair-colour edit yields "the same haircut" and never "the same hair".
 * The contradiction becomes unrepresentable rather than unlikely — and the
 * caller asserts the intersection is empty anyway, because a table that anyone
 * can edit deserves a check that anyone can trip.
 *
 * # Subtract the COMPOSED delta, never the newest step
 *
 * This is the subtle half. If the tail subtracted only the step being added, a
 * facet edited three refinements ago would be protected as "identical to the
 * reference" — and the reference is the sharp ORIGINAL. That is revert-to-the-
 * original pressure applied to every earlier edit, once per render: the
 * mullet-shortening disease, rebuilt inside the machinery meant to cure it.
 */
import { allFacets, facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";

type Category = {
  /** Emitted when NOTHING in this category is being edited. */
  whole: string;
  /** Emitted per surviving member when the category is broken up. */
  siblings: Partial<Record<Facet, string>>;
};

import { FACET_CARD_ENTRIES, PRESERVATION_CATEGORIES } from "./facetCards";

const f = facetOfSubject;
void f;

/**
 * The categories, and every facet belongs to exactly one.
 *
 * Membership is written in terms of the facet table rather than as loose
 * strings, so a subject that gains a facet cannot quietly fall outside all of
 * them — `refinePreservation.test` proves the cover is total. A facet nobody
 * protects is a facet the model is free to redraw.
 */
export const CATEGORIES: Category[] = Object.entries(PRESERVATION_CATEGORIES)
  .map(([identifier, whole]) => ({
    whole,
    siblings: Object.fromEntries(
      FACET_CARD_ENTRIES
        .filter(([, card]) => card.preservation.category === identifier)
        .map(([facet, card]) => [facet, card.preservation.phrase]),
    ) as Partial<Record<Facet, string>>,
  }))
  /* A category nobody belongs to says nothing and should not be spoken. */
  .filter((category) => Object.keys(category.siblings).length > 0);

/**
 * Categories with no facet at all — never edited, so never subtracted.
 *
 * The shoot, and the person. Refine's whole boundary is that it changes the
 * PERSON and not the stage, so these can be stated flatly without ever
 * contradicting an instruction.
 */
const ALWAYS = [
  "the same person",
  "the same clothing",
  "the same lighting",
  "the same framing",
  "the same background",
];

export type Preservation = {
  /** The clause, ready to append. */
  clause: string;
  /** Which facets it actually protects — the caller asserts on this. */
  protectedFacets: Facet[];
};

/**
 * Everything that must survive this render, minus everything it changes.
 *
 * `edited` must be the facets of the COMPOSED delta, not of the newest step —
 * see the header. Passing one step's facets would protect every earlier edit
 * against the original and slowly undo the stack.
 */
export function composePreservation(edited: ReadonlySet<Facet>): Preservation {
  const parts: string[] = [...ALWAYS];
  const protectedFacets: Facet[] = [];

  for (const category of CATEGORIES) {
    const members = Object.keys(category.siblings) as Facet[];
    const surviving = members.filter((facet) => !edited.has(facet));
    if (surviving.length === members.length) {
      /* Nothing here is being touched, so the whole category holds. */
      parts.push(category.whole);
      protectedFacets.push(...members);
      continue;
    }
    /* Broken up: name the survivors so the category's untouched half is not
       quietly abandoned along with the half that changed. */
    for (const facet of surviving) {
      parts.push(category.siblings[facet]!);
      protectedFacets.push(facet);
    }
  }

  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
    : parts[0] ?? "";
  return {
    clause: `Everything else must be identical to the reference: ${list}. `
      + "This is a retouch of one photograph, not a new photograph of a similar person.",
    protectedFacets,
  };
}

/** Every facet the table knows how to protect — for the totality test. */
export function protectableFacets(): Facet[] {
  return CATEGORIES.flatMap((category) => Object.keys(category.siblings) as Facet[]);
}

/** Facets the table has forgotten — must always be empty. */
export function unprotectedFacets(): Facet[] {
  const covered = new Set(protectableFacets());
  return allFacets().filter((facet) => !covered.has(facet));
}
