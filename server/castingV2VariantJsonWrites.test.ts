import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * EVERY `JSON_SET` ONTO A VARIANT ROW CARRIES ITS OWNER AND ITS STATE (#55).
 *
 * # The class, not the instance (working law 7)
 *
 * `castingV2Variants.ts` writes single keys into `internalPrompt` with
 * `JSON_SET` rather than reading the row and writing it back, and its own
 * header says why: a read-then-write is two statements about a row a landing
 * may be moving underneath them. There were two such writers when this was
 * written — `recordVariantDispatch` (the sent recipe) and `recordVariantStep`
 * (the honest loader's stage) — and BOTH depend on exactly two predicates
 * sitting in the same statement as the write:
 *
 *   `userId`   invariant 1 — the owner is in the statement that does the work,
 *              never in a SELECT above it.
 *   `status`   the row has not landed. A `ready` variant's `internalPrompt` is
 *              its whole record — the prompt, the resolved identity, the
 *              captions, the verification — and a stray key written into one
 *              would be a delivered picture's provenance edited after the fact.
 *
 * Neither is enforced by a type, both are one deleted line away at all times,
 * and the second was added by a copy of the first — which is precisely when a
 * predicate goes missing without anything going red.
 *
 * # Why this reads the source
 *
 * The property is of the SQL, not of a decision above it, so a mock cannot see
 * it; the suites that drive real statements here are gated on
 * `TEST_DATABASE_URL` and skip in CI, which is exactly where a deleted `eq`
 * would sail through. A reader is the weaker instrument and it is the one that
 * runs on every push — so it is driven against a negative control below before
 * its verdicts count for anything (working law 2).
 */
const SOURCE = new URL("./db/castingV2Variants.ts", import.meta.url);

/** One exported async function's body, from its signature to its closing brace. */
function bodyOf(source: string, name: string): string {
  const at = source.indexOf(`export async function ${name}(`);
  if (at < 0) throw new Error(`${name} is not exported from castingV2Variants.ts`);
  const end = source.indexOf("\n}\n", at);
  if (end < 0) throw new Error(`${name}'s body could not be bounded`);
  return source.slice(at, end);
}

/**
 * THE CHECK. Returns the predicates a writer is MISSING, so an empty array is
 * the pass and the failure names what went.
 */
function missingPredicates(body: string): string[] {
  const missing: string[] = [];
  if (!/eq\(castingCandidateVariants\.userId,\s*input\.userId\)/.test(body)) missing.push("userId");
  if (!/inArray\(castingCandidateVariants\.status,\s*\["queued",\s*"dispatched"\]\)/.test(body)) {
    missing.push("status");
  }
  return missing;
}

describe("a json write onto a variant row is owner-scoped and cannot touch a landed one", () => {
  /*
    THE INSTRUMENT FIRST. A reader that cannot fail proves nothing, and this one
    is a regex over prose-heavy source — the single easiest kind to write in a
    shape that matches everything.
  */
  it("the reader names a predicate that is not there", () => {
    expect(missingPredicates("eq(castingCandidateVariants.userId, input.userId)"))
      .toEqual(["status"]);
    expect(missingPredicates('inArray(castingCandidateVariants.status, ["queued", "dispatched"])'))
      .toEqual(["userId"]);
    expect(missingPredicates("")).toEqual(["userId", "status"]);
  });

  /*
    AND THE POPULATION IS DERIVED, never listed: a THIRD json writer added later
    is held to the same two predicates without anybody remembering to add it
    here. The names are read out of the file, and an empty population refuses
    rather than passing — a reader that finds nothing looks exactly like a
    reader whose subject is all correct.
  */
  it("holds every json writer in the file, and there is at least one", async () => {
    const source = await readFile(SOURCE, "utf8");
    const writers = [...source.matchAll(/export async function (\w+)\(/g)]
      .map((match) => match[1])
      .filter((name) => bodyOf(source, name).includes("JSON_SET("));
    expect(writers.length, "no json writer found — the reader has lost its subject").toBeGreaterThan(0);
    expect(writers).toContain("recordVariantStep");
    for (const name of writers) {
      expect(missingPredicates(bodyOf(source, name)), `${name} is missing a predicate`).toEqual([]);
    }
  });
});
