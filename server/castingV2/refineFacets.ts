/**
 * THE FACET — the unit a refinement supersedes (D-159).
 *
 * # Two lanes, one head of hair
 *
 * D-142 split hair into four subjects because "two things that can be true at
 * once need two slots". Read the other way it says something this program had
 * not yet acted on: **two things that CANNOT both be true must share one slot,
 * or last-writer-wins has nothing to arbitrate.**
 *
 * Refine has two lanes. `hairColour` is the guaranteed one, carrying engineered
 * prose and a closed vocabulary; `free.hairShade` is the open one, for colours
 * no enum has a word for. They are the same fact about the same head, and
 * composition was last-writer-wins per KEY — so "copper hair" (promotes into the
 * guaranteed lane) followed by "pastel pink hair" (does not promote, stays free)
 * left BOTH in the composed delta, and both reached the prompt:
 *
 *     Change the hair: coloured copper — <a paragraph of colourist prose>.
 *     HAIR COLOUR: pastel pink, rendered as natural hair…
 *
 * Two colours, one head, and the heavier prose won. The founder saw a render
 * that stayed copper while the chip said pink. That is the annihilation class
 * D-142 closed, rebuilt one level up — between the lanes rather than inside one.
 *
 * # So the facet is named, once, in code
 *
 * Every delta key — guaranteed or free — declares which facet it is about, and
 * composition supersedes by facet. A later free `hairShade` clears an earlier
 * guaranteed `hairColour` and vice versa, so a prompt with two answers to one
 * question becomes unrepresentable rather than merely detectable. That is
 * D-143's own standard, applied to the defect D-143 could not see: its
 * completeness check asks whether every filed fact REACHED the prompt, and both
 * of these did.
 *
 * # And captions are facts about facets, so they die with them
 *
 * A realization caption is the answer to "what did this facet actually look
 * like when it rendered". When an instruction rewrites the facet, the old answer
 * is not stale information — it is a wrong one, and it is stated to the image
 * model as ALREADY TRUE. Captions are therefore keyed by facet and dropped the
 * moment their facet is rewritten, which is the founder's own prescription.
 */
import type { RefinableAxis } from "./refineDelta";
import { bindsOnPresence, FREE_SUBJECTS, type FreeSubject } from "./refineSubjects";

/** A facet id. Opaque — its only job is to be stable and to compare equal. */
export type Facet = string;

/**
 * The guaranteed lane's facets.
 *
 * `Record<RefinableAxis, Facet>` rather than a loose object, so adding an axis
 * to `REFINABLE_AXES` without giving it a facet fails the build — the same
 * carve-out discipline `GuaranteedSubjectsAreExcluded` applies one file over.
 */
const AXIS_FACETS: Record<RefinableAxis, Facet> = {
  eyeColour: "eye.colour",
  eyeShape: "eye.shape",
  hairStyle: "hair.cut",
  hairColour: "hair.colour",
  hairTexture: "hair.texture",
  makeup: "makeup",
};

/**
 * The free subjects that SHARE a facet with a guaranteed axis — the collision
 * set, and the whole reason this module exists.
 *
 * Every other free subject is its own facet, so it needs no entry: a subject
 * nothing else can contradict is already the unit it supersedes on.
 */
const SHARED_FACETS: Partial<Record<FreeSubject, Facet>> = {
  eyeColourFree: "eye.colour",
  eyeShapeFree: "eye.shape",
  hairCut: "hair.cut",
  hairShade: "hair.colour",
  hairPattern: "hair.texture",
};

export function facetOfAxis(axis: RefinableAxis): Facet {
  return AXIS_FACETS[axis];
}

export function facetOfSubject(subject: FreeSubject): Facet {
  return SHARED_FACETS[subject] ?? subject;
}

/**
 * The heading a facet is spoken under.
 *
 * Shared facets borrow the guaranteed lane's heading; everything else is a free
 * subject id, so it borrows its own. The D-87 sweep looks for `HEADING: value`,
 * which is why this cannot be invented per call site.
 */
const SHARED_HEADINGS: Record<Facet, string> = {
  "eye.colour": FREE_SUBJECTS.eyeColourFree,
  "eye.shape": FREE_SUBJECTS.eyeShapeFree,
  "hair.cut": FREE_SUBJECTS.hairCut,
  "hair.colour": FREE_SUBJECTS.hairShade,
  "hair.texture": FREE_SUBJECTS.hairPattern,
  makeup: "MAKEUP",
};

/**
 * Every facet either lane can produce — the domain `facetHeading` must be total
 * over.
 *
 * Shared facets are dotted (`hair.colour`), unshared ones are just the free
 * subject id (`hairWorn`), and that asymmetry is a trap: a mistyped dotted id
 * falls through to `toUpperCase()` and puts `HAIR.WORN:` into a paid prompt
 * under a heading the D-87 sweep does not recognise. So the fallback exists for
 * type-safety and `facetTotality.test` proves it is unreachable.
 */
export function allFacets(): Facet[] {
  const facets = new Set<Facet>();
  for (const axis of Object.keys(AXIS_FACETS) as RefinableAxis[]) facets.add(AXIS_FACETS[axis]);
  for (const subject of Object.keys(FREE_SUBJECTS) as FreeSubject[]) {
    facets.add(facetOfSubject(subject));
  }
  return Array.from(facets);
}

export function facetHeading(facet: Facet): string {
  return SHARED_HEADINGS[facet]
    ?? FREE_SUBJECTS[facet as FreeSubject]
    ?? facet.toUpperCase();
}

/** Every delta key, guaranteed and free, that names a given facet. */
export function axesOfFacet(facet: Facet): RefinableAxis[] {
  return (Object.keys(AXIS_FACETS) as RefinableAxis[])
    .filter((axis) => AXIS_FACETS[axis] === facet);
}

export function subjectsOfFacet(facet: Facet): FreeSubject[] {
  return (Object.keys(FREE_SUBJECTS) as FreeSubject[])
    .filter((subject) => facetOfSubject(subject) === facet);
}

/**
 * Whether a MISS on this facet may spend the user's refusal — DERIVED from the
 * subject table, never listed again here (working law 4).
 *
 * A facet binds when a subject that writes it is presence-shaped. Shared facets
 * make that a real question rather than a rename: `hair.colour` is written by
 * `hairShade`, which is degree, so the guaranteed lane's colour axis does not
 * acquire teeth by sharing a facet id with a free subject.
 *
 * The old call site said `facet === facetOfSubject("statedAccessories")` — one
 * name, hard-coded, at the one place binding is decided. That is the mirror
 * this replaces: the classification lives with the vocabulary it classifies,
 * and adding a free subject without classifying it fails the build.
 */
export function facetBindsOnPresence(facet: Facet): boolean {
  return subjectsOfFacet(facet).some(bindsOnPresence);
}
