/**
 * THE CEREMONY SKELETON'S OWN CONTROLS (fable-486 §e).
 *
 * A migration rite is the one script in this repo that changes production by
 * design, so the parts that are shared have to be the parts that are proven.
 * Every case below is a refusal that exists for an incident: a world guessed, a
 * production URL read out of a file, an absence believed from a reader that
 * could not say yes, DDL retyped into a script instead of replayed, and an
 * ALTER believed on its own silence.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  applyOnce,
  closeCeremony,
  columnType,
  proveTheReader,
  replayMigration,
  tableExists,
} from "../scripts/lib/ceremony.mts";

/** A connection double that answers from a script and records what it was asked. */
function connection(answers: Record<string, unknown[]>) {
  const asked: Array<{ sql: string; params?: unknown[] }> = [];
  return {
    asked,
    async query(sql: string, params?: unknown[]) {
      asked.push({ sql, params });
      for (const [pattern, rows] of Object.entries(answers)) {
        if (sql.includes(pattern)) return [rows];
      }
      return [[]];
    },
    async end() {},
  } as any;
}

describe("the reader, before its absence counts", () => {
  it("passes when the control table is there", async () => {
    await expect(proveTheReader(connection({ "SHOW TABLES": [{ t: "casting_candidates" }] })))
      .resolves.toBeUndefined();
  });

  it("REFUSES when the control cannot be seen — the wrong-database shape", async () => {
    /* An empty answer about the ceremony's own table and an empty answer from a
       reader pointed at the wrong database look identical. */
    await expect(proveTheReader(connection({}))).rejects.toThrow(/cannot see/);
  });

  it("asks about the table it was told to, not a constant near it", async () => {
    const conn = connection({ "SHOW TABLES": [{ t: "x" }] });
    await proveTheReader(conn, "some_other_table");
    expect(conn.asked[0]!.params).toEqual(["some_other_table"]);
  });
});

describe("what is here", () => {
  it("reads a table's presence and a column's live type", async () => {
    const conn = connection({
      "SHOW TABLES": [{ t: "casting_reference_library" }],
      "SHOW COLUMNS": [{ Type: "enum('a','b')" }],
    });
    expect(await tableExists(conn, "casting_reference_library")).toBe(true);
    expect(await columnType(conn, "casting_reference_library", "role")).toBe("enum('a','b')");
  });

  it("says null for a column that is not there — never an empty string", async () => {
    /* A caller doing `type.includes("vacancy")` on "" would read absent as
       "present and not it", which is the same word for two different worlds. */
    expect(await columnType(connection({}), "t", "c")).toBeNull();
  });
});

describe("the migration file, replayed", () => {
  const write = (body: string) => {
    const file = path.join(os.tmpdir(), `ceremony-${body.length}-${body.slice(0, 4).replace(/\W/g, "")}.sql`);
    fs.writeFileSync(file, body, "utf8");
    return file;
  };

  it("runs every statement, split on drizzle's own breakpoint", async () => {
    const conn = connection({});
    const file = write("ALTER TABLE a ADD COLUMN b INT;\n--> statement-breakpoint\nALTER TABLE a ADD COLUMN c INT;");
    expect(await replayMigration(conn, file)).toBe(2);
    expect(conn.asked.map((entry: any) => entry.sql)).toEqual([
      "ALTER TABLE a ADD COLUMN b INT;",
      "ALTER TABLE a ADD COLUMN c INT;",
    ]);
  });

  it("REFUSES a file with nothing in it — a wrong path is silent otherwise", async () => {
    /* A ceremony that replayed an empty file would report success having done
       nothing at all, which is the worst of the three possible outcomes. */
    await expect(replayMigration(connection({}), write("   \n  "))).rejects.toThrow(/no statements/);
  });
});

describe("apply once, and read back", () => {
  it("does nothing on a second run, and says so", async () => {
    let applied = 0;
    const outcome = await applyOnce({
      what: "the third role is legal",
      isApplied: async () => true,
      apply: async () => { applied += 1; },
    });
    expect(outcome).toBe("already");
    expect(applied).toBe(0);
  });

  it("applies, then believes the READBACK rather than the silence", async () => {
    let state = false;
    const outcome = await applyOnce({
      what: "the column exists",
      isApplied: async () => state,
      apply: async () => { state = true; },
    });
    expect(outcome).toBe("applied");
  });

  it("REFUSES when the migration ran and changed nothing", async () => {
    /* The ALTER's silence is not evidence. This is the door where a ceremony
       would otherwise report APPLIED about a database it did not change. */
    await expect(applyOnce({
      what: "the column exists",
      isApplied: async () => false,
      apply: async () => {},
    })).rejects.toThrow(/still not true/);
  });
});

describe("the ending", () => {
  it("closes the connection and hands back the code, rather than exiting itself", async () => {
    /* It must not exit on the caller's behalf: the repo's exit-discipline guard
       reads a script's TERMINAL statement, and a helper that called
       `process.exit` would leave every ceremony looking like it runs off the
       end of the file. */
    let closed = 0;
    const world = { world: "dev" as const, where: "host:1", connection: { async end() { closed += 1; } } as any };
    expect(await closeCeremony(world)).toBe(0);
    expect(await closeCeremony(world, new Error("nope"))).toBe(1);
    expect(closed).toBe(2);
  });
});
