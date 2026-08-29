/**
 * DISPOSABLE (foreman-111) — WHAT THE STUDIO SAYS THE DAY THE TEXT ACCOUNT RUNS DRY.
 *
 * Free. No network, no database, no credits, no renders. Every text call is a
 * DOUBLE that throws the exact ProviderError a 402 produces
 * (`classifyOpenRouterTextHttp(402) === "provider_account"`, read at
 * `server/providers/openrouterText.ts`), so the branch under test is driven
 * directly rather than through a reader that usually behaves (working law 3).
 *
 * Asks one question per paid road: does it (a) charge, (b) how many doomed
 * calls does it make, and (c) WHAT DOES IT SAY.
 *
 * Usage:  npx tsx scripts/_shift111-dry-account-drive-disposable.mts 2>&1 | tee output/_shift111-dry.log
 */
import { config } from "dotenv";
config({ quiet: true });

import { ProviderError, type TextEngine, type TextRequest, type TextResult } from "../server/providers/types";
import { interpretRefinement, refusalMessage } from "../server/castingV2/refineInterpreter";
import { castingBriefCompiler } from "../server/castingV2/briefCompiler";

let calls = 0;

/** The engine an overdrawn OpenRouter account produces: 402 -> provider_account, non-retryable. */
const dryAccount: TextEngine = {
  id: "double:dry-account",
  async complete(_request: TextRequest): Promise<TextResult> {
    calls += 1;
    throw new ProviderError("provider_account", "openrouter 402 insufficient credits", { status: 402 });
  },
};

/**
 * POSITIVE CONTROL: an engine that ANSWERS, per road.
 *
 * ⚠ The first shape of this drive shared one "healthy" double across both roads
 * and BOTH CONTROLS REFUSED — the reply was the wrong schema for either
 * interpreter, so the dry-account arms were indistinguishable from the controls
 * and the run proved nothing. A control must produce a VERIFIED outcome.
 * Replies below are the shapes the real suites use
 * (`inventionDoor.test.ts`, `briefCompiler.test.ts`).
 */
function answering(reply: string): TextEngine {
  return {
    id: "double:answering",
    async complete(_request: TextRequest): Promise<TextResult> {
      calls += 1;
      return {
        text: reply,
        provenance: { provider: "openrouter" as const, model: "double", servedModel: "double" },
        latencyMs: 1,
      };
    },
  };
}

const refineAnswers = answering(JSON.stringify({ intent: "edit", eyeColour: "green" }));
const rollAnswers = answering(JSON.stringify({ cohort: "photoreal_human", role: "a woman in her 30s", ageBand: "30s" }));

async function road(name: string, engine: TextEngine, run: (e: TextEngine) => Promise<string>) {
  calls = 0;
  let said: string;
  try {
    said = await run(engine);
  } catch (error) {
    const e = error as { code?: string; message?: string; name?: string };
    said = `THREW ${e.name ?? ""} code=${e.code ?? "-"} :: ${e.message ?? String(error)}`;
  }
  console.log(`\n--- ${name}  [engine ${engine.id}]`);
  console.log(`    doomed text calls: ${calls}`);
  console.log(`    says: ${said}`);
}

async function refine(engine: TextEngine): Promise<string> {
  const parse = await interpretRefinement({
    instruction: "make her eyes green",
    currentEyeColour: "brown",
    currentEyeShape: null,
    engine,
  } as Parameters<typeof interpretRefinement>[0]);
  if (parse.ok) return `OK (parsed) ${JSON.stringify(parse).slice(0, 120)}`;
  return `REFUSED reason=${parse.refusal.reason} :: ${refusalMessage(parse)}`;
}

async function roll(engine: TextEngine): Promise<string> {
  const compiled = await castingBriefCompiler({
    briefText: "a woman in her 30s, nordic, blonde, severe minimal look",
    engine,
  } as Parameters<typeof castingBriefCompiler>[0]);
  return `OK (compiled) keys=${Object.keys(compiled ?? {}).slice(0, 4).join(",")}`;
}

async function main() {
  console.log("THE DAY THE TEXT ACCOUNT RUNS DRY — driven, foreman-111");
  console.log("engine double throws ProviderError('provider_account', status 402) on every call\n");

  console.log("== CONTROLS FIRST (an answering engine must NOT refuse) ==");
  await road("REFINE  — answering control", refineAnswers, refine);
  await road("ROLL    — answering control", rollAnswers, roll);

  console.log("\n== THE DRY ACCOUNT ==");
  await road("REFINE  — dry account", dryAccount, refine);
  await road("ROLL    — dry account", dryAccount, roll);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
