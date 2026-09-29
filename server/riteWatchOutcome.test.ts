/**
 * #1519 — "THE DEPLOY ENDED DEPLOYING" WAS A SENTENCE ABOUT SOMETHING THAT HAD
 * NOT HAPPENED.
 *
 * On 2026-09-30 the deploy rite printed `the deploy ended DEPLOYING` and exited 1
 * after 2,147s. **The deploy had not ended — the WATCH had.** Eight minutes later
 * it succeeded on its own: production went from uptime 2,566s on the previous
 * build to `04f234d0` at uptime 226s, the reset that distinguishes a new process
 * from an old one answering 200.
 *
 * The watch loop remembers a `running` row so the receipt can name the
 * deployment, and the only check after the loop was
 * `if (deployment.status !== "SUCCESS") die(…)` — so a live deploy and a dead one
 * reached the same refusal, with a sentence that is false in the direction that
 * invites the wrong act. *"The deploy ended DEPLOYING"* reads as *it is over and
 * it did not succeed*, so a shift either re-runs the rite on a push that already
 * landed, or reports the deploy as failed: working law 1 inverted, a tool
 * manufacturing a claim the artifact contradicts.
 *
 * # Why the verdict moved into a module to be tested
 *
 * It was inline in a loop that drives the Railway CLI, so nothing could drive it
 * — the same hole `productionHealthProbe.mts` was split out of, whose own comment
 * says it: *"Nothing drove this loop either, so a retry written in place would
 * have been a change to the deploy's own gate with no arm that could fail."*
 * `watchOutcome` is a pure function of (did the loop settle, what did the last row
 * say), so every road including its sentences is drivable here.
 *
 * # ⚠ The window is the SMALLER question, and it is answered with a measurement
 *
 * #1519 is explicit that moving the number is not the fix and that any move must
 * rest on real durations rather than a doubling. Two readings were taken:
 *
 *   · the rite's own receipts, **868 SUCCESS deploys** — p50 108s, p99 239s,
 *     max 1,823s. Only TWO ever exceeded 15 minutes.
 *   · Railway's GitHub Deployment statuses for 2026-09-29, which include the
 *     merge-burst deploys the rite never watches — **max 2,478s (41.3 min)**.
 *
 * So the tail is 41 minutes and it appears under CONTENTION; quiet-period deploys
 * are 90–126s. **This also corrects #1519's own framing**, which says the service
 * is "sitting on" the boundary with one push in three on the wrong side: true of
 * that burst, and not of 868 deploys.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { watchOutcome } from "../scripts/lib/deployWatch.mts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (relative: string): string => readFileSync(resolve(ROOT, relative), "utf8");

const CONTEXT = {
  elapsedSeconds: 2147,
  ceilingSeconds: 3000,
  shortSha: "04f234d0",
  ref: "main",
  service: "Drape",
  baseUrl: "https://drape-production-0232.up.railway.app",
};

describe("watchOutcome", () => {
  it("terminal SUCCESS is a success and says nothing", () => {
    const outcome = watchOutcome({ ...CONTEXT, settled: true, status: "SUCCESS" });
    expect(outcome.kind).toBe("success");
  });

  it("terminal FAILED is a failure, and STILL says the deploy ended", () => {
    /*
      The old sentence was not wrong — it was wrong about ONE case. When the deploy
      really did end, "the deploy ended FAILED" is exactly right and is kept, so
      this change narrows a claim rather than removing one.
    */
    const outcome = watchOutcome({ ...CONTEXT, settled: true, status: "FAILED" });
    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.why).toBe("the deploy ended FAILED");
  });

  for (const status of ["CRASHED", "REMOVED"]) {
    it(`terminal ${status} is a failure too`, () => {
      const outcome = watchOutcome({ ...CONTEXT, settled: true, status });
      expect(outcome.kind).toBe("failed");
    });
  }

  it("⚠ NOT settled is its own outcome — the defect this card is about", () => {
    const outcome = watchOutcome({ ...CONTEXT, settled: false, status: "DEPLOYING" });
    expect(outcome.kind).toBe("unsettled");
  });

  it("⚠ and it never says the deploy ENDED, whatever the status was", () => {
    /*
      THE ARM THAT IS THE WHOLE CARD. No window is long enough to make "the deploy
      ended" true of a deploy that is still running, so the unsettled road may not
      contain the phrase at all.
    */
    for (const status of ["DEPLOYING", "BUILDING", "INITIALIZING", "WAITING"]) {
      const outcome = watchOutcome({ ...CONTEXT, settled: false, status });
      expect(outcome.kind).toBe("unsettled");
      const why = outcome.kind === "unsettled" ? outcome.why : "";
      expect(why, `"${status}" still claims the deploy ended`).not.toContain("the deploy ended");
      /* And it says what DID happen, in those words. */
      expect(why).toContain("the WATCH gave up");
      expect(why).toContain("did NOT end");
      expect(why).toContain(status);
    }
  });

  it("it tells the reader the push was fine — the wasted act it prevents", () => {
    /*
      A shift reading the false sentence reasonably re-runs the rite, which is
      wasted work on a push that already landed. So the message says so in those
      terms rather than leaving it to be inferred.
    */
    const outcome = watchOutcome({ ...CONTEXT, settled: false, status: "DEPLOYING" });
    const why = outcome.kind === "unsettled" ? outcome.why : "";
    expect(why).toContain("The push LANDED");
    expect(why).toContain("nothing needs re-pushing");
    expect(why).toContain("re-running");
    expect(why).toContain("not a retry");
  });

  it("it names what to READ, including the uptime anchor that settles it", () => {
    /*
      The #296 trap: `/api/health` returns 200 from the OLD process, so "health
      green" does not mean shipped. The uptime reset is the reading that tells them
      apart, and a message that sends a reader to a health check without saying so
      sends them to the trap.
    */
    const outcome = watchOutcome({ ...CONTEXT, settled: false, status: "DEPLOYING" });
    const why = outcome.kind === "unsettled" ? outcome.why : "";
    expect(why).toContain("railway deployment list --service Drape");
    expect(why).toContain("/api/health");
    expect(why).toContain("uptime");
    expect(why).toContain("#296");
    expect(why).toContain("04f234d0");
  });

  it("it quotes its own ceiling, in minutes, from the value it was given", () => {
    /* A message that hard-coded the window would go stale the first time the
       window moved — which is the class this card's sibling (#1518) is about. */
    const outcome = watchOutcome({ ...CONTEXT, settled: false, status: "DEPLOYING", ceilingSeconds: 3000 });
    expect(outcome.kind === "unsettled" && outcome.why).toContain("ceiling is 50 minutes");
    const other = watchOutcome({ ...CONTEXT, settled: false, status: "DEPLOYING", ceilingSeconds: 1800 });
    expect(other.kind === "unsettled" && other.why).toContain("ceiling is 30 minutes");
  });
});

describe("the rite's watch is a deadline, and it is wide enough", () => {
  const rite = read("scripts/deploy-rite.mts");
  const lines = rite.split(/\r?\n/);

  /**
   * The one line that carries a given construct, so an arm reads a STATEMENT
   * rather than a 1,400-line file.
   *
   * ⚠ THIS IS THE THIRD TIME ON THIS SHIFT THAT A WHOLE-FILE SUBSTRING ARM READ
   * PROSE INSTEAD OF CODE, and the first two were caught by sabotage. A
   * comment-stripper was tried here and could not do it: this repository's block
   * comments are `/*` followed by plain indented text with no leading `*`, so a
   * line-prefix filter leaves the body of every comment in. Reading the statement
   * is both simpler and exact — and it fails LOUDLY if the statement is renamed,
   * rather than passing over a file it could no longer find anything in.
   */
  const statement = (contains: string): string => {
    const found = lines.filter((line) => line.includes(contains) && !line.trim().startsWith("*"));
    expect(found, `no statement contains "${contains}" — this arm is measuring nothing`).toHaveLength(1);
    return found[0]!;
  };
  /** Every line that prints, which is where a stale elapsed figure would hide. */
  const sayLines = lines.filter((line) => /^\s*(if \(.*\) )?say\(/.test(line));

  it("⚠ the loop is bounded by TIME, not by a count of attempts", () => {
    /*
      It was `for (attempt < 90)` with `wait(20_000)` — 1,800s of sleeping plus 90
      CLI calls at ~3–4s each, so the window it actually gave was ~2,070–2,160s
      while every document called it a 30-minute watch. The rite's own refusal
      measured 2,147s. A window that is an emergent product of a sleep and a CLI's
      latency cannot be stated truthfully.
    */
    const loop = statement("for (let attempt = 0;");
    expect(loop).toContain("Date.now() - started < WATCH_CEILING_MS");
    expect(loop, "the attempt-count bound is back").not.toContain("attempt < 90");
  });

  it("the ceiling clears the slowest deploy measured, with headroom", () => {
    const m = /const WATCH_CEILING_MS = (\d+) \* 60 \* 1000;/.exec(statement("const WATCH_CEILING_MS"));
    expect(m, "the rite declares no WATCH_CEILING_MS in minutes").not.toBeNull();
    const minutes = Number(m![1]!);
    /* 41.3 minutes is the slowest SUCCESSFUL deploy measured (466cf03e /
       04f234d0, 2026-09-29, at Railway's GitHub Deployment statuses). A ceiling at
       or below it reproduces the wait that produced this card. */
    expect(minutes).toBeGreaterThan(41.3);
  });

  it("the waiting lines READ the clock rather than multiplying attempts", () => {
    /* `attempt * 20` was the same arithmetic fiction as the window: it ignored
       every second the CLI spent, so a line claiming 100s printed at ~118s.
       Checked on the lines that PRINT, which is where the figure would hide. */
    expect(sayLines.length, "no say() lines found — this arm is measuring nothing").toBeGreaterThan(5);
    for (const line of sayLines) {
      expect(line, `a printed line still multiplies attempts: ${line.trim()}`).not.toContain(
        "attempt * 20",
      );
    }
  });

  it("⚠ the rite CALLS the verdict rather than keeping its own copy (invariant 7)", () => {
    /* A verdict extracted for testability that the caller does not call is the
       shape this repository has been bitten by most. */
    expect(statement("watchOutcome({")).toContain("watchOutcome({");
    expect(statement("settled: watchSettled")).toContain("settled: watchSettled");
    expect(statement('if (outcome.kind !== "success") die(outcome.why);')).toBeTruthy();
    /* And the sentence is not ALSO written out at the call site, or the two would
       drift and the tested one would be the copy nobody reads. */
    const written = lines.filter((line) => line.includes("die(`the deploy ended"));
    expect(written, "the rite writes its own refusal sentence again").toEqual([]);
  });

  it("the loop records whether it BROKE on a terminal state", () => {
    /* The flag cannot be derived from the status after the fact: a status this
       module does not know is non-terminal by `TERMINAL`'s reckoning, and only the
       loop knows which exit it took. */
    expect(statement("let watchSettled = false;")).toBeTruthy();
    expect(statement("watchSettled = true;")).toBeTruthy();
  });
});
