import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { projectEvidenceCandidateForModerator } from "./casting/evidence/moderatorEvidenceProjection";

/**
 * The staff image boundary (CLAUDE.md, "Metadata only is a boundary, not a
 * convenience"; access-control law 8).
 *
 * Staff may see *that* a generation happened — kind, timestamp, credit cost,
 * status — for support, billing and abuse work. They may never receive the
 * creative content. Generated images sit at permanently public R2 URLs, so
 * handing one to a moderator hands it over for good.
 *
 * This was a known, documented, unfixed violation: the moderator generation
 * history and its CSV export returned `resultUrl` for any user's generations.
 * A source guard, because the leak is a field that is present or absent — no
 * behavioural test can see a column that should not exist.
 */
const serverRoot = __dirname;

function source(relative: string): string {
  return fs.readFileSync(path.join(serverRoot, relative), "utf8");
}

describe("staff image boundary", () => {
  it("never selects the result URL in the moderator generation history", () => {
    const queries = source("db/moderatorQueries.ts");
    const history = queries.slice(queries.indexOf("getDetailedGenerationHistory"));

    // Presence, not the URL. Selecting it and deleting it later would leave a
    // path a future edit could reopen — law 8 wants this by construction.
    expect(history).toContain("hasResult");
    expect(
      history,
      "moderatorQueries must not select generations.resultUrl — staff get presence, not the image",
    ).not.toMatch(/resultUrl:\s*generations\.resultUrl/);
  });

  it("exports presence rather than a URL in the CSV", () => {
    const exports = source("routes/moderatorExports.ts");
    expect(exports).toContain("Has Result");
    expect(exports).not.toContain("Result URL");
    expect(
      exports,
      "a CSV of permanent public image URLs is the boundary at its worst — it leaves the building",
    ).not.toMatch(/gen\.resultUrl/);
  });

  it("still sanitizes provider prose on failed evidence candidates", () => {
    const projected = projectEvidenceCandidateForModerator({
      type: "evidenceCandidate",
      status: "failed",
      errorMessage: "fal.ai queue rejected request 0f2a: NSFW classifier tripped",
      metadata: { candidateId: "c-1", attemptNumber: 2, billingRole: "charged_attempt", secret: "x" },
    });

    expect(projected.errorMessage).not.toContain("fal.ai");
    expect(projected.errorMessage).not.toContain("NSFW");
    expect(projected.metadata).toEqual({
      candidateId: "c-1",
      attemptNumber: 2,
      billingRole: "charged_attempt",
    });
  });

  it("leaves non-evidence rows alone apart from the boundary", () => {
    const row = {
      type: "castingImage",
      status: "completed",
      errorMessage: null,
      metadata: { operationId: "op-1" },
    };
    expect(projectEvidenceCandidateForModerator(row)).toEqual(row);
  });
});
