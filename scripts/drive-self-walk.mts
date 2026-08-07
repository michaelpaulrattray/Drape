/**
 * THE SELF-DRIVE WALK — the founder is the taste gate, not the smoke test.
 *
 * Founder directive, 2026-08-06: no more "retry it and see". The walk is driven
 * here, and the founder is called only when it passes **clean, twice in a row**,
 * with screenshots, stored verdicts and ledger rows as proof — twice, so a lucky
 * roll cannot summon them.
 *
 * # It drives the BROWSER, because that is where the product is
 *
 * The first version of this driver posted to `castingV2.refine` over HTTP. That
 * reached the whole server stack and could not see the product: the click path
 * to the panel, the ghost chip, the picture narrating its own wait, the outcome
 * sentence, the answer chips. Those are not decoration — the founder's walk is
 * fifteen minutes in a viewer, and every one of them is a thing that has broken.
 *
 * So actuation is browser-only. There is no `--http` mode, because a mode
 * nobody runs is the invoked-but-inert class, and two actuation paths producing
 * "the same" number is how the founder gets summoned off the wrong one. HTTP
 * survives here for exactly two jobs that are not actuation: finding which
 * sheet the candidate lives on, and nothing else.
 *
 * # The number comes from the STORED ROW, not from the screen and not from the
 * response
 *
 * `castingV2.refine` does not return the verdict — it persists it onto the
 * variant's `internalPrompt`. The previous driver read `data.verification`,
 * which is always `undefined`, so every step classified `delivered_unverified`
 * and the delivery rate it printed was **structurally 0%** whatever the product
 * did. D-236 makes this walk the sole source of that number, so the instrument
 * was fixed before a credit was spent (law 2: verify the instrument before
 * believing its finding). Rows come back through `lib/attemptRows`, the same
 * module `scripts/reliability-report.mts` uses, so the two cannot disagree.
 *
 * The screen and the row are TWO instruments and both must agree. A delivered
 * picture the DOM never showed is a projection defect only this layer can see,
 * and it counts as a failure of the run rather than a reclassification.
 *
 * # Every step declares what it EXPECTS, and an ask is not a delivery
 *
 * Step two asks for fox eyes on a face that measures 7.2 degrees of canthal
 * tilt, so the already-true gate fires and she is ASKED rather than charged.
 * That is the founder's ratified behaviour, and it must be a pass — but it must
 * never be able to flatter the delivery rate, because a class that always asks
 * would otherwise read as perfect while delivering nothing.
 *
 * It cannot, and not by an exclusion someone has to remember: a free question
 * never reserves an operation, so it writes no row with `pointsCost > 0` and is
 * not in the rate's population at all. What the walk checks is that each step
 * landed on the outcome it declared — an ask where a delivery was expected is a
 * failure, and so is a delivery where an ask was expected (the gate did not
 * fire, and 25 credits went on measuring nothing).
 *
 * **Named consequence, for the founder rather than for me:** because the walk
 * stops at the ask, `eye.shape` contributes nothing to the delivery
 * denominator. Its delivery sample belongs to the class sweep, on a face
 * measured FLAT — which is the only kind of face on which the ask carries a
 * real delta (see the tilt pool). The walk keeps the founder's five steps.
 *
 * # It cannot spend by accident
 *
 * Every delivering step is a real 25-credit refine on a real account. `--spend`
 * is required; without it the script prints the plan and exits.
 *
 *   JWT_SECRET=… APP_ID=… OPEN_ID=… npx tsx scripts/mint-production-session.mts
 *   railway.cmd run --service MySQL npx tsx scripts/drive-self-walk.mts \
 *     --base https://… --token <jwt> --candidate <publicId> --spend
 *
 * (`railway run` is what supplies the production database for the verdict
 * readback. Without it the walk drives fine and cannot score itself, and it
 * says so rather than printing a zero.)
 *
 * Exits non-zero unless every step landed where it said it would and the rate
 * table clears D-236's bar, so two consecutive green runs are a fact rather
 * than a recollection.
 *
 * # THE CLASS SWEEP — this driver's second campaign (founder, 2026-08-07)
 *
 * Ordered as the walk's immediate successor, and the standing bot's first real
 * campaign rather than someday. The SAME harness runs one canonical ask per
 * routable facet class into the same per-class table, inside a renewed ceiling:
 *
 *   deliverable   hair colour · hair cut · hair worn · lips · brows ·
 *                 makeup variants · nose piercing (the anchor exists) ·
 *                 glasses-add · eye shape (on a flat face — see above)
 *   refusals      skin tone and body ink, verified as REFUSING CORRECTLY —
 *                 a class that routes honestly is a pass, not an omission
 *
 * The two gates are different and must not be confused: **the founder's walk
 * gates the founder's moment; the class sweep gates any scope beyond the
 * founder.** No account past `users:1` moves until the sweep's table clears the
 * bar per class, or the class is honestly routed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "puppeteer-core";

import { formatReport, summarize } from "../server/castingV2/reliabilityReport.js";
import { readAttemptRows } from "./lib/attemptRows.mjs";
import { createChecks, openDrivenPage } from "./lib/drivePage.mjs";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const BASE = arg("base", "http://localhost:3000");
const TOKEN = arg("token");
const CANDIDATE = arg("candidate");
const SPEND = process.argv.includes("--spend");
const OUT = arg("out", `output/walk/${new Date().toISOString().replace(/[:.]/g, "-")}`);

if (!TOKEN) throw new Error("--token <app_session_id JWT> is required (see mint-production-session.mts)");
if (!CANDIDATE) throw new Error("--candidate <publicId> is required — never guess which face to spend on");

/**
 * THE WALK, in the founder's own order.
 *
 * `expectClass` is the reviewer's expectation of which edit class the step
 * exercises — recorded so a step that lands under a different facet than
 * intended is visible rather than silently reclassified.
 *
 * `expects` is the outcome the product should reach. It is declared here rather
 * than inferred from what happened, because inferring it is exactly how an ask
 * would come to look like a pass on a step that should have delivered.
 */
const WALK: Array<{ instruction: string; expectClass: string; expects: "delivered" | "asked" }> = [
  { instruction: "give her freckles", expectClass: "marks", expects: "delivered" },
  /* She measures 7.2 degrees. The already-true gate fires and asks, free. */
  { instruction: "fox eyes", expectClass: "eye.shape", expects: "asked" },
  { instruction: "add nude lip gloss", expectClass: "makeup", expects: "delivered" },
  { instruction: "gold hoop earrings", expectClass: "statedAccessories", expects: "delivered" },
  { instruction: "remove her glasses", expectClass: "statedAccessories", expects: "delivered" },
];

const COOKIE = `app_session_id=${TOKEN}`;
/** A refine is ~30s median; twice the two-minute supervised-wait line. */
const LANDING_TIMEOUT_MS = 4 * 60 * 1000;

/* ---------------------------------------------------------------------------
   Finding the sheet. Navigation, not verdict — so HTTP is the honest tool.
   Derived by walking the owner's own projections rather than being passed in,
   because a hardcoded session id is a second copy of a fact the server owns.

   It runs BEFORE the spend gate on purpose: a dry run that proves the session
   is live and the face is where it is said to be is the only pre-flight this
   driver can have, and one that can only be checked by spending is not a
   pre-flight at all.
--------------------------------------------------------------------------- */

async function trpcQuery(path: string, input: unknown): Promise<any> {
  const url = `${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(url, { headers: { cookie: COOKIE } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body?.result?.data?.json;
}

async function locateCandidate(): Promise<{ sessionId: string; indexLabel: string }> {
  const sessions = await trpcQuery("castingV2.openSessions", {});
  for (const session of sessions ?? []) {
    const detail = await trpcQuery("castingV2.getSession", { sessionId: session.sessionId });
    for (const roll of detail?.rolls ?? []) {
      const projection = await trpcQuery("castingV2.getRoll", { rollId: roll.rollId });
      const found = (projection?.candidates ?? []).find(
        (candidate: any) => candidate.candidateId === CANDIDATE,
      );
      if (found) return { sessionId: session.sessionId, indexLabel: found.indexLabel };
    }
  }
  throw new Error(
    `candidate ${CANDIDATE} is not on any open sheet for this session — `
    + "refusing to walk a face I cannot find rather than guessing at one",
  );
}

console.log(`SELF-DRIVE WALK — ${WALK.length} steps on candidate ${CANDIDATE}`);
console.log(`base ${BASE}`);
const { sessionId, indexLabel } = await locateCandidate();
console.log(`sheet ${sessionId} · candidate ${indexLabel} — session verified live`);
const paidSteps = WALK.filter((step) => step.expects === "delivered").length;
console.log(`cost if it runs: ${paidSteps * 25} credits (${paidSteps} paid, ${WALK.length - paidSteps} free)\n`);
for (const [index, step] of WALK.entries()) {
  console.log(`  ${index + 1}. "${step.instruction}"  → expects ${step.expects} · ${step.expectClass}`);
}
if (!SPEND) {
  console.log("\nDRY RUN — pass --spend to actually drive it. Nothing was charged.");
  process.exit(0);
}

const startedAt = new Date();
mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------------------
   The drive.
--------------------------------------------------------------------------- */

const checks = createChecks();
const { browser, page } = await openDrivenPage({ base: BASE, token: TOKEN, height: 1100 });

type StepResult = {
  instruction: string;
  expectClass: string;
  expects: "delivered" | "asked";
  outcome: "delivered" | "asked" | "refused" | "timeout";
  /** The sentence the panel showed, verbatim — a refusal nobody can read is a
      refusal nobody can act on, so it is captured rather than summarised. */
  said: string | null;
  answers: string[];
  imageUrl: string | null;
  seconds: number;
};

const results: StepResult[] = [];

/** How many real (non-ghost) versions the stack is showing. */
const stackSize = (page: Page) =>
  page.$$eval(".dpc-refine__pick:not(.dpc-refine__pick--ghost)", (nodes) => nodes.length);

async function openViewer(): Promise<void> {
  await page.goto(`${BASE}/casting/s/${sessionId}`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".dpc-card", { timeout: 60_000 });

  const label = `View candidate ${indexLabel} larger`;
  const opened = await page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll<HTMLElement>(".dpc-card__open"))
      .find((node) => node.getAttribute("aria-label") === wanted);
    if (!button) return false;
    button.click();
    return true;
  }, label);
  if (!opened) throw new Error(`no tile offering "${label}" — the sheet is not showing her`);
  await page.waitForSelector(".dpc-viewer", { timeout: 20_000 });
}

for (const [index, step] of WALK.entries()) {
  const position = `${index + 1}/${WALK.length}`;
  console.log(`\n── ${position} "${step.instruction}"  (expects ${step.expects})`);
  const began = Date.now();

  /* Re-opened per step. Closing and reopening between edits is what the founder
     actually does, and it is the path that has broken before (D-161: a running
     refinement that vanished with the component and got bought twice). */
  await openViewer();

  const before = await stackSize(page);
  const panel = await page.$(".dpc-refine");
  checks.check(
    panel !== null,
    `[${position}] the refine panel is reachable from the tile`,
    panel ? `.dpc-refine present after opening candidate ${indexLabel}` : "no panel under the picture",
  );
  if (!panel) break;

  /* The price is stated where the money moves — D-15, and it is the one law
     that has cost the founder credits by being absent. */
  const priceNote = await page.$$eval(".dpc-refine__note", (nodes) =>
    nodes.map((node) => node.textContent ?? "").find((text) => /\d+\s*credits each/.test(text)) ?? "");
  checks.check(
    priceNote.length > 0,
    `[${position}] the panel states the price before the box`,
    priceNote || "no note carrying a per-edit price",
  );

  await page.type(".dpc-refine__field", step.instruction, { delay: 12 });
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>(".dpc-refine__ask");
    form?.requestSubmit();
  });

  /*
    THE CLICK'S OWN FRAME. Read back with no wait at all: a sleep here would let
    the poll arrive and the check would pass on the server's work rather than on
    the client's, which is the vacuous pass this harness has been caught by
    twice already.
  */
  const busyLabel = await page.evaluate(
    () => new Promise<string>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() =>
        resolve(
          document.querySelector<HTMLElement>(".dpc-refine__ask button[type=submit]")?.innerText?.trim()
          ?? "",
        )))),
  );
  checks.check(
    /refining/i.test(busyLabel),
    `[${position}] the box says it is working in the click's own frame`,
    `submit button read "${busyLabel}"`,
  );

  /*
    THE WAIT, AND WHETHER THE PICTURE NARRATES IT.

    Server truth on a 4s poll, so it is polled for rather than sampled once —
    and a free question resolves before any of it exists, which is why the
    narration is only expected on a step that spends.
  */
  const narrated = step.expects === "delivered"
    ? await page
      .waitForFunction(
        () => document.querySelector(".dpc-viewer__wait") !== null
          || document.querySelector(".dpc-refine__pick--ghost") !== null,
        { timeout: 30_000 },
      )
      .then(() => page.evaluate(() => ({
        said: document.querySelector<HTMLElement>(".dpc-viewer__waitSaid")?.innerText?.trim() ?? null,
        stage: document.querySelector<HTMLElement>(".dpc-viewer__waitMeta")?.innerText?.trim() ?? null,
        ghost: document.querySelector<HTMLElement>(".dpc-refine__pick--ghost")?.innerText?.trim() ?? null,
      })))
      .catch(() => null)
    : null;

  if (step.expects === "delivered") {
    if (narrated === null) {
      checks.neverArmed(
        `[${position}] the picture narrates the wait`,
        "neither the viewer's wait overlay nor a ghost chip appeared within 30s",
      );
    } else {
      checks.check(
        narrated.said === step.instruction || narrated.ghost === step.instruction,
        `[${position}] the wait says HER OWN sentence back`,
        `overlay "${narrated.said ?? "-"}" · ghost "${narrated.ghost ?? "-"}" · stage "${narrated.stage ?? "-"}"`,
      );
    }
  } else {
    checks.absent(`[${position}] the picture narrates the wait`, "a free question never renders");
  }

  /* Landing: one more real version in the stack, or a sentence in the panel. */
  const landed = await page
    .waitForFunction(
      (was) =>
        document.querySelectorAll(".dpc-refine__pick:not(.dpc-refine__pick--ghost)").length > was
        || document.querySelector(".dpc-refine__outcome") !== null,
      { timeout: LANDING_TIMEOUT_MS, polling: 500 },
      before,
    )
    .then(() => true)
    .catch(() => false);

  const seen = await page.evaluate(() => ({
    stack: document.querySelectorAll(".dpc-refine__pick:not(.dpc-refine__pick--ghost)").length,
    said: document.querySelector<HTMLElement>(".dpc-refine__outcome")?.innerText?.replace(/\s*×\s*$/, "").trim()
      ?? null,
    answers: Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__answer"))
      .map((node) => node.innerText.trim()),
    /* The picture the viewer is ACTUALLY showing — a delivered variant the DOM
       never displayed is a projection defect nothing but this layer can see. */
    shown: document.querySelector<HTMLImageElement>(".dpc-viewer__plate img")?.src ?? null,
  }));

  const outcome: StepResult["outcome"] = !landed
    ? "timeout"
    : seen.stack > before
      ? "delivered"
      : seen.answers.length > 0
        ? "asked"
        : "refused";

  await page.screenshot({
    path: `${OUT}/${String(index + 1).padStart(2, "0")}-${step.instruction.replace(/\W+/g, "-")}.png`,
  });

  checks.check(
    outcome === step.expects,
    `[${position}] lands where it said it would`,
    `expected ${step.expects}, got ${outcome}`
    + (seen.said ? ` — panel said "${seen.said.slice(0, 110)}"` : ""),
  );

  if (step.expects === "asked") {
    /*
      A QUESTION THAT CANNOT BE ANSWERED IS A DEAD END, and this gate shipped as
      one: the sentence arrived through the refusal channel with no chips and
      nothing on the server able to receive a reply. The chips are what say it
      has a way through.
    */
    checks.check(
      seen.answers.length >= 2,
      `[${position}] the question has answers, not just a sentence`,
      `chips: ${seen.answers.length ? seen.answers.join(" / ") : "none"}`,
    );
    checks.check(
      seen.stack === before,
      `[${position}] asking costs her nothing`,
      `stack ${before} → ${seen.stack} (no new version)`,
    );
  }

  if (outcome === "delivered") {
    checks.check(
      Boolean(seen.shown && !seen.shown.startsWith("data:")),
      `[${position}] the delivered picture reaches the screen`,
      `viewer is showing ${seen.shown ? seen.shown.slice(0, 96) : "nothing"}`,
    );
    if (seen.shown) {
      try {
        const image = await fetch(seen.shown);
        const bytes = Buffer.from(await image.arrayBuffer());
        writeFileSync(
          `${OUT}/${String(index + 1).padStart(2, "0")}-delivered.png`,
          bytes,
        );
      } catch (error) {
        console.log(`     (could not fetch the delivered image: ${String(error).slice(0, 80)})`);
      }
    }
  }

  results.push({
    instruction: step.instruction,
    expectClass: step.expectClass,
    expects: step.expects,
    outcome,
    said: seen.said,
    answers: seen.answers,
    imageUrl: seen.shown,
    seconds: Math.round((Date.now() - began) / 100) / 10,
  });
  console.log(`   → ${outcome} in ${results.at(-1)!.seconds}s`);

  /* The dock is a whole-page law and it is cheap to re-check per surface. */
  const dock = await page.evaluate(() => {
    const node = document.querySelector(".dp-dock");
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { onScreen: box.top < window.innerHeight && box.bottom > 0, top: Math.round(box.top) };
  });
  if (dock === null) checks.absent(`[${position}] the dock is on screen`, "no dock on the sheet");
  else checks.check(dock.onScreen, `[${position}] the dock is on screen`, `dock top at ${dock.top}px`);
}

await browser.close();

/* ---------------------------------------------------------------------------
   The rate sample. Read from the rows the product wrote, not from the screen.
--------------------------------------------------------------------------- */

let report: ReturnType<typeof summarize> | null = null;
let readbackError: string | null = null;
try {
  const attempts = await readAttemptRows({ since: startedAt });
  report = summarize(attempts, { windowFrom: startedAt, windowLabel: "this walk" });
  console.log(`\n${formatReport(report)}`);
} catch (error) {
  /*
    A walk that cannot read its own verdicts has not measured anything. It says
    so and fails, rather than printing a zero that would look like a finding —
    the difference between a no-read and an absence (D-235's asymmetry).
  */
  readbackError = error instanceof Error ? error.message : String(error);
  console.log(`\nVERDICTS UNREADABLE — ${readbackError}`);
}

console.log("");
checks.print();

const landedRight = results.length === WALK.length
  && results.every((step) => step.outcome === step.expects);
const clean = landedRight
  && checks.failures().length === 0
  && report !== null
  && report.overall.delivered_noncompliant === 0
  && report.blockers.length === 0;

writeFileSync(
  `${OUT}/walk.json`,
  JSON.stringify({ startedAt, sessionId, candidate: CANDIDATE, results, checks: checks.records, report, readbackError }, null, 2),
);
console.log(`\nevidence written to ${OUT}`);
console.log(
  clean
    ? `WALK CLEAN — ${results.length}/${WALK.length} steps landed where they said they would, `
      + `${report!.overall.delivered_compliant} delivered compliant, 0 false passes.`
    : "WALK NOT CLEAN — the founder is not called."
      + (landedRight ? "" : " Steps did not land as declared.")
      + (checks.failures().length ? ` ${checks.failures().length} browser check(s) failed.` : "")
      + (report === null ? " No verdicts were read." : report.blockers.length ? ` Classes below the bar: ${report.blockers.join(", ")}.` : ""),
);
process.exit(clean ? 0 : 1);
