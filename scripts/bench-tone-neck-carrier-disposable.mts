/**
 * ARM T — A TONE SAMPLE TAKEN BELOW HER CHIN. (Designed in opus-420, granted in
 * fable-552.)
 *
 * # Why this arm exists after skin closed
 *
 * Skin closed as a carrier on a FACE cut (fable-423 §1), and the same ruling
 * said why: *a carrier's identity cost scales with how much of her facial
 * GEOMETRY it contains.* The build carrier proved the sentence's other half —
 * a below-head crop contains no face and keeps 92–109% where words keep
 * nothing.
 *
 * So arm T is her own skin with no face in it: everything the segmenter calls
 * skin BELOW the bottom of her face box — neck, upper chest, both upper arms —
 * eroded 12px, knocked out to her studio wall, cut to its box. Ridden as a
 * PROPERTY sample ("her skin tone, sampled from her neck and shoulders"), never
 * as an EXTENT claim (fable-409 §1).
 *
 * The pre-flight (V4_TONE_BELOW_CHIN_PREFLIGHT.md, $0.09) already established
 * on frames already on disk: the sample exists on 7/7 frames at ~107,000px, and
 * the tan reaches below the chin HARDER than it reaches her face (20.3/19.0/21.8
 * vs 18.7/16.0/17.9). What it cannot say is whether riding it HOLDS the shade.
 *
 * # Everything else is held fixed, so the arms are comparable
 *
 * The same three masters, the same v1s, the same floors, the same bars, the same
 * chain ask and the production anchor as the corrected re-run and as A′. The
 * shared floor is therefore the SAME floor W and A′ were judged against — which
 * is what the design asked for, bought without re-rendering W.
 *
 *   W (words only, the status quo)   0/3   median R 4.98
 *   A  (face-skin cut, a second portrait of her)   1/3   median R 2.08
 *   A′ (true skin-only face cut)     1/3   median R 2.02
 *   T  (this)                        ?
 *
 * # The bar, pre-registered, and the direction gate is the verdict-maker
 *
 * ```
 * WINS       median R at most a THIRD of W's median R (<= 1.66), and every
 *            face's R below W's own R on that face
 * COST       E within 3F_eyes on >= 2 of 3
 * DIRECTION  her FACE must not be pulled toward the sample's own darker shade
 *            beyond the floor: dE(face(v2), sample) < dE(face(v1), sample) - F
 *            is the PULL, and a pull is a fail wearing a good number
 * KILL       T within the floor of W -> the carrier does nothing, skin's
 *            closure stands, and it cost three renders to confirm
 * VOID       the carrier or the tone words missing from the dispatched request
 * ```
 *
 * Off-ledger house money: 3 generations + ~25 reads. No user credits, no ledger
 * rows, no writes to any table.
 *
 *   npx tsx scripts/bench-tone-neck-carrier-disposable.mts
 */
import "dotenv/config";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OUT = "output/skin-carrier";
const LOG = `${OUT}/neck.log`;
if (!existsSync(LOG)) writeFileSync(LOG, "");
function say(line = "") {
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
}
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const FACES = ["fair-short", "fair-long", "fair-dark"];
const TONE = "a deep golden tan, several shades darker than her own skin";
const CHAIN = "copper red hair";
const MARGIN = 12;
/** W's own numbers from the corrected re-run, on these faces and these floors. */
const W_MEDIAN_R = 4.98;
const W_BY_FACE: Record<string, number> = { "fair-short": 4.98, "fair-long": 8.73, "fair-dark": 2.50 };

const sharp = (await import("sharp")).default;
const { createFalMaskedEditEngine } = await import("../server/providers/falImages.js");
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { assembleRecipe } = await import("../server/castingV2/recipeAssembler.js");
const { repaint } = await import("../server/castingV2/repaintRender.js");
const { padToFrame, studioBackgroundOf } = await import("../server/castingV2/referenceFit.js");
const { pronounsForSex } = await import("../server/castingV2/castPronouns.js");
const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

type Lab = { L: number; a: number; b: number };
type Mask = { data: Buffer; width: number; height: number };

function rgbToLab(r8: number, g8: number, b8: number): Lab {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
const deltaE = (p: Lab, q: Lab) =>
  Math.sqrt((p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2);
const fmt = (lab: Lab) => `L${lab.L.toFixed(1)} a${lab.a.toFixed(1)} b${lab.b.toFixed(1)}`;
const digestOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const median = (values: number[]) => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
};

async function meanLabIn(bytes: Buffer, mask: Mask): Promise<Lab | null> {
  const { data, info } = await sharp(bytes)
    .resize(mask.width, mask.height, { fit: "fill" }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p < mask.width * mask.height; p += 1) {
    if (mask.data[p]! <= 127) continue;
    const at = p * info.channels;
    r += data[at]!; g += data[at + 1]!; b += data[at + 2]!; n += 1;
  }
  return n === 0 ? null : rgbToLab(r / n, g / n, b / n);
}
async function regionOf(bytes: Buffer, name: string): Promise<Mask | null> {
  try { return await reader.region({ image: bytes, name }) as Mask; }
  catch (error) { say(`      [no read] ${name}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}
async function readFrame(bytes: Buffer, label: string) {
  const skinMask = await regionOf(bytes, "face skin");
  const eyesMask = await regionOf(bytes, "eyes");
  const skin = skinMask ? await meanLabIn(bytes, skinMask) : null;
  const eyes = eyesMask ? await meanLabIn(bytes, eyesMask) : null;
  say(`      ${label}: skin ${skin ? fmt(skin) : "NO READ"} · eyes ${eyes ? fmt(eyes) : "NO READ"}`);
  return { skin, eyes, skinMask };
}

/** A separable min-filter — erode by a square of side 2R+1 (thumbnail bench). */
function erode(allowed: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dx = -radius; dx <= radius && keep === 1; dx += 1) {
        const at = x + dx;
        if (at < 0 || at >= width || allowed[y * width + at] === 0) keep = 0;
      }
      horizontal[y * width + x] = keep;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dy = -radius; dy <= radius && keep === 1; dy += 1) {
        const at = y + dy;
        if (at < 0 || at >= height || horizontal[at * width + x] === 0) keep = 0;
      }
      out[y * width + x] = keep;
    }
  }
  return out;
}

/** One mask brought to another's pixel grid — never skipped for mismatching. */
async function at(mask: Mask, width: number, height: number): Promise<Buffer> {
  if (mask.width === width && mask.height === height) return mask.data;
  return sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .resize(width, height, { fit: "fill" }).toColourspace("b-w").raw().toBuffer();
}

const results: any[] = [];

for (const face of FACES) {
  say(`\n${"-".repeat(78)}`);
  say(`FACE ${face}`);
  say("-".repeat(78));
  const master = readFileSync(`${OUT}/${face}-master.png`);
  const v1Bytes = readFileSync(`${OUT}/${face}-v1.png`);
  const floorBytes = readFileSync(`${OUT}/${face}-floor.png`);

  const m = await readFrame(master, "master");
  const v1 = await readFrame(v1Bytes, "v1");
  const floor = await readFrame(floorBytes, "floor");
  if (!m.skin || !m.eyes || !v1.skin || !v1.eyes || !floor.skin || !floor.eyes) {
    say("  a reused frame does not read — skipped"); continue;
  }
  const F = deltaE(floor.skin, m.skin);
  const Feyes = deltaE(floor.eyes, m.eyes);
  const S = deltaE(v1.skin, m.skin);
  say(`    F ${F.toFixed(2)} · F_eyes ${Feyes.toFixed(2)} · S ${S.toFixed(2)} (the same bars W and A′ were judged against)`);

  /* ── the cut: all her skin BELOW the bottom of her face box ──────────── */
  const meta = await sharp(v1Bytes).metadata();
  const frame = { width: meta.width!, height: meta.height! };
  const skinMask = await regionOf(v1Bytes, "skin");
  const faceMask = await regionOf(v1Bytes, "face");
  if (!skinMask || !faceMask) { say("    no skin/face read on v1 — VOID"); continue; }
  const skinAtFrame = await at(skinMask, frame.width, frame.height);
  const faceAtFrame = await at(faceMask, frame.width, frame.height);
  let chin = -1;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      if (faceAtFrame[y * frame.width + x]! > 127 && y > chin) chin = y;
    }
  }
  if (chin < 0) { say("    her face has no bottom — VOID"); continue; }
  const allowed = new Uint8Array(frame.width * frame.height);
  let above = 0, below = 0;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const p = y * frame.width + x;
      if (skinAtFrame[p]! <= 127) continue;
      if (y > chin) { allowed[p] = 1; below += 1; } else above += 1;
    }
  }
  const pulled = erode(allowed, frame.width, frame.height, MARGIN);
  let afterErode = 0;
  for (let p = 0; p < pulled.length; p += 1) afterErode += pulled[p]!;
  say(`    the cut: chin at y=${chin} · skin above ${above}px, below ${below}px → ${afterErode}px after ${MARGIN}px erosion`);
  if (afterErode === 0) { say("    nothing survives the erosion — VOID"); continue; }

  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      if (pulled[y * frame.width + x] === 0) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const bbox = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const wall = await studioBackgroundOf(v1Bytes);
  const { data, info } = await sharp(v1Bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const cut = Buffer.from(data);
  let knocked = 0;
  for (let p = 0; p < info.width * info.height; p += 1) {
    if (pulled[p] === 1) continue;
    const off = p * info.channels;
    cut[off] = wall.r; cut[off + 1] = wall.g; cut[off + 2] = wall.b;
    knocked += 1;
  }
  say(`    knocked ${knocked} of ${info.width * info.height} px to the wall · box ${bbox.width}x${bbox.height} at (${bbox.x}, ${bbox.y})`);
  const carrierBytes = await sharp(cut, { raw: { width: info.width, height: info.height, channels: info.channels as 3 } })
    .extract({ left: bbox.x, top: bbox.y, width: bbox.width, height: bbox.height }).png().toBuffer();
  writeFileSync(`${OUT}/${face}-carrier-T.png`, carrierBytes);

  /* PRE-FLIGHT, MASK IN HAND — no second segmentation, so no second variance. */
  const cropMask = Buffer.alloc(bbox.width * bbox.height);
  for (let y = 0; y < bbox.height; y += 1) {
    for (let x = 0; x < bbox.width; x += 1) {
      cropMask[y * bbox.width + x] = pulled[(bbox.y + y) * frame.width + (bbox.x + x)] === 1 ? 255 : 0;
    }
  }
  const sample = await meanLabIn(carrierBytes, { data: cropMask, width: bbox.width, height: bbox.height });
  if (!sample) { say("    the reference does not read — VOID"); continue; }
  const P = deltaE(sample, v1.skin);
  const P0 = deltaE(sample, m.skin);
  say(`    pre-flight (mask in hand): sample ${fmt(sample)} · P ${P.toFixed(2)} toward the tone · P0 ${P0.toFixed(2)} toward her original`);
  if (!(P < P0)) { say("    nearer her original than the tone — it does not ride"); continue; }

  /* ── the chained render, production anchor ───────────────────────────── */
  const MASTER_KEY = `bench/master/${face}-neck`;
  const CARRIER_KEY = `bench/carrier/${face}-neck`;
  const recipe = assembleRecipe({
    master: { key: MASTER_KEY },
    pronouns: pronounsForSex("female"),
    library: [{
      slot: "skin", tier: "anatomy" as const,
      carry: { key: CARRIER_KEY, sha: digestOf(carrierBytes) },
      words: [TONE], noun: "skin",
    }],
    asks: [{ slot: "hair", noun: "hair", words: CHAIN }],
  });
  if (!recipe.ok) throw new Error(`recipe refused: ${(recipe as any).reason}`);
  const bytesByKey = new Map<string, Buffer>([[MASTER_KEY, master], [CARRIER_KEY, carrierBytes]]);
  let sent: any = null;
  const result = await repaint({
    recipe, engine, width: frame.width, height: frame.height,
    load: async (image) => {
      const bytes = bytesByKey.get(image.key);
      if (!bytes) throw new Error(`no bytes for ${image.key}`);
      return { bytes, contentType: "image/png" };
    },
    onDispatch: (request) => { sent = request; },
    fit: async ({ reference, image, role }) => {
      if (role.kind === "master") {
        const size = await sharp(reference.bytes).metadata();
        return { bytes: reference.bytes, contentType: "image/png", width: size.width ?? 0, height: size.height ?? 0 };
      }
      void image;
      return {
        bytes: await padToFrame({ crop: reference.bytes, geometry: { bbox, frame }, frame, background: wall }),
        contentType: "image/png", ...frame,
      };
    },
  });
  if (!result.ok) throw new Error(`repaint refused: ${(result as any).reason}`);
  const onWire = sent.digests.some((d: string) => digestOf(carrierBytes).startsWith(String(d).trim().toLowerCase()));
  const wordsOnWire = String(sent.prompt ?? "").includes(TONE);
  say(`      dispatched ${sent.keys.length} reference(s) · carrier on wire ${onWire} · tone words on wire ${wordsOnWire}`);
  if (!onWire || !wordsOnWire) { say("    the thing under test never left — VOID"); continue; }
  writeFileSync(`${OUT}/${face}-v2-T.png`, result.frame.bytes);

  const v2 = await readFrame(result.frame.bytes, "v2 (T)");
  if (!v2.skin || !v2.eyes) { say("    NO READ"); continue; }
  const R = deltaE(v2.skin, v1.skin);
  const Rback = deltaE(v2.skin, m.skin);
  const E = deltaE(v2.eyes, v1.eyes);

  /* THE DIRECTION GATE — did her FACE get pulled toward the neck's own shade?
     A carrier that holds the number by making her a different colour is a fail
     wearing a good one (fable-552 §3a). */
  const towardBefore = deltaE(v1.skin, sample);
  const towardAfter = deltaE(v2.skin, sample);
  const pulledToward = towardBefore - towardAfter;
  const pull = pulledToward > F;
  say(`    direction: her face was ${towardBefore.toFixed(2)} from the sample, now ${towardAfter.toFixed(2)}`
    + ` → moved ${pulledToward >= 0 ? "toward" : "away from"} it by ${Math.abs(pulledToward).toFixed(2)} (floor ${F.toFixed(2)}) → ${pull ? "PULL" : "no pull"}`);

  const beatsW = R < (W_BY_FACE[face] ?? W_MEDIAN_R);
  const verdict = pull ? "PULLED" : R <= 3 * F && E <= 3 * Feyes ? "SURVIVED" : Rback <= 3 * F ? "MELTED" : "PARTIAL";
  say(`    R ${R.toFixed(2)} (3F bar ${(3 * F).toFixed(2)} · W on this face ${(W_BY_FACE[face] ?? W_MEDIAN_R).toFixed(2)})`
    + ` · Rback ${Rback.toFixed(2)} · E ${E.toFixed(2)} (bar ${(3 * Feyes).toFixed(2)}) → ${verdict}${beatsW ? "" : " · does NOT beat W"}`);
  results.push({
    face, F, Feyes, S, P, P0, R, Rback, E, verdict, beatsW,
    towardBefore, towardAfter, pulledToward, pull, allowedPx: afterErode, chin,
    sample, bbox,
  });
  writeFileSync(`${OUT}/neck-results.json`, JSON.stringify(results, null, 2));
}

say(`\n${"=".repeat(78)}`);
say("ARM T — a tone sample from below her chin, against the same bars as W and A′");
say("=".repeat(78));
say("face          R      3F     W      Rback  E      pull   verdict");
for (const row of results) {
  say(`${row.face.padEnd(13)} ${row.R.toFixed(2).padEnd(6)} ${(3 * row.F).toFixed(2).padEnd(6)} `
    + `${(W_BY_FACE[row.face] ?? W_MEDIAN_R).toFixed(2).padEnd(6)} ${row.Rback.toFixed(2).padEnd(6)} `
    + `${row.E.toFixed(2).padEnd(6)} ${(row.pull ? "YES" : "no").padEnd(6)} ${row.verdict}`);
}
if (results.length > 0) {
  const medianR = median(results.map((row) => row.R));
  const beat = results.filter((row) => row.beatsW).length;
  const pulls = results.filter((row) => row.pull).length;
  const survived = results.filter((row) => row.verdict === "SURVIVED").length;
  say("");
  say(`median R ${medianR.toFixed(2)} · the effect bar was <= ${(W_MEDIAN_R / 3).toFixed(2)} (a third of W's ${W_MEDIAN_R})`);
  say(`beats W on ${beat}/${results.length} faces · SURVIVED ${survived}/${results.length} · DIRECTION PULLS ${pulls}/${results.length}`);
  say(`  W  0/3, median R ${W_MEDIAN_R}   ·   A′ 1/3, median R 2.02   ·   T ${survived}/${results.length}, median R ${medianR.toFixed(2)}`);
  const wins = medianR <= W_MEDIAN_R / 3 && beat === results.length && pulls === 0;
  say("");
  say(wins
    ? "T WINS on the pre-registered bar. The SHIP DESIGN goes back to Fable before anything lands."
    : pulls > 0
      ? "T is REFUSED by the direction gate — it holds the number by moving her colour."
      : "T does NOT clear the pre-registered bar. Written as it is.");
}
writeFileSync(`${OUT}/neck-results.json`, JSON.stringify(results, null, 2));
process.exit(0);
