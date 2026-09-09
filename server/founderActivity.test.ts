/**
 * THE COURTESY FREEZE'S ONE READING, DRIVEN IN BOTH DIRECTIONS (#585).
 *
 * Before the deploy-on-merge flip (#508) the deploy rite was the only road to
 * production and its freeze was the whole story. After it, **a squash merge
 * deploys** — and the road shifts actually merge on had no such manners. A
 * merge landing mid-roll kills the process holding his candidates and costs him
 * the D-85 window.
 *
 * The card's bar, and every arm below answers to one clause of it:
 *
 * > The read is shared with the rite (extract, don't copy — working law 4).
 * > An unreadable ledger fails OPEN for the helper (merge proceeds) — the
 * > freeze is manners, not a control (D-85), and a broken read must not wedge
 * > the merge road. Driven arms for both directions.
 *
 * ⚠ **THE FAIL-OPEN ARMS ARE THE ONES THAT MATTER AND THEY ARE THE EASY ONES TO
 * GET BACKWARDS.** Every failure path here returns `active: false`, which MERGES
 * and DEPLOYS. An arm that only asserted "it did not throw" would pass over a
 * reading that had silently stopped freezing — so each one asserts the NOTE too,
 * because a receipt that shows a failure as quiet is the actual defect.
 */
import { describe, expect, it, vi } from "vitest";

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FOUNDER_ACTIVE_WINDOW_MINUTES,
  FOUNDER_ACTIVITY_SQL,
  FOUNDER_USER_ID,
  productionDatabaseUrl,
  readFounderActivity,
} from "../scripts/lib/founderActivity.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* The runner arm below spawns a real batch file, so this suite declares the
   class's timeout rather than racing vitest's 5 s default under a parallel
   run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const NOW = Date.parse("2026-09-09T13:00:00Z");
const at = (minutesAgo: number) =>
  new Date(NOW - minutesAgo * 60_000).toISOString();

/** A fake connection that answers with one `latest` and records its life. */
function ledgerReturning(latest: string | null) {
  const seen = { queries: [] as string[], ended: 0 };
  const openDatabase = async () => ({
    query: async (sql: string) => {
      seen.queries.push(sql);
      return [[{ latest }], []] as [unknown, unknown];
    },
    end: async () => {
      seen.ended += 1;
    },
  });
  return { openDatabase, seen };
}

const read = (latest: string | null) =>
  readFounderActivity({
    url: "mysql://ignored",
    openDatabase: ledgerReturning(latest).openDatabase,
    now: () => NOW,
  });

describe("is he mid-session", () => {
  it("says ACTIVE for a cast a minute old — the merge holds", async () => {
    const verdict = await read(at(1));
    expect(verdict.active).toBe(true);
    expect(verdict.note).toContain("1.0 minutes ago");
  });

  it("says quiet for a cast an hour old", async () => {
    const verdict = await read(at(60));
    expect(verdict.active).toBe(false);
    expect(verdict.note).toContain("60.0 minutes ago");
  });

  it("holds ON the window's edge and releases just past it", async () => {
    /* The boundary is the whole rule, and `<=` vs `<` is one character. */
    expect((await read(at(FOUNDER_ACTIVE_WINDOW_MINUTES))).active).toBe(true);
    expect((await read(at(FOUNDER_ACTIVE_WINDOW_MINUTES + 0.1))).active).toBe(false);
  });

  it("never claims quiet without naming what it cannot see", async () => {
    /* ⚠ On 2026-08-16 this line printed "138.5 minutes ago" while he was
       opening face panels — twelve production scans in twelve minutes. The
       guard is unchanged deliberately; the SENTENCE is what must not overstate
       the reading's reach. */
    for (const latest of [at(1), at(600), null]) {
      expect((await read(latest)).note).toContain("browsing writes no row");
    }
  });

  it("treats an empty ledger as quiet, and says so in those words", async () => {
    const verdict = await read(null);
    expect(verdict.active).toBe(false);
    expect(verdict.note).toContain("no cast or version on record");
  });

  it("reads HIS account and both casting tables in one statement", async () => {
    const { openDatabase, seen } = ledgerReturning(at(1));
    await readFounderActivity({ url: "mysql://ignored", openDatabase, now: () => NOW });
    expect(seen.queries).toHaveLength(1);
    expect(seen.queries[0]).toContain("casting_candidates");
    expect(seen.queries[0]).toContain("casting_candidate_variants");
    expect(seen.queries[0]).toContain(`userId = ${FOUNDER_USER_ID}`);
    /* The statement the two consumers share is the exported one, not a copy. */
    expect(seen.queries[0]).toBe(FOUNDER_ACTIVITY_SQL);
  });
});

describe("⚠ it fails OPEN — every one of these MERGES and DEPLOYS", () => {
  it("an address it could not read", async () => {
    const verdict = await readFounderActivity({
      url: undefined,
      openDatabase: async () => {
        throw new Error("must not be called");
      },
    });
    expect(verdict.active).toBe(false);
    expect(verdict.note).toContain("MYSQL_PUBLIC_URL not readable");
  });

  it("a ledger that will not open", async () => {
    const verdict = await readFounderActivity({
      url: "mysql://unreachable",
      openDatabase: async () => {
        throw new Error("connect ECONNREFUSED mysql://user:hunter2@host/db");
      },
    });
    expect(verdict.active).toBe(false);
    expect(verdict.note).toContain("could not be reached");
  });

  it("a query that throws — and the connection is still closed", async () => {
    /* ⚠ The rite's original shape closed the connection only on the happy
       path, so a failing read leaked a handle into a script that then waits
       minutes on a deploy watch. */
    let ended = 0;
    const verdict = await readFounderActivity({
      url: "mysql://ignored",
      openDatabase: async () => ({
        query: async () => {
          throw new Error("table casting_candidates doesn't exist");
        },
        end: async () => {
          ended += 1;
        },
      }),
    });
    expect(verdict.active).toBe(false);
    expect(verdict.note).toContain("could not be reached");
    expect(ended, "a failing read must not leak the connection").toBe(1);
  });

  it("NEVER puts the driver's error text — or a DSN — on the receipt", async () => {
    /* This note goes into a deploy receipt and a mailbox report. A driver's
       connection error carries the URL it was handed, credentials included. */
    const verdict = await readFounderActivity({
      url: "mysql://root:hunter2@ledger.example:3306/railway",
      openDatabase: async () => {
        throw new Error("Access denied for mysql://root:hunter2@ledger.example:3306/railway");
      },
    });
    expect(verdict.note).not.toContain("hunter2");
    expect(verdict.note).not.toContain("ledger.example");
    expect(verdict.note).not.toContain("Access denied");
  });

  it("closes the connection on the happy path too", async () => {
    const { openDatabase, seen } = ledgerReturning(at(1));
    await readFounderActivity({ url: "mysql://ignored", openDatabase, now: () => NOW });
    expect(seen.ended).toBe(1);
  });
});

describe("the ledger's address, read by name and never printed", () => {
  const BLOCK = [
    "MYSQLDATABASE=railway",
    "MYSQL_PUBLIC_URL=mysql://root:pw@hayabusa.proxy.rlwy.net:23768/railway",
    "MYSQL_URL=mysql://root:pw@mysql.railway.internal:3306/railway",
  ].join("\n");

  it("picks MYSQL_PUBLIC_URL and not its lookalike neighbours", () => {
    /* ⚠ `MYSQL_URL` is the INTERNAL address and is unreachable from this
       machine — a parser that took it would fail open and stop freezing. */
    expect(productionDatabaseUrl(() => BLOCK))
      .toBe("mysql://root:pw@hayabusa.proxy.rlwy.net:23768/railway");
  });

  it("survives the CRLF `railway.cmd` actually prints on Windows", () => {
    expect(productionDatabaseUrl(() => BLOCK.replace(/\n/g, "\r\n")))
      .toBe("mysql://root:pw@hayabusa.proxy.rlwy.net:23768/railway");
  });

  it("returns undefined when the variable is absent — fail open, not a throw", () => {
    expect(productionDatabaseUrl(() => "MYSQLDATABASE=railway")).toBeUndefined();
  });

  it("returns undefined when the runner throws — a worktree has NO Railway link", () => {
    /* The common path: the merge helper is usually run from the main tree, but
       a shift running it from its worktree must merge, not crash. */
    expect(productionDatabaseUrl(() => {
      throw new Error("No linked project found. Run `railway link`");
    })).toBeUndefined();
  });
});

describe("⚠ THE RUNNER — a `.cmd` needs a shell, and without one the freeze is INERT", () => {
  /*
    Review of PR #723, finding 1, and it was verified at the artifact before it
    was believed: `execFileSync("railway.cmd", …)` without `shell: true` throws
    `EINVAL spawnSync railway.cmd` on this machine, every time. The throw was
    swallowed by `productionDatabaseUrl`'s fail-open, so **every merge would
    have printed "(unread — MYSQL_PUBLIC_URL not readable)" and merged anyway**
    — a courtesy freeze that could never fire, wearing a note that reads like a
    worktree with no Railway link. Invariant 7 exactly.

    ⚠ **A SOURCE ARM WOULD NOT HAVE CAUGHT IT AND WOULD NOT CATCH IT NOW** —
    the shape looked right. So this DRIVES a real batch file through the same
    call shape the shared runner uses, which is the only reading that can tell
    the two apart.
  */
  const windows = process.platform === "win32";

  it.skipIf(!windows)("resolves a real .cmd from PATH the way the shared runner does", () => {
    const dir = mkdtempSync(join(tmpdir(), "drape-runner-"));
    try {
      writeFileSync(join(dir, "drape-probe.cmd"), "@echo MYSQL_PUBLIC_URL=mysql://probe", "utf8");
      const withPath = { ...process.env, PATH: `${dir};${process.env.PATH ?? ""}` };

      /* THE NEGATIVE CONTROL: the shape the first version of this shipped. */
      let threw: string | null = null;
      try {
        execFileSync("drape-probe.cmd", [], { encoding: "utf8", env: withPath });
      } catch (error) {
        threw = String((error as { code?: string }).code ?? error);
      }
      expect(threw, "without a shell a .cmd must NOT resolve — if this ever passes, the arm below proves nothing")
        .toBe("EINVAL");

      /* THE POSITIVE CONTROL: the shape `railwayVariables` uses. */
      const out = execFileSync("drape-probe.cmd", [], {
        encoding: "utf8",
        env: withPath,
        shell: true,
      });
      expect(out).toContain("MYSQL_PUBLIC_URL=mysql://probe");
      /* And the parse the freeze depends on survives the round trip. */
      expect(productionDatabaseUrl(() => out)).toBe("mysql://probe");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the shared runner asks for a shell, and so does the rite's own", () => {
    /* The drive above proves WHY; this proves neither road has lost it. The
       rite keeps its own general-purpose `railway()` runner (twenty-odd call
       sites), which already carried this lesson in its own words — so what must
       hold is that both ask for a shell, not that there is one runner. */
    const source = (file: string) =>
      readFileSync(new URL(`../scripts/${file}`, import.meta.url), "utf8");
    /* ⚠ Read the FUNCTION BODY, not the file. The first shape of this arm
       searched the whole module and matched the docblock, which quotes
       `shell: true` in prose — so removing it from the actual call left the
       arm green. An instrument that reads a comment as a fact is the class
       this repository writes down most often. */
    const module = source("lib/founderActivity.mts");
    const start = module.indexOf("export function railwayVariables");
    expect(start, "the shared runner must exist").toBeGreaterThan(-1);
    const body = module.slice(start, module.indexOf("\n}", start));
    expect(body, "the shared runner must ask for a shell — a .cmd cannot resolve without one")
      .toContain("shell: true");
    expect(source("pr-merge-in-order.mts"), "the helper must use the shared runner, not build its own")
      .not.toMatch(/execFileSync\("railway\.cmd"/);
  });
});

describe("ONE reading, not two — the rite and the merge helper", () => {
  const source = (file: string) =>
    readFileSync(new URL(`../scripts/${file}`, import.meta.url), "utf8");

  it("neither consumer declares its own query", () => {
    /*
      ⚠ **A SOURCE READ IS A WEAK ARM AND IS NOT WHAT PROVES THE READING — the
      behavioural arms above do that.** What it can prove is the one thing
      behaviour cannot: that a SECOND copy of the statement has not appeared
      beside the shared one. That is the failure this card exists to prevent
      (the rite had the read, the helper had none, and the tempting fix was to
      paste it), and it leaves no behavioural trace until the two disagree.
    */
    for (const file of ["deploy-rite.mts", "pr-merge-in-order.mts"]) {
      expect(source(file), `${file} must not carry its own copy of the query`)
        .not.toContain("casting_candidate_variants WHERE userId");
    }
  });

  it("nobody re-inlines the MYSQL_PUBLIC_URL parse — all four copies are gone", () => {
    /*
      ⚠ Review of PR #723, finding 2, and working law 7: the sweep is part of
      the fix. The rite carried a SECOND copy fifteen lines below the comment
      saying two copies is the defect, and `park-state.mts` carried a third that
      split on `"
"` alone — so a CRLF line left a `
` on the end of the URL.
    */
    for (const file of ["deploy-rite.mts", "pr-merge-in-order.mts", "park-state.mts"]) {
      expect(source(file), `${file} must reach the address through the shared parse`)
        .not.toContain(`startsWith("MYSQL_PUBLIC_URL=")`);
    }
  });

  it("both roads reach the freeze through the shared module", () => {
    for (const file of ["deploy-rite.mts", "pr-merge-in-order.mts"]) {
      expect(source(file), `${file} must import the shared reading`)
        .toContain("./lib/founderActivity.mts");
    }
  });
});
