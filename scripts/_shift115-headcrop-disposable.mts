/**
 * Crops the top 26px of each section-1 capture (foreman-115).
 *
 * The pixel control reported section 1 differing between branch and main at
 * 5.704% — and reported the SAME tree differing at 5.651% on one pair and
 * 0.000% on two others. A number that appears in both populations settles
 * nothing, so the row goes in front of eyes (law 9).
 */
import sharp from "sharp";

const DIR = "output/_shift115-evidence";
const TAGS = ["stable-branch-a", "stable-branch-b", "nodock-branch", "nodock-main", "stable-main"];

async function main(): Promise<void> {
  for (const tag of TAGS) {
    await sharp(`${DIR}/${tag}-sec1.png`)
      .extract({ left: 0, top: 0, width: 1176, height: 26 })
      .toFile(`${DIR}/head-${tag}.png`);
    console.log("wrote", `head-${tag}.png`);
  }
}

await main();
process.exit(0);
