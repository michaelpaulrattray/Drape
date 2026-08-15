/**
 * WHAT THE BASE ALREADY LOOKS LIKE, NAMED (D-186).
 *
 * # The fourth symptom
 *
 * Three of the founder's four drift symptoms are facts the prompt states and
 * the render ignores — the verification net catches those. The fourth is
 * different: her hair is pinned up in the base photograph and came back worn
 * down, and **nothing anywhere ever said it was up**.
 *
 * Captions only describe facets an INSTRUCTION touched, so a presentation fact
 * the base established by itself has no name. The preservation tail asks for
 * "the hair worn the same way", which names no value — there is nothing for the
 * net to check and nothing for the model to reproduce except the photograph it
 * is already free to reinterpret.
 *
 * # Read once, at the start of the chain
 *
 * The base never changes — every variant is `edit(the original, …)` — so this
 * is one vision call for the life of a candidate, not one per render. What it
 * captures becomes a pin like any other realization: stated in the prompt as
 * already true, dropped the moment an instruction writes that facet, and
 * checkable by the net because it is a short categorical value rather than a
 * paragraph.
 *
 * # Deliberately small
 *
 * Only presentation — how the person is arranged for the photograph, which is
 * the class that drifts because nobody thinks to state it. Not the face: the
 * face is what the reference image is FOR, and re-describing it in words is how
 * a description quietly replaces the photograph (D-152).
 *
 * # And the value is CHOSEN, never written (D-238)
 *
 * It shipped taking free text, and free text is how run-12's pixie and run-13's
 * tight crop were both pinned *"loose"* — a word that means _not gathered_ to
 * this product and _not tightly curled_ to anyone reading the picture. The hair
 * never changed and the class scored 25% twice. See `hairArrangement.ts`: every
 * facet here now names a closed value-space, the vision pass picks from it, and
 * anything outside it is NO PIN rather than a fact the product cannot stand
 * behind.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import {
  arrangementGuidance,
  arrangementIdOf,
  arrangementWording,
  isConstrainedArrangement,
} from "./hairArrangement";
import { interpreterEngine } from "./interpreter";
import {
  captionWording,
  pinIdOf,
  type PinnedCaption,
  type RealizationCaptions,
} from "./realizationCaption";
import { facetOfSubject, type Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/presentationState");

/**
 * A facet's closed value-space, and the only three things this module needs
 * from one.
 *
 * `wordingFor` does the parse and the expansion in one step deliberately: the
 * stored pin IS the wording, so there is no moment where a chosen id and its
 * sentence exist apart and could be paired up wrongly.
 */
type Vocabulary = {
  /** The choices as the vision pass is shown them. */
  guidance: string;
  /** The one wording for a chosen answer, or null if it chose nothing valid. */
  wordingFor: (answer: string) => string | null;
  /** Whether an already-stored pin's WORDING is one this build stands behind. */
  owns: (pinned: string) => boolean;
  /** Whether a stored pin's ID is still offered — the structural test. */
  ownsId: (id: string) => boolean;
};

/** The facets worth naming, the question each is read with, and its answers. */
const PRESENTATION: ReadonlyArray<{
  facet: Facet;
  id: string;
  ask: string;
  vocabulary: Vocabulary;
}> = [
  {
    facet: facetOfSubject("hairWorn"),
    id: "hairWorn",
    ask: "How is the hair WORN? Choose the one id below that is true of this photograph. "
      + "This is about arrangement only — never about the cut, the texture or the colour.",
    vocabulary: {
      guidance: arrangementGuidance(),
      wordingFor: (answer) => {
        const id = arrangementIdOf(answer);
        return id ? arrangementWording(id) : null;
      },
      owns: isConstrainedArrangement,
      ownsId: (id) => arrangementIdOf(id) !== null,
    },
  },
];

const SYSTEM_PROMPT = [
  "You look at a photograph of a person and answer questions about how they are presented",
  "in it — how things are ARRANGED, not what they are made of.",
  "",
  "Each question is followed by the complete list of allowed answers. Choose the ONE that is",
  "true of this photograph and reply with its id, copied exactly as written.",
  "",
  'If none of them is true of this photograph, answer "other". If you genuinely cannot see',
  'well enough to tell, answer "unclear". Both of those are better than a near miss: your',
  "answer is stored as a fact about this person and repeated in every later picture of them,",
  "so a close-enough choice becomes a description that argues with the photograph forever.",
  "",
  "No sentences, no judgement, no description of their face, their identity, the lighting or",
  "the background.",
  "",
  'Reply with JSON: {"hairWorn": "..."} and nothing else.',
].join("\n");

/**
 * Read the base's presentation, once.
 *
 * Fails soft: no pin is the state this shipped in for a milestone, and a wrong
 * pin would argue with the picture in every render — the D-183 lesson, applied
 * before the mistake rather than after it.
 */
export async function capturePresentation(input: {
  bytes: Buffer;
  contentType: string;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<Partial<Record<Facet, PinnedCaption>>> {
  const engine = input.engine ?? interpreterEngine();
  if (!engine) return {};
  try {
    const reply = await engine.complete({
      about: "caption",
      system: SYSTEM_PROMPT,
      user: PRESENTATION
        .map((entry) => `${entry.id}: ${entry.ask}\n${entry.vocabulary.guidance}`)
        .join("\n\n"),
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0,
      maxOutputTokens: 200,
      signal: input.signal,
    });
    const parsed = JSON.parse(
      reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""),
    );
    const captured: Partial<Record<Facet, PinnedCaption>> = {};
    for (const entry of PRESENTATION) {
      const value = parsed?.[entry.id];
      if (typeof value !== "string") continue;
      /*
        ANYTHING THAT IS NOT A CHOICE IS NO PIN.

        "Unclear" and "other" arrive here, and so does a model that answers the
        question in its own words despite being handed a list. All three take
        the same road out, because they are the same thing: an answer this
        build cannot stand behind. Pinning it would hand every later render a
        fact — stated as ALREADY TRUE to the painter and checked by the net —
        that nobody can hold either of them to.
      */
      const wording = entry.vocabulary.wordingFor(value);
      if (!wording) continue;
      /* The id rides beside the wording, so nothing downstream has to guess
         from the prose which kind of caption this is. */
      captured[entry.facet] = { wording, pin: value.trim().toLowerCase() };
    }
    return captured;
  } catch (error) {
    log.warn({ err: error }, "[presentationState] could not read the base — no pin");
    return {};
  }
}

/** The facets this module is allowed to pin — the net checks exactly these. */
export const PRESENTATION_FACETS: readonly Facet[] = PRESENTATION.map((entry) => entry.facet);

/**
 * A PIN DIES WHEN THE THING IT DESCRIBES IS RE-MADE (D-187).
 *
 * The first live trial refused two renders because "change her hair to a blunt
 * bob" was measured against a pin reading "tied back, up". A bob is a short cut
 * — hair that was tied up in the base cannot still be tied up after it is cut
 * off — so the pin was demanding an arrangement the instruction had just made
 * impossible, and the render was refused for obeying.
 *
 * Superseding by the SAME facet is not enough. A presentation fact is about a
 * thing, and re-making the thing retires the fact.
 */
const INVALIDATED_BY: Partial<Record<Facet, readonly Facet[]>> = {
  [facetOfSubject("hairWorn")]: [facetOfSubject("hairCut")],
};

/** Presentation pins that a delta writing these facets has just made false. */
export function presentationInvalidatedBy(written: ReadonlySet<Facet>): Facet[] {
  return PRESENTATION_FACETS.filter((pinned) =>
    (INVALIDATED_BY[pinned] ?? []).some((facet) => written.has(facet)));
}

/**
 * A PIN FROM BEFORE THE VOCABULARY IS RETIRED, NEVER TRANSLATED (D-238).
 *
 * Every chain that has already been touched carries free text — *"worn natural,
 * loose"*, *"pulled back low"*, *"tied back, up"* — and those are exactly the
 * strings that produced the false misses. Mapping old words onto new values
 * would be guessing from a description what only the photograph knows, which is
 * D-173's swamp with a thesaurus attached: *"pulled back low"* is a ponytail or
 * a bun or neither, and the answer is in a picture we already have.
 *
 * So an unrecognised pin is DELETED, and the capture branch immediately below
 * finds the facet unpinned and re-reads it from the MASTER — the base, which
 * never changes, at no extra cost beyond the one text call that pin was always
 * worth. Lazily, on the chain's next touch; there is no sweep, because a chain
 * nobody touches never renders and so is never scored.
 */
export function unconstrainedPresentationPins(
  captions: RealizationCaptions,
  /**
   * THE FACETS THIS CHAIN HAS DELIVERED — and the delivery outranks the
   * dictionary (founder finding #4, fable-118 ruling (a)).
   *
   * The retirement above is right about a PIN and catastrophic about a
   * REALIZATION. A caption for a facet the chain itself paid to change
   * describes a frame the customer is looking at; retiring it re-reads the
   * base, which is the one image guaranteed not to contain the edit, and
   * states the pre-edit value to the painter as already true. That is not
   * drift — it is a countermand, and it cost the founder a render.
   *
   * So a delivered facet's caption is never retired, whatever it looks like.
   * Empty by default so a caller that has not thought about it gets the old,
   * narrower behaviour rather than a silent pass.
   */
  deliveredByChain: ReadonlySet<Facet> = new Set(),
): Facet[] {
  return PRESENTATION.flatMap((entry) => {
    const caption = captions[entry.facet];
    if (!caption) return [];
    if (deliveredByChain.has(entry.facet)) return [];
    const id = pinIdOf(caption);
    /*
      A pin says which id it was chosen from, so its retirement is a question
      about the VOCABULARY rather than about its prose: an id this build no
      longer offers is a pin it cannot stand behind.
    */
    if (id !== null) return entry.vocabulary.ownsId(id) ? [] : [entry.facet];
    /*
      No id: either a row written before pins carried one, or a realization
      caption for a facet this chain did NOT deliver — which cannot happen,
      because a realization is only ever written for a facet an instruction
      wrote. So this branch is the legacy one, and it keeps the old test.
    */
    return entry.vocabulary.owns(captionWording(caption)) ? [] : [entry.facet];
  });
}
