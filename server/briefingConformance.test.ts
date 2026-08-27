/**
 * THE RITE'S BRIEFING PARSE CAN FAIL, ON THE REAL INCIDENT'S SHAPE (#169).
 *
 * Edition 55 (2026-08-27) shipped `status: "done"` on two pipeline rows and a
 * journal past its cap; the rite was green end to end and the founder's Crew
 * page served its degraded state for ~15 minutes. The repair is
 * `scripts/lib/briefingConformance.mts`, called by the deploy rite on the
 * briefing at the commit being pushed. These arms prove the judge against the
 * incident's own shapes (working law 2 — a guard that cannot fail is not a
 * guard, and the negative arms here are the incident, not inventions):
 *
 *   - green on the REAL committed briefing (the positive control — and this
 *     arm alone also reddens any PR that commits a broken briefing);
 *   - red on `status: "done"` — the e55 specimen, with the refusal NAMING the
 *     failing path (arm-asserts-its-own-reason: a refusal for some other
 *     reason must not print PROVEN over this one);
 *   - red on a journal past `CREW_JOURNAL_CAP` — e55's other half;
 *   - red on bytes that are not JSON at all;
 *   - and the rite actually calls the judge (invariant 7 — the e55 hole was
 *     precisely a parse arm nothing invoked on the push path).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { judgeBriefingConformance } from "../scripts/lib/briefingConformance.mts";
import { CREW_JOURNAL_CAP } from "./crew/crewBriefing";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realBriefing = readFileSync(path.join(repoRoot, "server/crew/crew-briefing.json"), "utf8");

describe("judgeBriefingConformance", () => {
  it("positive control: the REAL committed briefing parses", () => {
    const verdict = judgeBriefingConformance(realBriefing);
    expect(verdict.ok, `the live briefing must satisfy the page's own schema — ${verdict.why}`).toBe(true);
  });

  it("red on the e55 specimen — a pipeline status outside the enum — naming the failing path", () => {
    const briefing = JSON.parse(realBriefing);
    expect(briefing.pipeline.length).toBeGreaterThan(0);
    briefing.pipeline[0].status = "done";
    const verdict = judgeBriefingConformance(JSON.stringify(briefing));
    expect(verdict.ok).toBe(false);
    expect(verdict.why, "the refusal must point at the pipeline status, not fail for some other reason").toMatch(/pipeline\.0\.status/);
  });

  it("red on a journal past the cap — e55's other half", () => {
    const briefing = JSON.parse(realBriefing);
    const template = briefing.journal[0];
    while (briefing.journal.length <= CREW_JOURNAL_CAP) {
      briefing.journal.push({ ...template, text: `padding entry ${briefing.journal.length} for the cap arm` });
    }
    const verdict = judgeBriefingConformance(JSON.stringify(briefing));
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toMatch(/journal/);
  });

  it("red on bytes that are not JSON", () => {
    const verdict = judgeBriefingConformance("edition: 55\nnot json at all");
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toMatch(/not JSON/);
  });

  it("the deploy rite invokes the judge on its push path (invariant 7)", () => {
    const rite = readFileSync(path.join(repoRoot, "scripts/deploy-rite.mts"), "utf8");
    expect(rite).toContain('from "./lib/briefingConformance.mts"');
    expect(rite).toContain("judgeBriefingConformance(");
    // The refusal is real, not a log line: the red branch dies.
    expect(rite).toMatch(/conformance\.ok && !DRY[\s\S]{0,200}die\(/);
  });
});
