/**
 * D-79 condition 4 — the LIVE verification, before the flag may flip.
 *
 * The rolled-back build was green in CI and broken in production because every
 * test stubbed the interpreter with an intent that already contained the fact
 * the bug removed. This driver runs the REAL interpreter against the founder's
 * own briefs and reports what it actually returns.
 *
 * It asserts two different things, and the split matters:
 *
 *   - **The safety property**, which holds regardless of what the model does:
 *     no part the code-owned gate detects as spoken may be authored over. This
 *     is the D-89 theorem and it is also checked offline; here it is checked
 *     against live output, which is the only place the theorem could be wrong.
 *   - **The delivery property**, which depends on the model cooperating: the
 *     stated fact reaches the composed prompt, and the parts the brief left
 *     open are still authored and varied.
 *
 * A failure of the first is a defect. A failure of the second is the
 * interpreter under-performing, which degrades to today's behaviour rather than
 * to a contradiction — reported separately so the two are never confused.
 *
 * Costs a few text calls per brief; a driver, never part of `pnpm test`.
 *
 *   npx tsx scripts/drive-partial-deference.mts
 *   RUNS=3 npx tsx scripts/drive-partial-deference.mts
 */
import "dotenv/config";

import { interpretBrief } from "../server/castingV2/interpreter";
import { spokenHairParts, mentionsHairAtAll, briefStatesCoverage } from "../server/castingV2/cohortPhotorealHuman";
import { HAIR_PARTS } from "../shared/castingRealization";

const RUNS = Number(process.env.RUNS ?? 1);

/** The five founder briefs from D-79, plus the two M7 goldens. */
const BRIEFS = [
  { brief: "a woman with pastel pink hair", expect: "colour" },
  { brief: "a redhead in her 30s", expect: "colour" },
  { brief: "A skincare founder in his 40s, silver at the temples", expect: "greying" },
  { brief: "runway model, early 20s, shaved head", expect: "coverage" },
  { brief: "An East Asian model with long pastel pink hair", expect: "colour+length" },
  {
    brief: "a gothic male heavy metal bogan with a long beard and long hair in his mid 20s",
    expect: "length",
  },
  { brief: "a photographer in his 50s with salt and pepper hair", expect: "greying" },
] as const;

let safetyFailures = 0;
let deliveryMisses = 0;

for (const entry of BRIEFS) {
  for (let run = 1; run <= RUNS; run += 1) {
    const outcome = await interpretBrief({ briefText: entry.brief });
    if (!outcome.ok) {
      console.log(`✗ ${entry.brief} [run ${run}] — interpreter ${outcome.reason}`);
      deliveryMisses += 1;
      continue;
    }

    const intent = outcome.intent;
    const stated = intent.statedHair;
    const sources = [entry.brief, intent.role ?? "", intent.characterNotes ?? ""];
    const spoken = spokenHairParts(...sources);
    const coverage = briefStatesCoverage(...sources);

    /*
      THE SAFETY PROPERTY. A structured value may only exist for a part; it can
      never claim a part the gate did not see, because the gate is the authority
      on WHETHER. This is the invariant that makes the worst interpreter output
      harmless.
    */
    const named = HAIR_PARTS.filter((part) => stated[part] != null);
    const overreach = named.filter((part) => !spoken.has(part) && !mentionsHairAtAll(...sources));
    if (overreach.length > 0) {
      console.log(`✗ SAFETY ${entry.brief} [run ${run}] — claimed ${overreach.join(",")} the gate never saw`);
      safetyFailures += 1;
    }

    // Coverage briefs must fill nothing — there is no remainder to describe.
    if (coverage && (named.length > 0 || stated.greying)) {
      console.log(`✗ SAFETY ${entry.brief} [run ${run}] — filled statedHair on a coverage brief`);
      safetyFailures += 1;
    }

    const summary = [
      named.length > 0 ? named.map((part) => `${part}="${stated[part]}"`).join(" ") : "",
      stated.greying ? "greying" : "",
      coverage ? "coverage" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    // The delivery half: did the interpreter actually say what the brief said?
    const delivered =
      entry.expect === "coverage"
        ? coverage
        : entry.expect === "greying"
          ? stated.greying
          : named.length > 0;
    if (!delivered) deliveryMisses += 1;

    console.log(
      `${delivered ? "✓" : "·"} ${entry.brief}\n    gate: [${[...spoken].join(",") || "—"}]${
        mentionsHairAtAll(...sources) ? " +mention" : ""
      }  interpreter: ${summary || "—"}  role: ${intent.role ?? "null"}`,
    );
  }
}

console.log(
  `\nSAFETY failures: ${safetyFailures}  (must be 0)\nDelivery misses: ${deliveryMisses} of ${BRIEFS.length * RUNS}`,
);
process.exitCode = safetyFailures > 0 ? 1 : 0;

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
