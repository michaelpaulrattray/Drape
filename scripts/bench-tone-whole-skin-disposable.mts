/**
 * ARM S — HER WHOLE VISIBLE SKIN, AS ONE REFERENCE. (Predicted by the
 * region-it-depicts reading; pre-registered in opus-422.)
 *
 * # The law this arm is built on, measured an hour ago
 *
 * A crop holds the REGION IT DEPICTS, not the property it is labelled with.
 * Same three faces, same chained edit, drift from v1 by region:
 *
 * ```
 *              her FACE              her BELOW-CHIN skin
 *   W  words   4.98 / 8.73 / 2.50    7.14 / 7.66 / 3.51
 *   A' face    1.90 / 2.02 / 2.93    5.33 / 3.98 / 5.69   holds the face only
 *   T  neck    3.14 / 4.59 / 2.13    2.15 / 1.76 / 1.63   holds the neck only
 *                                    (below-chin floor 0.37 / 1.21 / 0.44)
 * ```
 *
 * Each carrier pinned its own region and let the other go, 3 of 3. So neither
 * arm was the wrong idea; each was an incomplete PICTURE.
 *
 * # The arm
 *
 * Everything the segmenter calls skin, ANYWHERE — face and neck and chest and
 * arms — minus eyes, lips and brows (A''s subtraction, because SAM's masks are
 * tight and an unsubtracted face carries lashes and orbital shadow), eroded
 * 12px, knocked out to her studio wall, cut to its box and padded back to the
 * frame's geometry.
 *
 * One reference, one slot: `slotTwiceReferenced` is a founder ruling
 * (fable-174), so the two regions ride as ONE picture rather than as two
 * references on `skin`.
 *
 * And it is the cut that makes the catalogue's own objection false rather than
 * argued around: *"a face crop filed as her skin is a partial wearing the name
 * of the whole"*. This one is not a partial. The EXTENT claim is true of it.
 *
 * # The predictions, written before the first call
 *
 * ```
 * FACE       drifts like A' did: <= 3.0 on every face
 * BELOW-CHIN drifts like T did:  <= 2.2 on every face
 * COST       identity like A''s — E inside 3F_eyes on >= 2 of 3
 * DIRECTION  no pull: her face must not move toward the sample's own shade by
 *            more than the floor
 * ```
 *
 * A miss on either region is the interesting outcome: it would mean the picture
 * is not what carries, and the law would need a better statement than mine.
 *
 * Off-ledger house money: 3 generations + ~35 reads. No user credits, no ledger
 * rows, no writes to any table.
 *
 *   npx tsx scripts/bench-tone-whole-skin-disposable.mts
 */
import "dotenv/config";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OUT = "output/skin-carrier";
const LOG = `${OUT}/whole-skin.log`;
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

  /* ── the cut: ALL of her visible skin, features subtracted ────────────
     Arm T's cut with the chin line taken out — everything the segmenter calls
     skin, minus eyes, lips and brows (A′'s subtraction, because SAM's masks are
     tight and an unsubtracted "skin" carries lashes and orbital shadow), eroded
     12px. One reference, one slot: `slotTwiceReferenced` is a founder ruling and
     two crops for `skin` is exactly what it forbids, so the two regions ride as
     one picture rather than as two. */
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
      allowed[p] = 1;
      if (y > chin) below += 1; else above += 1;
    }
  }
  const subtracted: string[] = [];
  for (const name of ["eyes", "lips", "eyebrows"]) {
    const mask = await regionOf(v1Bytes, name);
    if (!mask) continue;
    const data = await at(mask, frame.width, frame.height);
    let hits = 0;
    for (let p = 0; p < allowed.length; p += 1) {
      if (data[p]! > 127 && allowed[p] === 1) { allowed[p] = 0; hits += 1; }
    }
    subtracted.push(`${name} −${hits}px`);
  }
  const pulled = erode(allowed, frame.width, frame.height, MARGIN);
  let afterErode = 0;
  for (let p = 0; p < pulled.length; p += 1) afterErode += pulled[p]!;
  say(`    the cut: chin at y=${chin} · skin above ${above}px, below ${below}px`
    + ` → after ${subtracted.join(", ")} → ${afterErode}px after ${MARGIN}px erosion`);
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
  writeFileSync(`${OUT}/${face}-carrier-S.png`, carrierBytes);

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
  const MASTER_KEY = `bench/master/${face}-wholeskin`;
  const CARRIER_KEY = `bench/carrier/${face}-wholeskin`;
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
  writeFileSync(`${OUT}/${face}-v2-S.png`, result.frame.bytes);

  const v2 = await readFrame(result.frame.bytes, "v2 (S)");
  if (!v2.skin || !v2.eyes) { say("    NO READ"); continue; }
  const R = deltaE(v2.skin, v1.skin);
  const Rback = deltaE(v2.skin, m.skin);
  const E = deltaE(v2.eyes, v1.eyes);

  /* BOTH REGIONS, because this arm claims both. Her below-chin skin on v1 comes
     from the mask already in hand; on v2 it is read on v2's OWN chin line — a
     carried box would measure a moved head rather than a moved colour. */
  const belowV1Mask = Buffer.alloc(frame.width * frame.height);
  let belowV1Px = 0;
  for (let y = chin + 1; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const p = y * frame.width + x;
      if (pulled[p] === 1) { belowV1Mask[p] = 255; belowV1Px += 1; }
    }
  }
  const belowV1 = belowV1Px > 0
    ? await meanLabIn(v1Bytes, { data: belowV1Mask, width: frame.width, height: frame.height })
    : null;
  let belowDrift: number | null = null;
  const v2Skin = await regionOf(result.frame.bytes, "skin");
  const v2Face = await regionOf(result.frame.bytes, "face");
  if (belowV1 && v2Skin && v2Face) {
    const v2SkinAt = await at(v2Skin, frame.width, frame.height);
    const v2FaceAt = await at(v2Face, frame.width, frame.height);
    let v2Chin = -1;
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) if (v2FaceAt[y * frame.width + x]! > 127 && y > v2Chin) v2Chin = y;
    }
    const v2Allowed = new Uint8Array(frame.width * frame.height);
    for (let y = v2Chin + 1; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const p = y * frame.width + x;
        if (v2SkinAt[p]! > 127) v2Allowed[p] = 1;
      }
    }
    const v2Pulled = erode(v2Allowed, frame.width, frame.height, MARGIN);
    const v2Below = Buffer.alloc(frame.width * frame.height);
    let v2BelowPx = 0;
    for (let p = 0; p < v2Pulled.length; p += 1) if (v2Pulled[p] === 1) { v2Below[p] = 255; v2BelowPx += 1; }
    const belowV2 = v2BelowPx > 0
      ? await meanLabIn(result.frame.bytes, { data: v2Below, width: frame.width, height: frame.height })
      : null;
    if (belowV2) belowDrift = deltaE(belowV2, belowV1);
  }
  say(`    her FACE drifted ${R.toFixed(2)} · her BELOW-CHIN skin drifted ${belowDrift?.toFixed(2) ?? "—"}`
    + `   (T held the neck at 2.15/1.76/1.63 and let the face go; A′ the reverse)`);

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
    face, F, Feyes, S, P, P0, R, Rback, E, verdict, beatsW, belowDrift,
    towardBefore, towardAfter, pulledToward, pull, allowedPx: afterErode, chin,
    sample, bbox,
  });
  writeFileSync(`${OUT}/whole-skin-results.json`, JSON.stringify(results, null, 2));
}

say(`\n${"=".repeat(78)}`);
say("ARM S — her whole visible skin as one reference, against the same bars");
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
writeFileSync(`${OUT}/whole-skin-results.json`, JSON.stringify(results, null, 2));
process.exit(0);
