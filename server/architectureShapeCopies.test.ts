/**
 * THE COPY-CHECK, PROVED ON THE COPIES THAT ACTUALLY SHIPPED.
 *
 * One shape — `HarvestEvidence` (`applied`, `masterRegions`, `deliveredRegions`)
 * — was re-declared in three modules of one tree inside a fortnight, and the
 * live one cost a feature: `assembleWithCarriedSegments` re-listed two of the
 * three fields, so `deliveredRegions` was dropped on every render that carried a
 * segment. The delivered-anchored cut was inert for a week and the type system
 * agreed with the omission, because the local re-declaration WAS the type.
 *
 * A checker is worth nothing until it has been made to refuse (working law 2),
 * and its refusals are worth nothing if it cannot also say no. So both:
 *
 *   negative controls   the three specimens, quoted verbatim out of git history
 *                       (097d8d05^ and 91c36f70^) — every one must be caught
 *   positive controls   the same three as they are written TODAY (Pick, a
 *                       direct reference, a spread-through) — none may be
 *                       caught, or the fix would have failed review
 *   noise controls      the two shapes the first run over the real tree drowned
 *                       in — `{ width, height }` and `{ bytes, contentType }`
 *
 * The fixtures are an in-memory tree rather than the repository, so a specimen
 * cannot quietly stop being a specimen when somebody edits the real file.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

import { shapeCopyFindings } from "../scripts/generate-architecture.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The module every specimen is a copy OF, as it really reads. */
const HARVEST = `
import type { Mask } from "./maskedComposite";
export type HarvestEvidence = {
  applied: Mask;
  masterRegions: ReadonlyMap<string, Mask>;
  deliveredRegions?: ReadonlyMap<string, Mask>;
};
export type MaskedRefineResult = {
  bytes: Buffer;
  contentType: string;
  outcome: "composited" | "flag-off";
  guarantee?: { outsideIdentical: boolean };
  seam?: { torn: boolean };
  evidence?: HarvestEvidence;
  explain?: { zone: Mask };
};
`;

const COMPOSITE = `
export type Mask = { data: Buffer; width: number; height: number };
export type Raster = { data: Buffer; width: number; height: number };
`;

function findingsFor(files: Record<string, string>): string[] {
  const project = new Project({ useInMemoryFileSystem: true });
  const paths = Object.keys(files).map((name) => `server/castingV2/${name}`);
  for (const [name, text] of Object.entries(files)) {
    project.createSourceFile(path.join(repoRoot, "server/castingV2", name).replaceAll("\\", "/"), text);
  }
  return shapeCopyFindings(project, paths).map((finding) => finding.subject);
}

const withSources = (extra: Record<string, string>) => findingsFor({
  "maskedRefine.ts": HARVEST,
  "maskedComposite.ts": COMPOSITE,
  ...extra,
});

describe("the Atlas refuses a shape that was re-listed instead of narrowed from", () => {
  /**
   * `carriedSegments.ts` at 097d8d05^ — the live one. Two of the three fields,
   * so `deliveredRegions` was dropped on exactly the renders that carried a
   * segment, and nothing could see it.
   */
  it("catches the copy that shipped, and dropped a field on the way", () => {
    const caught = withSources({
      "carriedSegments.ts": `
import type { Mask } from "./maskedComposite";
import type { MaskedRefineResult } from "./maskedRefine";
export async function assembleWithCarriedSegments(input: {
  userId: number;
  harvested: {
    bytes: Buffer;
    contentType: string;
    evidence?: { applied: Mask; masterRegions: ReadonlyMap<string, Mask> } | null;
  };
}): Promise<MaskedRefineResult | null> { return null; }
`,
    });
    expect(caught).toContain("server/castingV2/carriedSegments.ts:9");
  });

  /** `segmentPersistence.ts` at 91c36f70^ — all three fields, inline. */
  it("catches a copy that was complete on the day it was written", () => {
    const caught = withSources({
      "segmentPersistence.ts": `
import type { Mask } from "./maskedComposite";
import type { HarvestEvidence } from "./maskedRefine";
export async function keepSegmentsFromRender(input: {
  userId: number;
  image: {
    bytes: Buffer;
    evidence?: {
      applied: Mask;
      masterRegions: ReadonlyMap<string, Mask>;
      deliveredRegions?: ReadonlyMap<string, Mask>;
    } | null;
  };
}): Promise<HarvestEvidence | null> { return null; }
`,
    });
    expect(caught).toContain("server/castingV2/segmentPersistence.ts:8");
  });

  /** `inheritedVerdict.ts` at 91c36f70^ — an exported local type, doc comments
   *  and all, which is the version that reads most like a deliberate design. */
  it("catches a copy that carried the original's own doc comments", () => {
    const caught = withSources({
      "inheritedVerdict.ts": `
import type { Mask } from "./maskedComposite";
import { regionNameOf } from "./maskedRefine";
export type CompositeEvidence = {
  /** Where the composite was allowed to differ from the master. */
  applied: Mask;
  /** Master regions by the segmentation question that produced them. */
  masterRegions: ReadonlyMap<string, Mask>;
};
export const named = regionNameOf;
`,
    });
    expect(caught).toContain("server/castingV2/inheritedVerdict.ts:4");
  });

  /**
   * AND IT CAN SAY NO — the same three, as they are written today.
   *
   * A checker that fires on the fix is worse than none: it teaches the reader to
   * ignore the kind. `Pick`, a direct reference and a spread-through are all
   * references, and none of them can lose a field.
   */
  it("passes every honest way of narrowing the same shape", () => {
    expect(withSources({
      "inheritedVerdict.ts": `
import type { HarvestEvidence } from "./maskedRefine";
export type CompositeEvidence = Pick<HarvestEvidence, "applied" | "masterRegions">;
`,
      "segmentPersistence.ts": `
import type { HarvestEvidence } from "./maskedRefine";
export async function keepSegmentsFromRender(input: {
  userId: number;
  image: { bytes: Buffer; evidence?: HarvestEvidence | null };
}): Promise<void> {}
`,
      "carriedSegments.ts": `
import type { HarvestEvidence, MaskedRefineResult } from "./maskedRefine";
export type Assembled = MaskedRefineResult & { carriedFacets: string[] };
export async function assemble(input: {
  harvested: { evidence?: HarvestEvidence };
}): Promise<HarvestEvidence | null> { return null; }
`,
    })).toEqual([]);
  });

  /**
   * THE NOISE FLOOR, which is the half a checker is usually shipped without.
   *
   * These two are the reason the rule is "most of a shape, and unambiguously
   * that shape" rather than "two fields". `{ width, height }` fits Mask AND
   * Raster; `{ bytes, contentType }` is two of `MaskedRefineResult`'s seven and
   * appears in five real modules. Neither is a copy of anything, and a report
   * that says they are is a report nobody finishes reading.
   */
  it("says nothing about the two shapes the first run drowned in", () => {
    expect(withSources({
      "segmentCuts.ts": `
import type { Mask, Raster } from "./maskedComposite";
export function sizeOf(frame: { width: number; height: number }): number { return frame.width; }
export function cut(input: { raster: Raster; mask: Mask }): number { return 0; }
`,
      "verificationDetail.ts": `
import type { MaskedRefineResult } from "./maskedRefine";
export async function detail(): Promise<{ bytes: Buffer; contentType: string } | null> { return null; }
export const of = (result: MaskedRefineResult) => result.bytes;
`,
    })).toEqual([]);
  });

  /**
   * And a module that does NOT import the original is not making a copy — it is
   * two people using the same ordinary words. The import is what says the author
   * had the real shape in hand.
   */
  it("says nothing about a module that never imported the shape", () => {
    expect(withSources({
      "elsewhere.ts": `
import type { Mask } from "./maskedComposite";
export type Local = {
  applied: Mask;
  masterRegions: ReadonlyMap<string, Mask>;
};
`,
    })).toEqual([]);
  });
});
