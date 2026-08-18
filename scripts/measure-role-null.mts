/**
 * The role-null measurement — a widened instrument, at real n.
 *
 * The founder's standing rule for this class: **measured, never guessed.** The
 * twitch role-null miss has been seen three times and estimated at ~1-in-15,
 * which is an anecdote wearing a number. One pass of the golden harness cannot
 * see a 7% event at all — it returns green fifteen times out of sixteen and
 * calls the defect fixed.
 *
 * So this samples ONE brief many times and, crucially, **records which
 * mechanism produced each miss** rather than only whether one happened. A rate
 * tells you a bug exists; the breakdown tells you what to fix.
 *
 * # What it separates
 *
 * A final `role: null` can arrive by more than one road, and they need
 * different fixes:
 *
 *   - **interpreter-null + repair declined** — the interpreter returned no
 *     role, and `promoteStatedRole` refused to backfill because it fires only
 *     when `variationAxis === "look"` (its deliberate narrowness: it must never
 *     backfill a true null, which would stop build varying). If the axis came
 *     back `disposition` or null, the repair sits out and the miss lands.
 *   - **interpreter-null + repair fired** — recovered. Not a miss, but worth
 *     counting: a product leaning on its repair is one prompt change away from
 *     leaning on nothing.
 *   - **guarded to null** — the interpreter DID write a role and `guardRole`
 *     dropped it as an unvouched proper noun. A very different bug.
 *   - **fallback** — the interpreter was unreachable or unreadable, so the
 *     compile fell back and `role` is the whole sentence. Non-null, and not a
 *     miss, but it means every stated lock was lost.
 *
 * # The token ceiling rides along
 *
 * Long briefs stochastically exceed the interpreter's output ceiling and are
 * rescued by D-83's retry. That was seen 2-of-3 then 0-of-3 — far too few
 * samples to size a ceiling that has already been raised three times after
 * silent lock loss. It is the same instrument and the same kind of stochastic
 * miss, so it is measured here rather than guessed at separately.
 *
 *   npx tsx scripts/measure-role-null.mts
 *   N=100 BRIEF="a twitch streamer" npx tsx scripts/measure-role-null.mts
 *   N=60 CONCURRENCY=6 ALL=1 npx tsx scripts/measure-role-null.mts
 *
 * A paid driver. It spends one interpreter call per sample (plus a retry on a
 * truncation), which is text-only and cheap — but it is real money and it is
 * therefore never part of `pnpm test`.
 */
import "dotenv/config";

import { castingBriefCompiler } from "../server/castingV2/briefCompiler";
import { GOLDEN_BRIEFS } from "../server/castingV2/goldenBriefs";
import { createOpenRouterTextEngine } from "../server/providers/openrouterText";
import type { TextEngine } from "../server/providers/types";

const N = Number(process.env.N ?? 60);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const ALL = process.env.ALL === "1";

/** The recurring one, unless told otherwise. */
const DEFAULT_BRIEF = "a twitch streamer";

const briefs = ALL
  ? GOLDEN_BRIEFS.filter((golden) => golden.category && !golden.deferredTo).map((g) => g.brief)
  : [process.env.BRIEF ?? DEFAULT_BRIEF];

type Sample = {
  /** What the interpreter itself returned, before any repair. */
  rawRole: string | null;
  rawAxis: string | null;
  /** What survived compilation — what the sheet and the echo actually see. */
  finalRole: string | null;
  /** The reply was cut off at the ceiling on the FIRST attempt. */
  truncatedFirst: boolean;
  /** The compile fell back: interpreter unreachable or unreadable. */
  fellBack: boolean;
  ms: number;
};

/**
 * An engine that reports what the transport did, without changing it.
 *
 * The wrapper only observes — same model, same ceiling, same prompt — because
 * an instrument that alters the thing it measures is measuring itself.
 */
type Observed = {
  truncatedFirst: boolean;
  calls: number;
  /** The LAST reply's own words — what the compiler then repaired or guarded. */
  rawRole: string | null;
  rawAxis: string | null;
};

function observingEngine(seen: Observed): TextEngine {
  const inner = createOpenRouterTextEngine({ apiKey: process.env.OPENROUTER_API_KEY! });
  return {
    complete: async (request: Parameters<TextEngine["complete"]>[0]) => {
      /*
        CEILING is the one knob this harness may turn, and only to answer
        "would a bigger ceiling have helped?" — a question that cannot be
        answered by reading the code, because what overruns the ceiling is
        invisible from outside. Unset, the production value stands.
      */
      const ceiling = process.env.CEILING ? Number(process.env.CEILING) : undefined;
      const result = await inner.complete(ceiling ? { ...request, maxOutputTokens: ceiling } : request);
      seen.calls += 1;
      if (seen.calls === 1 && result.truncated === true) seen.truncatedFirst = true;
      /*
        Read the interpreter's own answer before anything downstream touches it.

        Parsed here rather than exported from the compiler, because the whole
        point is to see the value the repair and the guard later act on — and
        adding a debug field to production output to satisfy a measurement is
        how instruments start changing what they measure.
      */
      try {
        const parsed = JSON.parse(result.text) as Record<string, unknown>;
        const role = parsed.role;
        const axis = parsed.variationAxis;
        seen.rawRole = typeof role === "string" && role.trim() ? role.trim() : null;
        seen.rawAxis = typeof axis === "string" ? axis : null;
      } catch {
        // A reply that will not parse is exactly the fallback case, and the
        // compiler reports that separately through `interpreted`.
      }
      return result;
    },
  } as TextEngine;
}

async function sampleOnce(brief: string, index: number): Promise<Sample> {
  const seen: Observed = { truncatedFirst: false, calls: 0, rawRole: null, rawAxis: null };
  const startedAt = Date.now();
  const compiled = await castingBriefCompiler({
    briefText: brief,
    candidateCount: 8,
    // A fresh seed per sample: the same seed recompiles the same sheet by
    // design, which would measure one draw many times.
    rollSeed: `measure-${index}-${Date.now()}`,
    engine: observingEngine(seen),
  });
  const compiledBrief = compiled.compiledBrief as {
    intent?: Record<string, unknown>;
    interpreted?: boolean;
  };
  const intent = compiledBrief.intent ?? {};
  return {
    rawRole: seen.rawRole,
    rawAxis: seen.rawAxis,
    finalRole: (intent.role as string | null) ?? null,
    truncatedFirst: seen.truncatedFirst,
    fellBack: compiledBrief.interpreted === false,
    ms: Date.now() - startedAt,
  };
}

/** Run `total` samples `concurrency` at a time, so a long run is not serial. */
async function runPool(brief: string, total: number, concurrency: number): Promise<Sample[]> {
  const out: Sample[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const index = next++;
      if (index >= total) return;
      try {
        const sample = await sampleOnce(brief, index);
        out.push(sample);
        process.stdout.write(sample.finalRole ? "." : "N");
      } catch (error) {
        process.stdout.write("E");
        out.push({
          rawRole: null, rawAxis: null, finalRole: null,
          truncatedFirst: false, fellBack: false, ms: 0,
        });
        if (out.length <= 3) console.error(`\n  ${String(error).slice(0, 200)}`);
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Wilson score interval — the honest way to put a bound on a small-count rate.
 *
 * A naive ±sqrt(p(1-p)/n) is badly wrong near zero, which is exactly where this
 * measurement lives: 0 misses in 60 does NOT mean the rate is zero, and this
 * says so rather than letting a clean run read as proof.
 */
function wilson(hits: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.96;
  const p = hits / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const halfWidth = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - halfWidth) / d), Math.min(1, (centre + halfWidth) / d)];
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

for (const brief of briefs) {
  console.log(`\n=== "${brief}" — ${N} samples, ${CONCURRENCY} at a time ===`);
  const samples = await runPool(brief, N, CONCURRENCY);
  console.log("");

  const misses = samples.filter((s) => !s.finalRole);
  const [lo, hi] = wilson(misses.length, samples.length);

  console.log(`role NULL:        ${misses.length}/${samples.length}  (${pct(misses.length / samples.length)}, 95% CI ${pct(lo)}–${pct(hi)})`);

  // The breakdown that names the mechanism.
  const interpreterNull = samples.filter((s) => !s.rawRole);
  const repairFired = interpreterNull.filter((s) => s.finalRole);
  const repairDeclined = interpreterNull.filter((s) => !s.finalRole);
  const guardedAway = samples.filter((s) => s.rawRole && !s.finalRole);
  const truncated = samples.filter((s) => s.truncatedFirst);
  const fellBack = samples.filter((s) => s.fellBack);

  console.log(`  interpreter returned no role:  ${interpreterNull.length}`);
  console.log(`    ...repair FIRED (recovered): ${repairFired.length}`);
  console.log(`    ...repair DECLINED (a miss): ${repairDeclined.length}`);
  console.log(`  role written then GUARDED away: ${guardedAway.length}`);
  console.log(`  truncated at the ceiling (1st): ${truncated.length}  (${pct(truncated.length / samples.length)})`);
  console.log(`  compile fell back:              ${fellBack.length}`);

  if (guardedAway.length > 0) {
    /*
      The words the guard rejected. Printed because a rate cannot tell you
      whether a guard is wrong — only the string it threw away can.
    */
    const counts = new Map<string, number>();
    for (const s of guardedAway) counts.set(s.rawRole!, (counts.get(s.rawRole!) ?? 0) + 1);
    console.log("  roles the guard dropped:");
    for (const [role, count] of [...counts].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${count}x  "${role}"`);
    }
  }

  const kept = samples.filter((s) => s.rawRole && s.finalRole);
  if (kept.length > 0) {
    const counts = new Map<string, number>();
    for (const s of kept) counts.set(s.rawRole!, (counts.get(s.rawRole!) ?? 0) + 1);
    console.log("  roles the guard kept:");
    for (const [role, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`     ${count}x  "${role}"`);
    }
  }

  if (repairDeclined.length > 0) {
    const axes = new Map<string, number>();
    for (const s of repairDeclined) axes.set(String(s.rawAxis), (axes.get(String(s.rawAxis)) ?? 0) + 1);
    console.log(`  variationAxis on the declines:  ${[...axes].map(([a, c]) => `${a}=${c}`).join(", ")}`);
    console.log("    (the repair only fires on axis 'look' — that guard is the mechanism)");
  }

  const latencies = samples.map((s) => s.ms).filter((m) => m > 0).sort((a, b) => a - b);
  if (latencies.length) {
    console.log(`  latency p50/p95:                ${latencies[Math.floor(latencies.length * 0.5)]}ms / ${latencies[Math.floor(latencies.length * 0.95)]}ms`);
  }
}
process.exit(0);
