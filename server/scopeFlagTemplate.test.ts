/**
 * THE TEMPLATE IS CHECKED AGAINST WHAT SHIPPED, not against what it says
 * (fable-486 §d).
 *
 * A generator is an instrument like any other, and its failure mode is quiet:
 * it drifts from the codebase and then produces a flag that looks right and
 * refuses nothing. So the control is the strongest one available — regenerate
 * an EXISTING flag from its own spec and compare with the file it came from.
 * `CASTING_FACE_SCAN_SCOPE` is the model, and if someone changes how scope
 * flags are written, this fails until the template follows.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  HAND_SITES,
  namesOf,
  rehearsalScript,
  scopeFlagBlock,
  type ScopeFlagSpec,
} from "../scripts/lib/scopeFlagTemplate.mts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const shipped = fs.readFileSync(
  path.join(repoRoot, "server", "castingV2", "castingV2Scope.ts"), "utf8");

/** The face scan, as it actually exists — the model this template was read off. */
const FACE_SCAN: ScopeFlagSpec = {
  env: "CASTING_FACE_SCAN_SCOPE",
  stem: "CastingFaceScan",
  parentEnvConst: "CASTING_REFERENCE_LIBRARY_SCOPE_ENV",
  parentParse: "parseCastingReferenceLibraryScope",
  parentEnabled: "captureCastingReferenceLibraryEnabled",
  parentField: "libraryScope",
  inertWithoutParent: "the scan fills a panel that does not render",
  /* The shipped flag's own binding names, so the comparison below needs no
     normaliser at all beyond whitespace. */
  local: "scan",
  parentLocal: "library",
};

/* Indentation is the formatter's business; nothing else is normalised, because
   a normaliser is one more instrument that can be wrong about the thing it is
   checking. */
const shape = (source: string) => source.replace(/\s+/g, " ").trim();

describe("the scope-flag template, against the flag it was read from", () => {
  /**
   * The shipped flag's own region, from its env const to the end of its
   * validator — with the docblocks stripped, because the reasons are what a
   * human writes and the generator deliberately does not.
   */
  function shippedFaceScanRegion(): string {
    const start = shipped.indexOf(`export const ${namesOf(FACE_SCAN).envConst} =`);
    const validate = shipped.indexOf(`export function ${namesOf(FACE_SCAN).validate}(`, start);
    /* To the next top-level export AFTER the validator — not to the first
       "\n}", which is the input type's own closing brace and truncated the
       region mid-signature. */
    const next = shipped.indexOf("\nexport ", validate);
    return shipped.slice(start, next === -1 ? shipped.length : next)
      .replace(/\/\*\*[\s\S]*?\*\//g, "");
  }

  it("regenerates the shipped face-scan flag, BOTH ways", () => {
    /*
      Equality, not containment. A one-directional check would pass a template
      that had quietly dropped a refusal — which is exactly what the sabotage
      run showed: removing the coverage clause left the generated block a subset
      of the shipped one, and only the refusal-by-refusal test noticed.
    */
    expect(shape(scopeFlagBlock(FACE_SCAN))).toBe(shape(shippedFaceScanRegion()));
  });

  it("carries all three refusals a child scope owes its parent", () => {
    const generated = scopeFlagBlock(FACE_SCAN);
    /* The parent off; the child wider than a limited parent; the child naming
       users the parent does not cover. Each one is a way a user pays for a
       surface that is not there. */
    expect(generated).toContain("cannot be enabled while");
    expect(generated).toContain('cannot be "all" while');
    expect(generated).toContain("names users outside");
    /* And the AND at the call site, which is the second place it goes wrong:
       a boot check that was never invoked. */
    expect(generated).toContain(`return ${FACE_SCAN.parentEnabled}(userId);`);
  });

  it("names every identifier the same way the shipped flag does", () => {
    const name = namesOf(FACE_SCAN);
    for (const identifier of Object.values(name)) expect(shipped).toContain(identifier);
  });

  it("CAN FAIL — a spec with the wrong parent does not match what shipped", () => {
    /* Without this the comparison above could be passing on fragments that
       appear in any flag. */
    /* Not `captureCastingV2Enabled` — that is a REAL parent, used by the flags
       whose parent is V2 itself, so asserting its absence would fail for the
       right reason and prove nothing about this one. */
    const wrong = scopeFlagBlock({ ...FACE_SCAN, parentEnabled: "captureNothingEnabled" });
    expect(shipped).not.toContain("return captureNothingEnabled(userId);");
    expect(wrong).toContain("return captureNothingEnabled(userId);");
  });
});

describe("the rehearsal it writes", () => {
  const script = rehearsalScript(FACE_SCAN, { parentValue: "users:1", ask: "users:1" });

  it("drives the boot validator itself — no server, no credits", () => {
    expect(script).toContain("validateCastingFaceScanEnvironment");
    expect(script).not.toMatch(/fetch\(|localhost/);
  });

  it("rehearses the REFUSALS, not just the ask", () => {
    /* 2026-07-31: the flag that crash-looped production had a guard nobody had
       driven with the shape about to be set. */
    for (const arm of ["absentBoots", "offBoots", "askBoots", "parentOffRefuses",
      "reachesPastParentRefuses", "wideRefuses", "malformedRefuses"]) {
      expect(script).toContain(arm);
    }
    /* And it exits non-zero, or a failed rehearsal is a line nobody reads. */
    expect(script).toContain("Do not flip anything.");
    expect(script).toContain("process.exit(1)");
  });
});

describe("the sites the generator cannot write", () => {
  it("names the boot fence, the rehearsal, and the founder's own step", () => {
    const where = HAND_SITES.map((site) => site.where);
    expect(where).toContain("server/_core/env.ts");
    expect(where.some((site) => site.includes("rehearse"))).toBe(true);
    /* Production is a founder step under the standing grant, and a checklist
       that let an executor read it as theirs would be worse than none. */
    expect(HAND_SITES.find((site) => site.where.startsWith("Railway"))?.what)
      .toContain("never an executor's");
  });
});
