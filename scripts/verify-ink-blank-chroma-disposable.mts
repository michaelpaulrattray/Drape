/** How far from neutral grey each blank actually is — disposable, reported
 *  rather than asserted. "Greyscale" is the founder's word for the LOOK; this
 *  says whether the bytes are literally neutral, so a later reader is not
 *  surprised by a plate that is 16% chromatic at a spread of one level. */
import sharp from "sharp";

const BLANKS = [
  ["arm A treated ", "output/imagegen/composite/blank-arm-a.png"],
  ["arm A source  ", "output/imagegen/ink-template-arm-single-view-a.png"],
  ["female front  ", "output/imagegen/composite/blank-female-front.png"],
  ["male front    ", "output/imagegen/composite/blank-male-front.png"],
] as const;

async function main(): Promise<void> {
  for (const [label, file] of BLANKS) {
    const data = await sharp(file).raw().toBuffer();
    const spread = new Map<number, number>();
    let max = 0;
    for (let i = 0; i < data.length; i += 3) {
      const d = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      spread.set(d, (spread.get(d) ?? 0) + 1);
      max = Math.max(max, d);
    }
    const total = data.length / 3;
    const ranked = Array.from(spread.entries()).sort((a, b) => a[0] - b[0]).slice(0, 5);
    console.log(`${label} max R-B spread ${max} · ` +
      ranked.map(([d, n]) => `${d}:${(100 * n / total).toFixed(1)}%`).join(" "));
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
