/**
 * DISPOSABLE — fable-1669's order: the exact bytes roll #216 sent for one
 * DELIVERED slice, as a file the founder can open. Read-only, no spend.
 *
 * ⚠ **THESE ARE THE SENT BYTES, NOT A RECOMPOSITION**, and it is checkable in
 * one function: `rollService.ts` builds `compiled.candidates[].prompt` once,
 * writes it to `internalPrompt.prompt` at the row (line 581) and dispatches the
 * SAME value through `promptByPosition` (line 681). One object, two readers.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";

const production = process.argv.includes("--production");
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) throw new Error(production ? "no MYSQL_PUBLIC_URL" : "no DATABASE_URL");
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port}`);

const conn = await openDatabase(url);
const [rolls] = await conn.query<any[]>("SELECT id, briefText FROM casting_rolls WHERE id = 216");
if (rolls.length === 0) throw new Error("roll 216 not in this world");
const brief = String(rolls[0].briefText);

const [cands] = await conn.query<any[]>(
  "SELECT position, status, personaLine, internalPrompt FROM casting_candidates WHERE rollId = 216 ORDER BY position",
);
const delivered = cands.filter((c) => c.status !== "failed");
if (delivered.length === 0) throw new Error("no delivered slice on roll 216 — nothing to quote");

const chosen = delivered[0]!;
const node = typeof chosen.internalPrompt === "string" ? JSON.parse(chosen.internalPrompt) : chosen.internalPrompt;
const prompt = String(node?.prompt ?? "");
if (prompt.length === 0) throw new Error(`slice ${chosen.position} stored no prompt — refusing to write an empty file`);

mkdirSync("output/raw-prompt-reference", { recursive: true });
writeFileSync("output/raw-prompt-reference/roll216-slice-prompt-today.txt", prompt, "utf8");
writeFileSync("output/raw-prompt-reference/roll216-brief-verbatim.txt", brief, "utf8");

console.log(`\nroll 216 · slice position ${chosen.position} (${chosen.status})`);
console.log(`  persona line: ${chosen.personaLine ?? "(none)"}`);
console.log(`  prompt ${prompt.length} chars · brief ${brief.length} chars · his share ${((brief.length / prompt.length) * 100).toFixed(1)}%`);
console.log(`  delivered slices on this roll: ${delivered.map((c) => c.position).join(", ")}`);
console.log("\nwrote output/raw-prompt-reference/roll216-slice-prompt-today.txt");
console.log("wrote output/raw-prompt-reference/roll216-brief-verbatim.txt");

await conn.end();
process.exit(0);
