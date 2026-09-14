/**
 * THE REVIEWER COURT — GPT-6 Astra against Fable, on the ten PRs Fable already
 * judged (#513).
 *
 * # Why it runs tonight
 *
 * The card was blocked on ONE external condition, in his own words:
 * *"leave it for when openrouter is available through openrouter."* Read at the
 * artifact 2026-09-13: `openai/gpt-6-astra` is listed on OpenRouter at
 * $10/M prompt, $50/M completion, 1,050,000 context. The condition has cleared,
 * so the court runs. Under THE SPEND THRESHOLD ($50) it needs no funding card;
 * the estimate is on the issue before it fires and the actual after.
 *
 * # What it does, and the ONE decision in it that is not the card's
 *
 * For each of the ten PRs it rebuilds the input `review.yml` gave Fable:
 *
 *   - the SAME prompt text, lifted from the workflow's `prompt:` block;
 *   - the SAME tier — the workflow's own MONEY regex decides whether the
 *     reviewer reads CLAUDE.md in full (`deep`) or docs/REVIEWER_CHARTER.md;
 *   - the same diff.
 *
 * ⚠ **AND THE ASYMMETRY THAT WOULD OTHERWISE HAVE DECIDED THIS COURT, STATED
 * RATHER THAN DISCOVERED IN THE SCORESHEET.** Fable does not review a diff: it
 * runs inside `claude-code-action` with the repository checked out and TOOLS,
 * so it opens whatever file a finding turns on. Astra through OpenRouter gets
 * one completion and can open nothing. A court that hands one side the codebase
 * and the other a patch is measuring the HARNESS, and every "Astra missed it"
 * would be unreadable — it could equally mean "Astra could not look."
 *
 * So each request also carries the **full post-merge text of every source file
 * the diff touches**. That is the closest a single completion gets to an agent
 * with a checkout, and it fits: the ten diffs plus their files are far inside
 * 1.05M tokens. It is generous to Astra where the card's literal reading would
 * have been stingy, which is the safe direction for a challenger — a challenger
 * that loses WITH the files cannot be said to have lost for want of them.
 *
 * What it still does not give Astra: files the diff does NOT touch (Fable can
 * reach those), and any ability to run a command. Both are recorded as limits;
 * neither is repairable in one completion.
 *
 * # What it is NOT
 *
 * It changes no workflow, flips no flag and switches no reviewer. The card is
 * explicit and so is this file: *"the reviewer stays Fable on his subscription
 * regardless of the result; a win for Astra is a founder decision, not a
 * shift's switch."* This script produces a scoresheet for his eye and nothing
 * else. Scoring the findings is a HAND pass at the code afterwards — a model
 * grading two models is not evidence (working law 2, and law 9's temper).
 *
 * Output: output/astra-court/ — one JSON per PR plus a combined roll-up.
 *
 * Usage:
 *   npx tsx scripts/_513-astra-court-disposable.mts            # all ten
 *   npx tsx scripts/_513-astra-court-disposable.mts --only 877,876
 *   npx tsx scripts/_513-astra-court-disposable.mts --dry-run  # build, spend nothing
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";

const OUT_DIR = join(process.cwd(), "output", "astra-court");
const MODEL = "openai/gpt-6-astra";
/** OpenRouter's own listing, read 2026-09-13. USD per token. */
const PRICE_PROMPT = 0.00001;
const PRICE_COMPLETION = 0.00005;

/** review.yml's triage: the surfaces that force a review AND the deep reading. */
const MONEY =
  /^server\/routes\/(billing|credits|auth|emailAuth|googleAuth|emailVerification)|^server\/db\/(billing|credits)\.ts$|^server\/stripe\/|^server\/_core\/(sdk|cookies|trpc|env)\.ts$|^server\/security\/|^shared\/const\.ts$|^drizzle\//;

/** review.yml's `prompt:` block, verbatim below the tier sentence. */
const TIER_DEEP =
  "This diff touches money/auth surfaces: read CLAUDE.md in full first — it is project law, it defines what a defect is here, and money/auth is where its deep context pays. If the diff touches a feature flag, read the entry for that flag in docs/architecture/FEATURE_FLAGS.md too — the flag catalogue was carved out of CLAUDE.md byte for byte (#330) and CLAUDE.md now carries only a locator index of it.";
const TIER_CHARTER =
  "Read docs/REVIEWER_CHARTER.md in full first — the distilled project law for reviews; it defines what a defect is here. CLAUDE.md remains the authority: open the specific section the charter names whenever a finding turns on detail the charter compresses, but do not read it end to end.";

const TASK = `Review the diff for, in priority order:
1. Correctness bugs — concrete inputs/state that produce wrong
   output, a crash, or lost money (credits charged without
   delivery, refunds that cannot fire).
2. Enforcement-invariant violations (CLAUDE.md "Enforcement
   invariants"): owner scoping missing from the SQL statement
   itself, userId taken from input instead of ctx.user.id,
   missing .strict() on new input schemas, bare selects or
   spread rows crossing the serialization boundary, a new
   public endpoint or session-mint site outside the enumerated
   lists.
3. Flag discipline: new reachable behavior not governed by its
   feature flag (new code must land dark), or a change that
   alters unflagged behavior as a side effect.
4. Controls: any deletion or refactor that could orphan a
   control (a caller of a guard being removed) — name what was
   bolted to the deleted path.
5. Tests: a bug fix without its failing-test reproduction, or a
   class fix without its sweep.

Report findings as a single review comment: most severe first,
each with file:line and a one-sentence failure scenario. If the
diff touches billing, credits, auth, or session code, say so in
your first line. If you find nothing, say what you checked and
pass it cleanly — do not invent findings.`;

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const DRY = process.argv.includes("--dry-run");
const ONLY = flag("only")?.split(",").map((s) => Number(s.trim()));

/**
 * ⚠ RETRIED, because `gh` on this machine drops connections to
 * api.github.com often enough that two shifts have recorded it
 * (`dial tcp 4.237.22.34:443`). A court that dies halfway has spent money and
 * produced nothing; a transient DNS/TCP stumble must not be the thing that
 * decides which reviewer wins.
 */
function gh(args: string[], attempts = 4): string {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return execFileSync("gh", args, {
        maxBuffer: 64 * 1024 * 1024,
        encoding: "buffer",
      }).toString("utf8");
    } catch (err) {
      last = err;
      const stderr = String((err as { stderr?: Buffer }).stderr ?? "");
      if (!/dial tcp|connection attempt|timeout|EOF|TLS/i.test(stderr)) throw err;
      console.log(`  gh stumbled (attempt ${i + 1}/${attempts}) — retrying`);
      execFileSync(process.execPath, ["-e", "setTimeout(()=>{}, 3000)"]);
    }
  }
  throw last;
}

/** Files whose full text is worth carrying: source the reviewer would open. */
function isSourceWorthCarrying(path: string): boolean {
  if (!/\.(ts|tsx|mts|js|jsx|css|yml|yaml)$/.test(path)) return false;
  if (path.startsWith("docs/architecture/")) return false; // generated atlas
  if (path.startsWith("output/") || path.startsWith(".agents/")) return false;
  if (path.endsWith("pnpm-lock.yaml")) return false;
  return true;
}

type PrRow = { number: number; title: string; mergedAt: string; verdict: string };

async function callAstra(system: string, user: string) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is absent — the court cannot run");
  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/michaelpaulrattray/Drape",
      "X-Title": "Drape reviewer court #513",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // ⚠ BOUNDED ON PURPOSE, AND NOT AS A QUALITY LIMIT. Without max_tokens
      // OpenRouter reserves the model's whole 1M-token completion ceiling
      // against the balance, so a 300k-token prompt is refused 402
      // `in_flight_budget_exhausted` on a balance that could pay for it twenty
      // times over. Fable's own verdicts on these ten PRs run 3.6–6.6 KB
      // (~1,200–1,700 tokens), so 8,000 is roughly five times the longest
      // review either side has produced — it bounds the RESERVATION, never the
      // answer. `finishReason` is recorded per PR; a `length` finish would mean
      // this bound bit, and none did.
      max_tokens: 8000,
      usage: { include: true },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 600)}`);
  const json = JSON.parse(text);
  return {
    latencyMs: Date.now() - started,
    content: json.choices?.[0]?.message?.content ?? "",
    finishReason: json.choices?.[0]?.finish_reason ?? null,
    usage: json.usage ?? null,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const prs: PrRow[] = JSON.parse(readFileSync(join(OUT_DIR, "prs.json"), "utf8"));
  const charter = readFileSync("docs/REVIEWER_CHARTER.md", "utf8");
  const claudeMd = readFileSync("CLAUDE.md", "utf8");

  const roll: Record<string, unknown>[] = [];
  let spend = 0;

  for (const pr of prs) {
    if (ONLY && !ONLY.includes(pr.number)) continue;

    const files: { path: string; additions: number; deletions: number }[] = JSON.parse(
      gh(["pr", "view", String(pr.number), "--json", "files"]),
    ).files;
    const paths = files.map((f) => f.path);
    const deep = paths.some((p) => MONEY.test(p));
    const diff = gh(["pr", "diff", String(pr.number)]);
    const mergeSha: string = JSON.parse(
      gh(["pr", "view", String(pr.number), "--json", "mergeCommit"]),
    ).mergeCommit.oid;

    /*
     * ⚠ AT THE PR'S OWN MERGE COMMIT, NEVER AT HEAD — and this was a live
     * defect in this court, caught by the hand pass and not by any arm.
     *
     * The first run read each file with `readFileSync(p)`, i.e. off the WORKING
     * TREE, which is `main` at HEAD — up to seven merged PRs into the future of
     * the diff being judged. So Astra was handed a diff from 12 September beside
     * files from 13 September and asked whether they agreed.
     *
     * It manufactured a finding, exactly as it should have: on #864 Astra
     * reported that the PR's own wiring tests "contradict the supplied
     * post-merge pages and will fail", because `CastingSheet.tsx` imports
     * `sheetGoneRefusal` and `CastingV2.tsx` calls `readSheetGone` — neither of
     * which existed when #864 merged. Both arrived in **PR #891**, a day later
     * (`git log -S sheetGoneRefusal` → `107196f4`). Astra's reasoning was
     * CORRECT and the inconsistency was real; the inconsistency was MINE.
     *
     * Measured across the ten: #864 both carried files drifted, #866 two, #872
     * two, #877 one; the other six were byte-identical either way. A court that
     * had shipped without this check would have scored a challenger down for
     * reading a tree the champion never saw — working law 2, and the reason
     * every finding here is opened at the code before it is counted.
     */
    const carried: string[] = [];
    let context = "";
    for (const p of paths) {
      if (!isSourceWorthCarrying(p)) continue;
      let body: string;
      try {
        body = execFileSync("git", ["show", `${mergeSha}:${p}`], {
          maxBuffer: 64 * 1024 * 1024,
          encoding: "buffer",
        }).toString("utf8");
      } catch {
        continue; // deleted by this diff, or absent at that commit
      }
      context += `\n\n===== FILE (as merged, at ${mergeSha.slice(0, 8)}): ${p} =====\n${body}`;
      carried.push(p);
    }

    const system = `You are the Drape Gatekeeper reviewing this pull request.\n${
      deep ? TIER_DEEP : TIER_CHARTER
    }\n\n${deep ? "=== CLAUDE.md ===\n" + claudeMd : "=== docs/REVIEWER_CHARTER.md ===\n" + charter}`;

    const user = `${TASK}

=== PULL REQUEST #${pr.number} ===
${pr.title}

=== DIFF (base...head) ===
${diff}

=== FULL POST-MERGE TEXT OF THE FILES THIS DIFF TOUCHES ===
(You cannot run commands or open files the diff does not touch. Everything you
are able to read is below.)
${context}`;

    const promptChars = system.length + user.length;
    console.log(
      `#${pr.number} · tier ${deep ? "DEEP (CLAUDE.md)" : "charter"} · ${paths.length} files, ${carried.length} carried · prompt ~${Math.round(promptChars / 4000)}k tok`,
    );

    if (DRY) {
      roll.push({ pr: pr.number, deep, files: paths.length, carried: carried.length, promptChars });
      continue;
    }

    let result;
    try {
      result = await callAstra(system, user);
    } catch (err) {
      console.log(`  FAILED: ${(err as Error).message}`);
      roll.push({ pr: pr.number, deep, error: (err as Error).message });
      continue;
    }
    const u = result.usage ?? {};
    // ⚠ THE PROVIDER'S OWN FIGURE, NEVER MY ARITHMETIC — working law 1, and it
    // was measured the moment this ran. `prompt × $10/M + completion × $50/M`
    // said $3.4960 across the first five reviews; OpenRouter's own `cost`
    // field said **$4.2031**, 20% higher, because every one of them paid a
    // CACHE-WRITE surcharge (#877: 129,163 cache-write tokens) that the
    // headline price table does not mention. Nothing here is ever cache-READ —
    // each prompt is a different diff — so that surcharge is pure loss and it
    // is part of what this court is measuring. The hand-rolled figure is kept
    // beside it so the gap stays visible rather than being quietly corrected.
    const costListed =
      (u.prompt_tokens ?? 0) * PRICE_PROMPT + (u.completion_tokens ?? 0) * PRICE_COMPLETION;
    const cost = typeof u.cost === "number" ? u.cost : costListed;
    spend += cost;
    console.log(
      `  → ${u.prompt_tokens ?? "?"} in / ${u.completion_tokens ?? "?"} out · $${cost.toFixed(4)} · ${(result.latencyMs / 1000).toFixed(1)}s · ${result.content.length}B`,
    );

    const record = {
      pr: pr.number,
      title: pr.title,
      mergedAt: pr.mergedAt,
      mergeSha,
      tier: deep ? "deep" : "charter",
      files: paths,
      carriedFiles: carried,
      promptChars,
      model: MODEL,
      usage: u,
      costUsd: cost,
      costByListedPrice: costListed,
      latencyMs: result.latencyMs,
      finishReason: result.finishReason,
      astra: result.content,
      fable: pr.verdict,
    };
    writeFileSync(join(OUT_DIR, `pr-${pr.number}.json`), JSON.stringify(record, null, 1));
    roll.push({
      pr: pr.number,
      tier: record.tier,
      costUsd: cost,
      latencyMs: result.latencyMs,
      astraChars: result.content.length,
      fableChars: pr.verdict.length,
    });
  }

  writeFileSync(
    join(OUT_DIR, "roll-up.json"),
    JSON.stringify({ model: MODEL, ranAt: new Date().toISOString(), totalUsd: spend, rows: roll }, null, 1),
  );
  console.log(`\nTOTAL SPEND: $${spend.toFixed(4)} across ${roll.length} review(s).`);
}

await main();
process.exit(0);
