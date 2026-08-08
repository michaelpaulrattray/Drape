/**
 * WHERE DO THE FRECKLES GO? — the five-minute layer check.
 *
 * The self-drive walk delivered and charged four renders in a row on which the
 * verification reader said, in its own words, *"skin appears smooth, no visible
 * freckles or texture"* — and the pictures agree. `marks` is advisory, so a read
 * miss on it can never refuse, which is why four false passes reached the ledger
 * before anything noticed.
 *
 * # The hypothesis worth testing FIRST, because it indicts our own layer
 *
 * A freckle is a **low-amplitude skin-tone delta on her own surface**. That is
 * also a near-perfect description of the painter-skin veil that `suppressWash`
 * and the strand-projection/novelty harvest gate were built to REFUSE — the pale
 * film that showed through a fringe's gaps and had to be reverted to her.
 *
 * If those gates cannot tell an intentional small skin change from the leak
 * class they were written for, then **freckles are the veil, asked for**, and the
 * adapter is deleting the edit it was told to make. That is the standing
 * diagnostic prior — suspect the adapter before the painter — and it has been
 * right three times in one week.
 *
 * # One look decides it
 *
 *   painted HAS freckles, composed does NOT  → the gate is the defect, and the
 *                                              marks class needs a carve-out
 *   neither has them                         → the painter or the prose, and the
 *                                              adapter is exonerated
 *
 * The painted frame is saved either way, because production stores only the
 * composite and that is precisely why two earlier specimens were undiagnosable
 * after the fact.
 *
 * # THE SECOND CASE: a CARRIED marks fact (2026-08-09)
 *
 * Run-15 asked for freckles at step 1 and got them; the reader then read her
 * skin as clear on steps 3 and 4 and freckled again on step 5, five readings
 * each, at every lens. The prompts are not the difference — every step carried
 * the freckle caption verbatim, read off the stored rows. What differs is how
 * much else the painter was redrawing.
 *
 * So the bench takes a `--case`. `written` is the original: the bare "give her
 * freckles" ask, the positive control. `carried` is run-15's step 3, its own
 * stored prompt sent verbatim, with the facets production passed — the same
 * measurement, on the shape that lost them.
 *
 * The hypothesis it can kill: `baselineDelta` in the harvest gate is the median
 * drift of THIS render over unclaimed ground, so a render that repaints more of
 * the frame raises its own bar, and a freckle is a few levels. If that is it,
 * the painter frecked her in both cases and only the carried composite threw it
 * away.
 *
 *   npx tsx scripts/calibration/freckles-layers.mts            # re-composite stored paint
 *   npx tsx scripts/calibration/freckles-layers.mts --repaint  # take a fresh one
 *   npx tsx scripts/calibration/freckles-layers.mts --case carried --repaint
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { facetOfSubject } from "../../server/castingV2/refineFacets";
import { amplitudeFor } from "../../server/castingV2/changeAmplitude";

const caseFlag = process.argv.indexOf("--case");
const CASE = caseFlag > -1 ? String(process.argv[caseFlag + 1]) : "written";

/**
 * The two shapes, each with the master it belongs to and the facets production
 * passed the harvest for it.
 *
 * `carried`'s prompt is run-15 v146's own stored `internalPrompt.prompt`, sent
 * verbatim rather than rebuilt: a fixture that re-composes the prompt is
 * measuring a prompt composer, and the composer is not what is on trial.
 */
const CASES: Record<string, {
  out: string; master: string; described: string; prompt: string; facets: string[];
}> = {
  written: {
    out: "output/masked/freckles",
    master: "output/masked/freckles/master.png",
    described: "visibly textured, freckles",
    facets: ["marks"],
    prompt: "Edit this photograph of this exact person, changing ONLY what is listed below. "
      + "Give her freckles: a natural scattering of small brown freckles across the nose, "
      + "cheeks and upper face, denser over the bridge of the nose and thinning outward — "
      + "the same person with freckled skin, not a different face and not makeup.",
  },
  /*
    THE POSITIVE CONTROL, on HER master: run-15's step 1, the render that
    delivered. Without it, "the carried shape does not paint" is a claim about
    one prompt on one face with nothing to compare it to.
  */
  "written-run15": {
    out: "output/masked/freckles-written15",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks"],
    prompt: readFileSync("output/marks-court/run15-step1-prompt.txt", "utf8").trim(),
  },
  /*
    THE DISCRIMINATOR. Step 3's prompt with ONE clause removed — the caption
    interpolation `— rendered exactly as this: Light scattering of small
    freckles … faint and sparse against fair skin`. Everything else, including
    the makeup ask and the facet set, is byte-identical to what production sent.
    If this paints and `carried` does not, the memory the product built to
    preserve her density is the thing suppressing it.
  */
  "carried-nocaption": {
    out: "output/masked/freckles-nocaption",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks", "makeup"],
    prompt: readFileSync("output/marks-court/run15-step3-nocaption-prompt.txt", "utf8").trim(),
  },
  /*
    THE SECOND DISCRIMINATOR, and the one the prose points at. Step 3's prompt
    with ONE sentence removed — `Everything else about the face stays bare.`,
    the makeup lane's own inline preservation, which stands immediately before
    `MARKS: freckles` and tells the painter to leave her face bare. The
    preservation TAIL is checked for exactly this contradiction; an inline
    sentence inside another lane's clause is not.
  */
  "carried-nobare": {
    out: "output/masked/freckles-nobare",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks", "makeup"],
    prompt: readFileSync("output/marks-court/run15-step3-nobare-prompt.txt", "utf8").trim(),
  },
  /*
    THE FOURTH CELL. Step 3's prompt with the MAKEUP ASK removed — the carried
    MARKS clause, caption and all, standing alone. It completes the square:
    clause form × second ask. If this paints, the form is innocent and the
    second ask is the thing that suppresses her freckles.
  */
  "carried-alone": {
    out: "output/masked/freckles-alone",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks"],
    prompt: readFileSync("output/marks-court/run15-step3-nomakeup-prompt.txt", "utf8").trim(),
  },
  /*
    THE CLAUSE, NARROWED TO ITS INTENSITY WORDS. The carried prompt with
    ", faint and sparse against fair skin" removed and nothing else changed.
    The caption is honest about her freckles; the question is whether the
    painter obliges it past the point of visibility.
  */
  "carried-nointensity": {
    out: "output/masked/freckles-nointensity",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks", "makeup"],
    prompt: readFileSync("output/marks-court/run15-step3-nointensity-prompt.txt", "utf8").trim(),
  },
  /*
    AND THE SAME NARROWING WITHOUT THE SECOND ASK — the arm that isolates the
    intensity words alone, against `carried-alone`'s 0/3.
  */
  "carried-alone-nointensity": {
    out: "output/masked/freckles-alone-nointensity",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks"],
    prompt: readFileSync("output/marks-court/run15-step3-alone-nointensity-prompt.txt", "utf8").trim(),
  },
  /*
    THE OTHER CANDIDATE: the caption kept WHOLE, intensity words and all, with
    the framing turned back into an instruction. `rendered exactly as this:` is
    a description of a photograph that already exists; `draw them onto her skin,
    matching what she already has:` asks for the same thing and says to make it.
    If the words are innocent and the framing is the site, this delivers where
    `carried-alone` does not.
  */
  "carried-alone-imperative": {
    out: "output/masked/freckles-alone-imperative",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks"],
    prompt: readFileSync("output/marks-court/run15-step3-alone-imperative-prompt.txt", "utf8").trim(),
  },
  /*
    THE LAST DIFFERENCE. A mechanical sentence-diff of the delivering prompt
    against the failing one leaves exactly two: the caption interpolation, and
    the tail's "the same makeup" (absent because makeup was step 3's edit).
    This arm removes the caption entirely, so its MARKS clause is byte-identical
    to the one that delivers 6 of 8 — and the tail is the only thing left.
  */
  "carried-alone-nocaption": {
    out: "output/masked/freckles-alone-nocaption",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    facets: ["marks"],
    prompt: readFileSync("output/marks-court/run15-step3-alone-nocaption-prompt.txt", "utf8").trim(),
  },
  carried: {
    out: "output/masked/freckles-carried",
    master: "output/marks-court/MASTER-run15.png",
    described: "visibly textured, freckles",
    /* marks AND makeup — `facetsAnsweredBy(composed)` for her step 3. */
    facets: ["marks", "makeup"],
    prompt: readFileSync("output/marks-court/run15-step3-prompt.txt", "utf8").trim(),
  },
};

const chosen = CASES[CASE];
if (!chosen) throw new Error(`no case "${CASE}" — the cases are ${Object.keys(CASES).join(", ")}`);

/*
  A ROUND TAG, because one paint is not a rate.

  This defect is a flicker: the same prompt delivered her freckles at step 1
  and not at step 3, and a single render per arm cannot tell a flicker from a
  constant. Each round writes its own directory, so round 1's frames are still
  on disk to be read beside round 2's rather than overwritten by them.
*/
const tagFlag = process.argv.indexOf("--tag");
const TAG = tagFlag > -1 ? String(process.argv[tagFlag + 1]) : "";
const OUT = TAG ? `${chosen.out}-${TAG}` : chosen.out;
mkdirSync(OUT, { recursive: true });

/* The walk candidate's own master — the face the charged renders were made
   from, so this is her defect and not a lookalike's. */
const master = readFileSync(chosen.master);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;
console.log(`master ${W}x${H} — the walk candidate, clear skin\n`);

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const DESCRIBED = chosen.described;
const PROMPT = chosen.prompt;
console.log(`case "${CASE}" — facets [${chosen.facets.join(", ")}]
`);

const repaint = process.argv.includes("--repaint");
let painted: { bytes: Buffer; contentType: string };
if (repaint || !existsSync(`${OUT}/painted.png`)) {
  const began = Date.now();
  const fresh = await engine.edit({
    prompt: PROMPT,
    references: [{ bytes: master, contentType: "image/png" }],
    width: W,
    height: H,
  });
  writeFileSync(`${OUT}/painted.png`, fresh.bytes);
  painted = { bytes: fresh.bytes, contentType: fresh.contentType };
  console.log(`painted in ${((Date.now() - began) / 1000).toFixed(1)}s`);
} else {
  painted = { bytes: readFileSync(`${OUT}/painted.png`), contentType: "image/png" };
  console.log("re-composited the STORED paint — the painter is held still (--repaint for a fresh one)");
}

const composed = await harvestRefinement({
  master: { bytes: master, contentType: "image/png" },
  painted: { bytes: painted.bytes, contentType: painted.contentType },
  facets: chosen.facets.map((subject) => facetOfSubject(subject as Parameters<typeof facetOfSubject>[0])),
  reader,
  userId: 1,
  described: DESCRIBED,
  /* The adapter's OWN masks, so this fixture cannot drift from the adapter it
     is accusing — a rebuilt harness would be measuring a different thing. */
  explain: true,
});
writeFileSync(`${OUT}/composed.png`, composed.bytes);
console.log("composed through the product's own adapter\n");

for (const [name, mask] of Object.entries(composed.explain ?? {})) {
  writeFileSync(`${OUT}/mask-${name}.png`, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  let sum = 0;
  for (let i = 0; i < mask.data.length; i += 1) sum += mask.data[i];
  console.log(`  ${name.padEnd(10)} ${((sum / (mask.data.length * 255)) * 100).toFixed(2)}% of frame, alpha-weighted`);
}
console.log();

/*
  THE MEASUREMENT HAS TO BE LOW-AMPLITUDE, WHICH IS THE WHOLE POINT.

  Every band table in this program has counted pixels moving more than 25
  levels, because every defect so far was a garment, a haircut or a pair of
  glasses. A freckle is a handful of pixels a few levels darker than the cheek
  around it — measured at 25 it does not exist, and the instrument would report
  "the painter did nothing" for a face covered in them.

  So this counts at several thresholds, and the low ones are the ones that
  answer the question. D-232: measure the defect where the change is, at the
  amplitude the change actually has.
*/
const raw = async (bytes: Buffer) =>
  sharp(bytes).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
const A = await raw(master);

/* Her face skin, from the MASTER — the crop never comes from the frame under
   test, or the measurement wanders to where the answer is convenient. */
const skin = await reader.region({ image: master, name: "face skin" });
let skinPx = 0;
for (let i = 0; i < skin.data.length; i += 1) if (skin.data[i] > 127) skinPx += 1;
console.log(`her face skin: ${skinPx.toLocaleString()} px (${((skinPx / (W * H)) * 100).toFixed(1)}% of frame)\n`);

const THRESHOLDS = [2, 4, 8, 16, 25];
console.log("pixels of HER FACE SKIN moved, by amplitude");
console.log(`  threshold   ${THRESHOLDS.map((t) => `>${t}`.padStart(9)).join("")}`);
const moved: Record<string, number[]> = {};
for (const [label, bytes] of [["painted", painted.bytes], ["composed", composed.bytes]] as const) {
  const B = await raw(bytes);
  const counts = THRESHOLDS.map(() => 0);
  for (let p = 0; p < W * H; p += 1) {
    if (skin.data[p] <= 127) continue;
    const i = p * 3;
    const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
    for (let t = 0; t < THRESHOLDS.length; t += 1) if (d > THRESHOLDS[t]) counts[t] += 1;
  }
  moved[label] = counts;
  console.log(`  ${label.padEnd(11)} ${counts.map((c) => `${((c / skinPx) * 100).toFixed(1)}%`.padStart(9)).join("")}`);
}

/*
  THE VERDICT, stated by the arithmetic rather than by me.

  The question is whether the composite KEPT what the painter put on her skin.
  At the amplitude a freckle actually has, a composite that survived the gates
  holds most of the painter's change; one the gates ate holds almost none.
*/
const KEPT_AT = 1; /* index of the >4 column — freckle amplitude */
const paintedLow = moved.painted[KEPT_AT];
const composedLow = moved.composed[KEPT_AT];
const kept = paintedLow === 0 ? 0 : (composedLow / paintedLow) * 100;
console.log(
  `\nat freckle amplitude (>${THRESHOLDS[KEPT_AT]} levels): painter changed `
  + `${paintedLow.toLocaleString()} skin px, the composite kept ${composedLow.toLocaleString()} `
  + `(${kept.toFixed(1)}%)`,
);
console.log(
  paintedLow < skinPx * 0.02
    ? "\n→ THE PAINTER DID NOT FRECKLE HER. The adapter is exonerated; this is prose or engine."
    : kept < 25
      ? "\n→ THE PAINTER FRECKLED HER AND THE COMPOSITE THREW IT AWAY. Freckles are the veil, asked for."
      : "\n→ The composite kept the painter's work. Look at the pictures — the defect is elsewhere.",
);

/* And look at it, because no table can tell a freckle from a blemish. */
const cells = await Promise.all(
  [master, painted.bytes, composed.bytes].map((b) =>
    sharp(b).extract({
      /* Her face, from the master's own geometry — nose and cheeks at 100%. */
      left: Math.round(W * 0.28), top: Math.round(H * 0.28),
      width: Math.round(W * 0.44), height: Math.round(H * 0.26),
    }).png().toBuffer()),
);
const cellMeta = await sharp(cells[0]).metadata();
await sharp({
  create: {
    width: cellMeta.width! * 3 + 24, height: cellMeta.height!,
    channels: 3, background: "#0A0A0A",
  },
})
  .composite(cells.map((input, index) => ({ input, left: index * (cellMeta.width! + 12), top: 0 })))
  .png()
  .toBuffer()
  .then((buffer) => writeFileSync(`${OUT}/FACES.png`, buffer));
console.log(`\nmaster / painted / composed at 100% → ${OUT}/FACES.png`);
