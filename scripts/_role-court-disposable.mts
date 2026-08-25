/**
 * THE ROLE COURT — does the brief-fidelity lane cost his sheet its CASTING
 * CATEGORY? (ordered fable-1641 §1, from the diagnosis in opus-1262.)
 *
 * # The question, and why it is worth sixty cents
 *
 * His complaint: *"the augments and cybernetics delivered were underwhelming,
 * all the casts look very similar."* Read at the artifacts, roll 214's eight
 * per-slice prompts share 140 of 159 sentences and EVERY augment line is
 * byte-identical — because `intent.role` came back **null**, and `role` is the
 * only field in the product that produces the `CASTING CATEGORY (ABSOLUTE)`
 * block. His four earlier rolls of the identical brief all carried it.
 *
 * That is n=1 on the fidelity side. A language model that names a role four
 * times can decline the fifth on its own, so the diagnosis proposed a cause and
 * refused to build on it. **This court decides between "the flag causes it" and
 * "the interpreter drifts", which are repairs at different layers.**
 *
 * # What it drives, and what it does NOT
 *
 * The real `castingBriefCompiler` on his real 553-character brief, N times with
 * `briefFidelity: true` and N times with `false`. **No prompt is rewritten** —
 * unlike the budget court, the treatment here is a boolean the compiler already
 * takes, so both arms are the product's own bytes. **Text calls only: no image
 * is rendered, no credit is spent, nothing is written to any database.**
 *
 * # The three things recorded per compile
 *
 *   role            null or the string — the finding
 *   notesChars      `characterNotes` length — the MECHANISM (fable-1641 §1:
 *                   long notes crowding out `role` is "context is not
 *                   additive", and it is measured here rather than argued
 *                   afterwards)
 *   categoryInPrompt whether `CASTING CATEGORY` actually reaches a candidate
 *                   prompt — the LINK, so the court never has to infer that
 *                   a null role loses the block. It reads it.
 *
 * # Spend
 *
 * Costed at ~$0.60 for 20 compiles and countersigned before running. The
 * ceiling REFUSES to dispatch past it rather than warning, and the openrouter
 * balance is read at both ends.
 *
 *   npx tsx scripts/_role-court-disposable.mts [N] [--ceiling 1.50]
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import type { TextEngine, TextRequest, TextResult } from "../server/providers/types";

const N = Number(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : 10);
const ceilingFlag = process.argv.indexOf("--ceiling");
const CEILING_USD = ceilingFlag === -1 ? 1.5 : Number(process.argv[ceilingFlag + 1]);
const OUT = "output/role-court";

/** `anthropic/claude-sonnet-5`, the published rate the census reconciled to. */
const USD_PER_M_IN = 2;
const USD_PER_M_OUT = 10;

const { castingBriefCompiler } = await import("../server/castingV2/briefCompiler");
const { interpreterEngine } = await import("../server/castingV2/interpreter");
const { readOpenRouterBalance } = await import("./lib/openrouterBalance.mts");

/** His own brief, verbatim — byte-identical to the budget court's `CYBORG`. */
const CYBORG =
  "Bald male, mid-40s, pale porcelain skin, heavily weathered. Severe bone structure: "
  + "pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks. Intense unsmiling expression. "
  + "Cybernetic augmentation as part of his body: matte-black implant ports embedded in his skull "
  + "above the right temple, fine metal seams running across his scalp like plate joins, a dark "
  + "mechanical plate along his jawline, a small black implant stud below each ear, and his right "
  + "eye glowing faint amber-red. The augmentations are surgically integrated into his skin, not worn.";

if (CYBORG.length !== 553) throw new Error(`brief is ${CYBORG.length} chars, not 553`);

mkdirSync(OUT, { recursive: true });
const lines: string[] = [];
const say = (text = "") => {
  lines.push(text);
  console.log(text);
};

let calls = 0;
let spentUsd = 0;
class CeilingReached extends Error {}

/**
 * WHICH MODEL ANSWERED THE INTERPRET CALL (ordered fable-1642).
 *
 * The transport DOES expose it — `provenance.model` is the slug requested and
 * `servedModel` the snapshot the provider reported serving — so an
 * intermittent null that clusters by upstream routing is separable from one
 * that does not. Captured per compile, reset before each.
 */
let interpretModel: string | null = null;

/** The product's own engine, metered. Nothing about the request is changed. */
function meteredEngine(base: TextEngine): TextEngine {
  return {
    id: `${base.id}+metered`,
    async complete(request: TextRequest): Promise<TextResult> {
      if (spentUsd >= CEILING_USD) {
        throw new CeilingReached(`spend ceiling $${CEILING_USD.toFixed(2)} reached — refusing to dispatch`);
      }
      const result = await base.complete(request);
      calls += 1;
      if (request.about === "interpret") {
        const p = result.provenance;
        interpretModel = p?.servedModel && p.servedModel !== p.model
          ? `${p.model} (served ${p.servedModel})`
          : (p?.model ?? null);
      }
      if (result.tokens) {
        spentUsd += (result.tokens.in / 1e6) * USD_PER_M_IN + (result.tokens.out / 1e6) * USD_PER_M_OUT;
      }
      return result;
    },
  };
}

const base = interpreterEngine();
if (!base) throw new Error("no OPENROUTER_API_KEY — this court drives the real interpreter");

const head = execSync("git rev-parse --short HEAD").toString().trim();
const tracked = execSync("git status --porcelain --untracked-files=no").toString().trim();
const before = await readOpenRouterBalance();

say("THE ROLE COURT — does the fidelity lane cost his sheet its CASTING CATEGORY?");
say(`TREE  head ${head}  (${tracked === "" ? "clean" : "DIRTY: " + tracked})`);
say(`BRIEF ${CYBORG.length} chars    N=${N} per side    ceiling $${CEILING_USD.toFixed(2)}`);
say(`BAL   openrouter before: ${before.ok ? `$${before.remaining.toFixed(4)} remaining` : `unreadable (${before.why})`}`);
say();

type Row = {
  fidelity: boolean;
  drive: number;
  role: string | null;
  notesChars: number;
  categoryInPrompt: boolean;
  interpreted: boolean;
  model: string | null;
  refused: string | null;
};
const rows: Row[] = [];

async function runArm(fidelity: boolean): Promise<void> {
  say(`=== briefFidelity: ${fidelity ? "TRUE  (the lane ON)" : "FALSE (today's road)"} ===`);
  for (let i = 1; i <= N; i += 1) {
    let compiled: Record<string, any> | null = null;
    let refused: string | null = null;
    interpretModel = null;
    try {
      compiled = await castingBriefCompiler({
        briefText: CYBORG,
        candidateCount: 8,
        /* The seed varies per drive so the resolver is not answering from one
           cached shape; the INTERPRETER call is identical either way. */
        rollSeed: `role-court-${fidelity ? "on" : "off"}-${i}`,
        /*
          ⚠ HELD AT HIS ROLL'S SHAPE. Rolls 213 and 214 are both `path:
          wardrobe`, so `rollService` passed `pickWardrobe: true` — and the
          compiler forwards it into the INTERPRETER call. The first version of
          this court omitted it and was therefore compiling a different ask
          from the one that produced the finding. Caught by the N=1 validation
          run before the full spend, which is what that run is for.
          `readInk` stays false: `CASTING_BORN_INK_SCOPE` is unset on the
          service, so his rolls had it false too.
        */
        pickWardrobe: true,
        briefFidelity: fidelity,
        engine: meteredEngine(base!),
      }) as unknown as Record<string, any>;
    } catch (error) {
      if (error instanceof CeilingReached) { say(`  ⚠ ${error.message}`); return; }
      refused = error instanceof Error ? error.message : String(error);
    }

    const blob = (compiled?.compiledBrief ?? {}) as Record<string, any>;
    const intent = (blob.intent ?? {}) as Record<string, any>;
    const prompts: string[] = (compiled?.candidates ?? []).map((c: any) => c.prompt ?? "");
    const row: Row = {
      fidelity,
      drive: i,
      role: intent.role ?? null,
      notesChars: String(intent.characterNotes ?? "").length,
      categoryInPrompt: prompts.some((p) => p.includes("CASTING CATEGORY")),
      interpreted: blob.interpreted === true,
      model: interpretModel,
      refused,
    };
    rows.push(row);

    if (refused !== null) { say(`  ${i}. ⚠ REFUSED — ${refused.slice(0, 120)}`); continue; }
    say(
      `  ${String(i).padStart(2)}. role ${row.role === null ? "NULL                        " : `"${row.role}"`.padEnd(30)}`
      + ` notes ${String(row.notesChars).padStart(4)}ch  CATEGORY ${row.categoryInPrompt ? "yes" : "NO "}`
      + `  ${row.model ?? "model unrecorded"}`
      + `${row.interpreted ? "" : "  ⚠ NOT INTERPRETED — the fallback compiled it"}`,
    );
  }
  say();
}

await runArm(false);
await runArm(true);

/* ------------------------------------------------------------------ the read */
const after = await readOpenRouterBalance();
const side = (f: boolean) => rows.filter((r) => r.fidelity === f && r.refused === null);
const nullRate = (f: boolean) => {
  const s = side(f);
  return s.length === 0 ? "n/a" : `${s.filter((r) => r.role === null).length}/${s.length}`;
};
const noCategory = (f: boolean) => {
  const s = side(f);
  return s.length === 0 ? "n/a" : `${s.filter((r) => !r.categoryInPrompt).length}/${s.length}`;
};
const meanNotes = (f: boolean) => {
  const s = side(f);
  return s.length === 0 ? 0 : Math.round(s.reduce((t, r) => t + r.notesChars, 0) / s.length);
};

say("=".repeat(72));
say("THE TWO NUMBERS");
say(`  role NULL          lane OFF ${nullRate(false).padStart(6)}     lane ON ${nullRate(true).padStart(6)}`);
say(`  CATEGORY absent    lane OFF ${noCategory(false).padStart(6)}     lane ON ${noCategory(true).padStart(6)}`);
say(`  mean notes chars   lane OFF ${String(meanNotes(false)).padStart(6)}     lane ON ${String(meanNotes(true)).padStart(6)}`);
say();
/* The link, read rather than assumed: does a null role always lose the block? */
const withRole = rows.filter((r) => r.refused === null && r.role !== null);
const withoutRole = rows.filter((r) => r.refused === null && r.role === null);
say(`  role set    → CATEGORY present in ${withRole.filter((r) => r.categoryInPrompt).length}/${withRole.length}`);
say(`  role null   → CATEGORY present in ${withoutRole.filter((r) => r.categoryInPrompt).length}/${withoutRole.length}`);
say();
const models = [...new Set(rows.filter((r) => r.model).map((r) => r.model!))];
say(`  models answering the interpret call: ${models.length === 0 ? "unrecorded by the transport" : models.join(" · ")}`);
if (models.length > 1) {
  for (const m of models) {
    const s2 = rows.filter((r) => r.model === m && r.refused === null);
    say(`    ${m}: role null ${s2.filter((r) => r.role === null).length}/${s2.length}`);
  }
}
say();
say(`SPEND ${calls} calls · $${spentUsd.toFixed(4)} by token count`);
say(`BAL   openrouter after: ${after.ok ? `$${after.remaining.toFixed(4)} remaining` : `unreadable (${after.why})`}`);
if (before.ok && after.ok) say(`      delta $${(before.remaining - after.remaining).toFixed(4)}`);

writeFileSync(`${OUT}/role-court.log`, lines.join("\n") + "\n");
writeFileSync(`${OUT}/role-court.json`, JSON.stringify({ head, N, rows, calls, spentUsd }, null, 2));
say(`\nrows: ${OUT}/role-court.json`);

/* The exit discipline: a script ends by ending the process, last statement. */
process.exit(0);
