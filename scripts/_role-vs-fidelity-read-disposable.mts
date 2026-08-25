/**
 * DISPOSABLE — **did the BRIEF-FIDELITY announcement take `role` with it?**
 *
 * The pattern that raised the question (opus-1262 §2, extended by opus-1275):
 * on the SAME 553-character cyborg brief, rolls 206/208/212/213 filed a role
 * and short notes; rolls 214/215/216 filed NULL and ~450-character notes. If
 * that split is the fidelity flag rather than a coincidence, the enrichment
 * design is being written on top of a live regression.
 *
 * Reads at the rows and infers nothing: `role`, `interpreted`, the notes
 * length, and whatever the compiled blob records about fidelity, per roll.
 * Read-only. No writes, no engines, no spend.
 */
import { openDatabase } from "./lib/dbConnection.mts";

const production = process.argv.includes("--production");
if (!production) await import("dotenv/config");
const url = production ? process.env.MYSQL_PUBLIC_URL : process.env.DATABASE_URL;
if (!url) throw new Error(production ? "no MYSQL_PUBLIC_URL - run under railway.cmd run --service MySQL" : "no DATABASE_URL");
const parsed = new URL(url);
console.log(`world: ${production ? "PRODUCTION" : "DEV"} · ${parsed.hostname}:${parsed.port}`);

const conn = await openDatabase(url);

const [rolls] = await conn.query<any[]>(
  `SELECT id, publicId, createdAt, path, LENGTH(briefText) AS briefChars,
          LEFT(briefText, 44) AS brief, compiledBrief
     FROM casting_rolls
    WHERE userId = 1
    ORDER BY id DESC
    LIMIT 20`,
);

const blobOf = (raw: unknown): Record<string, any> => {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw as Record<string, any>;
};

/* Every key anywhere in the blob whose name mentions fidelity — named, not guessed at. */
const fidelityKeys = (node: any, path = ""): string[] => {
  if (node === null || typeof node !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(node)) {
    const here = path ? `${path}.${k}` : k;
    if (/fidelity/i.test(k)) out.push(`${here}=${JSON.stringify(v)}`);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) out.push(...fidelityKeys(v, here));
  }
  return out;
};

console.log(`\n${"roll".padEnd(6)}${"created".padEnd(26)}${"role".padEnd(34)}${"notes".padEnd(7)}${"interp".padEnd(8)}fidelity keys / statedSkin`);
for (const r of rolls) {
  const blob = blobOf(r.compiledBrief);
  const intent = blob.intent ?? {};
  const role = intent.role ?? null;
  const notes = typeof intent.characterNotes === "string" ? intent.characterNotes.length : null;
  const keys = fidelityKeys(blob);
  const skin = intent.statedSkin ? JSON.stringify(intent.statedSkin) : "-";
  console.log(
    `#${String(r.id).padEnd(5)}`
    + `${(r.createdAt?.toISOString?.() ?? String(r.createdAt)).padEnd(26)}`
    + `${String(role ?? "NULL").slice(0, 32).padEnd(34)}`
    + `${String(notes ?? "-").padEnd(7)}`
    + `${String(blob.interpreted ?? "-").padEnd(8)}`
    + `${keys.length > 0 ? keys.join(" ") : "(none)"} · skin ${skin}`,
  );
}

console.log("\n⚠ `fidelity keys` is every key in the blob whose NAME mentions fidelity. If it prints");
console.log("  (none) on every row, the blob does not record the flag and the split below is a");
console.log("  CORRELATION with notes length, not a reading of the flag.");

await conn.end();
process.exit(0);
