/**
 * #1517 — A SCRIPT THAT MAY EXIT THE MOMENT A FETCH RETURNS LEAVES NO HANDLE OPEN.
 *
 * The defect: `die()` in the deploy rite is `process.exit(1)`, and exiting while
 * a libuv handle the fetch left behind is still closing aborts node on Windows
 * (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`), so the process
 * reports **3221226505** instead of 1. The refusal prints first, so an operator
 * sees it — what is lost is the exit CODE, and a crash code invites a retry where
 * a refusal asks for a repair.
 *
 * There are two handles and the arms below hold both, with very different
 * evidence behind them:
 *
 *   1. **THE TIMER — a real defect, really removed.** `AbortSignal.timeout` never
 *      clears its timer when the fetch resolves, so it leaves a pending handle.
 *      #1509 replaced it with a cleared one in `crew-upload-eye-frame.mts` and
 *      left the rite on the terser form because *"the rite keeps running
 *      afterwards"* — **false**: the rite exits on the statement after its judge
 *      and after its health probe. Both are on `fetchWithClearedTimeout` now.
 *   2. **THE SOCKETS — insurance, and the arms say so.** A socket handle cannot
 *      be cleared, only waited out. #1517 could not reproduce the crash in the
 *      rite's own shape — **12 runs, the real bucket answering 404 and an
 *      unresolvable host, with and without the drain, using the rite's verbatim
 *      fetch policy, every one exited 1** — because #1509's reproduction is
 *      `storagePut` + the judge and the rite calls no `storagePut`. So the drain
 *      sits on the REFUSAL road only, never the happy road, and an arm below
 *      holds it there.
 *
 * # ⚠ Why these arms are STRUCTURAL rather than a driven child process
 *
 * Decided by measurement, not preference. **The crash is a Windows libuv
 * assertion** (`src\win\async.c`) and the gate runs on Linux, where it cannot
 * happen at all — so an arm spawning a child and asserting `exit === 1` would
 * pass whether the repair were present or absent. An arm that cannot fail is
 * exactly what working law 2 forbids shipping. The live behaviour is a hand
 * measurement on a Windows desk, recorded on the card; what CI can honestly hold
 * is that the repair is still in the road. Every arm here was shown to redden
 * under `scripts/_1517-sabotage-disposable.mts`.
 *
 * # ⚠ Why `die()` is NOT async, which is the design question the card carried
 *
 * Measured with `tsc --strict` before anything was written: a `die` returning
 * `Promise<never>` and awaited **does not narrow** — `if (!t) await die(…)` then
 * `t.status` is `TS18047: 't' is possibly 'null'`, while the synchronous `never`
 * form compiles. The rite depends on that narrowing (`if (!deployment) die(…)`
 * then `deployment.status`), so making the one script that reaches production
 * async-die would have broken its typecheck at 18 call sites to repair an error
 * path.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { listenOnFetchablePort, portOf } from "./testing/fetchablePort";
import ts from "typescript";

import { readListedSource } from "./testing/listedSource";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import {
  SOCKET_SETTLE_MS,
  fetchWithClearedTimeout,
  settleSockets,
} from "../scripts/lib/exitSafeFetch.mts";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPTS_ROOT = path.join(ROOT, "scripts");
const read = (relative: string): string => {
  const source = readListedSource(path.resolve(ROOT, relative));
  /* A NAMED subject must be there. This is the floor that stops a blind reader
     from turning every arm below green (#223's stated limit, read the right way:
     the tolerance is for a file a LISTING named, never for one an arm names). */
  if (source === null) throw new Error(`${relative} is not in the tree`);
  return source;
};

const RITE = "scripts/deploy-rite.mts";
const UPLOADER = "scripts/crew-upload-eye-frame.mts";
const CHECKER = "scripts/check-eye-frames.mts";
const OWNER = "scripts/lib/exitSafeFetch.mts";
/*
  ⚠ THE CHECKER IS ON THIS LIST BECAUSE THE DERIVED SWEEP BELOW FOUND IT, NOT
  BECAUSE ANYBODY READ FOR IT. #1517 names two scripts; the gate's own eye-frame
  checker is the third member of the class and had its own independent copy of the
  250 and its own measurement table. That is the sweep earning its place over a
  hand-written list (working law 7's sweep, and working law 4's reason for it).
*/
const CALLERS = [RITE, UPLOADER, CHECKER];

/* ────────────────────────────────────────────────────────────────────────────
   THE DETECTOR, BY PARSE RATHER THAN BY MATCH.

   ⚠ The first cut of this was `source.includes("AbortSignal.timeout")` and it
   FAILED on the repaired tree — because the repair's own comments name the thing
   they replaced. That is the `negation-contains-the-token` class: a guard reading
   its own documentation as a breach. Worse, the same naivety in the other
   direction would let a comment satisfy an arm. A call expression is what is
   being claimed about, so a call expression is what is read.
   ──────────────────────────────────────────────────────────────────────────── */
type Site = { callee: string; line: number };

function callSites(text: string, wanted: string[], fileName: string = "probe.mts"): Site[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, true);
  const sites: Site[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (wanted.includes(callee)) {
        sites.push({ callee, line: source.getLineAndCharacterOfPosition(node.pos).line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites;
}

const armsAnUnclearedTimer = (text: string, fileName?: string): Site[] =>
  callSites(text, ["AbortSignal.timeout"], fileName);
const exitsPromptly = (text: string, fileName?: string): Site[] =>
  callSites(text, ["process.exit"], fileName);

function scriptFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      /* The list-side twin of #223: a listed entry can be gone before it is even
         classified, so the stat is allowed to come back empty. */
      const stat = statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith(".ts") || entry.endsWith(".mts")) found.push(full);
    }
  };
  walk(SCRIPTS_ROOT);
  return found.sort();
}

describe("the detector can tell a call from a mention", () => {
  it("POSITIVE — finds a real AbortSignal.timeout call", () => {
    const sites = armsAnUnclearedTimer(
      `const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });`,
    );
    expect(sites).toHaveLength(1);
    expect(sites[0]?.callee).toBe("AbortSignal.timeout");
  });

  it("NEGATIVE — a comment naming it is not a call", () => {
    /*
      THE CONTROL THAT MATTERS, because this exact confusion made the first
      version of the sweep red on a correctly repaired tree.
    */
    expect(
      armsAnUnclearedTimer("/* replaced AbortSignal.timeout(10_000) with a cleared timer */"),
    ).toHaveLength(0);
    expect(armsAnUnclearedTimer("// prefer this over `AbortSignal.timeout`")).toHaveLength(0);
    expect(armsAnUnclearedTimer(`const s = "AbortSignal.timeout(1)";`)).toHaveLength(0);
  });

  it("NEGATIVE — a cleared controller is not a finding", () => {
    expect(
      armsAnUnclearedTimer(
        `const c = new AbortController(); const t = setTimeout(() => c.abort(), 10); clearTimeout(t);`,
      ),
    ).toHaveLength(0);
  });
});

describe("no script arms a timer it never clears AND then exits", () => {
  it("the class is swept over the whole scripts tree, derived", () => {
    /*
      DERIVED, NOT A LIST OF TWO (working law 4). The hazard needs both halves —
      an uncleared timer handle and a prompt `process.exit` — so the population is
      every script under `scripts/` that has both, computed here rather than
      transcribed. A third script written next month is caught by this arm and not
      by anyone remembering.

      ⚠ It is a FLOOR and not coverage, and the bound is named: it reads
      `AbortSignal.timeout` only. A hand-rolled `setTimeout` whose handle is never
      cleared is the same hazard and this does not see it — that shape has not been
      observed here, and inventing a detector for a population nobody has measured
      is not what this repository does.
    */
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of scriptFiles()) {
      const source = readListedSource(file);
      if (source === null) continue; /* gone since the walk listed it → skip (#223) */
      scanned += 1;
      const timers = armsAnUnclearedTimer(source, path.basename(file));
      if (timers.length === 0) continue;
      const exits = exitsPromptly(source, path.basename(file));
      if (exits.length === 0) continue;
      offenders.push(
        `${path.relative(ROOT, file)} — AbortSignal.timeout at line(s) ` +
          `${timers.map((s) => s.line).join(", ")}, process.exit at line(s) ` +
          `${exits.map((s) => s.line).join(", ")}`,
      );
    }
    /* THE POPULATION FLOOR. A walk that found nothing is indistinguishable from a
       clean tree, which is how a reader goes quiet (invariant 7). */
    expect(scanned).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });

  it("both repaired callers go through the shared owner", () => {
    for (const file of CALLERS) {
      expect(read(file), `${file} does not import the owner`).toContain(
        'from "./lib/exitSafeFetch.mts"',
      );
      expect(read(file), `${file} does not use the cleared-timer fetch`).toContain(
        "fetchWithClearedTimeout(",
      );
    }
  });
});

describe("fetchWithClearedTimeout", () => {
  it("POSITIVE — returns the answer and leaves no timer pending", async () => {
    /*
      Driven against a real local server rather than a mock, because the claim is
      about a libuv handle and a mock has none. The proof the timer was cleared is
      that the process is not still holding it.
    */
    const { createServer } = await import("node:http");
    const server = createServer((_request, response) => {
      response.statusCode = 204;
      response.end();
    });
    /* Through the helper, never `listen(0)` directly: `fetch` refuses the Fetch
       standard's bad ports, and the OS can hand one back (server/testing/fetchablePort). */
    await listenOnFetchablePort((port) => server.listen(port, "127.0.0.1"));
    const port = portOf(server);

    try {
      const before = process.getActiveResourcesInfo().filter((k) => k === "Timeout").length;
      const response = await fetchWithClearedTimeout(
        `http://127.0.0.1:${port}/`,
        { method: "HEAD" },
        10_000,
      );
      expect(response.status).toBe(204);
      const after = process.getActiveResourcesInfo().filter((k) => k === "Timeout").length;
      /* THE ARM: the 10s timer is gone the moment the fetch resolved. With
         `AbortSignal.timeout` it would still be pending for ten seconds. */
      expect(after).toBeLessThanOrEqual(before);
    } finally {
      await new Promise<void>((done) => server.close(() => done()));
    }
  });

  it("POSITIVE — aborts on the timeout road, and the finally still runs there", async () => {
    /* A server that accepts and never answers is the #1177 case the timeout
       exists for; the clear must happen on the rejection road too. */
    const { createServer } = await import("node:http");
    const server = createServer(() => {
      /* deliberately never responds */
    });
    /* Through the helper, never `listen(0)` directly: `fetch` refuses the Fetch
       standard's bad ports, and the OS can hand one back (server/testing/fetchablePort). */
    await listenOnFetchablePort((port) => server.listen(port, "127.0.0.1"));
    const port = portOf(server);

    try {
      const began = Date.now();
      await expect(
        fetchWithClearedTimeout(`http://127.0.0.1:${port}/`, { method: "HEAD" }, 50),
      ).rejects.toThrow();
      /* It aborted on ITS OWN timeout rather than on undici's 300s default — the
         thing #1177 is about. */
      expect(Date.now() - began).toBeLessThan(10_000);
    } finally {
      await new Promise<void>((done) => server.close(() => done()));
    }
  });
});

describe("settleSockets", () => {
  it("waits, and the duration is the one the owner declares", async () => {
    /* A positive control on the helper itself: a helper that resolved immediately
       would satisfy every structural arm while fixing nothing. */
    const began = Date.now();
    await settleSockets("a test");
    /* Timer slop is real and `setTimeout` can fire a millisecond early on
       Windows, so the floor allows for it rather than pinning the figure. */
    expect(Date.now() - began).toBeGreaterThanOrEqual(SOCKET_SETTLE_MS - 5);
  });

  it("the drain is above the measured floor — 50ms was clean, 1ms was not", () => {
    /* #1509 measured `setTimeout(0)` and `setTimeout(1)` crashing 3/3 and 50ms
       clean. The owner may raise this on new evidence and may not quietly drop it
       to a value the measurements already rejected. */
    expect(SOCKET_SETTLE_MS).toBeGreaterThanOrEqual(50);
  });

  it("only the owner carries the number, and it clears its timer", () => {
    /* #1509 shipped the drain as an inline `setTimeout(…, 250)` and the controller
       written out at the call site. Two copies of a measured constant on two error
       paths nobody exercises is working law 4, and the copy that drifts is the one
       nobody runs. */
    for (const file of CALLERS) {
      expect(read(file), `${file} carries its own copy of the drain`).not.toMatch(
        /setTimeout\([^)]*,\s*250\s*\)/,
      );
      expect(read(file), `${file} hand-rolls an AbortController`).not.toContain(
        "new AbortController()",
      );
    }
    expect(read(OWNER)).toContain("SOCKET_SETTLE_MS = 250");
    expect(read(OWNER)).toContain("clearTimeout(timer)");
  });
});

describe("the rite drains on the refusal road, and only there", () => {
  it("the eye-frame refusal settles before it exits", () => {
    const rite = read(RITE);
    const branch = rite.indexOf("if (!frames.ok && !DRY) {");
    const settle = rite.indexOf("await settleSockets(", branch);
    const exit = rite.indexOf(
      "an eye frame this edition names is not in the production bucket",
      branch,
    );
    expect(branch).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(-1);
    expect(exit).toBeGreaterThan(-1);
    /* ORDER IS THE WHOLE ARM: inside the branch, before the `die`. */
    expect(settle).toBeGreaterThan(branch);
    expect(settle).toBeLessThan(exit);
  });

  it("the health refusal settles before it exits", () => {
    const rite = read(RITE);
    const branch = rite.indexOf("if (!health.ok) {");
    const settle = rite.indexOf("await settleSockets(", branch);
    const exit = rite.indexOf("die(health.why);", branch);
    expect(branch).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(-1);
    expect(exit).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(branch);
    expect(settle).toBeLessThan(exit);
  });

  it("every drain is inside a refusal, never on the happy road", () => {
    /*
      DERIVED FROM THE FILE, AND BY PARSE RATHER THAN BY INDENTATION. The drain is
      insurance on an unreproduced race, so a run that is going to SUCCEED must not
      pay for it — and nobody would notice 250ms in a rite that watches a Railway
      build for half an hour, which is exactly why this needs an arm rather than
      good intentions.

      ⚠ THE FIRST VERSION OF THIS ARM USED LEADING WHITESPACE AS THE TEST AND THE
      SABOTAGE DRIVER WALKED STRAIGHT THROUGH IT (case 1). Indentation cannot
      answer this question in this file: the whole eye-frame check lives inside a
      bare `{ … }` block, so a statement on the happy road there is already
      indented exactly as far as one inside the refusal. What is actually being
      claimed is that the call sits inside a CONDITIONAL, so that is what is read —
      by walking up the AST from each call to look for an enclosing `if`.
    */
    const source = ts.createSourceFile(
      "deploy-rite.mts",
      read(RITE),
      ts.ScriptTarget.ESNext,
      true,
    );
    const drains: { line: number; guarded: boolean }[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "settleSockets") {
        let parent: ts.Node | undefined = node.parent;
        let guarded = false;
        while (parent) {
          if (ts.isIfStatement(parent)) {
            guarded = true;
            break;
          }
          parent = parent.parent;
        }
        drains.push({
          line: source.getLineAndCharacterOfPosition(node.pos).line + 1,
          guarded,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    /* The population floor: an arm that found no drains would pass vacuously. */
    expect(drains.length).toBeGreaterThanOrEqual(2);
    expect(
      drains.filter((d) => !d.guarded).map((d) => `line ${d.line}`),
      "a drain sits on the happy road",
    ).toEqual([]);
  });
});

describe("die() stays synchronous, and the reason is recorded", () => {
  it("the rite's die is a sync never — an async one loses narrowing", () => {
    const rite = read(RITE);
    expect(rite).toContain("const die: (why: string) => never = (why: string): never => {");
    expect(rite).not.toContain("=> Promise<never>");
    /* The narrowing this protects is really relied upon, so the arm fails if
       somebody adds a non-null assertion and quietly makes the sync form
       unnecessary — at which point this arm should be re-argued, not deleted. */
    expect(rite).toContain("if (!deployment) {");
    expect(rite).toContain("deployment.status");
  });
});
