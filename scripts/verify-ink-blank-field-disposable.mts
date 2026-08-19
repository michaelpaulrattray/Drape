/**
 * THE FIELD, MEASURED AS A DISTRIBUTION — disposable, and it exists because the
 * eight-point probe beside it lied about the arm pair.
 *
 * Sampling the edge MIDPOINTS reads the form where the form crosses the frame
 * edge (the arm enters at the shoulder and leaves at the wrist), so "the field
 * varies" was a reading of skin. This walks the whole border ring and prints
 * the distribution, plus the corner block means, so a non-uniform field is told
 * apart from a limb touching an edge.
 */
import sharp from "sharp";

const BLANKS = [
  ["arm A            ", "output/imagegen/ink-template-arm-single-view-a.png"],
  ["arm B (mirrored) ", "output/imagegen/ink-template-arm-single-view-b-mirrored.png"],
  ["female front     ", "output/imagegen/composite/blank-female-front.png"],
  ["female back      ", "output/imagegen/composite/blank-female-back.png"],
  ["male front       ", "output/imagegen/composite/blank-male-front.png"],
  ["male back        ", "output/imagegen/composite/blank-male-back.png"],
] as const;

async function main(): Promise<void> {
  for (const [label, file] of BLANKS) {
    const image = sharp(file);
    const { width = 0, height = 0 } = await image.metadata();
    const raw = await image.raw().toBuffer();
    const px = (x: number, y: number) => {
      const i = (y * width + x) * 3;
      return [raw[i], raw[i + 1], raw[i + 2]] as const;
    };
    const counts = new Map<string, number>();
    const push = (x: number, y: number) => {
      const key = px(x, y).join(",");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
    for (let y = 1; y < height - 1; y += 1) { push(0, y); push(width - 1, y); }
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const ring = 2 * (width + height) - 4;
    const top = ranked.slice(0, 3).map(([value, n]) => `${value} ×${n} (${(100 * n / ring).toFixed(1)}%)`);
    /* A 24×24 block in each corner — far from any form, so a pure field read. */
    const corner = (x0: number, y0: number) => {
      let sum = 0;
      for (let y = y0; y < y0 + 24; y += 1) for (let x = x0; x < x0 + 24; x += 1) sum += px(x, y)[0];
      return (sum / 576).toFixed(2);
    };
    console.log(
      `${label} ring ${ranked.length} distinct · ${top.join(" · ")}\n` +
      `                   corners(24²  R mean)  TL ${corner(0, 0)}  TR ${corner(width - 24, 0)}  ` +
      `BL ${corner(0, height - 24)}  BR ${corner(width - 24, height - 24)}`,
    );
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
