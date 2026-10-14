/**
 * TELLING SILENCE FROM A DEAD PIPE (#1542).
 *
 * # What the founder saw, and why nothing could answer him
 *
 * On 2026-09-30 he clicked *Errors* on the admin overview, reached the right
 * Sentry project, and read **"Get Started with Sentry Issues · Set up the Sentry
 * SDK for klieg-server"** — the panel Sentry draws only while a project has
 * received no event, ever. The server had printed `[Errors] reporting to Sentry`
 * at every boot since 2026-09-27.
 *
 * Two things fit that, and they want opposite responses:
 *
 * - **nothing has crashed in three days** — the tracker is fine and the quiet is
 *   the truth;
 * - **nothing arrives** — a DSN for the wrong project, a scrub refusing every
 *   event, a transport that never drains.
 *
 * Working law 2: an instrument gets a positive control before its silence counts
 * for anything. #1419 was filed about exactly this shape — *"0 errors today"* as
 * a lie — and the tracker then shipped with the same hole one level up.
 *
 * # ⚠ THE SIGNAL WAS ALREADY BOUGHT AND NOBODY WAS READING IT
 *
 * `errorTracker.ts` has counted `sent` and `refused` since #509 part 1, and
 * `errorTrackerStatus()` had **no non-test caller in the tree** — so the fact
 * that separates the two explanations above was being computed and discarded on
 * every boot. That is the disappearing-technology law's clause 4 (*read what the
 * engine already gives you before reaching for a better one*) and the card's
 * cheapest finding: no new machinery was needed to know whether the scrub was
 * eating events, only somebody asking.
 *
 * This module is the asking, as a pure function over facts a caller collects, so
 * every branch can be driven without a Sentry account —
 * `server/trackerVerdict.test.ts`.
 */

import { SENTRY_ORG, SENTRY_PROBE_TAG, SENTRY_SERVER_PROJECT } from "../../shared/monitoringProjects";

/** What a vendor read-back was able to say about a specific event id. */
export type VendorLookup =
  /** The vendor's API confirmed the event id exists in the project. */
  | "arrived"
  /** The vendor's API answered, and does not have it. */
  | "absent"
  /** No read-back was attempted — no auth token, so the question was not asked. */
  | "not-checked"
  /** A read-back was attempted and failed (network, 401, 5xx) — the question got no answer. */
  | "unreadable";

export type TrackerVerdict =
  /** No DSN. Nothing is reported anywhere, and the product says so at boot. */
  | "no-tracker"
  /** The SDK never became ready, so nothing could be sent. */
  | "not-ready"
  /** The projection refused the probe's own event — the scrub is over-refusing. */
  | "scrub-refused"
  /** The SDK did not accept the event and gave no id. */
  | "not-accepted"
  /** Accepted and confirmed present at the vendor. The only healthy answer. */
  | "arrived"
  /**
   * Accepted, not readable by id after the window, and NOTHING positively shows
   * Sentry received it into this project — or something positively shows it did
   * not. THE dead-pipe answer.
   */
  | "lost-in-transit"
  /**
   * Accepted, Sentry's ingest answered 2xx to the envelope that carried it, and
   * the DSN names the very project being read — but the event is not yet
   * readable by id. Sentry's indexing lag, not a dead pipe (#2514). A NOTE on
   * the receipt, never a finding.
   */
  | "not-yet-visible"
  /** Accepted; arrival unproven because nothing asked the vendor. */
  | "accepted-unverified";

/**
 * What Sentry's INGEST endpoint answered to the envelope that carried the probe's
 * event — read off the SDK's own `afterSendEvent` hook, so it is the vendor's
 * answer at the door rather than a guess about it (#2514).
 */
export type IngestAnswer =
  /** The ingest endpoint answered with this HTTP status. */
  | { readonly kind: "answered"; readonly status: number }
  /**
   * The transport resolved WITHOUT an HTTP status — a network failure, a
   * rate-limit backoff, a full queue. Nothing reached Sentry's door.
   */
  | { readonly kind: "no-answer" }
  /** The hook never fired for this event, so nothing is known about the door. */
  | { readonly kind: "not-observed" };

/**
 * Whether the DSN this process sends on names the project the read-back asks
 * about — compared as Sentry's numeric project ids, never by printing the DSN.
 * `differs` is the *"the DSN points somewhere else"* half of the dead pipe,
 * proven rather than suspected.
 */
export type DsnProjectMatch = "matches" | "differs" | "unknown";

export interface TrackerProbeFacts {
  /** A DSN is set, so this process intends to report. */
  readonly configured: boolean;
  /** The SDK is imported and `init` has returned. */
  readonly ready: boolean;
  /** `state.sent` delta across the probe — events the scrub passed. */
  readonly sent: number;
  /** `state.refused` delta across the probe — events the scrub refused. */
  readonly refused: number;
  /** Sentry's own event id, as returned by `captureException`. */
  readonly eventId: string | undefined;
  readonly lookup: VendorLookup;
  /** What the ingest endpoint answered. Absent reads as `not-observed`. */
  readonly ingest?: IngestAnswer;
  /** Whether the DSN names the project being read. Absent reads as `unknown`. */
  readonly dsnProject?: DsnProjectMatch;
}

export interface TrackerReading {
  readonly verdict: TrackerVerdict;
  /** Whether this reading should fail a rite step or a deploy gate. */
  readonly healthy: boolean;
  /** One line, in the terms the reader needs, naming what to do about it. */
  readonly summary: string;
}

/**
 * Judge one probe run.
 *
 * ⚠ **ORDER MATTERS AND IS NOT ARBITRARY: the most specific cause wins.** A
 * refusal and a missing id are both true when the scrub eats the event, and
 * reporting *"the SDK did not accept it"* would send the next reader to the
 * transport instead of to the projection. Each branch is the narrowest claim the
 * facts support.
 */
export function readTrackerProbe(facts: TrackerProbeFacts): TrackerReading {
  if (!facts.configured) {
    return {
      verdict: "no-tracker",
      healthy: false,
      summary:
        "SENTRY_DSN is not set in this process — errors are logged locally and reported nowhere. " +
        "On a laptop that is expected; on production it is the defect.",
    };
  }

  if (!facts.ready) {
    return {
      verdict: "not-ready",
      healthy: false,
      summary:
        "A DSN is set but the SDK never became ready, so nothing could be sent. " +
        "Read the boot log for an import or init failure.",
    };
  }

  if (facts.refused > 0) {
    return {
      verdict: "scrub-refused",
      healthy: false,
      summary:
        `The projection REFUSED the probe's own event (${facts.refused} refused). The probe carries no recipe ` +
        "field, so this is the scrub over-refusing rather than a caller attaching something it should not — " +
        "and it means real crashes are being eaten too. Read the refusedKey/refusedPath in the server log.",
    };
  }

  if (facts.eventId === undefined || facts.sent === 0) {
    return {
      verdict: "not-accepted",
      healthy: false,
      summary:
        "The SDK did not accept the event and returned no event id, with nothing refused by the scrub. " +
        "That is inside the SDK rather than in this product's gate.",
    };
  }

  switch (facts.lookup) {
    case "arrived":
      return {
        verdict: "arrived",
        healthy: true,
        summary: `The event arrived at Sentry (event id ${facts.eventId}). The pipe is live end to end, so a quiet feed is genuine silence.`,
      };
    case "absent":
      return readAbsence(facts.eventId, facts.ingest ?? { kind: "not-observed" }, facts.dsnProject ?? "unknown");
    case "unreadable":
      return {
        verdict: "accepted-unverified",
        healthy: false,
        summary:
          `The SDK accepted the event (id ${facts.eventId}), and the read-back at Sentry failed, so arrival is ` +
          "unproven. The probe is not evidence either way until the read-back answers.",
      };
    case "not-checked":
      return {
        verdict: "accepted-unverified",
        healthy: false,
        summary:
          `The SDK accepted the event (id ${facts.eventId}) and the scrub passed it. Arrival at Sentry is ` +
          "UNPROVEN — no SENTRY_AUTH_TOKEN, so nothing asked the vendor. Look for this id in the issue feed, or " +
          "set the token and re-run.",
      };
  }
}

/**
 * THE VERDICTS THAT DO NOT FAIL A RITE, declared once (#2514). The step reader in
 * `scripts/lib/trackerProbeStep.mts` cross-checks the probe's `EXIT` line against
 * this, and the suite holds every `healthy: true` reading to it — so the two
 * sides can never disagree about which words pass (working law 4).
 */
export const PASSING_TRACKER_VERDICTS: readonly TrackerVerdict[] = ["arrived", "not-yet-visible"];

export function trackerVerdictPasses(verdict: string | null): boolean {
  return verdict !== null && (PASSING_TRACKER_VERDICTS as readonly string[]).includes(verdict);
}

/**
 * AN EVENT THAT IS NOT READABLE BY ID AFTER THE WINDOW — split by what the vendor
 * actually said at its door (#2514).
 *
 * ⚠ **UNTIL #2514 THIS WAS ONE SENTENCE AND IT WAS A STRONGER CLAIM THAN THE
 * FACT.** *"Absent after 90 s"* was printed as *"Sentry does not have it"*, and on
 * 2026-10-14 the rite exited 1 on a working pipe: both probe events were in
 * Sentry (17:50:37Z and 17:53:00Z), Sentry's outcomes showed zero drops, and the
 * only thing slower than 90 s was Sentry's indexing — which is all the id lookup
 * can see. Lengthening the window alone was declined: indexing lag has no bound
 * this product owns, so a longer window only moves the false alarm.
 *
 * So the absence is read beside two facts that are POSITIVE evidence either way:
 *
 * - the ingest endpoint's own HTTP answer to the envelope (a 2xx is Sentry
 *   saying *"received"*; a 4xx/5xx is a refusal; no answer is a pipe that never
 *   reached the door);
 * - whether the DSN names the project being read (a 2xx into ANOTHER project is
 *   the *"DSN points somewhere else"* dead pipe, and only an id compare sees it).
 *
 * Only BOTH positive — received, and received into this project — earns
 * `not-yet-visible`. Every other combination keeps `lost-in-transit` and its
 * failing exit, with words naming the evidence it rests on.
 *
 * ⚠ **What `not-yet-visible` cannot see, named rather than left to be assumed:**
 * an event the ingest took with a 2xx and Sentry then discarded AFTER the door
 * (an inbound filter, a later quota drop). Sentry's outcomes API is the reader for
 * that, and it was not added here: on the night that filed #2514 it lagged too
 * (it counted 1 accepted event where there were 2), so it could not have been the
 * tie-breaker either.
 */
function readAbsence(eventId: string, ingest: IngestAnswer, dsnProject: DsnProjectMatch): TrackerReading {
  const received = ingest.kind === "answered" && ingest.status >= 200 && ingest.status < 300;

  if (received && dsnProject === "matches") {
    return {
      verdict: "not-yet-visible",
      healthy: true,
      summary:
        `Sentry's ingest answered ${ingest.status} to the event (id ${eventId}) and the DSN names this very ` +
        "project, but the event is not yet readable by id — Sentry's indexing is slower than the probe's window. " +
        "That is lag, not a dead pipe; the id will be findable in the feed once Sentry catches up.",
    };
  }

  const dead =
    "This is the dead pipe #1542 was filed about: the DSN points somewhere else, or the transport never drained.";

  if (dsnProject === "differs") {
    return {
      verdict: "lost-in-transit",
      healthy: false,
      summary:
        `The SDK accepted the event (id ${eventId}), but the DSN names a DIFFERENT Sentry project from the one ` +
        `being read, so it can never arrive here. ${dead} Check the DSN's project against the project being read.`,
    };
  }

  if (ingest.kind === "answered" && !received) {
    return {
      verdict: "lost-in-transit",
      healthy: false,
      summary:
        `The SDK accepted the event (id ${eventId}) and Sentry's ingest REFUSED it with HTTP ${ingest.status}. ` +
        `${dead} A 401/403 is the DSN's key; a 429 is quota or rate limiting.`,
    };
  }

  if (ingest.kind === "no-answer") {
    return {
      verdict: "lost-in-transit",
      healthy: false,
      summary:
        `The SDK accepted the event (id ${eventId}) and the transport got NO answer from Sentry's ingest — a ` +
        `network failure, a backoff or a full queue. ${dead}`,
    };
  }

  return {
    verdict: "lost-in-transit",
    healthy: false,
    summary:
      `The SDK accepted the event (id ${eventId}), it is not readable at Sentry after the window, and nothing ` +
      `positively shows Sentry received it into this project (ingest ${ingest.kind === "answered" ? ingest.status : "not observed"}, ` +
      `DSN project ${dsnProject}). ${dead} Check the DSN's project against the project being read.`,
  };
}

/**
 * Sentry's numeric project id out of a DSN (`https://<key>@<host>/<projectId>`),
 * or `undefined` when the string is not one. Only the id leaves this function —
 * the key in the DSN is never returned, so a caller cannot print it by accident.
 */
export function dsnProjectId(dsn: string | undefined): string | undefined {
  const raw = dsn?.trim();
  if (!raw) return undefined;
  try {
    const last = new URL(raw).pathname.split("/").filter((segment) => segment !== "").pop();
    return last && /^\d+$/.test(last) ? last : undefined;
  } catch {
    return undefined;
  }
}

/** Compare the DSN's project id with the id the vendor reports for the project being read. */
export function matchDsnProject(dsnId: string | undefined, readId: string | undefined): DsnProjectMatch {
  if (dsnId === undefined || readId === undefined) return "unknown";
  return dsnId === readId ? "matches" : "differs";
}

/**
 * The marker a probe event carries, so it is findable in a feed of real crashes
 * and obviously not one.
 *
 * ⚠ **IT CARRIES THE COMMIT AND A RUN NONCE, AND THE NONCE IS THE POINT.** The
 * sha alone repeats on every probe of one build, so two runs of the same deploy
 * would be indistinguishable in the feed — and Sentry GROUPS identical
 * exceptions, so the second run could read as "arrived" on the first run's
 * event. The nonce makes each run its own question.
 */
export function probeMarker(sha: string | undefined, nonce: string): string {
  return `probe:${sha ?? "unknown"}:${nonce}`;
}

/** Where a probe learned which build it is probing. */
export type ProbeBuildSource = "health" | "deployment" | "checkout" | "unknown";

export interface ProbeBuild {
  /** The commit, or `undefined` when neither road could answer. */
  readonly sha: string | undefined;
  readonly source: ProbeBuildSource;
  /** One line for the receipt, saying WHICH tree the sha names. */
  readonly note: string;
}

/**
 * Which build is being probed, and how that was learned.
 *
 * ⚠ **THE FIRST PRODUCTION RUN OF THE PROBE PRINTED `probe:unknown:…` AND THAT
 * IS THE WHOLE REASON THIS EXISTS (#1542, the relay's finding of 2026-09-30).**
 * `RAILWAY_GIT_COMMIT_SHA` is injected into a container Railway BUILT; it is
 * NOT injected by `railway run`, which is how the probe is actually fired — so
 * the one road the instrument is designed to be used on was the one road where
 * it could not name its subject. An event in the feed that cannot say which
 * build produced it is a finding you cannot act on.
 *
 * # Why the SOURCE travels beside the sha, and is not an implementation detail
 *
 * The two roads name two different trees. Under a deployment the sha IS the
 * running build. Under `railway run` from a worktree the git HEAD is the LOCAL
 * checkout, which names the probed build only if it is what is deployed — true
 * of the relay's own run at `2af09827`, and silently false the moment somebody
 * probes production from a branch. Reporting a checkout sha as though it were
 * the deployment's is exactly the class of confident-and-wrong reading this
 * repository keeps paying for, so the note says which one it is and the caller
 * cannot print the sha without it.
 *
 * # ⚠ AND A THIRD ROAD, WHICH IS THE ONLY ONE THAT CAN NAME THE SERVING BUILD
 * FROM OUTSIDE IT (#1643)
 *
 * When the deploy rite fires this probe it has just read `/api/health` three
 * times, and that response carries `build` — the commit the process now taking
 * traffic was built from. That is a strictly better answer than either road
 * above for the question *"which build is this run about?"*, because neither
 * road can see production at all: `RAILWAY_GIT_COMMIT_SHA` is absent under
 * `railway run`, and the git HEAD is whatever tree the operator happens to be
 * standing in.
 *
 * ⚠ **IT IS PASSED IN RATHER THAN READ HERE, AND THAT IS THE CONTROL RATHER
 * THAN A CONVENIENCE.** Only the caller knows whether its run is ABOUT the
 * deployment. A probe that fetched production's health itself would stamp
 * production's sha onto a laptop run pointed at a localhost DSN — a confident
 * attribution that is wrong in the one direction that matters, and worse than
 * the `checkout` note it would replace. So the rite, which read the artifact
 * and knows what it is probing, hands the sha over; every other road keeps
 * saying `checkout` and is right to.
 *
 * ⚠ **WHAT THE SHA CLAIMS, EXACTLY.** The probe's event is sent by the process
 * running the script, never by the deployed one, so `health` does not mean
 * *"this build emitted the event"*. It means *"the DSN, scrub and transport
 * this run exercised are the ones that build is configured with"* — the same
 * service variables — which is the question a dead pipe is asked. Anything
 * stronger needs an admin-only probe inside the server, which #1542 named and
 * did not build.
 *
 * `gitHead` is injected rather than called here: this module is imported by the
 * server and must never spawn a process, and a reader that shells out cannot be
 * driven over its own failure arm.
 */
export function readProbeBuild(
  /* ⚠ A STRUCTURAL RECORD, NOT `Pick<NodeJS.ProcessEnv, …>`. That is what this
     was first written as, and `pnpm check:scripts` refused it: the scripts
     tsconfig sees `ProcessEnv` as a bare `Dict<string>` with no declared
     members, so a `Pick` makes the key REQUIRED and `process.env` stops being
     assignable. The main typecheck passes it — the two configs load different
     ambient types — which is the whole reason that second check exists. */
  env: { readonly RAILWAY_GIT_COMMIT_SHA?: string | undefined },
  gitHead: () => string | undefined,
  /**
   * `/api/health`'s own `build`, from a caller that read it this run. Absent on
   * every road but the rite's — see the block above for why it is not fetched
   * here.
   */
  healthBuild?: string | undefined,
): ProbeBuild {
  const serving = healthBuild?.trim();
  if (serving) {
    return {
      sha: serving,
      source: "health",
      note:
        "/api/health's `build` — the commit production is SERVING, read by the caller this run. The event " +
        "itself is sent by this process using that service's own DSN, so the sha names the pipe under test, " +
        "not the emitter.",
    };
  }

  const deployed = env.RAILWAY_GIT_COMMIT_SHA?.trim();
  if (deployed) {
    return {
      sha: deployed,
      source: "deployment",
      note: "RAILWAY_GIT_COMMIT_SHA — the build Railway is running.",
    };
  }

  const head = gitHead()?.trim();
  if (head) {
    return {
      sha: head,
      source: "checkout",
      note:
        "git rev-parse HEAD — this working tree, NOT the deployment. It names the probed build only if this " +
        "checkout is what is deployed; compare it against /api/health's `build` before treating it as one.",
    };
  }

  return {
    sha: undefined,
    source: "unknown",
    note:
      "neither RAILWAY_GIT_COMMIT_SHA nor a git HEAD could be read, so the marker cannot say which build " +
      "produced the event. The run is still valid; only its attribution is missing.",
  };
}

/**
 * The probe's error message. A single place so the suite can drive the real
 * scrub over the real text rather than agreeing with a copy of it.
 *
 * It names itself a probe in plain words: whoever finds it in the feed at 3am
 * must not spend a minute wondering whether a customer hit it.
 */
export function probeErrorMessage(marker: string): string {
  return `Klieg tracker probe — deliberate test exception, not a customer error (${marker})`;
}

/**
 * THE PROBE'S MARK — the context it hands `captureServerError`, in ONE place for
 * the same reason the message above is (#1650, 2026-10-01).
 *
 * `kind` reaches Sentry as a tag (`captureServerError` sets it on the scope,
 * `shared/errorEventScrub.ts`'s `ALLOWED_TAG_KEYS` lets it travel), and it is
 * what takes ~35 events a day out of his Errors feed: `!kind:probe`. Read at
 * Sentry's own API on 2026-10-01 rather than assumed — every probe event of the
 * preceding day carries `kind=probe` and `route=scripts/probe-error-tracker.mts`,
 * the real `announcements.getActive` crashes beside them carry `kind=trpc`.
 *
 * ⚠ **IT IS DECLARED HERE RATHER THAN SPELLED AT THE CALL SITE BECAUSE THE
 * SUITE CANNOT RUN THE SCRIPT.** `scripts/probe-error-tracker.mts` needs a
 * Sentry account, so the arms in `server/trackerVerdict.test.ts` drive the
 * scrub over a FIXTURE of the probe's event — and a fixture that spells these
 * two strings itself is a second copy of them, green forever while the script
 * renames its own tag to something his filter does not match (working law 4,
 * and this function's own docblock one paragraph up). Both sides import this.
 */
export const PROBE_ERROR_CONTEXT = {
  /* DERIVED, not spelled (#1650): his admin *Errors* link filters on this exact
     pair and cannot reach this module, so the one declaration both halves read
     is `SENTRY_PROBE_TAG` in `shared/monitoringProjects.ts`. */
  [SENTRY_PROBE_TAG.key]: SENTRY_PROBE_TAG.value,
  route: "scripts/probe-error-tracker.mts",
} as const;

/** Which declaration a slug came from, for the receipt. */
export type ProbeSlugSource = "declared" | "environment";

export interface ProbeSlugs {
  readonly org: string;
  readonly project: string;
  readonly orgSource: ProbeSlugSource;
  readonly projectSource: ProbeSlugSource;
  /** What was actually used, for the receipt — never a reconstruction. */
  readonly note: string;
}

/**
 * WHICH SENTRY ORG AND PROJECT THE READ-BACK ASKS ABOUT.
 *
 * ⚠ **THIS FUNCTION EXISTS BECAUSE THE PROBE DECLINED TO MEASURE WHEN IT HAD
 * EVERYTHING IT NEEDED, AND THAT IS THE MIRROR OF THE DEFECT IT WAS BUILT FOR.**
 * Driven through the deploy rite's own invocation on 2026-10-01
 * (`railway run --service Drape -- npx tsx scripts/probe-error-tracker.mts`),
 * against a pipe that is demonstrably live, it returned:
 *
 *     lookup   not-checked — SENTRY_AUTH_TOKEN is set but SENTRY_ORG/SENTRY_PROJECT are not.
 *     VERDICT  accepted-unverified  (finding)
 *     EXIT     2
 *
 * The same run with the two slugs supplied by hand returned `arrived` / `EXIT 0`
 * on attempt 3. So the pipe was healthy, the token carried `event:read`, and the
 * only thing between the rite and a true verdict was two strings **this
 * repository already declares**. Under #1643 that `EXIT 2` is a `problems` entry,
 * so merging the rite step without this would have withheld
 * `RITE EXIT STATUS: OK` from **every deploy from now on** — an instrument
 * manufacturing the alarm it exists to raise honestly, which is the exact failure
 * `readProbeStep`'s own header refuses one case of and would have shipped in
 * another.
 *
 * # ⚠ Why importing the declaration is not the second copy the probe's docblock feared
 *
 * That docblock said the ids *"come from the environment and have no defaults
 * here"* because the declaration lived in
 * `client/src/features/admin/overview/dashboards.ts`, whose header carries his
 * *"Links — no fourth key"* ruling and says **that module** must never grow a
 * reader. Two things make this different, and both are read at the code rather
 * than argued:
 *
 * 1. **The declaration MOVED** (#1420 part 1). It is `shared/monitoringProjects.ts`
 *    — a module with NO imports, created precisely so a second reader that cannot
 *    reach the client module takes the ids from the one declaration; `vite.config.ts`
 *    is the first such reader and this is the second. `dashboards.ts` now
 *    re-exports. **Importing the one declaration is the opposite of keeping a
 *    second copy** — spelling `klieg-labs` into a script would have been working
 *    law 4's parallel list, and that is what this avoids.
 * 2. **His "no fourth key" ruling was about his PAGE, and the key already exists
 *    because he provisioned it.** He declined a credentialled read-back *on the
 *    admin overview*, so that page cannot carry numbers that disagree with the
 *    dashboard. This probe is not that page: it already reads Sentry's API with
 *    `SENTRY_AUTH_TOKEN`, which he put on the service himself, and his eye
 *    validated that road on #1542. Nothing here widens what the probe reaches —
 *    it only stops it declining to look.
 *
 * ⚠ **AND THE FETCH STAYS OUT OF BOTH DECLARING MODULES.** `monitoringProjects.ts`'s
 * header forbids *it* growing a reader that fetches; the constants flow into this
 * pure verdict module and the `fetch` stays in the script, where it already was.
 *
 * # The environment still wins
 *
 * A set `SENTRY_ORG`/`SENTRY_PROJECT` overrides, so a probe can be pointed at the
 * browser project or a renamed org without a deploy. ⚠ **A BLANK variable is
 * NOT an override** — a Railway variable that exists with an empty value reads as
 * `""`, and `??` would pass that straight through to build
 * `…/projects//events/…`, a 404 read as `lost-in-transit` on a healthy pipe. It
 * is trimmed and an empty result falls back to the declaration.
 */
export function readProbeSlugs(env: {
  readonly SENTRY_ORG?: string | undefined;
  readonly SENTRY_PROJECT?: string | undefined;
}): ProbeSlugs {
  const fromEnvOrg = env.SENTRY_ORG?.trim();
  const fromEnvProject = env.SENTRY_PROJECT?.trim();

  const orgSource: ProbeSlugSource = fromEnvOrg ? "environment" : "declared";
  const projectSource: ProbeSlugSource = fromEnvProject ? "environment" : "declared";
  const org = fromEnvOrg || SENTRY_ORG;
  const project = fromEnvProject || SENTRY_SERVER_PROJECT;

  const both = orgSource === projectSource ? orgSource : null;
  const note =
    both === "declared"
      ? `${org}/${project}, from shared/monitoringProjects.ts — the ids this repository declares.`
      : both === "environment"
        ? `${org}/${project}, both from the environment, overriding the declared ids.`
        : `${org}/${project} — org from the ${orgSource === "environment" ? "environment" : "declaration"},`
          + ` project from the ${projectSource === "environment" ? "environment" : "declaration"}.`;

  return { org, project, orgSource, projectSource, note };
}
