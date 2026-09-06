/**
 * M3 calibration harness (plan §K M3, §E.1, §H.9).
 *
 * The program's go/no-go gate. It answers, with measurements rather than
 * vendor marketing:
 *   1. does GPT Image 2 give eight good, diverse, consistently-framed
 *      candidates from one brief?
 *   2. does Nano Banana Pro actually hold a signed face across the six
 *      canonical views and three revisions at our quality bar? — the real
 *      question, since everything from M7 onward depends on it;
 *   3. does the §E.1 Kimi treatment stage beat the Claude-only path?
 *   4. is prompt-based voice design reachable through Fal?
 *
 * THIS SPENDS REAL MONEY. Guards, in order of how much they matter:
 *
 *   - `--dry-run` (the default) makes zero calls and prints the full plan with
 *     its cost. Always run it first; the paid run requires `--execute`.
 *   - A hard USD ceiling is computed from documented unit prices before any
 *     call. If the plan exceeds it, the run refuses to start.
 *   - Cost is counted at DISPATCH, not completion. OpenRouter has no cancel,
 *     so a submitted request is spent whatever happens next.
 *   - Cumulative spend is checked before every call; crossing the ceiling
 *     aborts immediately and cancels outstanding Fal work.
 *   - Every result is written to a resumable manifest as it lands, so a crash
 *     or an abort never re-spends on resume.
 *   - Phased: the NBP likeness gate runs first and can be run alone, because
 *     it is the decision. The A/B is an optimisation whose verdict may be
 *     "insufficient evidence, ship Path A" without blocking anything.
 *   - Refuses to run against production, and touches no database at all.
 *
 * Keys come from `.env` and are never logged, never written to the manifest,
 * and never included in the report.
 *
 * Usage:
 *   npx tsx scripts/calibrate-providers.mts                    # dry run, all phases
 *   npx tsx scripts/calibrate-providers.mts --phase=gate       # the go/no-go phases only
 *   npx tsx scripts/calibrate-providers.mts --phase=nbp --execute --ceiling=12
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { estimateCandidateCostUsd } from "../server/providers/openrouterImages";
import { FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE } from "../server/providers/falImages";
import { NANO_BANANA_PRO_USD_PER_IMAGE } from "../server/providers/falQueue";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

/* ------------------------------------------------------------------ config */

/*
  ⚠ THE COMMAND LINE REFUSES WHAT IT DOES NOT UNDERSTAND (#345's remainder,
  closed by #602). It read its flags by NAME until now — `find(a =>
  a.startsWith("--phase="))` — which is the class #288 named: a reader that
  looks up the flags it wants and never looks at what it was given. A mistyped
  `--exceute` was silently discarded and this script ran its full plan.

  It sat outside #345's sweep for a stated reason rather than an oversight: the
  parser did not speak `--phase=gate`, and the four lines in this file's own
  header are what an operator types. The parser speaks it now, so the
  documented command lines above are unchanged — which is the whole point of
  having taught the parser instead of converting the script.
*/
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  /* ⚠ SIX WORDS, NOT THE TWO #602 CARDED. The card named --phase and
     --ceiling from this file own header; the code also reads --images and
     --concurrency, which the header never documents. Read at the source, not
     at the card (law 7c) — declaring only the carded pair would have turned
     two working flags into refusals. */
  value: ["phase", "ceiling", "out", "images", "concurrency"],
  boolean: ["execute", "dry-run"],
});

/*
  ⚠ `--dry-run` IS DECLARED BECAUSE THIS FILE'S OWN HEADER DOCUMENTS IT, AND IT
  NEVER EXISTED. Line 16 above reads *"`--dry-run` (the default)"*, so an
  operator following the instructions types a word the old reader silently
  discarded — harmlessly, because a dry run is what it would have done anyway.
  Under a strict parser that word would have become a REFUSAL instead, which is
  a documented command line breaking on the day this card claimed none would.

  So it is accepted, and it is given the one meaning it can honestly have:
  saying it OUT LOUD beside `--execute` is a contradiction, and a contradiction
  on a script that spends house money is refused rather than resolved.
*/
if (ARGS.flag("dry-run") && ARGS.flag("execute")) {
  console.error("REFUSING: --dry-run and --execute are opposites. Pass one.");
  process.exit(1);
}

const EXECUTE = ARGS.flag("execute");
const PHASE = ARGS.value("phase") ?? "all";
/*
  ⚠ A NUMBER THAT IS NOT A NUMBER TURNS BOTH SPEND GUARDS OFF, SILENTLY (PR
  #623 review, finding 1). `Number("1O")` — the digit one and the letter O —
  is NaN, and every comparison against NaN is false: the plan-level refusal
  below (`total > CEILING_USD`) stops refusing, and `SpendGuard.reserve` in
  `scripts/calibration/run.mts` stops reserving. An `--execute` run would then
  proceed with NO ceiling at all.

  It is not new — `Number(flag("ceiling") ?? 20)` had the identical hole — but
  it is exactly this card class wearing a different coat: an operator mistake
  on a house-money script degrading quietly instead of refusing. The parser
  owns the SHAPE of the line and says so; a value that must be a number is the
  caller's to check, and this is the caller.

  The remaining four sites of the class are #625, with the shared-accessor
  recommendation the reviewer named.
*/
const numeric = (name: string, fallback: number): number => {
  const raw = ARGS.value(name);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.error(`REFUSING: --${name} must be a number, and "${raw}" is not.`);
    process.exit(1);
  }
  return parsed;
};

const CEILING_USD = numeric("ceiling", 20);
const OUT_DIR = path.resolve(ARGS.value("out") ?? ".calibration");
/**
 * Founder decision 2026-07-30: images run through fal, which is the billing we
 * can top up. §H.9 already sanctioned this as the single-transport variant.
 * OpenRouter remains the text transport and the image fallback.
 */
const IMAGES_VIA = (ARGS.value("images") ?? "fal") as "fal" | "openrouter";
/** Measured, not assumed — this is how §H.8's default budget gets its number. */
const CONCURRENCY = numeric("concurrency", 8);

/**
 * The §E.1 matrix: tight, loose and non-human briefs. The non-human ones are
 * not decoration — M9's cohort work leans on them, and a matrix that only
 * covers photoreal humans would tell us nothing about the cohorts we intend to
 * certify.
 */
const BRIEFS = [
  { id: "tight-1", cohort: "photoreal-human", text: "a dad in his 30s in a cluttered garage, dry humour" },
  { id: "tight-2", cohort: "photoreal-human", text: "a tired night-shift nurse, 50s, kind eyes" },
  { id: "tight-3", cohort: "photoreal-human", text: "a wiry cyclist in her 20s, freckled, mid-laugh" },
  { id: "tight-4", cohort: "photoreal-human", text: "a bald bouncer, 40s, broken nose, unbothered" },
  { id: "loose-1", cohort: "photoreal-human", text: "someone you'd trust to fix your roof" },
  { id: "loose-2", cohort: "photoreal-human", text: "a face that looks like old money" },
  { id: "loose-3", cohort: "photoreal-human", text: "the friend who always knows a guy" },
  { id: "loose-4", cohort: "photoreal-human", text: "quietly furious" },
  { id: "nonhuman-1", cohort: "humanlike-fantasy", text: "a weathered orc dockworker, anime style" },
  { id: "nonhuman-2", cohort: "anime-human", text: "a cel-shaded teenage inventor, goggles pushed up" },
  { id: "nonhuman-3", cohort: "humanlike-fantasy", text: "an android barista with a cracked faceplate" },
  { id: "nonhuman-4", cohort: "anime-human", text: "a painterly elf archivist, ink-stained fingers" },
] as const;

const CANDIDATES_PER_ROLL = 8;
const SHEET_SIZE = "1024x1536" as const;
const SHEET_QUALITY = "medium" as const;

/** The Sign package, exactly as §H.10 defines it: 6 canonical slots at 2K. */
const CANONICAL_VIEWS = ["frontClose", "front", "threeQuarter", "side", "back", "motion"] as const;
const REVISIONS = [
  "add a small tattoo on the left forearm",
  "change the jacket to a worn denim one",
  "make the hair shorter and greyer",
] as const;

/* ------------------------------------------------------------ cost planning */

type PlannedCall = {
  phase: string;
  id: string;
  provider: "openrouter" | "fal" | "openrouter-text";
  description: string;
  costUsd: number;
};

function planCandidateCost(): number {
  // Use the rate we measured on the transport we actually run. Planning a
  // ceiling from list prices under-counts fal by ~18%, which is the difference
  // between a guard that stops a run and one that watches it overspend.
  return IMAGES_VIA === "fal"
    ? FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE
    : estimateCandidateCostUsd({ prompt: "", size: SHEET_SIZE, quality: SHEET_QUALITY });
}

function buildPlan(phase: string): PlannedCall[] {
  const plan: PlannedCall[] = [];
  const candidateCost = planCandidateCost();

  // Phase 1 — the gate. One anchor, then the full signed package and the
  // revisions, exactly as M7 and M12 will run them.
  if (phase === "all" || phase === "gate" || phase === "nbp") {
    plan.push({
      phase: "nbp",
      id: "anchor",
      provider: "openrouter",
      description: "anchor candidate (1K portrait) to sign",
      costUsd: candidateCost,
    });
    for (const view of CANONICAL_VIEWS) {
      plan.push({
        phase: "nbp",
        id: `view:${view}`,
        provider: "fal",
        description: `canonical view ${view} at 2K from the anchor`,
        costUsd: NANO_BANANA_PRO_USD_PER_IMAGE["2K"],
      });
    }
    REVISIONS.forEach((revision, index) => {
      plan.push({
        phase: "nbp",
        id: `revision:${index + 1}`,
        provider: "fal",
        description: `identity revision — ${revision}`,
        costUsd: NANO_BANANA_PRO_USD_PER_IMAGE["2K"],
      });
    });
  }

  // Phase 2 — diversity and framing of a real sheet.
  if (phase === "all" || phase === "gate" || phase === "sheet") {
    for (let i = 0; i < CANDIDATES_PER_ROLL; i += 1) {
      plan.push({
        phase: "sheet",
        id: `sheet:${i + 1}`,
        provider: "openrouter",
        description: "sheet candidate for diversity/framing review",
        costUsd: candidateCost,
      });
    }
  }

  // Phase 3 — the §E.1 A/B. Both paths, every brief.
  if (phase === "all" || phase === "ab") {
    for (const brief of BRIEFS) {
      plan.push({
        phase: "ab",
        id: `intent:${brief.id}`,
        provider: "openrouter-text",
        description: `Claude CastingIntent for ${brief.id}`,
        costUsd: 0.01,
      });
      plan.push({
        phase: "ab",
        id: `treatments:${brief.id}`,
        provider: "openrouter-text",
        description: `Kimi treatments for ${brief.id} (path B only)`,
        costUsd: 0.01,
      });
      for (const path of ["A", "B"] as const) {
        for (let i = 0; i < CANDIDATES_PER_ROLL; i += 1) {
          plan.push({
            phase: "ab",
            id: `ab:${brief.id}:${path}:${i + 1}`,
            provider: "openrouter",
            description: `${brief.id} path ${path} candidate ${i + 1}`,
            costUsd: candidateCost,
          });
        }
      }
    }
  }

  // Phase 4 — voice feasibility. Fal route only: no ELEVENLABS_API_KEY is
  // configured, so the direct API cannot be tested here. If Fal cannot do
  // prompt-based voice *design*, that is a finding for the report and M8b
  // re-decides — it does not block anything else.
  if (phase === "all" || phase === "gate" || phase === "voice") {
    plan.push({
      phase: "voice",
      id: "voice:probe",
      provider: "fal",
      description: "probe Fal for a prompt-based voice-design endpoint",
      costUsd: 0.05,
    });
  }

  return plan;
}

/* --------------------------------------------------------------- execution */

function refuseIfProduction(): void {
  const markers = ["RAILWAY_ENVIRONMENT", "RAILWAY_SERVICE_ID", "RAILWAY_PROJECT_ID"];
  const present = markers.filter((marker) => process.env[marker]);
  if (process.env.NODE_ENV === "production" || present.length > 0) {
    throw new Error(
      `Refusing to run: this looks like a production environment (${present.join(", ") || "NODE_ENV=production"}). ` +
        "The calibration harness is dev-only and founder-authorized.",
    );
  }
}

async function main() {
  refuseIfProduction();

  const plan = buildPlan(PHASE);
  const total = plan.reduce((sum, call) => sum + call.costUsd, 0);

  const byPhase = plan.reduce<Record<string, { calls: number; usd: number }>>((acc, call) => {
    acc[call.phase] ??= { calls: 0, usd: 0 };
    acc[call.phase].calls += 1;
    acc[call.phase].usd += call.costUsd;
    return acc;
  }, {});

  console.log(`\n[calibration] plan for phase "${PHASE}"\n`);
  for (const [phase, stats] of Object.entries(byPhase)) {
    console.log(`  ${phase.padEnd(7)} ${String(stats.calls).padStart(4)} calls   $${stats.usd.toFixed(2)}`);
  }
  console.log(`  ${"TOTAL".padEnd(7)} ${String(plan.length).padStart(4)} calls   $${total.toFixed(2)}`);
  console.log(`\n  ceiling: $${CEILING_USD.toFixed(2)}`);
  console.log(
    "  note: estimates use documented list prices. Cost is counted at dispatch,\n" +
      "        because a submitted OpenRouter request cannot be cancelled.\n" +
      "        A retried timeout on Fal can cost up to 3x its line item.\n",
  );

  if (total > CEILING_USD) {
    console.error(
      `[calibration] REFUSING: the plan costs $${total.toFixed(2)}, above the $${CEILING_USD.toFixed(2)} ceiling.\n` +
        "Raise --ceiling only with explicit authorization, or run a narrower --phase.",
    );
    process.exit(1);
  }

  if (!EXECUTE) {
    console.log("[calibration] DRY RUN — no calls made, nothing spent. Add --execute to run.\n");
    return;
  }

  const needed = IMAGES_VIA === "fal" ? ["FAL_KEY"] : ["FAL_KEY", "OPENROUTER_API_KEY"];
  const missing = needed.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Missing credentials: ${missing.join(", ")}`);

  const { execute } = await import("./calibration/execute.mts");
  await execute({
    plan,
    outDir: OUT_DIR,
    ceilingUsd: CEILING_USD,
    imagesVia: IMAGES_VIA,
    concurrency: CONCURRENCY,
    briefs: BRIEFS,
    canonicalViews: CANONICAL_VIEWS,
    revisions: REVISIONS,
    sheetSize: SHEET_SIZE,
    sheetQuality: SHEET_QUALITY,
    candidatesPerRoll: CANDIDATES_PER_ROLL,
  });
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(`[calibration] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
