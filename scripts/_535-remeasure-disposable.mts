/**
 * DISPOSABLE — #535's design-report re-measure (#252(c)'s ask, carried onto
 * the design card): the CURRENT author's refusal, re-ask and sat-out rates on
 * HIS FIVE BRIEFS, so the Re-imagine design report knows how often a press of
 * the new control would come back "nothing to offer this time" instead of a
 * rewrite, and how long a press waits.
 *
 * # The five fixtures, and why exactly these
 *
 * The #466 author bench's own set — his 553-char cyborg brief (byte-pinned,
 * #327's fixture) and the shipped reader's four same-sitting descriptions
 * (feline deity, MAN 1, MAN 2, goth), byte-for-byte from
 * `output/_231-grok-long/run1/court.json`. #477's court (2026-09-05) already
 * measured two of the five on this author (1/14 re-asked, 0 static); this
 * widens to the full set the card names.
 *
 * # What it records
 *
 * Per read: mode (authored/static), attempts, every refusal sentence VERBATIM
 * (#529's `refusals[]`), addedWords, latencyMs. Drafts kept whole on disk.
 * It judges nothing — the design report reads the record.
 *
 * # What it spends, stated before it fires (THE SPEND THRESHOLD)
 *
 * 5 briefs × 6 reads = 30 authored reads, ≤2 text calls each → ≤60 Sonnet
 * calls ≈ $0.45 (estimate posted on #535 before the run). Text only — no
 * render, no row, no credit. Balance read before/after as an INDICATION.
 *
 *   npx tsx scripts/_535-remeasure-disposable.mts --spend --out <absDir>
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

import { authorPrompt, authorTextEngine } from "../server/castingV2/promptAuthor";
import type { StatedAge } from "../server/castingV2/seedFidelity";
import { spendAuthorized } from "./lib/stopline.mts";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("this drive touches no database — refusing a production wrapper");

/* #345's discipline: a paid driver parses strictly — an unknown flag refuses. */
const KNOWN = new Set(["--spend", "--out", "--reads"]);
const argvFlags = process.argv.slice(2).filter((a) => a.startsWith("--"));
for (const a of argvFlags) {
  const bare = a.includes("=") ? a.slice(0, a.indexOf("=")) : a;
  if (!KNOWN.has(bare)) throw new Error(`unknown flag ${a} — known: ${[...KNOWN].join(", ")}`);
}
const flagValue = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
};
if (!spendAuthorized("535-remeasure")) {
  console.log("Dry run — pass --spend to fire ≤60 author text calls (estimate on #535). Nothing was spent.");
  process.exit(0);
}
const OUT = flagValue("out");
if (!OUT) throw new Error("pass --out <absolute output dir>");
const READS = Number(flagValue("reads") ?? 6);
if (!Number.isFinite(READS) || READS < 1 || READS > 10) throw new Error("--reads must be 1..10");
mkdirSync(OUT, { recursive: true });

/** His brief, verbatim — byte-identical to #327's, #466's and #477's. The pin refuses a drifted court. */
const CYBORG =
  "Bald male, mid-40s, pale porcelain skin, heavily weathered. Severe bone structure: "
  + "pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks. Intense unsmiling expression. "
  + "Cybernetic augmentation as part of his body: matte-black implant ports embedded in his skull "
  + "above the right temple, fine metal seams running across his scalp like plate joins, a dark "
  + "mechanical plate along his jawline, a small black implant stud below each ear, and his right "
  + "eye glowing faint amber-red. The augmentations are surgically integrated into his skin, not worn.";
if (CYBORG.length !== 553) throw new Error(`REFUSING: the cyborg fixture drifted — ${CYBORG.length} chars, expected 553`);

const court = JSON.parse(readFileSync("output/_231-grok-long/run1/court.json", "utf8")) as {
  rows: Array<{ fixture: string; arm: string; read: number; ok: boolean; description?: string }>;
};
const readerBrief = (prefix: string): string => {
  const row = court.rows
    .filter((r) => r.arm === "sonnet" && r.ok && r.fixture.startsWith(prefix))
    .sort((a, b) => a.read - b.read)[0];
  if (!row?.description) throw new Error(`no OK sonnet read for "${prefix}" in the court record`);
  return row.description;
};

type Fixture = { name: string; briefText: string; statedAge: StatedAge | null; statedSex: "male" | "female" | null };
/* Reader hints mirror the #466 bench's values, read off each brief's own words. */
const FIXTURES: Fixture[] = [
  { name: "CYBORG", briefText: CYBORG, statedAge: { band: "40s", phase: "mid" }, statedSex: "male" },
  { name: "FELINE", briefText: readerBrief("FELINE DEITY"), statedAge: null, statedSex: null },
  { name: "MAN1", briefText: readerBrief("MAN 1"), statedAge: { band: "40s", phase: "late" }, statedSex: "male" },
  { name: "MAN2", briefText: readerBrief("MAN 2"), statedAge: { band: "40s", phase: "late" }, statedSex: "male" },
  { name: "GOTH", briefText: readerBrief("GOTH"), statedAge: { band: "20s", phase: null }, statedSex: "female" },
];

const engine = authorTextEngine();
if (!engine) throw new Error("OPENROUTER_API_KEY missing — nothing was spent");

const balanceBefore = await readOpenRouterBalance().catch(() => null);
console.log(`balance before (indication): ${balanceBefore ?? "unreadable"}`);

type Row = {
  fixture: string; read: number; mode: string; attempts: number; refusals: string[];
  addedWords: number; latencyMs: number | null; contentChars: number;
};
const rows: Row[] = [];
for (const fixture of FIXTURES) {
  console.log(`\n== ${fixture.name} (${fixture.briefText.length} ch) ==`);
  for (let read = 1; read <= READS; read += 1) {
    const authored = await authorPrompt({
      engine,
      briefText: fixture.briefText,
      imagination: "max",
      statedAge: fixture.statedAge,
      statedSex: fixture.statedSex,
    });
    rows.push({
      fixture: fixture.name, read, mode: authored.mode, attempts: authored.attempts,
      refusals: authored.refusals, addedWords: authored.addedWords, latencyMs: authored.latencyMs,
      contentChars: authored.content?.length ?? 0,
    });
    writeFileSync(`${OUT}/${fixture.name}-r${read}.json`, JSON.stringify({ ...authored }, null, 2));
    console.log(`  r${read}: ${authored.mode} · attempts ${authored.attempts} · ${authored.latencyMs ?? "-"} ms${authored.refusals.length ? ` · refused: ${authored.refusals[0]!.slice(0, 90)}` : ""}`);
  }
}

const balanceAfter = await readOpenRouterBalance().catch(() => null);
const total = rows.length;
const reasked = rows.filter((r) => r.attempts === 2).length;
const statics = rows.filter((r) => r.mode === "static").length;
const lat = rows.map((r) => r.latencyMs ?? 0).sort((a, b) => a - b);
const p = (q: number) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
const summary = {
  ranAt: new Date().toISOString(), reads: total, reasked, statics,
  latencyMs: { p50: p(0.5), p90: p(0.9), max: lat[lat.length - 1] },
  balance: { before: balanceBefore, after: balanceAfter },
  rows,
};
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(`\nTOTAL ${total} reads · re-asked ${reasked} · static (customer keeps own words) ${statics}`);
console.log(`latency ms p50 ${summary.latencyMs.p50} · p90 ${summary.latencyMs.p90} · max ${summary.latencyMs.max}`);
console.log(`balance after (indication): ${balanceAfter ?? "unreadable"}`);
console.log(`record: ${OUT}/summary.json`);
process.exit(0);
