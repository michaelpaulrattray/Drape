/**
 * IS PRODUCTION SERVING THE COMMIT ON `main`? — the reader `deploy-verify`
 * never had (#2748).
 *
 * # The hour this answers
 *
 * On 2026-10-28 production served `078922411` from 05:13Z to 08:09Z while two
 * merged commits sat unshipped: Railway's own build daemon failed build after
 * build on one buildkit error, on commits whose checks were all green. The
 * first of those failures was found **52 minutes later**, by a shift that only
 * looked because its own deploy rite refused — that is, by accident.
 *
 * **`deploy-verify` saw it correctly, in 132 seconds, and told nobody.** Read
 * at the runs: `72d56cc0` red at 07:01:42Z (created 06:59:30Z), `709536f4` at
 * 07:51:55Z, `8addd635` at 08:13:18Z. That is invariant 7 from the other end —
 * the control is invoked, it fires on time, and its verdict reaches no reader.
 *
 * **Nobody skipped a step, which is what makes it structural.** A seat
 * correctly does not poll the gate and has gone by the time its card merges;
 * the relay merges and moves on; the pull request's own checks were green,
 * because `deploy-verify` runs on the push to `main` AFTER the merge rather
 * than on the branch; and every other alarm the team owns keys on work IN
 * FLIGHT (#2719's exact sentence). **A merged, green, failed-to-ship commit is
 * in flight to nobody.**
 *
 * # The one question, and why it is asked of our own service
 *
 * **Is the commit on `main` the commit production is serving?** Asked at
 * `/api/health`'s `build` field, which has carried the sha for exactly this
 * purpose since #508 — the reading that dissolves the #296 trap, where a 200
 * from the OLD process read as "shipped".
 *
 * ⚠ **RAILWAY'S DEPLOYMENT STATE MAY ONLY EVER EXCUSE A LAG, NEVER ASSERT
 * ONE, AND THAT IS MEASURED RATHER THAN PREFERRED.** Read at the GitHub
 * Deployment statuses for the three commits of that morning, 2026-10-28
 * 08:55Z: **six `failure` statuses and not one `success`** — and `709536f4`,
 * which carries `failure` at 08:10:29Z as its newest status, **is the commit
 * production was serving.** Its build failed inside its window and a later
 * hand redeploy succeeded without ever moving that record.
 *
 * **So a reader built on `deploy-verify`'s conclusion, or on Railway's own
 * state, would have reported a healthy and current production as broken.**
 * The health field is the fact; Railway's state is the prompt to go and look.
 *
 * The asymmetry that falls out of that is the whole safety of this file: a
 * lying `failure` can never make this reader cry wolf, because `current` is
 * decided by the sha alone and nothing else may overturn it. Only a lying
 * `in_progress` could make it go quiet — and that road is bounded, in minutes,
 * by `SHIPPING_GRACE_MINUTES`.
 *
 * # Telling a failed build from a slow one
 *
 * ⚠ **#1518 IS THE REASON TO BE CAREFUL AND IT IS THE MEASURED PRECEDENT.**
 * `deploy-verify` used to go red on a deploy that was merely slow — a flat
 * 15-minute window against builds that took 41 — and a detector that cries
 * wolf is how a real red comes to be ignored. So a lag is EXCUSED while
 * Railway says that commit is still building, and only while that claim is
 * younger than the grace. Today's evidence says the two are distinguishable: a
 * daemon failure finished in 83 seconds, where #1518's false red was a build
 * still running at 23 minutes.
 *
 * ⚠ **AN UNRECOGNISED DEPLOYMENT STATE DOES NOT EXCUSE A LAG HERE, WHICH IS
 * THE OPPOSITE OF WHAT `deploy-verify` DOES WITH ONE — and the difference is
 * deliberate.** That job must not turn red on a state it has no branch for, so
 * its unknown state WAITS. This reader's failure mode is the mirror image: its
 * silence is the defect it exists to remove, and its population is already
 * narrow, because it is only ever asked after something has already gone
 * wrong. A state name Railway starts posting tomorrow can therefore buy no
 * silence here.
 */

/**
 * HOW LONG RAILWAY MAY CLAIM A COMMIT IS STILL BUILDING BEFORE THAT STOPS
 * BEING AN EXCUSE.
 *
 * Measured rather than chosen: the slowest deploy on record is **41.3 minutes**
 * (#1518's reading of the 2026-09-29 merge burst, 26 successful deploys), and
 * `deploy-verify`'s own hard ceiling is 60 for that reason. Equal to it on
 * purpose — the two numbers answer the same question, so a deploy this reader
 * calls "still shipping" is exactly one `deploy-verify` would still be waiting
 * for.
 *
 * ⚠ **Without this bound the reader has a hole the size of the outage it is
 * for**: a build that hangs in `in_progress` and never posts a terminal status
 * would be excused forever, which is this card's own defect wearing a tidier
 * state name.
 */
export const SHIPPING_GRACE_MINUTES = 60;

/**
 * The deployment states GitHub's own vocabulary uses for work still on its
 * way; `success`, `failure`, `error` and `inactive` are the terminal four.
 *
 * ⚠ Railway was only ever OBSERVED posting `in_progress`, `success`,
 * `inactive` and `failure` (#1518's reading of 30 deployments, plus `failure`
 * measured on 2026-10-28 — the one state that reading could not confirm). The
 * three here are GitHub's documented set rather than that observed subset,
 * because the observed subset is a floor and a reader built on it would call
 * any new name unknown.
 */
const BUILDING_STATES = new Set(["in_progress", "queued", "pending"]);

/** Railway's newest word on a sha, as GitHub recorded it. */
export type DeploymentReading =
  /** A state, with when it was posted (null when that could not be parsed). */
  | { kind: "state"; state: string; sinceMs: number | null }
  /** No GitHub Deployment exists for this sha at all — #2678's shape. */
  | { kind: "none" }
  /** The record could not be read. It excuses nothing; see the header. */
  | { kind: "unread"; why: string };

/** What production's build is, relative to `main` — context for the card. */
export type ServedRelation =
  /** An ancestor of the tip: production is this many commits behind. */
  | { kind: "behind"; commits: number }
  /** Not an ancestor of the tip at all — a rollback, or something off `main`. */
  | { kind: "off-main" }
  | { kind: "unread" };

/** What `/api/health` said, with the three outcomes kept apart on purpose. */
export type HealthReading =
  | { kind: "served"; build: string; status: string | null }
  /** The endpoint did not answer. Production may be DOWN, which is not this. */
  | { kind: "no-answer"; why: string }
  /** It answered, and the one field every verdict here rests on was absent. */
  | { kind: "unreadable"; why: string };

export type ProductionCurrencyVerdict =
  /** Production serves the tip of `main`. Nothing to say. */
  | { kind: "current"; sha: string; servedStatus: string | null }
  /**
   * Behind, and Railway says that commit is still building inside the grace.
   * #1518's shape, and the one state that must never file a card.
   */
  | { kind: "shipping"; tip: string; served: string; state: string; minutes: number }
  /** Behind, with nothing building to explain it. **The raise.** */
  | {
    kind: "behind";
    tip: string;
    served: string;
    servedStatus: string | null;
    deployment: DeploymentReading;
    relation: ServedRelation;
  }
  /**
   * The question could not be answered.
   *
   * ⚠ **Not folded into `behind`, and the split is the design** — the same
   * split #2719 made for the same reason. A detector that raised on its own
   * malfunction would file cards nobody can act on; one that went quiet would
   * reproduce the defect it exists to catch. So it does neither: it files
   * nothing and FAILS, which puts a red in the Actions tab without putting a
   * wrong card on the board.
   */
  | { kind: "unreadable"; why: string };

/** Nine characters, the length `git log --oneline` prints in this repository. */
export const shortSha = (sha: string): string => sha.slice(0, 9);

/**
 * The verdict, from the facts and the grace. Pure, so every arm is drivable
 * without a network, a clock or a repository.
 */
export function judgeProductionCurrency(input: {
  nowMs: number;
  /** The tip of `main`, or null if that could not be read. */
  tipSha: string | null;
  health: HealthReading;
  deployment: DeploymentReading;
  relation?: ServedRelation;
  graceMinutes?: number;
}): ProductionCurrencyVerdict {
  const tip = typeof input.tipSha === "string" && input.tipSha.trim() !== ""
    ? input.tipSha.trim()
    : null;
  if (tip === null) {
    return {
      kind: "unreadable",
      why: "the tip of `main` could not be read, so there is nothing to compare production against",
    };
  }
  if (input.health.kind !== "served") {
    return { kind: "unreadable", why: input.health.why };
  }

  const served = input.health.build;
  if (served === tip) {
    /*
      ⚠ THE SHA DECIDES THIS AND NOTHING ELSE MAY OVERTURN IT — not Railway's
      state, not `deploy-verify`'s conclusion, not an unhealthy status. That is
      what makes the `709536f4` specimen in the header harmless rather than a
      wolf. An unhealthy production serving the right commit is a real problem
      and it is NOT this one: there is no currency finding to file, so the
      status travels in the sentence and this reader says plainly that it is
      not the question rather than guessing at it.
    */
    return { kind: "current", sha: tip, servedStatus: input.health.status };
  }

  const grace = input.graceMinutes ?? SHIPPING_GRACE_MINUTES;
  if (input.deployment.kind === "state" && BUILDING_STATES.has(input.deployment.state)) {
    const since = input.deployment.sinceMs;
    /*
      ⚠ A FUTURE-DATED STATUS EARNS NO EXCUSE, AND THE DIRECTION IS THE WHOLE
      POINT. Clamping a negative age to zero — the obvious reading, and the
      right one in `judgeTeamSilence`, where it stops clock skew manufacturing
      health — would here hand an infinite grace to any clock running ahead of
      ours. So skew buys silence nowhere: an age that is unreadable or negative
      falls through to the finding, and the sentence says the timestamp was
      unusable.
    */
    const minutes = since === null ? null : (input.nowMs - since) / 60_000;
    if (minutes !== null && minutes >= 0 && minutes < grace) {
      return {
        kind: "shipping",
        tip,
        served,
        state: input.deployment.state,
        minutes: Math.round(minutes * 10) / 10,
      };
    }
  }

  return {
    kind: "behind",
    tip,
    served,
    servedStatus: input.health.status,
    deployment: input.deployment,
    relation: input.relation ?? { kind: "unread" },
  };
}

/** What Railway's last word was, in words, for the sentence and the card. */
export function deploymentPhrase(reading: DeploymentReading): string {
  switch (reading.kind) {
    case "none":
      return "Railway recorded no deployment for it at all";
    case "unread":
      return `Railway's own state could not be read (${reading.why})`;
    case "state":
      return reading.sinceMs === null
        ? `Railway's last word on it is \`${reading.state}\`, with no readable timestamp`
        : `Railway's last word on it is \`${reading.state}\``;
  }
}

/** How far behind, in words. Context for the card, never part of the verdict. */
export function relationPhrase(relation: ServedRelation): string {
  switch (relation.kind) {
    case "behind":
      return relation.commits === 1
        ? "production is one commit behind"
        : `production is ${relation.commits} commits behind`;
    case "off-main":
      return "what production serves is not an ancestor of `main` at all — a rollback, or a build from somewhere else";
    case "unread":
      return "how far behind could not be read";
  }
}

/**
 * The sentence a human reads, and the one the raised card is titled with.
 *
 * Written here rather than in the workflow so a hand run and the triggered run
 * cannot describe the same state differently — `teamSilence.mts`'s own rule,
 * one file over.
 */
export function productionCurrencySentence(verdict: ProductionCurrencyVerdict): string {
  switch (verdict.kind) {
    case "unreadable":
      return `whether production is current could not be read — ${verdict.why}`;
    case "current": {
      const health = verdict.servedStatus === "healthy"
        ? "healthy"
        : `though it reports status \`${verdict.servedStatus ?? "none"}\`, which is NOT this reader's question`;
      return `production serves ${shortSha(verdict.sha)}, the tip of main — ${health}`;
    }
    case "shipping":
      return `production serves ${shortSha(verdict.served)} while main is at ${shortSha(verdict.tip)} — Railway says that commit has been \`${verdict.state}\` for ${verdict.minutes} min, inside the ${SHIPPING_GRACE_MINUTES} min a deploy on record may take`;
    case "behind":
      return `production serves ${shortSha(verdict.served)} while main is at ${shortSha(verdict.tip)} — ${relationPhrase(verdict.relation)}, and ${deploymentPhrase(verdict.deployment)}`;
  }
}

/**
 * The title of the one card this reader may file, or null for every verdict
 * that files none.
 *
 * ⚠ **Written here rather than cut out of the sentence by the workflow's
 * `sed`.** A title derived from prose is a second contract on the shape of
 * that prose — rewording the sentence would silently retitle the card, or
 * produce an empty title and a card called nothing at all. This way the suite
 * pins both, and the two cannot disagree.
 *
 * Deliberately short and stable: the shas, nothing else. The sentence and the
 * reading go in the body, where there is room for them.
 */
export function productionCurrencyCardTitle(verdict: ProductionCurrencyVerdict): string | null {
  if (verdict.kind !== "behind") return null;
  return `Production is behind main — ${shortSha(verdict.served)} is live, main is at ${shortSha(verdict.tip)}`;
}

/** The exit code a command ends on. 2 is the finding, as the house uses it. */
export function productionCurrencyExitCode(verdict: ProductionCurrencyVerdict): 0 | 1 | 2 {
  if (verdict.kind === "unreadable") return 1;
  return verdict.kind === "behind" ? 2 : 0;
}

/**
 * Every fact and the verdict, assembled from an injected `gh` and an injected
 * health read — so the suite drives every road without a network.
 *
 * Both transports are handed in rather than opened here, for the reason the
 * three readers in `cardBuildState.mts` take `gh` the same way: a reader that
 * opens its own transport cannot be driven against a refusing one, and the
 * refusing arms are half of what matters in a detector.
 */
export async function readProductionCurrency(input: {
  nowMs: number;
  /** Runs `gh` with the given args and returns stdout, or throws. */
  gh: (args: readonly string[]) => string;
  /** Returns `/api/health`'s body, or throws when it did not answer. */
  health: () => Promise<string>;
  graceMinutes?: number;
}): Promise<{ verdict: ProductionCurrencyVerdict; sentence: string }> {
  const read = (args: readonly string[]): unknown => {
    try {
      return JSON.parse(input.gh(args));
    } catch {
      return null;
    }
  };

  /*
    ⚠ `--jq` IS USED HERE AND IT ASKS FOR AN OBJECT, NEVER A BARE STRING. That
    distinction is driven rather than assumed, and `teamSilence.mts` paid for
    the other half of it: `gh api --jq .sha` prints the string UNQUOTED, so
    `JSON.parse` throws on a perfectly good answer and every road reads
    `unreadable`. A jq OBJECT projection prints real JSON. Both forms were run
    against this repository on 2026-10-28 before this line was written.

    The projection also keeps the payload small, which matters most on
    `compare`, whose full document carries every commit and file in the range.
  */
  const tipDoc = read(["api", "repos/{owner}/{repo}/commits/main", "--jq", "{sha:.sha}"]);
  const tipRaw = (tipDoc as { sha?: unknown } | null)?.sha;
  const tipSha = typeof tipRaw === "string" && tipRaw !== "" ? tipRaw : null;

  let body: string | null = null;
  let healthWhy = "";
  try {
    body = await input.health();
  } catch (error) {
    healthWhy = error instanceof Error ? error.message : String(error);
  }

  let health: HealthReading;
  if (body === null) {
    health = {
      kind: "no-answer",
      why: `production's /api/health did not answer (${healthWhy}) — that may be an outage, which is a bigger thing than this reader judges and a different card`,
    };
  } else {
    let build: unknown;
    let status: unknown;
    try {
      const parsed = JSON.parse(body) as { build?: unknown; status?: unknown };
      build = parsed.build;
      status = parsed.status;
    } catch {
      build = undefined;
    }
    health = typeof build === "string" && build !== ""
      ? { kind: "served", build, status: typeof status === "string" ? status : null }
      : {
        kind: "unreadable",
        /*
          Every verdict here rests on this one field, so an absent one is
          unreadable rather than "behind": a malformed health body must not
          become a card. The field has been served since #508, so any build
          this reader could be behind is newer than the field itself.
        */
        why: "production answered but carried no `build` field, and that is the field every reading here rests on",
      };
  }

  let deployment: DeploymentReading = {
    kind: "unread",
    why: "there was no tip of `main` to ask Railway about",
  };
  if (tipSha !== null) {
    const deployments = read([
      "api", `repos/{owner}/{repo}/deployments?sha=${tipSha}&per_page=1`,
      "--jq", "{id:(.[0].id // null)}",
    ]);
    const id = (deployments as { id?: unknown } | null)?.id;
    if (deployments === null) {
      deployment = { kind: "unread", why: "the deployment record for the tip could not be read" };
    } else if (typeof id !== "number") {
      deployment = { kind: "none" };
    } else {
      /* Newest first, which is the order GitHub returns statuses in. */
      const newest = read([
        "api", `repos/{owner}/{repo}/deployments/${id}/statuses?per_page=1`,
        "--jq", "{state:(.[0].state // null),at:(.[0].created_at // null)}",
      ]);
      const state = (newest as { state?: unknown } | null)?.state;
      const at = (newest as { at?: unknown } | null)?.at;
      if (typeof state !== "string" || state === "") {
        deployment = { kind: "unread", why: "the deployment carries no readable status" };
      } else {
        const parsedAt = typeof at === "string" ? Date.parse(at) : Number.NaN;
        deployment = { kind: "state", state, sinceMs: Number.isNaN(parsedAt) ? null : parsedAt };
      }
    }
  }

  /*
    HOW FAR BEHIND — asked only when it can mean something, so the common road
    spends three `gh` calls rather than four. Every call here spends the ONE
    account's shared hourly budget, which the builder seats have tripped before.
  */
  let relation: ServedRelation = { kind: "unread" };
  if (health.kind === "served" && tipSha !== null && health.build !== tipSha) {
    const compared = read([
      "api", `repos/{owner}/{repo}/compare/${health.build}...${tipSha}`,
      "--jq", "{status:.status,aheadBy:.ahead_by}",
    ]);
    const status = (compared as { status?: unknown } | null)?.status;
    const aheadBy = (compared as { aheadBy?: unknown } | null)?.aheadBy;
    if (status === "ahead" && typeof aheadBy === "number") {
      relation = { kind: "behind", commits: aheadBy };
    } else if (typeof status === "string") {
      relation = { kind: "off-main" };
    }
  }

  const verdict = judgeProductionCurrency({
    nowMs: input.nowMs,
    tipSha,
    health,
    deployment,
    relation,
    ...(input.graceMinutes === undefined ? {} : { graceMinutes: input.graceMinutes }),
  });
  return { verdict, sentence: productionCurrencySentence(verdict) };
}
