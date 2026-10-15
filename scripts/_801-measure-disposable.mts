/**
 * #801 — THE COURT'S INSTRUMENT, and its controls.
 *
 * Four readings per frame pair, each chosen because it answers a half of his
 * question and none of them chosen because it was easy:
 *
 *   framing   where the subject SITS in the frame. Sunburst's edit door
 *             re-renders the whole picture, so the first thing that moves on a
 *             chain is the camera — seen on the first probe, before any
 *             harness existed. bbox + centroid of the subject silhouette.
 *   dE        CIEDE2000, taken INSIDE silhouette(a) INTERSECT silhouette(b)
 *             with the IoU printed beside it — a mean over two different
 *             extents is a number about the mask, not about the picture
 *             (memory: same-pixels-or-measuring-the-mask).
 *   bgDE      the same, OUTSIDE both silhouettes: the part of the picture
 *             nobody asked about at all.
 *   sharpPct  variance of the Laplacian over the subject, as a PERCENTAGE of
 *             the master's. "Turn to mush" is his word and this is the only
 *             reading that is about it directly.
 *
 * The silhouette is cut from the studio backdrop rather than from a segmenter:
 * every fixture here is a flat-backdrop portrait, the cut is deterministic and
 * free, and it REFUSES (returns null) when the four corner patches disagree —
 * a silhouette it does not believe is worse than no silhouette.
 *
 * WARNING: nothing here is trusted until `--controls` has run. CIEDE2000 is
 * checked against published pairs first, then master against itself must read
 * zero on all four, a known blur must drop `sharpPct`, and a known shift must
 * show up in `framing` at the size it was applied.
 *
 *   npx tsx scripts/_801-measure-disposable.mts --controls [path.png]
 */
import { readFileSync } from "node:fs";
import sharpLib from "sharp";

export type Reading = {
  framing: { dx: number; dy: number; dw: number; dh: number; dcx: number; dcy: number } | null;
  iou: number | null;
  dE: number | null;
  bgDE: number | null;
  sharpPct: number | null;
  note?: string;
};

type Frame = {
  width: number;
  height: number;
  rgb: Buffer;
  mask: Uint8Array | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  centroid: { x: number; y: number } | null;
};

/** sRGB to CIE Lab (D65), written out so it can be checked rather than trusted. */
function toLab(r: number, g: number, b: number): [number, number, number] {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = f(r);
  const G = f(g);
  const B = f(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = h(X);
  const fy = h(Y);
  const fz = h(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function ciede2000(
  L1: number, a1: number, b1: number, L2: number, a2: number, b2: number,
): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp = (bb: number, ap: number) => {
    if (bb === 0 && ap === 0) return 0;
    const deg = Math.atan2(bb, ap) / rad;
    return deg >= 0 ? deg : deg + 360;
  };
  const hp1 = hp(b1, ap1);
  const hp2 = hp(b2, ap2);
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp / 2) * rad);
  const Lbar = (L1 + L2) / 2;
  const Cpbar = (Cp1 + Cp2) / 2;
  let hpbar = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hpbar += hp1 + hp2 < 360 ? 360 : -360;
    hpbar /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hpbar - 30) * rad) + 0.24 * Math.cos(2 * hpbar * rad)
    + 0.32 * Math.cos((3 * hpbar + 6) * rad) - 0.20 * Math.cos((4 * hpbar - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpbar - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpbar ** 7 / (Cpbar ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cpbar;
  const Sh = 1 + 0.015 * Cpbar * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

/**
 * How far one pixel may sit from its already-accepted NEIGHBOUR and still be
 * read as more backdrop.
 *
 * A single backdrop colour does not survive these fixtures: the studio
 * backdrop is a soft gradient and the four corner patches of the fisherman
 * disagree by more than any flat tolerance worth having, so a global threshold
 * either refused the frame or ate the subject. The fill is LOCAL instead —
 * backdrop is whatever is continuous with the border — which follows a
 * gradient of any depth and still stops dead at the subject.
 */
const BACKDROP_STEP = Number(process.env.BACKDROP_STEP ?? 2.5);

/**
 * AND HOW FAR THE WHOLE FILL MAY WANDER FROM THE BACKDROP IT STARTED ON.
 *
 * Local continuity alone is not enough and the casting fixture is why: the
 * backdrop reaches down the sides, meets the shadow under an arm, and walks a
 * smooth ramp straight into a BLACK VEST — so the silhouette came back at
 * 28.7% of the frame where the eye says about 65%, and on several frames it
 * refused outright. Looked at (`output/801/maskdump`), not reasoned about.
 *
 * A pixel is backdrop only if it is continuous with the border AND still
 * recognisably the backdrop's own colour. 20 is generous against these
 * studio ramps, which measure about 8 from top to bottom, and nowhere near
 * the 60-odd that separates light grey from a black vest.
 */
const BACKDROP_REACH = Number(process.env.BACKDROP_REACH ?? 20);

export async function readFrame(
  bytes: Buffer,
  resizeTo?: { width: number; height: number },
): Promise<Frame> {
  let pipeline = sharpLib(bytes).removeAlpha();
  if (resizeTo) pipeline = pipeline.resize(resizeTo.width, resizeTo.height, { fit: "fill" });
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const rgb = Buffer.from(data);

  /* Lab once per pixel: the fill asks about most of them several times. */
  const L = new Float32Array(width * height);
  const A = new Float32Array(width * height);
  const B = new Float32Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 3;
    const lab = toLab(rgb[i], rgb[i + 1], rgb[i + 2]);
    L[p] = lab[0];
    A[p] = lab[1];
    B[p] = lab[2];
  }

  /* Flood the backdrop in from every border pixel. */
  const background = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (background[p]) return;
    background[p] = 1;
    queue[tail] = p;
    tail += 1;
  };
  /*
    SEEDED FROM THE TOP ONLY, and the first version seeding every border pixel
    is why. These are torso portraits: the subject reaches the bottom edge and
    both side edges, so a border seed starts INSIDE the sweater and the fill
    eats the clothing — looked at, not reasoned about (output/801/masktune).
    The backdrop always owns the top strip, and it is connected, so the fill
    still reaches every part of the backdrop from there.
  */
  const sideDepth = Math.round(height * 0.2);
  for (let x = 0; x < width; x += 1) push(x);
  for (let y = 0; y < sideDepth; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  /* The backdrop's own colour, from the median of the top row — the one strip
     of the frame no subject in this court reaches. */
  const topRow = Array.from({ length: width }, (_unused, x) => x);
  const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const refL = median(topRow.map((x) => L[x]));
  const refA = median(topRow.map((x) => A[x]));
  const refB = median(topRow.map((x) => B[x]));
  while (head < tail) {
    const p = queue[head];
    head += 1;
    const x = p % width;
    const y = (p - x) / width;
    const neighbours = [
      x > 0 ? p - 1 : -1,
      x < width - 1 ? p + 1 : -1,
      y > 0 ? p - width : -1,
      y < height - 1 ? p + width : -1,
    ];
    for (const q of neighbours) {
      if (q < 0 || background[q]) continue;
      if (ciede2000(L[p], A[p], B[p], L[q], A[q], B[q]) > BACKDROP_STEP) continue;
      if (ciede2000(refL, refA, refB, L[q], A[q], B[q]) > BACKDROP_REACH) continue;
      push(q);
    }
  }

  const mask = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let p = 0; p < width * height; p += 1) {
    if (background[p]) continue;
    mask[p] = 1;
    const x = p % width;
    const y = (p - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    sx += x;
    sy += y;
    n += 1;
  }
  /* A silhouette that is almost everything, or almost nothing, is not one. */
  const fraction = n / (width * height);
  if (fraction < 0.05 || fraction > 0.95) {
    return { width, height, rgb, mask: null, bbox: null, centroid: null };
  }
  return {
    width,
    height,
    rgb,
    mask,
    bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    centroid: { x: sx / n, y: sy / n },
  };
}

/**
 * Variance of the Laplacian over ONE region, handed in rather than taken from
 * the frame.
 *
 * The first version read each frame over its OWN silhouette, which is the
 * moving-mask defect this file warns about one reading up: a degraded frame
 * whose silhouette the fill refuses would have been measured over the whole
 * picture, backdrop included, and compared against a master measured over its
 * subject. Both sides are read over the same pixels or the number is not a
 * comparison.
 */
function sharpness(frame: Frame, region: Uint8Array | null): number {
  const { width, height, rgb } = frame;
  const mask = region;
  const grey = new Float64Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 3;
    grey[p] = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      if (mask && !mask[p]) continue;
      const lap = 4 * grey[p] - grey[p - 1] - grey[p + 1] - grey[p - width] - grey[p + width];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export async function compare(aBytes: Buffer, bBytes: Buffer): Promise<Reading> {
  const a = await readFrame(aBytes);
  const b = await readFrame(bBytes, { width: a.width, height: a.height });
  const out: Reading = { framing: null, iou: null, dE: null, bgDE: null, sharpPct: null };

  if (a.mask && b.mask && a.bbox && b.bbox && a.centroid && b.centroid) {
    out.framing = {
      dx: +(((b.bbox.x - a.bbox.x) / a.width) * 100).toFixed(2),
      dy: +(((b.bbox.y - a.bbox.y) / a.height) * 100).toFixed(2),
      dw: +(((b.bbox.w - a.bbox.w) / a.width) * 100).toFixed(2),
      dh: +(((b.bbox.h - a.bbox.h) / a.height) * 100).toFixed(2),
      dcx: +(((b.centroid.x - a.centroid.x) / a.width) * 100).toFixed(2),
      dcy: +(((b.centroid.y - a.centroid.y) / a.height) * 100).toFixed(2),
    };
    let inter = 0;
    let union = 0;
    let dSum = 0;
    let dN = 0;
    let bgSum = 0;
    let bgN = 0;
    for (let p = 0; p < a.width * a.height; p += 1) {
      const am = a.mask[p];
      const bm = b.mask[p];
      if (am || bm) union += 1;
      const i = p * 3;
      if (am && bm) {
        inter += 1;
        const x = toLab(a.rgb[i], a.rgb[i + 1], a.rgb[i + 2]);
        const y = toLab(b.rgb[i], b.rgb[i + 1], b.rgb[i + 2]);
        dSum += ciede2000(x[0], x[1], x[2], y[0], y[1], y[2]);
        dN += 1;
      } else if (!am && !bm) {
        const x = toLab(a.rgb[i], a.rgb[i + 1], a.rgb[i + 2]);
        const y = toLab(b.rgb[i], b.rgb[i + 1], b.rgb[i + 2]);
        bgSum += ciede2000(x[0], x[1], x[2], y[0], y[1], y[2]);
        bgN += 1;
      }
    }
    out.iou = union === 0 ? null : +(inter / union).toFixed(4);
    out.dE = dN === 0 ? null : +(dSum / dN).toFixed(3);
    out.bgDE = bgN === 0 ? null : +(bgSum / bgN).toFixed(3);
  } else {
    out.note = "backdrop not flat enough to cut a silhouette — framing, dE and IoU refused";
  }
  /* ONE region for both sides — the intersection when both silhouettes stand,
     the master's when only it does, the whole frame when neither does. */
  let region: Uint8Array | null = null;
  if (a.mask && b.mask) {
    region = new Uint8Array(a.width * a.height);
    for (let p = 0; p < region.length; p += 1) region[p] = a.mask[p] && b.mask[p] ? 1 : 0;
  } else if (a.mask) {
    region = a.mask;
  } else if (b.mask) {
    region = b.mask;
  }
  const sa = sharpness(a, region);
  const sb = sharpness(b, region);
  out.sharpPct = sa === 0 ? null : +((sb / sa) * 100).toFixed(1);
  return out;
}

/* ── the controls, and nothing above is believed until these pass ─────────── */

async function runControls(): Promise<void> {
  const at = process.argv.indexOf("--controls");
  const path = process.argv[at + 1] && !process.argv[at + 1].startsWith("--")
    ? process.argv[at + 1]
    : "output/801/probe/master.png";
  const master = readFileSync(path);
  console.log(`CONTROLS on ${path}`);

  const pairs: [number[], number[], number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  ];
  let worst = 0;
  for (const [x, y, want] of pairs) {
    const got = ciede2000(x[0], x[1], x[2], y[0], y[1], y[2]);
    worst = Math.max(worst, Math.abs(got - want));
    console.log(`  ciede2000 ${got.toFixed(4)} want ${want} ${Math.abs(got - want) < 0.001 ? "ok" : "MISMATCH"}`);
  }
  if (worst >= 0.001) {
    throw new Error(`ciede2000 is off by ${worst.toFixed(4)} — nothing below is believable`);
  }

  const same = await compare(master, master);
  console.log("  master vs itself      ", JSON.stringify(same));
  if (
    same.dE === null || same.dE > 0.001
    || same.bgDE === null || same.bgDE > 0.001
    || same.sharpPct === null || Math.abs(same.sharpPct - 100) > 0.1
    || same.iou !== 1
    || same.framing === null || same.framing.dx !== 0 || same.framing.dy !== 0
  ) {
    throw new Error("the identity control did not read zero — the instrument is wrong");
  }

  const meta = await sharpLib(master).metadata();
  const blurred = await sharpLib(master).blur(2).png().toBuffer();
  const blur = await compare(master, blurred);
  console.log("  master vs blur sigma=2", JSON.stringify(blur));
  if (blur.sharpPct === null || blur.sharpPct > 60) {
    throw new Error("a sigma=2 blur did not drop the sharpness reading — it cannot see mush");
  }

  const SHIFT = 16;
  const shifted = await sharpLib(master)
    .extract({ left: 0, top: 0, width: meta.width! - SHIFT, height: meta.height! })
    .extend({ left: SHIFT, top: 0, right: 0, bottom: 0, background: "#ffffff" })
    .png()
    .toBuffer();
  const moved = await compare(master, shifted);
  const wantDx = +((SHIFT / meta.width!) * 100).toFixed(2);
  console.log(`  master vs +${SHIFT}px shift `, JSON.stringify(moved), `want dx about ${wantDx}`);
  if (moved.framing === null || Math.abs(moved.framing.dx - wantDx) > 0.3) {
    throw new Error("a known shift did not show up in the framing reading");
  }

  console.log("CONTROLS PASSED — the maths checks out, identity reads zero, a blur is seen, a shift is seen.");
}

if (process.argv.includes("--controls")) {
  await runControls();
  process.exit(0);
}
