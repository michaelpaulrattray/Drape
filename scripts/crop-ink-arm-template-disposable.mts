/**
 * THE ONE MECHANICAL STEP BETWEEN THE GENERATED ARM SHEET AND THE SHIPPED ONE.
 *
 * The good generation ran a long way past the elbow, down most of a forearm —
 * and `forearm` is not in the placement vocabulary (`neck`, `upper arm`,
 * `upper chest`), so that stretch is canvas the product cannot name. Two
 * attempts to GENERATE a tighter frame were both worse (one lost the matte
 * finish, one lost the rotation legibility the redo exists to buy), so the
 * shipped file is the good frame with its lower edge cut and re-faded here.
 *
 * It manufactures no anatomy. It removes canvas and dissolves the new edge to
 * the frame's OWN background colour, sampled from its own corner — which is
 * what the generator's own terminations do. Declared in the prompt file beside
 * the asset, in the commit, and on the founder's card.
 *
 * This exists so the asset is REPRODUCIBLE rather than recreated-and-drifting:
 * re-running it writes the shipped bytes.
 */
import sharp from "sharp";

const SRC = "docs/specs/references/templates/source/ink-template-arm-nearwhite-generated.png";
const OUT = "docs/specs/references/templates/ink-template-arm-nearwhite.png";

const BG = { r: 246, g: 245, b: 243 }; // the source's own corner; flat, no gradient
const CUT = 800;            // new bottom edge, in source rows
const FADE = 110;           // rows of linear dissolve above the cut
const BOTTOM_MARGIN = 96;   // near-white below, so the fade has somewhere to land

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const W = info.width, C = info.channels;
const H = CUT + BOTTOM_MARGIN;
const buf = Buffer.alloc(W * H * 3);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    if (y >= CUT) { buf[o] = BG.r; buf[o + 1] = BG.g; buf[o + 2] = BG.b; continue; }
    const i = (y * W + x) * C;
    const t = y > CUT - FADE ? (y - (CUT - FADE)) / FADE : 0;
    buf[o] = Math.round(data[i] * (1 - t) + BG.r * t);
    buf[o + 1] = Math.round(data[i + 1] * (1 - t) + BG.g * t);
    buf[o + 2] = Math.round(data[i + 2] * (1 - t) + BG.b * t);
  }
}

await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT);
console.log(`wrote ${OUT} ${W}x${H}  cut=${CUT} fade=${FADE}`);

process.exit(0);
