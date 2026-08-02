/**
 * What the interpreter actually emits, per brief — the evidence before the fix.
 *
 * Written for the founder's presence-audit batch, where four separate findings
 * all hinge on the same unknown: what did the interpreter put in
 * `poolTendencies` and `composedDirection` for these briefs? The instruction
 * was explicit — if the persisted record shows nothing was emitted, report
 * before touching weights — because tuning a weight to fix a field that was
 * never filled is how an instrument lies to you twice.
 *
 *   npx tsx scripts/drive-tendency-diagnosis.mts
 *   RUNS=3 npx tsx scripts/drive-tendency-diagnosis.mts
 */
import "dotenv/config";

import { interpretBrief } from "../server/castingV2/interpreter";

const RUNS = Number(process.env.RUNS ?? 1);

const BRIEFS = [
  // (4) The null control. Should emit NOTHING.
  "a skincare founder in his 40s",
  "an oncology nurse",
  // (5) The lumberjack — why did no age lean fire on a physical trade?
  "a clean-shaven lumberjack",
  "a lumberjack in his 40s",
  // (1) Heritage — grooming landed, heritage had no channel.
  "a k-pop idol",
  // (2) Categories with a strong documented aesthetic.
  "a drill sergeant",
  "a monk",
  "a biker gang leader",
  // (6) The Viking, as a category rather than a reference.
  "An early 30's male Viking look",
  "a twitch streamer",
];

for (const brief of BRIEFS) {
  for (let run = 1; run <= RUNS; run += 1) {
    const outcome = await interpretBrief({ briefText: brief });
    if (!outcome.ok) {
      console.log(`${brief}\n    interpreter ${outcome.reason}\n`);
      continue;
    }
    const intent = outcome.intent;
    const tendencies = intent.poolTendencies;
    console.log(
      `${brief}\n` +
        `    role: ${intent.role ?? "null"}   heritage: ${
          intent.heritage.map((component) => component.heritage).join("+") || "—"
        }   age: ${intent.ageBand ?? "null"}\n` +
        `    tendencies: age=${tendencies?.ageLean ?? "null"} beard=${tendencies?.facialHairLean ?? "null"} heritage=${tendencies?.heritageLean ?? "null"} strength=${tendencies?.leanStrength ?? "null"}\n` +
        `    archetype: ${intent.archetype ?? "null"}   look: ${intent.look ?? "null"}\n` +
        `    composedDirection: ${
          intent.composedDirection
            ? `"${intent.composedDirection.thesis}" / avoid "${intent.composedDirection.avoid}"`
            : "null"
        }\n`,
    );
  }
}
