/**
 * IS PRODUCTION SERVING THE COMMIT ON `main`? — the command behind
 * `.github/workflows/production-currency.yml` (#2748).
 *
 * The reasoning, the grace and every verdict live in
 * `scripts/lib/productionCurrency.mts`, which is where they can be driven.
 * This file is the transport: it runs `gh`, reads `/api/health`, prints the
 * sentence, and exits.
 *
 * It is deliberately runnable BY HAND, for the reason `team-silence-check.mts`
 * is: a triggered reading and a hand reading must not be able to disagree, so
 * there is one command and the workflow calls it.
 *
 *     npx tsx scripts/production-currency-check.mts
 *     npx tsx scripts/production-currency-check.mts --grace 10   # tighten for a look
 *
 * Exit codes, as the house uses them:
 *
 *     0   production serves the tip of `main`, or a deploy of it is still
 *         inside the window a deploy on record may take
 *     2   THE FINDING — production is serving an older commit and nothing
 *         Railway says explains it
 *     1   the question could not be answered (no tip, no answer from
 *         `/api/health`, or an answer with no `build` field in it). It files
 *         nothing and fails, which is neither crying wolf nor going quiet.
 *
 * It opens no database and writes nothing anywhere.
 */
import { execFileSync } from "node:child_process";

/*
  ⚠ THE PRODUCTION ORIGIN IS IMPORTED AND NOT RETYPED, AND THE ODD HOME IS THE
  POINT. `PRODUCTION_ORIGIN` lives in `eyeFrameGate.mts` because that is where
  it was first needed; there are already four copies of that URL in this tree
  and the alternative to this import is a fifth (working law 4 — a second list
  shadowing a source of truth always drifts from it). It costs nothing: that
  module imports only `quietEdition.mts`, which imports nothing at all.

  It also brings the `PROD_BASE_URL` override with it, so this reader can be
  drilled against a staging service without a code change.
*/
import { PRODUCTION_ORIGIN } from "./lib/eyeFrameGate.mts";
import { fetchWithClearedTimeout, settleSockets } from "./lib/exitSafeFetch.mts";
import {
  productionCurrencyCardTitle,
  productionCurrencyExitCode,
  readProductionCurrency,
  SHIPPING_GRACE_MINUTES,
} from "./lib/productionCurrency.mts";

/* Reads that cannot hang the job. Everything asked for is small. */
const GH_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 15_000;

const argv = process.argv.slice(2);
const graceArg = argv.indexOf("--grace");

/*
  ⚠ AN UNSET WORKFLOW INPUT ARRIVES AS THE EMPTY STRING, NOT AS UNDEFINED, and
  `??` does not catch it. `Number("")` is 0, which would fail the positive
  check below — so a `??` default would refuse every triggered run with exit 1
  while a hand-dispatched one with the input filled in worked, and the detector
  would be dead in exactly the mode it is meant to run in. The specimen is
  `team-silence-check.mts`'s own, one file over, and memory's is a blank
  Railway variable reaching `parseInt`. So the test is on the TRIMMED TEXT
  being non-empty, before any conversion.
*/
const asked = graceArg >= 0 ? argv[graceArg + 1] : process.env.PRODUCTION_CURRENCY_GRACE_MINUTES;
const given = typeof asked === "string" && asked.trim() !== "" ? asked.trim() : null;
const graceMinutes = given === null ? SHIPPING_GRACE_MINUTES : Number(given);

if (!Number.isFinite(graceMinutes) || graceMinutes <= 0) {
  console.error(
    `[production-currency] the grace must be a positive number of minutes, got ${JSON.stringify(given)}`,
  );
  process.exit(1);
}

const { verdict, sentence } = await readProductionCurrency({
  nowMs: Date.now(),
  gh: (args) => execFileSync("gh", [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: GH_TIMEOUT_MS,
  }),
  health: async () => {
    const response = await fetchWithClearedTimeout(
      `${PRODUCTION_ORIGIN}/api/health`,
      { method: "GET", headers: { accept: "application/json" } },
      HEALTH_TIMEOUT_MS,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${PRODUCTION_ORIGIN}/api/health`);
    return await response.text();
  },
  graceMinutes,
});

/*
  ⚠ THE FIRST LINE IS WHAT THE WORKFLOW QUOTES INTO THE CARD AND THE RUN
  SUMMARY, so it carries the verdict word and the whole sentence.
*/
console.log(`[production-currency] ${verdict.kind.toUpperCase()} — ${sentence}`);

/*
  ⚠ AND THE TITLE IS PRINTED AS ITS OWN LINE RATHER THAN CUT OUT OF THE ONE
  ABOVE. A workflow that `sed`s a title out of prose puts a second contract on
  the shape of that prose: reword the sentence and the card is silently
  retitled, or called nothing at all. `productionCurrencyCardTitle` owns it and
  the suite pins the line.
*/
const title = productionCurrencyCardTitle(verdict);
if (title !== null) console.log(`[production-currency] title: ${title}`);

if (verdict.kind === "behind") {
  console.log(
    "[production-currency] a merged, green, failed-to-ship commit is in flight to nobody, which is why "
    + "no other alarm the team owns can see this. Read: this commit's deployment in the Railway dashboard "
    + "(the build log is the only place the cause is printed), then `/api/health`'s build field again before "
    + "acting — a retry may already have fixed it (#2748).",
  );
}

/*
  Let libuv finish closing the socket the health read left behind, so the exit
  below reports its own code (#1509's lesson, and the reason `settleSockets`
  exists). AND THE LAST TOP-LEVEL STATEMENT ENDS THE PROCESS.
*/
await settleSockets("the /api/health read");
process.exit(productionCurrencyExitCode(verdict));
