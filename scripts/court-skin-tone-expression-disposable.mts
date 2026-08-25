/**
 * THE SKIN-TONE EXPRESSION COURT — **his words reach the prompt and the paint
 * is timid. Does REGISTER or POSITION fix it?** (Scoped opus-1275 §4, ordered
 * fable-1658 §2 at $0.48, cells today's / A / B / A+B, one brief one seed,
 * judged by HIS EYE on a strip.)
 *
 * # The complaint, verbatim
 *
 * > *"pale porcelain skin is a heavy description but its honestly showcased
 * > extremely lightly"* — the founder, 2026-08-25, on his own basics sheet.
 *
 * # What is already known, and it is the reason this court is about the ENGINE
 *
 * It is NOT a fact-loss defect and that was read at the rows before this was
 * scoped. Both of his rolls compiled
 * `statedSkin: {"tone":"pale porcelain","character":"heavily weathered"}` with
 * `heritage: []` and `characterNotes` at 445 and 434 characters — the fidelity
 * lane is live on his brief, every one of his facts survived, no invented
 * heritage. **The words are on the wire; the paint is timid.** So the only
 * levers left are how the sentence is SAID and where it STANDS.
 *
 * # The two levers, and they are different in kind
 *
 *   A  REGISTER   Today the lane renders `SKIN: <said> — exactly as described.`
 *                 Cell A swaps that closing clause for the ABSOLUTE register
 *                 the age block already uses and the engine already obeys:
 *                 *"— this is an absolute casting requirement, not an
 *                 approximation."* Same position, same words for her own skin,
 *                 one clause different.
 *   B  POSITION   Today the SKIN sentence stands AFTER `Character detail:`,
 *                 mid-prompt. The blocks that DO land — age, physique — sit in
 *                 the `SUBJECT:` sentence at the top. Cell B moves the
 *                 IDENTICAL sentence up, immediately before `Character
 *                 detail:`, and changes not one byte of it.
 *   A+B           Both, because they are independent and the interesting
 *                 outcome is the one where neither alone is enough.
 *
 * # THE CONTROL THAT MAKES THIS AN INSTRUMENT
 *
 * **One compile, four prompt sets, and the ONLY difference between them is the
 * skin sentence's wording and its position.** The brief and the roll seed are
 * identical, so the compiler resolves the same three people; the three variant
 * sets are made by SURGERY on the already-compiled prompts rather than by
 * compiling four times, because a second compile is a second interpreter call
 * and its output can differ in ways that have nothing to do with the skin line.
 * Every cell therefore renders THE SAME THREE PEOPLE and the strip is paired
 * down its columns.
 *
 * The surgery is asserted **at the wire** (invariant 5) and the assertions are
 * arithmetic rather than hopeful:
 *
 *   A     differs from today ONLY by the closing clause — proven by putting the
 *         clause back and demanding byte-identity with today's prompt.
 *   B     is a PERMUTATION of today — same length, and removing the skin
 *         sentence from each yields the identical remainder. A move that
 *         changes one other byte is not a move.
 *   A+B   is B's position with A's clause, proven against both.
 *
 * A prompt set failing any of those buys nothing and the run refuses before it
 * dispatches.
 *
 * # ⚠ WHAT THIS COURT CANNOT DECIDE, AND WHY IT ASKS NO READER
 *
 * **Nothing here is measured by a segmenter and that is deliberate.** *"Pale
 * enough"* is exactly the adjective judgement law 9 gives him — *"do NOT trust
 * the engine my eyes are king"* — and a skin-tone reader would be a vision
 * model grading a visible surface, which is the one thing this campaign has
 * ruled it may not do. The court's product is a labelled contact strip and the
 * per-cell PNGs beside it. This script prints no verdict on tone.
 *
 * What it DOES assert mechanically is the half a machine can settle: that the
 * four cells differ in exactly the one way they claim to.
 *
 * # Why the UNPATHED wardrobe and not his basics line
 *
 * His sheet was BASICS, whose male line (`shirtless, in plain black fitted
 * shorts, barefoot`) was measured at 4 of 16 `content_policy` refusals on his
 * own account this week (p = 0.003 against a clothed control of 0 of 48). A
 * court about skin cannot afford to lose a quarter of its n to a garment
 * question that already has its own court. This compiles UNPATHED — the house
 * crew tee, 0 of 31 refusals — so the only thing at issue is the skin.
 *
 * ⚠ That is a stated limit, not a free choice: if the register lever only works
 * on a covered chest, this court cannot see it. Nothing here generalises to the
 * shirtless line without being re-asked there.
 *
 * # Cost, stated before it is spent
 *
 *   12 renders at 1024x1536 (the delivered size)  ~$0.040 each   $0.48
 *   0 segmenter reads (law 9 — see above)                        $0.00
 *   1 openrouter compile                                         ~$0.02
 *                                                                ─────
 *                                                                ~$0.50
 *
 * No credits, no rows, no database, nothing durable.
 *
 *   npx tsx scripts/court-skin-tone-expression-disposable.mts --prove-guard
 *   npx tsx scripts/court-skin-tone-expression-disposable.mts --dry-run
 *   npx tsx scripts/court-skin-tone-expression-disposable.mts
 */
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

import { createFalCreativeEngine } from "../server/providers/falImages";
import { readFalBalance } from "./lib/falSpend.mts";

if (!process.env.FAL_KEY) throw new Error("no FAL_KEY");
if (process.env.MYSQL_PUBLIC_URL) throw new Error("this court touches no database — refusing a production wrapper");

const DRY = process.argv.includes("--dry-run");
const PROVE = process.argv.includes("--prove-guard");

const OUT = "output/skin-tone-expression-court";

/**
 * ⚠ A RUN NEVER WRITES OVER A RUN (standing rule, fable-1481). If the directory
 * is taken the next free number is used and the path is printed.
 */
function freeDir(base: string): string {
  if (!existsSync(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-run${n}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`cannot find a free directory beside ${base}`);
}

/*
  THE BRIEF. His own two skin facts, in a SHORT brief — the density court
  measured that a fact typed into a long brief is dropped by compression
  pressure (dense 0/2, plain 3/3 on the identical phrase), and the one fact this
  court cannot afford to lose is the skin. His cyborg brief is 553 characters of
  cybernetics and would put the whole augment question inside the frame as well.

  `pale porcelain` and `heavily weathered` are quoted from what his rolls
  actually compiled (`statedSkin: {"tone":"pale porcelain","character":"heavily
  weathered"}`), and the compile below is ASSERTED to have produced exactly that
  pair rather than trusted to.
*/
const BRIEF = "A man in his mid forties with pale porcelain skin, heavily weathered, "
  + "shaved head, looking straight into the lens.";

const WANT_TONE = "pale porcelain";
const WANT_CHARACTER = "heavily weathered";

/* One seed for all four cells, so the sentence is the only thing that moves. */
const ROLL_SEED = "skin-tone-expression-court";
const PER_CELL = 3;

/*
  THE CLAUSES. Today's is quoted from `statedSkinSentence`'s own return and
  asserted against it below rather than retyped and hoped over — a hand copy of
  a product string is this campaign's most-repeated defect. The absolute clause
  is quoted from `describeAge`'s, the block the engine demonstrably obeys.
*/
const TODAY_CLAUSE = "— exactly as described.";
const ABSOLUTE_CLAUSE = "— this is an absolute casting requirement, not an approximation.";

/* Where cell B puts the sentence: immediately before the user's own words. */
const ANCHOR = "Character detail:";

const EXPECTED_SPEND = 4 * PER_CELL * 0.0400;

const lines: string[] = [];
const say = (text = "") => { console.log(text); lines.push(text); };

/**
 * ⚠ THE FOUR CELLS, BUILT AND PROVEN IN ONE PLACE.
 *
 * It lives in a function so `--prove-guard` drives THIS code rather than a
 * paraphrase of it that agrees with me, and every arm throws with its own
 * reason string — a guard whose arms all print one message cannot tell you
 * which one fired (the arm-asserts-its-own-reason rule).
 */
export function buildCells(
  todayPrompts: readonly string[],
  todaySentence: string,
): { A: string[]; B: string[]; AB: string[] } {
  const absoluteSentence = todaySentence.replace(TODAY_CLAUSE, ABSOLUTE_CLAUSE);
  if (absoluteSentence === todaySentence) {
    throw new Error(`the register swap changed nothing — the skin sentence no longer ends "${TODAY_CLAUSE}": ${todaySentence}`);
  }

  const A: string[] = [];
  const B: string[] = [];
  const AB: string[] = [];

  todayPrompts.forEach((prompt, index) => {
    if (!prompt.includes(` ${todaySentence}`)) {
      throw new Error(`prompt ${index}: the skin sentence is ABSENT — that cell renders no skin lane at all`);
    }
    if (!prompt.includes(ANCHOR)) {
      throw new Error(`prompt ${index}: no "${ANCHOR}" anchor — cell B has nowhere to move the sentence TO`);
    }

    /* A — same position, one clause different. */
    const a = prompt.replace(todaySentence, absoluteSentence);
    if (a.replace(absoluteSentence, todaySentence) !== prompt) {
      throw new Error(`prompt ${index}: cell A differs from today by more than the closing clause`);
    }
    A.push(a);

    /* B — same bytes, moved. A permutation, and it is proven as one. */
    const stripped = prompt.replace(` ${todaySentence}`, "");
    const b = stripped.replace(ANCHOR, `${todaySentence} ${ANCHOR}`);
    if (b.length !== prompt.length) {
      throw new Error(`prompt ${index}: cell B is ${b.length} bytes against today's ${prompt.length} — a move that changes the length is not a move`);
    }
    if (b.replace(`${todaySentence} `, "") !== stripped) {
      throw new Error(`prompt ${index}: cell B is not a PERMUTATION of today — something outside the skin sentence moved`);
    }
    if (b === prompt) {
      throw new Error(`prompt ${index}: cell B is byte-identical to today — the sentence was already at the anchor and B buys nothing`);
    }
    B.push(b);

    /* A+B — B's position with A's clause, proven against both. */
    const ab = b.replace(todaySentence, absoluteSentence);
    if (ab.replace(absoluteSentence, todaySentence) !== b) {
      throw new Error(`prompt ${index}: cell A+B differs from cell B by more than the closing clause`);
    }
    if (!ab.includes(`${absoluteSentence} ${ANCHOR}`)) {
      throw new Error(`prompt ${index}: cell A+B does not carry the absolute clause AT the moved position`);
    }
    AB.push(ab);
  });

  return { A, B, AB };
}

/*
  ⚠ THE POSITIVE CONTROL, and it runs before the network does.

  `--dry-run` proves the guard PASSES on real compiler output; that is a
  negative arm and it cannot find a guard that never refuses. This drives the
  same function over prompt sets built to fail, one defect at a time, and
  insists each one throws AND names its own reason.
*/
if (PROVE) {
  const SKIN = `SKIN: ${WANT_TONE}, ${WANT_CHARACTER} ${TODAY_CLAUSE}`;
  /*
    ⚠ The fixture must have the skin sentence AFTER the anchor, which is where
    the product actually puts it. The first draft of this block had it BEFORE,
    so every arm died on the already-at-the-anchor check before reaching the
    defect it was testing — a fixture family sharing one wrong property, which
    is a filed failure of this campaign's own.
  */
  const good = `SUBJECT: A man. ${ANCHOR} he wears a scar. ${SKIN} PRESENCE: grave.`;
  const arms: Array<{ what: string; run: () => void; expect: RegExp }> = [
    {
      what: "a prompt carries no skin sentence at all",
      expect: /prompt 1: the skin sentence is ABSENT/,
      run: () => buildCells([good, good.replace(` ${SKIN}`, "")], SKIN),
    },
    {
      what: "a prompt has no Character detail anchor for B to move to",
      expect: /prompt 0: no "Character detail:" anchor/,
      run: () => buildCells([good.replace(ANCHOR, "Note:")], SKIN),
    },
    {
      what: "the product's closing clause has changed under us",
      expect: /the register swap changed nothing/,
      run: () => buildCells([good], `SKIN: ${WANT_TONE} — said once.`),
    },
    {
      what: "the sentence already sits at the anchor, so B buys nothing",
      expect: /prompt 0: cell B is byte-identical to today/,
      run: () => {
        const already = `SUBJECT: A man. ${SKIN} ${ANCHOR} he wears a scar.`;
        buildCells([already], SKIN);
      },
    },
    {
      what: "NEGATIVE CONTROL — a well-formed prompt must NOT throw",
      expect: /^$/,
      run: () => {
        const ok = `SUBJECT: A man. ${ANCHOR} he wears a scar. ${SKIN} PRESENCE: grave.`;
        const cells = buildCells([ok], SKIN);
        if (!cells.A[0]!.includes(ABSOLUTE_CLAUSE)) throw new Error("A lost the absolute clause");
        if (!cells.B[0]!.includes(`${SKIN} ${ANCHOR}`)) throw new Error("B did not move the sentence to the anchor");
        if (!cells.AB[0]!.includes(`${ABSOLUTE_CLAUSE} ${ANCHOR}`)) throw new Error("A+B did not carry both");
      },
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

/* ─── THE COMPILE, AND EVERY ASSERTION BEFORE A SINGLE IMAGE IS BOUGHT ─── */

const { castingBriefCompiler } = await import("../server/castingV2/briefCompiler");
const { statedSkinSentence } = await import("../server/castingV2/cohortPhotorealHuman");

const dir = freeDir(OUT);
mkdirSync(dir, { recursive: true });

say("THE SKIN-TONE EXPRESSION COURT (opus-1275 §4, ordered fable-1658 §2)");
say(`  brief   ${BRIEF}`);
say(`  cells   TODAY · A register · B position · A+B      ${PER_CELL} renders each`);
say(`  judged  BY EYE on the strip — no reader is asked (law 9)`);
say(`  out     ${dir}`);
say();

const before = await readFalBalance();
if (!before.ok) throw new Error(`fal balance UNREAD — ${before.why}`);
say(`  expected spend $${EXPECTED_SPEND.toFixed(4)}  ·  fal balance before $${before.remaining.toFixed(4)}`);

/*
  ⚠ THE TOP-UP GUARD, ported from arm R and from court 3. $20 is the AMOUNT;
  the trigger is known only to sit between $8.67 and $10.01. A replenishment
  landing inside the run destroys the spend reading, so refuse rather than
  measure through it.

  ⚠ AND THE BALANCE IS NOT A SHIFT-CONTROLLED QUANTITY: production rolls spend
  from this same account, so it moves while nobody here is spending. Read it at
  dispatch time and never from a report.
*/
const FLOOR = 12;
const headroom = before.remaining - 2 * EXPECTED_SPEND;
say(`  top-up guard: balance - 2 x expected = $${headroom.toFixed(4)} against a $${FLOOR} floor`);
if (headroom <= FLOOR && !DRY) {
  throw new Error(`REFUSING: $${headroom.toFixed(2)} of headroom is inside the top-up's observed window`
    + " ($8.67-$10.01 trigger, $20 amount) — a replenishment mid-run destroys the price reading");
}
say();

/*
  THE FLAG IS ENTERED THE WAY THE PRODUCT ENTERS IT AND NO OTHER WAY:
  `rollService.ts:455` reads `captureCastingBriefFidelityEnabled(userId)` and
  hands the boolean to this same field. A court that set an env var and hoped
  would be measuring its own harness. Outside the flag `statedSkin` is null by
  construction and there would be no skin lane to move.
*/
const compiled = await castingBriefCompiler({
  briefText: BRIEF,
  candidateCount: PER_CELL,
  rollSeed: ROLL_SEED,
  briefFidelity: true,
} as never) as Record<string, any>;

const blob = (compiled.compiledBrief ?? {}) as Record<string, any>;
if (blob.interpreted !== true) throw new Error("the fallback compiled it — no population to measure");

const statedSkin = blob.intent?.statedSkin ?? null;
say(`  statedSkin the interpreter filed: ${JSON.stringify(statedSkin)}`);
if (statedSkin?.tone !== WANT_TONE || statedSkin?.character !== WANT_CHARACTER) {
  throw new Error(`the compile did not reproduce his pair — want ${JSON.stringify({ tone: WANT_TONE, character: WANT_CHARACTER })},`
    + ` got ${JSON.stringify(statedSkin)}. Every cell below is about a sentence that would not be his.`);
}

/*
  THE SENTENCE, DERIVED FROM THE PRODUCT rather than retyped. `statedSkinSentence`
  is the only author of this line in the product, so asking it is asking the
  thing that will be on the wire.
*/
const TODAY_SENTENCE = statedSkinSentence(statedSkin);
say(`  today's skin sentence: ${TODAY_SENTENCE}`);
if (!TODAY_SENTENCE.endsWith(TODAY_CLAUSE)) {
  throw new Error(`the product's skin sentence no longer ends "${TODAY_CLAUSE}" — this court's cell A is stale`);
}

const todayPrompts: string[] = (compiled.candidates ?? []).map((c: any) => c.prompt ?? "");
if (todayPrompts.length !== PER_CELL) throw new Error(`expected ${PER_CELL} prompts, got ${todayPrompts.length}`);

const { A, B, AB } = buildCells(todayPrompts, TODAY_SENTENCE);

say(`  compiled ${PER_CELL} prompts · interpreted · skin sentence in ${PER_CELL}/${PER_CELL}`);
say(`  cell A  register swapped, position unchanged, byte-identical otherwise   ${A.length}/${PER_CELL}`);
say(`  cell B  sentence moved before "${ANCHOR}", a proven permutation          ${B.length}/${PER_CELL}`);
say(`  cell A+B  both, asserted against A and against B                          ${AB.length}/${PER_CELL}`);
say();
say("  the moved sentence, in cell B's own bytes:");
say(`    …${B[0]!.slice(Math.max(0, B[0]!.indexOf(TODAY_SENTENCE) - 60), B[0]!.indexOf(ANCHOR) + ANCHOR.length)}…`);
say();

const CELLS = [
  { id: "TODAY", prompts: todayPrompts },
  { id: "A-REGISTER", prompts: A },
  { id: "B-POSITION", prompts: B },
  { id: "AB-BOTH", prompts: AB },
] as const;

writeFileSync(
  `${dir}/prompts.json`,
  JSON.stringify({
    rollSeed: ROLL_SEED,
    brief: BRIEF,
    statedSkin,
    todaySentence: TODAY_SENTENCE,
    absoluteSentence: TODAY_SENTENCE.replace(TODAY_CLAUSE, ABSOLUTE_CLAUSE),
    anchor: ANCHOR,
    cells: Object.fromEntries(CELLS.map((c) => [c.id, c.prompts])),
  }, null, 2),
  "utf8",
);

if (DRY) {
  say("--dry-run: every assertion passed and NOTHING was dispatched. One openrouter compile spent.");
  writeFileSync(`${dir}/dryrun.log`, lines.join("\n"), "utf8");
  process.exit(0);
}

/* ─── THE RENDERS ─── */

const engine = createFalCreativeEngine({ apiKey: process.env.FAL_KEY });

/* The dimensions are LOGGED and never divided by, so an engine that reports none
   is recorded as none rather than refused — unlike the colour court, which
   computes a share and must have them. */
type Row = { cell: string; pos: number; frameW: number | null; frameH: number | null; refused: boolean; why?: string };
const rows: Row[] = [];
const tiles: Array<{ cell: string; pos: number; bytes: Buffer }> = [];
let images = 0;
let refusals = 0;

for (const cell of CELLS) {
  say(`════ ${cell.id} ════`);
  for (let pos = 0; pos < cell.prompts.length; pos += 1) {
    try {
      const result = await engine.generateCandidate({
        prompt: cell.prompts[pos]!, size: "1024x1536", quality: "medium",
      } as never);
      images += 1;
      writeFileSync(`${dir}/${cell.id}-pos${pos}.png`, result.bytes);
      tiles.push({ cell: cell.id, pos, bytes: result.bytes });
      rows.push({ cell: cell.id, pos, frameW: result.width ?? null, frameH: result.height ?? null, refused: false });
      say(`  pos${pos}  frame ${result.width ?? "?"}x${result.height ?? "?"}`);
    } catch (error) {
      /*
        A REFUSAL IS A DATUM, not a crash — and on THIS court it is also a
        second reading worth having: if the ABSOLUTE register raises the wall,
        that is a cost of the lever and belongs beside its benefit.
      */
      refusals += 1;
      const why = error instanceof Error ? error.message : String(error);
      say(`  pos${pos}  REFUSED — ${why.slice(0, 160)}`);
      rows.push({ cell: cell.id, pos, frameW: null, frameH: null, refused: true, why: why.slice(0, 300) });
    }
  }
  say();
}

/* ─── THE STRIP, for his eye ─── */

if (tiles.length > 0) {
  const TILE_W = 320;
  const GUTTER = 190;
  const resized = await Promise.all(tiles.map(async (t) => ({
    ...t,
    buf: await sharp(t.bytes).resize({ width: TILE_W }).toBuffer(),
  })));
  const tileH = (await sharp(resized[0]!.buf).metadata()).height ?? 480;
  const rowOf = (cellId: string) => CELLS.findIndex((c) => c.id === cellId);

  const composites: sharp.OverlayOptions[] = resized.map((t) => ({
    input: t.buf,
    left: GUTTER + t.pos * TILE_W,
    top: rowOf(t.cell) * tileH,
  }));

  /*
    THE LABELS. A four-row strip whose rows are told apart by a sentence in a
    log is a strip that will be read wrong — his eye is the instrument here and
    it must not have to count rows. SVG text through sharp needs a font stack we
    have not proven on this machine, so it is attempted and its failure is
    REPORTED rather than swallowed: the per-cell PNGs are named on disk either
    way, so the mapping survives a label failure.
  */
  let labelled = false;
  try {
    const gutter = CELLS.map((c, i) => {
      const svg = `<svg width="${GUTTER}" height="${tileH}">`
        + `<rect width="100%" height="100%" fill="#141414"/>`
        + `<text x="14" y="${Math.round(tileH / 2)}" font-family="sans-serif" font-size="26" fill="#EBEBEB">${c.id}</text>`
        + `</svg>`;
      return { input: Buffer.from(svg), left: 0, top: i * tileH };
    });
    composites.push(...gutter);
    labelled = true;
  } catch (error) {
    say(`  ⚠ labels NOT drawn (${error instanceof Error ? error.message : String(error)}) — read the row order from this log`);
  }

  const stripPath = `${dir}/STRIP-skin-register-and-position.png`;
  await sharp({
    create: {
      width: GUTTER + TILE_W * PER_CELL,
      height: tileH * CELLS.length,
      channels: 3,
      background: { r: 20, g: 20, b: 20 },
    },
  }).composite(composites).png().toFile(stripPath);
  say(`kept ${stripPath}`);
  say(`  rows top to bottom: ${CELLS.map((c) => c.id).join(" · ")}${labelled ? "  (labelled in the gutter)" : ""}`);
  say("  columns are the SAME THREE PEOPLE in every row — the strip is paired down its columns");
  say();
}

/* ─── THE TABLE ─── */

say("THE READING");
for (const cell of CELLS) {
  const mine = rows.filter((r) => r.cell === cell.id);
  const landed = mine.filter((r) => !r.refused);
  say(`  ${cell.id.padEnd(11)} rendered ${landed.length}/${mine.length}`
    + (landed.length < mine.length ? `   ← ${mine.length - landed.length} refused` : ""));
}
say();
say("⚠ THIS SCRIPT GRADES NO TONE. Law 9: the strip is the verdict surface and his eye is the instrument.");
say("⚠ The refusal counts above are a SECOND reading — a register that raises the wall has a cost.");
say();

const after = await readFalBalance();
say(`fal balance after $${after.ok ? after.remaining.toFixed(4) : "UNREAD"}`
  + (after.ok ? `  ·  spent $${(before.remaining - after.remaining).toFixed(4)}` : ""));
say(`images ${images}  ·  provider refusals ${refusals}`);

writeFileSync(`${dir}/court.log`, lines.join("\n"), "utf8");
writeFileSync(`${dir}/rows.json`, JSON.stringify(rows, null, 2), "utf8");
console.log(`\nkept ${dir}/court.log and ${dir}/rows.json`);
process.exit(0);
