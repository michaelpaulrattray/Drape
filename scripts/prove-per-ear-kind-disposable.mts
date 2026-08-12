/**
 * CAN THE PER-EAR KIND READER FAIL? — the walk's new [A] instrument, driven on
 * two frames whose answers are already known (fable-318 R3, working law 2).
 *
 * Shift 61's walk passed `delivered an earring on BOTH ears` over a dangly
 * cross on one ear and a plain gold hoop on the other, because the counter
 * answers "is something hanging there". The new reading asks whether the thing
 * she TYPED is on each ear, one ear at a time. A verdict from an instrument
 * nobody has watched fail is not a verdict, so both directions are driven here
 * before it grades a paid render.
 *
 *   POSITIVE (must report a MISS)   shift61 step 2 — crosses asked, one ear
 *                                   wearing a plain hoop. Opened at 6× and
 *                                   looked at; the rows agree.
 *   NEGATIVE (must PASS both ears)  shift61 step 1 — gold hoops asked, a
 *                                   matching pair delivered.
 *
 * The same function the walk calls, imported rather than restated. No credits:
 * provider vision calls over frames already on disk. Nothing is written.
 *
 *   npx tsx scripts/prove-per-ear-kind-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import sharp from "sharp";

import { askedObjectOnEachEar } from "./lib/askedObject.mts";

const SPECIMENS = [
  {
    label: "POSITIVE — crosses asked, one ear wearing a plain hoop",
    frame: "output/shift61-fiveask/02-delivered.png",
    asked: "dangly cross earrings",
    want: "exactly one ear not wearing it",
    ok: (readings: Array<{ wearing: boolean }>) => readings.filter((r) => !r.wearing).length === 1,
  },
  {
    label: "NEGATIVE — hoops asked, a matching pair delivered",
    frame: "output/shift61-fiveask/01-delivered.png",
    asked: "gold hoop earrings",
    want: "both ears wearing it",
    ok: (readings: Array<{ wearing: boolean }>) => readings.every((r) => r.wearing),
  },
  {
    /*
      THE ARM THAT PROVES IT CAN GO NEGATIVE ON BOTH SIDES AT ONCE — an object
      plainly not on her, asked of the frame that passes the other two.

      The master would have been the obvious specimen and is the wrong one: her
      ears are under her hair there, so it measures OCCLUSION rather than
      absence, and one side duly came back "visible ear covered by hair". The
      walk never takes this reading on an ear it cannot see — the pixel counter
      unarms that side first — so the gap the master would have probed is
      already closed one block up, and this arm asks the question the reader can
      actually answer.
    */
    label: "BOTH-NEGATIVE — an object plainly not on her, on the frame that passes",
    frame: "output/shift61-fiveask/01-delivered.png",
    asked: "large silver chandelier earrings",
    want: "neither ear wearing it",
    ok: (readings: Array<{ wearing: boolean }>) => readings.every((r) => !r.wearing),
  },
] as const;

let failures = 0;
for (const specimen of SPECIMENS) {
  const bytes = readFileSync(specimen.frame);
  /* The walk hands its own midline in, from the face read it already took. Here
     the frame is split down the middle: these are full-face portraits and the
     question is which HALF each ear is in, not where her nose is to the pixel. */
  const width = (await sharp(bytes).metadata()).width ?? 1024;
  const readings = await askedObjectOnEachEar(bytes, specimen.asked, Math.round(width / 2));
  const passed = specimen.ok(readings as Array<{ wearing: boolean }>);
  if (!passed) failures += 1;
  console.log(`\n${passed ? "OK  " : "FAIL"}  ${specimen.label}`);
  console.log(`      asked "${specimen.asked}" · want ${specimen.want}`);
  for (const reading of readings) {
    console.log(`      ${reading.side}: ${reading.wearing ? "wearing it" : "NOT wearing it"}`
      + ` (absent=${reading.absent ?? "—"}, verified=${reading.verified})`
      + `${reading.read ? "" : " (NO READ)"} — "${reading.saw}"`);
  }
}

console.log(`\n${failures === 0 ? "the instrument can see and can fail" : `${failures} specimen(s) went the wrong way`}`);
process.exit(failures === 0 ? 0 : 1);
