/**
 * THE GAUNTLET — the harvest gate on all three canonical cases, both modes.
 *
 * Global scope was approved because the defect is global: the blob's OUTSIDE
 * became a hem, its INSIDE becomes a veil, and the afro's edge-gaps leak
 * painter-wall by the identical mechanism. The gate ships nowhere until all
 * three pass together.
 *
 *   npx tsx scripts/calibration/gauntlet.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dilateMask, expandUntilClear, harvestMatteFrom, placeDestinationZone, subtractMask, unionMasks } from "../../server/castingV2/maskGeometry";
import { adoptInteraction, compositeMasked, differenceMatte, harvestGate, outsideMaskUnchanged, readRaster, writePng, type Mask, type Raster } from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3, toMask } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const OUT = "output/masked/gauntlet";
mkdirSync(OUT, { recursive: true });

const CASES = [
  { name: "fringe",    master: "output/masked/specimens/wire-02.png", raw: "output/masked/fringe-fixture/fringe-raw.png",    crop: { left: 200, top: 150, width: 624, height: 420 }, zone: "grown" as const, passes: 1 },
  { name: "hair-down", master: "output/masked/specimens/wire-02.png", raw: "output/masked/fringe-fixture/hair-down-raw.png", crop: { left: 0, top: 980, width: 1024, height: 556 }, zone: "grown" as const, passes: 11 },
  { name: "afro",      master: "output/masked/specimens/wire-08.png", raw: "output/masked/max-delta/grow-raw.png",           crop: { left: 560, top: 100, width: 464, height: 620 }, zone: "afro" as const, passes: 0 },
];

const report: any[] = [];
for (const s of CASES) {
  console.log(`\n=== ${s.name} ===`);
  const masterBytes = readFileSync(s.master);
  const master: Raster = await readRaster(masterBytes);
  const patchBytes = await sharp(readFileSync(s.raw)).resize(master.width, master.height, {fit:"fill"}).png().toBuffer();
  const patch: Raster = await readRaster(patchBytes);
  const hair = await sam3(masterBytes,"hair");
  let zone: Mask;
  if (s.zone === "afro") {
    const face = await sam3(masterBytes,"face skin"); const l = await sam3(masterBytes,"left ear"); const r = await sam3(masterBytes,"right ear");
    const ew = await sam3(masterBytes,"eyeglasses"); const le = await sam3(masterBytes,"eyeglass lenses");
    zone = await placeDestinationZone({ region: unionMasks(hair.all, await toMask(readFileSync("output/masked/max-delta/aligned-afro-zone.png"))), subject: await birefnetMatte(masterBytes), reach:24, skinMargin:8, exclude: unionMasks(face.all,l.all,r.all,subtractMask(ew.all,le.all)) });
  } else { zone = hair.all; for (let p=0;p<s.passes;p++) zone = await dilateMask(zone,48); }

  const patchSubject = await birefnetMatte(patchBytes);
  const patchHair = await sam3(patchBytes,"hair");
  const tapered = await harvestMatteFrom({content:patchHair.all,matte:patchSubject,taperPx:8});
  const dm = differenceMatte({ master, patch, confirmed: tapered, reachPx: 40 });
  const withStrands: Mask = { data: Buffer.from(tapered.data.map((v,i)=>Math.max(v,dm.alpha.data[i]))), width:master.width, height:master.height };
  const painted: Mask = { data: Buffer.alloc(master.width*master.height,0), width:master.width, height:master.height };
  const far: number[] = [];
  for (let p=0;p<painted.data.length;p++){
    const at=p*3; const d=(Math.abs(patch.data[at]-master.data[at])+Math.abs(patch.data[at+1]-master.data[at+1])+Math.abs(patch.data[at+2]-master.data[at+2]))/3;
    if (d>25) painted.data[p]=255;
    if (tapered.data[p]===0 && p%37===0) far.push(d);
  }
  far.sort((a,b)=>a-b); const baselineDelta = far[Math.floor(far.length/2)] ?? 0;

  const cells: Buffer[] = [await sharp(masterBytes).extract(s.crop).png().toBuffer()];
  for (const [mode, base] of [["C",tapered],["D",withStrands]] as const) {
    for (const gated of [false,true]) {
      const alpha0 = gated ? harvestGate({ master, patch, alpha: base, strandColour: dm.strandColour, baselineDelta }).alpha : base;
      const grown = await expandUntilClear({ painted, zone, stepPx:48, effective: alpha0, maxCoverage:0.6 });
      const ad = adoptInteraction({ master, patch, harvest: alpha0, bandPx:14, mode:"shadow" });
      const c = await compositeMasked({ master, patch: ad.patch, mask: grown.zone, edgeMatte: ad.alpha, featherRadius:4 });
      const label = `${mode}${gated?"-gated":""}`;
      const file = `${OUT}/${s.name}-${label}.png`;
      writeFileSync(file, await writePng(c.composite));
      cells.push(await sharp(file).extract(s.crop).png().toBuffer());
      const outside = outsideMaskUnchanged(master, c.composite, c.applied);
      const diff = await differenceView(masterBytes, readFileSync(file), { gain: 6 });
      writeFileSync(`${OUT}/DIFF-${s.name}-${label}.png`, diff.panel);
      /* Non-strand claims still standing: the veil, counted. */
      let veil = 0;
      for (let p=0;p<c.applied.data.length;p++){
        if (c.applied.data[p]===0 || hair.all.data[p]>128) continue;
        const at=p*3; const d=(Math.abs(patch.data[at]-master.data[at])+Math.abs(patch.data[at+1]-master.data[at+1])+Math.abs(patch.data[at+2]-master.data[at+2]))/3;
        if (d < Math.max(2, baselineDelta*2)) veil++;
      }
      console.log(`  ${label.padEnd(8)} veil ${String(veil).padStart(6)}   frame ${(diff.changedShare*100).toFixed(2)}%   byte-identity outside ${outside.identical}`);
      report.push({ case:s.name, mode:label, veil, frameMoved: diff.changedShare, outsideIdentical: outside.identical });
    }
  }
  await sharp({ create:{ width:s.crop.width, height:s.crop.height*cells.length+8*(cells.length-1), channels:3, background:"#0A0A0A" } })
    .composite(cells.map((input,i)=>({input,left:0,top:i*(s.crop.height+8)}))).png().toFile(`${OUT}/GAUNTLET-${s.name}.png`);
  console.log(`  GAUNTLET-${s.name}.png — master / C / C-gated / D / D-gated at 100%`);
}
writeFileSync(`${OUT}/results.json`, `${JSON.stringify(report,null,2)}\n`);
