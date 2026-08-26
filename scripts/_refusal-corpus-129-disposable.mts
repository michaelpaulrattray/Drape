/**
 * DISPOSABLE — #129 THE REFUSAL LOOP, STEP (2): the refused-vs-passed corpus,
 * read off the rows the product already keeps.
 *
 * Step (1) of the founder's order ("log every refused and passed prompt") is
 * already true of the product: `rollService.ts` writes
 * `internalPrompt.prompt` on every roll candidate beside `failureClass`. This
 * script is the READ — SELECT only, no writes, no engine, no credits.
 *
 * Output: `output/_shift129/corpus.json` (every candidate: prompt, outcome,
 * roll era) and a stdout summary that quotes NO customer words — his briefs
 * are his; the diff is done on the file.
 *
 * Wrap for production: `railway.cmd run --service MySQL -- npx tsx scripts/_refusal-corpus-129-disposable.mts`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { openDatabase, resolveDatabaseUrl } from "./lib/dbConnection.mts";

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  console.error("REFUSING: no database URL.");
  process.exit(1);
}
const db = await openDatabase(url);

type Row = {
  id: number;
  rollId: number;
  position: number;
  status: string;
  failureClass: string | null;
  attemptCount: number;
  provider: string | null;
  providerModel: string | null;
  createdAt: Date;
  internalPrompt: unknown;
  rollUserId: number;
  briefLen: number | null;
  compiledBrief: unknown;
};

const [rows] = await db.query<Row[]>(
  `SELECT c.id, c.rollId, c.position, c.status, c.failureClass, c.attemptCount,
          c.provider, c.providerModel, c.createdAt, c.internalPrompt,
          r.userId AS rollUserId, CHAR_LENGTH(r.briefText) AS briefLen, r.compiledBrief
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    ORDER BY c.id`,
);
await db.end();

function promptOf(ip: unknown): string | null {
  if (!ip || typeof ip !== "object") return null;
  const p = (ip as { prompt?: unknown }).prompt;
  return typeof p === "string" ? p : null;
}
function registerOf(cb: unknown): { kind: string | null; imagination: string | null; mode: string | null } {
  const reg = cb && typeof cb === "object" ? (cb as { register?: Record<string, unknown> }).register : null;
  return {
    kind: typeof reg?.kind === "string" ? reg.kind : null,
    imagination: typeof reg?.imagination === "string" ? reg.imagination : null,
    mode: typeof reg?.mode === "string" ? reg.mode : null,
  };
}

const corpus = rows.map((r) => {
  const prompt = promptOf(r.internalPrompt);
  const cb = typeof r.compiledBrief === "string" ? JSON.parse(r.compiledBrief) : r.compiledBrief;
  return {
    id: r.id,
    rollId: r.rollId,
    userId: r.rollUserId,
    position: r.position,
    status: r.status,
    failureClass: r.failureClass,
    attemptCount: r.attemptCount,
    provider: r.provider,
    providerModel: r.providerModel,
    createdAt: r.createdAt,
    briefLen: r.briefLen,
    register: registerOf(cb),
    promptHash: prompt ? createHash("sha256").update(prompt).digest("hex").slice(0, 12) : null,
    promptLen: prompt ? prompt.length : null,
    prompt,
  };
});

mkdirSync("output/_shift129", { recursive: true });
writeFileSync("output/_shift129/corpus.json", JSON.stringify(corpus, null, 2), "utf8");

// ---- summary (no customer words) ----
const byClass = new Map<string, number>();
for (const c of corpus) {
  const k = c.status === "failed" ? `failed:${c.failureClass ?? "null"}` : c.status;
  byClass.set(k, (byClass.get(k) ?? 0) + 1);
}
console.log(`candidates ${corpus.length}; with prompt ${corpus.filter((c) => c.prompt).length}`);
console.log("by status/class:", Object.fromEntries([...byClass].sort()));

const refused = corpus.filter((c) => c.failureClass === "content_policy");
console.log(`\ncontent_policy refusals: ${refused.length}`);
const byRoll = new Map<number, { total: number; refused: number; kind: string | null; imag: string | null; distinctPrompts: Set<string>; first: Date }>();
for (const c of corpus) {
  const e = byRoll.get(c.rollId) ?? { total: 0, refused: 0, kind: c.register.kind, imag: c.register.imagination, distinctPrompts: new Set<string>(), first: c.createdAt };
  e.total++;
  if (c.failureClass === "content_policy") e.refused++;
  if (c.promptHash) e.distinctPrompts.add(c.promptHash);
  byRoll.set(c.rollId, e);
}
console.log("\nrolls with a refusal (rollId total refused register imagination distinctPrompts createdAt):");
for (const [rollId, e] of [...byRoll].filter(([, e]) => e.refused > 0)) {
  console.log(`  ${rollId}\t${e.total}\t${e.refused}\t${e.kind ?? "-"}\t${e.imag ?? "-"}\t${e.distinctPrompts.size}\t${e.first.toISOString()}`);
}
const allRolls = [...byRoll.values()];
console.log(`\nrolls total ${allRolls.length}; author-road rolls ${allRolls.filter((e) => e.kind === "author").length}; rolls sharing ONE prompt across slices ${allRolls.filter((e) => e.distinctPrompts.size === 1 && e.total > 1).length}`);

// per distinct prompt: refused / total (the unit a trigger-word diff needs)
const byPrompt = new Map<string, { n: number; refused: number; len: number; rolls: Set<number> }>();
for (const c of corpus) {
  if (!c.promptHash) continue;
  const e = byPrompt.get(c.promptHash) ?? { n: 0, refused: 0, len: c.promptLen ?? 0, rolls: new Set<number>() };
  e.n++;
  if (c.failureClass === "content_policy") e.refused++;
  e.rolls.add(c.rollId);
  byPrompt.set(c.promptHash, e);
}
const withRef = [...byPrompt].filter(([, e]) => e.refused > 0);
console.log(`\ndistinct prompts ${byPrompt.size}; distinct prompts with a refusal ${withRef.length}; of those with n>=2 ${withRef.filter(([, e]) => e.n >= 2).length}`);
for (const [h, e] of withRef) console.log(`  ${h}\tn=${e.n}\trefused=${e.refused}\tlen=${e.len}\trolls=${[...e.rolls].join(",")}`);
/* The script guard: a disposable ends by ending the process (scriptExitDiscipline). */
process.exit(0);
