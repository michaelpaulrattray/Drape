/**
 * DISPOSABLE — #1612's hand-over, driven end to end through the REAL judge and
 * the REAL segmenter on his own production frames.
 *
 * # What this measures that nothing else can
 *
 * The fold is driven at the function (`viewFramingHandover.test.ts`, law 3) and
 * the measurement was driven on 43 of his frames by the `frontClose` bound
 * court. **Neither can answer the one question this change actually risks**:
 * the close-up's judge post is two sentences shorter now, and a reading can
 * change when its context does. So this asks a real vision model the NARROWED
 * question about correct close-ups of his, and asks whether the axis still says
 * yes.
 *
 * ⚠ **The BEFORE arm is quoted from the record rather than re-bought**, and that
 * is deliberate: #1611 already measured the old question on these exact frames
 * at 50 `matches` out of 100 on a frame its own spec calls too loose, and
 * re-buying a coin's flip tells nobody anything for ~$1.50 a call. What is
 * unknown is the AFTER.
 *
 * Spends HOUSE money only — OpenRouter text calls with images (~$1.50 each by
 * the campaign ledger's own rate) and fal segmenter reads (~1¢ each). **No
 * customer credits, no database writes, no storage writes.**
 *
 *   npx tsx scripts/_1612-handover-court-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ProviderQueue } from "../server/providers/providerQueue";
import { createOpenRouterTextEngine, DEFAULT_INTERPRETER_MODEL } from "../server/providers/openrouterText";
import { castPackageView, readerFramingQuestion } from "../server/castingV2/castViewPackage";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { createViewConformanceJudge } from "../server/castingV2/viewConformance";

const FAL = process.env.FAL_KEY;
const OR = process.env.OPENROUTER_API_KEY;
if (!FAL) throw new Error("no FAL_KEY in .env");
if (!OR) throw new Error("no OPENROUTER_API_KEY in .env");

/* The frames the earlier slices pulled down and read at the bytes. They live in
   the MAIN tree's output/, which no worktree carries. */
const DIR = "C:/Users/Admin/Drape/output/_1612-frames";
const frame = (asset: string) => ({
  bytes: readFileSync(path.join(DIR, `${asset}.png`)),
  contentType: "image/png" as const,
});

type Fixture = {
  asset: string;
  cast: string;
  /** What a person looking at the picture says — written down before this ran. */
  eye: string;
  /** What the AXIS must say, and the two halves are reached differently. */
  want: "matches" | "differs";
  reads: number;
};

const FIXTURES: readonly Fixture[] = [
  /*
    THE RISK ARM — correct close-ups. The measurement passes these (0.07 and
    0.18 of a face-height of room below the face, against a bound of 0.3), so
    the READING governs, and the reading is now being asked a question two
    sentences shorter than the one it used to be asked. If the narrowing broke
    anything, it breaks here: a correct picture newly marked `Unchecked`.

    345 is the one that matters most — Kai has tusks and a cowl, which is the
    being #1582 was filed about.
  */
  { asset: "306", cast: "53 Jericho", want: "matches", reads: 3, eye: "a chest-up close-up, front-on, chin clear of the bottom edge" },
  { asset: "345", cast: "59 Kai", want: "matches", reads: 3, eye: "a close-up of a tusked face under a cowl, in band at 0.18" },
  /*
    THE FLIP ARM — #1611's own two frames, the specimen this card was filed
    about. The old question read `matches` on 50 of 100 reads; the measurement
    answers them the same way every time (10/10 identical, the part-1 drive).
    One read each is enough BECAUSE the deciding half is deterministic — and the
    reading is printed beside it so the record shows whether the model agreed.
  */
  { asset: "322", cast: "56 Sifr2", want: "differs", reads: 1, eye: "#1611: the whole neck and both shoulders are in the picture" },
  { asset: "371", cast: "63 Pika", want: "differs", reads: 1, eye: "#1611: neck and both shoulders, dreadlocks" },
];

const engine = createOpenRouterTextEngine({
  apiKey: OR,
  model: process.env.SIGN_JUDGE_MODEL || DEFAULT_INTERPRETER_MODEL,
  queue: new ProviderQueue({ name: "handover-court", concurrency: 2, maxQueueDepth: 16 }),
});

const judge = createViewConformanceJudge({
  engine,
  framingReader: createFalRegionReader({ apiKey: FAL }),
});

console.log("=== THE QUESTION THE JUDGE IS NOW ASKED (closeUp)");
console.log(JSON.stringify(readerFramingQuestion("closeUp")));
console.log("\n=== WHAT LEFT IT");
for (const sentence of castPackageView("closeUp").band.restatedInFull ?? []) {
  console.log(JSON.stringify(sentence));
}

let calls = 0;
let wrong = 0;
console.log("\n=== THE AFTER ARM — the real judge, the real segmenter, his frames");
for (const fixture of FIXTURES) {
  /*
    ⚠ THE SAME FRAME IS THE ANCHOR AND THE CANDIDATE, ON PURPOSE AND IT IS A
    CONTROL RATHER THAN A SHORTCUT. This court is about the FRAMING axis; a
    different anchor would put identity into the reading as a variable, and the
    framing question is asked against the SPECIFICATION rather than against
    IMAGE 1, so an identical pair cannot help the model answer it. Identity
    reading `matches` on every row below is therefore the expected and
    uninformative half, and it is printed so a row where it does NOT is visible.
  */
  const picture = frame(fixture.asset);
  for (let read = 1; read <= fixture.reads; read += 1) {
    const started = Date.now();
    const verdict = await judge({ angle: "closeUp", anchor: picture, candidate: picture });
    calls += 1;
    const axis = verdict.axes.angle;
    const right = axis.verdict === fixture.want;
    if (!right) wrong += 1;
    console.log(
      `  ${right ? "AS EXPECTED" : "⚠ NOT EXPECTED"}  asset ${fixture.asset} (${fixture.cast}) `
      + `read ${read}/${fixture.reads}  angle=${axis.verdict} (want ${fixture.want}) `
      + `identity=${verdict.axes.identity.verdict} wardrobe=${verdict.axes.wardrobe.verdict} `
      + `${Math.round((Date.now() - started) / 100) / 10}s`,
    );
    console.log(`      eye:    ${fixture.eye}`);
    console.log(`      note:   ${axis.note}`);
    console.log(`      method: ${verdict.method}`);
  }
}

console.log(`\n=== ${calls} judge calls, ${wrong} row(s) not as expected`);
console.log("spend: house money only — no customer credits, no writes. Read the day's");
console.log("total at machinist-ledger-read.mts for the figure to quote.");
process.exit(wrong === 0 ? 0 : 1);
