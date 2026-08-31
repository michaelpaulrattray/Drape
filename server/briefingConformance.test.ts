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
 *   - red on a LIST PAST ITS CAP — e55's other half. ⚠ The cap it broke was
 *     the journal's, and #293 deleted the journal; the arm moved to
 *     `nextUp.items` (cap 40) rather than being deleted with it, because the
 *     thing being proven is that a cap refuses, and that population is now the
 *     live one — the founder-ordered queue is a list shifts append to and it
 *     has no other guard;
 *   - red on a briefing that still CARRIES a journal — the schema is
 *     `.strict()`, so an edition copied forward from before #293 is refused on
 *     the push path rather than served and never drawn;
 *   - red on bytes that are not JSON at all;
 *   - and the rite actually calls the judge (invariant 7 — the e55 hole was
 *     precisely a parse arm nothing invoked on the push path).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { judgeBriefingConformance } from "../scripts/lib/briefingConformance.mts";

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

  it("red on a list past its cap — e55's other half, moved to the queue #293 left standing", () => {
    const briefing = JSON.parse(realBriefing);
    const template = briefing.nextUp.items[0];
    expect(template, "the cap arm needs a real row to clone").toBeTruthy();
    /* Unique issue numbers, because the schema also refuses duplicates — an
       arm that reddens for the wrong reason prints PROVEN over nothing. */
    while (briefing.nextUp.items.length <= 40) {
      briefing.nextUp.items.push({ ...template, issueNumber: 900000 + briefing.nextUp.items.length });
    }
    const verdict = judgeBriefingConformance(JSON.stringify(briefing));
    expect(verdict.ok).toBe(false);
    expect(verdict.why, "the refusal must name the capped list, not fail for some other reason").toMatch(/nextUp\.items/);
  });

  it("red on an edition that still carries a journal — the field is gone, not ignored (#293)", () => {
    const briefing = JSON.parse(realBriefing);
    expect(briefing.journal, "the committed briefing must not carry one").toBeUndefined();
    briefing.journal = [{ at: "2026-08-27T09:55:00+10:00", shift: "foreman-43", text: "an entry copied forward" }];
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
