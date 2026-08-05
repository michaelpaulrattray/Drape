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
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { facetOfSubject, type Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/presentationState");

/** The facets worth naming, and the question each is read with. */
const PRESENTATION: ReadonlyArray<{ facet: Facet; id: string; ask: string }> = [
  {
    facet: facetOfSubject("hairWorn"),
    id: "hairWorn",
    ask: "How is the hair WORN — up, down, tied back, half up, or something else? "
      + "Two or three words. This is about arrangement, never about the cut or the colour.",
  },
];

const SYSTEM_PROMPT = [
  "You look at a photograph of a person and answer short factual questions about how they",
  "are presented in it — how things are arranged, not what they are made of.",
  "",
  "Answer in two to five words. No sentences, no judgement, no description of their face,",
  "their identity, the lighting or the background. If you genuinely cannot tell, say",
  '"unclear" rather than guessing.',
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
}): Promise<Partial<Record<Facet, string>>> {
  const engine = input.engine ?? interpreterEngine();
  if (!engine) return {};
  try {
    const reply = await engine.complete({
      system: SYSTEM_PROMPT,
      user: PRESENTATION.map((entry) => `${entry.id}: ${entry.ask}`).join("\n"),
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0,
      maxOutputTokens: 200,
      signal: input.signal,
    });
    const parsed = JSON.parse(
      reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""),
    );
    const captured: Partial<Record<Facet, string>> = {};
    for (const entry of PRESENTATION) {
      const value = parsed?.[entry.id];
      if (typeof value !== "string") continue;
      const cleaned = value.trim().toLowerCase();
      /* "Unclear" is an answer and it is not a fact. Pinning it would tell every
         later render that the hair is unclear, which is worse than silence. */
      if (!cleaned || cleaned.startsWith("unclear") || cleaned.length > 40) continue;
      captured[entry.facet] = cleaned;
    }
    return captured;
  } catch (error) {
    log.warn({ err: error }, "[presentationState] could not read the base — no pin");
    return {};
  }
}

/** The facets this module is allowed to pin — the net checks exactly these. */
export const PRESENTATION_FACETS: readonly Facet[] = PRESENTATION.map((entry) => entry.facet);
