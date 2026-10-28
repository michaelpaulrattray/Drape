/**
 * THE READER `deploy-verify` NEVER HAD (#2748).
 *
 * `deploy-verify` went red on `72d56cc0` in 132 seconds and nothing read it;
 * for 52 minutes the record said a merged, green, reviewed change was live and
 * it was not. The repair is a reader that asks one question — is the commit on
 * `main` the commit production is serving? — and files one card when it is not.
 *
 * ⚠ **THE ARMS THAT MATTER MOST ARE THE NEGATIVE ONES, AND ONE OF THEM IS A
 * MEASURED SPECIMEN RATHER THAN AN INVENTED CASE.** A detector that cried wolf
 * on every slow deploy is #1518, which this repository has already paid for
 * once; and the GitHub Deployment for `709536f4` carries `failure` as its
 * NEWEST status while production was serving that very commit, so a reader
 * built on Railway's own state would have called a healthy, current production
 * broken. Both are driven below as controls, not as reasoning.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  deploymentPhrase,
  judgeProductionCurrency,
  productionCurrencyCardTitle,
  productionCurrencyExitCode,
  productionCurrencySentence,
  readProductionCurrency,
  relationPhrase,
  shortSha,
  SHIPPING_GRACE_MINUTES,
  type DeploymentReading,
  type HealthReading,
} from "../scripts/lib/productionCurrency.mts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (relative: string): string => readFileSync(resolve(ROOT, relative), "utf8");

/* The real shas of the morning this card is about, so the arms are a replay. */
const TIP = "8addd6353fb6c7cda949e0fc53179459ad2d2fdc";
const LIVE = "709536f44e17e860ee869c6bd0974ca59189a5e4";
const OLDER = "078922411a4ce85dc4469e02c70ccdc03694ff37";

const NOW = Date.parse("2026-10-28T08:55:00Z");
const minutesAgo = (minutes: number): number => NOW - minutes * 60_000;

const served = (build: string, status = "healthy"): HealthReading =>
  ({ kind: "served", build, status });
const building = (minutes: number, state = "in_progress"): DeploymentReading =>
  ({ kind: "state", state, sinceMs: minutesAgo(minutes) });

const judge = (over: {
  tipSha?: string | null;
  health?: HealthReading;
  deployment?: DeploymentReading;
  relation?: Parameters<typeof judgeProductionCurrency>[0]["relation"];
  graceMinutes?: number;
}) => judgeProductionCurrency({
  nowMs: NOW,
  tipSha: over.tipSha === undefined ? TIP : over.tipSha,
  health: over.health ?? served(TIP),
  deployment: over.deployment ?? { kind: "state", state: "success", sinceMs: minutesAgo(3) },
  ...(over.relation === undefined ? {} : { relation: over.relation }),
  ...(over.graceMinutes === undefined ? {} : { graceMinutes: over.graceMinutes }),
});

describe("judgeProductionCurrency — the sha decides, and only the sha", () => {
  it("says nothing when production serves the tip of main", () => {
    const verdict = judge({ health: served(TIP) });
    expect(verdict.kind).toBe("current");
    expect(productionCurrencyExitCode(verdict)).toBe(0);
    expect(productionCurrencyCardTitle(verdict)).toBeNull();
  });

  /*
    ⚠ THE MEASURED CONTROL, AND THE REASON THIS READER ASKS OUR OWN SERVICE.
    Read at the GitHub Deployment statuses on 2026-10-28 08:55Z: the record for
    `709536f4` carries `failure` at 08:10:29Z as its newest status — six
    `failure`s and not one `success` across the three commits of that morning —
    and `709536f4` is what production was serving. A reader built on Railway's
    state, or on `deploy-verify`'s conclusion, files a card about a healthy and
    current production. This one cannot.
  */
  it("⚠ CONTROL — a Railway `failure` on the commit production IS serving is not a finding", () => {
    const verdict = judge({
      tipSha: LIVE,
      health: served(LIVE),
      deployment: { kind: "state", state: "failure", sinceMs: minutesAgo(45) },
    });
    expect(verdict.kind).toBe("current");
    expect(productionCurrencyExitCode(verdict)).toBe(0);
  });

  it("⚠ CONTROL — an unhealthy production serving the RIGHT commit is still not this finding", () => {
    const verdict = judge({ health: served(TIP, "degraded") });
    expect(verdict.kind).toBe("current");
    /* It says so rather than guessing: a sick production is a real problem and
       a different card, and calling it `behind` would be simply false. */
    expect(productionCurrencySentence(verdict)).toContain("NOT this reader's question");
    expect(productionCurrencyExitCode(verdict)).toBe(0);
  });
});

describe("telling a failed build from a slow one — #1518's lesson, driven", () => {
  /*
    ⚠ THE WOLF-GUARD. #1518: a flat 15-minute window went red on builds that
    took 41, two false reds confirmed at the statuses. A detector that fires on
    every slow deploy is how a real red comes to be ignored — which is this
    card's own subject arriving by the opposite road.
  */
  it("⚠ CONTROL — behind, with Railway saying that commit is still building, files nothing", () => {
    const verdict = judge({ health: served(LIVE), deployment: building(5) });
    expect(verdict.kind).toBe("shipping");
    expect(productionCurrencyExitCode(verdict)).toBe(0);
    expect(productionCurrencyCardTitle(verdict)).toBeNull();
  });

  it("⚠ CONTROL — a build still running at 41 minutes, the slowest on record, files nothing", () => {
    expect(SHIPPING_GRACE_MINUTES).toBeGreaterThan(41.3);
    expect(judge({ health: served(LIVE), deployment: building(41.3) }).kind).toBe("shipping");
  });

  /*
    AND THE HOLE THE GRACE CLOSES: a build that hangs in `in_progress` and never
    posts a terminal status would otherwise be excused forever, which is this
    card's defect wearing a tidier state name.
  */
  it("stops excusing a build that has claimed to be building past the grace", () => {
    const verdict = judge({ health: served(LIVE), deployment: building(SHIPPING_GRACE_MINUTES + 1) });
    expect(verdict.kind).toBe("behind");
    expect(productionCurrencyExitCode(verdict)).toBe(2);
  });

  it("holds its tongue right up to the grace and speaks just past it", () => {
    const at = (minutes: number) =>
      judge({ health: served(LIVE), deployment: building(minutes), graceMinutes: 60 }).kind;
    expect(at(59.9)).toBe("shipping");
    expect(at(60)).toBe("behind");
  });

  /*
    ⚠ CONTROL — CLOCK SKEW BUYS SILENCE NOWHERE, and the direction is the whole
    point. `judgeTeamSilence` clamps a future-dated commit to zero, because
    there skew would otherwise manufacture HEALTH. Clamping here would hand an
    infinite grace to any clock running ahead of ours, so an unusable age
    excuses nothing instead.
  */
  it("⚠ CONTROL — a future-dated `in_progress` earns no grace at all", () => {
    const verdict = judge({
      health: served(LIVE),
      deployment: { kind: "state", state: "in_progress", sinceMs: NOW + 48 * 3_600_000 },
    });
    expect(verdict.kind).toBe("behind");
  });

  it("⚠ CONTROL — an `in_progress` with no readable timestamp earns no grace either", () => {
    const verdict = judge({
      health: served(LIVE),
      deployment: { kind: "state", state: "in_progress", sinceMs: null },
    });
    expect(verdict.kind).toBe("behind");
    expect(productionCurrencySentence(verdict)).toContain("no readable timestamp");
  });

  /*
    ⚠ AND AN UNRECOGNISED STATE DOES NOT EXCUSE A LAG, WHICH IS THE OPPOSITE OF
    `deploy-verify`'S CHOICE WITH ONE. That job must not redden on a state it
    has no branch for, so its unknown state WAITS; this reader's silence is the
    defect it exists to remove, and it is only ever asked after something has
    already gone wrong. A state name Railway starts posting tomorrow can buy no
    silence here.
  */
  it("⚠ a state nobody has seen before does not excuse the lag", () => {
    const verdict = judge({
      health: served(LIVE),
      deployment: { kind: "state", state: "provisioning_workers", sinceMs: minutesAgo(2) },
    });
    expect(verdict.kind).toBe("behind");
  });
});

describe("the raise, and what it says", () => {
  it("replays the morning: behind, on a Railway `failure`", () => {
    const verdict = judge({
      health: served(OLDER),
      deployment: { kind: "state", state: "failure", sinceMs: minutesAgo(115) },
      relation: { kind: "behind", commits: 2 },
    });
    expect(verdict.kind).toBe("behind");
    expect(productionCurrencyExitCode(verdict)).toBe(2);
    const sentence = productionCurrencySentence(verdict);
    expect(sentence).toContain(shortSha(OLDER));
    expect(sentence).toContain(shortSha(TIP));
    expect(sentence).toContain("2 commits behind");
    expect(sentence).toContain("`failure`");
  });

  it("names a missing deployment record rather than guessing — #2678's shape", () => {
    const verdict = judge({ health: served(OLDER), deployment: { kind: "none" } });
    expect(verdict.kind).toBe("behind");
    expect(productionCurrencySentence(verdict)).toContain("recorded no deployment for it at all");
  });

  it("⚠ an unreadable Railway state excuses nothing", () => {
    const verdict = judge({
      health: served(OLDER),
      deployment: { kind: "unread", why: "the API refused" },
    });
    expect(verdict.kind).toBe("behind");
    expect(productionCurrencySentence(verdict)).toContain("could not be read");
  });

  it("titles the card from the shas, not from the sentence", () => {
    const verdict = judge({ health: served(LIVE), deployment: { kind: "none" } });
    const title = productionCurrencyCardTitle(verdict);
    expect(title).toBe(`Production is behind main — ${shortSha(LIVE)} is live, main is at ${shortSha(TIP)}`);
    /* A title cut out of prose is a second contract on that prose; this one is
       short, stable, and cannot come back empty. */
    expect(title).not.toContain("Railway");
  });

  it("says how far behind, in words a person reads", () => {
    expect(relationPhrase({ kind: "behind", commits: 1 })).toBe("production is one commit behind");
    expect(relationPhrase({ kind: "behind", commits: 7 })).toContain("7 commits behind");
    expect(relationPhrase({ kind: "off-main" })).toContain("not an ancestor of `main`");
    expect(relationPhrase({ kind: "unread" })).toContain("could not be read");
    expect(deploymentPhrase({ kind: "state", state: "failure", sinceMs: NOW })).toContain("`failure`");
  });
});

describe("what it refuses to judge — it files nothing and fails", () => {
  /*
    ⚠ NOT FOLDED INTO `behind`, AND THE SPLIT IS THE DESIGN — #2719's own, for
    the same reason. A detector that raised on its own malfunction would file
    cards nobody can act on; one that went quiet would reproduce the defect it
    exists to catch.
  */
  it("⚠ an unreadable tip is unreadable, never a finding", () => {
    for (const tipSha of [null, "", "   "]) {
      const verdict = judge({ tipSha, health: served(OLDER) });
      expect(verdict.kind).toBe("unreadable");
      expect(productionCurrencyExitCode(verdict)).toBe(1);
      expect(productionCurrencyCardTitle(verdict)).toBeNull();
    }
  });

  it("⚠ a production that did not answer at all is unreadable, and says it may be bigger", () => {
    const verdict = judge({
      health: { kind: "no-answer", why: "connect ETIMEDOUT — that may be an outage, a different card" },
    });
    expect(verdict.kind).toBe("unreadable");
    expect(productionCurrencyExitCode(verdict)).toBe(1);
    expect(productionCurrencySentence(verdict)).toContain("outage");
  });

  it("⚠ a health body with no `build` field is unreadable, not behind", () => {
    const verdict = judge({
      health: { kind: "unreadable", why: "production answered but carried no `build` field" },
      deployment: { kind: "state", state: "failure", sinceMs: minutesAgo(3) },
    });
    expect(verdict.kind).toBe("unreadable");
    /* A malformed health body must never become a card. */
    expect(productionCurrencyCardTitle(verdict)).toBeNull();
  });
});

describe("readProductionCurrency — every fact, from injected transports", () => {
  /** A `gh` that answers whichever read it recognises, and records the calls. */
  const fakeGh = (answers: {
    tip?: unknown;
    deployments?: unknown;
    statuses?: unknown;
    compare?: unknown;
  }, asked: string[] = []) => (args: readonly string[]): string => {
    const line = args.join(" ");
    asked.push(line);
    if (line.includes("/commits/main")) {
      if (answers.tip === undefined) throw new Error("gh refused the tip");
      return JSON.stringify(answers.tip);
    }
    if (line.includes("/statuses")) {
      if (answers.statuses === undefined) throw new Error("gh refused the statuses");
      return JSON.stringify(answers.statuses);
    }
    if (line.includes("/deployments")) {
      if (answers.deployments === undefined) throw new Error("gh refused the deployments");
      return JSON.stringify(answers.deployments);
    }
    if (line.includes("/compare/")) {
      if (answers.compare === undefined) throw new Error("gh refused the comparison");
      return JSON.stringify(answers.compare);
    }
    throw new Error(`unexpected gh call: ${line}`);
  };

  const health = (body: unknown) => async (): Promise<string> => JSON.stringify(body);

  it("⚠ asks `--jq` for an OBJECT, never for a bare string path", async () => {
    /*
      ⚠ THIS ARM IS A DRIVEN CORRECTION PAID FOR ONE FILE OVER. `gh api --jq
      .sha` prints the string UNQUOTED, so `JSON.parse` throws on a perfectly
      good answer and every road reads `unreadable` — `teamSilence.mts` shipped
      that bug and caught it against the live repository. A jq OBJECT
      projection prints real JSON. Both forms were run against this repository
      on 2026-10-28 before the reader was written.
    */
    const asked: string[] = [];
    await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({ tip: { sha: TIP } }, asked),
      health: health({ status: "healthy", build: TIP }),
    });
    const jqArguments = asked
      .flatMap((line) => line.split(" "))
      .filter((argument) => argument.startsWith("{") || /^\.[a-z]/.test(argument));
    expect(jqArguments.length, "no --jq projection was asked for at all").toBeGreaterThan(0);
    for (const argument of jqArguments) {
      expect(argument, "a bare jq path prints unquoted and breaks JSON.parse").toMatch(/^\{/);
    }
  });

  it("replays the morning end to end: behind, one commit, on a `failure`", async () => {
    const { verdict, sentence } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({
        tip: { sha: TIP },
        deployments: { id: 7380249315 },
        statuses: { state: "failure", at: "2026-10-28T08:18:26Z" },
        compare: { status: "ahead", aheadBy: 1 },
      }),
      health: health({ status: "healthy", build: LIVE }),
    });
    expect(verdict.kind).toBe("behind");
    expect(sentence).toContain("one commit behind");
    expect(sentence).toContain("`failure`");
    expect(productionCurrencyCardTitle(verdict)).toContain(shortSha(LIVE));
  });

  it("⚠ spends no comparison call when production is current", async () => {
    /* Every `gh` call spends a shared budget the builder seats have tripped
       before, so the common road asks three questions and not four. */
    const asked: string[] = [];
    const { verdict } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({
        tip: { sha: TIP },
        deployments: { id: 1 },
        statuses: { state: "success", at: "2026-10-28T08:50:00Z" },
      }, asked),
      health: health({ status: "healthy", build: TIP }),
    });
    expect(verdict.kind).toBe("current");
    expect(asked.some((line) => line.includes("/compare/"))).toBe(false);
  });

  it("calls a build that is not on main off-main rather than counting it", async () => {
    const { verdict, sentence } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({
        tip: { sha: TIP },
        deployments: { id: 1 },
        statuses: { state: "inactive", at: "2026-10-28T08:40:00Z" },
        compare: { status: "diverged", aheadBy: 3 },
      }),
      health: health({ status: "healthy", build: OLDER }),
    });
    expect(verdict.kind).toBe("behind");
    expect(sentence).toContain("not an ancestor of `main`");
  });

  it("reads an absent deployment record as `none`, and still raises", async () => {
    const { verdict, sentence } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({
        tip: { sha: TIP },
        deployments: { id: null },
        compare: { status: "ahead", aheadBy: 1 },
      }),
      health: health({ status: "healthy", build: LIVE }),
    });
    expect(verdict.kind).toBe("behind");
    expect(sentence).toContain("recorded no deployment");
  });

  it("⚠ a gh that refuses the tip is unreadable, never a finding", async () => {
    const { verdict } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({}),
      health: health({ status: "healthy", build: LIVE }),
    });
    expect(verdict.kind).toBe("unreadable");
    expect(productionCurrencyExitCode(verdict)).toBe(1);
  });

  it("⚠ a health endpoint that throws is unreadable, and the reason travels", async () => {
    const { verdict, sentence } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({ tip: { sha: TIP }, deployments: { id: null } }),
      health: async () => { throw new Error("connect ETIMEDOUT"); },
    });
    expect(verdict.kind).toBe("unreadable");
    expect(sentence).toContain("connect ETIMEDOUT");
  });

  it("⚠ a health body with no build field is unreadable, not behind", async () => {
    const { verdict, sentence } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({ tip: { sha: TIP }, deployments: { id: null } }),
      health: health({ status: "healthy" }),
    });
    expect(verdict.kind).toBe("unreadable");
    expect(sentence).toContain("`build` field");
  });

  it("⚠ an unparseable health body is unreadable too", async () => {
    const { verdict } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({ tip: { sha: TIP }, deployments: { id: null } }),
      health: async () => "<html>504 Gateway Time-out</html>",
    });
    expect(verdict.kind).toBe("unreadable");
  });

  it("keeps the finding when only the comparison could not be read", async () => {
    const { verdict, sentence } = await readProductionCurrency({
      nowMs: NOW,
      gh: fakeGh({
        tip: { sha: TIP },
        deployments: { id: 1 },
        statuses: { state: "failure", at: "2026-10-28T08:18:26Z" },
      }),
      health: health({ status: "healthy", build: LIVE }),
    });
    /* How far behind is context; whether it is behind is the verdict. */
    expect(verdict.kind).toBe("behind");
    expect(sentence).toContain("how far behind could not be read");
  });
});

/*
  ⚠ THE WIRING, AND IT READS THE EXECUTABLE HALF OF THE WORKFLOW ONLY.
  `deployVerifyWindow.test.ts` paid for this twice in opposite directions: a
  negative arm read the header's own explanation as the breach, and — worse — a
  POSITIVE arm stayed green after `deployments: read` was deleted, because the
  header mentions it. An arm about what a workflow DOES looks only where doing
  happens. A library nothing invokes is invariant 7, so these are not optional.
*/
const workflow = read(".github/workflows/production-currency.yml");
const executable = workflow
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

describe("the workflow is what invokes it", () => {
  it("fires off a finished deploy-verify, on a schedule, and by hand", () => {
    /* `[^\n]*` because the trigger line carries a trailing zizmor suppression,
       which the comment strip above deliberately leaves alone — it strips whole
       comment LINES only, since a cleverer strip would mangle a `#` inside a
       bash string. */
    expect(executable).toMatch(/workflow_run:[^\n]*\n\s*workflows:\s*\[deploy-verify\]/);
    expect(executable).toContain("types: [completed]");
    expect(executable).toMatch(/schedule:\s*\n\s*- cron:/);
    expect(executable).toContain("workflow_dispatch:");
  });

  /*
    ⚠ THE ONE SECURITY-RELEVANT SUPPRESSION IN THIS FILE, PINNED TO THE FACT
    THAT JUSTIFIES IT. zizmor's `dangerous-triggers` audit is right in general:
    a `workflow_run` job that checks out the TRIGGERING ref can be handed a
    fork's code. The suppression's whole reason is that this job checks out
    `main` instead — so the two are asserted together, and a later edit that
    drops `ref: main` while keeping the ignore has to argue with this arm.
  */
  it("⚠ suppresses the dangerous-trigger finding at its line, and earns it with `ref: main`", () => {
    const trigger = /^\s*workflow_run:.*$/m.exec(executable);
    expect(trigger, "the workflow_run trigger moved").not.toBeNull();
    expect(trigger![0]).toContain("zizmor: ignore[dangerous-triggers]");
    /* The reason travels with it — the lint script's own rule. */
    expect(trigger![0].length).toBeGreaterThan("  workflow_run: # zizmor: ignore[dangerous-triggers]".length);
    const checkout = /- uses: actions\/checkout@[\s\S]{0,400}?persist-credentials: false/.exec(executable);
    expect(checkout, "the checkout step moved").not.toBeNull();
    expect(checkout![0]).toContain("ref: main");
  });

  it("⚠ takes the workflow_run road ONLY on a failed verify, never on a cancelled one", () => {
    const gate = /^\s*if: \$\{\{ github\.event_name != 'workflow_run'.*$/m.exec(executable);
    expect(gate, "the job declares no event gate").not.toBeNull();
    const line = gate![0];
    expect(line).toContain("failure");
    /*
      A cancelled verify was replaced while queued by a newer push, and the
      newer run verifies a tree containing it — `deploy-verify`'s own header.
      Reading the gate LINE and not the file is the sibling-satisfaction guard:
      the word appears in this workflow's prose as the reason it is excluded.
    */
    expect(line).not.toContain("cancelled");
    expect(line).not.toContain("success");
  });

  it("calls the one command, which exists", () => {
    expect(executable).toContain("npx tsx scripts/production-currency-check.mts");
    expect(read("scripts/production-currency-check.mts").length).toBeGreaterThan(0);
  });

  it("declares the write it needs, and nothing else", () => {
    const [header, job] = executable.split("jobs:");
    expect(header, "the workflow-level permissions block moved").toContain("permissions:\n  contents: read");
    expect(header).not.toContain("issues: write");
    expect(job).toContain("issues: write");
  });

  it("checks out main, with no credentials left behind", () => {
    expect(executable).toContain("ref: main");
    expect(executable).toContain("persist-credentials: false");
  });

  it("⚠ dedupes on an open card and files only one, labelled for the board", () => {
    expect(executable).toContain("--label production-behind --state open");
    expect(executable).toContain("gh issue comment");
    expect(executable).toMatch(/gh issue create .*--label production-behind --label bug/);
  });

  it("builds the body from the tracked template, which exists", () => {
    expect(executable).toContain("cp .github/production-behind-card.md card.md");
    const template = read(".github/production-behind-card.md");
    /* His Desk rule: a card he reads leads with what it means, in his words. */
    expect(template).toContain("it is not live");
    expect(template).toContain("Closing it");
  });

  it("⚠ refuses to file a card named nothing", () => {
    expect(executable).toMatch(/if \[ -z "\$TITLE" \]/);
  });

  /*
    ⚠ THE ONE CONTRACT BETWEEN THE COMMAND AND THE WORKFLOW, DERIVED RATHER
    THAN TYPED TWICE. The workflow `sed`s the card's title off a line the
    command prints; two literals in two files is the drift this repository has
    been bitten by, so the prefix is read out of the workflow and asserted
    against the command's own template string.
  */
  it("⚠ the prefix the workflow strips is the prefix the command prints", () => {
    const pattern = /sed -n 's\/\^(.+?)\/\/p'/.exec(executable);
    expect(pattern, "the workflow no longer reads a title line").not.toBeNull();
    const prefix = pattern![1]!.replace(/\\(.)/g, "$1");
    expect(prefix).toContain("title:");
    expect(read("scripts/production-currency-check.mts")).toContain(`\`${prefix}\${title}\``);
  });

  it("⚠ retries nothing — the card's own refusal", () => {
    /* Five of six build attempts that morning failed on a provider daemon; a
       retry loop would have hammered it and still told nobody. */
    expect(executable).not.toContain("gh workflow run");
    expect(executable).not.toMatch(/redeploy|railway/i);
  });
});
