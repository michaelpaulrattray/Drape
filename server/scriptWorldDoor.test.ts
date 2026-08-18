/**
 * A SCRIPT WRAPPED IN THE PRODUCTION SERVICE MAY NOT OPEN THE DEV DATABASE.
 *
 * # The incident, and why the existing answers were not enough
 *
 * `railway run --service MySQL -- npx tsx scripts/x.mts` injects that service's
 * variables and **no `DATABASE_URL`** — production arrives as
 * `MYSQL_PUBLIC_URL`. A script that also does `import "dotenv/config"` and then
 * opens `process.env.DATABASE_URL` gets **dev**, under a command whose entire
 * purpose was to read production, with nothing in the output to say so.
 *
 * Two answers already existed and neither stopped it. `resolveDatabaseUrl()`
 * has been in the door's own module for weeks and is used by **4 of 404**
 * callers. `scripts/lib/worldGuard.mts` exists for exactly this shape and must
 * be imported and called by each script that wants it. Both are opt-in, and a
 * control that is not invoked does not exist — the same sentence that put the
 * timezone fix at the connection instead of in a documented helper.
 *
 * So this one is at the door, where it cannot be forgotten per-script, and it
 * FAILS CLOSED: it refuses the run rather than choosing a world on the caller's
 * behalf. Silently switching which database a script reads would be the same
 * class of surprise pointing the other way.
 *
 * # It cost a real reading
 *
 * 2026-08-18: an investigation into a founder-reported defect read the branch
 * from dev and reported it as production, including a sentence about credits he
 * had been charged. The rows were right and the world was wrong. The script's
 * own first line printed `hayabusa.proxy.rlwy.net:52008` — the host is shared
 * between the two worlds and only the PORT differs, so the line that was
 * supposed to prevent this was read straight past.
 */
import { describe, expect, it } from "vitest";
import {
  WrongWorldError,
  assertSameWorld,
  openDatabase,
  openPool,
} from "../scripts/lib/dbConnection.mjs";

const DEV = "mysql://user:pw@hayabusa.proxy.rlwy.net:52008/railway";
const PRODUCTION = "mysql://user:pw@hayabusa.proxy.rlwy.net:23768/railway";

describe("the world check itself", () => {
  it("says nothing on a plain local run", () => {
    expect(() => assertSameWorld(DEV, {})).not.toThrow();
  });

  it("says nothing when the url IS the injected one", () => {
    expect(() => assertSameWorld(PRODUCTION, { MYSQL_PUBLIC_URL: PRODUCTION }))
      .not.toThrow();
  });

  it("REFUSES the dev url inside a production run", () => {
    expect(() => assertSameWorld(DEV, { MYSQL_PUBLIC_URL: PRODUCTION }))
      .toThrow(WrongWorldError);
  });

  it("names both worlds by their PORT, because the host is the same in each", () => {
    /*
      The whole reason the incident happened: `hayabusa.proxy.rlwy.net/railway`
      is dev AND production, and a message naming the host says nothing.
    */
    let message = "";
    try {
      assertSameWorld(DEV, { MYSQL_PUBLIC_URL: PRODUCTION });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("52008");
    expect(message).toContain("23768");
  });

  it("tells the caller what to do rather than only what is wrong", () => {
    let message = "";
    try {
      assertSameWorld(DEV, { MYSQL_PUBLIC_URL: PRODUCTION });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("resolveDatabaseUrl");
  });
});

/**
 * AND THE DOOR ACTUALLY CALLS IT.
 *
 * Driven through `openDatabase`/`openPool` rather than asserted about their
 * source, because a check the door does not invoke is the exact failure this
 * file exists about. Neither call reaches the network: the refusal is raised
 * before a connection is attempted, which is also why these are safe in a suite
 * that has no database.
 */
describe("the door refuses before it connects", () => {
  const saved = process.env.MYSQL_PUBLIC_URL;
  const arm = <T>(run: () => T): T => {
    process.env.MYSQL_PUBLIC_URL = PRODUCTION;
    try {
      return run();
    } finally {
      if (saved === undefined) delete process.env.MYSQL_PUBLIC_URL;
      else process.env.MYSQL_PUBLIC_URL = saved;
    }
  };

  it("refuses a connection to the other world", () => {
    arm(() => expect(() => openDatabase(DEV)).toThrow(WrongWorldError));
  });

  it("refuses a POOL to the other world — half a class is how the last one survived", () => {
    arm(() => expect(() => openPool(DEV)).toThrow(WrongWorldError));
  });

  it("refuses the object form as well as the url form", () => {
    arm(() => expect(() => openDatabase({ uri: DEV })).toThrow(WrongWorldError));
  });
});
