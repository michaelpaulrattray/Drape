/**
 * THE POSITIVE CONTROL FOR THE ERROR TRACKER (#1542) — so a quiet Sentry feed
 * can be told from a dead pipe.
 *
 * Founder-found, 2026-09-30: he clicked *Errors*, reached the right project, and
 * read Sentry's **"Get Started … Set up the Sentry SDK for klieg-server"** panel
 * — which Sentry draws only while a project has received no event, EVER — over a
 * server that had printed `[Errors] reporting to Sentry` at every boot for three
 * days. Nothing in the product could say which of the two explanations was true.
 *
 * Working law 2: *an instrument gets a positive control before its verdicts count
 * for anything.* This is that control, and #1419's own lesson one level up — it
 * was filed because *"0 errors today"* over an unconfigured tracker is a lie, and
 * the tracker then shipped with the same hole in its own arrival.
 *
 * # What it does
 *
 *   1. starts the REAL tracker with the REAL options (nothing is stubbed);
 *   2. throws a marked exception through the REAL `captureServerError`, which is
 *      the same function every crash path in the product calls — not a copy of
 *      it, so the probe cannot pass while the real road is broken (working law
 *      4, and CLAUDE.md's `footprint-is-the-field-one-road-writes` class);
 *   3. reads Sentry's own event id back out of the capture, and the `sent` /
 *      `refused` counters the tracker has kept since #509 and nobody read;
 *   4. flushes the transport, then asks SENTRY'S OWN API whether that event id
 *      is in the project;
 *   5. prints one verdict from `server/monitoring/trackerVerdict.ts`.
 *
 * # ⚠ WHAT IT REFUSES TO DO, WHICH IS THE HALF THAT MAKES IT AN INSTRUMENT
 *
 * With no `SENTRY_AUTH_TOKEN` it does **not** report success. It reports
 * `accepted-unverified` and exits non-zero, because "the SDK took it" is not
 * "Sentry has it" — that gap is the entire subject of the card. An instrument
 * that goes green when it could not perform its measurement is the lying control
 * this repository has paid for three times over.
 *
 * # The ids are NOT copied into this file
 *
 * `SENTRY_ORG` and `SENTRY_PROJECT` come from the environment and have no
 * defaults here. The org and both project slugs are DECLARED once, in
 * `client/src/features/admin/overview/dashboards.ts` (his own instruction on
 * #1441: *"Put the three ids in one declared constant so a renamed project is
 * one edit"*), and that module's docblock forbids it growing a vendor reader —
 * so this script neither imports it nor keeps a second copy of its values.
 * Pass them, or the read-back declines rather than guessing.
 *
 * # Usage
 *
 *   npx tsx scripts/probe-error-tracker.mts                 # this process's env
 *   railway.cmd run --service Drape -- npx tsx scripts/probe-error-tracker.mts
 *
 * Exit 0 only on `arrived`. Any other verdict exits 2 — a finding, in the
 * gate-stall-check sense, so a rite step or `deploy-verify` can read it.
 *
 * # What this does NOT cover, named rather than left to be assumed
 *
 * **The BROWSER tracker.** #1542 asks for a marked exception through the browser
 * tracker too, and a browser tracker needs a browser: a served bundle, a page
 * and `VITE_SENTRY_DSN`. It is a separate instrument with a separate road (the
 * `verify` recipe), not a branch of this script, and it is still owed on the
 * card. **PostHog is not covered either and does not need to be** — the founder
 * read its Activity view himself on 2026-09-30 and the product-event pipe is
 * proven live, which is why the card narrowed to Sentry alone.
 */
import "dotenv/config";

import {
  captureServerError,
  errorTrackerStatus,
  flushErrorTracker,
  initErrorTracker,
} from "../server/monitoring/errorTracker";
import {
  probeErrorMessage,
  probeMarker,
  readTrackerProbe,
  type VendorLookup,
} from "../server/monitoring/trackerVerdict";

/**
 * How long to keep asking Sentry before calling an event absent.
 *
 * ⚠ **A READ-BACK WITH NO PATIENCE MANUFACTURES THE VERY FINDING IT IS LOOKING
 * FOR.** Ingestion is not synchronous with the transport's 200, so a single
 * immediate lookup on a perfectly healthy pipe returns 404 — and `lost-in-transit`
 * is the expensive verdict to get wrong, because it sends the next reader to
 * audit a DSN that is fine. Absent means absent AFTER this window, and the output
 * says the window so the claim can be read at its own bound.
 */
const LOOKUP_WINDOW_MS = 90_000;
const LOOKUP_INTERVAL_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface LookupOutcome {
  readonly lookup: VendorLookup;
  /** What was actually done, for the receipt — never a reconstruction. */
  readonly note: string;
}

/**
 * Ask Sentry whether it has this event id.
 *
 * `GET /api/0/projects/{org}/{project}/events/{id}/` — 200 is arrived, 404 is
 * not-yet-or-never, and anything else is a question that got no answer rather
 * than an answer of no.
 */
async function lookUpAtSentry(eventId: string): Promise<LookupOutcome> {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();

  if (!token) {
    return {
      lookup: "not-checked",
      note: "SENTRY_AUTH_TOKEN is not set in this process, so Sentry was never asked.",
    };
  }
  if (!org || !project) {
    return {
      lookup: "not-checked",
      note:
        "SENTRY_AUTH_TOKEN is set but SENTRY_ORG/SENTRY_PROJECT are not. This script keeps no copy of the slugs " +
        "on purpose — they are declared in client/src/features/admin/overview/dashboards.ts. Pass them and re-run.",
    };
  }

  const url = `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/events/${encodeURIComponent(eventId)}/`;
  const deadline = Date.now() + LOOKUP_WINDOW_MS;
  let attempts = 0;
  let lastStatus = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      lastStatus = response.status;
      if (response.status === 200) {
        return {
          lookup: "arrived",
          note: `Sentry answered 200 for the event id on attempt ${attempts} (${org}/${project}).`,
        };
      }
      if (response.status !== 404) {
        /* 401/403 is a token problem and 5xx is Sentry's; neither is evidence
           the event is missing, and retrying a 401 for 90 seconds learns
           nothing. */
        return {
          lookup: "unreadable",
          note: `Sentry answered ${response.status} for ${org}/${project} — the read-back could not be performed.`,
        };
      }
    } catch (error) {
      return {
        lookup: "unreadable",
        note: `The read-back request itself failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    await sleep(LOOKUP_INTERVAL_MS);
  }

  return {
    lookup: "absent",
    note:
      `Sentry answered ${lastStatus} (not found) on every one of ${attempts} attempts across ` +
      `${Math.round(LOOKUP_WINDOW_MS / 1000)}s for ${org}/${project}.`,
  };
}

const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const sha = process.env.RAILWAY_GIT_COMMIT_SHA?.trim() || undefined;
const marker = probeMarker(sha, nonce);

console.log("— error tracker probe (#1542) —");
console.log(`marker   ${marker}`);

const bootLine = await initErrorTracker();
console.log(`boot     ${bootLine}`);

const before = errorTrackerStatus();

/* The real crash path, with the real options and the real scrub. `kind: "probe"`
   rides as a tag so the event is filterable in the feed as well as findable by
   its marker. */
const eventId = await captureServerError(new Error(probeErrorMessage(marker)), {
  kind: "probe",
  route: "scripts/probe-error-tracker.mts",
});

await flushErrorTracker(10_000);

const after = errorTrackerStatus();
const sent = after.sent - before.sent;
const refused = after.refused - before.refused;

console.log(`eventId  ${eventId ?? "(none — the SDK returned no id)"}`);
console.log(`counters sent +${sent} · refused +${refused} · configured=${after.configured} ready=${after.ready}`);

const outcome =
  eventId === undefined
    ? { lookup: "not-checked" as VendorLookup, note: "No event id, so there was nothing to look up." }
    : await lookUpAtSentry(eventId);

console.log(`lookup   ${outcome.lookup} — ${outcome.note}`);

const reading = readTrackerProbe({
  configured: after.configured,
  ready: after.ready,
  sent,
  refused,
  eventId,
  lookup: outcome.lookup,
});

console.log("");
console.log(`VERDICT  ${reading.verdict}${reading.healthy ? "" : "  (finding)"}`);
console.log(reading.summary);

if (!reading.healthy) {
  console.log("");
  console.log("Record this on #1542: the verdict, the event id, and the lookup note above.");
}

process.exit(reading.healthy ? 0 : 2);
