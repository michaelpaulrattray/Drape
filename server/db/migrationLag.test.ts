import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { unappliedMigrations } from "./migrationLag";

/**
 * The lag checker, with both controls — because a checker that cannot fire is
 * the thing it was written to catch (working law 2).
 *
 * It exists because dev sat one migration behind production while every test
 * was green: the suite strips `DATABASE_URL` on purpose, so no unit test can
 * reach a database, and the gap between the suite and the machine had nothing
 * watching it.
 */
describe("a database behind its own journal says so", () => {
  const entries = [
    { tag: "0024_a", when: 100 },
    { tag: "0025_b", when: 200 },
    { tag: "0026_c", when: 300 },
  ];

  it("POSITIVE CONTROL — names the outstanding migrations, in order", () => {
    expect(unappliedMigrations({ entries, applied: [100, 200] })).toEqual(["0026_c"]);
  });

  it("NEGATIVE CONTROL — says nothing when the ledger is current", () => {
    expect(unappliedMigrations({ entries, applied: [100, 200, 300] })).toEqual([]);
  });

  it("treats a database ahead of the journal as current, not as a fault", () => {
    /* A branch with a newer migration was checked out and then abandoned. That
       is not this checker's business, and inventing an error for it would train
       people to ignore the line that matters. */
    expect(unappliedMigrations({ entries, applied: [100, 200, 300, 400] })).toEqual([]);
  });

  it("an EMPTY ledger is every migration outstanding, never 'up to date'", () => {
    /*
      The flattering direction, closed. A fresh database has no rows, and a rule
      written as "newer than the newest applied" would silently pass with no
      applied rows at all — reporting a completely unmigrated database as ready.
    */
    expect(unappliedMigrations({ entries, applied: [] })).toEqual(["0024_a", "0025_b", "0026_c"]);
  });

  it("reads the real journal, so the shape it expects is the shape on disk", () => {
    /*
      The one assertion that would notice drizzle changing its journal format
      under us — a checker parsing a file that no longer looks like that would
      report "no migrations outstanding" forever, which is the silent-pass
      failure this whole module is about.
    */
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(Array.isArray(journal.entries)).toBe(true);
    expect(journal.entries.length).toBeGreaterThan(0);
    for (const entry of journal.entries) {
      expect(typeof entry.tag).toBe("string");
      expect(Number.isFinite(entry.when)).toBe(true);
    }
    /* And the real journal against a ledger holding only its first entry must
       name every later one — the checker driven on production's own data. */
    const outstanding = unappliedMigrations({
      entries: journal.entries,
      applied: [journal.entries[0].when],
    });
    expect(outstanding).toHaveLength(journal.entries.length - 1);
    expect(outstanding).not.toContain(journal.entries[0].tag);
  });
});
