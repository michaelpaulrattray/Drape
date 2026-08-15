/**
 * THE KILLER QUESTION FOR THE TATTOO STUDIO — can a reader find a forearm?
 * (Ordered by fable-649 §3, approved pre-emptively, before any placement table
 * is designed. House money: ~44 segmenter reads, no credits, no ledger rows,
 * no writes to any table.)
 *
 * # The question changed shape before the first read was bought
 *
 * `V3B_INK_AND_MARKS_DESIGN_NOTE.md` §3 warns that "the body is where this
 * product's segmentation is least exercised" and that "a placement the reader
 * cannot find is a tattoo the panel cannot point at". Sixteen production masters
 * were downloaded and LOOKED AT before anything was asked of a model
 * (`output/placement-vocabulary/frames-sheet.png`), and the warning is not the
 * problem. The problem is one layer earlier:
 *
 *   **There is no forearm in the photograph.**
 *
 * 16 of 16 frames are cropped above the elbow, and 16 of 16 subjects wear the
 * roll prompt's own uniform — `WARDROBE: ... a simple crew-neck tee or plain
 * shirt` (`cohortPhotorealHuman.ts:190`). So below the jaw, the bare skin a
 * casting frame actually contains is: the neck, a sliver of lower upper-arm at
 * the bottom corners, and — on a scoop neckline only — the collarbone.
 *
 * That is not a reader problem and no number of segmenter reads would have found
 * it. It is `castingFrame.ts`'s own door (`OUT OF FRAME — you cannot edit what
 * the photograph does not contain`), which currently holds one row, `waist`.
 *
 * # So this bench asks the two halves separately
 *
 *   A  GEOMETRY, from the frame itself.   Where does the crop line fall, in
 *      head-heights below the chin? Measured off the face mask and the subject
 *      matte, which is the frame-scale-immune form the body bench already uses.
 *      This is what says forearm/elbow/hand/waist are out, as a number rather
 *      than as my eye.
 *   B  THE D-213 TRAP, with ground truth for once. Every previous absent-region
 *      test had to argue about whether the thing was there. Here I have opened
 *      the pictures at full resolution and there IS no forearm — so a mask
 *      coming back for one is the reader ANSWERING rather than FINDING, proven
 *      rather than suspected.
 *
 * # THE BAR, PRE-REGISTERED (written before the first call went out)
 *
 *   POSITIVE CONTROL   `face` and the subject matte must read on 4/4. A word
 *                      that reads nothing on a run where the controls also read
 *                      nothing is a broken harness, not a finding — so if either
 *                      control fails, the whole run is VOID and nothing below it
 *                      is quoted.
 *   IN FRAME, BARE     neck (4/4 by eye).                    Expected FOUND.
 *   IN FRAME, CLOTHED  shoulder, chest (4/4 by eye).         Either answer is
 *                      informative: found = it reads the t-shirt, which is not
 *                      a placement for ink.
 *   IN FRAME, PARTIAL  upper arm — the bare sliver below the sleeve, both
 *                      bottom corners on A/B/D, one on C.    Expected FOUND.
 *   NOT IN FRAME       forearm, elbow, hand, waist, knee.    GROUND TRUTH: none
 *                      of these five is in any of the four photographs.
 *
 *   THE VERDICT ON THE READER: any of the five out-of-frame words returning a
 *   non-empty mask is a confident answer about pixels that do not exist. One hit
 *   is enough to say a bare segmenter read cannot be the source of a placement;
 *   0 of 20 would say the reader refuses honestly and the vocabulary can lean on
 *   it for the placements that ARE in frame.
 *
 *   MY PREDICTION, filed so it can be wrong: forearm comes back with SOMETHING
 *   on most frames, landing on the t-shirt sleeve or the bottom edge, because
 *   these readers answer (D-213). I expect the five out-of-frame words to hit on
 *   more than half of their twenty.
 *
 * # Why `absentIsAnswer: true`
 *
 * It is the one path that turns a failed reading into a confident negative, and
 * that is exactly the path under test. With it on, an empty mask comes back as
 * zero area instead of a throw, so "found nothing" and "found something" are the
 * same shape of answer and are counted the same way.
 *
 *   npx tsx scripts/bench-placement-vocabulary-disposable.mts
 */
import "dotenv/config";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const OUT = "output/placement-vocabulary";
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/run.log`;
if (!existsSync(LOG)) writeFileSync(LOG, "");
function say(line = "") {
  console.log(line);
  appendFileSync(LOG, `${line}\n`);
}

const BUCKET = process.env.R2_PUBLIC_URL;
if (!BUCKET) throw new Error("no R2_PUBLIC_URL");
if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");

const sharp = (await import("sharp")).default;
const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

type Mask = { data: Buffer; width: number; height: number };

/** The four frames, chosen for neckline and sex rather than at random. */
const FRAMES = [
  { name: "A-man-crew", key: "casting-v2/candidates/9b846249-5043-41ea-85d4-1e1508eb008e.png" },
  { name: "B-scoop", key: "casting-v2/candidates/3b7b716a-8ed8-4386-803e-db8c9ffc5c3a.png" },
  { name: "C-crew", key: "casting-v2/candidates/0f3b609e-08a8-4d0c-8fed-722c26a07af3.png" },
  { name: "D-crew", key: "casting-v2/candidates/fce4b507-83a2-495f-80cd-9de7acc5641a.png" },
];

/** What is asked, and what the photographs say about it — recorded before the calls. */
const WORDS = [
  { word: "neck", truth: "IN FRAME, BARE" },
  { word: "shoulder", truth: "IN FRAME, CLOTHED" },
  { word: "chest", truth: "IN FRAME, CLOTHED" },
  { word: "collarbone", truth: "IN FRAME (bare on B only)" },
  { word: "upper arm", truth: "IN FRAME, PARTIAL" },
  { word: "forearm", truth: "NOT IN FRAME" },
  { word: "elbow", truth: "NOT IN FRAME" },
  { word: "hand", truth: "NOT IN FRAME" },
  { word: "waist", truth: "NOT IN FRAME" },
  { word: "knee", truth: "NOT IN FRAME" },
] as const;

const OUT_OF_FRAME = new Set(["forearm", "elbow", "hand", "waist", "knee"]);

/** Where a mask sits and how big it is — nothing clever, all of it checkable. */
function about(mask: Mask): {
  area: number; share: number;
  top: number; bottom: number; cx: number; cy: number;
} | null {
  let area = 0, sx = 0, sy = 0, top = Infinity, bottom = -1;
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[row + x] === 0) continue;
      area += 1; sx += x; sy += y;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (area === 0) return null;
  return {
    area,
    share: (area / (mask.width * mask.height)) * 100,
    top: top / mask.height,
    bottom: bottom / mask.height,
    cx: sx / area / mask.width,
    cy: sy / area / mask.height,
  };
}

/** How much of a mask lies inside another — the containment test. */
function insideShare(mask: Mask, within: Mask): number {
  if (mask.width !== within.width || mask.height !== within.height) return NaN;
  let area = 0, inside = 0;
  for (let i = 0; i < mask.data.length; i += 1) {
    if (mask.data[i] === 0) continue;
    area += 1;
    if (within.data[i] !== 0) inside += 1;
  }
  return area === 0 ? NaN : (inside / area) * 100;
}

say(`\n${"=".repeat(78)}`);
say("THE PLACEMENT VOCABULARY BENCH — can a reader find a forearm?");
say(`WORLD: bucket ${BUCKET}`);
say("GROUND TRUTH, established by opening the pictures at full resolution BEFORE");
say("any call went out (frames-sheet.png, bottom-strip.png): 16 of 16 masters are");
say("cropped ABOVE THE ELBOW, and every subject wears the roll prompt's own tee.");
say("PREDICTION, filed: the five out-of-frame words hit on more than half of 20.");
say("=".repeat(78));

let controlsHeld = 0;
const hits: Record<string, number> = {};
const found: Record<string, number> = {};

for (const frame of FRAMES) {
  const response = await fetch(`${BUCKET}/${frame.key}`);
  if (!response.ok) throw new Error(`${frame.name}: the frame store answered ${response.status}`);
  const image = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(image).metadata();
  say(`\n--- ${frame.name}  ${meta.width}x${meta.height} ---`);

  /* THE CONTROLS FIRST, and the run is void without them. */
  let face: Mask | null = null;
  let subject: Mask | null = null;
  try {
    face = await reader.region({ image, name: "face", absentIsAnswer: false });
  } catch (error) {
    say(`  face          CONTROL FAILED — ${(error as Error).message}`);
  }
  try {
    subject = await reader.subject({ image });
  } catch (error) {
    say(`  subject matte CONTROL FAILED — ${(error as Error).message}`);
  }
  const faceAbout = face ? about(face) : null;
  const subjectAbout = subject ? about(subject) : null;
  if (faceAbout && subjectAbout) controlsHeld += 1;

  if (faceAbout) {
    /* Head height and the crop line, in head-heights below the chin. A face mask's
       bottom IS the chin; its top is the brow line rather than the crown, so the
       head is taller than the mask — quoted as the mask's own height, and the
       conversion is stated rather than smuggled: a whole head is ~1.35 face masks. */
    const faceH = faceAbout.bottom - faceAbout.top;
    const belowChin = (1 - faceAbout.bottom) / faceH;
    say(`  face          top ${(faceAbout.top * 100).toFixed(1)}%  chin ${(faceAbout.bottom * 100).toFixed(1)}%  mask height ${(faceH * 100).toFixed(1)}% of frame`);
    say(`  CROP LINE     ${belowChin.toFixed(2)} face-mask-heights below the chin`);
  }
  if (subjectAbout) {
    say(`  subject       ${subjectAbout.share.toFixed(1)}% of frame, top ${(subjectAbout.top * 100).toFixed(1)}%`);
  }

  for (const { word, truth } of WORDS) {
    let mask: Mask | null = null;
    let failure = "";
    try {
      mask = await reader.region({ image, name: word, absentIsAnswer: true });
    } catch (error) {
      failure = (error as Error).message;
    }
    if (mask === null) {
      say(`  ${word.padEnd(13)} READ FAILED — ${failure}   [${truth}]`);
      continue;
    }
    const shape = about(mask);
    if (shape === null) {
      say(`  ${word.padEnd(13)} nothing found                     [${truth}]`);
      continue;
    }
    found[word] = (found[word] ?? 0) + 1;
    if (OUT_OF_FRAME.has(word)) hits[word] = (hits[word] ?? 0) + 1;
    const contained = subject ? insideShare(mask, subject) : NaN;
    say(
      `  ${word.padEnd(13)} FOUND ${shape.share.toFixed(2)}% of frame · band ${(shape.top * 100).toFixed(0)}–${(shape.bottom * 100).toFixed(0)}%` +
      ` · centre (${(shape.cx * 100).toFixed(0)},${(shape.cy * 100).toFixed(0)})` +
      ` · ${Number.isNaN(contained) ? "containment n/a" : `${contained.toFixed(0)}% inside the subject`}   [${truth}]`,
    );
    /* The mask, saved. A number about a mask is a claim; the drawn mask is the fact. */
    await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
      .png()
      .toFile(`${OUT}/${frame.name}-${word.replace(/ /g, "-")}.png`);
  }
}

say(`\n${"=".repeat(78)}`);
say("THE READING");
say("=".repeat(78));
say(`controls held on ${controlsHeld} of ${FRAMES.length} frames` +
  (controlsHeld === FRAMES.length ? "" : "  — SHORT OF 4/4, this run is VOID"));
say("");
for (const { word, truth } of WORDS) {
  const n = found[word] ?? 0;
  const verdict = OUT_OF_FRAME.has(word)
    ? (n === 0 ? "refused honestly" : `ANSWERED ABOUT PIXELS THAT DO NOT EXIST (${n}/4)`)
    : (n === 0 ? "not found" : "found");
  say(`  ${word.padEnd(13)} ${String(n)}/4  ${verdict.padEnd(46)} [${truth}]`);
}
const trapTotal = Object.values(hits).reduce((sum, n) => sum + n, 0);
say("");
say(`THE D-213 TRAP: ${trapTotal} of ${OUT_OF_FRAME.size * FRAMES.length} reads came back with a mask for a`);
say("region the photographs do not contain.");
say(`Prediction was "more than half of 20" — ${trapTotal > 10 ? "HELD" : "WRONG"}.`);

/* A script ends by ending the process (fable-127): sharp's workers and the
   reader's keep-alive sockets outlive the last line otherwise. */
process.exit(0);
