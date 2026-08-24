/**
 * `safeParseJsonObject`, driven — the ladder that decides what becomes a
 * cast's `technicalSchema`.
 *
 * ⚠ THIS FILE EXISTS BECAUSE TWO LIVE DEFECTS SAT UNDER A LABEL CLAIMING THEY
 * WERE COVERED. `geminiPhase2Migration.test.ts` carried a section header
 * reading *"SCHEMA UPDATER — unit tests for safeParseJsonObject behavior"*,
 * and under it exactly one arm: `it("module loads without errors")`, which
 * asserts that two exports are functions. Nothing anywhere had ever driven the
 * parser. It is not that nobody wrote the tests — **the file said someone
 * had**, and that is what kept anyone from looking.
 *
 * The parser is module-private, so these arms drive it through the real public
 * function. The seam is `geminiClient`: `safeResponseText` is imported from
 * there, so mocking that module lets the real `updateSchemaForIteration` run
 * the real parser on any reply text. No key, no call, no money.
 *
 * ⚠ AND THE FAIL-SAFE THESE ARMS PIN IS A DOCUMENTED PROMISE THAT WAS NOT
 * TRUE. This module's header states **DR-15: "Both functions fail safe —
 * return current schema unchanged on error."** Before 2026-08-25 a bare JSON
 * string, a bare number and an array each REPLACED the schema with itself,
 * because the only guard was `if (!parsed) throw` — a truthiness test on a
 * function named `…JsonObject`, which caught `null` by luck and nothing else.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let RESPONSE_TEXT = "";

vi.mock("./geminiClient", () => ({
  getAiClient: () => ({ models: { generateContent: async () => ({}) } }),
  SAFETY_SETTINGS: {},
  safeResponseText: () => RESPONSE_TEXT,
  withTimeout: (p: unknown) => p,
  extractMimeType: () => "image/png",
  extractBase64Data: () => "",
}));
vi.mock("./geminiQueue", () => ({ withTextQueue: (fn: () => unknown) => fn() }));

const CURRENT = { hair: "red", eyes: "green" };

async function schemaFrom(replyText: string) {
  RESPONSE_TEXT = replyText;
  const { updateSchemaForIteration } = await import("./geminiSchemaUpdater");
  return updateSchemaForIteration(CURRENT as never, "make her blonde");
}

describe("safeParseJsonObject — what survives the ladder", () => {
  beforeEach(() => {
    RESPONSE_TEXT = "";
  });

  // ── The population control. Without these, every arm below would pass
  //    against a parser that returned null unconditionally. ──────────────
  it("CONTROL — a clean object reply IS adopted", async () => {
    expect(await schemaFrom(`{"hair":"blonde","eyes":"green"}`)).toEqual({
      hair: "blonde",
      eyes: "green",
    });
  });

  it("CONTROL — a fenced object reply is adopted (step 2 of the ladder)", async () => {
    expect(await schemaFrom("```json\n{\"hair\":\"blonde\"}\n```")).toEqual({ hair: "blonde" });
  });

  it("CONTROL — an object after prose is adopted (step 3 of the ladder)", async () => {
    expect(await schemaFrom(`Sure! Here you go: {"hair":"blonde"}`)).toEqual({ hair: "blonde" });
  });

  // ── The three that used to sail through, and are the reason for the fix ──
  it("a bare JSON STRING does not become the schema", async () => {
    // Was: the schema became the string "blonde".
    expect(await schemaFrom(`"blonde"`)).toEqual(CURRENT);
  });

  it("a bare NUMBER does not become the schema", async () => {
    // Was: the schema became 42.
    expect(await schemaFrom(`42`)).toEqual(CURRENT);
  });

  it("an ARRAY of objects does not become the schema", async () => {
    // Was: the schema became [{…},{…}].
    expect(await schemaFrom(`[{"hair":"blonde"},{"hair":"black"}]`)).toEqual(CURRENT);
  });

  // ── The two that already failed safe, pinned so the fix cannot lose them ──
  it("literal null falls back — it always did, by luck rather than by design", async () => {
    expect(await schemaFrom(`null`)).toEqual(CURRENT);
  });

  it("prose with no JSON at all falls back", async () => {
    expect(await schemaFrom(`I cannot do that.`)).toEqual(CURRENT);
  });

  it("an empty reply falls back — the caller refuses it before the parser", async () => {
    expect(await schemaFrom(`   `)).toEqual(CURRENT);
  });

  /*
   * ⚠ A PROPERTY OF STEP 3, DOCUMENTED RATHER THAN DESIGNED, and pinned so
   * that changing it is a decision.
   *
   * Step 3 takes the span from the FIRST `{` to the LAST `}`. For a
   * single-element array that span is exactly the inner object, so `[{…}]`
   * recovers to that object — which is a sensible rescue. For a two-element
   * array the same span covers `{…},{…}`, which is not valid JSON, so it
   * fails safe (the arm above). **The two cases differ for a reason nobody
   * chose**, and that asymmetry is worth knowing about before anyone
   * "tidies" step 3.
   */
  it("⚠ a SINGLE-element array recovers to its object — step 3's brace-span, not a decision", async () => {
    expect(await schemaFrom(`[{"hair":"blonde"}]`)).toEqual({ hair: "blonde" });
  });
});
