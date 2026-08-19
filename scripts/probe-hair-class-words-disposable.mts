/**
 * WHAT DOES A HAIR READER REACH FOR WHEN THERE IS NO HAIR — the probe that has
 * to run BEFORE hair's class vocabulary can be declared (fable-1071 §5: *"buy
 * its vocabulary with specimens in both directions the way makeup's was bought;
 * do not invent the list"*).
 *
 * # Why this runs first, and why it is not the court
 *
 * `referenceClassGate` declares makeup's out-of-class words as MEASURED — every
 * member is a thing that reader was seen to say, or the direct neighbour of
 * one. The measurement was free and accidental: the shipped makeup reader, with
 * no class field at all, was handed a cyborg while somebody was counting tokens
 * and answered *"prosthetics, circuitry"* in cosmetics words.
 *
 * Hair has had no such accident. So this reproduces the conditions of one **on
 * purpose**: a bare four-slot hair ask with NO class question in it, run over
 * specimens whose contents were looked at by eye first (law 9), recording the
 * words the reader actually produces.
 *
 * **Nothing here proves a gate.** There is no gate yet. This buys the
 * vocabulary; `court-hair-out-of-class-disposable.mts` buys the verdict, in
 * both directions, once the gate exists.
 *
 * # The specimens, described from LOOKING rather than from a reader
 *
 *   NEGATIVE  the cyborg — a bald scalp with metal plates, and a full
 *             salt-and-pepper BEARD. There is abundant hair in this frame and
 *             none of it is the hair a hair reference means. That is the hard
 *             case: the picture is not empty, it is wrong-classed.
 *   POSITIVE  the studio portrait — near-black hair, scraped flat and back off
 *             the face into a low knot.
 *   POSITIVE  the beanie selfie — a platinum blonde blunt bob hanging below a
 *             white knitted hat, the crown hidden. Hard on purpose: a real
 *             customer's reference is half-obscured more often than not.
 *
 * # Money
 *
 * Six vision reads on the OpenRouter balance, house money, dev only. Nothing is
 * written, nothing is kept, no credits move. Priced at the wire off each call's
 * own reported usage — never off the balance, which lags.
 *
 *   npx tsx scripts/probe-hair-class-words-disposable.mts
 */
import "dotenv/config";

import { readFile } from "node:fs/promises";

import { withCallCensus } from "../server/castingV2/callCensus";
import { interpreterEngine } from "../server/castingV2/interpreter";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}

const INPUT_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_PER_TOKEN = 15.0 / 1_000_000;

const RUNS = 2;

/**
 * THE BARE ASK — four hair facets and a presence flag, and DELIBERATELY no
 * class field.
 *
 * This is the shape the hair reader would have shipped as if nobody had asked
 * the class question, and it is the shape that has to be probed: the defect
 * being measured is what a reader does when it has nowhere to put "this is not
 * head hair".
 *
 * The four slots are the product's own hair facets (D-142), minus finish, which
 * no specimen here turns on.
 */
const ASK = [
  "You are a hair stylist writing a short note for a photographer.",
  "",
  "Look at this photograph.",
  "",
  "Describe the hair on this person's head.",
  "",
  "Rules:",
  "- Each answer is a short phrase of a few words, never a sentence.",
  "- Each answer is at most 40 characters.",
  "- Never name a brand or a product line.",
  "",
  'present: "yes" if there is hair on the head, "no" if there is not',
  "colour: the hair colour, including roots and highlights",
  "cut: the shape it has been cut into — length, layers, fringe",
  "texture: the growth pattern — straight, wavy, curly, coiled",
  "worn: how it is being worn — down, tied up, braided, pinned",
  "",
  'Reply with JSON: {"present": "yes" or "no", "colour": "...", "cut": "...",',
  '"texture": "...", "worn": "..."} and nothing else.',
  "Use null for anything you cannot see.",
].join("\n");

type Arm = { name: string; path: string; contentType: string; looked: string };

const ARMS: Arm[] = [
  /*
    THE SECOND NEGATIVE, and it is the one the first could not stand in for.
    The cyborg is a PERSON WITH NO HEAD HAIR — a presence flag alone can answer
    that, and 2/2 it did. The open question is a frame that is FULL of gorgeous
    hair-like material and is not a person at all, where every slot has an
    obvious, confident, wrong answer waiting for it.
  */
  {
    name: "NEGATIVE — a golden retriever: no person, coat everywhere",
    path: "output/imagegen/golden-retriever-long-wavy-coat-grey-studio-reference.png",
    contentType: "image/png",
    looked: "one dog, head and ruff, long wavy golden coat, plain grey backdrop, nobody in frame",
  },
  /*
    THE THIRD NEGATIVE, and the only one where every slot has a confident right
    answer waiting. The other two are ABSENCES the presence flag can answer.
    This frame really does show hair on a head — it is simply DRAWN, and a drawn
    look ridden into a photoreal render is the fidelity law's own shape.
  */
  {
    name: "NEGATIVE — a salon illustration: drawn copper waves, drawn face",
    path: "output/imagegen/salon-fashion-illustration-copper-waves-curtain-fringe.png",
    contentType: "image/png",
    looked: "ink and gouache on paper, pencil construction lines showing; long copper waves, curtain fringe",
  },
  {
    name: "NEGATIVE — the cyborg: bald scalp, full beard, no head hair",
    path: "output/production-three-spend/master.png",
    contentType: "image/png",
    looked: "bald with metal plates; a full salt-and-pepper beard; one red eye",
  },
  {
    name: "POSITIVE — the studio portrait: near-black hair scraped back",
    path: "output/imagegen/makeup-positive-control-smoky-eye-red-lip-studio-portrait.png",
    contentType: "image/png",
    looked: "near-black, flat to the scalp, pulled back into a low knot",
  },
  {
    name: "POSITIVE (hard) — the beanie selfie: platinum bob under a white hat",
    path: "output/imagegen/refs/ref-beanie.png",
    contentType: "image/png",
    looked: "platinum blonde blunt bob below a white beanie; crown hidden",
  },
];

const engine = interpreterEngine();
if (!engine) throw new Error("no text transport — set OPENROUTER_API_KEY");

const before = await readOpenRouterBalance();
console.log(`balance before: ${before.ok ? `$${before.remaining.toFixed(4)}` : before.why}`);

let tokensIn = 0;
let tokensOut = 0;
let tokenCalls = 0;

/* One arm at a time when a specimen arrives after the others have been read —
   re-buying six reads to learn one thing is house money spent on tidiness. */
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const RUNNING = only ? ARMS.filter((arm) => arm.path.includes(only)) : ARMS;
if (RUNNING.length === 0) throw new Error(`--only ${only} matched no arm`);

for (const arm of RUNNING) {
  const bytes = await readFile(arm.path);
  console.log(`\n${arm.name}`);
  console.log(`  ${arm.path} — ${bytes.length} bytes`);
  console.log(`  SEEN BY EYE: ${arm.looked}`);
  for (let run = 1; run <= RUNS; run += 1) {
    const { value, census } = await withCallCensus(async () => engine.complete({
      about: "describe",
      system: "You describe hair. You never describe people.",
      user: ASK,
      images: [{ bytes, contentType: arm.contentType }],
      json: true,
      temperature: 0,
      maxOutputTokens: 600,
    }));
    tokensIn += census.total.tokensIn;
    tokensOut += census.total.tokensOut;
    tokenCalls += census.total.tokenCalls;
    console.log(`  run ${run}: ${(value.text ?? "").replace(/\s+/g, " ").trim()}`);
  }
}

if (tokenCalls === 0) {
  console.log(`\nNO TOKENS REPORTED — a NO-READ, not a zero. Nothing is priced.`);
} else {
  const cost = tokensIn * INPUT_PER_TOKEN + tokensOut * OUTPUT_PER_TOKEN;
  console.log(`\nPRICED AT THE WIRE — ${tokenCalls} call(s) reporting usage`);
  console.log(`  in  ${tokensIn} × $3.00/M  = $${(tokensIn * INPUT_PER_TOKEN).toFixed(6)}`);
  console.log(`  out ${tokensOut} × $15.00/M = $${(tokensOut * OUTPUT_PER_TOKEN).toFixed(6)}`);
  console.log(`  THIS PROBE = $${cost.toFixed(6)}  (upstream rate; OpenRouter's margin rides on top)`);
}

const after = await readOpenRouterBalance();
console.log(`\nbalance after: ${after.ok ? `$${after.remaining.toFixed(4)}` : after.why}  (lags — reconciliation only)`);

/* A script ends by ending the process: an open provider socket keeps node alive
   and a probe that hangs looks the same as one still reading. */
process.exit(0);
