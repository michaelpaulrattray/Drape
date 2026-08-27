/**
 * DISPOSABLE — THE LIGHTING / REALISM COURT, issue #128 (foreman-28).
 *
 * Founder (Crew reply #8): "take a short realism clause from D's photographic
 * language and test B+R against B." Re-scoped by ruling §5c (the locked block
 * is code) and widened by his own words: "a few different options would be
 * good to look at" — THREE lighting variants of the block, his own candidate
 * as the lead, same brief, same everything else, his eye picks.
 *
 * ARMS (thin brief "goth woman mid 30s", LOW = seed + block, ONE prompt per arm, x8):
 *   K   the block as it stands today (§5e lighting; roll 223's bytes)  — control
 *   L1  LIGHTING → his reference look (deep open shadow under the jaw)
 *   L2  LIGHTING → his own candidate, verbatim
 *   L3  LIGHTING → clean, even studio light
 *   R   brief + a distilled 2–3 sentence photographic clause INSTEAD of the block
 *
 * READINGS: refusals (the engine is the judge); head share / headroom / hair gap
 * from `face` + `head` reads, calibrated on his reference frame (28.2%); his EYE
 * on the strip. Nothing here is a verdict on the look — the strip is.
 *
 * COST: 40 renders x $0.0557 + 80 reads x $0.005 ≈ $2.65 house. No rows, no credits.
 *
 *   npx tsx scripts/_court-lighting-128-disposable.mts --instrument   (2 reads, cents)
 *   npx tsx scripts/_court-lighting-128-disposable.mts --dry-run      (prompts only, $0)
 *   npx tsx scripts/_court-lighting-128-disposable.mts [--arms=K,L1,L2,L3,R] [--n=8]
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("this court touches no database — refusing a production wrapper");
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const { HOUSE_BLOCK, LIGHTING_LINE, DROPPED_FROM_BLOCK } = await import("../server/castingV2/houseBlock");
const { neverWrittenIn, staticPrompt } = await import("../server/castingV2/promptAuthor");

const argv = process.argv.slice(2);
const INSTRUMENT = argv.includes("--instrument");
const DRY = argv.includes("--dry-run");
const flag = (name: string): string | null => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const ONLY_ARMS = flag("arms")?.split(",") ?? ["K", "L1", "L2", "L3", "R"];
const N = Number(flag("n") ?? 8);
const CONCURRENCY = Number(flag("concurrency") ?? 6);
const OUT = "output/_shift128/court";
const REFERENCE_FRAME = "docs/specs/references/prompt-author/house-framing-reference-chest-up.png";
const RENDER_USD = 0.0557;
const REGION_USD = 0.005;

const BRIEF = "goth woman mid 30s";

/* ─── THE LIGHTING VARIANTS — the block's LIGHTING line swapped, nothing else moves ─── */

/** (1) ruling §5 line 145: "his reference look (soft frontal, specular on materials, deep open shadow under the jaw)". */
const L1_LINE =
  "LIGHTING: Soft frontal key with moderate fill, speculars where the person's skin and wardrobe naturally catch the source, and a deep but open shadow under the jaw that gives the face its shape. Grey seamless slightly brighter behind the head, gentle falloff to the edges. Minimal rim. No coloured gels.";

/** (2) his own candidate, verbatim (ruling §5 line 146; #128 comment 2026-08-26 10:36Z). The label is the block's convention. */
const L2_CANDIDATE = "soft frontal beauty lighting, high fill, open shadows, grey seamless with a gentle centre falloff, minimal rim, photoreal fashion studio.";
const L2_LINE = `LIGHTING: ${L2_CANDIDATE}`;

/** (3) "a cleaner, more even studio light". */
const L3_LINE =
  "LIGHTING: Clean, even studio light — a large soft frontal source with near-full fill, shadows lifted almost flat, only a faint shadow under the jaw. Grey seamless evenly lit behind the head, soft falloff to the edges. No rim. No coloured gels.";

/**
 * L2+ — his superseding block, VERBATIM (issue #128, 2026-08-27: "Use this as
 * one block. Don't append it as a second thought — replace L2 with this").
 * Byte-for-byte from the comment; no composing, no rewording. NOTE: the block
 * it swaps into is TODAY'S shipping block, which since PR #162 carries the F2
 * framing sentence (his pick, reply #13) — declared in the record and caption.
 */
const L2P_LINE =
  "LIGHTING: Large diffused soft frontal key just above the lens, high fill, face wrapped, open shadows. Soft chin and jaw shadow only — no hard neck cut. Grey seamless luminous but not white: slightly brighter behind the head, gentle falloff to the edges, no hard vignette. Minimal rim. No coloured gels. No on-camera flash. No hard shadow dumped on the paper behind the head. No oily flash specular stamped on the forehead, nose or cheeks. Speculars appear only where that person's skin and wardrobe naturally catch the soft source";

/**
 * R — the ORIGINAL B+R shape: PHOTOGRAPHIC language only, distilled from the
 * cohort's CAMERA / noise / REALISM sentences and his lighting; nothing about
 * the face's styling (realism words can fight styling words — #128 body).
 */
const DISTILLED_CLAUSE =
  "Photorealistic casting portrait, chest-up, centred, square to camera, on a neutral grey seamless studio background, soft frontal studio light with open shadows. "
  + "Medium-format look, 85mm equivalent, f/5.6–f/8, the subject sharp front to back, fine luminance grain like fine sand. "
  + "RAW skin with visible pores, vellus fuzz, uneven tone, real blemishes and natural asymmetry — no beauty retouching, no surface smoothing, no CGI sheen.";

function swapLighting(line: string): string {
  const count = HOUSE_BLOCK.split(LIGHTING_LINE).length - 1;
  if (count !== 1) throw new Error(`LIGHTING_LINE appears ${count} times in HOUSE_BLOCK — expected exactly once`);
  const block = HOUSE_BLOCK.replace(LIGHTING_LINE, line);
  if (block === HOUSE_BLOCK) throw new Error("the swap did not change the block");
  return block;
}

/** The same guards the product runs at module load, applied to every variant BEFORE a cent. */
function guard(name: string, text: string): void {
  const lower = text.toLowerCase();
  for (const { phrase, from } of DROPPED_FROM_BLOCK) {
    if (lower.includes(phrase.toLowerCase())) throw new Error(`${name}: "${phrase}" (dropped from ${from}) is in the text`);
  }
  const nw = neverWrittenIn(text);
  if (nw) throw new Error(`${name}: NEVER_WRITTEN word "${nw}" is in the text`);
}

type Arm = { id: string; label: string; prompt: string; lightingLine: string | null };
function buildArms(): Arm[] {
  const K = staticPrompt(BRIEF);
  if (!K.endsWith(HOUSE_BLOCK)) throw new Error("staticPrompt does not end with HOUSE_BLOCK — the road moved");
  if (!K.startsWith(BRIEF)) throw new Error("staticPrompt does not start with the brief");
  const withBlock = (block: string) => `${BRIEF}\n\n${block}`;
  const arms: Arm[] = [
    { id: "K", label: "K · today's block (§5e light)", prompt: K, lightingLine: LIGHTING_LINE },
    { id: "L1", label: "L1 · reference look, deep jaw shadow", prompt: withBlock(swapLighting(L1_LINE)), lightingLine: L1_LINE },
    { id: "L2", label: "L2 · his candidate verbatim", prompt: withBlock(swapLighting(L2_LINE)), lightingLine: L2_LINE },
    { id: "L3", label: "L3 · clean even light", prompt: withBlock(swapLighting(L3_LINE)), lightingLine: L3_LINE },
    { id: "L2P", label: "L2+ · his block verbatim", prompt: withBlock(swapLighting(L2P_LINE)), lightingLine: L2P_LINE },
    { id: "R", label: "R · distilled clause, no block", prompt: `${BRIEF}\n\n${DISTILLED_CLAUSE}`, lightingLine: null },
  ];
  for (const a of arms) guard(a.id, a.prompt);
  /* the three L arms differ from K in the lighting line ONLY */
  for (const a of arms.filter((x) => x.id.startsWith("L"))) {
    const back = a.prompt.replace(a.lightingLine!, LIGHTING_LINE);
    if (back !== K) throw new Error(`${a.id} differs from K in more than the lighting line`);
  }
  return arms.filter((a) => ONLY_ARMS.includes(a.id));
}

/* ─── THE FRAMING READER (the #125 court's, verbatim in shape) ─── */

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop");
const region = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
let regionReads = 0;
type Framing = { share: number; headroom: number; gap: number; headTop: number } | { noFace: true };
async function framing(png: Buffer): Promise<Framing> {
  const meta = await sharp(png).metadata();
  const H = meta.height!;
  regionReads += 2;
  const [face, head] = await Promise.all([
    region.region({ image: png, name: "face", absentIsAnswer: true }),
    region.region({ image: png, name: "head", absentIsAnswer: true }),
  ]);
  const f = extentOf(face).box; const h = extentOf(head).box;
  if (!f) return { noFace: true };
  return { share: f.height / H, headroom: f.top / f.height, gap: h ? (f.top - h.top) / f.height : Number.NaN, headTop: h ? h.top / H : Number.NaN };
}

mkdirSync(OUT, { recursive: true });
const lines: string[] = [];
const say = (s = "") => { console.log(s); lines.push(s); };

if (INSTRUMENT) {
  say("INSTRUMENT CHECK (law 2) — nothing rendered");
  const ref = await sharp(readFileSync(REFERENCE_FRAME)).png().toBuffer();
  const fr = await framing(ref);
  if ("noFace" in fr) throw new Error("no face on the reference frame");
  const posOk = Math.abs(fr.share - 0.282) < 0.02;
  say(`POSITIVE  reference frame: headShare ${(fr.share * 100).toFixed(1)}% (§3a 28.2%) headroom ${fr.headroom.toFixed(2)} gap ${fr.gap.toFixed(2)}  ${posOk ? "✓" : "✗"}`);
  const grey = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#8a8a8a" } }).png().toBuffer();
  const ng = await framing(grey);
  const negOk = "noFace" in ng;
  say(`NEGATIVE  blank grey frame: ${negOk ? "NO FACE ✓" : "face found ✗ " + JSON.stringify(ng)}`);
  const arms = buildArms();
  say(`GUARDS    ${arms.length} arms pass the dropped-phrase and NEVER_WRITTEN guards; L1/L2/L3 differ from K in the lighting line only ✓`);
  say(`region reads ${regionReads}`);
  say(posOk && negOk ? "INSTRUMENT PROVEN — the court may spend." : "INSTRUMENT FAILED — do not spend.");
  writeFileSync(`${OUT}/instrument.log`, lines.join("\n"), "utf8");
  process.exit(posOk && negOk ? 0 : 1);
}

const arms = buildArms();
for (const a of arms) writeFileSync(`${OUT}/prompt-${a.id}.txt`, a.prompt, "utf8");
say(`arms: ${arms.map((a) => a.id).join(", ")} · n=${N} · brief "${BRIEF}"`);
for (const a of arms) say(`  ${a.id.padEnd(3)} ${a.prompt.split(/\s+/).length} words · ${a.label}`);
if (DRY) { say("dry run — nothing rendered"); process.exit(0); }

const before = await readFalBalance();
say(`fal balance before: ${before.ok ? `$${before.remaining.toFixed(2)}` : before.why}`);

const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY! });
type Reading = { arm: string; slice: number; file: string | null; refused: string | null; ms: number; framing: Framing | null };
const readings: Reading[] = [];
const jobs: Array<() => Promise<void>> = [];
for (const a of arms) {
  for (let slice = 0; slice < N; slice += 1) {
    jobs.push(async () => {
      const t0 = Date.now();
      try {
        const r = await engine.generateCandidate({ prompt: a.prompt, size: "1024x1536", quality: "medium" });
        const file = `${OUT}/${a.id}-${slice}.png`;
        writeFileSync(file, r.bytes);
        const fr = await framing(r.bytes);
        readings.push({ arm: a.id, slice, file, refused: null, ms: Date.now() - t0, framing: fr });
        say(`${a.id.padEnd(3)} ${slice}  delivered ${((Date.now() - t0) / 1000).toFixed(0)}s  ${"noFace" in fr ? "NO FACE" : `share ${(fr.share * 100).toFixed(1)}% headroom ${fr.headroom.toFixed(2)} gap ${fr.gap.toFixed(2)}`}`);
      } catch (e) {
        const why = (e instanceof Error ? e.message : String(e)).slice(0, 140);
        readings.push({ arm: a.id, slice, file: null, refused: why, ms: Date.now() - t0, framing: null });
        say(`${a.id.padEnd(3)} ${slice}  REFUSED  ${why}`);
      }
    });
  }
}
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (next < jobs.length) { const j = jobs[next++]!; await j(); } }));

/* ─── STRIP — rows = arms, eight tiles each ─── */
const TILE_W = 300; const GUTTER = 260; const tileH = Math.round(TILE_W * 1.5);
const composites: sharp.OverlayOptions[] = [];
for (const [row, a] of arms.entries()) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg width="${GUTTER}" height="${tileH}"><rect width="100%" height="100%" fill="#141414"/><text x="14" y="${Math.round(tileH / 2) - 10}" font-family="sans-serif" font-size="34" fill="#EBEBEB">${a.id}</text><text x="14" y="${Math.round(tileH / 2) + 26}" font-family="sans-serif" font-size="17" fill="#9a9a9a">${esc(a.label.replace(/^\w+ · /, "")).slice(0, 34)}</text></svg>`;
  composites.push({ input: Buffer.from(svg), left: 0, top: row * tileH });
  for (const r of readings.filter((x) => x.arm === a.id)) {
    if (!r.file) {
      const ref = `<svg width="${TILE_W}" height="${tileH}"><rect width="100%" height="100%" fill="#2a2a2a"/><text x="20" y="${Math.round(tileH / 2)}" font-family="sans-serif" font-size="22" fill="#EBEBEB">REFUSED</text></svg>`;
      composites.push({ input: Buffer.from(ref), left: GUTTER + r.slice * TILE_W, top: row * tileH });
      continue;
    }
    composites.push({ input: await sharp(readFileSync(r.file)).resize({ width: TILE_W, height: tileH, fit: "cover" }).toBuffer(), left: GUTTER + r.slice * TILE_W, top: row * tileH });
  }
}
const strip = await sharp({ create: { width: GUTTER + N * TILE_W, height: tileH * arms.length, channels: 3, background: "#0A0A0A" } }).composite(composites).png().toBuffer();
writeFileSync(`${OUT}/STRIP.png`, strip);

/* ─── REPORT ─── */
say();
say(`arm  delivered  refused  headShare median (min–max)   headroom med   gap med`);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : Number.NaN; };
const summary: Record<string, unknown> = {};
for (const a of arms) {
  const rs = readings.filter((r) => r.arm === a.id);
  const ok = rs.filter((r) => r.file && r.framing && !("noFace" in r.framing));
  const shares = ok.map((r) => (r.framing as { share: number }).share);
  const hr = ok.map((r) => (r.framing as { headroom: number }).headroom);
  const gaps = ok.map((r) => (r.framing as { gap: number }).gap).filter((g) => !Number.isNaN(g));
  const refused = rs.filter((r) => r.refused).length;
  summary[a.id] = { delivered: rs.length - refused, refused, shareMedian: med(shares), shareMin: Math.min(...shares), shareMax: Math.max(...shares), headroomMedian: med(hr), gapMedian: med(gaps) };
  say(`${a.id.padEnd(4)} ${String(rs.length - refused).padStart(9)}  ${String(refused).padStart(7)}  ${(med(shares) * 100).toFixed(1)}% (${(Math.min(...shares) * 100).toFixed(1)}–${(Math.max(...shares) * 100).toFixed(1)})          ${med(hr).toFixed(2)}          ${med(gaps).toFixed(2)}`);
}
const after = await readFalBalance();
say(`fal balance after: ${after.ok ? `$${after.remaining.toFixed(2)}` : after.why}  (settles ~3 min late; a rise means a top-up landed)`);
say(`renders ${readings.length} × $${RENDER_USD} = $${(readings.length * RENDER_USD).toFixed(2)} · region reads ${regionReads} × $${REGION_USD} = $${(regionReads * REGION_USD).toFixed(2)} · total ≈ $${(readings.length * RENDER_USD + regionReads * REGION_USD).toFixed(2)}`);
say(`strip: ${OUT}/STRIP.png`);
writeFileSync(`${OUT}/readings.json`, JSON.stringify({ brief: BRIEF, arms: arms.map((a) => ({ id: a.id, label: a.label, lightingLine: a.lightingLine })), reference: { share: 0.282 }, summary, readings, balance: { before, after } }, null, 2), "utf8");
writeFileSync(`${OUT}/court.log`, lines.join("\n"), "utf8");
process.exit(0);
