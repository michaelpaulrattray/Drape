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
  readTrackerProbe,
  type TrackerProbeFacts,
} from "./monitoring/trackerVerdict";
import { scrubErrorEvent } from "../shared/errorEventScrub";

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
