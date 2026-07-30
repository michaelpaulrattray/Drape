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
import { NANO_BANANA_PRO_USD_PER_IMAGE } from "../server/providers/falQueue";

/* ------------------------------------------------------------------ config */

const args = new Set(process.argv.slice(2));
const flag = (name: string): string | undefined =>
  process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const EXECUTE = args.has("--execute");
const PHASE = flag("phase") ?? "all";
const CEILING_USD = Number(flag("ceiling") ?? 20);
const OUT_DIR = path.resolve(flag("out") ?? ".calibration");
/**
 * Founder decision 2026-07-30: images run through fal, which is the billing we
 * can top up. §H.9 already sanctioned this as the single-transport variant.
 * OpenRouter remains the text transport and the image fallback.
 */
const IMAGES_VIA = (flag("images") ?? "fal") as "fal" | "openrouter";
/** Measured, not assumed — this is how §H.8's default budget gets its number. */
const CONCURRENCY = Number(flag("concurrency") ?? 8);

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
  return estimateCandidateCostUsd({
    prompt: "",
    size: SHEET_SIZE,
    quality: SHEET_QUALITY,
  });
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

main().catch((error) => {
  console.error(`[calibration] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
