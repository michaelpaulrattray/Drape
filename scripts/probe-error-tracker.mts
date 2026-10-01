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
 * ⚠ **AND THE MIRROR OF THAT IS ALSO A DEFECT, WHICH IS WHAT 2026-10-01 FIXED:
 * AN INSTRUMENT THAT DECLINES TO MEASURE WHEN IT CAN.** Refusing to guess a
 * missing credential is honest; refusing to read an id the tree declares is a
 * finding reported over a healthy pipe, and it sends the next reader to audit a
 * DSN that is fine. The token is still never assumed.
 *
 * # The ids are NOT copied into this file — they are IMPORTED from the one declaration
 *
 * ⚠ **THIS SECTION SAID THE OPPOSITE UNTIL 2026-10-01 AND IT COST THE RITE ITS
 * VERDICT.** It read *"come from the environment and have no defaults here …
 * pass them, or the read-back declines rather than guessing"*, citing
 * `client/src/features/admin/overview/dashboards.ts` and his *"Links — no fourth
 * key"* ruling. Driven through the rite's own invocation against a live pipe,
 * that produced `not-checked` → `accepted-unverified` → `EXIT 2`, which #1643
 * reads as a `problems` entry — so every deploy receipt would have lost
 * `RITE EXIT STATUS: OK` forever, over two strings this repository declares.
 *
 * `readProbeSlugs` (`server/monitoring/trackerVerdict.ts`) carries the full
 * reading, including why his ruling does not bind this script. In short: the
 * declaration MOVED to `shared/monitoringProjects.ts` (#1420 part 1), a
 * no-imports module made for exactly this — a node-side reader that cannot reach
 * the client module — and importing the one declaration is the opposite of the
 * second copy that section feared. His ruling was about his PAGE not growing a
 * credentialled reader; this script has read Sentry's API with his own
 * `SENTRY_AUTH_TOKEN` since #1542, with his eye on that road.
 *
 * `SENTRY_ORG`/`SENTRY_PROJECT` still OVERRIDE when set, so the probe can be
 * pointed at the browser project without a deploy. A blank variable is not an
 * override.
 *
 * # Usage
 *
 *   npx tsx scripts/probe-error-tracker.mts                 # this process's env
 *   railway.cmd run --service Drape -- npx tsx scripts/probe-error-tracker.mts
 *   … -- npx tsx scripts/probe-error-tracker.mts --health-build <sha>
 *
 * `--health-build` is `/api/health`'s own `build` field, and it is the deploy
 * rite's road (#1643): the rite has just read it three times, so it can say
 * which build production is SERVING, which neither the environment nor this
 * checkout can. Passing anything else under that name is a lie the marker will
 * carry into the feed — see `readProbeBuild`'s header.
 *
 * Exit 0 only on `arrived`. Any other verdict exits 2 — a finding, in the
 * gate-stall-check sense, so a rite step or `deploy-verify` can read it.
 *
 * ⚠ **AND THE CODE IS PRINTED AS `EXIT <n>` ON STDOUT, WHICH IS THE READING TO
 * KEY ON.** The first production run returned 1 while having printed its
 * verdict correctly, because the process aborted in libuv on the way out; the
 * line is decided before any teardown and cannot be taken by one. See the
 * comment at the foot of this file.
 *
 * # What this does NOT cover, named rather than left to be assumed
 *
 * **The BROWSER tracker.** #1542 asks for a marked exception through the browser
 * tracker too, and a browser tracker needs a browser: a served bundle, a page
 * and `VITE_SENTRY_DSN`. It is a separate instrument with a separate road (the
 * `verify` recipe), not a branch of this script, and it is still owed on the
 * card. ⚠ What it no longer lacks is the KEY: `captureClientError` returns
 * Sentry's event id as of #1542, where it was typed `=> void` and discarded —
 * so when that road exists there is something for it to ask the vendor about.
 * Driving it still needs a DSN this machine does not have. **PostHog is not covered either and does not need to be** — the founder
 * read its Activity view himself on 2026-09-30 and the product-event pipe is
 * proven live, which is why the card narrowed to Sentry alone.
 */
import "dotenv/config";

import { execFileSync } from "node:child_process";

import {
  captureServerError,
  closeErrorTracker,
  errorTrackerStatus,
  flushErrorTracker,
  initErrorTracker,
} from "../server/monitoring/errorTracker";
import {
  PROBE_ERROR_CONTEXT,
  probeErrorMessage,
  probeMarker,
  readProbeBuild,
  readProbeSlugs,
  readTrackerProbe,
  type VendorLookup,
} from "../server/monitoring/trackerVerdict";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

/*
  THE WHOLE VOCABULARY, DECLARED ONCE. Until #1643 this script read no arguments
  at all, so `--dry-run` — the safest-sounding word an operator can type at a
  script that WRITES to a vendor — would have been ignored and the event sent
  anyway. That is `strictArgs.mts`'s own founding incident, one script over.
*/
const args = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["health-build"],
  boolean: [],
});

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
  const { org, project, note: slugNote } = readProbeSlugs(process.env);

  if (!token) {
    return {
      lookup: "not-checked",
      note: "SENTRY_AUTH_TOKEN is not set in this process, so Sentry was never asked.",
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
          note: `Sentry answered 200 for the event id on attempt ${attempts} · ${slugNote}`,
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

/**
 * This checkout's HEAD, or `undefined` when there is no git to ask.
 *
 * `execFileSync` rather than a shell: no interpolation, nothing to quote, and a
 * failure is an exception rather than a string that looks like a sha. A
 * production container has no `.git`, which is not an error here — it is the
 * road where `RAILWAY_GIT_COMMIT_SHA` answers instead.
 */
const gitHead = (): string | undefined => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
};

const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const build = readProbeBuild(process.env, gitHead, args.value("health-build") ?? undefined);
const marker = probeMarker(build.sha, nonce);

console.log("— error tracker probe (#1542) —");
console.log(`marker   ${marker}`);
/* ⚠ THE SOURCE IS PRINTED BESIDE THE SHA, NEVER THE SHA ALONE. A checkout sha
   read as a deployment sha sends the next reader to audit the wrong build —
   see `readProbeBuild`'s header for the two trees it can name. */
console.log(`build    ${build.source} — ${build.note}`);

const bootLine = await initErrorTracker();
console.log(`boot     ${bootLine}`);

const before = errorTrackerStatus();

/* The real crash path, with the real options and the real scrub. `kind: "probe"`
   rides as a tag so the event is filterable in the feed as well as findable by
   its marker.

   ⚠ THAT IS READ AT SENTRY'S OWN API RATHER THAN BELIEVED FROM HERE (#1650,
   2026-10-01). `GET /api/0/projects/klieg-labs/klieg-server/events/` returns
   `kind=probe · route=scripts/probe-error-tracker.mts` on every probe event,
   beside `kind=trpc` on the real crashes of the same day — so `!kind:probe` is
   the whole filter, and #1650's request for a SECOND `probe` tag was declined
   as the eighth entry on a seven-key allowlist carrying what the seventh
   already carries (working law 4). The tag's survival through the projection is
   pinned in `server/trackerVerdict.test.ts`; without that arm, dropping `kind`
   from `ALLOWED_TAG_KEYS` would stop his filter matching with nothing red. */
const eventId = await captureServerError(new Error(probeErrorMessage(marker)), {
  ...PROBE_ERROR_CONTEXT,
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

/**
 * ⚠ THE EXIT CODE IS PRINTED AS A LINE, BECAUSE THE FIRST PRODUCTION RUN'S CODE
 * WAS A LIE (#1542, the relay's second finding of 2026-09-30).
 *
 * That run printed `accepted-unverified` and then died at exit inside libuv
 * (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, `win/async.c`),
 * returning **1** rather than the 2 the docblock promises — so a rite step
 * reading the code alone would have filed a FINDING as an ordinary failure, and
 * the verdict it had already printed correctly would have been overridden by
 * the way the process happened to end.
 *
 * So the contract is carried twice, and the cheap copy is the one that cannot be
 * taken by a teardown crash: `EXIT <n>` on stdout, decided BEFORE anything is
 * torn down. A caller keys on this line and uses the code as agreement, not as
 * the source. That is deliberately the opposite of the usual rule — here the
 * exit code is the derived reading and the line is the measurement.
 */
const code = reading.healthy ? 0 : 2;
console.log(`EXIT     ${code}`);

/* CLOSE, not just flush: this process is about to end, and `flushErrorTracker`
   leaves the client and its OpenTelemetry handles alive — which is right for
   the server and is the resident-script defect for a script. It is the SDK's own
   documented teardown and it is the shape most likely to settle the assertion
   above; it is NOT claimed as proven, because the crash needs a real ingest
   endpoint and a localhost DSN exits cleanly (measured 2026-10-01). */
await closeErrorTracker(10_000);

process.exit(code);
