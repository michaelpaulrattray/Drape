/**
 * WASH SUPPRESSION, AND THE THING IT MUST NOT COST.
 *
 * Two numbers decide this, and the second is the one that makes it honest:
 *
 *   VEIL     low-alpha claims on her open forehead — the founder's film.
 *   FRINGE   strand pixels actually delivered. D's gain over C is real and
 *            visible, and a suppression that buys a clean forehead by throwing
 *            the fringe away has solved nothing.
 *
 * The founder's stated ideal is concrete: D's fringe density over C's untouched
 * forehead tone.
 *
 *   npx tsx scripts/calibration/wash-suppression.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dilateMask, harvestMatteFrom } from "../../server/castingV2/maskGeometry";
import { adoptInteraction, compositeMasked, differenceMatte, readRaster, suppressWash, writePng, type Mask, type Raster } from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3 } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const OUT = "output/masked/wash";
mkdirSync(OUT, { recursive: true });
const masterBytes = readFileSync("output/masked/specimens/wire-02.png");
const master: Raster = await readRaster(masterBytes);
const patchBytes = await sharp(readFileSync("output/masked/fringe-fixture/fringe-raw.png")).resize(master.width, master.height, {fit:"fill"}).png().toBuffer();
const patch: Raster = await readRaster(patchBytes);

const hair = await sam3(masterBytes,"hair");
const faceSkin = await sam3(masterBytes,"face skin");
const eyewear = await sam3(masterBytes,"eyeglasses");
const patchSubject = await birefnetMatte(patchBytes);
const patchHair = await sam3(patchBytes,"hair");
let brow = master.height;
for (let p=0;p<eyewear.all.data.length;p++){ if(!eyewear.all.data[p]) continue; const y=Math.floor(p/master.width); if(y<brow) brow=y; }
/*
  WHERE A WASH IS A DEFECT — and NOT from the face-skin mask, which is what hid
  this defect from its own measurement.

  SAM 3's "face skin" begins at row 316. The veil is dense from row 105: more
  than half of it sat ABOVE the mask I was measuring inside, so the first
  instrument reported 179 lightened pixels where the frame actually carries
  30,093. Fourth boundary this session taken from something other than the
  artifact — a segmenter's opinion standing in for "where the defect is".

  So the territory is derived by subtraction instead: everything that is NOT
  already her hair, above the brows. A faint claim over existing hair is ordinary
  blending; a faint claim over anything else, with no strand casting it, is the
  wash.
*/
const notHair: Mask = { data: Buffer.from(master.data.length ? hair.all.data.map((v,i)=> (v>128 || Math.floor(i/master.width)>=brow) ? 0 : 255) : []), width:master.width, height:master.height };
const forehead: Mask = notHair;
const zone = await dilateMask(hair.all,48);
const tapered = await harvestMatteFrom({content:patchHair.all,matte:patchSubject,taperPx:8});
const strands = differenceMatte({master,patch,confirmed:tapered,reachPx:40});
const withStrands: Mask = { data: Buffer.from(tapered.data.map((v,i)=>Math.max(v,strands.alpha.data[i]))), width:master.width, height:master.height };

const rows: any[] = [];
for (const [mode, harvest] of [["C",tapered],["D",withStrands]] as const) {
  for (const gated of [false,true]) {
    const ad = adoptInteraction({master,patch,harvest,bandPx:14,mode:"shadow"});
    const alpha = gated ? suppressWash({ alpha: ad.alpha, where: forehead }).alpha : ad.alpha;
    const c = await compositeMasked({master,patch:ad.patch,mask:zone,edgeMatte:alpha,featherRadius:4});
    const label = `${mode}${gated?"-gated":""}`;
    writeFileSync(`${OUT}/fringe-${label}.png`, await writePng(c.composite));
    let veil=0, fringe=0;
    for (let p=0;p<forehead.data.length;p++){
      const a = c.applied.data[p];
      if (a===0) continue;
      if (forehead.data[p] && a<128) veil++;
      if (a>=128) fringe++;
    }
    console.log(`${label.padEnd(8)} veil (faint on open skin) ${String(veil).padStart(6)}   fringe delivered ${String(fringe).padStart(7)} px`);
    rows.push({ label, veil, fringe });
  }
}
const gainKept = rows.find(r=>r.label==="D-gated")!.fringe - rows.find(r=>r.label==="C-gated")!.fringe;
console.log(`\nD's fringe gain over C, after gating: +${gainKept.toLocaleString()} px  (before gating: +${(rows[2].fringe - rows[0].fringe).toLocaleString()})`);
/* Full-extent crops, frame bottom = crop bottom, with the diff beside each. */
const box = { left: 200, top: 150, width: 624, height: 420 };
const cells: Buffer[] = [await sharp(masterBytes).extract(box).png().toBuffer()];
for (const label of ["C","C-gated","D","D-gated"]) cells.push(await sharp(readFileSync(`${OUT}/fringe-${label}.png`)).extract(box).png().toBuffer());
await sharp({ create:{ width: box.width, height: box.height*cells.length+8*(cells.length-1), channels:3, background:"#0A0A0A" } })
  .composite(cells.map((input,i)=>({input,left:0,top:i*(box.height+8)}))).png().toFile(`${OUT}/WASH-fringe.png`);
console.log("wrote WASH-fringe.png — master / C / C-gated / D / D-gated at 100%");
writeFileSync(`${OUT}/results.json`, `${JSON.stringify(rows,null,2)}\n`);
