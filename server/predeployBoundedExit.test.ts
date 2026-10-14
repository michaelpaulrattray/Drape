/**
 * #1745 — A DEPLOY-PATH SCRIPT EXITS ON A BOUNDED CLOCK.
 *
 * `scripts/predeploy-migrate.mts` printed its verdict at 00:49:44 and then held
 * Railway's pre-deploy container for TEN MINUTES on `await connection?.end()`,
 * which waits for the server to acknowledge a quit packet that a half-dead
 * socket never sends. Railway killed it and **failed the deployment of a green,
 * healthy build** (`0a455a43` of `f7381022`); `deploy-verify` on main went red
 * for the same reason. Production was never switched and kept serving happily —
 * the design worked, the script did not.
 *
 * Three halves:
 *
 * - the **decision** arms drive `closeWithin` against stubs — an `end()` that
 *   never resolves, one that resolves, one that rejects — with an injected bound
 *   so they cost milliseconds;
 * - the **process** arms run REAL node children, because the two traps in this
 *   module are both about what `process.exit` does to a live handle and neither
 *   is observable from inside the test process. One of them (a late rejection
 *   killing the process with node's own code) can ONLY be seen as an exit code;
 * - the **sweep** arms DERIVE the deploy path's own file set — the card's third
 *   done-when — and assert every awaited close on it is bounded. The population
 *   comes from `package.json`'s build script and the import graph, never a list
 *   typed here, because a guard keyed on the files already fixed stops watching
 *   the moment one is added.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";
import { codeOnly } from "./testing/withoutComments";
import {
  CLOSE_BOUND_MS,
  closeLine,
  closeWithin,
  type BoundedCloseable,
} from "../scripts/lib/boundedClose.mts";

/* This suite spawns real node children. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const REPO = process.cwd();
const read = (relative: string): string => readFileSync(path.join(REPO, relative), "utf8");

/**
 * ⚠ **THE SWEEP ASKS ABOUT CODE, AND PROSE IS NOT CODE (#1623's lesson, paid
 * again here on the first run).** Every arm below that looks for the shape that
 * hung went RED on this change's own DOCBLOCKS, which quote the old line
 * verbatim in order to explain what it cost. A guard whose false positives land
 * on exactly the files that WRITE about the defect teaches shifts to stop
 * writing it down. `codeOnly` is the house reader for this, imported rather
 * than copied (working law 4).
 */
const codeOf = (relative: string): string => codeOnly(read(relative));

/** An `end()` that never settles — the incident, in two lines. */
const neverCloses = (): BoundedCloseable & { destroyed: number } => {
  const stub = {
    destroyed: 0,
    end: () => new Promise<void>(() => { /* the quit packet is never answered */ }),
    destroy: () => { stub.destroyed += 1; },
  };
  return stub;
};

describe("#1745 · closeWithin stops waiting", () => {
  it("THE INCIDENT: an end() that never resolves is bounded, and the socket is destroyed", async () => {
    const stub = neverCloses();
    const began = Date.now();

    const outcome = await closeWithin(stub, { bound: 40 });

    expect(outcome).toEqual({ kind: "destroyed", why: "timeout", detail: "40 ms" });
    expect(stub.destroyed, "the socket was left open after the bound").toBe(1);
    /* Generous, because the arm is about BOUNDEDNESS and not about 40ms: the
       thing that failed was ten minutes. A tight ceiling here would be the
       load-sensitive red the timeout constants exist to prevent. */
    expect(Date.now() - began).toBeLessThan(5_000);
  });

  it("the ordinary road: a clean end() is awaited and the socket is NOT destroyed", async () => {
    let destroyed = 0;
    const outcome = await closeWithin({
      end: async () => undefined,
      destroy: () => { destroyed += 1; },
    }, { bound: 40 });

    expect(outcome).toEqual({ kind: "closed" });
    /* The positive control the card asked for by name. A bound that destroyed
       every socket would pass the arm above and be a different defect. */
    expect(destroyed, "a clean close was cut anyway").toBe(0);
  });

  it("a rejected end() is destroyed too, and reports the CODE and never a driver message", async () => {
    let destroyed = 0;
    const outcome = await closeWithin({
      end: async () => {
        /* A driver error can carry the DSN — the rule `predeploy-migrate.mts`'s
           own header states for its refusals. */
        throw Object.assign(new Error("connect ECONNRESET mysql://user:pw@host/db"), { code: "ECONNRESET" });
      },
      destroy: () => { destroyed += 1; },
    }, { bound: 2_000 });

    expect(outcome).toEqual({ kind: "destroyed", why: "error", detail: "ECONNRESET" });
    expect(destroyed).toBe(1);
    expect(JSON.stringify(outcome)).not.toContain("mysql://");
  });

  it("a pool without destroy still returns inside the bound", async () => {
    /* `mysql2/promise` puts `destroy` on a CONNECTION and not on a Pool, which
       is why the type has it optional. The bound must still hold. */
    const outcome = await closeWithin({ end: () => new Promise<void>(() => {}) }, { bound: 40 });
    expect(outcome).toEqual({ kind: "destroyed", why: "timeout", detail: "40 ms" });
  });

  it("a destroy that throws is not an error — it has already stopped us waiting", async () => {
    const outcome = await closeWithin({
      end: () => new Promise<void>(() => {}),
      destroy: () => { throw new Error("already destroyed"); },
    }, { bound: 40 });

    expect(outcome.kind).toBe("destroyed");
  });

  it("nothing open is its own answer", async () => {
    expect(await closeWithin(null)).toEqual({ kind: "absent" });
    expect(await closeWithin(undefined)).toEqual({ kind: "absent" });
  });

  it("the default bound is sized against the SUCCESS case, not against the hang", () => {
    /* A hang has no duration to tune against. What this number must not be is
       long enough to matter beside a deploy, or short enough to cut a healthy
       close on Railway's internal network (single-digit ms, measured). */
    expect(CLOSE_BOUND_MS).toBeGreaterThanOrEqual(500);
    expect(CLOSE_BOUND_MS).toBeLessThanOrEqual(5_000);
  });
});

describe("#1745 · the log line is the interesting case only", () => {
  it("says nothing on the ordinary road, so the one interesting line stays visible", () => {
    expect(closeLine({ kind: "closed" })).toBeNull();
    expect(closeLine({ kind: "absent" })).toBeNull();
  });

  it("names the bound, the card, and that the verdict is untouched", () => {
    const line = closeLine({ kind: "destroyed", why: "timeout", detail: "2000 ms" })!;
    expect(line).toContain("2000 ms");
    expect(line).toContain("#1745");
    /* The sentence that stops a reader diagnosing a deploy that was fine. */
    expect(line).toContain("changes nothing about it");
  });
});

/* ───────────────────── the two traps, in real processes ──────────────────── */

const LOADER = new URL(
  `file:///${path.join(REPO, "node_modules", "tsx", "dist", "loader.mjs").replace(/\\/g, "/")}`,
).href;

/**
 * Run a one-off script that imports the real module and exits with a code of
 * its own choosing — which is the only observable that matters here, because
 * both traps destroy the exit code rather than the output.
 */
function driveExit(body: string): { status: number; stdout: string; stderr: string } {
  return runHook(process.execPath, ["--import", LOADER, "--input-type=module", "--eval", body], {
    cwd: REPO,
    timeout: 60_000,
  });
}

const IMPORT_LINE = `import { closeWithin } from ${JSON.stringify(
  new URL(`file:///${path.join(REPO, "scripts", "lib", "boundedClose.mts").replace(/\\/g, "/")}`).href,
)};`;

describe("#1745 · the process really exits, with the code it decided", () => {
  it("THE WHOLE POINT: a never-resolving end() does not stop the exit", () => {
    const began = Date.now();
    const result = driveExit(`
      ${IMPORT_LINE}
      const outcome = await closeWithin({ end: () => new Promise(() => {}), destroy: () => {} }, { bound: 50 });
      console.log(outcome.kind);
      process.exit(7);
    `);

    /* 7 rather than 0: a child that fell out of the bottom without reaching the
       exit would report 0 and pass a `toBe(0)` arm for the wrong reason. */
    expect(result.status, result.stderr).toBe(7);
    expect(result.stdout.trim()).toContain("destroyed");
    expect(Date.now() - began).toBeLessThan(30_000);
  });

  it("⚠ TRAP 2: an end() that rejects AFTER the bound does not kill the process", () => {
    /*
      This is the arm no in-process assertion can write. An abandoned `end()`
      that rejects later is an unhandled rejection, and node's default is to
      terminate with a code of its own — so the exit code the script decided,
      and printed a verdict for, would be replaced by node's. Railway reads
      nothing but that code.

      The rejection is scheduled to land WELL after the bound, and the script
      then idles past that moment before exiting, so the rejection genuinely
      fires while the process is still alive.
    */
    const result = driveExit(`
      ${IMPORT_LINE}
      let reject;
      const outcome = await closeWithin({
        end: () => new Promise((_, r) => { reject = r; }),
        destroy: () => {},
      }, { bound: 30 });
      console.log(outcome.kind);
      reject(Object.assign(new Error("late"), { code: "EPIPE" }));
      await new Promise((r) => setTimeout(r, 300));
      process.exit(7);
    `);

    expect(result.status, `node replaced the exit code — ${result.stderr}`).toBe(7);
    expect(result.stderr).not.toContain("UnhandledPromiseRejection");
  });

  it("the negative control: the UNBOUNDED shape never delivers the decided code", () => {
    /*
      Working law 2 pointed at this suite: the arms above would pass over a
      `closeWithin` that did nothing at all, as long as it returned. So this
      drives the shape the module REPLACED and proves it cannot reach the exit.

      ⚠ What it reports is **13**, not a hang, and that is worth knowing rather
      than smoothing over: node sees a top-level await that can never settle on
      an idle loop and exits with a code of its own. Railway reads nothing but
      that code, so the symptom differs from the ten-minute container only in
      how long it takes to lose the verdict. The real script had a live socket
      keeping its loop busy, which is why it hung instead.
    */
    const result = driveExit(`
      const connection = { end: () => new Promise(() => {}) };
      await connection.end();
      process.exit(7);
    `);

    expect(result.status, "the unbounded await somehow reached the exit").not.toBe(7);
  });
});

/* ──────────────── the sweep, derived rather than listed ──────────────────── */

/**
 * THE DEPLOY PATH, DERIVED — the card's third done-when.
 *
 * ⚠ **NOT A LIST OF TWO FILENAMES.** A guard keyed on the files already fixed
 * stops watching the moment a third is added, which is the class
 * `childProcessTestTimeouts` and `listedSource` both record paying for. So the
 * entrypoints come from the artifact that decides them — `package.json`'s build
 * script names the pre-deploy bundle's source — and the population is their
 * transitive local import closure.
 *
 * The two entrypoints and why each is on the path:
 *  - the **pre-deploy command**, bundled by `pnpm build` into `dist/predeploy.js`
 *    and run by Railway between the build and the cutover. A hang here FAILS
 *    THE DEPLOY, which is the incident.
 *  - the **deploy rite**, which is the other road to production. A hang there
 *    cannot fail a deploy — production is untouched and a stalled terminal is
 *    visible — but it stalls the rite where nothing says why, and the rite's own
 *    `settleSockets` already treats this class as real.
 */
const PREDEPLOY_FROM_BUILD = ((): string => {
  const build = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts.build!;
  const match = /esbuild\s+(scripts\/[\w.-]+\.mts)[^&]*--outfile=dist\/predeploy\.js/.exec(build);
  if (!match) {
    throw new Error(
      "package.json's build script no longer names the pre-deploy bundle's source — this reader "
      + "is looking at the wrong shape, and a sweep that cannot find its entrypoint reports a "
      + "clean tree. Re-read it rather than hard-coding the path.",
    );
  }
  return match[1]!;
})();

const RITE = "scripts/deploy-rite.mts";

/** Every local module the deploy path reaches, transitively. */
function deployPathFiles(): string[] {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    let source: string;
    try {
      source = read(file);
    } catch {
      /* A specifier that does not resolve to a file on disk is somebody else's
         finding (the typecheck's); this reader is about awaited closes. */
      seen.delete(file);
      return;
    }
    for (const [, specifier] of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const resolved = path
        .join(path.dirname(file), specifier.replace(/\.mjs$/, ".mts"))
        .split(path.sep)
        .join("/");
      walk(resolved);
    }
  };
  walk(PREDEPLOY_FROM_BUILD);
  walk(RITE);
  return [...seen].sort();
}

/** `await x.end()` / `await x?.end()` — the shape that hung. */
const UNBOUNDED_CLOSE = /await\s+[\w.?]+\??\.end\(\)/;

describe("#1745 · every awaited close on the deploy path is bounded", () => {
  const population = deployPathFiles();

  it("the population is real and holds both entrypoints — a clean answer over nothing is not an answer", () => {
    expect(population.length, "the import walk found almost nothing").toBeGreaterThan(10);
    expect(population).toContain(PREDEPLOY_FROM_BUILD);
    expect(population).toContain(RITE);
    /* And it reached through at least one hop, or it is not a closure. */
    expect(population).toContain("scripts/lib/dbConnection.mts");
  });

  it("the reader itself matches the shape that hung, and not the repair", () => {
    /* Working law 2: a sweep whose predicate has stopped matching reports a
       clean tree forever. Both the real old line and its optional-chained twin. */
    expect(UNBOUNDED_CLOSE.test("    try { await connection?.end(); } catch { }")).toBe(true);
    expect(UNBOUNDED_CLOSE.test("    await connection.end();")).toBe(true);
    expect(UNBOUNDED_CLOSE.test("    await pool.end();")).toBe(true);
    expect(UNBOUNDED_CLOSE.test("    await closeWithin(connection);")).toBe(false);
    /* And the reader it is paired with strips the prose that quotes the shape —
       which is what reddened this arm's siblings on their first run. */
    expect(UNBOUNDED_CLOSE.test(codeOnly([
      "/* this was `await connection?.end();` and it cost a deploy */",
      "const a = 1;",
    ].join("\n")))).toBe(false);
    expect(UNBOUNDED_CLOSE.test(codeOnly([
      "// await pool.end();",
      "const a = 1;",
    ].join("\n")))).toBe(false);
  });

  it("none of them awaits an unbounded close", () => {
    const offenders = population.filter((file) => UNBOUNDED_CLOSE.test(codeOf(file)));

    expect(
      offenders,
      "A deploy-path script awaits a connection or pool close with no clock. A MySQL"
      + " `end()` waits for the server to acknowledge its quit packet, and on a half-dead"
      + " socket that never comes — ten minutes of it failed the deploy of a green build"
      + " on 2026-10-02 (#1745). Route it through `closeWithin` from"
      + " `scripts/lib/boundedClose.mts`:\n"
      + offenders.map((file) => `  ${file}`).join("\n"),
    ).toEqual([]);
  });

  it("⚠ and the remainder is NAMED: this sweep is the deploy path only, not every script", () => {
    /*
      The honest limit, stated rather than left to be assumed. Hundreds of
      scripts under `scripts/` await a close — the benches, the audits, the ~440
      untracked disposables — and NONE of them is on this list, because none can
      fail a deploy: a hung investigation script wastes a shift's minute and
      is killed by hand. The card scoped the sweep to the deploy path for that
      reason, and this arm pins the scope so a later reader does not mistake a
      green run here for a tree-wide claim.
    */
    expect(population.some((file) => file.includes("audit-"))).toBe(false);
    expect(population.some((file) => file.includes("-disposable"))).toBe(false);
    /* Non-deploy scripts DO still carry the shape — measured, so the sentence
       above is a reading and not a belief. */
    expect(UNBOUNDED_CLOSE.test(codeOf("scripts/audit-storage-cleanup.mts"))).toBe(true);
  });
});

describe("#1745 · the pre-deploy command is wired to it (invariant 7)", () => {
  it("its finally bounds the close, and the old shape is gone", () => {
    const source = codeOf(PREDEPLOY_FROM_BUILD);

    expect(source).toContain("closeWithin(connection)");
    /* The exact line that hung, which must not come back in any form. */
    expect(source).not.toMatch(/await\s+connection\?\.end\(\)/);
    /* And `process.exit` is still the last statement — the script-exit guard's
       rule, and the reason the bound matters at all. */
    expect(source.trimEnd().endsWith("process.exit(code);")).toBe(true);
  });

  it("the verdict is decided BEFORE the close, so the bound can never change it", () => {
    const source = codeOf(PREDEPLOY_FROM_BUILD);
    /* If the close moved above the verdict, a destroyed socket would start
       deciding deploys — the one thing this change must not make possible. */
    expect(source.indexOf("const verdict = predeployVerdict(report);"))
      .toBeLessThan(source.indexOf("closeWithin(connection)"));
  });

  it("and it SAYS when it cut a socket, in the log Railway keeps", () => {
    /* A destroyed socket that said nothing is how this class stayed invisible
       until it cost a deploy. */
    expect(codeOf(PREDEPLOY_FROM_BUILD)).toContain("closeLine(");
  });
});

/* ─────────── #2501 · past the close: the exit leaves on its own clock ─────────── */

const WATCHDOG_IMPORT = IMPORT_LINE.replace("{ closeWithin }", "{ armExitWatchdog }");

/**
 * The incident's shape with the cause left open, as the card leaves it: the
 * verdict is decided, then the road to `process.exit` never completes while
 * something keeps the loop alive. A ref'd interval stands in for "something".
 */
const stuckAfterVerdict = (arm: string): string => `
  ${WATCHDOG_IMPORT}
  setInterval(() => {}, 1_000);
  ${arm}
  console.log("verdict printed");
  await new Promise(() => {});
  process.exit(99);
`;

describe("#2501 · armExitWatchdog — the decided code leaves even when the road to the exit does not", () => {
  it("THE INCIDENT: a live loop and an await that never settles still exit with the DECIDED code", () => {
    const began = Date.now();
    const result = driveExit(stuckAfterVerdict("armExitWatchdog(7, { bound: 150 });"));

    expect(result.status, result.stderr).toBe(7);
    /* The silence is now a diagnosis: the line names what held the process. */
    expect(result.stdout).toContain("exiting 7 anyway (#2501)");
    expect(result.stdout).toContain("Timeout");
    expect(Date.now() - began).toBeLessThan(30_000);
  });

  it("the NEGATIVE control: without the watchdog the same child never exits (killed by the driver)", () => {
    /* Working law 2: the arm above proves nothing unless this shape really
       hangs. It must be killed, not exit — a SpawnFailure carries the signal. */
    expect(() => runHook(
      process.execPath,
      ["--import", LOADER, "--input-type=module", "--eval", stuckAfterVerdict("")],
      { cwd: REPO, timeout: 4_000 },
    )).toThrow(/killed by/);
  });

  it("⚠ it NEVER turns a refusal into a success — a decided 1 leaves as 1, a decided 0 as 0", () => {
    expect(driveExit(stuckAfterVerdict("armExitWatchdog(1, { bound: 100 });")).status).toBe(1);
    expect(driveExit(stuckAfterVerdict("armExitWatchdog(0, { bound: 100 });")).status).toBe(0);
  });

  it("⚠ a later decision REPLACES an earlier one — a 0 armed before a refusal can never fire over it", () => {
    const result = driveExit(stuckAfterVerdict("armExitWatchdog(0, { bound: 100 }); armExitWatchdog(1, { bound: 300 });"));
    expect(result.status, result.stderr).toBe(1);
  });

  it("an IDLE loop with an unsettled await exits with the decided code, not node's 13 — the timer is ref'd", () => {
    /* `closeWithin`'s first cut lost the code to 13 by unref'ing its timer; a
       watchdog that did the same would fail this arm the same way. */
    const result = driveExit(`
      ${WATCHDOG_IMPORT}
      armExitWatchdog(7, { bound: 100 });
      await new Promise(() => {});
      process.exit(99);
    `);
    expect(result.status, result.stderr).toBe(7);
  });

  it("the ordinary road is untouched: an armed watchdog never fires on a process that exits on time", () => {
    const began = Date.now();
    const result = driveExit(`
      ${WATCHDOG_IMPORT}
      armExitWatchdog(1, { bound: 20_000 });
      process.exit(0);
    `);
    /* 0 while the watchdog holds 1 — it decides only WHEN, never WHAT, and a
       process that reaches its own exit keeps its own code. */
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain("#2501");
    expect(Date.now() - began).toBeLessThan(15_000);
  });

  it("the bound can never pre-empt the bounded close on a healthy run", async () => {
    const { EXIT_WATCHDOG_MS } = await import("../scripts/lib/boundedClose.mts");
    expect(EXIT_WATCHDOG_MS).toBeGreaterThanOrEqual(CLOSE_BOUND_MS * 3);
    expect(EXIT_WATCHDOG_MS).toBeLessThanOrEqual(60_000);
  });
});

describe("#2501 · the pre-deploy command is wired to it (invariant 7)", () => {
  const source = (): string => codeOf(PREDEPLOY_FROM_BUILD);

  it("arms the watchdog with the verdict's code the moment it is decided — before the lines and the close", () => {
    const s = source();
    const decided = s.indexOf("const verdict = predeployVerdict(report);");
    const armed = s.indexOf("armExitWatchdog(verdict.exitCode);");
    expect(armed, "the verdict road does not arm the watchdog").toBeGreaterThan(decided);
    expect(armed).toBeLessThan(s.indexOf("for (const line of verdict.lines)"));
    expect(armed).toBeLessThan(s.indexOf("closeWithin(connection)"));
  });

  it("the refusal road arms it with 1, as its first statement", () => {
    expect(source()).toMatch(/catch \(error: any\) \{\s*armExitWatchdog\(1\);/);
  });

  it("prints one line immediately before the exit, so a stuck exit is distinguishable from a stuck road", () => {
    /* Raw source: the comment-stripper also blanks template-literal text. */
    expect(read(PREDEPLOY_FROM_BUILD).trimEnd()).toMatch(/console\.log\(`predeploy: exiting \$\{code\}`\);\s*process\.exit\(code\);$/);
  });

  it("THE REAL SCRIPT, driven: a refused connection exits 1, says so, and does it promptly", () => {
    /* The whole entrypoint in a real child, pointed at a port nothing listens
       on — no database is touched. RAILWAY_ENVIRONMENT satisfies the
       off-platform refusal; MYSQL_PUBLIC_URL is cleared so the world check
       cannot open anything else. */
    const began = Date.now();
    const env: NodeJS.ProcessEnv = { ...process.env, RAILWAY_ENVIRONMENT: "test-drive", DATABASE_URL: "mysql://u:p@127.0.0.1:1/none" };
    delete env.MYSQL_PUBLIC_URL;
    delete env.PUBLIC_DATABASE_URL;
    const result = runHook(process.execPath, ["--import", LOADER, PREDEPLOY_FROM_BUILD], { cwd: REPO, env, timeout: 60_000 });

    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("predeploy: REFUSED");
    expect(result.stdout.trimEnd().endsWith("predeploy: exiting 1")).toBe(true);
    expect(result.stdout).not.toContain("u:p@");
    expect(Date.now() - began).toBeLessThan(30_000);
  });
});
