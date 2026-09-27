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
  resolveDatabaseUrl,
} from "../scripts/lib/dbConnection.mjs";

/**
 * One arm below lets a connection attempt fail at DNS, which is fast but is not
 * instant on a contended bench, so it carries its own budget rather than the
 * suite default. Declared at file level because that is where the contended-test
 * guard reads it.
 */
const CONTENDED_TEST_TIMEOUT_MS = 20_000;

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

/**
 * AND A WRAPPED COMMAND THAT NAMES NO URL READS THE WORLD IT WAS WRAPPED FOR
 * (#1448).
 *
 * # What went wrong
 *
 * The door's default was `process.env.DATABASE_URL`, so a script handed nothing
 * reached for the `.env` world from inside a production run and the check above
 * refused it. Correct, and also a ceremony that will not go: #1389's backfill
 * died that way on production on 2026-09-26, and the refusal's own message named
 * the repair.
 *
 * # ⚠ WHY THESE ARMS ARE THE ONES THAT MATTER
 *
 * The change is a DEFAULT, and a default is invisible to every caller that
 * passes something — so the reading that makes it safe is the pair below: the
 * wrapped case moves, and the plain local case does not. The old behaviour is
 * asserted as a REFUSAL at the same inputs (the arms above), which is what makes
 * "no working road changes" a measurement rather than a hope: the only inputs
 * whose resolution moved are inputs that used to throw.
 *
 * # ⚠ AND THE PRECEDENCE IS DRIVEN, NOT READ OFF THE `??` CHAIN
 *
 * `MYSQL_PUBLIC_URL` wins because it is only ever present when somebody
 * deliberately wrapped the command in the production MySQL service. A future
 * edit that reorders the chain — putting `DATABASE_URL` first "because it is the
 * canonical one" — reintroduces the whole incident silently, and nothing else in
 * this repository would say so.
 */
describe("the door's default follows the wrapper (#1448)", () => {
  const KEYS = ["MYSQL_PUBLIC_URL", "PUBLIC_DATABASE_URL", "DATABASE_URL"] as const;

  /* The process env is shared by every suite in this file, so each arm restores
     exactly the three keys it touched rather than trusting a snapshot object. */
  function withEnv<T>(env: Partial<Record<(typeof KEYS)[number], string>>, run: () => T): T {
    const saved = KEYS.map((key) => [key, process.env[key]] as const);
    for (const key of KEYS) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    try {
      return run();
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  it("resolves the PUBLIC url inside a production run, rather than .env's dev one", () => {
    /*
      The exact shape of the incident: `railway run --service MySQL` injects no
      `DATABASE_URL`, so `dotenv/config` leaves the dev one in place beside the
      injected public production url.
    */
    withEnv({ MYSQL_PUBLIC_URL: PRODUCTION, DATABASE_URL: DEV }, () => {
      expect(resolveDatabaseUrl()).toBe(PRODUCTION);
    });
  });

  it("stays on .env for a plain local run — the road that must not move", () => {
    withEnv({ DATABASE_URL: DEV }, () => {
      expect(resolveDatabaseUrl()).toBe(DEV);
    });
  });

  it("prefers MYSQL_PUBLIC_URL over PUBLIC_DATABASE_URL over DATABASE_URL, in that order", () => {
    const OTHER = "mysql://user:pw@hayabusa.proxy.rlwy.net:9999/railway";
    withEnv({ MYSQL_PUBLIC_URL: PRODUCTION, PUBLIC_DATABASE_URL: OTHER, DATABASE_URL: DEV }, () => {
      expect(resolveDatabaseUrl()).toBe(PRODUCTION);
    });
    withEnv({ PUBLIC_DATABASE_URL: OTHER, DATABASE_URL: DEV }, () => {
      expect(resolveDatabaseUrl()).toBe(OTHER);
    });
  });

  /*
    ⚠ THE TWO ARMS THAT PROVE THE DEFAULT IS ACTUALLY THE RESOLVER — AND #1448's
    OWN SABOTAGE RUN IS WHY THEY EXIST IN THIS SHAPE.

    The first version of this block asserted `resolveDatabaseUrl()`'s arithmetic
    and the door's refusal path, and **reverting the door's default to
    `process.env.DATABASE_URL` — the incident, exactly — left the suite GREEN**.
    Five of seven cases caught; the two that survived were the only two the card
    is about. A guard on a DEFAULT has to observe the default.

    So these drive the doors with NO argument, in the wrapped-for-production
    environment, and key on the one thing that separates the two behaviours
    without a socket: the OLD default resolves to the dev url, which differs from
    the injected one, so `assertSameWorld` throws `WrongWorldError` **before any
    connection is attempted**. The new default resolves to the injected url, so
    it does not.

    `openPool` is the cleaner of the pair and is why it is first: `createPool` is
    lazy, so a pass touches no network at all.
  */
  it("takes a bare openPool() to the wrapped world instead of refusing it", () => {
    withEnv({ MYSQL_PUBLIC_URL: PRODUCTION, DATABASE_URL: DEV }, () => {
      /* Before #1448 this threw WrongWorldError: the default was DEV. */
      const pool = openPool();
      try {
        expect(pool).toBeDefined();
      } finally {
        /* Lazy, so nothing connected — but an unclosed pool keeps the event loop
           alive and a suite that hangs is worse than one that fails. */
        void pool.end().catch(() => undefined);
      }
    });
  });

  it("takes a bare openDatabase() to the wrapped world instead of refusing it", async () => {
    /*
      Hosts that cannot exist, so the connection fails at DNS immediately rather
      than reaching either real database. What is asserted is the error's CLASS:
      anything but `WrongWorldError` means the door accepted the wrapped url and
      got as far as trying to use it, which is the whole claim.
    */
    const UNROUTABLE_PRODUCTION = "mysql://u:p@production.invalid:3306/railway";
    const UNROUTABLE_DEV = "mysql://u:p@dev.invalid:3306/railway";
    await withEnv(
      { MYSQL_PUBLIC_URL: UNROUTABLE_PRODUCTION, DATABASE_URL: UNROUTABLE_DEV },
      async () => {
        let caught: unknown;
        try {
          await openDatabase();
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeDefined();
        expect(caught).not.toBeInstanceOf(WrongWorldError);
        expect(String((caught as Error).message)).not.toContain("different world");
      },
    );
  }, CONTENDED_TEST_TIMEOUT_MS);

  /* ⚠ `openDatabase` is not `async`, so a missing url throws SYNCHRONOUSLY,
     before any promise exists — `rejects` never sees it, and the first shape of
     this arm failed for exactly that reason rather than for the door's. */
  it("still refuses a bare opener that has no url at all, rather than connecting to nothing", () => {
    withEnv({}, () => {
      expect(() => openDatabase()).toThrow(/no database url/);
      expect(() => openPool()).toThrow(/no database url/);
    });
  });

  /*
    ⚠ `--service Drape` IS NOT ENOUGH ON ITS OWN, and the script's docblock says
    so because of this reading. Measured at the artifact 2026-09-27: that wrapper
    injects ONE database address and it is the PRIVATE one, unreachable from a
    laptop — so the resolver, correctly, hands back exactly what it was given and
    the ceremony needs a public url in the shell as well.
  */
  it("hands back the private url under a bucket-only wrapper, because that is all there is", () => {
    const PRIVATE = "mysql://user:pw@mysql.railway.internal:3306/railway";
    withEnv({ DATABASE_URL: PRIVATE }, () => {
      expect(resolveDatabaseUrl()).toBe(PRIVATE);
    });
  });
});
