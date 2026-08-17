/**
 * THE KIND-PROPERTY STORE'S TWO DOORS, driven directly.
 *
 * # Why this file needs a fake database rather than none
 *
 * With no database at all every one of these functions returns the same thing it
 * returns for a refused key — `null` from the read, `false` from the write. So a
 * suite that ran against a null pool would show a green key-guard that had never
 * fired: the two outcomes are indistinguishable at the return value, which is
 * the misaimed-guard shape this campaign has paid for twice.
 *
 * So the pool is a recording double, and the guard's arm asserts **that the
 * database was never reached** — the only observable that tells a refusal from an
 * absence. The positive control sits beside it: a legal key DOES reach the
 * database, so a double that silently answered nothing could not fake this file
 * green.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const selects: Array<{ where: unknown }> = [];
const inserts: Array<Record<string, unknown>> = [];
let rowToReturn: Record<string, unknown> | undefined;
let dbIsThere = true;
let readThrows = false;

vi.mock("./connection", () => ({
  getDb: async () => {
    if (!dbIsThere) return null;
    return {
      select: () => ({
        from: () => ({
          where: (clause: unknown) => ({
            limit: async () => {
              selects.push({ where: clause });
              if (readThrows) throw new Error("the pool is gone");
              return rowToReturn ? [rowToReturn] : [];
            },
          }),
        }),
      }),
      insert: () => ({
        values: (row: Record<string, unknown>) => ({
          onDuplicateKeyUpdate: async () => {
            inserts.push(row);
          },
        }),
      }),
    };
  },
}));

const { readOpenKindProperties, writeOpenKindProperties } = await import("./castingV2OpenKindProperties");

beforeEach(() => {
  selects.length = 0;
  inserts.length = 0;
  rowToReturn = undefined;
  dbIsThere = true;
  readThrows = false;
});

describe("the kind-property store", () => {
  it("reads a kind's two properties back", async () => {
    rowToReturn = { paired: true, extendsOutOfFrame: false, model: "m", promptVersion: "p1" };
    const read = await readOpenKindProperties("wings");
    expect(read).toEqual({ paired: true, extendsOutOfFrame: false, model: "m", promptVersion: "p1" });
    expect(selects).toHaveLength(1);
  });

  it("answers UNKNOWN — not `not paired` — when no row exists", async () => {
    /* The whole gate depends on this being null rather than a default: a kind
       nobody has answered for must not read as singular, or the mint files one
       wing under the name of two (fable-872 §2). */
    expect(await readOpenKindProperties("gills")).toBeNull();
    expect(selects).toHaveLength(1);
  });

  it("answers unknown when there is no database, and asks nothing", async () => {
    dbIsThere = false;
    expect(await readOpenKindProperties("gills")).toBeNull();
    expect(selects).toHaveLength(0);
  });

  it("answers unknown when the query throws", async () => {
    readThrows = true;
    expect(await readOpenKindProperties("gills")).toBeNull();
  });

  it("refuses a key that is not the normalizer's BEFORE touching the database", async () => {
    /* THE ARM THAT MAKES THE GUARD REAL. `null` alone proves nothing here — a
       missing pool returns `null` too. What separates them is that no statement
       was issued: a customer's sentence must not reach a varchar(64) even to be
       looked up. */
    expect(await readOpenKindProperties("give her enormous feathered wings")).toBeNull();
    expect(await readOpenKindProperties("Wings")).toBeNull();
    expect(await readOpenKindProperties("cat ears")).toBeNull();
    expect(await readOpenKindProperties("x".repeat(65))).toBeNull();
    expect(selects).toHaveLength(0);

    /* The positive control for that observable: a legal key DOES reach it. */
    expect(await readOpenKindProperties("cat-ears")).toBeNull();
    expect(selects).toHaveLength(1);
  });

  it("writes the two properties with the provenance of both", async () => {
    const wrote = await writeOpenKindProperties({
      kind: "wings",
      paired: true,
      extendsOutOfFrame: true,
      model: "anthropic/claude-sonnet-5",
      promptVersion: "kp-1",
    });
    expect(wrote).toBe(true);
    expect(inserts).toEqual([{
      kind: "wings",
      paired: true,
      extendsOutOfFrame: true,
      model: "anthropic/claude-sonnet-5",
      promptVersion: "kp-1",
    }]);
  });

  it("refuses to write a key that is not the normalizer's, and writes nothing", async () => {
    const wrote = await writeOpenKindProperties({
      kind: "give her wings",
      paired: true,
      extendsOutOfFrame: false,
      model: "m",
      promptVersion: "kp-1",
    });
    expect(wrote).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("reports a write that did not land rather than pretending it did", async () => {
    dbIsThere = false;
    const wrote = await writeOpenKindProperties({
      kind: "wings",
      paired: true,
      extendsOutOfFrame: false,
      model: "m",
      promptVersion: "kp-1",
    });
    expect(wrote).toBe(false);
    expect(inserts).toHaveLength(0);
  });
});
