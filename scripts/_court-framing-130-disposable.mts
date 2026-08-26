/**
 * DISPOSABLE — THE FRAMING COURT, issue #130 (foreman-29).
 *
 * Founder (Crew reply #8): "Calibrate the preset's framing to my reference
 * frame (28% head share) and lock framing, lighting and studio across every
 * cast. Never say 'sternum'." The #128 court measured every arm of the locked
 * block at 35–38% head share against his reference's 28.2% — the same framing
 * pair on all five arms, so the gap is the PAIR's. This court moves the pair's
 * second sentence and nothing else.
 *
 * ARMS (thin brief "goth woman mid 30s", LOW = seed + block, ONE prompt per arm, x8):
 *   K   today's pair — "the crop just below the collarbones"        — control (#128's K: 35.6%)
 *   F1  the crop said in ANATOMY, lower: a hand's width below the collarbones
 *   F2  the geometry said in NUMBERS at his figure: face about a QUARTER of the
 *       frame height, eyes ~30% down — aims at 28.2%
 *   F3  the geometry in numbers at the ASPECT-EQUIVALENT figure: his reference
 *       is 9:16 (1130×1999) and the product renders 2:3, so the same field of
 *       view in 2:3 reads ~33% — "a little under a third" — aims at 33%
 *
 * READINGS: head share / headroom / hair gap from `face` + `head` reads,
 * calibrated on his reference frame (28.2%) — the #128/#125 instrument
 * verbatim; refusals; the strip for his eye. The reference frame sits at the
 * top of the strip, letterboxed (never cropped into 2:3).
 *
 * COST: 32 renders x $0.0557 + ~68 reads x $0.005 ≈ $2.12 house. No rows, no credits.
 *
 *   npx tsx scripts/_court-framing-130-disposable.mts --instrument   (4 reads, cents)
 *   npx tsx scripts/_court-framing-130-disposable.mts --dry-run      (prompts only, $0)
 *   npx tsx scripts/_court-framing-130-disposable.mts [--arms=K,F1,F2,F3] [--n=8]
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("this court touches no database — refusing a production wrapper");
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const { HOUSE_BLOCK, AUTHOR_ROAD_FRAMING, DROPPED_FROM_BLOCK } = await import("../server/castingV2/houseBlock");
const { neverWrittenIn, staticPrompt } = await import("../server/castingV2/promptAuthor");

const argv = process.argv.slice(2);
const INSTRUMENT = argv.includes("--instrument");
const DRY = argv.includes("--dry-run");
const flag = (name: string): string | null => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const ONLY_ARMS = flag("arms")?.split(",") ?? ["K", "F1", "F2", "F3"];
const N = Number(flag("n") ?? 8);
const CONCURRENCY = Number(flag("concurrency") ?? 6);
const OUT = "output/_shift130/court";
const REFERENCE_FRAME = "docs/specs/references/prompt-author/house-framing-reference-chest-up.png";
const RENDER_USD = 0.0557;
const REGION_USD = 0.005;
const REFERENCE_SHARE = 0.282;
/* 9:16 reference → 2:3 product: the same field-of-view WIDTH gives a shorter frame, so the face reads taller. */
const ASPECT_EQUIVALENT_SHARE = REFERENCE_SHARE * (16 / 9) / (3 / 2);

const BRIEF = "goth woman mid 30s";

/* ─── THE FRAMING VARIANTS — the pair's SECOND sentence swapped, nothing else moves ─── */

const TODAY = AUTHOR_ROAD_FRAMING[1]!;

/** F1 — the crop in anatomy, lower than today's: never the breastbone by name (court §4). */
const F1_LINE =
  "Frame from the chest up in a 2:3 portrait: the crop line across the chest a hand's width below the collarbones, shoulders and the tops of the arms running off both edges of the frame, a small margin of headroom above the hair.";

/** F2 — his §3a geometry in numbers, at HIS figure (28%). */
const F2_LINE =
  "Frame from the chest up in a 2:3 portrait: the face takes up about a quarter of the frame's height, the eyes about 30% of the way down from the top edge, a small margin of headroom above the hair, the crop line across the chest below the collarbones, shoulders running off both edges of the frame.";

/** F3 — the same geometry at the ASPECT-EQUIVALENT figure (~33%). */
const F3_LINE =
  "Frame from the chest up in a 2:3 portrait: the face takes up a little under a third of the frame's height, the eyes about a third of the way down from the top edge, a small margin of headroom above the hair, the crop line across the chest below the collarbones, shoulders running off both edges of the frame.";

function swapFraming(line: string): string {
  const count = HOUSE_BLOCK.split(TODAY).length - 1;
  if (count !== 1) throw new Error(`the framing sentence appears ${count} times in HOUSE_BLOCK — expected exactly once`);
  const block = HOUSE_BLOCK.replace(TODAY, line);
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
  if (!lower.includes("collarbones")) throw new Error(`${name}: the suite pins "collarbones" in the block`);
}

type Arm = { id: string; label: string; prompt: string; framingLine: string };
function buildArms(): Arm[] {
  const K = staticPrompt(BRIEF);
  if (!K.endsWith(HOUSE_BLOCK)) throw new Error("staticPrompt does not end with HOUSE_BLOCK — the road moved");
  if (!K.startsWith(BRIEF)) throw new Error("staticPrompt does not start with the brief");
  const withBlock = (block: string) => `${BRIEF}\n\n${block}`;
  const arms: Arm[] = [
    { id: "K", label: "K · today's pair (collarbones)", prompt: K, framingLine: TODAY },
    { id: "F1", label: "F1 · a hand's width lower", prompt: withBlock(swapFraming(F1_LINE)), framingLine: F1_LINE },
    { id: "F2", label: "F2 · face a quarter of height", prompt: withBlock(swapFraming(F2_LINE)), framingLine: F2_LINE },
    { id: "F3", label: "F3 · face under a third", prompt: withBlock(swapFraming(F3_LINE)), framingLine: F3_LINE },
  ];
  for (const a of arms) guard(a.id, a.prompt);
  /* the three F arms differ from K in the framing sentence ONLY */
  for (const a of arms.filter((x) => x.id.startsWith("F"))) {
    const back = a.prompt.replace(a.framingLine, TODAY);
    if (back !== K) throw new Error(`${a.id} differs from K in more than the framing sentence`);
  }
  return arms.filter((a) => ONLY_ARMS.includes(a.id));
}

/* ─── THE FRAMING READER (the #128 court's, verbatim) ─── */

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader");
const { extentOf } = await import("../server/castingV2/inkReferenceCrop");
const region = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
let regionReads = 0;
type Framing = { share: number; headroom: number; gap: number; headTop: number; eyesAt: number } | { noFace: true };
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
  /* eyes sit ~40% down the face box on a frontal face — a proxy, not a landmark read; stated as such in the record */
  return { share: f.height / H, headroom: f.top / f.height, gap: h ? (f.top - h.top) / f.height : Number.NaN, headTop: h ? h.top / H : Number.NaN, eyesAt: (f.top + 0.4 * f.height) / H };
}

mkdirSync(OUT, { recursive: true });
const lines: string[] = [];
const say = (s = "") => { console.log(s); lines.push(s); };

if (INSTRUMENT) {
  say("INSTRUMENT CHECK (law 2) — nothing rendered");
  const ref = await sharp(readFileSync(REFERENCE_FRAME)).png().toBuffer();
  const fr = await framing(ref);
  if ("noFace" in fr) throw new Error("no face on the reference frame");
  const posOk = Math.abs(fr.share - REFERENCE_SHARE) < 0.02;
  say(`POSITIVE  reference frame: headShare ${(fr.share * 100).toFixed(1)}% (§3a 28.2%) headroom ${fr.headroom.toFixed(2)} gap ${fr.gap.toFixed(2)} eyesAt ${(fr.eyesAt * 100).toFixed(0)}%  ${posOk ? "✓" : "✗"}`);
  const grey = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#8a8a8a" } }).png().toBuffer();
  const ng = await framing(grey);
  const negOk = "noFace" in ng;
  say(`NEGATIVE  blank grey frame: ${negOk ? "NO FACE ✓" : "face found ✗ " + JSON.stringify(ng)}`);
  const arms = buildArms();
  say(`GUARDS    ${arms.length} arms pass the dropped-phrase, NEVER_WRITTEN and collarbones guards; F1/F2/F3 differ from K in the framing sentence only ✓`);
  say(`aspect-equivalent target for a 2:3 frame: ${(ASPECT_EQUIVALENT_SHARE * 100).toFixed(1)}%`);
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
        say(`${a.id.padEnd(3)} ${slice}  delivered ${((Date.now() - t0) / 1000).toFixed(0)}s  ${"noFace" in fr ? "NO FACE" : `share ${(fr.share * 100).toFixed(1)}% headroom ${fr.headroom.toFixed(2)} gap ${fr.gap.toFixed(2)} eyesAt ${(fr.eyesAt * 100).toFixed(0)}%`}`);
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

/* ─── STRIP — row 0 = his reference (letterboxed, never cropped), then rows = arms, eight tiles each ─── */
const TILE_W = 300; const GUTTER = 260; const tileH = Math.round(TILE_W * 1.5);
const composites: sharp.OverlayOptions[] = [];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const label = (id: string, sub: string, row: number) => {
  const svg = `<svg width="${GUTTER}" height="${tileH}"><rect width="100%" height="100%" fill="#141414"/><text x="14" y="${Math.round(tileH / 2) - 10}" font-family="sans-serif" font-size="34" fill="#EBEBEB">${esc(id)}</text><text x="14" y="${Math.round(tileH / 2) + 26}" font-family="sans-serif" font-size="17" fill="#9a9a9a">${esc(sub).slice(0, 34)}</text></svg>`;
  composites.push({ input: Buffer.from(svg), left: 0, top: row * tileH });
};
label("REF", "his 9:16 frame, 28.2%", 0);
composites.push({ input: await sharp(readFileSync(REFERENCE_FRAME)).resize({ width: TILE_W, height: tileH, fit: "contain", background: "#0A0A0A" }).toBuffer(), left: GUTTER, top: 0 });
for (const [i, a] of arms.entries()) {
  const row = i + 1;
  label(a.id, a.label.replace(/^\w+ · /, ""), row);
  for (const r of readings.filter((x) => x.arm === a.id)) {
    if (!r.file) {
      const ref = `<svg width="${TILE_W}" height="${tileH}"><rect width="100%" height="100%" fill="#2a2a2a"/><text x="20" y="${Math.round(tileH / 2)}" font-family="sans-serif" font-size="22" fill="#EBEBEB">REFUSED</text></svg>`;
      composites.push({ input: Buffer.from(ref), left: GUTTER + r.slice * TILE_W, top: row * tileH });
      continue;
    }
    composites.push({ input: await sharp(readFileSync(r.file)).resize({ width: TILE_W, height: tileH, fit: "cover" }).toBuffer(), left: GUTTER + r.slice * TILE_W, top: row * tileH });
  }
}
const strip = await sharp({ create: { width: GUTTER + N * TILE_W, height: tileH * (arms.length + 1), channels: 3, background: "#0A0A0A" } }).composite(composites).png().toBuffer();
writeFileSync(`${OUT}/STRIP.png`, strip);

/* ─── REPORT ─── */
say();
say(`arm  delivered  refused  headShare median (min–max)   headroom med   gap med   eyesAt med`);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : Number.NaN; };
const summary: Record<string, unknown> = {};
for (const a of arms) {
  const rs = readings.filter((r) => r.arm === a.id);
  const ok = rs.filter((r) => r.file && r.framing && !("noFace" in r.framing));
  const shares = ok.map((r) => (r.framing as { share: number }).share);
  const hr = ok.map((r) => (r.framing as { headroom: number }).headroom);
  const gaps = ok.map((r) => (r.framing as { gap: number }).gap).filter((g) => !Number.isNaN(g));
  const eyes = ok.map((r) => (r.framing as { eyesAt: number }).eyesAt);
  const refused = rs.filter((r) => r.refused).length;
  const within3 = shares.filter((s) => Math.abs(s - REFERENCE_SHARE) <= 0.03).length;
  summary[a.id] = { delivered: rs.length - refused, refused, shareMedian: med(shares), shareMin: Math.min(...shares), shareMax: Math.max(...shares), within3ptOfReference: within3, headroomMedian: med(hr), gapMedian: med(gaps), eyesAtMedian: med(eyes) };
  say(`${a.id.padEnd(4)} ${String(rs.length - refused).padStart(9)}  ${String(refused).padStart(7)}  ${(med(shares) * 100).toFixed(1)}% (${(Math.min(...shares) * 100).toFixed(1)}–${(Math.max(...shares) * 100).toFixed(1)})  within±3pt ${within3}/${shares.length}   ${med(hr).toFixed(2)}          ${med(gaps).toFixed(2)}      ${(med(eyes) * 100).toFixed(0)}%`);
}
say(`reference 28.2% · aspect-equivalent in 2:3 ${(ASPECT_EQUIVALENT_SHARE * 100).toFixed(1)}% · the trim's T on his account 31.6%`);
const after = await readFalBalance();
say(`fal balance after: ${after.ok ? `$${after.remaining.toFixed(2)}` : after.why}  (settles ~3 min late; a rise means a top-up landed)`);
say(`renders ${readings.length} × $${RENDER_USD} = $${(readings.length * RENDER_USD).toFixed(2)} · region reads ${regionReads} × $${REGION_USD} = $${(regionReads * REGION_USD).toFixed(2)} · total ≈ $${(readings.length * RENDER_USD + regionReads * REGION_USD).toFixed(2)}`);
say(`strip: ${OUT}/STRIP.png`);
writeFileSync(`${OUT}/readings.json`, JSON.stringify({ brief: BRIEF, arms: arms.map((a) => ({ id: a.id, label: a.label, framingLine: a.framingLine })), reference: { share: REFERENCE_SHARE, aspectEquivalentShare: ASPECT_EQUIVALENT_SHARE }, summary, readings, balance: { before, after } }, null, 2), "utf8");
writeFileSync(`${OUT}/court.log`, lines.join("\n"), "utf8");
process.exit(0);
