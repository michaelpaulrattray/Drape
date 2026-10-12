/**
 * THE CREATION RECORD'S BOUND — driven with callers that misbehave (#2311).
 *
 * Design §3's most important sentence: `masterPrompt`, `technicalSchema`,
 * `preferences`, the brief, a refine's words and the identity text never enter
 * a record. Working law 3 says a backstop needs a test the model cannot rescue
 * — here, a test no WELL-BEHAVED CALLER can rescue — so every arm below hands
 * the code the creative content on purpose and asserts it does not come out.
 *
 *   1. the BUILDER, handed a facts object stuffed with the whole recipe (the
 *      shape of a careless `{ ...modelRow }` at a call site), emits none of it;
 *   2. the BACKSTOP, handed a record that already carries a refused key at any
 *      depth, refuses — and passes the builder's own output (its control).
 */
import { describe, expect, it } from "vitest";

import {
  CREATION_RECORD_REFUSED_KEYS,
  CreationRecordBoundError,
  assertCreationRecordBound,
  buildCreationRecord,
  canonicalCreationRecordJson,
  makerDisplayName,
  type CreationRecordFacts,
} from "./creationRecord";

const SECRET = "SECRET-RECIPE-MARKER-2311";

const facts: CreationRecordFacts = {
  kliegId: "KI-AAAA-BBBB-CCCC-DDDD",
  accountId: 41,
  makerName: "Ada Maker",
  createdAt: new Date("2026-09-03T10:00:00Z"),
  mintedAt: new Date("2026-09-03T10:04:00Z"),
  masterSha256: "a".repeat(64),
  rolledAt: new Date("2026-09-03T09:40:00Z"),
  rollsInSession: 3,
  keptAt: new Date("2026-09-03T09:45:00Z"),
  refinements: {
    count: 2,
    firstAt: new Date("2026-09-03T09:50:00Z"),
    lastAt: new Date("2026-09-03T09:55:00Z"),
  },
  recordedAt: new Date("2026-10-14T08:00:00Z"),
};

/** Every key of a JSON value, at every depth. */
function allKeys(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => allKeys(item, into));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.push(key);
      allKeys(child, into);
    }
  }
  return into;
}

describe("the record says who, when, the fingerprint and the steps — as events", () => {
  it("builds the §3 document", () => {
    const record = buildCreationRecord(facts);
    expect(record).toEqual({
      recordVersion: "1",
      kliegId: "KI-AAAA-BBBB-CCCC-DDDD",
      maker: { accountId: 41, displayName: "Ada Maker" },
      createdAt: "2026-09-03T10:00:00.000Z",
      mintedAt: "2026-09-03T10:04:00.000Z",
      master: { sha256: "a".repeat(64) },
      steps: [
        { event: "rolled", at: "2026-09-03T09:40:00.000Z", rollsInSession: 3 },
        { event: "kept", at: "2026-09-03T09:45:00.000Z" },
        { event: "refined", count: 2, firstAt: "2026-09-03T09:50:00.000Z", lastAt: "2026-09-03T09:55:00.000Z" },
        { event: "signed", at: "2026-09-03T10:00:00.000Z" },
        { event: "minted", at: "2026-09-03T10:04:00.000Z" },
      ],
      recordedAt: "2026-10-14T08:00:00.000Z",
    });
  });

  it("leaves out a step that did not happen rather than inventing a date", () => {
    const record = buildCreationRecord({
      ...facts,
      rolledAt: null,
      rollsInSession: null,
      keptAt: null,
      refinements: { count: 0, firstAt: null, lastAt: null },
    });
    expect(record.steps.map((step) => step.event)).toEqual(["signed", "minted"]);
  });

  it("refuses a fingerprint that is not a SHA-256 digest", () => {
    expect(() => buildCreationRecord({ ...facts, masterSha256: "not-a-hash" })).toThrow(/SHA-256/);
  });
});

describe("⚠ THE BOUND — the builder, handed the whole recipe", () => {
  it("emits none of it, however the caller stuffs its input", () => {
    /* The careless call site: a whole `models` row and a whole roll spread into
       the facts. TypeScript would stop this; a cast at a call site would not. */
    const stuffed = {
      ...facts,
      masterPrompt: `${SECRET} prompt`,
      technicalSchema: { secret: SECRET },
      preferences: { secret: SECRET },
      identityText: `${SECRET} identity`,
      briefText: `${SECRET} brief`,
      editSentences: [`${SECRET} edit`],
      personality: `${SECRET} personality`,
      voice: `${SECRET} voice`,
      email: "someone@example.com",
    } as unknown as CreationRecordFacts;
    const record = buildCreationRecord(stuffed);
    const canonical = canonicalCreationRecordJson(record);
    expect(canonical).not.toContain(SECRET);
    expect(canonical).not.toContain("@example.com");
    const refused = new Set(CREATION_RECORD_REFUSED_KEYS.map((key) => key.toLowerCase()));
    expect(allKeys(record).filter((key) => refused.has(key.toLowerCase()))).toEqual([]);
    /* And the backstop agrees with the builder on its own output (its control). */
    expect(() => assertCreationRecordBound(record)).not.toThrow();
  });
});

describe("⚠ THE BOUND — the backstop, driven directly", () => {
  it("refuses each of the recipe's three fields at the top level", () => {
    for (const key of ["masterPrompt", "technicalSchema", "preferences"]) {
      expect(() => assertCreationRecordBound({ ...buildCreationRecord(facts), [key]: "x" }))
        .toThrow(CreationRecordBoundError);
    }
  });

  it("refuses a refused key NESTED inside a step, and in any case", () => {
    const record = buildCreationRecord(facts) as unknown as { steps: Array<Record<string, unknown>> };
    record.steps[2]!.Instructions = ["make the jaw sharper"];
    expect(() => assertCreationRecordBound(record)).toThrow(/steps\[2\]\.Instructions/);
  });

  it("refuses EVERY key on the refused list — the list is the population, not a sample", () => {
    for (const key of CREATION_RECORD_REFUSED_KEYS) {
      expect(() => assertCreationRecordBound({ maker: { [key]: null } }), key).toThrow(CreationRecordBoundError);
    }
    expect(CREATION_RECORD_REFUSED_KEYS).toEqual(
      expect.arrayContaining(["masterPrompt", "technicalSchema", "preferences"]),
    );
  });
});

describe("the canonical bytes", () => {
  it("are the same however the document's keys were ordered", () => {
    const record = buildCreationRecord(facts);
    const reversed = Object.fromEntries(Object.entries(record).reverse());
    expect(canonicalCreationRecordJson(reversed)).toBe(canonicalCreationRecordJson(record));
    expect(canonicalCreationRecordJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
});

describe("the maker's name is never an email", () => {
  it("signs the display name, and NO name when there is none — never another column", () => {
    expect(makerDisplayName("Ada")).toBe("Ada");
    expect(makerDisplayName("  Ada  ")).toBe("Ada");
    expect(makerDisplayName(null)).toBeNull();
    expect(makerDisplayName("   ")).toBeNull();
    expect(makerDisplayName("ada@example.com")).toBeNull();
  });
});
