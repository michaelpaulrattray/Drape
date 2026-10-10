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

  it("keeps the repaint's own SENTENCE out of every staff surface", () => {
    /*
      fable-320 §4 condition 2. The repaint dispatch record now carries
      `prompt` — the composed recipe in sentence form, which is what the painter
      was told: every carried feature's words, the ask, and the identity clause.
      That is the cast's recipe in prose and belongs in the same sensitivity
      class as `masterPrompt`, not in the class of a timestamp.

      It lives inside `internalPrompt` on the variant row, which no staff
      projection reads today. This is the guard that says so by name, because
      "no staff surface selects it" is a fact about source rather than about
      behaviour — the same reason `resultUrl` is guarded here rather than by a
      request.
    */
    for (const file of ["db/moderatorQueries.ts", "routes/moderatorExports.ts"]) {
      const text = source(file);
      /* POSITIVE CONTROL, first: this really is the staff surface, read and
         non-empty. Without it a renamed file would pass every line below. */
      expect(text, `${file} is the staff surface this guard is about`).toContain("hasResult");
      expect(
        text,
        `${file} must not read internalPrompt — the repaint prompt is the cast's recipe in sentences`,
      ).not.toContain("internalPrompt");
      expect(text, `${file} must not read a repaint record`).not.toContain("repaint");
    }

    /* And the field really exists, so this is a guard on a live thing rather
       than a sentence about a phantom. */
    expect(
      source("castingV2/refineService.ts"),
      "the dispatch record is where the prompt is written",
    ).toContain("prompt: sent.prompt");
  });

  it("keeps the refusal loop's kept WORDS out of every staff surface (#129)", () => {
    /*
      A refused roll's sent prompts are kept for 30 days for the refusal
      patrol, and nobody else. They are the cast's recipe in sentences — the
      `masterPrompt` class — so no staff procedure may name the module, its
      key space or its reader. POSITIVE CONTROL first: the prefix really is
      the one the capture writes under, so a rename reddens this arm rather
      than passing it.
    */
    const capture = source("castingV2/refusalLoopCapture.ts");
    expect(capture).toContain('REFUSAL_LOOP_KEY_PREFIX = "casting-v2/refusal-loop"');

    /* DERIVED, both halves (review of PR #1007, finding 3): every moderator
       route and every admin route, so a reader added to a file this list did
       not name still reddens it. */
    const staffFiles = [
      "db/moderatorQueries.ts",
      ...fs.readdirSync(path.join(serverRoot, "routes"))
        .filter((name) => name.startsWith("moderator") && name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => `routes/${name}`),
      ...fs.readdirSync(path.join(serverRoot, "routes/admin"))
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => `routes/admin/${name}`),
    ];
    expect(staffFiles).toContain("routes/moderator.ts");
    expect(staffFiles).toContain("routes/moderatorExports.ts");
    expect(staffFiles.length).toBeGreaterThan(5);
    for (const file of staffFiles) {
      const text = source(file);
      for (const needle of ["refusalLoopCapture", "REFUSAL_LOOP_KEY_PREFIX", "refusal-loop"]) {
        expect(text, `${file} must not reach the refusal loop's kept words`).not.toContain(needle);
      }
    }
  });

  it("keeps the customer's own sentence behind each persona line out of every staff surface (#2197 / #2205)", () => {
    /*
      "Say it your way" stores the sentence the customer typed — their own
      words, verbatim — beside the line it produced. The `masterPrompt` class.
      Two ways it could reach staff, and both are refused here:

        1. a staff file NAMING the column (or the input field);
        2. a staff file reading a WHOLE `models` row — `.select().from(models)`
           — which would carry every column, these two included, with nothing
           on the staff surface naming them.

      DERIVED population, the refusal-loop arm's: every moderator route, every
      admin route, and the two staff query modules they lean on.
    */
    const staffFiles = [
      "db/moderatorQueries.ts",
      "db/admin.ts",
      ...fs.readdirSync(path.join(serverRoot, "routes"))
        .filter((name) => name.startsWith("moderator") && name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => `routes/${name}`),
      ...fs.readdirSync(path.join(serverRoot, "routes/admin"))
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => `routes/admin/${name}`),
    ];
    expect(staffFiles).toContain("routes/moderator.ts");
    expect(staffFiles.length).toBeGreaterThan(5);

    const wholeModelsRow = /\.select\(\)\s*\.from\(models\)/;
    /* POSITIVE CONTROLS, before the finding: the pattern really matches a
       whole-row read of `models` as this tree writes one (the owner's own
       resolve), and the columns really exist and really reach the OWNER's
       projection — so the absences below are about live things. */
    expect(source("db/castingV2Sign.ts")).toMatch(wholeModelsRow);
    const schema = fs.readFileSync(path.join(serverRoot, "../drizzle/schema.ts"), "utf8");
    expect(schema).toContain('personalityOwnWords: text("personalityOwnWords")');
    expect(schema).toContain('voiceOwnWords: text("voiceOwnWords")');
    expect(source("castingV2/castPersonaProjection.ts")).toContain("row.personalityOwnWords");

    for (const file of staffFiles) {
      const text = source(file);
      for (const needle of ["personalityOwnWords", "voiceOwnWords", "ownWords"]) {
        expect(text, `${file} must not read the customer's own sentence`).not.toContain(needle);
      }
      expect(text, `${file} must not read a whole models row — it would carry the customer's sentence`)
        .not.toMatch(wholeModelsRow);
    }
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
