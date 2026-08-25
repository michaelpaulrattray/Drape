/**
 * THE DILUTION / CREATIVE-REGISTER COURT — **does the engine paint his brief
 * with conviction when it is not surrounded by ours?** (Ordered fable-1660,
 * arms specified by `docs/specs/CREATIVE_REGISTER_DESIGN.md` §3, evidence and
 * build sheet `docs/specs/CASTING_V2_DILUTION_COURT.md`.)
 *
 * # The question
 *
 * His 553-character brief sent straight to GPT Image 2 came back with a
 * prominent jaw plate, an amber eye, committed porcelain skin, no beard and no
 * bodybuilder. The same 553 characters inside our 13,572-character compile came
 * back timid, bearded and muscular. **His share of the compiled prompt is 3.4%.**
 *
 * # The arms, and what each one is FOR
 *
 *   A  HIS RAW PROMPT           the FOUNDER CONTROL. If it does not reproduce
 *                               what he saw, this court has no baseline.
 *   B  TODAY'S COMPILE          the PRODUCT CONTROL — the exact bytes roll #216
 *                               sent, three different delivered slices.
 *   C  THE CREATIVE REGISTER    the candidate: his ask first, a minimal frame,
 *                               one per-slice variance card.
 *   D  C MINUS THE CARD         isolates the card. All three of D's renders are
 *                               byte-identical to each other, which is the
 *                               point: it shows what the ask and frame alone
 *                               produce across three draws.
 *   C' C PLUS THE SAME BLOCKS,  separates *removing our answers* from *saying
 *      SAID BRIEFLY             them briefly* — fable-1664's actual question,
 *                               and the two point at different repairs. Its
 *                               compressed blocks are EXTRACTED from that
 *                               column's own B prompt, never invented, so C'
 *                               is a compression of what was really sent.
 *   R  C PLUS THE CATEGORY      owns the question arm D used to own before
 *      SENTENCE                 fable-1668 changed its meaning: does restoring
 *                               `role` restore the variety? His live rolls
 *                               cannot answer it — `role` is NULL on all three
 *                               — so the sentence is supplied by hand.
 *
 * **B and C are PAIRED down their columns** — column n of B and column n of C
 * are the same slice of the same roll, so the strip reads as three comparisons
 * rather than six unrelated pictures.
 *
 * # ⚠ ARM A IS A RECONSTRUCTION AND THE COURT SAYS SO OUT LOUD
 *
 * His exact raw prompt was never captured as text; what exists is fable-1660's
 * quotation of its opening (*"an ultra-realistic, bare chested, studio casting
 * shot of a Bald male, mid-40s, pale porcelain skin…"* + *"his brief nearly
 * verbatim"*) and his three frames on disk — two of which are byte-identical, so
 * the standard's n is 2.
 *
 * So arm A here is that opening plus his STORED brief, and **its job is
 * falsifiable**: if A does not reproduce the conviction of
 * `output/raw-prompt-reference/founder-raw-*.png` at his eye, the reconstruction
 * is wrong and every comparison against A is worthless. The design already
 * states that stopping rule; this note is where the reconstruction is admitted.
 * Ask him for the exact text if it is recoverable — it costs nothing and it
 * removes the only soft joint in the court.
 *
 * # ⚠ ARM H IS NOT RUN HERE, AND FAKING IT WOULD BE WORSE THAN SKIPPING IT
 *
 * H asserts that an ordinary human brief compiles byte-identical to house
 * through the register SELECTOR. **The selector does not exist** — §2 of the
 * design specifies it and nothing is built. An arm that "passes" by asserting
 * today's compiler against itself is not a control, it is a tautology wearing
 * one, and this campaign has a filed instance of exactly that.
 *
 * What this script does instead is honest and useful: `--baseline` captures the
 * ordinary brief's house compile and its sha256 to disk, so that the day the
 * selector lands, H has a recorded thing to be byte-identical TO. That is a
 * BASELINE, not a control, and the file says so in its own first line.
 *
 * # Cost, stated before it is spent
 *
 *   18 renders at 1024x1536 (the delivered size)   ~$0.040 each   $0.72
 *   0 segmenter reads — law 9, the strip is the verdict surface   $0.00
 *   0 compiles — B is read off disk, A/C/D are composed here     $0.00
 *                                                                 ─────
 *                                                                 ~$0.72
 *
 * No credits, no rows, no database, nothing durable.
 *
 *   npx tsx scripts/court-creative-register-disposable.mts --prove-guard
 *   npx tsx scripts/court-creative-register-disposable.mts --dry-run
 *   npx tsx scripts/court-creative-register-disposable.mts --baseline
 *   npx tsx scripts/court-creative-register-disposable.mts
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");
if (process.env.MYSQL_PUBLIC_URL) throw new Error("this court touches no database — refusing a production wrapper");

const DRY = process.argv.includes("--dry-run");
const PROVE = process.argv.includes("--prove-guard");
const BASELINE = process.argv.includes("--baseline");

const REF = "output/raw-prompt-reference";
const OUT = "output/creative-register-court";

/** ⚠ A RUN NEVER WRITES OVER A RUN (standing rule, fable-1481). */
function freeDir(base: string): string {
  if (!existsSync(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-run${n}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`cannot find a free directory beside ${base}`);
}

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/*
  THE RAW OPENING, quoted from fable-1660's relay of his message. Kept as its
  own constant so the reconstruction's one invented part is visible in one place
  rather than buried in a template literal.
*/
const RAW_OPENING = "an ultra-realistic, bare chested, studio casting shot of ";

/*
  THE SHEET FRAME — the creative register's §1b middle part. Every sentence names
  a STRUCTURAL fact of the sheet and never a quality of the person, which is the
  rule that distinguishes it from the house register's prose. Each clause is a
  condensation of a sentence that IS in today's compile, so the frame is a
  shortening of ours rather than a new invention:

    crop        "Frame from mid-torso up in a 2:3 portrait." + "Shoulders fully
                inside the frame with margin at both sides." + the hair-silhouette
                sentence
    background  "BACKGROUND: Bright light-grey seamless paper, luminous rather
                than flat, filling the entire frame."
    wardrobe    `basicsWardrobeLine("male")` as it stands TODAY — his roll sent
                the retired `shirtless` wording, and using it here would put a
                known 25% content_policy wall inside a court about conviction
    text        the no-text sentence, which is safety rather than taste
*/
const FRAME = "ULTRA-REALISTIC STUDIO CASTING SHOT. Framed from mid-torso up in a 2:3 portrait, "
  + "shoulders fully inside the frame, the entire head and its silhouette inside the frame "
  + "with natural headroom above it. Background: bright light-grey seamless paper, luminous "
  + "rather than flat, filling the entire frame. Wardrobe: bare chested, in plain black fitted "
  + "shorts, barefoot. No text, letters, numbers, logos, captions or watermarks anywhere in the frame.";

/*
  THE VARIANCE CARDS — one per column, on axes HIS BRIEF LEAVES OPEN and no
  others. He pinned hair (bald), skin (pale porcelain, weathered), expression
  (intense, unsmiling), sex and age; those are absent from every card, because
  re-stating a pinned fact is how the ask gets outweighed (§1b).

  What is open, per the bracket (fable-1665): augment STYLE / EXTENT / HARDWARE,
  age texture and wear, build, and facial structure within his stated severity.

  ⚠ Concrete enough to force divergence, open enough that the ENGINE designs the
  hardware. A card that specifies the hardware is the house register with a new
  name on it.
*/
const CARDS = [
  "THIS CANDIDATE: the augmentation carried longer — the ports and scalp seams healed and "
  + "settled into the skin, the jaw plate dulled and faintly scuffed at its edges. Lean through "
  + "the neck and shoulders.",
  "THIS CANDIDATE: the augmentation more extensive — the hardware continuing down past the jaw "
  + "into the neck, the seams denser across the skull. Heavier through the frame.",
  "THIS CANDIDATE: the augmentation newer and starker — the metal clean and unweathered against "
  + "the skin, the ports precisely set. Spare and wiry through the neck and shoulders.",
] as const;

/*
  ARM R's ONE SENTENCE — the creative register's §1b form of the category block,
  which today is seven lines of house prose answering inferable questions. The
  role is supplied BY HAND because his three live rolls all filed `role: null`;
  the value is the one the SAME brief minted 4 of 4 in production before the
  fidelity flag was on, so it is his product's own word rather than mine.
*/
const CATEGORY_SENTENCE = "Every candidate is a credible cybernetically augmented man; vary within that.";

/*
  ARM C's COMPRESSED BLOCKS — EXTRACTED from that column's own B prompt, never
  written by hand. A compression arm whose "compressed" text I invented would be
  measuring my prose against my prose; extracting means C' says exactly what the
  product said, briefly. Each extractor THROWS when it finds nothing, because a
  silently-absent block would make C' quietly equal to C and the court would
  report a difference of zero as a finding.
*/
function compressedBlocks(todayPrompt: string, column: number): string {
  const grab = (label: string, re: RegExp): string => {
    const found = todayPrompt.match(re);
    if (!found) throw new Error(`arm C' column ${column}: no ${label} block in the B prompt — nothing to compress`);
    return found[1]!.trim();
  };
  const build = grab("PHYSIQUE", /PHYSIQUE: (\w+) build/);
  const facialHair = grab("FACIAL HAIR", /FACIAL HAIR: ([^,.]+)/);
  const presence = grab("PRESENCE", /PRESENCE: ([^.]+)\./);
  return `Build: ${build}. Facial hair: ${facialHair}. Presence: ${presence}.`;
}

/* Three DELIVERED slices of roll #216. `failed` positions are excluded upstream. */
const SLICES = [1, 2, 3] as const;

const EXPECTED_SPEND = 6 * SLICES.length * 0.0400;

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

/**
 * ⚠ EVERY ASSERTION THE COURT RESTS ON, IN ONE FUNCTION so `--prove-guard`
 * drives THIS code rather than a paraphrase of it that agrees with me. Each arm
 * throws with its own reason string.
 */
export function assertArms(input: {
  brief: string;
  todayPrompts: readonly string[];
  arms: {
    A: readonly string[]; B: readonly string[]; C: readonly string[]; D: readonly string[];
    Cprime?: readonly string[]; R?: readonly string[];
  };
}): void {
  const { brief, arms } = input;
  const n = arms.B.length;
  for (const [id, prompts] of Object.entries(arms)) {
    if (prompts === undefined) continue;
    if (prompts.length !== n) throw new Error(`arm ${id} holds ${prompts.length} prompts against arm B's ${n}`);
  }

  /* A — his words, and NONE of our frame. */
  for (const [i, prompt] of arms.A.entries()) {
    if (!prompt.includes(brief)) throw new Error(`arm A column ${i}: his brief is NOT in the prompt verbatim`);
    if (prompt.includes(FRAME)) throw new Error(`arm A column ${i}: our sheet frame leaked into the founder control`);
  }

  /* B — the stored bytes, unedited. */
  for (const [i, prompt] of arms.B.entries()) {
    if (prompt !== input.todayPrompts[i]) throw new Error(`arm B column ${i}: the product control was EDITED — it must be the stored bytes`);
    if (prompt.length < 5000) throw new Error(`arm B column ${i}: ${prompt.length} chars is not a full compile — the wrong thing was read`);
  }
  if (new Set(arms.B).size !== n) throw new Error("arm B repeats a slice — three renders of one prompt is not three candidates");

  /*
    §1b's own bound, and it is a property of the two CONSTANTS rather than of any
    column — so it is checked once, up front. It sat inside the per-column loop
    in the first draft and swallowed five of the guard's own arms: every fixture
    threw here before reaching the defect it was built to test, and five arms
    printed one unrelated reason. That is the arm-asserts-its-own-reason rule
    failing on the guard itself.
  */
  if (FRAME.length >= brief.length) {
    throw new Error(`the frame (${FRAME.length}) is not smaller than the ask (${brief.length}) — §1b's own bound`);
  }

  /* C — ask first, frame after it, card last. */
  for (const [i, prompt] of arms.C.entries()) {
    if (!prompt.startsWith(brief)) throw new Error(`arm C column ${i}: THE ASK IS NOT FIRST — that is the register's whole claim`);
    if (!prompt.includes(FRAME)) throw new Error(`arm C column ${i}: the sheet frame is missing`);
    if (!prompt.includes(CARDS[i]!)) throw new Error(`arm C column ${i}: this column's variance card is missing`);
    if (prompt.indexOf(FRAME) > prompt.indexOf(CARDS[i]!)) throw new Error(`arm C column ${i}: the card comes BEFORE the frame`);
    if (prompt.length >= arms.B[i]!.length * 0.25) {
      throw new Error(`arm C column ${i}: ${prompt.length} chars is not materially leaner than B's ${arms.B[i]!.length}`);
    }
  }
  if (new Set(arms.C).size !== n) throw new Error("arm C's three columns are not distinct — the variance card is not varying");
  /* The three C prompts differ ONLY in the card. */
  const stripped = arms.C.map((prompt, i) => prompt.replace(CARDS[i]!, ""));
  if (new Set(stripped).size !== 1) throw new Error("arm C's columns differ OUTSIDE the variance card — the card is not the only variable");

  /* C-prime — C plus the compressed blocks, and NOT equal to C. */
  if (arms.Cprime) {
    for (const [i, prompt] of arms.Cprime.entries()) {
      if (!prompt.startsWith(brief)) throw new Error(`arm C' column ${i}: the ask is not first`);
      if (!prompt.includes(CARDS[i]!)) throw new Error(`arm C' column ${i}: this column's variance card is missing`);
      if (prompt === arms.C[i]) throw new Error(`arm C' column ${i}: identical to C — the compressed blocks are ABSENT and the arm measures nothing`);
      if (!prompt.startsWith(arms.C[i]!)) throw new Error(`arm C' column ${i}: it is not C PLUS something — C's own text was altered`);
      if (prompt.length >= arms.B[i]!.length * 0.25) throw new Error(`arm C' column ${i}: ${prompt.length} chars is not a COMPRESSION of B's ${arms.B[i]!.length}`);
    }
    /*
      ⚠ THE UNIQUENESS TEST IS ON THE SUFFIX, NOT ON THE WHOLE PROMPT, and the
      guard's own positive control is what found that. Every C prompt already
      differs by its variance card, so three identical compressed blocks still
      produce three distinct C' prompts — a whole-prompt `new Set(...)` passes
      while the arm measures nothing. What must differ is the part C' ADDS.
    */
    const suffixes = arms.Cprime.map((prompt, i) => prompt.replace(arms.C[i]!, ""));
    if (new Set(suffixes).size !== suffixes.length) {
      throw new Error("arm C's columns repeat — the compressed blocks are identical on every column, so they were not extracted per column");
    }
  }

  /* R — C plus the category sentence, and nothing else. */
  if (arms.R) {
    for (const [i, prompt] of arms.R.entries()) {
      if (!prompt.includes(CATEGORY_SENTENCE)) throw new Error(`arm R column ${i}: the category sentence is missing — R is C PLUS it`);
      if (prompt.replace(` ${CATEGORY_SENTENCE}`, "") !== arms.C[i]) {
        throw new Error(`arm R column ${i}: it differs from C by more than the category sentence`);
      }
    }
  }

  /* D — C minus the card, and byte-identical across its own columns. */
  for (const [i, prompt] of arms.D.entries()) {
    if (prompt.includes(CARDS[i]!)) throw new Error(`arm D column ${i}: still carries the variance card — D is C MINUS the card`);
    if (!prompt.startsWith(brief)) throw new Error(`arm D column ${i}: the ask is not first`);
    if (!prompt.includes(FRAME)) throw new Error(`arm D column ${i}: the sheet frame is missing`);
  }
  if (new Set(arms.D).size !== 1) {
    throw new Error("arm D's columns are NOT identical — with the card removed there is nothing left to differ, so something else moved");
  }

  /* The pinned facts must not be re-stated by a card (§1b). */
  const PINNED = ["bald", "porcelain", "unsmiling"];
  for (const [i, card] of CARDS.entries()) {
    const echoed = PINNED.filter((word) => card.toLowerCase().includes(word));
    if (echoed.length > 0) {
      throw new Error(`variance card ${i} re-states a PINNED fact (${echoed.join(", ")}) — repetition is how the ask gets outweighed`);
    }
  }
}

/*
  ⚠ THE POSITIVE CONTROL, and it runs before the network does. `--dry-run`
  proves the guard PASSES on the real material; that is a negative arm and it
  cannot find a guard that never refuses.
*/
if (PROVE) {
  /* A realistic ASK: §1b's bound is frame-smaller-than-ask, so a toy brief would
     make every fixture fail on the bound rather than on its own defect. */
  const brief = "A bald man with a jaw plate. " + "Severe bone structure, deep-set eyes, gaunt cheeks. ".repeat(9);
  const good = (card: string) => `${brief}\n\n${FRAME}\n\n${card}`;
  const base = {
    brief,
    todayPrompts: ["X".repeat(6000), "Y".repeat(6000), "Z".repeat(6000)],
    arms: {
      A: SLICES.map(() => `${RAW_OPENING}${brief}`),
      B: ["X".repeat(6000), "Y".repeat(6000), "Z".repeat(6000)],
      C: CARDS.map((card) => good(card)),
      D: CARDS.map(() => `${brief}\n\n${FRAME}`),
      /* The two arms added at fable-1670. They get fixtures here or their
         branches ship untested, which is the shape this guard exists to refuse. */
      Cprime: CARDS.map((card, i) => `${good(card)}\n\nBuild: b${i}. Facial hair: f${i}. Presence: p${i}.`),
      R: CARDS.map((card) => `${good(card)} ${CATEGORY_SENTENCE}`),
    },
  };
  const bend = (fn: (draft: typeof base) => void) => {
    const draft = JSON.parse(JSON.stringify(base)) as typeof base;
    fn(draft);
    assertArms(draft);
  };
  const arms: Array<{ what: string; run: () => void; expect: RegExp }> = [
    {
      what: "arm A lost his brief",
      expect: /arm A column 1: his brief is NOT in the prompt verbatim/,
      run: () => bend((d) => { (d.arms.A as string[])[1] = "an ultra-realistic shot of a man"; }),
    },
    {
      what: "our frame leaked into the founder control",
      expect: /arm A column 0: our sheet frame leaked/,
      run: () => bend((d) => { (d.arms.A as string[])[0] = `${RAW_OPENING}${brief} ${FRAME}`; }),
    },
    {
      what: "the product control was edited rather than read",
      expect: /arm B column 2: the product control was EDITED/,
      run: () => bend((d) => { (d.arms.B as string[])[2] = `${"Z".repeat(6000)} and smiling`; }),
    },
    {
      what: "arm B renders one prompt three times",
      expect: /arm B repeats a slice/,
      run: () => bend((d) => { (d.arms.B as string[])[2] = d.arms.B[0]!; d.todayPrompts = d.arms.B; }),
    },
    {
      what: "the ask is not first in the creative register",
      expect: /arm C column 0: THE ASK IS NOT FIRST/,
      run: () => bend((d) => { (d.arms.C as string[])[0] = `${FRAME}\n\n${brief}\n\n${CARDS[0]}`; }),
    },
    {
      what: "arm C's columns differ outside the card",
      expect: /differ OUTSIDE the variance card/,
      run: () => bend((d) => { (d.arms.C as string[])[1] = `${d.arms.C[1]} and smiling`; }),
    },
    {
      what: "arm D still carries the card",
      expect: /arm D column 1: still carries the variance card/,
      run: () => bend((d) => { (d.arms.D as string[])[1] = `${d.arms.D[1]}\n\n${CARDS[1]}`; }),
    },
    {
      what: "arm D's columns are not identical",
      expect: /arm D's columns are NOT identical/,
      run: () => bend((d) => { (d.arms.D as string[])[2] = `${d.arms.D[2]} `; }),
    },
    {
      what: "the creative prompt is not materially leaner than today's",
      expect: /is not materially leaner/,
      run: () => bend((d) => { d.todayPrompts = d.arms.B = ["X".repeat(5000), "Y".repeat(5000), "Z".repeat(5000)]; (d.arms.C as string[])[0] = `${brief}\n\n${FRAME}\n\n${CARDS[0]}${"q".repeat(2000)}`; }),
    },
    {
      what: "arm C' lost its compressed blocks, so it is just C again",
      expect: /arm C' column 1: identical to C/,
      run: () => bend((d) => { (d.arms.Cprime as string[])[1] = d.arms.C[1]!; }),
    },
    {
      what: "arm C's compressed blocks are the same on every column",
      expect: /the compressed blocks are identical on every column/,
      run: () => bend((d) => {
        const one = d.arms.Cprime[0]!.replace(d.arms.C[0]!, "");
        (d.arms.Cprime as string[]).forEach((_, i) => { (d.arms.Cprime as string[])[i] = `${d.arms.C[i]}${one}`; });
      }),
    },
    {
      what: "arm R differs from C by more than the category sentence",
      expect: /arm R column 2: it differs from C by more than the category sentence/,
      run: () => bend((d) => { (d.arms.R as string[])[2] = `${d.arms.C[2]} and smiling ${CATEGORY_SENTENCE}`; }),
    },
    {
      what: "arm R lost the category sentence",
      expect: /arm R column 0: the category sentence is missing/,
      run: () => bend((d) => { (d.arms.R as string[])[0] = d.arms.C[0]!; }),
    },
    {
      what: "NEGATIVE CONTROL — the real material must NOT throw",
      expect: /^$/,
      run: () => assertArms(base),
    },
  ];
  let failures = 0;
  for (const arm of arms) {
    let thrown: string | null = null;
    try { arm.run(); } catch (error) { thrown = error instanceof Error ? error.message : String(error); }
    const wanted = arm.expect.source === "^$";
    const ok = wanted ? thrown === null : thrown !== null && arm.expect.test(thrown);
    if (!ok) failures += 1;
    say(`${ok ? "PROVEN " : "FAILED  "} ${arm.what}`);
    say(`         ${thrown === null ? "(did not throw)" : thrown}`);
  }
  say();
  say(failures === 0 ? "all arms behaved. Nothing dispatched, nothing spent." : `${failures} ARM(S) MISBEHAVED`);
  process.exit(failures === 0 ? 0 : 1);
}

/*
  ⚠ THE BASELINE, NOT A CONTROL — see the header. Captures an ordinary human
  brief's HOUSE compile and its digest, so arm H has something recorded to be
  byte-identical to on the day the selector exists.
*/
if (BASELINE) {
  const { castingBriefCompiler } = await import("../server/castingV2/briefCompiler");
  const ORDINARY = "A woman in her early thirties, warm and approachable, for a skincare campaign.";
  const compiled = await castingBriefCompiler({
    briefText: ORDINARY, candidateCount: 3, rollSeed: "creative-register-baseline",
  } as never) as Record<string, any>;
  const prompts: string[] = (compiled.candidates ?? []).map((c: any) => c.prompt ?? "");
  if (prompts.length !== 3 || prompts.some((p) => p.length < 5000)) {
    throw new Error("the baseline compile did not return three full prompts — refusing to record it");
  }
  mkdirSync(REF, { recursive: true });
  const body = `THIS IS A BASELINE, NOT A CONTROL. The register selector does not exist yet.\n`
    + `It records what an ORDINARY brief compiles to TODAY, so arm H has a recorded thing to be\n`
    + `byte-identical TO once the selector lands. An arm comparing today's compiler to itself\n`
    + `proves nothing.\n\nbrief: ${ORDINARY}\nrollSeed: creative-register-baseline\n`
    + prompts.map((p, i) => `\n===== slice ${i} · sha256 ${sha(p)} · ${p.length} chars =====\n${p}`).join("\n");
  writeFileSync(`${REF}/ordinary-brief-house-compile-baseline.txt`, body, "utf8");
  console.log(`wrote ${REF}/ordinary-brief-house-compile-baseline.txt`);
  console.log(prompts.map((p, i) => `  slice ${i}  ${p.length} chars  sha256 ${sha(p).slice(0, 16)}…`).join("\n"));
  process.exit(0);
}

/* ─── THE MATERIAL, READ OFF DISK, AND EVERY ASSERTION BEFORE A RENDER ─── */

const briefPath = `${REF}/roll216-brief-verbatim.txt`;
if (!existsSync(briefPath)) {
  throw new Error(`${briefPath} is missing — run scripts/_roll216-slice-prompt-disposable.mts --production first`);
}
const brief = readFileSync(briefPath, "utf8").trim();

/*
  ⚠ ARM B IS THREE DIFFERENT DELIVERED SLICES, READ FROM DISK AND NEVER FROM THE
  DATABASE.

  Roll #216 lives in production alone, and this script REFUSES `MYSQL_PUBLIC_URL`
  above — a script that can spend must not also be able to reach production. So
  the crossing happens once, in the read-only
  `scripts/_roll216-slice-prompt-disposable.mts --production`, and the court
  consumes its file. That file records the WORLD it was taken from, and a DEV
  reading is refused here: three prompts from the wrong database would be a
  product control for a product he never used.

  ⚠ Column 0 is asserted against the single-slice file the founder has on his
  desk, so the thing he is reading and the thing arm B renders cannot diverge.
*/
const columnsPath = `${REF}/roll216-armB-columns.json`;
if (!existsSync(columnsPath)) {
  throw new Error(`${columnsPath} is missing — run scripts/_roll216-slice-prompt-disposable.mts --production first`);
}
const columnsFile = JSON.parse(readFileSync(columnsPath, "utf8")) as {
  rollId: number; world: string; columns: Array<{ position: number; status: string; prompt: string }>;
};
if (columnsFile.world !== "PRODUCTION") {
  throw new Error(`arm B was taken from ${columnsFile.world} — a product control must come from the world he rolled in`);
}
if (columnsFile.columns.length !== SLICES.length) {
  throw new Error(`arm B holds ${columnsFile.columns.length} columns, expected ${SLICES.length}`);
}
for (const column of columnsFile.columns) {
  if (column.status === "failed") throw new Error(`slice ${column.position} FAILED — a refused slice is not a product control`);
}
const todayPrompts: string[] = columnsFile.columns.map((column) => column.prompt);
const POSITIONS = columnsFile.columns.map((column) => column.position);

const onDisk = existsSync(`${REF}/roll216-slice-prompt-today.txt`)
  ? readFileSync(`${REF}/roll216-slice-prompt-today.txt`, "utf8")
  : null;
if (onDisk !== null && onDisk !== todayPrompts[0]) {
  throw new Error("the slice prompt on his desk is NOT arm B column 0 — the artifact and the control have diverged");
}

const armA = SLICES.map(() => `${RAW_OPENING}${brief}`);
const armB = todayPrompts;
const armC = CARDS.map((card) => `${brief}\n\n${FRAME}\n\n${card}`);
const armD = CARDS.map(() => `${brief}\n\n${FRAME}`);
const armCprime = armC.map((prompt, i) => `${prompt}\n\n${compressedBlocks(armB[i]!, i)}`);
const armR = armC.map((prompt) => `${prompt} ${CATEGORY_SENTENCE}`);

const dir = freeDir(OUT);
mkdirSync(dir, { recursive: true });

say("THE CREATIVE-REGISTER COURT (CREATIVE_REGISTER_DESIGN.md §3)");
say(`  arms    A raw (RECONSTRUCTED) · B today's sent bytes · C creative register · D C minus the card`);
say(`  columns roll 216 slices ${POSITIONS.join(", ")} — B and C are PAIRED down their columns`);
say(`  judged  HIS EYE on the strip against output/raw-prompt-reference/founder-raw-*.png`);
say(`  out     ${dir}`);
say();
say(`  brief   ${brief.length} chars`);
say(`  A       ${armA[0]!.length} chars  ⚠ reconstruction — see the header`);
say(`  B       ${armB.map((p) => p.length).join(", ")} chars`);
say(`  C       ${armC.map((p) => p.length).join(", ")} chars   (${((armC[0]!.length / armB[0]!.length) * 100).toFixed(1)}% of B)`);
say(`  D       ${armD[0]!.length} chars, identical on all three columns`);
say(`  C'      ${armCprime.map((p) => p.length).join(", ")} chars   — C plus blocks EXTRACTED from each column's own B`);
say(`  R       ${armR.map((p) => p.length).join(", ")} chars   — C plus one category sentence`);
say();

assertArms({ brief, todayPrompts, arms: { A: armA, B: armB, C: armC, D: armD, Cprime: armCprime, R: armR } });
say("  every arm asserted at the wire: ask first, frame smaller than the ask, card the only");
say("  variable in C, D identical across its columns, no pinned fact re-stated in a card");
say();

const CELLS = [
  { id: "A-RAW", prompts: armA },
  { id: "B-TODAY", prompts: armB },
  { id: "C-CREATIVE", prompts: armC },
  { id: "D-NO-CARD", prompts: armD },
  { id: "Cp-BRIEFLY", prompts: armCprime },
  { id: "R-CATEGORY", prompts: armR },
] as const;

writeFileSync(
  `${dir}/prompts.json`,
  JSON.stringify({
    brief, frame: FRAME, cards: CARDS, slices: POSITIONS,
    reconstruction: { rawOpening: RAW_OPENING, note: "arm A is a reconstruction; see the script header" },
    cells: Object.fromEntries(CELLS.map((c) => [c.id, c.prompts])),
    digests: Object.fromEntries(CELLS.map((c) => [c.id, c.prompts.map(sha)])),
  }, null, 2),
  "utf8",
);

const before = await readFalBalance();
if (!before.ok) throw new Error(`fal balance UNREAD — ${before.why}`);
say(`  expected spend $${EXPECTED_SPEND.toFixed(4)}  ·  fal balance before $${before.remaining.toFixed(4)}`);
const FLOOR = 12;
const headroom = before.remaining - 2 * EXPECTED_SPEND;
say(`  top-up guard: balance - 2 x expected = $${headroom.toFixed(4)} against a $${FLOOR} floor`);
if (headroom <= FLOOR && !DRY) {
  throw new Error(`REFUSING: $${headroom.toFixed(2)} of headroom is inside the top-up's observed window`
    + " ($8.67-$10.01 trigger, $20 amount) — a replenishment mid-run destroys the price reading");
}
say();

if (DRY) {
  say("--dry-run: every assertion passed and NOTHING was dispatched. Nothing spent at all —");
  say("arm B was read from disk (taken from PRODUCTION by the read-only script) and A/C/D");
  say("were composed here; no database, no compile, no render.");
  writeFileSync(`${dir}/dryrun.log`, lines.join("\n"), "utf8");
  process.exit(0);
}

/* ─── THE RENDERS ─── */

const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY });
type Row = { cell: string; column: number; slice: number; refused: boolean; why?: string };
const rowsOut: Row[] = [];
const tiles: Array<{ cell: string; column: number; bytes: Buffer }> = [];
let images = 0;
let refusals = 0;

for (const cell of CELLS) {
  say(`════ ${cell.id} ════`);
  for (let column = 0; column < cell.prompts.length; column += 1) {
    try {
      const result = await engine.generateCandidate({
        prompt: cell.prompts[column]!, size: "1024x1536", quality: "medium",
      } as never);
      images += 1;
      writeFileSync(`${dir}/${cell.id}-col${column}.png`, result.bytes);
      tiles.push({ cell: cell.id, column, bytes: result.bytes });
      rowsOut.push({ cell: cell.id, column, slice: POSITIONS[column]!, refused: false });
      say(`  col${column} (slice ${POSITIONS[column]})  frame ${result.width ?? "?"}x${result.height ?? "?"}`);
    } catch (error) {
      /* A refusal is a DATUM: a lean prompt is an unmeasured wall risk and the
         count belongs beside the conviction. */
      refusals += 1;
      const why = error instanceof Error ? error.message : String(error);
      say(`  col${column} (slice ${POSITIONS[column]})  REFUSED — ${why.slice(0, 160)}`);
      rowsOut.push({ cell: cell.id, column, slice: POSITIONS[column]!, refused: true, why: why.slice(0, 300) });
    }
  }
  say();
}

/* ─── THE STRIP ─── */

if (tiles.length > 0) {
  const TILE_W = 340;
  const GUTTER = 200;
  const resized = await Promise.all(tiles.map(async (t) => ({
    ...t, buf: await sharp(t.bytes).resize({ width: TILE_W }).toBuffer(),
  })));
  const tileH = (await sharp(resized[0]!.buf).metadata()).height ?? 510;
  const rowOf = (cellId: string) => CELLS.findIndex((c) => c.id === cellId);
  const composites: sharp.OverlayOptions[] = resized.map((t) => ({
    input: t.buf, left: GUTTER + t.column * TILE_W, top: rowOf(t.cell) * tileH,
  }));
  try {
    for (const [i, cell] of CELLS.entries()) {
      const svg = `<svg width="${GUTTER}" height="${tileH}">`
        + `<rect width="100%" height="100%" fill="#141414"/>`
        + `<text x="14" y="${Math.round(tileH / 2)}" font-family="sans-serif" font-size="24" fill="#EBEBEB">${cell.id}</text>`
        + `</svg>`;
      composites.push({ input: Buffer.from(svg), left: 0, top: i * tileH });
    }
  } catch (error) {
    say(`  ⚠ labels NOT drawn (${error instanceof Error ? error.message : String(error)}) — read the row order from this log`);
  }
  const stripPath = `${dir}/STRIP-raw-vs-today-vs-creative.png`;
  await sharp({
    create: {
      width: GUTTER + TILE_W * SLICES.length, height: tileH * CELLS.length,
      channels: 3, background: { r: 20, g: 20, b: 20 },
    },
  }).composite(composites).png().toFile(stripPath);
  say(`kept ${stripPath}`);
  say(`  rows top to bottom: ${CELLS.map((c) => c.id).join(" · ")}`);
  say("  ⚠ compare against output/raw-prompt-reference/founder-raw-01.png and -03.png");
  say("    (-02 is byte-identical to -01; the standard's n is 2)");
  say();
}

/* ─── THE TABLE ─── */

say("THE READING");
for (const cell of CELLS) {
  const mine = rowsOut.filter((r) => r.cell === cell.id);
  const landed = mine.filter((r) => !r.refused);
  say(`  ${cell.id.padEnd(11)} rendered ${landed.length}/${mine.length}`
    + (landed.length < mine.length ? `   ← ${mine.length - landed.length} REFUSED` : ""));
}
say();
say("⚠ THIS SCRIPT GRADES NOTHING. Law 9: the strip is the verdict surface and his eye is");
say("  the instrument. The fact checks are in CASTING_V2_DILUTION_COURT.md §3 and they are a");
say("  DESCRIPTION of what his eye is looking at, never a score.");
say("⚠ ARM A IS A RECONSTRUCTION. If it does not reach the reference frames' conviction, every");
say("  comparison against A is worthless and the court stops there.");
say();

const after = await readFalBalance();
say(`fal balance after $${after.ok ? after.remaining.toFixed(4) : "UNREAD"}`
  + (after.ok ? `  ·  spent $${(before.remaining - after.remaining).toFixed(4)}` : ""));
say(`images ${images}  ·  provider refusals ${refusals}`);

writeFileSync(`${dir}/court.log`, lines.join("\n"), "utf8");
writeFileSync(`${dir}/rows.json`, JSON.stringify(rowsOut, null, 2), "utf8");
console.log(`\nkept ${dir}/court.log and ${dir}/rows.json`);
process.exit(0);
