/**
 * DOES THE PICTURE CONTAIN WHAT THE RECORD SAYS IT DOES? (D-185)
 *
 * # The asymmetry this closes
 *
 * A roll is judged before delivery. A refine shipped **sight-unseen** — the
 * only post-render check on this path was `detectRenderFault`, which looks for
 * damage (seams, duplication) and has nothing to say about whether the thing
 * the user asked for is actually there.
 *
 * The founder's own chain proved what that costs. `EYE COLOUR: pinker` was
 * present, verbatim, in three consecutive composed prompts; the renders went
 * pink irises → brown irises with pink eyeshadow → no pink at all. The record
 * was right every time and nobody ever looked at the picture.
 *
 * # Every named facet, not just the new one
 *
 * The check reads the WHOLE composed recipe, because the fact that went missing
 * had been written one step earlier and was merely being carried. A check
 * scoped to "what this edit changed" is a check that cannot see the defect it
 * exists for.
 *
 * # It fails OPEN on an outage, and that is deliberate
 *
 * Invariant 7 says a control refuses when a dependency is missing — and it
 * governs SECURITY controls, where allowing is a breach. Here a false negative
 * costs a wrong picture the user can undo for free; a refusal on an unreachable
 * reader destroys a render that is probably fine and hands back credits instead
 * of the face. D-114 inverted the same way for the same reason. So an outage
 * delivers, loudly.
 *
 * # And the reader is fallible, which is why retry comes before refusal
 *
 * The same reader misread pink-through-glasses irises as "deep brown" in D-183.
 * A verdict is therefore evidence, not proof: it buys a free re-render first,
 * and only a second failure spends the user's refusal. Repeated verify-failures
 * on a facet class whose renders look correct are a READER defect to surface,
 * not a render defect to refund — which is what the stored verdicts are for.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { facetHeading, type Facet } from "./refineFacets";

const log = createModuleLogger("castingV2/renderVerification");

/** One facet, what it was asked to be, and whether the picture agrees. */
export type FacetCheck = {
  facet: Facet;
  asked: string;
  verified: boolean;
  /** What the reader says it sees instead — only when it disagrees. */
  saw?: string;
  /**
   * Whether this fact is one the product may REFUSE over (D-187).
   *
   * A closed-vocabulary value has a shared meaning: "green" is a value this
   * program defines and the reader can be held to. A free-text value like
   * "seafoam green" is the user's own words, and asking a reader to adjudicate
   * whether greenish-hazel is *distinctly* seafoam is asking it to arbitrate a
   * shade name nobody has defined — six legitimate renders were refunded that
   * way on the net's first live outing.
   *
   * Both kinds are checked and both are recorded, because the record is the
   * instrument. Only the binding kind spends a refusal.
   */
  binding: boolean;
};

export type RenderVerdict = {
  ok: boolean;
  checks: FacetCheck[];
  /** True when the reader could not be reached at all — delivered, not refused. */
  unavailable?: boolean;
};

const SYSTEM_PROMPT = [
  "You check a photograph against a list of things that were asked for, one line each.",
  "",
  "For each item, answer whether that thing is VISIBLY TRUE in the photograph. You are not",
  "judging whether it looks good, whether it suits the person, or how well it was done —",
  "only whether it is there.",
  "",
  "Be strict about WHERE. Pink eyes means the irises are pink; pink eyeshadow on brown eyes",
  "is not pink eyes, it is a different thing in the same neighbourhood. Hair worn down is",
  "not hair worn up. An earring that is present but different from the one described is",
  "still present — describe the difference rather than failing it.",
  "",
  "Be generous about DEGREE. A relative ask like 'pinker' or 'lighter' is satisfied by a",
  "visible move in that direction; it does not have to be extreme.",
  "",
  "Be generous about SHADE NAMES too. Someone's own words for a colour — 'seafoam green',",
  "'the colour of rosé', 'dusty pink' — are satisfied by a colour plainly in that family.",
  "You are not judging whether it is the exact shade they imagined; you are judging whether",
  "the colour changed to the thing they named.",
  "",
  'Reply with JSON: {"results":[{"id":1,"present":true|false,"saw":"..."}]} and nothing',
  "else. Include `saw` only where present is false, under 90 characters.",
].join("\n");

/**
 * One vision pass over every named fact in the recipe.
 *
 * A single call rather than one per facet: the reader is looking at one
 * photograph, and asking it eight times costs eight times as much for a worse
 * answer — it cannot weigh "the pink is on the lids not the irises" without
 * seeing both questions at once.
 */
export async function verifyRender(input: {
  bytes: Buffer;
  contentType: string;
  /** `binding` false means checked and recorded, never refunded (D-187). */
  facts: ReadonlyArray<{ facet: Facet; asked: string; binding?: boolean }>;
  engine?: TextEngine;
  signal?: AbortSignal;
}): Promise<RenderVerdict> {
  if (input.facts.length === 0) return { ok: true, checks: [] };
  const engine = input.engine ?? interpreterEngine();
  if (!engine) {
    log.warn({}, "[renderVerification] no reader — delivering unverified");
    return { ok: true, checks: [], unavailable: true };
  }

  const lines = input.facts.map((fact, index) =>
    `${index + 1}. ${facetHeading(fact.facet)}: ${fact.asked}`);

  try {
    const reply = await engine.complete({
      system: SYSTEM_PROMPT,
      user: lines.join("\n"),
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0,
      maxOutputTokens: 700,
      signal: input.signal,
    });
    const parsed = JSON.parse(
      reply.text.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, ""),
    );
    const results = Array.isArray(parsed?.results) ? parsed.results : null;
    if (!results) {
      log.warn({ reply: reply.text.slice(0, 200) }, "[renderVerification] unreadable verdict — delivering");
      return { ok: true, checks: [], unavailable: true };
    }

    const checks: FacetCheck[] = input.facts.map((fact, index) => {
      const row = results.find((entry: { id?: unknown }) => Number(entry?.id) === index + 1);
      /* A fact the reader did not answer for is NOT counted as a failure — an
         omission is the reader's silence, and silence never spends a refusal. */
      const verified = row ? row.present === true : true;
      const saw = typeof row?.saw === "string" ? row.saw.trim().slice(0, 90) : undefined;
      return {
        facet: fact.facet,
        asked: fact.asked,
        verified,
        binding: fact.binding !== false,
        ...(verified ? {} : { saw }),
      };
    });
    /* Everything is recorded; only a BINDING failure spends the user's refusal. */
    return { ok: checks.every((check) => check.verified || !check.binding), checks };
  } catch (error) {
    log.warn({ err: error }, "[renderVerification] the reader could not be reached — delivering");
    return { ok: true, checks: [], unavailable: true };
  }
}

/** The facets that failed and are worth acting on. */
export function missingFacts(verdict: RenderVerdict): string[] {
  return verdict.checks.filter((check) => !check.verified && check.binding).map((check) => check.asked);
}

/** Failures the product will NOT refuse over — the reader-defect watch list. */
export function advisoryMisses(verdict: RenderVerdict): FacetCheck[] {
  return verdict.checks.filter((check) => !check.verified && !check.binding);
}
