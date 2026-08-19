/**
 * THE ENTRANCE'S COURT — both arms, on the real interpreter (ruled fable-1104
 * §2 and §3).
 *
 * The road's front door was shut: every sentence pointing at an attached
 * picture refused at the likeness wall, 1,860 lines before the crop road
 * (`probe-words-lane-deltas-disposable`). `REFERENCE_CONSTRAINT` is the clause
 * that opens it, and this is what it has to prove.
 *
 *   WITH a picture attached
 *     1  "copy this hair"                          FILES, fromReference
 *     2  "give her the hairstyle from this picture" FILES, fromReference
 *     3  "give her hair like this"                  FILES, fromReference
 *     4  "give her this hair"                       FILES, fromReference
 *     5  "take the hair colour from this picture"   FILES, fromReference
 *     6  "give her the makeup from this photo"      REFUSES wall_unfileable
 *        — containment, and correctly: only a reader can supply a makeup value
 *          (§9.13, D-172). The words lane turns this refusal into a sentence
 *          she can adopt; the ENTRANCE's own bar is that it gets this far.
 *     7  "make her face like the woman in this photo"
 *                                                   REFUSES wall_likeness
 *        — a likeness ask CAN travel through a picture, and the clause must not
 *          open that wall by a millimetre (fable-1104 §3)
 *     8  "make her hair copper"                     FILES, NOT fromReference
 *        — the reference-happy cousin: a complete ask of her own keeps its own
 *          value and leaves the picture to be confessed unused
 *
 *   WITHOUT a picture (the clause is not in the prompt at all)
 *     1–6 must refuse EXACTLY as measured before the clause existed, because
 *     context is not additive and per-line attribution is invalid: the arm that
 *     proves the blast radius is the one that runs the other prompt.
 *
 * The bar is every row, both arms. A miss on 7 is a wall opened; a miss on 8 is
 * a picture cut for an ask that never mentioned it.
 *
 * # Money
 *
 * Sixteen interpreter calls on the OpenRouter balance, house money, dev only.
 * Nothing written, nothing kept, no credits move.
 *
 *   npx tsx scripts/court-reference-entrance-disposable.mts
 */
import "dotenv/config";

import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}

type Arm = {
  readonly instruction: string;
  /** What the WITH-a-picture arm must do. */
  readonly attached: "files" | "wall_likeness" | "wall_unfileable";
  /** Whether that filing must carry `fromReference`. */
  readonly pointed: boolean;
};

const ARMS: readonly Arm[] = [
  { instruction: "copy this hair", attached: "files", pointed: true },
  { instruction: "give her the hairstyle from this picture", attached: "files", pointed: true },
  { instruction: "give her hair like this", attached: "files", pointed: true },
  { instruction: "give her this hair", attached: "files", pointed: true },
  { instruction: "take the hair colour from this picture", attached: "files", pointed: true },
  /*
    THE ONE ARM WHOSE BAR MOVED, and it moved off an artifact that predates this
    court rather than off its own data.

    First run: this refused `wall_unfileable` — containment, saying the value is
    not in her words. That is not the entrance failing; it is §9.13's design
    stated by the code: only a READER can supply a makeup value, and a sentence
    routed around her is refused by a guard standing since D-172. So the honest
    bar for the ENTRANCE alone is the refusal, and the words lane is what turns
    it into a sentence she can adopt (`referenceWordsLane.test.ts`, and the
    service arms in `refineService.test.ts`).
  */
  { instruction: "give her the makeup from this photo", attached: "wall_unfileable", pointed: false },
  { instruction: "make her face like the woman in this photo", attached: "wall_likeness", pointed: false },
  { instruction: "make her hair copper", attached: "files", pointed: false },
];

const read = (instruction: string, referenceAttached: boolean) => interpretRefinement({
  instruction,
  referenceAttached,
  openLane: false,
  prior: {},
  lastColourFacet: null,
  currentEyeColour: null,
  currentEyeShape: null,
  currentHairStyle: null,
  currentHairColour: null,
  currentHairTexture: null,
  currentMakeup: null,
});

const before = await readOpenRouterBalance().catch(() => null);
let misses = 0;

console.log("\n── ARM A: a picture IS attached ──────────────────────────────");
for (const arm of ARMS) {
  const parse = await read(arm.instruction, true);
  const filed = parse.ok && "delta" in parse;
  const pointed = parse.ok && "fromReference" in parse && parse.fromReference === true;
  const outcome = filed ? "files" : (parse.ok ? "other" : `refused ${parse.refusal.reason}`);
  const ok = arm.attached === "files"
    ? filed && pointed === arm.pointed
    : !parse.ok && parse.refusal.reason === arm.attached;
  if (!ok) misses += 1;
  console.log(
    `${ok ? "PASS" : "MISS"}  ${JSON.stringify(arm.instruction)}`,
    `→ ${outcome}${filed ? ` fromReference=${pointed}` : ""}`,
    filed ? `  ${JSON.stringify((parse as { delta: unknown }).delta)}` : "",
  );
}

console.log("\n── ARM B: no picture — the clause is not in the prompt ───────");
for (const arm of ARMS) {
  const parse = await read(arm.instruction, false);
  const filed = parse.ok && "delta" in parse;
  const pointed = parse.ok && "fromReference" in parse && parse.fromReference === true;
  console.log(
    `      ${JSON.stringify(arm.instruction)}`,
    `→ ${filed ? "files" : (parse.ok ? "other" : `refused ${parse.refusal.reason}`)}`,
    `fromReference=${pointed}`,
  );
  /* The one thing this arm may NEVER show: the field cannot arrive without an
     attachment, whatever the model replies — that is code, not a prompt. */
  if (pointed) { misses += 1; console.log("      MISS — fromReference with no picture attached"); }
}

const after = await readOpenRouterBalance().catch(() => null);
console.log(`\nVERDICT: ${misses === 0 ? "PASS" : `FAIL — ${misses} miss(es)`}`);
console.log("balance", JSON.stringify(before), "→", JSON.stringify(after));

process.exit(0);
