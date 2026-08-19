/**
 * DOES THE COLOUR TAKE'S WORDS CARRY *WHERE* — the court for the section
 * contract (ordered fable-1079 §2, approved fable-1080 §2/§5).
 *
 * # What is on trial, and what is NOT
 *
 * Not the composer, not the caps, not the fence — those are driven in
 * `hairColourFromReference.test.ts` where they can fail for free. What no unit
 * test can answer is whether a real reader, handed a real head, **puts a place
 * beside every tone it names**.
 *
 * The bar is fable-1079 §2's, and it replaced a weaker one that a wrong answer
 * passed: *"does the reader flatten it to one word"* is cleared by *"copper,
 * blonde and black"*, which names every tone in his frame and describes any
 * head at all. So the question here is **spatial fidelity** — do the sections
 * come back matching the blocks that are actually in the picture, in the places
 * they are actually in.
 *
 * # The arms, and each one's own reason for existing
 *
 *   1  HIS COLOUR SPECIMEN      four blocked tones     the whole ask
 *   2  a plain one-colour head  ONE section            does it invent blocks?
 *   3  the salon illustration   sections, no refusal   fable-1075's routing
 *   4  the golden retriever     presence gate CLOSES   no person, coat everywhere
 *   5  the cyborg               presence gate CLOSES   a head with no head hair
 *
 * **Arm 2 is the one a lazier court would skip**, and it is the arm that can
 * convict this whole design: a contract that DEMANDS a place for every tone is
 * a contract that pressures a reader into finding blocks in a head that has
 * none. If the ordinary brunette comes back as four invented sections, the
 * fence has bought spatial words at the price of honest ones and that is a
 * worse trade than the flat answer it replaced.
 *
 * Arms 4 and 5 re-run through the SHIPPED READER what the probe measured on a
 * bare ask (`probe-hair-class-words-disposable.mts`, 2/2 each). That is not a
 * repetition: the probe proved a model's behaviour, this proves the PRODUCT'S —
 * bench-passes-gate-holds, and the gate is only a gate where it is consulted.
 *
 * # Law 9 governs the verdict
 *
 * Every specimen below was looked at by eye first and the frame's contents are
 * written down here, so the reader's answer is scored against what a person saw
 * rather than against another reader. **No arm passes on the reader's own
 * confidence**; each printed answer is quoted in the report for a human read.
 *
 * # Money
 *
 * Vision reads on the OpenRouter balance, house money, dev only. Two runs per
 * arm, five arms — ten calls, priced at the wire off each call's own reported
 * usage. No credits, nothing written, no database, no bucket.
 *
 *   npx tsx scripts/court-hair-colour-words-disposable.mts
 */
import "dotenv/config";

import { readFile } from "node:fs/promises";

import { withCallCensus } from "../server/castingV2/callCensus";
import { readHairColourFromReference } from "../server/castingV2/hairColourFromReference";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}

const INPUT_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_PER_TOKEN = 15.0 / 1_000_000;

const RUNS = 2;

type Arm = {
  name: string;
  path: string;
  contentType: string;
  /** What a person saw in this frame, before any reader was asked. */
  looked: string;
  /** What this arm is FOR — the thing its result can convict. */
  bar: string;
};

const ARMS: Arm[] = [
  {
    name: "1 — HIS COLOUR SPECIMEN: four blocked tones on one head",
    path: "docs/specs/references/build-two-founder-specimens/"
      + "hair-colour-blocked-sections-copper-platinum-black-silver.png",
    contentType: "image/png",
    looked: "one photograph, one woman; a bright orange-copper fringe panel, a platinum-blonde "
      + "panel beside it, near-black roots and lengths behind, a silver-white section on the far side",
    bar: "MORE THAN ONE SECTION, and each tone paired with a place that matches the frame",
  },
  {
    name: "2 — THE CONTROL: a plain one-colour head (can the contract invent blocks?)",
    path: "output/imagegen/makeup-positive-control-smoky-eye-red-lip-studio-portrait.png",
    contentType: "image/png",
    looked: "near-black hair, one tone, flat to the scalp and pulled back into a low knot",
    bar: "ONE section, or a small number that a person would agree are really there",
  },
  {
    name: "3 — THE DRAWING: a salon illustration (fable-1075 — routes, never refuses)",
    path: "output/imagegen/salon-fashion-illustration-copper-waves-curtain-fringe.png",
    contentType: "image/png",
    looked: "ink and gouache on paper, pencil construction lines showing; long copper waves, "
      + "a curtain fringe",
    bar: "DELIVERS — a colour read off a drawing is honest, and the words road may never refuse it",
  },
  {
    name: "4 — THE RETRIEVER: no person, coat everywhere",
    path: "output/imagegen/golden-retriever-long-wavy-coat-grey-studio-reference.png",
    contentType: "image/png",
    looked: "one dog, head and ruff, long wavy golden coat, plain grey backdrop, nobody in frame",
    bar: "REFUSES with noHairVisible — the presence gate is this road's only door",
  },
  {
    name: "5 — THE CYBORG: bald scalp, full beard, no head hair",
    path: "output/production-three-spend/master.png",
    contentType: "image/png",
    looked: "bald with metal plates across the scalp and jaw; a full salt-and-pepper beard; one red eye",
    bar: "REFUSES with noHairVisible — a beard is not the hair a hair reference means",
  },
];

const before = await readOpenRouterBalance();
console.log(`balance before: ${before.ok ? `$${before.remaining.toFixed(4)}` : before.why}`);

let tokensIn = 0;
let tokensOut = 0;
let tokenCalls = 0;

/* Re-buying five arms to learn one thing is house money spent on tidiness. */
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const RUNNING = only ? ARMS.filter((arm) => arm.name.startsWith(`${only} `)) : ARMS;
if (RUNNING.length === 0) throw new Error(`--only ${only} matched no arm`);

for (const arm of RUNNING) {
  const bytes = await readFile(arm.path);
  console.log(`\n${arm.name}`);
  console.log(`  ${arm.path} — ${bytes.length} bytes`);
  console.log(`  SEEN BY EYE: ${arm.looked}`);
  console.log(`  BAR: ${arm.bar}`);
  for (let run = 1; run <= RUNS; run += 1) {
    /* THE SHIPPED FUNCTION, not a copy of its ask — a court that re-implements
       its subject measures the copy (`pipeline-claim-from-first-step`). */
    const { value: outcome, census } = await withCallCensus(async () =>
      readHairColourFromReference({ bytes, contentType: arm.contentType }));
    tokensIn += census.total.tokensIn;
    tokensOut += census.total.tokensOut;
    tokenCalls += census.total.tokenCalls;
    if (outcome.ok) {
      console.log(`  run ${run}: DELIVERED — "${outcome.sentence}"`);
      console.log(`           sections ${outcome.used.length} used, ${outcome.dropped.length} dropped`);
      for (const section of outcome.used) {
        console.log(`             · ${section.tone}  |  ${section.where}  |  side ${section.side ?? "-"}`);
      }
      for (const section of outcome.dropped) {
        console.log(`             · DROPPED ${section.tone}  |  ${section.where}  |  side ${section.side ?? "-"}`);
      }
    } else {
      console.log(`  run ${run}: REFUSED — ${outcome.refusal.code}: "${outcome.refusal.message}"`);
    }
  }
}

if (tokenCalls === 0) {
  console.log(`\nNO TOKENS REPORTED — a NO-READ, not a zero. Nothing is priced.`);
} else {
  const cost = tokensIn * INPUT_PER_TOKEN + tokensOut * OUTPUT_PER_TOKEN;
  console.log(`\nPRICED AT THE WIRE — ${tokenCalls} call(s) reporting usage`);
  console.log(`  in  ${tokensIn} × $3.00/M  = $${(tokensIn * INPUT_PER_TOKEN).toFixed(6)}`);
  console.log(`  out ${tokensOut} × $15.00/M = $${(tokensOut * OUTPUT_PER_TOKEN).toFixed(6)}`);
  console.log(`  THIS COURT = $${cost.toFixed(6)}  (upstream rate; OpenRouter's margin rides on top)`);
}

const after = await readOpenRouterBalance();
console.log(`\nbalance after: ${after.ok ? `$${after.remaining.toFixed(4)}` : after.why}  (lags — reconciliation only)`);

/* A script ends by ending the process: an open provider socket keeps node alive
   and a court that hangs looks the same as one still reading. */
process.exit(0);
