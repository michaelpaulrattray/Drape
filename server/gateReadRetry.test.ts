/**
 * THE GATE READ'S RETRY, DRIVEN — `scripts/lib/gateRead.mts` (#1409).
 *
 * The incident is measured, not guessed: twice in one shift
 * (foreman-20260926-2230, on PR #1404) a SINGLE transient network failure
 * killed `gate-stall-check --watch` with an unhandled throw and a Node stack,
 * and both retries succeeded immediately. `--watch` is the one form of waiting
 * a headless shift is allowed to do.
 *
 * ⚠ **THE ARM THAT MATTERS IS THE NEGATIVE ONE**, and it is the whole risk of
 * this change: a classifier that owns a real word would retry a 404 or a 401
 * four times and then report a genuine fault in the wrong vocabulary —
 * *"could not read"* over *"you are not authenticated"*. Swallowing a real
 * fault is the only failure worse than the one being fixed, so the
 * must-still-throw list is driven case by case and the re-throw is asserted to
 * be the ORIGINAL error object rather than something wrapped.
 *
 * ⚠ **AND THE OTHER NEGATIVE CONTROL IS A WHOLE SUITE THIS ONE DOES NOT
 * DUPLICATE.** The script's three answers — RUNNING, COMPLETE and the exit-2
 * stall finding — are decided by `decideStall`, which this change does not
 * touch by a byte, and they are driven by `server/gateStallAlarm.test.ts`.
 * That suite staying green unchanged IS the card's first bar; re-stating its
 * arms here would be a second list agreeing with itself.
 *
 * The loop is driven with `sleep` injected, so the real classifier, the real
 * give-up and the real re-throw run while the eleven seconds do not.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import {
  GateReadUnavailable,
  READ_ATTEMPTS,
  READ_BACKOFF_MS,
  TRANSIENT_PATTERN_NAMES,
  classifyReadFailure,
  failureText,
  readWithRetry,
} from "../scripts/lib/gateRead.mts";

/* The CHILD-PROCESS floor: the last arm spawns `npx tsx` to prove the script
   still starts after the async conversion. Both floors are 30_000 and
   `declaresTheFloor` accepts either, so this one satisfies the tree-sweeping
   class too — and declaring the contended one alone does not, which is what
   the guard said when this suite first ran. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/** The exact bytes of the failure that killed the poll, twice, on PR #1404. */
const THE_INCIDENT = [
  'Get "https://api.github.com/repos/michaelpaulrattray/Drape/actions/workflows/341788731/runs?head_sha=abc":',
  "  dial tcp 4.237.22.34:443: connectex: A connection attempt failed because the connected party",
  "  did not properly respond after a period of time, or established connection failed because",
  "  connected host has failed to respond.",
].join("\n");

const neverSleep = async (): Promise<void> => {};

describe("the classifier — and the negative control is the arm that matters", () => {
  it("reads the measured incident as transient, and says which pattern fired", () => {
    const reading = classifyReadFailure(THE_INCIDENT);
    expect(reading.transient).toBe(true);
    if (!reading.transient) return;
    expect(reading.why).toBe("network");
    expect(reading.matched).toBe("dial tcp");
  });

  it("⚠ NEVER retries a real fault — a guard that owned one of these would lie about it", () => {
    for (const real of [
      "HTTP 404: Not Found (https://api.github.com/repos/x/y/pulls/9999)",
      "HTTP 401: Bad credentials",
      "gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable",
      "You are not logged into any GitHub hosts. To log in, run: gh auth login",
      "HTTP 422: Validation Failed",
      "GraphQL: Could not resolve to a PullRequest with the number of 99999.",
      'unknown command "x" for "gh"',
      "SyntaxError: Unexpected token < in JSON at position 0",
      "no workflow at .github/workflows/gate.yml — the gate has been renamed or removed",
      "HTTP 403: Resource not accessible by integration",
    ]) {
      expect(classifyReadFailure(real), real).toEqual({ transient: false });
    }
  });

  it("reads each transient class, and every named pattern is reachable", () => {
    const fired = new Set<string>();
    for (const text of [
      /* ⚠ EACH CASE ISOLATES ONE PATTERN, and it took this arm going red to
         make them do so. The table returns its FIRST match, so three of these
         originally shadowed the row they were written for and those three
         patterns were untested while the suite was green: `dial tcp 1.2.3.4:
         i/o timeout` never reached `i/o timeout`, THE_INCIDENT never reached
         `connectex`, and a "secondary rate limit … submitted too quickly"
         never reached `submitted too quickly`. A derived arm caught what a
         hand-read list of fourteen would not have. */
      THE_INCIDENT,
      "connectex: An established connection was aborted by the software in your host machine",
      "net/http: i/o timeout",
      "net/http: TLS handshake timeout",
      "connection reset by peer",
      "connection refused",
      "Client.Timeout exceeded while awaiting headers",
      "unexpected EOF",
      "request timed out",
      "read ECONNRESET",
      "HTTP 503: Service Unavailable",
      "502 Bad Gateway",
      "HTTP 403: API rate limit exceeded for user ID 1.",
      "You have exceeded a secondary limit and your request was submitted too quickly",
      "abuse detection mechanism triggered",
    ]) {
      const reading = classifyReadFailure(text);
      expect(reading.transient, text).toBe(true);
      if (reading.transient) fired.add(reading.matched);
    }
    /* Derived both ways: a pattern added with no case here reddens, and a
       case that stops firing takes its pattern's name out of the set. */
    expect([...fired].sort()).toEqual([...TRANSIENT_PATTERN_NAMES].sort());
  });

  it("does not own the English of a 404 — `ENOTFOUND` is an errno, `Not Found` is prose", () => {
    expect(classifyReadFailure("HTTP 404: Not Found")).toEqual({ transient: false });
    expect(classifyReadFailure("getaddrinfo ENOTFOUND api.github.com").transient).toBe(true);
  });

  it("does not read a 4xx as a 5xx", () => {
    for (const code of [400, 401, 403, 404, 409, 422]) {
      expect(classifyReadFailure(`HTTP ${code}: something`), String(code)).toEqual({ transient: false });
    }
    for (const code of [500, 502, 503, 504]) {
      expect(classifyReadFailure(`HTTP ${code}: something`).transient, String(code)).toBe(true);
    }
  });

  it("reads the reason wherever a failed execFileSync put it", () => {
    /* Node puts the command in `message` and what `gh` said in `stderr`, and
       which one carries the reason is not the classifier's business. */
    expect(failureText({ message: "Command failed: gh api x", stderr: THE_INCIDENT })).toContain("connectex");
    expect(failureText({ message: "m", stderr: Buffer.from("dial tcp") })).toContain("dial tcp");
    expect(classifyReadFailure(failureText({ message: "Command failed", stderr: THE_INCIDENT })).transient).toBe(true);
  });
});

describe("the card's positive control — fail twice, then succeed", () => {
  it("survives the poll and returns the REAL answer", async () => {
    let calls = 0;
    const answer = await readWithRetry(
      () => {
        calls += 1;
        if (calls <= 2) throw Object.assign(new Error("Command failed: gh api"), { stderr: THE_INCIDENT });
        return { verdict: "running" as const };
      },
      { sleep: neverSleep },
    );
    expect(calls).toBe(3);
    expect(answer).toEqual({ verdict: "running" });
  });

  it("succeeds first time without sleeping at all", async () => {
    const waits: number[] = [];
    const answer = await readWithRetry(() => "the answer", {
      sleep: async (ms) => void waits.push(ms),
    });
    expect(answer).toBe("the answer");
    expect(waits).toEqual([]);
  });

  it("backs off between attempts, in the declared order", async () => {
    const waits: number[] = [];
    await expect(
      readWithRetry(
        () => {
          throw Object.assign(new Error("boom"), { stderr: THE_INCIDENT });
        },
        { sleep: async (ms) => void waits.push(ms) },
      ),
    ).rejects.toBeInstanceOf(GateReadUnavailable);
    expect(waits).toEqual([...READ_BACKOFF_MS]);
    expect(waits.length).toBe(READ_ATTEMPTS - 1);
  });
});

describe("the card's other positive control — failing forever is a NAMED finding", () => {
  it("never a stack: it is a typed error carrying what a reader needs", async () => {
    let calls = 0;
    const thrown = await readWithRetry(
      () => {
        calls += 1;
        throw Object.assign(new Error("Command failed"), { stderr: THE_INCIDENT });
      },
      { sleep: neverSleep },
    ).catch((error: unknown) => error);

    expect(calls).toBe(READ_ATTEMPTS);
    expect(thrown).toBeInstanceOf(GateReadUnavailable);
    const finding = thrown as GateReadUnavailable;
    expect(finding.message).toBe(`could not read the gate after ${READ_ATTEMPTS} attempts (network)`);
    expect(finding.attempts).toBe(READ_ATTEMPTS);
    expect(finding.why).toBe("network");
    expect(finding.lastText).toContain("connectex");
  });

  it("⚠ re-throws a real fault UNTOUCHED, and on the FIRST attempt", async () => {
    /* Not wrapped and not re-worded: a 401 must reach the caller looking
       exactly like a 401. And exactly one attempt — retrying a real fault
       four times would burn the shared GitHub budget to learn nothing. */
    const original = Object.assign(new Error("Command failed: gh api"), {
      stderr: "HTTP 401: Bad credentials",
    });
    let calls = 0;
    const thrown = await readWithRetry(
      () => {
        calls += 1;
        throw original;
      },
      { sleep: neverSleep },
    ).catch((error: unknown) => error);

    expect(calls).toBe(1);
    expect(thrown).toBe(original);
    expect(thrown).not.toBeInstanceOf(GateReadUnavailable);
  });

  it("tells the caller which attempt it is on, so a watching shift sees progress", async () => {
    const lines: string[] = [];
    await readWithRetry(
      (() => {
        let calls = 0;
        return () => {
          calls += 1;
          if (calls === 1) throw Object.assign(new Error("x"), { stderr: "HTTP 503: Service Unavailable" });
          return "ok";
        };
      })(),
      {
        sleep: neverSleep,
        onRetry: ({ attempt, of, why, matched }) => lines.push(`${attempt}/${of} ${why}:${matched}`),
      },
    );
    expect(lines).toEqual([`1/${READ_ATTEMPTS} server:HTTP 5xx`]);
  });
});

describe("the script is actually wired to it — a module nothing calls is not a fix", () => {
  const script = readListedSource(resolve("scripts/gate-stall-check.mts"));

  it("reads the script", () => {
    expect(script, "scripts/gate-stall-check.mts is unreadable").not.toBeNull();
  });

  it("puts the retry on the `gh` call and the JSON parse OUTSIDE it", () => {
    /* The line between the two classes, asserted at the source rather than
       described in a docblock: a transient failure means `gh` failed; a parse
       failure means `gh` succeeded and returned garbage. Moving the parse
       inside the retry would silently make "malformed still throws" false. */
    expect(script).toContain('import { GateReadUnavailable, READ_ATTEMPTS, readWithRetry } from "./lib/gateRead.mts";');
    expect(script).toMatch(/function gh\(args: string\[\]\): Promise<string> \{\s*\n\s*return readWithRetry\(/);
    expect(script).toMatch(/JSON\.parse\(await gh\(\["api", path\]\)\)/);
  });

  it("gives the unreadable answer its own exit code, and it is not the stall's", () => {
    expect(script).toContain("process.exit(5)");
    expect(script).toContain("COULD NOT READ THE GATE");
    expect(script).toContain("This is NOT a stall");
  });

  it("still has its three original answers and their codes", () => {
    for (const unchanged of [
      'first.verdict.kind === "stall" ? 2 : first.verdict.kind === "unknown-push" ? 3 : 0',
      'if (current.kind === "complete") code = 0;',
      'else if (current.kind === "stall") code = 2;',
    ]) {
      expect(script, unchanged).toContain(unchanged);
    }
  });

  it("the script still starts and prints its help — it is ESM with top-level await now", () => {
    /* The async conversion is the part of this change that could break the
       file for every caller, and no unit arm over a module can see it. */
    const out = execFileSync("npx", ["tsx", resolve("scripts/gate-stall-check.mts"), "--help"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    expect(out).toContain("is the gate still running");
    expect(out).toContain("exit 5 is 'I could not see', exit 2 is 'the gate has stalled'");
  });
});
