/**
 * WHAT THIS VERSION IS KEEPING, in the words she would use for it.
 *
 * The read side of the segments panel (fable-113, founder-cleared to build in
 * fable-122). It is deliberately a pure projection: rows in, rows out, no
 * database and no storage, so the panel's copy can be tested without a face.
 *
 * # The naming rule, and why it is not a table of nouns
 *
 * CLAUDE.md law 8 — this is a visual studio, not a maths class. A row must read
 * the way a stylist would say it, and the surest way to get a stylist's words is
 * to use HER OWN: the value the chain actually delivered for that facet, which
 * is the same string the painter was given and the reader was asked about.
 *
 * So this file invents almost nothing. What it decides is one thing, and it is a
 * distinction the product already thinks in — **is this thing part of her, or is
 * it something she is wearing?**
 *
 *     marks   "freckles"          →  Her freckles
 *     makeup  "nude lip gloss"    →  Nude lip gloss
 *     hairWorn "worn down"        →  Her hair, worn down
 *
 * Those three are the founder-verified mock's own rows, and they are exactly two
 * shapes plus hair's. Everything else follows from which side of the born/worn
 * line its facet sits on, so a new facet gets a name without anybody writing one.
 *
 * # What is NOT here
 *
 * - **A facet id as a fallback.** A row whose delivered value cannot be found is
 *   not shown at all. "statedAccessories" on a customer's screen is engineering
 *   leaking into a stylist's list, and a silent row is honest where an ugly one
 *   is not.
 * - **Version tags.** The founder's ruling, 2026-08-09: "ugly and not required".
 *   They return only if per-segment history ships something tappable.
 * - **`detected_born` rows.** They cannot exist yet — `bornWornCatalogue` has no
 *   callers (roadmap §0) — so the "she came with it" wording is defined here and
 *   deliberately unreachable rather than drawn as if it worked.
 */
import { FACET_CARD_ENTRIES } from "./facetCards";
import { allFacets, facetOfSubject } from "./refineFacets";
import { hasRegion } from "./zoneScope";
import { capitalize, type CastPronouns } from "./castPronouns";
import type { Facet } from "./refineFacets";

/** How a facet's delivered value becomes something she would say. */
type Naming =
  /** Part of her. "freckles" → "Her freckles". */
  | { shape: "hers" }
  /** Something she is wearing or has on. "nude lip gloss" → "Nude lip gloss". */
  | { shape: "worn" }
  /** Hair's arrangement is about the hair, not a thing. "Her hair, worn down". */
  | { shape: "hairArrangement" };

/**
 * WHICH SIDE OF THE BORN/WORN LINE EACH FACET SITS ON.
 *
 * Declared rather than derived from the facet id, for `REGION_OF_FACET`'s own
 * reason: these words reach a customer, and a rule that guesses would eventually
 * call her nose an accessory. The reverse-direction test below closes the gap so
 * a new facet cannot arrive unnamed.
 */
const NAMING_OF_FACET: Record<string, Naming> = Object.fromEntries(
  FACET_CARD_ENTRIES
    .filter(([, card]) => card.naming !== null)
    .map(([facet, card]) => [facet, card.naming as Naming]),
);

/** Facets named here — for the reverse-direction test. */
export function namingTableFacets(): string[] {
  return Object.keys(NAMING_OF_FACET).sort();
}

/**
 * Every facet that can actually BE a row, so a new one cannot arrive unnamed.
 *
 * Scoped by `hasRegion` rather than by `allFacets`, and the scoping is derived
 * from the cutter's own authority instead of restated: a segment is
 * `applied ∩ region`, so a facet with no region can never own pixels and can
 * never appear here. `expression` is the live case — an expression is the whole
 * face re-posing and routes full-frame by design (D-233), which is exactly why
 * it has nothing to keep. Writing it a customer-facing name would be inventing
 * copy for a row that cannot exist.
 */
export function facetsNeedingNames(): string[] {
  return allFacets().filter((facet) => hasRegion(facet)).sort();
}

const sentenceCase = (value: string): string => (
  value.length === 0 ? value : value[0].toUpperCase() + value.slice(1)
);

/**
 * A POSSESSIVE AND AN ARTICLE CANNOT BOTH INTRODUCE THE SAME NOUN.
 *
 * "Her a mullet" and "her a beauty mark" were both live in real data, because
 * the delivered value is sometimes a noun phrase that already introduces
 * itself — `hair.cut` reads "a mullet", `marks` reads "a beauty mark". The
 * possessive REPLACES the article; it does not queue behind it. That is
 * grammar rather than a cosmetic trim, which is why it happens here and not in
 * a display filter somewhere downstream.
 */
function withoutLeadingArticle(value: string): string {
  return value.replace(/^(?:a|an|the)\s+/i, "");
}

/**
 * The row's name, in the face's own words and the face's own pronoun.
 *
 * Returns null when the chain has no value for the facet — the caller drops the
 * row rather than showing an id.
 *
 * **The pronoun is passed in, never assumed.** The first version said "Her"
 * because the founder's mock was a woman; rendered against a real dev sheet it
 * called a male candidate's eyes "hers" in front of his own face. Law 8 in his
 * words: a stylist does not call a man's face hers. Same defect the room had
 * (see `castPronouns`), same fix, and `they` remains the honest fallback.
 */
export function nameForFacet(
  facet: string,
  delivered: string | null | undefined,
  pronouns: CastPronouns,
): string | null {
  const value = (delivered ?? "").trim();
  if (!value) return null;
  const naming = NAMING_OF_FACET[facet];
  /*
    An unnamed facet is dropped rather than guessed. The test below means this
    cannot happen for a facet the product knows about, so this is the honest
    behaviour for one it does not.
  */
  if (!naming) return null;
  const possessive = capitalize(pronouns.possessive);
  switch (naming.shape) {
    case "hers":
      return `${possessive} ${withoutLeadingArticle(value)}`;
    case "worn":
      return sentenceCase(value);
    case "hairArrangement":
      /*
        The arrangement vocabulary already reads as a phrase about the hair
        ("worn down", "gathered at the nape"), so the name is the hair plus what
        was done with it. A value that already starts with "worn" is not made to
        say it twice.
      */
      return `${possessive} hair, ${value}`;
  }
}

/** Provenance, in the plain language the design asks for. */
export type Provenance = "edit_patch" | "detected_born";
export function provenanceWording(provenance: Provenance, pronouns: CastPronouns): string {
  /* "they came with it" is already correct with a plural verb-less clause, so
     the only thing that varies is the subject. */
  return provenance === "detected_born" ? `${pronouns.subject} came with it` : "from an edit";
}

export type FaceRow = {
  /** For the client's key and for the prefill, never rendered as itself. */
  facet: string;
  publicId: string;
  name: string;
  from: string;
  /** The sentence tapping this row starts — nothing changes until she finishes it. */
  prefill: string;
  /** SAME-ORIGIN, and it has to be — see `maskFetchUrl`. */
  maskUrl: string;
  contentUrl: string;
};

/**
 * THE STENCIL IS FETCHED UNDER CORS AND THE CROP IS NOT, so they cannot come
 * from the same place.
 *
 * A CSS `mask-image` is a CORS-mode fetch; a `background-image` is not. The R2
 * public bucket sends no `Access-Control-Allow-Origin` — by default, in both
 * worlds — so a mask served straight off the bucket is BLOCKED, and an element
 * whose mask failed to load renders nothing at all. Not a degraded thumbnail:
 * an empty box, silently, with every stylesheet assertion still true.
 *
 * Found by looking at the running app (D-101) after twelve green tests and a
 * browser check that read the computed style and passed on a blank panel.
 *
 * The proxy is the product's own established answer to this exact sentence —
 * `client/src/features/boards/canvas/imageActions.ts` has said "R2 bucket URLs
 * are cross-origin and CORS-less" since boards was written. It is
 * authenticated, rate-limited, SSRF-allowlisted and privately cached, and a
 * mask is a few hundred bytes.
 *
 * Built HERE rather than in the client because the reason is a property of the
 * bytes, not of the surface: any future reader of a segment mask inherits the
 * same constraint, and a rule that lives in one component is a rule the second
 * component gets wrong.
 */
export function maskFetchUrl(publicUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(publicUrl)}`;
}

/**
 * The panel's rows, in the order the compositor pastes them.
 *
 * Order is not a presentation choice: `listLineageSegments` returns insertion
 * order because that is the user's own edit order, and a list that reordered
 * itself would stop matching the face.
 */
export function segmentsOnFace(input: {
  segments: ReadonlyArray<{
    publicId: string;
    facet: string;
    provenance: string;
    variantId: number | null;
    maskKey: string;
    contentKey: string;
  }>;
  /** What the chain delivered for this facet, from the variant that filed it. */
  deliveredValue: (segment: { facet: string; variantId: number | null }) => string | null;
  urlOf: (key: string) => string;
  /** This face's own three words — see `nameForFacet`. */
  pronouns: CastPronouns;
}): FaceRow[] {
  const rows: FaceRow[] = [];
  for (const segment of input.segments) {
    const name = nameForFacet(segment.facet, input.deliveredValue(segment), input.pronouns);
    if (!name) continue;
    rows.push({
      facet: segment.facet,
      publicId: segment.publicId,
      name,
      from: provenanceWording(segment.provenance as Provenance, input.pronouns),
      /* Lowercased, because it is the opening of THEIR sentence rather than a
         heading — "her freckles — " is what she would have typed. */
      prefill: `${name.charAt(0).toLowerCase()}${name.slice(1)} — `,
      maskUrl: maskFetchUrl(input.urlOf(segment.maskKey)),
      contentUrl: input.urlOf(segment.contentKey),
    });
  }
  return rows;
}

/** The one facet id this module is asked about by name, kept honest. */
export const ACCESSORY_FACET = facetOfSubject("statedAccessories");
export type { Facet };
