/**
 * A/B the interpreter prompt, live, before concluding anything.
 *
 * The composed-direction change landed dark because Margiela — pinned as the
 * anti-regression — captured 2/3 afterwards. But the BEFORE figure was a single
 * sample, which proves nothing about a stochastic behaviour, so "the new prompt
 * caused it" was a hypothesis rather than a finding.
 *
 * This measures both sides properly. The OLD prompt is reconstructed by
 * removing exactly the `composedDirection` block from the current one — the
 * diff between the two commits is that block and nothing else, so the
 * reconstruction is the real previous prompt rather than an approximation.
 *
 *   npx tsx scripts/drive-interpreter-ab.mts          # 10 samples per side
 *   SAMPLES=4 npx tsx scripts/drive-interpreter-ab.mts
 */
import "dotenv/config";

import { INTERPRETER_SYSTEM_PROMPT } from "../server/castingV2/interpreter";
import { parseCastingIntent } from "../server/castingV2/castingIntent";
import { createOpenRouterTextEngine } from "../server/providers/openrouterText";

const SAMPLES = Number(process.env.SAMPLES ?? 10);

const NEW_PROMPT = INTERPRETER_SYSTEM_PROMPT;

/** The previous prompt: identical, minus the block this change added. */
const OLD_PROMPT = (() => {
  let text = NEW_PROMPT;
  text = text.replace(
    '  "reads": [8 short strings] | null,\n  "composedDirection": { "thesis": string, "avoid": string } | null\n',
    '  "reads": [8 short strings] | null\n',
  );
  const bulletStart = text.indexOf('- "composedDirection":');
  const bulletEnd = text.indexOf('- "reads": exactly eight');
  if (bulletStart < 0 || bulletEnd < 0) throw new Error("could not reconstruct the old prompt — check the markers");
  return text.slice(0, bulletStart) + text.slice(bulletEnd);
})();

if (OLD_PROMPT.includes("composedDirection")) throw new Error("old prompt still mentions the new field");
if (!NEW_PROMPT.includes("composedDirection")) throw new Error("new prompt is missing the new field");

const BRIEFS = [
  { brief: "a Margiela runway face, early 20s", label: "Margiela (ANTI-REGRESSION)" },
  { brief: "female mid 20s fashion model casting for miu miu", label: "miu miu" },
  { brief: "a Wes Anderson casting, mid 30s", label: "Wes Anderson (non-fashion)" },
];

const engine = createOpenRouterTextEngine({ apiKey: process.env.OPENROUTER_API_KEY! });

async function sample(system: string, briefText: string) {
  /*
    Mirrors interpretBrief EXACTLY. The first run of this omitted
    maxOutputTokens and produced a 60% JSON-truncation rate, which the tally
    then counted as "landed" — a broken instrument reporting a fictional
    result. The 1200 ceiling exists in the product for precisely this reason.
  */
  const result = await engine.complete({
    system,
    user: briefText,
    json: true,
    temperature: 0.2,
    maxOutputTokens: 1800,
  });
  const parsed = parseCastingIntent(result.text);
  if (!parsed.ok) return { landed: false, where: "parse-failed" };
  const i = parsed.intent;
  const where =
    i.composedDirection != null ? "composed" : i.look != null ? "look" : i.archetype != null ? "archetype" : "NOWHERE";
  return { landed: where !== "NOWHERE", where };
}

console.log(`A/B, ${SAMPLES} samples per brief per side, live interpreter.\n`);

for (const { brief, label } of BRIEFS) {
  const rows: string[] = [];
  for (const [side, system] of [["OLD", OLD_PROMPT], ["NEW", NEW_PROMPT]] as const) {
    const wheres: string[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      try {
        wheres.push((await sample(system, brief)).where);
      } catch {
        wheres.push("error");
      }
    }
    // Only VALID samples count. A parse failure or a transport error is the
    // harness failing, not the prompt, and folding them in either direction
    // reports a number nobody can act on.
    const valid = wheres.filter((w) => w !== "parse-failed" && w !== "error");
    const landed = valid.filter((w) => w !== "NOWHERE").length;
    const tally = [...new Set(wheres)].map((w) => `${w}:${wheres.filter((x) => x === w).length}`).join(" ");
    rows.push(`  ${side}: landed ${landed}/${valid.length} valid   (${tally})`);
  }
  console.log(`=== ${label}\n${rows.join("\n")}\n`);
}
