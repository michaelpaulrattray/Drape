/**
 * #1413 — THE COURT: do the nine readers' answers MOVE when the frame arrives
 * bounded?
 *
 * # What is on trial
 *
 * `boundForJudge` was measured for ONE reader (#1408's conformance judge). This
 * card adopts it at nine more posts, and its own body names the whole cost:
 * *"Measure that the reader's answers do not move — the same fixture through the
 * old and new road, with the axis or field that module produces compared. This
 * is the whole cost of the card and it is not optional: a describer that starts
 * saying something different is a silent behaviour change."*
 *
 * ⚠ **IT IS ONE QUESTION ASKED OF NINE AXES, NOT NINE QUESTIONS — and that is a
 * finding, not a convenience.** Read at the code before this court was written:
 * all nine readers run `anthropic/claude-sonnet-5` (eight through
 * `interpreterEngine`, `conceptDescribe` through `CONCEPT_READER_MODEL`, which
 * IS `DEFAULT_INTERPRETER_MODEL`) — the same model `JUDGE_FRAME_LONG_EDGE = 2576`
 * was chosen for. So the transformation under test is identical everywhere:
 * **PNG or JPEG at any size, to JPEG q95 4:4:4 at a long edge of 2576 or less.**
 * What differs between the nine is only which axis reads it.
 *
 * # How the OLD road is run, since the bound now lives inside the modules
 *
 * NOT by re-implementing a reader — a court that re-implements its subject
 * measures the copy. The engine handed to each reader is the REAL OpenRouter
 * transport, wrapped so that on the OLD arm it substitutes the raw frame back
 * into `request.images` on its way out. System prompt, user prompt, ceiling,
 * temperature, truncation handling and parsing all come from the product. **The
 * two arms therefore differ in exactly one thing: the bytes posted** — and the
 * wrapper ASSERTS they really did differ, because an arm that posted the same
 * bytes twice would report perfect agreement while measuring nothing (the inert
 * -edit failure, which is how a green court means the opposite of what it says).
 *
 * # How the answers are scored, and where the scoring stops
 *
 * **Mechanically, on the DISCRETE axes only** — the medium door's
 * `photograph|drawn|unreadable`, `verifyRender`'s present/occluded verdict,
 * `captionSlot`'s `visible`, and whether a structured reader produced the same
 * NUMBER of sections or surfaces. Those are decisions the product acts on, and a
 * disagreement in one is a behaviour change with no interpretation needed.
 *
 * ⚠ **The PROSE axes are printed in full, both roads, and NOT scored by a
 * model.** Law 9: a reader's reading of an image is a pointer to look, never a
 * fact to file, so putting a judge model in charge of "did the describer say the
 * same thing" would be exactly the move that law forbids, one level up. Two
 * captions will never be byte-identical at temperature 0.1 on a vision model,
 * and a substring check dressed as a semantic verdict is worse than no verdict.
 * **What the court owes is the words in front of eyes, quoted.** They are.
 *
 * # Controls first (working law 2)
 *
 * Every reader also runs against a SECOND fixture whose right answer is
 * different, on the bounded road. A reader that has gone blind answers the same
 * thing to everything, and a court with one fixture per reader cannot tell that
 * from perfect stability. The fixtures are the four this program already owns
 * with a person's eye written against each, taken from
 * `court-reference-medium-disposable.mts` — including its centre, the cyborg: a
 * real photograph that LOOKS synthetic, which is the hardest real frame here and
 * the exact shape of the false positive a JPEG re-encode might cause.
 *
 * # Money
 *
 * Vision reads on the OpenRouter balance — house money, dev only, cents. Priced
 * at the wire off each call's own reported usage. No customer credits, no
 * renders, no database, no bucket, nothing written.
 *
 *   npx tsx scripts/_1413-reader-court-disposable.mts
 */
import "dotenv/config";

import { readFile } from "node:fs/promises";

import sharp from "sharp";

import { boundForJudge, JUDGE_FRAME_LONG_EDGE } from "../server/castingV2/judgeFrame";
import { createOpenRouterTextEngine } from "../server/providers/openrouterText";
import { ProviderQueue } from "../server/providers/providerQueue";
import type { ReferenceImage, TextEngine, TextRequest } from "../server/providers/types";
import { describeFace } from "../server/castingV2/faceDescribe";
import { capturePresentation } from "../server/castingV2/presentationState";
import { aboutFacet, verifyRender } from "../server/castingV2/renderVerification";
import { facetOfSubject } from "../server/castingV2/refineFacets";
import { captionRealization, captionSlot } from "../server/castingV2/realizationCaption";
import { describeConcept } from "../server/castingV2/conceptDescribe";
import { readHairColourFromReference } from "../server/castingV2/hairColourFromReference";
import { readMakeupFromReference } from "../server/castingV2/makeupFromReference";
import { readReferenceMedium } from "../server/castingV2/referenceMediumDoor";
import { readOpenRouterBalance } from "./lib/openrouterBalance.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY is required — this court spends house money on text calls");

/* The rates the medium court prices at, quoted rather than re-derived so two
   courts on one balance cannot disagree about what a token costs. */
const INPUT_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_PER_TOKEN = 15.0 / 1_000_000;

/* `output/` is untracked litter (#8) and lives only in the main tree, so the
   fixtures are read from there by absolute path. Read only — nothing is written
   to that tree and no git verb is run against it. */
const MAIN_TREE = "C:/Users/Admin/Drape";

type Fixture = {
  key: string;
  path: string;
  /** What a person saw in the frame — what an answer is scored against (law 9). */
  looked: string;
};

const FIXTURES: Record<string, Fixture> = {
  cyborg: {
    key: "cyborg",
    path: `${MAIN_TREE}/output/production-three-spend/master.png`,
    looked: "a bald, bearded man with metal plates across the scalp and jaw and one glowing red eye"
      + " — a photographic frame of a person in prosthetics, not a render. NO HAIR, NO MAKEUP.",
  },
  studio: {
    key: "studio",
    path: `${MAIN_TREE}/output/imagegen/makeup-positive-control-smoky-eye-red-lip-studio-portrait.png`,
    looked: "a studio portrait of a woman, smoky eye and red lip, skin retouched, grey seamless",
  },
  colour: {
    key: "colour",
    path: `${MAIN_TREE}/docs/specs/references/build-two-founder-specimens/`
      + "hair-colour-blocked-sections-copper-platinum-black-silver.png",
    looked: "one photograph of one woman; an orange-copper fringe panel, a platinum-blonde panel beside"
      + " it, near-black roots and lengths behind, a silver-white section on the far side",
  },
  drawing: {
    key: "drawing",
    path: `${MAIN_TREE}/output/imagegen/salon-fashion-illustration-copper-waves-curtain-fringe.png`,
    looked: "an illustration on paper — long copper waves, a curtain fringe, visible construction lines",
  },
};

const loaded = new Map<string, ReferenceImage>();
async function fixture(key: string): Promise<ReferenceImage> {
  const held = loaded.get(key);
  if (held) return held;
  const entry = FIXTURES[key];
  if (!entry) throw new Error(`no fixture named ${key}`);
  const image: ReferenceImage = { bytes: await readFile(entry.path), contentType: "image/png" };
  loaded.set(key, image);
  return image;
}

/* One queue for the whole court, so it cannot contend with itself. */
const queue = new ProviderQueue({ name: "court-1413", concurrency: 2, maxQueueDepth: 32 });

let tokensIn = 0;
let tokensOut = 0;
let calls = 0;

type Wire = { posted: number; longEdge: number; format: string | undefined };

/**
 * The real transport, optionally substituting the RAW frame back on its way out.
 *
 * `raw === null` is the NEW road: whatever the reader bounded is what goes. A raw
 * frame is the OLD road: the reader's bound is undone at the wire, so the two
 * arms differ in the bytes and in nothing else.
 */
function engineFor(raw: ReferenceImage | null, wire: Wire[]): TextEngine {
  const real = createOpenRouterTextEngine({ apiKey: apiKey!, queue });
  return {
    id: real.id,
    complete: async (request: TextRequest) => {
      const images = raw ? [raw] : request.images ?? [];
      for (const image of images) {
        const meta = await sharp(image.bytes).metadata().catch(() => null);
        wire.push({
          posted: image.bytes.length,
          longEdge: Math.max(meta?.width ?? 0, meta?.height ?? 0),
          format: meta?.format,
        });
      }
      const result = await real.complete({ ...request, images });
      tokensIn += result.tokens?.in ?? 0;
      tokensOut += result.tokens?.out ?? 0;
      calls += 1;
      return result;
    },
  } as TextEngine;
}

type Reader = {
  name: string;
  /** The axis the product ACTS on, compared mechanically. `null` = prose only. */
  discrete: boolean;
  run: (image: ReferenceImage, engine: TextEngine) => Promise<{ discrete: string; prose: string }>;
};

const READERS: Reader[] = [
  {
    name: "faceDescribe — build / skin / teeth",
    discrete: false,
    run: async (image, engine) => {
      const said = await describeFace({ ...image, engine });
      return {
        discrete: [said.build, said.skin, said.teeth].map((v) => (v ? "said" : "null")).join("/"),
        prose: `build: ${said.build ?? "—"}\n      skin: ${said.skin ?? "—"}\n      teeth: ${said.teeth ?? "—"}`,
      };
    },
  },
  {
    name: "presentationState — how the hair is WORN",
    discrete: true,
    run: async (image, engine) => {
      const pinned = await capturePresentation({ ...image, engine });
      const entries = Object.entries(pinned).map(([facet, pin]) => `${facet}=${JSON.stringify(pin)}`);
      return { discrete: entries.length === 0 ? "nothing pinned" : entries.join(" "), prose: entries.join("\n      ") || "—" };
    },
  },
  {
    name: "renderVerification — is the stated pair PRESENT",
    discrete: true,
    run: async (image, engine) => {
      const read = await verifyRender({
        ...image,
        engine,
        /*
          A FACT THE TWO FIXTURES GENUINELY DIFFER ON, and the first cut of this
          court got it wrong: it asked about a matching pair of earrings, and
          NEITHER fixture has earrings — so both roads and the control all
          answered `absent`, correctly, and the control could not discriminate.
          An arm whose two fixtures share the right answer is a clock, not a
          control (memory: `selector-both-states-satisfy`). The cyborg has a full
          grey beard and the studio portrait does not, so this fact separates
          them and the reader's axis is provably moving.
        */
        /*
          ⚠ AND THE COLOUR IS DELIBERATELY NOT IN THE ASK, which cost a second
          reading to learn. Asked for a *full GREY beard*, the reader answered
          `absent` on the cyborg with `saw=full beard covering jaw and chin, but
          dark brown, not grey` — which is the reader being exactly as strict as
          its own prompt tells it to be about a stated fact, and my eye-note
          calling that beard "brown-gray" is the borderline. A control whose
          right answer is arguable is not a control.
        */
        facts: [{
          subject: aboutFacet(facetOfSubject("facialHair")),
          asked: "a full beard covering the jaw and chin",
          binding: true,
        }],
      });
      /*
        THE DECISION THE PRODUCT ACTS ON, read off the product's own shape rather
        than scraped out of a JSON string. `verified` only means something when
        `read` is true — an affirmative with no evidence is SILENCE, not a pass
        (D-235), and collapsing those three states into two is precisely the
        false pass that rule exists to stop. A court that did the collapsing
        would be unable to see the axis it is here to watch.
      */
      const decided = read.unavailable
        ? "unavailable"
        : read.checks
          .map((check) => (check.read ? (check.verified ? "present" : "absent") : "silent"))
          .join(",");
      return {
        discrete: decided || "no checks",
        prose: read.checks
          .map((check) => `verified=${check.verified} read=${check.read} saw=${check.saw ?? "—"}`)
          .join("\n      ") || "—",
      };
    },
  },
  {
    name: "realizationCaption — a facet read against the whole frame",
    discrete: false,
    run: async (image, engine) => {
      let uncorroborated = "";
      const said = await captionRealization({
        facet: facetOfSubject("hairWorn"),
        ...image,
        engine,
        asked: "loose, worn down",
        onUncorroborated: (verdict) => { uncorroborated = `UNCORROBORATED saw=${verdict.saw}`; },
      });
      return {
        discrete: said === null ? "no caption" : "caption",
        prose: `${said ?? "—"}${uncorroborated ? `\n      ${uncorroborated}` : ""}`,
      };
    },
  },
  {
    name: "captionSlot (frame) — one slot, and whether it can SEE",
    discrete: true,
    run: async (image, engine) => {
      const said = await captionSlot({ noun: "jaw", view: "frame", ...image, engine });
      return { discrete: said === null ? "nothing filed" : "filed", prose: said ?? "—" };
    },
  },
  {
    name: "conceptDescribe — her uploaded picture, described",
    discrete: true,
    run: async (image, engine) => {
      const outcome = await describeConcept({ ...image, engine });
      return {
        discrete: outcome.ok ? "described" : `refused:${outcome.reason}`,
        prose: outcome.ok ? outcome.description : `(no description — ${outcome.reason}, ${outcome.attempts} attempts)`,
      };
    },
  },
  {
    name: "hairColourFromReference — the colour blocks",
    discrete: true,
    run: async (image, engine) => {
      const outcome = await readHairColourFromReference({ ...image, engine });
      if (!outcome.ok) return { discrete: `refused:${outcome.refusal.code}`, prose: outcome.refusal.message };
      return {
        discrete: `used=${outcome.used.length} dropped=${outcome.dropped.length}`,
        prose: `${outcome.sentence}\n      used: ${JSON.stringify(outcome.used)}`,
      };
    },
  },
  {
    name: "makeupFromReference — the surfaces",
    discrete: true,
    run: async (image, engine) => {
      const outcome = await readMakeupFromReference({ ...image, engine });
      if (!outcome.ok) return { discrete: `refused:${outcome.refusal.code}`, prose: outcome.refusal.message };
      return {
        discrete: `used=${outcome.used.length} dropped=${outcome.dropped.length}`,
        prose: `${outcome.sentence}\n      used: ${JSON.stringify(outcome.used)}`,
      };
    },
  },
  {
    name: "referenceMediumDoor — photograph or drawn (the ZERO bar)",
    discrete: true,
    run: async (image, engine) => {
      const medium = await readReferenceMedium({ ...image, engine });
      return { discrete: medium, prose: medium };
    },
  },
];

/** Each reader's main fixture and the control that must answer DIFFERENTLY. */
const PAIRING: Record<string, { main: string; control: string }> = {
  "faceDescribe — build / skin / teeth": { main: "studio", control: "cyborg" },
  "presentationState — how the hair is WORN": { main: "colour", control: "cyborg" },
  "renderVerification — is the stated pair PRESENT": { main: "studio", control: "cyborg" },
  "realizationCaption — a facet read against the whole frame": { main: "colour", control: "cyborg" },
  "captionSlot (frame) — one slot, and whether it can SEE": { main: "studio", control: "cyborg" },
  "conceptDescribe — her uploaded picture, described": { main: "cyborg", control: "studio" },
  "hairColourFromReference — the colour blocks": { main: "colour", control: "cyborg" },
  "makeupFromReference — the surfaces": { main: "studio", control: "cyborg" },
  "referenceMediumDoor — photograph or drawn (the ZERO bar)": { main: "cyborg", control: "drawing" },
};

const RUNS = 2;
const mb = (n: number) => (n / 1024 / 1024).toFixed(2);

const before = await readOpenRouterBalance();
console.log(`balance before: ${before.ok ? `$${before.remaining.toFixed(4)}` : before.why}`);
console.log(`\nJUDGE_FRAME_LONG_EDGE = ${JUDGE_FRAME_LONG_EDGE}; ${RUNS} runs per arm\n`);

/* The bound's own idempotence, measured rather than asserted — the court's
   comparison rests on the NEW arm posting what `boundForJudge` produced, and a
   reader handed already-bounded bytes must not bound them a second time. */
for (const key of Object.keys(FIXTURES)) {
  const raw = await fixture(key);
  const once = await boundForJudge(raw);
  const twice = await boundForJudge(once.image);
  const rawMeta = await sharp(raw.bytes).metadata();
  console.log(
    `  ${key.padEnd(9)} raw ${`${rawMeta.width}x${rawMeta.height}`.padEnd(11)} ${mb(raw.bytes.length)}MB`
    + ` → bound ${once.record.size.padEnd(11)} ${mb(once.image.bytes.length)}MB`
    + `  idempotent=${twice.image.bytes.equals(once.image.bytes)}`,
  );
}

let disagreements = 0;
let blindControls = 0;
let inertArms = 0;

/* `--only <substring>` re-runs one arm after fixing it, rather than re-paying
   for all nine. The filter REFUSES an argument that matches nothing, because a
   silent zero-arm run prints a clean verdict having measured nothing. */
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const RUNNING = only ? READERS.filter((reader) => reader.name.includes(only)) : READERS;
if (RUNNING.length === 0) throw new Error(`--only ${only} matched no reader`);
if (only) console.log(`--only ${only} → ${RUNNING.length} of ${READERS.length} arms\n`);

for (const reader of RUNNING) {
  const pair = PAIRING[reader.name]!;
  const main = await fixture(pair.main);
  console.log(`\n${"═".repeat(78)}\n${reader.name}`);
  console.log(`  fixture: ${pair.main} — ${FIXTURES[pair.main]!.looked}`);

  const answers: Record<"old" | "new", Array<{ discrete: string; prose: string }>> = { old: [], new: [] };
  const wires: Record<"old" | "new", Wire[]> = { old: [], new: [] };

  for (const road of ["old", "new"] as const) {
    for (let run = 1; run <= RUNS; run += 1) {
      const engine = engineFor(road === "old" ? main : null, wires[road]);
      try {
        answers[road].push(await reader.run(main, engine));
      } catch (error) {
        answers[road].push({ discrete: "THREW", prose: String((error as Error)?.message ?? error) });
      }
    }
  }

  const post = (road: "old" | "new") => {
    const seen = wires[road];
    if (seen.length === 0) return "nothing posted";
    const worst = seen.reduce((a, b) => (b.posted > a.posted ? b : a));
    return `${seen.length} post(s), worst ${mb(worst.posted)}MB at ${worst.longEdge}px ${worst.format}`;
  };
  console.log(`  OLD wire: ${post("old")}`);
  console.log(`  NEW wire: ${post("new")}`);

  /* THE ARM THAT GIVES THE OTHERS MEANING: if the two roads posted the same
     bytes, this reader's agreement below measures nothing at all. */
  const oldWorst = wires.old.reduce((a, b) => (b.posted > (a?.posted ?? 0) ? b : a), wires.old[0]);
  const newWorst = wires.new.reduce((a, b) => (b.posted > (a?.posted ?? 0) ? b : a), wires.new[0]);
  const differed = Boolean(oldWorst && newWorst && oldWorst.posted !== newWorst.posted);
  if (!differed) {
    inertArms += 1;
    console.log("  ⚠ INERT — the two roads posted the same bytes, so this arm measures nothing");
  }

  for (const road of ["old", "new"] as const) {
    for (const [index, answer] of answers[road].entries()) {
      console.log(`  ${road.toUpperCase()} run ${index + 1}: [${answer.discrete}]\n      ${answer.prose}`);
    }
  }

  if (reader.discrete) {
    const oldSet = new Set(answers.old.map((a) => a.discrete));
    const newSet = new Set(answers.new.map((a) => a.discrete));
    const agree = oldSet.size === newSet.size && [...oldSet].every((v) => newSet.has(v));
    if (!agree) {
      /*
        AND THE DIRECTION IS NAMED, because "the axis moved" is two findings
        wearing one word. A road that FAILED TO READ — `unreadable`,
        `unavailable`, `noTransport`, a throw — has not given a different reading;
        it has given none, and that is the payload defect #1408 measured rather
        than a behaviour change this card introduced. Counting the two the same
        way would let the bound's own benefit be filed as its cost.
      */
      const failedToRead = (v: string) => /unreadable|unavailable|THREW|noTransport|no verdict|no checks/i.test(v);
      const oldOnlyFailures = [...oldSet].filter((v) => !newSet.has(v) && failedToRead(v));
      const newOnlyFailures = [...newSet].filter((v) => !oldSet.has(v) && failedToRead(v));
      const oldReadings = new Set([...oldSet].filter((v) => !failedToRead(v)));
      const newReadings = new Set([...newSet].filter((v) => !failedToRead(v)));
      const readingsAgree = oldReadings.size === newReadings.size
        && [...oldReadings].every((v) => newReadings.has(v));
      if (readingsAgree && oldOnlyFailures.length > 0 && newOnlyFailures.length === 0) {
        console.log(
          `  ✓ the acted-on axis holds on every reading that ARRIVED: ${JSON.stringify([...newReadings])}`
          + `\n    ⚠ and the OLD road additionally FAILED TO READ ${JSON.stringify(oldOnlyFailures)} —`
          + " the bound's own benefit, not its cost",
        );
      } else {
        disagreements += 1;
        console.log(`  ✗ THE ACTED-ON AXIS MOVED: old ${JSON.stringify([...oldSet])} vs new ${JSON.stringify([...newSet])}`);
      }
    } else {
      console.log(`  ✓ the acted-on axis holds: ${JSON.stringify([...oldSet])}`);
    }
  } else {
    console.log("  · prose axis — printed above for eyes, not scored by a model (law 9)");
  }

  /* The control: a DIFFERENT fixture must produce a DIFFERENT answer on the
     bounded road, or this reader is answering the same thing to everything. */
  const control = await fixture(pair.control);
  const controlWire: Wire[] = [];
  let controlAnswer: { discrete: string; prose: string };
  try {
    controlAnswer = await reader.run(control, engineFor(null, controlWire));
  } catch (error) {
    controlAnswer = { discrete: "THREW", prose: String((error as Error)?.message ?? error) };
  }
  console.log(`  CONTROL (${pair.control} — ${FIXTURES[pair.control]!.looked.slice(0, 70)}…)`);
  console.log(`    [${controlAnswer.discrete}]\n      ${controlAnswer.prose}`);
  /*
    THE CONTROL IS SCORED ON THE WHOLE ANSWER, and the first cut scored it on the
    discrete field alone — which made `conceptDescribe` look blind. Its discrete
    field is *described* versus *refused*, and a describer that reads two
    different people correctly answers `described` for both; the whole point of
    that reader is the prose. **The control asks a different question from the
    road comparison** — *is this reader reading the picture at all* — so it is
    right for it to look at everything the reader produced, while the road
    comparison stays on the acted-on axis, where prose is expected to vary.
  */
  const whole = (answer: { discrete: string; prose: string }) => `${answer.discrete}\u0000${answer.prose}`;
  const movedOnControl = answers.new[0] !== undefined && whole(controlAnswer) !== whole(answers.new[0]);
  if (movedOnControl) {
    console.log("    ✓ the axis MOVES — this reader is reading the picture, not answering a constant");
  } else {
    blindControls += 1;
    console.log("    ✗ the control answered the SAME as the main fixture — this reader's verdict above is not evidence");
  }
}

const after = await readOpenRouterBalance();
const spend = tokensIn * INPUT_PER_TOKEN + tokensOut * OUTPUT_PER_TOKEN;
console.log(`\n${"═".repeat(78)}`);
console.log(`calls ${calls}  tokens in ${tokensIn}  out ${tokensOut}  priced at the wire $${spend.toFixed(4)}`);
console.log(`balance after: ${after.ok ? `$${after.remaining.toFixed(4)}` : after.why}`);
console.log(`\nacted-on axes that MOVED: ${disagreements}`);
console.log(`readers whose control did not discriminate: ${blindControls}`);
console.log(`arms that posted identical bytes (measured nothing): ${inertArms}`);
console.log(
  disagreements === 0 && inertArms === 0
    ? "\nVERDICT: no acted-on axis moved, and every arm posted different bytes. The prose is above for eyes."
    : "\nVERDICT: READ THE ROWS — an axis moved, or an arm was inert.",
);

process.exit(0);
