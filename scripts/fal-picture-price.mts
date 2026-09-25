/**
 * WHAT A PICTURE COSTS THE HOUSE — read out of the rite's own balance series
 * against production's own render rows (#1134, 2026-09-25).
 *
 * # Why this exists rather than a constant
 *
 * THE DISAPPEARING-TECHNOLOGY LAW's engine half says the best model for each
 * job has an EXPIRY, and its clause 3 says the price and the latency are named
 * beside the quality finding or the finding is not decision-grade. So every
 * time this product changes the engine it renders on, somebody has to ask what
 * the new one costs — and before this script the only road to that answer was
 * a hand-measured constant somebody took once in July.
 *
 * # Why it is a measurement and not a lookup
 *
 * fal publishes `unit: "units"` for every GPT Image endpoint — gpt-image-2,
 * 2.5/flare, 2.5/sunburst and both edit twins, probed together on 2026-09-25 —
 * and `falSpend.mts` is emphatic that an opaque unit is not dollars. The
 * balance door wants an admin key. So the published road cannot answer it.
 *
 * What CAN is an artifact nobody had read as a series: **every deploy rite
 * writes `fal $X USD remaining` into its receipt**, and over a thousand
 * receipts sit under `output/deploy-receipts/`. Between two consecutive
 * receipts the drop is a real dollar figure, and production records everything
 * that could have caused it.
 *
 * Three readings come out, and they are deliberately different in kind:
 *
 *   CLEAN WINDOWS   one class of traffic and nothing else, so the drop DIVIDES.
 *                   Exact, and rare — usually two or three in a month.
 *   UPPER BOUNDS    one render family plus face scans, with scans charged at
 *                   fal's own published SAM-3 price times the COUNTED 20 reads
 *                   a scan makes. Inexact, and over hundreds of renders.
 *   THE FIT         least squares over every window with a drop. Weakest of
 *                   the three, and it says so: the refine road writes its own
 *                   census onto a variant row that PURGES (#1133), so a real
 *                   spender is invisible to every window and the fit absorbs it
 *                   into whatever correlates.
 *
 * **They must bracket each other. Where they do not, the one with the renders
 * behind it wins and the disagreement is reported, never averaged.**
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/fal-picture-price.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/fal-picture-price.mts 2026-09-01T00:00:00Z
 *
 * Settlement lag is real and measured (fable-859: a render's charge arrived
 * four minutes after the call), so a window is only as good as the quiet
 * either side of it — every clean window prints how long it was quiet before
 * the reading that closed it.
 *
 * ⚠ A top-up VOIDS a subtraction (`falSpend.mts` again: a bench once printed
 * $-19.79 across one). A window whose balance ROSE is not a spend window and is
 * skipped; nothing here averages across one.
 *
 * Read-only: local files plus four SELECTs. No render, no credit, no spend.
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mjs";

const SINCE = process.argv[2] ?? "2026-08-01T00:00:00Z";
const DIR = "output/deploy-receipts";

/* ---- the balance series ------------------------------------------------ */
type Reading = { at: string; usd: number };
const readings: Reading[] = [];
for (const file of readdirSync(DIR)) {
  if (!file.endsWith(".txt")) continue;
  const s = file.slice(0, 24);
  const at = `${s.slice(0, 10)}T${s.slice(11, 13)}:${s.slice(14, 16)}:${s.slice(17, 19)}Z`;
  if (at < SINCE) continue;
  const match = /^fal \$([0-9.]+) USD remaining/m.exec(readFileSync(join(DIR, file), "utf8"));
  if (match) readings.push({ at, usd: Number(match[1]) });
}
readings.sort((a, b) => a.at.localeCompare(b.at));

/* ---- production's own rows --------------------------------------------- */
const databaseUrl = resolveDatabaseUrl();
console.log(`world: ${worldOf(databaseUrl)} · ${readings.length} balance readings since ${SINCE}\n`);
const db = await openDatabase(databaseUrl);
const q = async (sql: string, params: unknown[]) => {
  const [rows] = await db.query(sql, params);
  return rows as Array<Record<string, unknown>>;
};
const candidates = await q(
  `SELECT createdAt, status, failureClass, providerModel FROM casting_candidates
    WHERE createdAt >= ? ORDER BY createdAt`, [SINCE]);
const variants = await q(
  `SELECT createdAt FROM casting_candidate_variants WHERE createdAt >= ?`, [SINCE]);
const scans = await q(
  `SELECT createdAt FROM casting_face_scans WHERE createdAt >= ? ORDER BY createdAt`, [SINCE]);
const operations = await q(
  `SELECT createdAt, kind FROM generation_operations WHERE createdAt >= ? ORDER BY createdAt`, [SINCE]);

/* A providerModel is recorded two ways — `openai/...` on a delivered row and
   `fal:openai/...` on a refused one — so the family is read off the tail. */
const familyOf = (model: unknown): string => {
  const text = String(model ?? "").replace(/^fal:/, "");
  if (text.startsWith("openai/gpt-image-2.5/sunburst")) return "sunburst";
  if (text.startsWith("openai/gpt-image-2.5/flare")) return "flare";
  if (text.startsWith("openai/gpt-image-2")) return "gptimage2";
  if (text.includes("nano-banana")) return "nano";
  return text === "" ? "none" : "other";
};
const FAMILIES = ["gptimage2", "flare", "sunburst", "nano", "other"] as const;
type Family = (typeof FAMILIES)[number];

const iso = (value: unknown) => new Date(value as string).toISOString();
type Window = {
  from: string; to: string; minutes: number; spent: number;
  delivered: Record<Family, number>; refused: Record<Family, number>;
  scans: number; variants: number; operations: number;
  kinds: Map<string, number>;
  /** Minutes between the LAST render in the window and the closing reading —
   *  settlement arrives about four minutes late, so a small number here is the
   *  one thing that can make a clean window undercount. */
  tailMinutes: number | null;
};
const zero = () => Object.fromEntries(FAMILIES.map((f) => [f, 0])) as Record<Family, number>;

const windows: Window[] = [];
for (let i = 1; i < readings.length; i += 1) {
  const previous = readings[i - 1], current = readings[i];
  const window: Window = {
    from: previous.at, to: current.at,
    minutes: (Date.parse(current.at) - Date.parse(previous.at)) / 60000,
    spent: previous.usd - current.usd, delivered: zero(), refused: zero(),
    scans: 0, variants: 0, operations: 0, kinds: new Map(), tailMinutes: null,
  };
  let lastEvent: number | null = null;
  for (const row of candidates) {
    const at = iso(row.createdAt);
    if (at <= previous.at || at > current.at) continue;
    const family = familyOf(row.providerModel) as Family;
    if (!FAMILIES.includes(family)) continue;
    if (row.status === "failed") window.refused[family] += 1;
    else window.delivered[family] += 1;
    lastEvent = Math.max(lastEvent ?? 0, Date.parse(at));
  }
  for (const row of scans) {
    const at = iso(row.createdAt);
    if (at > previous.at && at <= current.at) { window.scans += 1; lastEvent = Math.max(lastEvent ?? 0, Date.parse(at)); }
  }
  for (const row of variants) { const at = iso(row.createdAt); if (at > previous.at && at <= current.at) window.variants += 1; }
  for (const row of operations) {
    const at = iso(row.createdAt);
    if (at > previous.at && at <= current.at) {
      window.operations += 1;
      const kind = String(row.kind);
      window.kinds.set(kind, (window.kinds.get(kind) ?? 0) + 1);
    }
  }
  window.tailMinutes = lastEvent === null ? null : (Date.parse(current.at) - lastEvent) / 60000;
  windows.push(window);
}

const totalRenders = (w: Window) =>
  FAMILIES.reduce((sum, f) => sum + w.delivered[f] + w.refused[f], 0);

/* A roll and a retry render candidates this reader already counts. Anything
   else on this list spends at fal through a road whose own record purges. */
const ALLOWED_KINDS = new Set(["castingV2.roll", "castingV2.retry"]);
const unpriceableKinds = (w: Window) => [...w.kinds.keys()];

/* ---- 1 · the windows that price ONE thing ------------------------------ */
console.log("CLEAN WINDOWS — exactly one kind of traffic, so the drop divides\n");
let cleanCount = 0;
for (const w of windows) {
  if (w.spent <= 0.004) continue;
  const renders = totalRenders(w);
  const kinds = [renders > 0 ? "renders" : null, w.scans > 0 ? "scans" : null, w.variants > 0 ? "variants" : null].filter(Boolean);
  if (kinds.length !== 1) continue;
  /* An operation kind this reader cannot price is an invisible spender — the
     refine road writes its census onto a variant row, which purges (#1133), so
     a refine in the window makes the division a fiction. */
  if (!unpriceableKinds(w).every((k) => ALLOWED_KINDS.has(k))) continue;
  cleanCount += 1;
  if (kinds[0] === "scans") {
    console.log(`  ${w.from} +${w.minutes.toFixed(0)}m  $${w.spent.toFixed(2)} / ${w.scans} face scans `
      + `= $${(w.spent / w.scans).toFixed(4)} per scan   quiet ${(w.tailMinutes ?? 0).toFixed(0)}m before the reading`);
  } else if (kinds[0] === "renders") {
    const families = FAMILIES.filter((f) => w.delivered[f] + w.refused[f] > 0);
    const shape = families.map((f) => `${f} ${w.delivered[f]} ok / ${w.refused[f]} refused`).join(" + ");
    console.log(`  ${w.from} +${w.minutes.toFixed(0)}m  $${w.spent.toFixed(2)} / ${renders} renders `
      + `= $${(w.spent / renders).toFixed(4)} each   [${shape}]`
      + `   quiet ${(w.tailMinutes ?? 0).toFixed(0)}m before the reading`
      + (families.length === 1 ? "" : "   MIXED FAMILIES"));
  } else {
    console.log(`  ${w.from} +${w.minutes.toFixed(0)}m  $${w.spent.toFixed(2)} / ${w.variants} refine variants `
      + `= $${(w.spent / w.variants).toFixed(4)} each`);
  }
}
if (cleanCount === 0) console.log("  none");

/* ---- 1b · an UPPER BOUND per family, which needs no fit ---------------- */
/*
   A window carrying renders of one family plus face scans bounds that family's
   price from above, using nothing of our own: fal publishes $0.005 per SAM-3
   request, and `FACE_SCAN_READS_PER_VERSION` is 20, COUNTED by driving the real
   scanner (`falSpend.mts`). So a scan costs AT LEAST $0.10, and whatever the
   window spent beyond that was the renders or less.

   This is the half of the reading that has an n. The clean windows above are
   exact and rare; these are inexact and many, and they must agree.
*/
const SCAN_FLOOR_USD = 0.10;
console.log("");
console.log("UPPER BOUNDS — one render family plus face scans, scans charged at their published floor");
console.log("");
for (const family of ["gptimage2", "sunburst"] as const) {
  const rows: Array<{ w: Window; bound: number; renders: number }> = [];
  for (const w of windows) {
    if (w.spent <= 0.004 || w.variants > 0) continue;
    if (!unpriceableKinds(w).every((k) => ALLOWED_KINDS.has(k))) continue;
    const mine = w.delivered[family] + w.refused[family];
    const others = totalRenders(w) - mine;
    if (mine === 0 || others > 0) continue;
    rows.push({ w, bound: (w.spent - SCAN_FLOOR_USD * w.scans) / mine, renders: mine });
  }
  rows.sort((a, b) => a.bound - b.bound);
  const negative = rows.filter((r) => r.bound < 0).length;
  const tightest = rows.find((r) => r.bound >= 0);
  const renders = rows.reduce((sum, r) => sum + r.renders, 0);
  console.log(`  ${family}: ${rows.length} windows, ${renders} renders`);
  if (tightest) {
    console.log(`    tightest non-negative bound  $${tightest.bound.toFixed(4)} per picture `
      + `(${tightest.w.from}, ${tightest.renders} renders, ${tightest.w.scans} scans, $${tightest.w.spent.toFixed(2)})`);
  }
  console.log(`    ${negative} of ${rows.length} windows go NEGATIVE against the scan floor`
    + (negative > 0 ? " — those windows cannot afford $0.10 a scan, so the floor is wrong for them or the spend settled late" : ""));
  for (const row of rows.slice(0, 5)) {
    console.log(`      ${row.w.from}  $${row.w.spent.toFixed(2)} · ${row.renders} renders · ${row.w.scans} scans `
      + `-> <= $${row.bound.toFixed(4)}`);
  }
}

/* ---- 2 · a least-squares fit over every window with a drop ------------- */
const basis = ["gptimage2", "sunburst", "scan"] as const;
const usable = windows.filter((w) =>
  w.spent > 0.004 && w.variants === 0
  && w.delivered.flare + w.refused.flare === 0
  && w.delivered.nano + w.refused.nano === 0
  && w.delivered.other + w.refused.other === 0
  && unpriceableKinds(w).every((k) => ALLOWED_KINDS.has(k)));
const rowOf = (w: Window) => [
  w.delivered.gptimage2 + w.refused.gptimage2,
  w.delivered.sunburst + w.refused.sunburst,
  w.scans,
];
const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
const b = [0, 0, 0];
for (const w of usable) {
  const x = rowOf(w);
  for (let i = 0; i < 3; i += 1) {
    b[i] += x[i] * w.spent;
    for (let j = 0; j < 3; j += 1) A[i][j] += x[i] * x[j];
  }
}
const solve = (M: number[][], v: number[]): number[] | null => {
  const m = M.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < 3; r += 1) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-9) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < 3; r += 1) {
      if (r === col) continue;
      const factor = m[r][col] / m[col][col];
      for (let c = col; c < 4; c += 1) m[r][c] -= factor * m[col][c];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
};
const fit = solve(A, b);
console.log(`\nLEAST-SQUARES FIT over ${usable.length} windows with a drop and no confound`);
if (!fit) console.log("  refused: the normal matrix is singular (a class never varies on its own)");
else basis.forEach((name, i) => console.log(`  ${name.padEnd(12)} $${fit[i].toFixed(4)} per unit`));
if (fit) {
  let sse = 0, sst = 0;
  const mean = usable.reduce((s, w) => s + w.spent, 0) / usable.length;
  for (const w of usable) {
    const predicted = rowOf(w).reduce((s, x, i) => s + x * fit[i], 0);
    sse += (w.spent - predicted) ** 2;
    sst += (w.spent - mean) ** 2;
  }
  console.log(`  residual: R2 ${(1 - sse / sst).toFixed(3)} · rms $${Math.sqrt(sse / usable.length).toFixed(3)} per window`);
}

/* ---- 3 · the whole-period totals, as a sanity floor -------------------- */
const drops = windows.filter((w) => w.spent > 0).reduce((s, w) => s + w.spent, 0);
console.log(`\nPERIOD: $${drops.toFixed(2)} of measured drops across ${windows.length} windows`);
for (const family of FAMILIES) {
  const d = windows.reduce((s, w) => s + w.delivered[family], 0);
  const r = windows.reduce((s, w) => s + w.refused[family], 0);
  if (d + r > 0) console.log(`  ${family.padEnd(12)} ${d} delivered · ${r} refused`);
}
console.log(`  face scans ${windows.reduce((s, w) => s + w.scans, 0)} · refine variants ${windows.reduce((s, w) => s + w.variants, 0)}`);
const allKinds = new Map<string, number>();
for (const w of windows) for (const [kind, n] of w.kinds) allKinds.set(kind, (allKinds.get(kind) ?? 0) + n);
console.log("  operations by kind: " + [...allKinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · "));

process.exit(0);
