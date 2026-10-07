/**
 * #1278 PART 1 — THE TWO ARMS THE HAND REVIEW ASKED FOR, driven rather than read.
 *
 * The change on this branch sends the cast's own brief into the signed-view
 * road: the generator's prompt and the conformance judge's expectation both
 * narrow on it, and the retry road reads the brief off her roll. The package
 * suite already proves the generator and `packageViewExpectation` agree; what
 * it could NOT see (sabotaged twice by the relay, 112 of 112 green each time)
 * was the JUDGE'S WIRE — a judge handed `null` for the description while the
 * generator dressed the view on the brief would refuse a view for wearing
 * exactly what the prompt asked for, and a refused slice is a refunded slice.
 *
 * And the retry road's read of her brief is a database statement with no test
 * database under it (69 of 69 green with the owner deleted from its WHERE), so
 * the owner clause is held at the source, with its own negative control.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CAST_VIEW_ANGLES } from "../../shared/boardTypes";
import type { TextEngine, TextRequest } from "../providers/types";
import { createViewConformanceJudge } from "./viewConformance";

/**
 * The close-up keeps its OWN wardrobe sentence on both roads (proven in the
 * package suite), so it is the one angle where described and undescribed are
 * the same sentence by design. The two arms that need the sentences to DIFFER
 * read every other angle.
 */
const DESCRIBED_ANGLES = CAST_VIEW_ANGLES.filter((angle) => angle !== "closeUp");

const anchor = { bytes: Buffer.from("anchor"), contentType: "image/png" };
const candidate = { bytes: Buffer.from("candidate"), contentType: "image/png" };

const verdictJson = JSON.stringify({
  identity: { verdict: "matches", note: "same person" },
  angle: { verdict: "matches", note: "as asked" },
  wardrobe: { verdict: "matches", note: "as the description names" },
});

/** His own brief on the Sifr cast, the one his eye was on (2026-09-26). */
const SIFR = "A pale, slightly androgynous cyberpunk woman with short, messy silver-grey hair and "
  + "heavy black makeup. She wears a white, body-conscious dress that mixes qipao structure with "
  + "industrial straps, buckles, and a worn graphic on the chest, leaving the exact cut, hardware, "
  + "and weathering open.";

/** A judge whose engine records the one request it is handed. */
function judgeThatRecords() {
  const seen: TextRequest[] = [];
  const engine: TextEngine = {
    id: "test-judge",
    complete: vi.fn(async (request: TextRequest) => {
      seen.push(request);
      return { text: verdictJson, latencyMs: 1, provenance: { provider: "openrouter" as const, model: "t" } };
    }),
  };
  return { judge: createViewConformanceJudge({ engine }), seen };
}

/**
 * ⚠ **THE JUDGE HALF OF THIS SUITE IS GONE — #1903, his ruling of 2026-10-07,
 * and this note is the sweep rather than a deletion done quietly.**
 *
 * Four arms stood here and all four proved the same thing: that the judge's
 * posted expectation narrows on the cast's brief, so that a judge handed
 * `null` while the generator dressed the view on the brief could not refuse a
 * view for wearing exactly what the prompt asked for.
 *
 * **There is no wardrobe axis any more, and the judge is posted no
 * specification at all** — so the defect those arms guarded has no road left,
 * and `packageViewExpectation`, the function every one of them read, no longer
 * exists. Keeping them green would have meant keeping the apparatus they test.
 *
 * What replaces them, so this is a move and not a loss:
 *
 *  - that the judge is handed **no outfit sentence and no plate ordinal**, with
 *    a control proving the same words DO reach the generator —
 *    `viewOutfitAuthority.test.ts`, driven at the wire;
 *  - that the judge is posted **no specification of any kind** —
 *    `viewConformance.test.ts`, two arms, system turn and user turn.
 *
 * ⚠ **The GENERATOR half of #1278 part 1 is untouched by his ruling** — the
 * prompt still narrows on her brief, and `wardrobeViews.test.ts` holds it.
 *
 * The retry road's owner clause below is unrelated to any of this and stands
 * exactly as it was.
 */

/* ------------------------------------------------------------------ the read */

const RETRY_SOURCE = resolve(__dirname, "../db/castingV2ViewRetry.ts");

/**
 * The one statement on the retry road that reads her brief: from `.from(castingRolls)`
 * to its `.limit(1)`. Refuses an empty slice rather than returning "" — the
 * first shape of a reader like this passed every `not.toContain` on nothing.
 */
function briefReadStatement(source: string): string {
  const start = source.indexOf(".from(castingRolls)");
  if (start < 0) throw new Error("the retry road no longer reads castingRolls — re-read the road before trusting this arm");
  const end = source.indexOf(".limit(1)", start);
  if (end < 0) throw new Error("the brief read has no .limit(1) after it — the statement's shape changed");
  const slice = source.slice(start, end);
  if (slice.trim().length === 0) throw new Error("empty slice");
  return slice;
}

describe("#1278 — her brief is read with the OWNER in the statement (invariant 1)", () => {
  const source = readFileSync(RETRY_SOURCE, "utf8");

  it("⚠ the roll's id and the owner sit in ONE where(and(...)) on the read", () => {
    const statement = briefReadStatement(source);
    expect(statement).toMatch(/\.where\(\s*and\(/);
    expect(statement).toContain("eq(castingRolls.id, model.sourceRollId)");
    expect(statement).toContain("eq(castingRolls.userId, userId)");
    /* Both inside the SAME and(...) — not the owner in a second statement. */
    const whereStart = statement.indexOf(".where(");
    const owner = statement.indexOf("eq(castingRolls.userId, userId)");
    const id = statement.indexOf("eq(castingRolls.id, model.sourceRollId)");
    expect(owner).toBeGreaterThan(whereStart);
    expect(id).toBeGreaterThan(whereStart);
  });

  it("⚠ NEGATIVE CONTROL — the same reader reddens on the statement with the owner deleted", () => {
    /* The sabotage the relay ran by hand (69 of 69 green), replayed against
       the reader itself so its verdict is worth something. */
    const doctored = source.replace(/\s*eq\(castingRolls\.userId, userId\),?/, "");
    expect(doctored).not.toBe(source);
    expect(briefReadStatement(doctored)).not.toContain("eq(castingRolls.userId, userId)");
  });

  it("the reader refuses an empty or absent statement rather than passing on nothing", () => {
    expect(() => briefReadStatement("nothing here")).toThrow(/no longer reads castingRolls/);
    expect(() => briefReadStatement(".from(castingRolls)")).toThrow(/limit\(1\)/);
  });
});
