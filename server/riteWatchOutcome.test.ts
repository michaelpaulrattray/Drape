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

import { judgeServedBuild, watchOutcome } from "../scripts/lib/deployWatch.mts";

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
    /* ⚠ THIS READ `if (outcome.kind !== "success") die(outcome.why);` UNTIL
       #2763 SPLIT THE TWO NON-SUCCESS ROADS APART. A terminal non-SUCCESS still
       refuses here; the unsettled road is carried to the receipt instead, and
       its own arms are in the describe below. */
    expect(statement('if (outcome?.kind === "failed") die(outcome.why);')).toBeTruthy();
    expect(statement("judgeServedBuild({")).toBeTruthy();
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

/**
 * #2763 — THE WATCH OUTLIVED THE ANSWER BY ELEVEN MINUTES, AND LOST THE RECEIPT.
 *
 * On 2026-10-28 the rite refused a deploy that had succeeded. Each timestamp was
 * read at an artifact rather than inferred:
 *
 *   · deployment `441a3f3b` created                      17:28:07Z
 *   · production began serving it           17:56:04Z – 17:56:35Z
 *     (`/api/health` every 30s; `uptime` fell 5,569s → 622s, so a new process
 *     and not the old one answering 200 — #296)
 *   · Railway's API recorded SUCCESS                     18:03:50Z
 *   · the watch gave up, reporting DEPLOYING    18:14:26Z – 18:18:08Z
 *
 * The deploy was real and slow (35m43s) and the 50-minute ceiling was never
 * reached, so neither the length nor the window is the finding — #1519 already
 * answered those. **The finding is that Railway's API lags its own service**: at
 * 17:57:30Z, a minute after the edge had cut over, `deployment list` still said
 * `DEPLOYING` with an `updatedAt` of 17:44:07Z.
 *
 * Working law 1 decides which to believe: the service is the artifact, the API
 * is a claim about it. `/api/health` carries the answering process's own
 * `RAILWAY_GIT_COMMIT_SHA`, so a reading of the pushed sha is not an inference
 * about the API's state — it is the thing that state is about.
 *
 * # ⚠ Two cases, and a repair for one does nothing for the other
 *
 * The card's own comment is explicit about this and these arms are written to
 * it. Edition 767's deployment sat `QUEUED` for thirty minutes with
 * `regions: []` — no builder had taken it at all. There the service genuinely is
 * NOT serving the new build and the watch's verdict is RIGHT, so no amount of
 * asking the service helps. What that road needed was the other half: the run
 * writes the post-deploy part of its receipt (the flag comparison, the migration
 * plan, the table and index counts, the static-asset check — every one of them a
 * read of the service, the production database or the bucket) BEFORE refusing.
 */
describe("judgeServedBuild — the service as the second witness", () => {
  const SHIPPED = "606e1df25a1b3c4d5e6f708192a3b4c5d6e7f809";
  const CONTEXT = { shippedSha: SHIPPED, baseUrl: "https://drape-production-0232.up.railway.app" };

  it("⚠ the pushed sha answering IS the deploy landed — the whole card", () => {
    const verdict = judgeServedBuild({
      ...CONTEXT,
      reading: { kind: "answered", build: SHIPPED, uptime: 622 },
    });
    expect(verdict.kind).toBe("landed");
    const said = verdict.lines.join(" ");
    /* It says WHY it outranks the API, in words that make the reasoning
       checkable rather than as an assertion of authority. */
    expect(said).toContain("606e1df2");
    expect(said).toContain("the service is the artifact");
    expect(said).toContain("working law 1");
    /* And the real uptime, as corroboration beside the sha. */
    expect(said).toContain("622.0s");
  });

  it("⚠ a LOW uptime is NOT a condition — a slow rite must not read a live build as stale", () => {
    /*
      The tempting second clause is "…and the uptime is low". It is wrong once
      the sha is readable: uptime answers *which process* only when the build
      cannot be seen, which was the pre-#508 road. A threshold on it would make
      this verdict depend on how long the RITE took to arrive — the slower the
      watch, the likelier it would call a correctly-serving build stale, which is
      backwards for a verdict whose whole population is slow watches.

      5,569s is the uptime the OLD process reported in the real incident, used
      here as the most hostile value available: on the pushed sha it still has to
      read as landed.
    */
    const verdict = judgeServedBuild({
      ...CONTEXT,
      reading: { kind: "answered", build: SHIPPED, uptime: 5569 },
    });
    expect(verdict.kind).toBe("landed");
  });

  it("⚠ ANOTHER sha answering is not landed — the QUEUED case, where the watch is right", () => {
    /* Edition 767: the deployment never started, so the old build is serving and
       refusing is correct. The verdict's job here is only to NAME what is
       serving, so a reader does not have to go and look. */
    const verdict = judgeServedBuild({
      ...CONTEXT,
      reading: { kind: "answered", build: "8ac31864f0a1b2c3d4e5f60718293a4b5c6d7e8f", uptime: 5569 },
    });
    expect(verdict.kind).toBe("not-landed");
    const said = verdict.lines.join(" ");
    expect(said).toContain("8ac31864");
    expect(said).toContain("606e1df2");
    expect(said).toContain("not taking traffic");
  });

  it("silence is not a verdict, and says so in those words", () => {
    /* `productionHealthProbe.mts`'s distinction, and it matters more here: a
       dropped connection says nothing about which build is serving, and reading
       it as "not landed" would be a claim built out of nothing. The refusal
       stands either way — what changes is what the receipt may say. */
    const verdict = judgeServedBuild({ ...CONTEXT, reading: { kind: "silent" } });
    expect(verdict.kind).toBe("not-landed");
    const said = verdict.lines.join(" ");
    expect(said).toContain("said nothing");
    expect(said).toContain("NOTHING is known");
    expect(said).toContain("silence, not a verdict");
  });

  it("a payload with no build at all is not landed either (invariant 7's shape)", () => {
    /* `readingOf` keeps an absent `build` absent rather than stringifying it,
       and a process that cannot say which commit it is cannot prove it is mine —
       the same rule `decideWatch` applies to an unattributed deployment row. */
    const verdict = judgeServedBuild({
      ...CONTEXT,
      reading: { kind: "answered", build: null, uptime: 12 },
    });
    expect(verdict.kind).toBe("not-landed");
    expect(verdict.lines.join(" ")).toContain("names no build");
  });

  it("an unreadable uptime is stated as unread, never printed as a number", () => {
    const verdict = judgeServedBuild({
      ...CONTEXT,
      reading: { kind: "answered", build: SHIPPED, uptime: Number.NaN },
    });
    expect(verdict.kind).toBe("landed");
    expect(verdict.lines.join(" ")).toContain("(unread)");
    expect(verdict.lines.join(" ")).not.toContain("NaN");
  });

  it("a truncated build field still matches, and seven characters is the floor", () => {
    /*
      Both sides are full shas on every road today, so this is tolerance rather
      than something anything relies on. The floor is the point: below git's own
      abbreviation length a prefix match is a coincidence, and a verdict that
      accepted one could call an unrelated build "mine".
    */
    expect(judgeServedBuild({ ...CONTEXT, reading: { kind: "answered", build: "606e1df", uptime: 1 } }).kind)
      .toBe("landed");
    expect(judgeServedBuild({ ...CONTEXT, reading: { kind: "answered", build: "606e1d", uptime: 1 } }).kind)
      .toBe("not-landed");
    /* NEGATIVE CONTROL at the same length — seven characters that are not the
       pushed sha's seven must not match, or the arm above passes on length. */
    expect(judgeServedBuild({ ...CONTEXT, reading: { kind: "answered", build: "8ac3186", uptime: 1 } }).kind)
      .toBe("not-landed");
  });

  it("case does not decide it", () => {
    expect(judgeServedBuild({
      ...CONTEXT,
      reading: { kind: "answered", build: SHIPPED.toUpperCase(), uptime: 1 },
    }).kind).toBe("landed");
  });

  it("⚠ it never answers the HEALTH question, on any road", () => {
    /*
      It asks WHICH build is answering and leaves IS IT WELL to the three
      readings that follow. Folding them together would give the deploy's
      correctness gate two owners, and a `status` this module does not recognise
      would quietly decide a deploy. So no road of this verdict may use the
      vocabulary of health at all.
    */
    const readings = [
      { kind: "answered" as const, build: SHIPPED, uptime: 10 },
      { kind: "answered" as const, build: "8ac31864f0a1b2c3d4e5f60718293a4b5c6d7e8f", uptime: 10 },
      { kind: "answered" as const, build: null, uptime: 10 },
      { kind: "silent" as const },
    ];
    for (const reading of readings) {
      const said = judgeServedBuild({ ...CONTEXT, reading }).lines.join(" ").toLowerCase();
      for (const word of ["healthy", "unhealthy", "503", "latency"]) {
        expect(said, `a ${reading.kind} reading now judges health: "${word}"`).not.toContain(word);
      }
    }
  });
});

describe("#2763 · the unconfirmed road keeps its receipt, and claims nothing", () => {
  const rite = read("scripts/deploy-rite.mts");
  const lines = rite.split(/\r?\n/);
  const statement = (contains: string): string => {
    const found = lines.filter((line) => line.includes(contains) && !line.trim().startsWith("*"));
    expect(found, `no statement contains "${contains}" — this arm is measuring nothing`).toHaveLength(1);
    return found[0]!;
  };

  it("⚠ the watch no longer ENDS the run on the unsettled road", () => {
    /*
      The arm that is the second half of the card. `die()` at the watch threw
      away the flag comparison, the migration plan, the schema counts and the
      asset check — every one of which reads the SERVICE, the production database
      or the bucket, and none of which depends on this push having landed. It is
      the rite's own argument at its foot, one step earlier: *"dying at step 5
      would destroy the receipt and change nothing about production."*
    */
    expect(rite, "the old unconditional refusal is back")
      .not.toContain('if (outcome.kind !== "success") die(outcome.why);');
    expect(statement('if (outcome?.kind === "failed") die(outcome.why);')).toBeTruthy();
    /* And the refusal is CARRIED rather than dropped: a road that printed
       nothing at all would be worse than the die() it replaced. */
    expect(statement("const watchProblems: readonly string[] = served")).toBeTruthy();
  });

  it("⚠ the unconfirmed road is in the exit arithmetic — it can never exit 0", () => {
    const finalExit = rite.slice(rite.lastIndexOf("process.exit("));
    expect(finalExit).toContain("watchProblems.length");
    /* POSITIVE CONTROL — the slice is the exit arithmetic and not a stray
       mention, so the reading above is a reading. */
    expect(finalExit).toContain("positions.mismatches.length");
  });

  it("⚠ health is NOT READ on it, so no old process can pass as the new one (#296)", () => {
    /* Three 200s off the OLD build, with its own uptime anchor, is #296's trap
       written into a receipt as a verification. An unread check is stated as
       unread; it is never inferred. */
    expect(statement("const health = !served ? null : await probeProductionHealth({")).toBeTruthy();
    expect(statement("const healths = health ? health.readings : null;")).toBeTruthy();
  });

  it("⚠ its receipt never prints the word SUCCESS, and says what WAS read", () => {
    /* `deploy SUCCESS · health ×3 — 200` was unconditional, so a run that
       reached the receipt had already said it, whatever it had actually seen. */
    const receipt = rite.slice(rite.indexOf("6. the receipt"));
    expect(receipt.length, "the receipt could not be sliced out — this arm is measuring nothing")
      .toBeGreaterThan(200);
    expect(receipt).toContain("deploy NOT CONFIRMED");
    expect(receipt).toContain("health NOT READ and the tracker NOT PROBED");
    expect(receipt).toContain("*** THE DEPLOY NEVER CONFIRMED ***");
    /* AND THE WITNESS ROAD IS ITS OWN WORD TOO — the API never said SUCCESS
       there either, so neither may the receipt. */
    expect(receipt).toContain("SERVING (Railway's API never settled");
  });

  it("⚠ NO DEPLOYMENT ROW joins the same road — #2763's own law-7 sweep", () => {
    /*
      THE SIBLING THE SWEEP FOUND, and it was not the incident's own road.

      `if (!deployment) die(…)` fired when the watch ran its whole ceiling
      without Railway ever creating a row for the pushed commit. Its sentence
      was already right — *"the push LANDED and no build of it was seen"* — and
      that is the unsettled road's situation word for word: the push is out of
      our hands, so what the rite does next is a question about the RECEIPT and
      not about production. The exit was the defect, not the words.

      So the row-less road asks the service too (the listing may simply have
      been late or unreadable while the build was serving all along) and carries
      its refusal to the receipt when the service agrees with it.
    */
    expect(rite, "the row-less refusal is an early exit again")
      .not.toContain('die(priorDeployment');
    expect(statement("const noDeploymentRow = deployment")).toBeTruthy();
    /* It is in the carried problems, so it still costs the run its exit code —
       a refusal that printed and exited 0 would be worse than the die(). */
    const carried = rite.slice(rite.indexOf("const watchProblems"), rite.indexOf("4. health, THREE TIMES"));
    expect(carried.length, "the carried block could not be sliced out — this arm is measuring nothing")
      .toBeGreaterThan(80);
    expect(carried).toContain("noDeploymentRow ??");
  });

  it("⚠ and it asks the SERVICE on that road too, not only on the unsettled one", () => {
    /* A sweep that moved the exit without moving the witness would leave the
       row-less road refusing while production served the commit — the exact
       false refusal this card is about, one branch over. */
    expect(statement("const servedVerdict = outcome === null || outcome.kind === \"unsettled\"")).toBeTruthy();
  });

  it("⚠ `watchOutcome` keeps its three roads — the row-less case is NOT folded in", () => {
    /*
      That verdict is a pure function of (did the loop settle, what did the last
      ROW say). There is no row here to say anything, so a fourth road would
      make `status` optional on a verdict all three of whose sentences quote it.
      The composition belongs at the call site, and the module's contract is
      asserted here so a later tidy-up cannot quietly widen it.
    */
    const watch = read("scripts/lib/deployWatch.mts");
    const kinds = watch.match(/kind: "(success|failed|unsettled)"/g) ?? [];
    expect(kinds.length, "watchOutcome's roads could not be counted — this arm is measuring nothing")
      .toBeGreaterThan(2);
    expect(watch).not.toContain("status?: string");
  });

  it("⚠ the witness reads the service with a TIMEOUT it clears (#1177, #1517)", () => {
    /* A bare fetch against a host that accepts and never answers measured 306.6
       seconds. This read sits after the push and before the receipt, which is
       the worst place in the script to stall. */
    const block = rite.slice(rite.indexOf("3a. the SECOND WITNESS"), rite.indexOf("4. health, THREE TIMES"));
    expect(block.length, "the witness block could not be sliced out — this arm is measuring nothing")
      .toBeGreaterThan(200);
    expect(block).toContain("fetchWithClearedTimeout(`${BASE}/api/health`, {}, 10_000)");
    /* And it is asked ONCE: this is not a second health probe, and a retry here
       would be a second owner of the question `probeProductionHealth` owns. */
    expect(block.match(/fetchWithClearedTimeout\(/g) ?? []).toHaveLength(1);
  });
});
