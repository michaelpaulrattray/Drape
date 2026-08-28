/**
 * WHAT THE PRODUCT SAYS WHEN A CONCEPT UPLOAD IS SENT BACK (#192).
 *
 * # Why this is a module and not an object literal in a route
 *
 * These five sentences lived inline inside `castingV2.concept.describe`'s
 * `spokenError` throw, and that route's own docblock declared the gap it left:
 *
 *   > *"this one is composed inline here and is not exported, so either could
 *   > be reworded later and nothing would go red."*
 *
 * Two things were bolted to that. First, the `no_being` sentence deliberately
 * uses the same three nouns as the roll road's `NOT_A_BEING_MESSAGE` so the two
 * doors tell one story about one boundary — a sameness a comment asserted and
 * no test kept. Second, and this is what actually forced the module: **the
 * capability atlas could not see three of this entrance's refusals at all**
 * (#192, measured — `grep -c "no_person" docs/architecture/capability-atlas.json`
 * → 0, while `conceptDescribe.ts`'s raise sites were attributed to the
 * INTERPRETER's identically-named `unreadable` door). The map's founder law is
 * that a capability change ships with its map entry; a door the map's
 * population cannot see is exempt from that law by accident.
 *
 * # The criterion this table makes structural
 *
 * **A refusal reason with a customer sentence is a DOOR.** That is the thing
 * the atlas can read without a hand-kept list of files: the table is
 * `Record<ConceptDescribeRefusal, string>`, so TypeScript refuses a new union
 * member that has no sentence, and the atlas sees the new key the same hour.
 * It is the shape `CANNOT_SAY_COPY` already has, consumed the same way
 * (`scripts/lib/capabilityAtlas.mts` imports the table and reads its keys — it
 * never greps for them).
 *
 * ⚠ **THE RESIDUE IS DECLARED RATHER THAN DISSOLVED.** Which tables count as
 * customer-facing refusal vocabularies is still a judgement a human makes and
 * writes down in the atlas — "customer-facing" is semantic and no regex knows
 * it. What this module removes is the weaker failure: a door invisible because
 * its refusal happened to be declared in a file the population's greps did not
 * visit. The other entrances that are still invisible for exactly that reason
 * are enumerated on #192 with a verdict each, and carded.
 *
 * # The voice
 *
 * Sentences are moved BYTE-IDENTICAL from the route (#192 is maintenance: zero
 * customer-visible change). They carry two founder rulings and must not drift
 * from them casually: #204 (a creature is a subject, so the refusal names what
 * the studio DOES cast) and #185 (*"a type, not a police report"* — which is
 * why `not_a_casting_note` is about OUR read and does not send her looking for
 * a better photograph).
 *
 * ⚠ **THIS MODULE IMPORTS NOTHING, AND THAT IS STRUCTURAL RATHER THAN TIDY**
 * (review of #207, finding 2). The capability atlas imports this table, and the
 * Atlas's charter is that it never runs app code. The first cut had the union
 * declared in `conceptDescribe.ts` and imported here — which reaches the
 * interpreter engine and the whole provider layer, and was safe ONLY because
 * `import type` is erased. A convention held that line. Reversed: **the table
 * IS the vocabulary**, the union is `keyof` it, and `conceptDescribe.ts` takes
 * the type from here. Now the generator cannot pull app code in even if someone
 * later drops the word `type` from an import.
 */

/**
 * EVERY REFUSAL IS A SENTENCE SHE CAN ACT ON, and they are different sentences
 * on purpose: "there is nobody in this picture" and "the reader did not answer"
 * ask her to do different things, and telling her the wrong one sends her
 * looking for a better photograph of a problem that was ours.
 *
 * Two of them ARE the same sentence, deliberately: `unreadable` and
 * `no_transport` differ only in whose fault it was, which is our fact and not
 * hers, and she is asked to do the identical thing by both.
 */
export const CONCEPT_DESCRIBE_COPY = {
  /*
     #204 — HIS OWN CARD, after a creature upload met "try one with someone in
     it." The sentence names what the studio DOES cast, on the same three nouns
     `NOT_A_BEING_MESSAGE` uses on the roll road (`briefCompiler.ts`), so the two
     doors tell one story about one boundary. That sameness is now held by an arm
     (`conceptDescribeCopy.test.ts`) rather than by this comment.
  */
  no_being:
    "I couldn't find anyone in that picture — this reads people and creatures, "
    + "not objects, vehicles or places. Try one with someone in it.",
  not_about_the_person:
    "I could only describe the picture, not the person in it. Try a clearer shot of them.",
  /* OURS, not her picture's — the read came back as an inventory twice
     (#185, his ruling: a type, not a police report). So the sentence
     does not send her looking for a better photograph. */
  not_a_casting_note:
    "That came back as a list of details rather than a casting note. Try again, or describe them in your own words.",
  unreadable: "I couldn't read that picture just now. Try again in a moment.",
  no_transport: "I couldn't read that picture just now. Try again in a moment.",
} as const satisfies Readonly<Record<string, string>>;

/**
 * Every refusal a customer of the concept entrance may be shown, named.
 *
 * DERIVED FROM THE TABLE rather than declared beside it: the sentence is what
 * makes a reason a door, so the table is the vocabulary and this is a reading
 * of it. A member cannot exist without copy because there is nowhere else to
 * put it.
 */
export type ConceptDescribeRefusal = keyof typeof CONCEPT_DESCRIBE_COPY;

/** The sentence for a refusal this entrance raised. */
export function conceptDescribeSentence(reason: ConceptDescribeRefusal): string {
  return CONCEPT_DESCRIBE_COPY[reason];
}
