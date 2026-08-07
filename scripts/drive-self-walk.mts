/**
 * THE SELF-DRIVE WALK — the founder is the taste gate, not the smoke test.
 *
 * Founder directive, 2026-08-06: no more "retry it and see". The walk is driven
 * here, and the founder is called only when it passes **clean, twice in a row**,
 * with screenshots, stored verdicts and ledger rows as proof — twice, so a lucky
 * roll cannot summon them.
 *
 * # What this drives, and what it does NOT — declared, per the fidelity law
 *
 * It drives the PRODUCT SERVER end to end over HTTP with a real minted session:
 * router → approval and rate gates → billing → the composer → the masked
 * engine → harvest and composite → the verification net → landing and refund.
 * Every failure the founder's walk has actually produced lived in that stack —
 * the 848x1264 size mismatch, the engine routing gap, the empty-yes false pass.
 *
 * It does **not** drive the browser. The click path, the dock, the tile states
 * and the "still casting" copy are NOT exercised here; `drive-casting-design-
 * laws.mts` covers the static surfaces and the browser layer of this walk is
 * the declared next piece, not a thing quietly dropped. Said out loud because a
 * lesser path taken silently is the violation, and a scaffold announced is not.
 *
 * # It cannot spend by accident
 *
 * Every step is a real 25-credit refine on a real account. `--spend` is
 * required; without it the script prints the plan and exits. A driver that can
 * quietly spend money is one nobody can trust to run.
 *
 *   JWT_SECRET=… APP_ID=… OPEN_ID=… npx tsx scripts/mint-production-session.mts
 *   npx tsx scripts/drive-self-walk.mts --base https://… --token <jwt> \
 *     --candidate <publicId> --spend
 *
 * Exits non-zero unless every step delivered compliantly, so two consecutive
 * green runs are a fact rather than a recollection.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { formatReport, summarize, type AttemptRow } from "../server/castingV2/reliabilityReport.js";

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
 * `class` is what the report cuts by, and it is the reviewer's expectation of
 * which edit class the step exercises — recorded so a step that lands under a
 * different facet than intended is visible rather than silently reclassified.
 */
const WALK: Array<{ instruction: string; expectClass: string }> = [
  { instruction: "give her freckles", expectClass: "marks" },
  { instruction: "fox eyes", expectClass: "eye.shape" },
  { instruction: "add nude lip gloss", expectClass: "makeup" },
  { instruction: "gold hoop earrings", expectClass: "statedAccessories" },
  { instruction: "remove her glasses", expectClass: "statedAccessories" },
];

const COOKIE = `app_session_id=${TOKEN}`;

console.log(`SELF-DRIVE WALK — ${WALK.length} steps on candidate ${CANDIDATE}`);
console.log(`base ${BASE}`);
console.log(`cost if it runs: ${WALK.length * 25} credits\n`);
for (const [index, step] of WALK.entries()) {
  console.log(`  ${index + 1}. "${step.instruction}"  → expects ${step.expectClass}`);
}
if (!SPEND) {
  console.log("\nDRY RUN — pass --spend to actually drive it. Nothing was charged.");
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const startedAt = new Date();

type StepResult = {
  instruction: string;
  expectClass: string;
  httpStatus: number;
  /** `delivered` when a variant came back, `refused` when the server said no. */
  outcome: "delivered" | "refused" | "error";
  message?: string;
  variantId?: string;
  imageUrl?: string;
  verification?: AttemptRow["verification"];
  seconds: number;
};

const results: StepResult[] = [];

for (const [index, step] of WALK.entries()) {
  const label = `${index + 1}/${WALK.length} "${step.instruction}"`;
  const began = Date.now();
  process.stdout.write(`${label} … `);

  let result: StepResult;
  try {
    const res = await fetch(`${BASE}/api/trpc/castingV2.refine`, {
      method: "POST",
      headers: { cookie: COOKIE, "content-type": "application/json" },
      body: JSON.stringify({
        json: {
          clientRequestId: randomUUID(),
          candidateId: CANDIDATE,
          instruction: step.instruction,
        },
      }),
    });
    const text = await res.text();
    const parsed = JSON.parse(text);
    const data = parsed?.result?.data?.json;
    const error = parsed?.error?.json;

    result = {
      instruction: step.instruction,
      expectClass: step.expectClass,
      httpStatus: res.status,
      outcome: res.ok && data ? "delivered" : "refused",
      /* The user-facing sentence, verbatim — a refusal the user cannot read is
         a refusal nobody can act on, so it is captured, not summarised. */
      message: error?.message ?? data?.message,
      variantId: data?.variant?.publicId ?? data?.publicId,
      imageUrl: data?.variant?.imageUrl ?? data?.imageUrl,
      verification: data?.verification ?? null,
      seconds: Math.round((Date.now() - began) / 100) / 10,
    };
  } catch (error) {
    result = {
      instruction: step.instruction,
      expectClass: step.expectClass,
      httpStatus: 0,
      outcome: "error",
      message: error instanceof Error ? error.message : String(error),
      seconds: Math.round((Date.now() - began) / 100) / 10,
    };
  }

  results.push(result);
  console.log(
    `${result.outcome}${result.httpStatus ? ` (${result.httpStatus})` : ""} in ${result.seconds}s`
    + (result.message ? ` — ${result.message.slice(0, 90)}` : ""),
  );

  /* The delivered picture is the taste half of the evidence pack. Fetched now
     rather than referenced, because an R2 URL in a report is a claim and the
     bytes on disk are the fact (working law 1). */
  if (result.imageUrl) {
    try {
      const image = await fetch(result.imageUrl);
      const bytes = Buffer.from(await image.arrayBuffer());
      const name = `${String(index + 1).padStart(2, "0")}-${step.instruction.replace(/\W+/g, "-")}.png`;
      writeFileSync(`${OUT}/${name}`, bytes);
    } catch (error) {
      console.log(`     (could not fetch the delivered image: ${String(error).slice(0, 80)})`);
    }
  }
}

/*
  THE RATE SAMPLE.

  A walk is not merely pass/fail — it is a sample of the delivery rate (D-236),
  and it is scored by the SAME summarize the on-demand report and the heartbeat
  use, so three surfaces can never disagree about one number.
*/
const attempts: AttemptRow[] = results.map((step, index) => ({
  operationId: step.variantId ?? `step-${index + 1}`,
  createdAt: startedAt,
  status: step.outcome === "delivered" ? "ready" : "failed",
  failureClass: step.outcome === "delivered"
    ? null
    /* An `error` never reached a verdict, so it is infrastructure by
       definition; a server refusal carrying a fact-shaped message is the
       honest kind. Anything unrecognised stays unclassified rather than
       being flattered into a bucket. */
    : step.outcome === "error"
      ? "unknown"
      : /fact|missing|could not|did not/i.test(step.message ?? "")
        ? "facts_missing"
        : "unknown",
  refundedCredits: step.outcome === "delivered" ? 0 : 25,
  verification: step.verification ?? null,
}));

const report = summarize(attempts, { windowFrom: startedAt, windowLabel: "this walk" });

console.log(`\n${formatReport(report)}`);

const delivered = results.filter((step) => step.outcome === "delivered").length;
const clean = delivered === WALK.length && report.overall.delivered_noncompliant === 0;

writeFileSync(`${OUT}/walk.json`, JSON.stringify({ startedAt, results, report }, null, 2));
console.log(`\nevidence written to ${OUT}`);
console.log(
  clean
    ? `WALK CLEAN — ${delivered}/${WALK.length} delivered, 0 false passes.`
    : `WALK NOT CLEAN — ${delivered}/${WALK.length} delivered, `
      + `${report.overall.delivered_noncompliant} false pass(es). The founder is not called.`,
);
process.exit(clean ? 0 : 1);
