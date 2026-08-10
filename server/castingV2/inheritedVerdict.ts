/**
 * DO NOT ASK A READER TO RE-DECIDE WHAT ARITHMETIC HAS ALREADY SETTLED.
 *
 * # The defect this ends
 *
 * Run-6, step 4. She asked for gold hoop earrings, got them, and the render was
 * refused — because the net asked whether her hair was still *"tied back, low
 * ponytail"* and the reader said no. The hair had not moved: master against the
 * earrings render measures **0.00 mean |Δluma| in every hair block**. The same
 * head was described three ways across three renders and the third description
 * refused a correct picture and refunded a customer who had received exactly
 * what they paid for.
 *
 * No prompt fixes that. The reader is being asked a question it does not need
 * to answer: the composite's own guarantee is that every pixel outside
 * `applied` is BYTE-IDENTICAL to the master, so where a facet's region does not
 * meet `applied`, the picture at that facet *is* the master's picture. Its
 * verdict is not a new observation. It is the old one, and re-rolling a
 * stochastic reader against unchanged pixels can only ever add noise — noise
 * that costs money, because a binding miss refuses and refunds.
 *
 * # Why this is not a shortcut
 *
 * It spends NO extra vision calls and it invents no geometry. The regions come
 * from the ones the harvest already segmented for its own compositing work, and
 * the facet-to-region mapping is `regionNameOf` — the same table the compositor
 * asks. There is no second list here to drift from the first.
 *
 * # Everything it refuses to do
 *
 * - **A facet this edit WROTE is never inherited.** That is the thing being
 *   bought; it gets looked at, always.
 * - **No region, no inheritance.** A facet whose region the harvest never
 *   segmented — or whose segmentation failed — is read live. "We did not look"
 *   is not "it did not change", and collapsing those two is the measurement
 *   error this program keeps finding.
 * - **Any intersection at all sends it to a live read.** Not "mostly outside",
 *   not a tolerance: a single shared pixel means the composite was allowed to
 *   change something there, and a threshold picked to make inheritance fire
 *   more often would be a window drawn around the answer it expects.
 * - **An inherited verdict never manufactures a pass** (D-235). It carries the
 *   master's own check, and a master check with no `saw` behind it comes
 *   through as `read: false` — unread, exactly as it was. An affirmative
 *   without a `saw` is not a reading, and it does not become one by being
 *   copied. Do not tidy this into "inherit the boolean".
 */
import type { Facet } from "./refineFacets";
import { regionNameOf, type HarvestEvidence } from "./maskedRefine";
import type { Mask } from "./maskedComposite";
import type { FacetCheck } from "./renderVerification";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("castingV2/inheritedVerdict");

/**
 * The two fields of the harvest's evidence this module needs — NARROWED from
 * the shared shape rather than restated.
 *
 * `Pick` and not a copy, because the copy is what went wrong one module over:
 * `assembleWithCarriedSegments` re-listed the same two names and silently
 * dropped `deliveredRegions`, and the delivered-anchored cut was inert on every
 * render that carried a segment. A deliberate narrowing says *these two are all
 * I use*; a re-declaration says nothing at all and drifts on the day the shape
 * grows a third field.
 */
export type CompositeEvidence = Pick<HarvestEvidence, "applied" | "masterRegions">;

/**
 * Do these two masks share a single pixel?
 *
 * Stops at the first one. The question is "was the composite allowed to touch
 * this region at all", which is answered by existence, not by area — and an
 * area measure here would invite a threshold, which is how a guard acquires a
 * number nobody can defend.
 */
export function masksMeet(a: Mask, b: Mask): boolean {
  /* Differently sized masks cannot be compared index-wise, and resizing one to
     fit is the resample this pipeline promises never to do. Unknown, so: look
     again. */
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let index = 0; index < a.data.length; index += 1) {
    if (a.data[index] && b.data[index]) return true;
  }
  return false;
}

export type Fact = { facet: Facet; asked: string; binding?: boolean; shortfall?: string };

export type VerdictSplit = {
  /** Facts still to be put in front of the reader. */
  live: Fact[];
  /** Checks carried from the master, with no reading taken. */
  inherited: FacetCheck[];
};

/**
 * Split the facts into what must be looked at and what the master already
 * answered.
 *
 * Fails toward LOOKING on every uncertainty — no evidence, no region, no master
 * check, wrong-sized masks, any intersection. Inheritance has to earn each row;
 * a live read is the status quo and costs nothing but tokens.
 */
export function splitByInheritance(input: {
  facts: readonly Fact[];
  /** Null when this render was not composited — then nothing is inheritable. */
  evidence: CompositeEvidence | null;
  /** The master's own stored checks, by facet. */
  masterChecks: ReadonlyMap<Facet, FacetCheck>;
  /** Facets this edit wrote. Never inheritable: they are the ask. */
  written: ReadonlySet<Facet>;
  /** For the log line only. */
  operationId?: string;
}): VerdictSplit {
  const { facts, evidence, masterChecks, written } = input;
  if (!evidence) return { live: [...facts], inherited: [] };

  const live: Fact[] = [];
  const inherited: FacetCheck[] = [];

  for (const fact of facts) {
    const reason = ((): string | null => {
      if (written.has(fact.facet)) return "this edit wrote it";
      const region = regionNameOf(fact.facet);
      if (!region) return "no region for this facet";
      const master = evidence.masterRegions.get(region);
      if (!master) return `"${region}" was never segmented`;
      if (masksMeet(master, evidence.applied)) return `"${region}" meets what the composite changed`;
      return null;
    })();

    if (reason !== null) {
      live.push(fact);
      continue;
    }

    const carried = masterChecks.get(fact.facet);
    if (!carried) {
      /* The master has no opinion — a first refinement, or a facet it never
         checked. Nothing to inherit, so it is looked at. */
      live.push(fact);
      continue;
    }

    /*
      D-235'S ASYMMETRY, CARRIED RATHER THAN RESTATED.

      An affirmative with no `saw` behind it was never a reading, and copying it
      forward would launder an unread row into a passed one — on pixels this
      code has just proved nobody looked at twice. So the `saw` decides: with
      one, the master's verdict comes through as it stands; without one, the row
      arrives unread, which is what it always was.
    */
    inherited.push(
      carried.saw
        ? { ...carried, asked: fact.asked, binding: fact.binding ?? carried.binding }
        : {
          ...carried,
          asked: fact.asked,
          verified: false,
          read: false,
          binding: fact.binding ?? carried.binding,
        },
    );
  }

  if (inherited.length > 0) {
    log.info(
      {
        operationId: input.operationId,
        inherited: inherited.map((check) => `${check.facet}${check.saw ? "" : " (unread)"}`),
        live: live.map((fact) => fact.facet),
      },
      "[inheritedVerdict] facets outside what the composite changed kept the master's verdict",
    );
  }

  return { live, inherited };
}
