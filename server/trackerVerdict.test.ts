/**
 * THE PROBE'S READER, DRIVEN (#1542) — every verdict, and the probe's own event
 * put through the real scrub.
 *
 * # Why this suite exists and the probe script cannot stand alone
 *
 * `scripts/probe-error-tracker.mts` needs a Sentry account to say anything, so
 * nothing in CI can run it. Its judgement is therefore a pure function in
 * `server/monitoring/trackerVerdict.ts`, and this is where that function is
 * proven — including the branch nobody wants to discover in production, where an
 * accepted event never arrives.
 *
 * # ⚠ THE ARM THAT MATTERS MOST IS THE SCRUB ONE, AND IT IS NOT ABOUT VERDICTS
 *
 * #1542's own done-when: *"Scrub arms still refuse the recipe keys; the probe
 * carries none."* A probe whose event the projection refuses is worse than no
 * probe: it would report `scrub-refused` on every run, for a reason that is the
 * probe's own fault, and the reader would go hunting a defect in the scrub. So
 * the probe's real message goes through the REAL `scrubErrorEvent` here, with a
 * positive control beside it proving that same scrub still refuses a recipe key
 * — because an arm that only shows a pass cannot tell "the probe is clean" from
 * "the scrub stopped refusing anything" (working law 2, and invariant 7).
 */
import { describe, expect, it } from "vitest";

import {
  probeErrorMessage,
  probeMarker,
  readProbeBuild,
  readProbeSlugs,
  readTrackerProbe,
  type TrackerProbeFacts,
} from "./monitoring/trackerVerdict";
import { scrubErrorEvent } from "../shared/errorEventScrub";
import { SENTRY_ORG, SENTRY_SERVER_PROJECT } from "../shared/monitoringProjects";

/** A healthy, arrived run — every arm below is this with one fact changed. */
const arrived: TrackerProbeFacts = {
  configured: true,
  ready: true,
  sent: 1,
  refused: 0,
  eventId: "abc123def456",
  lookup: "arrived",
};

describe("the tracker probe's verdict (#1542)", () => {
  it("calls an arrived event healthy, and names the event id", () => {
    const reading = readTrackerProbe(arrived);
    expect(reading.verdict).toBe("arrived");
    expect(reading.healthy).toBe(true);
    expect(reading.summary).toContain("abc123def456");
  });

  it("calls an accepted event Sentry does not have LOST IN TRANSIT — the dead pipe", () => {
    const reading = readTrackerProbe({ ...arrived, lookup: "absent" });
    expect(reading.verdict).toBe("lost-in-transit");
    expect(reading.healthy).toBe(false);
    expect(reading.summary).toContain("DSN");
  });

  it("REFUSES to call an unchecked run healthy — the whole point of the instrument", () => {
    // If this arm ever goes green-and-healthy, the probe has become the lying
    // control it was built to replace: "the SDK took it" is not "Sentry has it".
    const reading = readTrackerProbe({ ...arrived, lookup: "not-checked" });
    expect(reading.verdict).toBe("accepted-unverified");
    expect(reading.healthy).toBe(false);
    expect(reading.summary).toContain("UNPROVEN");
  });

  it("REFUSES to call a run healthy when the read-back itself failed", () => {
    const reading = readTrackerProbe({ ...arrived, lookup: "unreadable" });
    expect(reading.verdict).toBe("accepted-unverified");
    expect(reading.healthy).toBe(false);
  });

  it("says there is no tracker when no DSN is set, without implying a defect on a laptop", () => {
    const reading = readTrackerProbe({ ...arrived, configured: false });
    expect(reading.verdict).toBe("no-tracker");
    expect(reading.healthy).toBe(false);
    expect(reading.summary).toContain("laptop");
  });

  it("distinguishes a DSN that never became ready from one that is not set", () => {
    const reading = readTrackerProbe({ ...arrived, ready: false });
    expect(reading.verdict).toBe("not-ready");
    expect(reading.summary).toContain("boot log");
  });

  it("blames the SCRUB when the probe's own event was refused, not the transport", () => {
    // The narrowest true claim. `refused: 1` also means `sent: 0` and no id, and
    // reporting "the SDK did not accept it" would point the next reader at the
    // transport instead of at the projection.
    const reading = readTrackerProbe({ ...arrived, sent: 0, refused: 1, eventId: undefined });
    expect(reading.verdict).toBe("scrub-refused");
    expect(reading.summary).toContain("refusedKey");
  });

  it("reports not-accepted only when nothing was refused and no id came back", () => {
    const reading = readTrackerProbe({ ...arrived, sent: 0, refused: 0, eventId: undefined });
    expect(reading.verdict).toBe("not-accepted");
    expect(reading.summary).toContain("inside the SDK");
  });

  it("treats an id with a zero sent count as not accepted rather than arrived", () => {
    // Belt and braces on the counter: an id without a scrub pass is not a send.
    const reading = readTrackerProbe({ ...arrived, sent: 0 });
    expect(reading.verdict).toBe("not-accepted");
  });

  it("gives every verdict a summary that says what to do", () => {
    const facts: TrackerProbeFacts[] = [
      arrived,
      { ...arrived, lookup: "absent" },
      { ...arrived, lookup: "not-checked" },
      { ...arrived, lookup: "unreadable" },
      { ...arrived, configured: false },
      { ...arrived, ready: false },
      { ...arrived, sent: 0, refused: 1, eventId: undefined },
      { ...arrived, sent: 0, refused: 0, eventId: undefined },
    ];
    for (const fact of facts) {
      const reading = readTrackerProbe(fact);
      expect(reading.summary.length).toBeGreaterThan(40);
      expect(reading.verdict).not.toBe("");
    }
  });
});

describe("the probe's marker (#1542)", () => {
  it("carries the commit and a per-run nonce, so two runs of one build differ", () => {
    // Sentry GROUPS identical exceptions. Without the nonce a second probe of the
    // same deploy could read as arrived on the FIRST run's event, which is a
    // false green on exactly the question being asked.
    const first = probeMarker("abcdef1", "run-one");
    const second = probeMarker("abcdef1", "run-two");
    expect(first).not.toBe(second);
    expect(first).toContain("abcdef1");
    expect(first.startsWith("probe:")).toBe(true);
  });

  it("says unknown rather than omitting the field when there is no sha", () => {
    expect(probeMarker(undefined, "n")).toBe("probe:unknown:n");
  });

  it("names itself a probe in plain words a human reading the feed will understand", () => {
    const message = probeErrorMessage(probeMarker("abcdef1", "n"));
    expect(message).toContain("probe");
    expect(message).toContain("not a customer error");
  });
});

/**
 * ⚠ WHICH BUILD THE PROBE PROBED — the finding the first production run
 * produced about itself (#1542, 2026-09-30).
 *
 * It printed `probe:unknown:munjylwl-jxuq79`. `RAILWAY_GIT_COMMIT_SHA` is set
 * inside a container Railway BUILT and is not injected by `railway run`, which
 * is the only road the probe is actually fired on — so the instrument could not
 * name its own subject on the one road it is used.
 *
 * The two arms that matter are not "does it find a sha". They are that the
 * DEPLOYMENT road wins when both are available, and that the CHECKOUT road says
 * out loud that it is naming a local tree: a checkout sha reported as a
 * deployment's sends the next reader to audit the wrong build, which is the
 * confident-and-wrong reading this repository keeps paying for. `gitHead` is
 * injected, so the failure road is driven rather than hoped for.
 */
describe("⚠ which build the probe probed, and how it knows (#1542)", () => {
  const DEPLOYED = "2af098270000000000000000000000000000abcd";
  const HEAD = "689424b6b886e94dede6555df8e4a313de0b2e9e";
  const never = () => {
    throw new Error("git must not be asked when the deployment sha is present");
  };

  it("takes RAILWAY_GIT_COMMIT_SHA when it is set — that IS the running build", () => {
    const build = readProbeBuild({ RAILWAY_GIT_COMMIT_SHA: DEPLOYED }, never);
    expect(build).toMatchObject({ sha: DEPLOYED, source: "deployment" });
    expect(build.note).toContain("RAILWAY_GIT_COMMIT_SHA");
  });

  it("⚠ prefers the deployment over the checkout, and does not even ask git", () => {
    /* `never` throwing is the assertion: a reader that consulted git first would
       take the LOCAL tree's answer inside a deployed container, which is the
       wrong sha reported with full confidence. */
    expect(() => readProbeBuild({ RAILWAY_GIT_COMMIT_SHA: DEPLOYED }, never)).not.toThrow();
  });

  it("falls back to git HEAD when the env is absent — the `railway run` road", () => {
    const build = readProbeBuild({}, () => HEAD);
    expect(build).toMatchObject({ sha: HEAD, source: "checkout" });
  });

  it("⚠ SAYS the checkout sha is not the deployment's, so it cannot be misread", () => {
    const build = readProbeBuild({}, () => HEAD);
    expect(build.note).toContain("NOT the deployment");
    expect(build.note).toContain("/api/health");
  });

  it("trims what either road hands back — a captured sha carries a newline", () => {
    /* `git rev-parse HEAD` ends in one, and a marker with a newline inside it is
       unsearchable in the feed it exists to be found in. */
    expect(readProbeBuild({}, () => HEAD + String.fromCharCode(10)).sha).toBe(HEAD);
    expect(readProbeBuild({ RAILWAY_GIT_COMMIT_SHA: ` ${DEPLOYED} ` }, never).sha).toBe(DEPLOYED);
  });

  it("treats an EMPTY env value as absent, not as a sha — a blank Railway variable is \"\"", () => {
    expect(readProbeBuild({ RAILWAY_GIT_COMMIT_SHA: "" }, () => HEAD).source).toBe("checkout");
    expect(readProbeBuild({ RAILWAY_GIT_COMMIT_SHA: "   " }, () => HEAD).source).toBe("checkout");
  });

  it("says unknown when neither road answers, and calls the RUN valid anyway", () => {
    const build = readProbeBuild({}, () => undefined);
    expect(build).toMatchObject({ sha: undefined, source: "unknown" });
    /* The attribution is missing; the measurement is not. A note that read as a
       failed run would send a reader to re-fire a probe that worked. */
    expect(build.note).toContain("still valid");
  });

  it("feeds the marker, so an unknown build still produces a findable event", () => {
    const build = readProbeBuild({}, () => undefined);
    expect(probeMarker(build.sha, "run-one")).toBe("probe:unknown:run-one");
  });

  /**
   * ⚠ THE THIRD ROAD (#1643) — the only one that can name the SERVING build from
   * outside it. The deploy rite has just read `/api/health` three times, so it
   * holds the sha of the process now taking traffic; neither road above can see
   * production at all.
   */
  describe("the rite's road: /api/health's own build (#1643)", () => {
    const SERVING = "4942f8b465f9067e8ef25f06a55bbd54cb0ed0f2";

    it("takes the health sha when the caller hands one over", () => {
      const build = readProbeBuild({}, () => HEAD, SERVING);
      expect(build).toMatchObject({ sha: SERVING, source: "health" });
      expect(build.note).toContain("/api/health");
      expect(build.note).toContain("SERVING");
    });

    it("⚠ OUTRANKS both older roads, and does not ask git at all", () => {
      /* A deployed container that is ALSO handed health's answer: the two agree on
         a normal night, and when they do not, the one that read the running
         process wins. `never` throwing is the assertion. */
      const build = readProbeBuild({ RAILWAY_GIT_COMMIT_SHA: DEPLOYED }, never, SERVING);
      expect(build.sha).toBe(SERVING);
      expect(build.source).toBe("health");
    });

    it("⚠ SAYS the event was not emitted by that build, so the sha cannot be over-read", () => {
      /* The probe's event is sent by the script's process on the service's DSN.
         The sha names the PIPE under test, not the emitter, and a note that let
         that be misread would invite exactly the confident-wrong reading the two
         older notes exist to prevent. */
      const build = readProbeBuild({}, () => HEAD, SERVING);
      expect(build.note).toContain("sent by this process");
      expect(build.note).toContain("not the emitter");
    });

    it("treats absent, empty and blank as NOT PASSED — falls back rather than reporting a hole", () => {
      /* `/api/health` returns `build: null` when the service names no commit, and
         the reader turns that into `null`, so `--health-build` is simply not
         passed. Were a blank to win here, the marker would read `probe::nonce`. */
      for (const nothing of [undefined, "", "   "]) {
        expect(readProbeBuild({}, () => HEAD, nothing).source).toBe("checkout");
      }
      expect(readProbeBuild({}, () => undefined, "").source).toBe("unknown");
    });

    it("trims it, exactly as it trims the other two", () => {
      expect(readProbeBuild({}, never, ` ${SERVING}\n`).sha).toBe(SERVING);
    });
  });
});

describe("the probe's event against the REAL scrub (#1542's own done-when)", () => {
  const IMAGE_ORIGIN = "https://pub-example.r2.dev";

  /** The event shape the probe actually produces, as the scrub receives it. */
  const probeEvent = (message: string) => ({
    event_id: "abc123def456",
    message,
    tags: { kind: "probe", route: "scripts/probe-error-tracker.mts", world: "railway:production" },
    exception: {
      values: [{ type: "Error", value: message, stacktrace: { frames: [{ filename: "scripts/probe-error-tracker.mts" }] } }],
    },
  });

  it("PASSES the scrub — the probe carries no recipe field", () => {
    const verdict = scrubErrorEvent(probeEvent(probeErrorMessage(probeMarker("abcdef1", "n"))), IMAGE_ORIGIN);
    expect(verdict.verdict).not.toBe("refuse");
  });

  it("and that same scrub STILL refuses a recipe key (the positive control)", () => {
    // Without this, the arm above cannot tell "the probe is clean" from "the
    // scrub has stopped refusing anything" — which is how a guard goes green by
    // going blind.
    const withRecipe = {
      ...probeEvent("anything"),
      extra: { masterPrompt: "a customer's recipe" },
    };
    const verdict = scrubErrorEvent(withRecipe, IMAGE_ORIGIN);
    expect(verdict.verdict).toBe("refuse");
  });
});

/**
 * ⚠ WHICH ORG AND PROJECT THE READ-BACK ASKS ABOUT (#1643's remainder, 2026-10-01).
 *
 * The defect these arms exist for was found by DRIVING the rite's own invocation
 * rather than by reading: the probe declined the read-back because
 * `SENTRY_ORG`/`SENTRY_PROJECT` are not set on the service, returned
 * `accepted-unverified` / `EXIT 2` over a pipe that then proved `arrived` the
 * moment the two declared slugs were supplied — and under #1643 that exit is a
 * `problems` entry, so it would have cost every future deploy its
 * `RITE EXIT STATUS: OK`.
 *
 * ⚠ **THE EXPECTATIONS ARE DERIVED FROM THE DECLARATION, NEVER SPELLED AGAIN
 * HERE.** A test that hardcodes `"klieg-labs"` is the second copy the whole
 * one-edit promise exists to prevent (working law 4) — it would pass while a
 * renamed project silently pointed the probe at nothing. The one literal arm
 * asserts only that the declaration is non-empty and slug-shaped, which is the
 * fact a derived comparison cannot notice going wrong.
 */
describe("the probe's org and project (#1643 remainder)", () => {
  it("falls back to the ids this repository declares when the environment says nothing", () => {
    const slugs = readProbeSlugs({});

    expect(slugs.org).toBe(SENTRY_ORG);
    expect(slugs.project).toBe(SENTRY_SERVER_PROJECT);
    expect(slugs.orgSource).toBe("declared");
    expect(slugs.projectSource).toBe("declared");
    expect(slugs.note).toContain("shared/monitoringProjects.ts");
  });

  it("is the SERVER project, not the browser one — the probe reports through the node SDK", () => {
    expect(readProbeSlugs({}).project).toBe(SENTRY_SERVER_PROJECT);
  });

  it("lets the environment override both, so a probe can be pointed elsewhere without a deploy", () => {
    const slugs = readProbeSlugs({ SENTRY_ORG: "other-org", SENTRY_PROJECT: "other-project" });

    expect(slugs.org).toBe("other-org");
    expect(slugs.project).toBe("other-project");
    expect(slugs.orgSource).toBe("environment");
    expect(slugs.projectSource).toBe("environment");
    expect(slugs.note).toContain("overriding the declared ids");
  });

  /*
    ⚠ THE ARM THIS FUNCTION WAS WRITTEN AROUND. A Railway variable that exists
    with an empty value arrives as `""`, which `??` passes straight through — the
    URL becomes `…/projects//events/…`, Sentry answers 404 for ninety seconds and
    the probe reports `lost-in-transit` on a healthy pipe. That is the expensive
    verdict to get wrong, because it sends the next reader to audit a DSN that is
    fine. Replace `||` with `??` in `readProbeSlugs` and these two go red.
  */
  it("treats a BLANK variable as absent rather than as an override", () => {
    const slugs = readProbeSlugs({ SENTRY_ORG: "", SENTRY_PROJECT: "" });

    expect(slugs.org).toBe(SENTRY_ORG);
    expect(slugs.project).toBe(SENTRY_SERVER_PROJECT);
    expect(slugs.orgSource).toBe("declared");
  });

  it("treats a whitespace-only variable as absent too", () => {
    const slugs = readProbeSlugs({ SENTRY_ORG: "   ", SENTRY_PROJECT: "	" });

    expect(slugs.org).toBe(SENTRY_ORG);
    expect(slugs.project).toBe(SENTRY_SERVER_PROJECT);
  });

  it("trims a real override rather than carrying the operator's spaces into the URL", () => {
    expect(readProbeSlugs({ SENTRY_ORG: "  spaced-org  " }).org).toBe("spaced-org");
  });

  it("says which side came from where when only one is overridden", () => {
    const slugs = readProbeSlugs({ SENTRY_PROJECT: "klieg-web" });

    expect(slugs.org).toBe(SENTRY_ORG);
    expect(slugs.orgSource).toBe("declared");
    expect(slugs.project).toBe("klieg-web");
    expect(slugs.projectSource).toBe("environment");
    expect(slugs.note).toContain("org from the declaration");
    expect(slugs.note).toContain("project from the environment");
  });

  /*
    The positive control on the declaration itself. Every arm above compares the
    resolver against the constants, so all of them would still pass if both
    constants were emptied — and the probe would then build a URL with two empty
    segments. This is the one thing that cannot be derived.
  */
  it("⚠ positive control — the declared ids are real slugs, which no derived arm above can notice", () => {
    for (const slug of [SENTRY_ORG, SENTRY_SERVER_PROJECT]) {
      expect(slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(slug.length).toBeGreaterThan(2);
    }
  });

  /*
    ⚠ AND THE READ-BACK IS NEVER REPORTED AS DONE WITHOUT THE TOKEN. The slugs
    having a default must not leak into the credential: the probe's refusal half
    is what makes it an instrument, and a resolver that answered for the token too
    would have turned `not-checked` into a silent green.
  */
  it("resolves ids only — it says nothing about the credential", () => {
    const slugs = readProbeSlugs({});

    expect(Object.keys(slugs).sort()).toEqual(["note", "org", "orgSource", "project", "projectSource"]);
    expect(JSON.stringify(slugs)).not.toContain("TOKEN");
  });
});
