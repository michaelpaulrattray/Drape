/**
 * DISPOSABLE — the three reads fable-1660 ordered, at the compiled prompts of
 * his own sheet. Free: one database read, no engine, no spend.
 *
 *  1  BODYBUILDERS. What does the physique / house register say per slice, and
 *     is a fitness-model bias riding in the sentences ALL EIGHT share?
 *  2  SAME FACIAL HAIR. Facial hair is supposed to be one of the varying axes.
 *     Did it vary in the PROMPT (paint ignored an emitted axis) or not vary at
 *     all (the axis never moved)?
 *  3  HIS WORDS vs OURS. How many characters of the compiled prompt are his,
 *     and how many are ours — the dilution ratio, measured rather than guessed.
 */
import { openDatabase } from "./lib/dbConnection.mts";

const production = process.argv.includes("--production");
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) throw new Error(production ? "no MYSQL_PUBLIC_URL" : "no DATABASE_URL");
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port}`);

const ROLL = Number(process.argv.find((a) => a.startsWith("--roll="))?.slice(7) ?? 216);
const conn = await openDatabase(url);

const [rolls] = await conn.query<any[]>(
  "SELECT id, briefText, compiledBrief FROM casting_rolls WHERE id = ?", [ROLL],
);
if (rolls.length === 0) throw new Error(`roll ${ROLL} not found in this world`);
const roll = rolls[0]!;
const blob = typeof roll.compiledBrief === "string" ? JSON.parse(roll.compiledBrief) : roll.compiledBrief;

const [cands] = await conn.query<any[]>(
  "SELECT position, status, internalPrompt FROM casting_candidates WHERE rollId = ? ORDER BY position", [ROLL],
);

const promptOf = (raw: unknown): string => {
  const blobbed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (blobbed === null || typeof blobbed !== "object") return "";
  const node = blobbed as Record<string, any>;
  return typeof node.prompt === "string" ? node.prompt
    : typeof node.masterPrompt === "string" ? node.masterPrompt
      : JSON.stringify(node);
};

const prompts = cands.map((c) => ({ position: c.position, status: c.status, prompt: promptOf(c.internalPrompt) }))
  .filter((p) => p.prompt.length > 0);

console.log(`\nroll #${ROLL} · ${cands.length} candidates · ${prompts.length} with a compiled prompt`);
console.log(`  brief ${String(roll.briefText).length} chars · characterNotes ${String(blob?.intent?.characterNotes ?? "").length} chars · role ${JSON.stringify(blob?.intent?.role ?? null)}`);
console.log(`  prompt lengths: ${prompts.map((p) => p.prompt.length).join(", ")}`);

/* Sentences, the way opus-1262 counted them: split on ". " and trimmed. */
const sentencesOf = (text: string) => text.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
const sets = prompts.map((p) => new Set(sentencesOf(p.prompt)));
const all = new Set<string>(sets.flatMap((s) => [...s]));
const shared = [...all].filter((s) => sets.every((set) => set.has(s)));
const varying = [...all].filter((s) => !sets.every((set) => set.has(s)));
console.log(`  ${all.size} distinct sentences · ${shared.length} IN ALL ${prompts.length} · ${varying.length} vary`);

const show = (label: string, re: RegExp, pool: string[]) => {
  const hits = pool.filter((s) => re.test(s));
  console.log(`\n${label} — ${hits.length} hit(s)`);
  for (const h of hits) console.log(`  · ${h.length > 300 ? `${h.slice(0, 300)}…` : h}`);
};

console.log("\n════ READ 1 — PHYSIQUE / BUILD / REGISTER ════");
show("in the SHARED sentences", /\b(physique|build|muscul|athlet|lean|fit|body|frame)\b/i, shared);
show("in the VARYING sentences", /\b(physique|build|muscul|athlet|lean|fit|body|frame)\b/i, varying);

console.log("\n════ READ 2 — FACIAL HAIR ════");
show("in the SHARED sentences", /\b(beard|stubble|moustache|mustache|clean.shaven|facial hair|goatee)\b/i, shared);
show("in the VARYING sentences", /\b(beard|stubble|moustache|mustache|clean.shaven|facial hair|goatee)\b/i, varying);

console.log("\n════ READ 3 — HIS WORDS INSIDE OURS ════");
const notes = String(blob?.intent?.characterNotes ?? "");
const skin = blob?.intent?.statedSkin ? `${blob.intent.statedSkin.tone ?? ""} ${blob.intent.statedSkin.character ?? ""}`.trim() : "";
const one = prompts[0]!.prompt;
const hisChars = notes.length + skin.length;
console.log(`  compiled prompt      ${one.length} chars`);
console.log(`  his characterNotes   ${notes.length} chars`);
console.log(`  his stated skin      ${skin.length} chars ("${skin}")`);
console.log(`  HIS SHARE            ${((hisChars / one.length) * 100).toFixed(1)}%  (${hisChars} of ${one.length})`);
console.log(`\n  his notes verbatim:\n    ${notes}`);

console.log("\n════ THE SENTENCES THAT VARY, in full ════");
for (const [i, p] of prompts.entries()) {
  const mine = sentencesOf(p.prompt).filter((s) => !shared.includes(s));
  console.log(`\n  pos${p.position} (${p.status}) — ${mine.length} own sentence(s)`);
  for (const s of mine) console.log(`    · ${s.length > 260 ? `${s.slice(0, 260)}…` : s}`);
  if (i > 6) break;
}

await conn.end();
process.exit(0);
