/** How thick the arm blank's dark border is, and what the interior field really
 *  is — disposable. The ring probe said "224 distinct values"; this says where
 *  they are, which is the difference between a gradient field and a frame. */
import sharp from "sharp";

async function main(): Promise<void> {
  for (const file of [
    "output/imagegen/ink-template-arm-single-view-a.png",
    "output/imagegen/composite/blank-female-front.png",
  ]) {
    const image = sharp(file);
    const { width = 0, height = 0 } = await image.metadata();
    const raw = await image.raw().toBuffer();
    const at = (x: number, y: number) => raw[(y * width + x) * 3];
    console.log(`\n${file}`);
    /* Walk in from the left edge along a row that is pure field (near the top
       corner, well clear of the form). */
    console.log(`  inward from x=0 at y=40:  ${[0, 1, 2, 3, 4, 5, 6, 8, 12].map((x) => at(x, 40)).join(" ")}`);
    console.log(`  inward from y=0 at x=40:  ${[0, 1, 2, 3, 4, 5, 6, 8, 12].map((y) => at(40, y)).join(" ")}`);
    /* The interior field: a corner block inset by 8px, as a distribution. */
    const counts = new Map<number, number>();
    for (let y = 8; y < 208; y += 1) for (let x = 8; x < 208; x += 1) {
      counts.set(at(x, y), (counts.get(at(x, y)) ?? 0) + 1);
    }
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    console.log(`  interior 200² block at (8,8): ${ranked.length} distinct · ` +
      ranked.slice(0, 4).map(([v, n]) => `${v} ×${n}`).join(" · "));
  }
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
