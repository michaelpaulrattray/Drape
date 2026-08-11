/**
 * THE FINDING-REPLAY WALK — his four findings, driven back at the build that
 * claims to have closed them. Specification: `docs/specs/FINDING_REPLAY_WALK.md`.
 *
 * # Two modes, and the second one cannot run without the first
 *
 *   `--controls`   drives every instrument against HIS OWN stored frames, spends
 *                  no credits, and exits non-zero if any instrument cannot fail.
 *   `--spend`      walks the five steps for real: 125 credits on his account.
 *                  It RUNS THE CONTROLS FIRST, in the same invocation, and
 *                  refuses to spend a credit if one of them is red.
 *
 * A counter that has never counted one earring is not a counter, so proving the
 * instruments belongs inside the freeze rather than on the morning it thaws.
 * The controls are not a flag the operator may forget: `--spend` does not
 * consult `--controls`, it executes them.
 *
 * # The order of refusals, and why the freeze is first
 *
 * `spendAuthorized()` is asked before an argument is even validated. This file
 * shipped once asking `process.argv.includes("--spend")` directly, and
 * `stopline --prove`'s derived roster caught it: an account spender whose
 * refusal was its own opinion rather than the freeze's. The walk costs 125
 * credits on his real account, so the freeze must be the FIRST answer it gets.
 *
 * Then, before the first credit: the controls, the face (step 5 is meaningless
 * on a face wearing no glasses), and the price — printed as a plan a person can
 * read. A dry run reaches every one of those and stops there, so the pre-flight
 * is not something only a spend can exercise.
 *
 * # All four controls are armed (2026-08-10), and two carry declared deviations
 *
 *   A  the pair counter, on his own two frames — the counter's third design,
 *      which cuts her in half before asking
 *   B  the accessory arithmetic, on an ADDITION rather than the specified
 *      replacement, with the reader's mask rather than a stored segment —
 *      both deviations declared at the control, neither smoothed over
 *   C  the seam reader, on his own shirt-seam numbers, through the same
 *      `readSeamRow` the production sweep uses
 *   D  the product's OWN verification reader, on readings it already took —
 *      v#163 says the hair is down, v#164 says it is not
 *
 * Where a control cannot cover the whole of its assertion, the remainder is
 * recorded with `absent()` — not applicable and NOT a pass — so a reader cannot
 * mistake a proven instrument for a delivered measurement.
 *
 * # Control A — the pair counter, on his own two frames
 *
 * v#156 is the frame he found: he asked for "gold hoop earrings" and got ONE,
 * and the stored verdict says `verified` over a `saw` that reads *"gold hoop
 * earring visible on visible ear"* — singular, one ear, accepted. That is the
 * false pass, disclosed by its own words.
 *
 * So the counter asks the two ears as TWO QUESTIONS. The bilateral union the
 * reader returns for `ear` is exactly what cannot be used here: one hoop and
 * nothing unions to a non-empty mask, which is the shape of the original miss.
 *
 *   POSITIVE (must FAIL)   v#156  ffe31dae…  one hoop, image-right ear
 *   NEGATIVE (must PASS)   v#147  8ac53e6e…  two hoops, one per ear
 *
 * Both were chosen by LOOKING at the crops (`pull-earring-specimens`), not by
 * trusting the reader that already got one of them wrong.
 *
 *   # controls only, no credits
 *   FAL_KEY=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/drive-finding-replay.mts --controls \
 *       --bucket https://pub-990e39d8d995468eb61aced83162123a.r2.dev
 *
 *   # the dry run: controls optional, face and price proven, nothing charged
 *   FAL_KEY=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/drive-finding-replay.mts --bucket https://pub-990e39d8… \
 *       --base https://drape-production-0232.up.railway.app --token <jwt> \
 *       --candidate <publicId>
 *
 *   # the walk itself — 125 credits, and only when the STOPLINE is gone
 *   FAL_KEY=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/drive-finding-replay.mts … --spend
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

import { assertOneWorld, readLocalEnvFile } from "./lib/worldGuard.mts";
import { assertPreconditionsProved, spendAuthorized } from "./lib/stopline.mts";
import { createChecks, openDrivenPage, type Checks } from "./lib/drivePage.mts";
import {
  createCurrentFaceKey, createLandedImageKey, createTrpcQuery, createViewerOpener,
  locateCandidate, refineStep, type RefineObservation,
} from "./lib/refineDriver.mts";
import { settleAttemptRows } from "./lib/attemptRows.mts";
import { adjudicateCarried, adjudicateCandidateCarries, formatCarriedVerdict } from "./lib/carriedAdjudicator.mts";
import {
  CLEAN_BOUNDARY_COHERENCE, FOUNDER_SEAM_COHERENCE, readSeamRow, seamRates, SEAM_CONTROL_ROWS,
} from "./lib/seamRows.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { readResolvedIdentity } from "../server/castingV2/rollService";
import { currentValueOfFacet } from "../server/castingV2/refineDelta";
import type { Mask } from "../server/castingV2/maskedComposite";
import { openDatabase } from "./lib/dbConnection.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

/*
  `--spend` THROUGH THE ONE DOOR, not a hand-rolled read of argv.

  Asked before the arguments are validated, because the freeze outranks every
  other reason this run might refuse. `spendAuthorized` THROWS while the
  STOPLINE exists; the boolean it returns is only ever reached on a running
  line.
*/
const SPEND = spendAuthorized("walk the finding replay (125 credits on his account)");
const CONTROLS = process.argv.includes("--controls");
/**
 * `--rehearse` — everything the walk does EXCEPT type and submit.
 *
 * The browser half of this driver is the half that cannot be reasoned about:
 * whether her tile opens, whether the reset finds the Original, whether the kept
 * panel's thumbnails really carry segment object keys the way this file assumes.
 * Getting any of that wrong is not discovered until after 125 credits, and it
 * would look like a product defect on five consecutive steps.
 *
 * None of it costs anything. Opening a viewer and selecting a version are
 * navigation between pictures that already exist (D-121), so the whole path up
 * to the keystroke can be driven inside the freeze — and it is the only part of
 * `--spend` that is testable without spending, which makes it obligatory rather
 * than nice.
 */
const REHEARSE = process.argv.includes("--rehearse");
const OUT = path.resolve(arg("out", "output/finding-replay"));

const APP_BASE = arg("base");
const TOKEN = arg("token");
const CANDIDATE = arg("candidate");

/*
  A BARE INVOCATION IS ANSWERED, NOT CRASHED INTO.

  Ahead of every other requirement, because a run that was asked to do nothing
  should not be told which argument it is missing for the work it was not asked
  to do. Everything below this line is a precondition of real work.
*/
if (!CONTROLS && !SPEND && !REHEARSE && !CANDIDATE) {
  console.log(
    "Nothing to do. `--controls` drives the instruments against his own frames; "
    + "add --base/--token/--candidate for the dry run, `--rehearse` to drive the "
    + "browser without typing, and --spend to walk it.",
  );
  process.exit(0);
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const base = arg("bucket").replace(/\/$/, "");
if (!base) throw new Error("--bucket <public url> is required — these are production frames");
if (base === (readLocalEnvFile().get("R2_PUBLIC_URL") ?? "").replace(/\/$/, "")) {
  throw new Error("--bucket is the local .env's bucket — the dev world, and these rows are production's");
}
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — the counter is a real segmentation read");

if ((SPEND || REHEARSE) && (!APP_BASE || !TOKEN || !CANDIDATE)) {
  throw new Error(
    `--base, --token and --candidate are all required to ${SPEND ? "spend" : "rehearse"}. `
    + "Refusing to walk a face I cannot name rather than guessing at one "
    + "(see mint-production-session.mts for the token).",
  );
}

/**
 * HIS OWN FRAMES, BY PUBLIC ID.
 *
 * Pinned by `publicId` rather than by `v#156`, because the display number is a
 * row id and a row number is not a fact. The comment carries the number so the
 * mailbox and the frames can be lined up by a person.
 */
const SPECIMENS = [
  {
    label: "v#156 — the frame he found: ONE hoop, verdict 'verified'",
    publicId: "ffe31dae-afac-4fd7-af15-46fb65ee273a",
    /* The control's whole job: this must come back as NOT a pair. */
    expectPair: false,
  },
  {
    label: "v#147 — two hoops, one per ear, looked at at 900px",
    publicId: "8ac53e6e-ac36-4a83-83be-a17e04593450",
    expectPair: true,
  },
] as const;

/**
 * D'S CONTROL PAIR, and it is made of readings the PRODUCT already took.
 *
 * Both rows carry a `hairWorn` check asked with the same word, on the same face,
 * one verified and one not — so "still down" is a reading that has demonstrably
 * been able to say otherwise. v#164 is also his finding 4 in the product's own
 * words: *"hair pulled back, gathered at the nape"*, recorded and not refunded.
 */
const HAIR_CONTROL = [
  {
    label: "NEGATIVE — v#163, the hair came down: the reader says DOWN",
    publicId: "1e14ed6e-1008-4e3f-9b9f-a3332b1fa0f9",
    expectDown: true,
  },
  {
    label: "POSITIVE — v#164, the hair went back up: the reader says NOT down",
    publicId: "cafa4777-f990-480b-bd42-6a44a874054d",
    expectDown: false,
  },
] as const;

/**
 * B'S STAND-IN PAIR — v#155 wears nothing, its child v#156 wears a delivered hoop.
 *
 * The first choice was v#163 → v#164 (his own cross-earring ask) and it was WRONG,
 * which the control said out loud: no earring region on either half of the
 * after-frame. Its own stored verdict had already said why — `statedAccessories`
 * verified FALSE, *"small stud earrings, no dangly cross earrings visible"*. The
 * asked-for accessory never arrived, so there was no delivered change for the
 * arithmetic to find, and a control needs a change that HAPPENED rather than one
 * that was requested.
 *
 * v#155 → v#156 is a parent-child pair on one branch where the pixels genuinely
 * moved: A's counter measures 643px of hoop on v#156's right ear, and v#155 has
 * bare ear there. Ordered before → after.
 */
const EARRING_CHANGE = [
  { label: "v#155 — bare ears (\"add nude lip gloss\")", publicId: "bcca0df7-a5af-4c3c-b4ee-39ca9c6ddc2e" },
  { label: "v#156 — a hoop delivered on one ear", publicId: "ffe31dae-afac-4fd7-af15-46fb65ee273a" },
] as const;

/**
 * How much of an ear an earring has to claim before it counts as present.
 *
 * Stated rather than tuned: a hoop on a 1024×1536 portrait is a ring a few
 * dozen pixels across, so the floor is set far below the smaller specimen and
 * far above the handful of stray pixels a segmenter returns for nothing. The
 * two specimens' measured numbers are printed on every run, so the day one of
 * them drifts toward this line it is visible rather than silent.
 */
const PRESENT_AT = 40;

/**
 * AND HOW MUCH OF AN EAR HAS TO BE THERE BEFORE "NO EARRING" MEANS ANYTHING.
 *
 * A clean null is evidence only if the fixture could have produced a non-null.
 * On a face whose ear is behind her hair, "no earring on this side" is a
 * NO-READ, not an absence — and scoring it as a miss would book a product
 * failure against a physical impossibility. His finding was precise about this:
 * one earring, *the other ear bare AND VISIBLE*. An ear nobody can see is not
 * an ear he could have complained about.
 *
 * Measured rather than chosen (`measure-ear-visibility-disposable`, 2026-08-10),
 * per side, across every frame this campaign has LOOKED at:
 *
 *   v#147  two hoops, both ears visible      left 3118px   right 3222px
 *   v#156  one hoop, the other ear bare      left 2800px   right 2497px
 *   4dad875d  bespectacled, hair loose        left 1812px   right 2137px
 *   32d1d79e  bespectacled, hair worn up      left 1756px   right 1927px
 *
 * **Four positives and no measured negative**, and that is stated rather than
 * dressed up: nothing here is a frame whose ear is genuinely hidden, so this
 * floor is not calibrated against the case it exists to catch. It is set four
 * times below the smallest ear ever measured, so it fires only when the
 * segmenter finds essentially nothing — and every reading prints its number, so
 * a face drifting toward the line is visible rather than silent.
 */
const EAR_VISIBLE_AT = 400;

/** How different two greyscale pixels must be before the picture "moved". */
const MOVED_AT = 12;

/**
 * THE WALK, AND THE ORDER IS THE POINT — reordered by fable-135, for a reason
 * the harness found rather than a preference.
 *
 * The plan opened with *"wear her hair down"*. Hair worn down goes over the
 * ears, and assertions A and B are both about what is ON an ear — so the walk's
 * own first step could remove the thing its next two assertions are about, and
 * a NO-READ there closes nothing. **Findings 1/2 and findings 3/4 came from
 * different chains of his anyway; the conflation was ours.**
 *
 * So the accessories go first, while her ears are visible, and the hair follows.
 * Every assertion gets a window in which it can actually be made:
 *
 *   1  gold hoop earrings     ears visible (she is rolled hair-up) — A armed
 *   2  dangly cross earrings  the REPLACEMENT: pair and swap, A and B armed
 *   3  copper hair            the unrelated ask — B's byte check on the
 *                             crosses' own mask, BEFORE hair can supersede it
 *   4  wear her hair down     finding 4's subject; C reads THIS row's seam
 *   5  remove her glasses     the ghost rim, and a later ask after hair-down,
 *                             which is finding 4's own reproduction window
 *
 * Findings 1 and 2 are closed at steps 1–3. Finding 4's mechanism — a later ask
 * re-pinning her hair off the master — is exercised by step 5 following step 4,
 * which is the same length as his own sequence (one later ask). If the hair
 * covers her ears by steps 4–5, A is legitimately a NO-READ there and has
 * already been answered.
 *
 * No step may be dropped for being expensive: "a partial replay reported as a
 * replay is the flattering direction".
 */
const WALK = [
  { instruction: "gold hoop earrings", serves: "1 — a pair, on visible ears" },
  { instruction: "dangly cross earrings", serves: "1, 2 — the replacement" },
  { instruction: "copper hair", serves: "2 — an unrelated ask that must not move the ears" },
  { instruction: "wear her hair down", serves: "3, 4" },
  { instruction: "remove her glasses", serves: "3, 4 — the ghost rim, and a later ask" },
] as const;

/** Indices, named — so a reorder cannot silently re-aim an assertion. */
const STEP = { hoops: 0, crosses: 1, copperHair: 2, hairDown: 3, removeGlasses: 4 } as const;

const COST_PER_STEP = 25;

function pixels(mask: Mask): number {
  let count = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] > 0) count += 1;
  return count;
}

/**
 * EVERY MASK SAM 3 RETURNS, UNIONED — and this harness has to ask fal itself.
 *
 * `createFalRegionReader.region()` takes `masks[0]` and drops the rest, which
 * is right for its job (a region is one region) and fatal for this one: asked
 * "earring" on a frame wearing two, it returned 472px on ONE ear and nothing
 * on the other, because the second hoop was the second mask. A counter that
 * inherits "first answer only" cannot count past one.
 *
 * The product's own bilateral regions were losing their second side through a
 * different door, and that was found, fixed and shipped (`58725856`, D-238):
 * SAM 3 returns exactly one mask, so `masks[0]` was innocent and the cure was
 * this file's own — cut the frame first.
 */
async function askEveryMask(image: Buffer, prompt: string): Promise<Mask> {
  const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${image.toString("base64")}`,
      prompt,
      include_scores: true,
      output_format: "png",
    }),
  });
  if (!response.ok) throw new Error(`sam-3 ${prompt}: ${response.status} ${(await response.text()).slice(0, 160)}`);
  const json: any = await response.json();
  const entries: any[] = Array.isArray(json.masks) ? json.masks : [];
  const sharpModule = (await import("sharp")).default;

  let union: Mask | null = null;
  for (const entry of entries) {
    const url = typeof entry === "string" ? entry : entry?.url;
    if (!url) continue;
    const raw = url.startsWith("data:")
      ? Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
      : Buffer.from(await (await fetch(url)).arrayBuffer());
    const meta = await sharpModule(raw).metadata();
    const pipeline = meta.hasAlpha ? sharpModule(raw).extractChannel(3) : sharpModule(raw).toColourspace("b-w");
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    if (data.length !== info.width * info.height) continue;
    if (!union) {
      union = { data: Buffer.from(data), width: info.width, height: info.height };
      continue;
    }
    if (union.width !== info.width || union.height !== info.height) continue;
    for (let at = 0; at < union.data.length; at += 1) {
      if (data[at] > 0) union.data[at] = 255;
    }
  }
  if (union) {
    console.log(`      sam-3 "${prompt}" returned ${entries.length} mask(s)`);
    return union;
  }
  /* Nothing there is an answer, and it is the answer a bare ear gives. */
  const meta = await sharpModule(image).metadata();
  return { data: Buffer.alloc((meta.width ?? 1) * (meta.height ?? 1), 0), width: meta.width ?? 1, height: meta.height ?? 1 };
}

/** Her own vertical axis — the centroid of the face region, or null if it read nothing. */
function centroidX(mask: Mask): number | null {
  let total = 0;
  let weighted = 0;
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[row + x] === 0) continue;
      total += 1;
      weighted += x;
    }
  }
  return total === 0 ? null : weighted / total;
}

const connection = await openDatabase({
  uri: process.env[databaseKey]!, timezone: "Z",
} as mysql.ConnectionOptions);
const reader = createFalRegionReader({ apiKey });
const checks = createChecks();
const { check, absent, records, failures, print } = checks;
await mkdir(OUT, { recursive: true });

async function frameOf(publicId: string): Promise<{ id: number | null; bytes: Buffer | null; why: string }> {
  const [row] = await connection.query<any[]>(
    "SELECT id, imageKey FROM casting_candidate_variants WHERE publicId = ? LIMIT 1",
    [publicId],
  ).then(([rows]) => rows as any[]);
  if (!row?.imageKey) return { id: row?.id ?? null, bytes: null, why: `no frame for ${publicId} — wrong world, or the row is gone` };
  const response = await fetch(`${base}/${row.imageKey}`);
  if (!response.ok) return { id: row.id, bytes: null, why: `frame HTTP ${response.status}` };
  return { id: row.id, bytes: Buffer.from(await response.arrayBuffer()), why: "" };
}

/**
 * THE PAIR COUNTER — one derivation, used by the control AND by assertion A.
 *
 * Third instrument, and the two it replaces are worth keeping in view because
 * each failed differently on his own frames:
 *
 *   "left earring" / "right earring"   740px and 728px on a ONE-hoop frame —
 *                                      the same hoop returned twice. SAM 3
 *                                      answers the noun and ignores the
 *                                      laterality entirely.
 *   "earring", every mask unioned      472px on ONE ear of a TWO-hoop frame:
 *                                      the model returned exactly 1 mask.
 *                                      Asked about a class, it answers with an
 *                                      instance, so a count cannot be taken
 *                                      from it however the masks are handled.
 *
 * Both were the same mistake — asking a question whose answer has to be trusted
 * to be complete. Cutting her in half first removes the trust: each call can
 * only answer about the pixels it was handed, so "is there an earring on THIS
 * side" is a question the model cannot answer laterally wrong.
 *
 * The midline is her FACE's, not the image's, because a portrait is not
 * guaranteed centred.
 *
 * **The walk's assertion A and the control run this same function.** A counter
 * proved on his frames and a second one grading the walk would be the mirror
 * law #4 forbids, and the difference between them would be invisible.
 */
async function countEarringPair(bytes: Buffer, tag: string): Promise<{
  sides: Array<{ side: string; px: number; ear: number }>;
  isPair: boolean;
  present: number;
  /** Sides whose EAR could not be found — where "no earring" is a no-read. */
  unreadable: string[];
  saw: string;
  midline: number;
  width: number;
}> {
  const sharpModule = (await import("sharp")).default;
  const face = await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
  const meta = await sharpModule(bytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const midline = Math.round(centroidX(face) ?? width / 2);

  const sides = await Promise.all(([
    { side: "left", left: 0, width: midline },
    { side: "right", left: midline, width: width - midline },
  ] as const).map(async (half) => {
    const halfBytes = await sharpModule(bytes)
      .extract({ left: half.left, top: 0, width: half.width, height })
      .png()
      .toBuffer();
    /* The earring and the EAR, on the same crop — see `EAR_VISIBLE_AT`. Asked
       together so the two readings can never be of different pixels. */
    const [mask, ear] = await Promise.all([
      askEveryMask(halfBytes, "earring"),
      askEveryMask(halfBytes, "ear"),
    ]);
    await writeFile(
      path.join(OUT, `mask-${tag}-${half.side}.png`),
      await sharpModule(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
        .resize({ width: 320 }).png().toBuffer(),
    );
    return { side: half.side, px: pixels(mask), ear: pixels(ear) };
  }));

  const present = sides.filter((side) => side.px >= PRESENT_AT).length;
  const unreadable = sides.filter((side) => side.ear < EAR_VISIBLE_AT).map((side) => side.side);
  return {
    sides,
    present,
    unreadable,
    isPair: present === 2,
    midline,
    width,
    saw: `${sides.map((side) => `${side.side}=${side.px}px earring on ${side.ear}px of ear`).join(", ")} `
      + `across her face's midline at x=${midline} of ${width} `
      + `(earring present at ≥${PRESENT_AT}px: ${present}; ear visible at ≥${EAR_VISIBLE_AT}px: ${2 - unreadable.length}/2)`,
  };
}

/** How much of a mask's pixels differ between two same-sized greyscale rasters. */
function movedShare(mask: Mask, before: Buffer, after: Buffer): { moved: number; sampled: number } {
  let moved = 0;
  let sampled = 0;
  for (let at = 0; at < mask.data.length; at += 1) {
    if (mask.data[at] === 0) continue;
    sampled += 1;
    if (Math.abs(before[at] - after[at]) > MOVED_AT) moved += 1;
  }
  return { moved, sampled };
}

/* ==========================================================================
   THE CONTROLS — every instrument, driven against his own stored frames.
   ========================================================================== */

async function runControls(): Promise<void> {
  console.log("\n════ CONTROLS — every instrument, against his own frames ════");

  /* ----------------------------------------------- control A: the pair counter */

  for (const specimen of SPECIMENS) {
    const frame = await frameOf(specimen.publicId);
    if (!frame.bytes) {
      check(false, `A: ${specimen.label}`, frame.why);
      continue;
    }
    const counted = await countEarringPair(frame.bytes, `v${frame.id}`);
    /*
      BOTH OF HIS SPECIMENS HAVE TWO VISIBLE EARS — measured, 2,497px at the
      smallest. A side that stopped reading as an ear would mean the specimen
      changed under us, and the control must say so rather than quietly grading
      an earring count on a crop with no ear in it.
    */
    check(
      counted.unreadable.length === 0 && counted.isPair === specimen.expectPair,
      `A: ${specimen.label} reads ${specimen.expectPair ? "as a PAIR" : "as NOT a pair"}`,
      `${counted.saw} → ${counted.isPair ? "pair" : "not a pair"}`
      + (counted.unreadable.length ? ` — but no EAR on the ${counted.unreadable.join("/")}, so this specimen no longer poses the question` : ""),
    );
  }

  /* ------------------------------------------------------- control C: the seam */

  /*
    CAN THE SEAM INSTRUMENT EXPRESS HIS DEFECT AT ALL?

    Nothing here reads the walk's own rows, because the walk has not run — and that
    was the reason this control sat unarmed, which was a mistake about what the
    control is FOR. C's risk is not "no rows yet", it is *the reader is blind to the
    thing he saw*: his shirt seam scored ZERO pixels over the tear bar, so the
    amplitude number cannot express it at any threshold. What must be shown before
    the walk is that the coherence statistic can, and that is provable today against
    his own numbers.

    Both rows go through the SAME `readSeamRow` the production sweep uses, so this
    is the real reader rather than a restatement of it — which is also the spec's
    "run the selftest in the same session", satisfied in-process rather than by
    shelling out to a second copy of the same reading.
  */
  {
    const seams = SEAM_CONTROL_ROWS.map((row) => readSeamRow(row)).filter((row): row is NonNullable<typeof row> => !!row);
    const clean = seams.find((row) => row.requestText.includes("clean boundary"));
    const his = seams.find((row) => row.requestText.includes("shirt seam"));

    check(
      seams.length === SEAM_CONTROL_ROWS.length,
      "C: the seam reader reads a row that carries a verdict",
      `${seams.length} of ${SEAM_CONTROL_ROWS.length} control rows mapped`,
    );
    check(
      !!his && his.coherence === FOUNDER_SEAM_COHERENCE && his.worstExcess < 80 && !his.torn,
      "C: POSITIVE — his own shirt seam is expressed by COHERENCE while passing the tear bar",
      his
        ? `coherence ${his.coherence} with worstExcess ${his.worstExcess} (<80) and torn=${his.torn}`
        : "his control row did not map",
    );
    check(
      !!clean && clean.coherence === CLEAN_BOUNDARY_COHERENCE,
      "C: NEGATIVE — an ordinary clean boundary scores near zero on the same statistic",
      clean ? `coherence ${clean.coherence?.toFixed(3)}` : "the clean control row did not map",
    );
    const rates = seamRates(seams);
    check(
      rates.coherence !== null && rates.coherence.max > rates.coherence.median * 0 + CLEAN_BOUNDARY_COHERENCE,
      "C: the two rates separate the two rows rather than averaging them away",
      rates.coherence
        ? `n=${rates.coherence.n}, median ${rates.coherence.median.toFixed(3)}, max ${rates.coherence.max.toFixed(3)}`
        : "no coherence statistic on either row",
    );
    /*
      AND THE HONEST OTHER HALF: the walk's own rows are what the step actually
      produces, and there are none until it runs. Recorded as not-applicable rather
      than as a pass, so a reader of this output cannot mistake a proven instrument
      for a delivered measurement.
    */
    absent(
      "C: the walk's own seam rows",
      "no walk has run on this build, so there is no delivered row to read — the step's "
      + "output is the number plus his eye on the frame, and both arrive with the walk",
    );
  }

  /* --------------------------------------- control D: the hair is still down */

  /*
    THE INSTRUMENT IS THE PRODUCT'S OWN VERIFICATION READER, and its control pair is
    ALREADY ON HIS ROWS — which is better than driving a reader again, because these
    are the readings the product itself took at render time.

    Same face, same branch, same facet, same `asked` string:

      v#163  "she wear her hair down"    hairWorn "down"  verified TRUE
                                         saw: "Long dark hair falling loose past the
                                         shoulders, parted in center"
      v#164  "dangly cross earrings"     hairWorn "down"  verified FALSE
                                         saw: "hair pulled back, gathered at the nape"

    So the reading has been able to say otherwise, on this face, about this facet —
    which is exactly what the spec demands before "still down" counts for anything.
    And v#164 IS his finding 4, in the product's own words, already recorded and
    `binding: false`, which is why it was seen and not refunded.
  */
  {
    const pairs = await Promise.all(HAIR_CONTROL.map(async (specimen) => {
      const [row] = await connection.query<any[]>(
        "SELECT id, requestText, internalPrompt FROM casting_candidate_variants WHERE publicId = ? LIMIT 1",
        [specimen.publicId],
      ).then(([rows]) => rows as any[]);
      const prompt = typeof row?.internalPrompt === "string" ? JSON.parse(row.internalPrompt) : row?.internalPrompt;
      const checkRows: any[] = prompt?.verification?.checks ?? [];
      const hair = checkRows.find((entry) => entry?.facet === "hairWorn");
      return { specimen, id: row?.id, hair };
    }));

    for (const pair of pairs) {
      check(
        !!pair.hair && pair.hair.read === true && pair.hair.verified === pair.specimen.expectDown,
        `D: ${pair.specimen.label}`,
        pair.hair
          ? `hairWorn asked=${JSON.stringify(pair.hair.asked)} read=${pair.hair.read} `
            + `verified=${pair.hair.verified} — saw: ${String(pair.hair.saw ?? "").slice(0, 90)}`
          : `v#${pair.id ?? "?"} carries no hairWorn check`,
      );
    }
    check(
      pairs.length === 2 && pairs[0].hair?.asked === pairs[1].hair?.asked,
      "D: both controls answered the SAME question, so the difference is the picture",
      `asked ${JSON.stringify(pairs.map((pair) => pair.hair?.asked))}`,
    );
  }

  /* ---------------------------- control B: the earring pixels move, or do not */

  /*
    B'S CONTROL IS A STAND-IN, AND IT IS DECLARED AS ONE.

    The spec asks for a DELIBERATE REPLACEMENT (hoops → crosses) between two frames
    of one walk, and swept over every variant on his account there is none: no branch
    anywhere replaces one stated accessory with another. What does exist is an
    ADDITION on one branch — v#155 wears nothing, its child v#156 got a hoop — and
    the control's actual job is served by it exactly: **the arithmetic must report
    DIFFERENT for an accessory region that genuinely changed.** A comparison that
    says "identical" there is measuring the wrong region, which is the only thing
    this control exists to catch.

    Two deviations from the spec, both stated rather than smoothed over:

    1. It is an addition, not a replacement. The replacement comparison arrives with
       the walk's own accessory steps (1→2) and is not available before it.
    2. The mask is the READER's earring region, not a stored `statedAccessories`
       segment — because there is no such segment anywhere in production (all 14 are
       `marks`, `makeup`, `hairWorn` and `eye.colour`). When the walk produces one,
       B's live assertion uses it; this control proves the arithmetic can see a
       change at all.

    The ear side is chosen by the pair counter's method — cut at her own midline,
    ask each half — so the region compared cannot be laterally wrong.
  */
  {
    const frames = await Promise.all(EARRING_CHANGE.map(async (specimen) => ({
      specimen, ...(await frameOf(specimen.publicId)),
    })));

    if (frames.some((frame) => frame.bytes === null)) {
      check(false, "B: both frames of the accessory change are readable",
        frames.map((frame) => `v#${frame.id ?? "?"}=${frame.bytes ? "ok" : "MISSING"}`).join(" "));
    } else {
      const sharpModule = (await import("sharp")).default;
      const [before, after] = frames as Array<{ specimen: any; id: number; bytes: Buffer }>;
      const meta = await sharpModule(after.bytes).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;

      const face = await reader.region({ image: after.bytes, name: "face", absentIsAnswer: true });
      const midline = Math.round(centroidX(face) ?? width / 2);

      /* The ear that CHANGED, found on the after-frame, one half at a time. */
      const halves = await Promise.all(([
        { side: "left", left: 0, width: midline },
        { side: "right", left: midline, width: width - midline },
      ] as const).map(async (half) => {
        const crop = { left: half.left, top: 0, width: half.width, height };
        const [beforeHalf, afterHalf] = await Promise.all([
          sharpModule(before.bytes).extract(crop).png().toBuffer(),
          sharpModule(after.bytes).extract(crop).png().toBuffer(),
        ]);
        const mask = await askEveryMask(afterHalf, "earring");
        const px = pixels(mask);
        if (px < PRESENT_AT) return { side: half.side, px, changed: 0, sampled: 0 };

        /* Inside that mask only, how much of the picture actually moved. */
        const [beforeRaw, afterRaw] = await Promise.all([
          sharpModule(beforeHalf).resize({ width: mask.width, height: mask.height, fit: "fill" })
            .toColourspace("b-w").raw().toBuffer(),
          sharpModule(afterHalf).resize({ width: mask.width, height: mask.height, fit: "fill" })
            .toColourspace("b-w").raw().toBuffer(),
        ]);
        const { moved, sampled } = movedShare(mask, beforeRaw, afterRaw);
        return { side: half.side, px, changed: moved, sampled };
      }));

      const measured = halves.filter((half) => half.sampled > 0);
      const share = (half: { changed: number; sampled: number }) => half.changed / half.sampled;
      const loudest = measured.sort((a, b) => share(b) - share(a))[0];
      const saw = halves
        .map((half) => `${half.side}: ${half.px}px earring, ${half.changed}/${half.sampled} moved`)
        .join("  ");
      console.log(`      ${saw}`);

      check(
        !!loudest && share(loudest) > 0.25,
        "B: POSITIVE — the arithmetic reports DIFFERENT where an accessory genuinely changed",
        loudest
          ? `${saw} → ${(share(loudest) * 100).toFixed(1)}% of the earring region moved on the ${loudest.side}`
          : "no earring region was found on either side of the after-frame",
      );

      /*
        AND THE OTHER DIRECTION, on the same two frames and the same arithmetic.

        An instrument that can only ever report DIFFERENT would make B's real
        assertion — *these are the same pixels* — impossible to satisfy, and would
        fail the walk for a defect that was not there. The spec asks only for the
        replacement control; the house rule is both. The region is the BARE ear on
        the other side of the same pair: it exists in both frames, and the only edit
        between them put a hoop on the opposite ear, so nothing here should have
        moved. A self-comparison would prove only that the loop can count zero.
      */
      const bare = { left: 0, top: 0, width: midline, height };
      const [bareBefore, bareAfter] = await Promise.all([
        sharpModule(before.bytes).extract(bare).png().toBuffer(),
        sharpModule(after.bytes).extract(bare).png().toBuffer(),
      ]);
      const earMask = await askEveryMask(bareAfter, "ear");
      if (pixels(earMask) < PRESENT_AT) {
        check(false, "B: NEGATIVE — the same arithmetic reports UNCHANGED where nothing moved",
          `no ear found on the untouched side (${pixels(earMask)}px), so the negative has no region to measure`);
      } else {
        const [rawBefore, rawAfter] = await Promise.all([
          sharpModule(bareBefore).resize({ width: earMask.width, height: earMask.height, fit: "fill" })
            .toColourspace("b-w").raw().toBuffer(),
          sharpModule(bareAfter).resize({ width: earMask.width, height: earMask.height, fit: "fill" })
            .toColourspace("b-w").raw().toBuffer(),
        ]);
        const { moved, sampled } = movedShare(earMask, rawBefore, rawAfter);
        const bareShare = sampled === 0 ? 1 : moved / sampled;
        console.log(`      the untouched ear: ${moved}/${sampled} moved (${(bareShare * 100).toFixed(1)}%)`);
        check(
          bareShare < 0.05,
          "B: NEGATIVE — the same arithmetic reports UNCHANGED where nothing moved",
          `the untouched ear on the other side: ${moved}/${sampled} pixels moved `
          + `(${(bareShare * 100).toFixed(1)}%) against ${(share(loudest!) * 100).toFixed(1)}% where the hoop arrived`,
        );
      }
      absent(
        "B: the REPLACEMENT comparison, and the segment's own mask",
        "no branch in production replaces one stated accessory with another, and no "
        + "`statedAccessories` segment exists anywhere (all 14 are marks/makeup/hairWorn/eye.colour) — "
        + "both arrive with the walk's own accessory steps (1→2), and this control stands in for neither",
      );
    }
  }
}

/* ==========================================================================
   THE WALK — five steps, 125 credits, and the five assertions afterwards.
   ========================================================================== */

/** What one step of the walk did, kept for the record and for the assertions. */
type StepRecord = {
  instruction: string;
  serves: string;
  outcome: RefineObservation["outcome"];
  said: string | null;
  answers: string[];
  imageUrl: string | null;
  seconds: number;
  /** The kept-panel's own content keys, read from the DOM after this step. */
  panelContentKeys: string[];
  /** Null when the panel was absent — which is legitimate on a face keeping nothing. */
  panelRows: number | null;
  /**
   * THE STORE AS IT WAS WHEN THE PANEL WAS PHOTOGRAPHED.
   *
   * E compares two views of one store, so they have to be views of the SAME
   * moment. Segments are persisted after the variant lands — the picture is
   * already delivered and paid for, and keeping its pixels is deliberately the
   * least important thing left in the request — so a panel read at landing and a
   * segment table read at the end of the walk are minutes apart. Comparing them
   * would book a disagreement against a product that was simply still writing.
   */
  segmentsAtPanelRead: Array<{
    facet: string; contentKey: string; variantId: number | null; retiredAt: Date | null;
  }>;
};

/**
 * THE KEPT PANEL, READ BY IDENTITY RATHER THAN BY ITS WORDS.
 *
 * Assertion E compares the panel against the assembly, and a comparison of NAMES
 * would be comparing two pieces of copy. Each row's thumbnail carries the stored
 * segment's own `contentKey` in its `background-image`, and that key is a row in
 * `casting_segments` — an identity, not a coordinate. The same distinction that
 * decides which tile the walk opens.
 */
const READ_KEPT_PANEL = `(() => {
  const panel = document.querySelector(".dpc-kept");
  if (!panel) return null;
  return Array.from(panel.querySelectorAll(".dpc-kept__thumb")).map((thumb) => {
    const background = getComputedStyle(thumb).backgroundImage || "";
    const matched = background.match(/url\\("?([^")]+)"?\\)/);
    return matched ? matched[1] : "";
  });
})()`;

async function readKeptPanel(page: any): Promise<{ keys: string[]; rows: number | null }> {
  /*
    A SETTLED READ, for the reason every projection read in this program is one:
    the panel's rows come from their own query, and reading them the instant the
    viewer renders is the vacuous-pass hazard that has already scored four steps
    `delivered` that had refused. Two identical counts a second apart, then read.
  */
  await page.waitForFunction(
    () => {
      const panel = document.querySelector(".dpc-kept");
      const rows = panel ? panel.querySelectorAll(".dpc-kept__row").length : -1;
      const previous = (window as any).__keptRows;
      (window as any).__keptRows = rows;
      return previous !== undefined && previous === rows;
    },
    { timeout: 20_000, polling: 1000 },
  ).catch(() => undefined);

  const urls = await page.evaluate(READ_KEPT_PANEL) as string[] | null;
  if (urls === null) return { keys: [], rows: null };
  return {
    rows: urls.length,
    /* Bucket-relative, because that is how the row stores it. */
    keys: urls.map((url) => {
      const withoutQuery = url.split("?")[0];
      return withoutQuery.startsWith(base) ? withoutQuery.slice(base.length + 1) : withoutQuery;
    }),
  };
}

/** Every segment row on this face, right now — E's other half, same moment. */
async function segmentsNow(): Promise<StepRecord["segmentsAtPanelRead"]> {
  const [rows] = await connection.query<any[]>(
    `SELECT s.facet, s.contentKey, s.variantId, s.retiredAt FROM casting_segments s
       JOIN casting_candidates c ON c.id = s.candidateId
      WHERE c.publicId = ? ORDER BY s.id ASC`,
    [CANDIDATE],
  );
  return rows as StepRecord["segmentsAtPanelRead"];
}

async function runWalk(): Promise<boolean> {
  const startedAt = new Date();
  const trpcQuery = createTrpcQuery({ base: APP_BASE, token: TOKEN });
  const { sessionId, rollId, rollLabel, indexLabel, imageUrl } =
    await locateCandidate({ trpcQuery, candidateId: CANDIDATE });
  const currentFaceKey = createCurrentFaceKey({ trpcQuery, rollId, rollLabel, candidateId: CANDIDATE });
  const landedImageKey = createLandedImageKey(CANDIDATE);
  console.log(
    `\nsheet ${sessionId} · roll ${rollLabel} · candidate ${indexLabel}`
    + `\nidentified by her own picture: ${imageUrl.slice(imageUrl.lastIndexOf("/") + 1)}`,
  );

  /*
    A FACE THAT CANNOT ANSWER A DECLARED STEP IS REFUSED BEFORE IT IS PAID FOR.

    Two preconditions, and they are the same class rather than two chores: a step
    whose subject is not in the frame cannot land, and the table would then call
    the product's failure what was really the harness's choice of face. The
    self-walk learned it the expensive way — run-15 drew a face with no glasses
    anywhere and would have spent 75 credits before failing a step that was
    impossible from the start. Asked of the PIXELS, which is the only thing that
    cannot lie about it (law 7: fix the class, not the instance).

      step 5  "remove her glasses"   needs her to be wearing some
      step 2  "gold hoop earrings"   needs ears — assertion A is a COUNT, and a
                                     count over a crop with no ear in it is a
                                     no-read that would fail the walk for a
                                     defect that was not there
  */
  const faceBytes = await (async (): Promise<Buffer | null> => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`her face came back HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.log(`  her face could not be fetched (${String(error).slice(0, 90)})`);
      return null;
    }
  })();

  const bespectacled = faceBytes === null ? null : await reader
    .region({ image: faceBytes, name: "eyeglasses", absentIsAnswer: true })
    .then((mask) => mask.data.some((value) => value > 0))
    .catch((error) => {
      console.log(`  glasses unreadable (${String(error).slice(0, 90)})`);
      return null;
    });
  /*
    THE PRECONDITIONS REFUSE A SPEND AND ONLY REPORT TO A REHEARSAL, and the
    reason is structural rather than a convenience.

    A walkable face is by definition one this walk has not edited — so it keeps
    no segments, so its kept panel does not render, so the rehearsal's whole
    subject (do the panel's thumbnails join to segment rows) is unanswerable on
    her. The only faces that CAN answer it are faces the walk would rightly
    refuse. Refusing the rehearsal on a walk precondition would make the join
    permanently unprovable, which is how a check ends up existing and never
    having run.

    The refusal itself is untouched on the path where money moves.
  */
  const refuseOrReport = (why: string): void => {
    if (SPEND) throw new Error(why);
    console.log(`  NOT A WALK FACE — ${why.split(".")[0]}. Rehearsing anyway; nothing here can spend.`);
  };
  if (bespectacled === false) {
    refuseOrReport(
      "this face is not wearing glasses, and step 5 (\"remove her glasses\") is the whole of "
      + "finding 3's ghost rim. Walking her would spend 25 credits on a step that cannot land "
      + "and then score the product for it. Pick a bespectacled face, or roll one — the spec "
      + "says step 5 moves to its own short run rather than being dropped silently.",
    );
  }
  console.log(bespectacled === null
    ? "  glasses: NO READ — proceeding, but step 5's expectation is unproven"
    : "  glasses: present, so step 5 is answerable");

  /* Skipped entirely on a rehearsal: four fal calls to answer a question that
     cannot refuse anything on that path. */
  const ears = (faceBytes === null || REHEARSE) ? null : await countEarringPair(faceBytes, "preflight");
  if (ears && ears.unreadable.length > 0) {
    refuseOrReport(
      `this face's ${ears.unreadable.join(" and ")} ear cannot be found in the frame `
      + `(${ears.saw}). Assertion A counts an earring on each side, so on her a missing hoop and a `
      + "hidden ear are the same picture — the walk could not tell his finding 1 from her hairstyle. "
      + "Pick a face whose ears are visible.",
    );
  }
  console.log(ears
    ? `  ears: ${ears.sides.map((side) => `${side.side} ${side.ear}px`).join(", ")} — `
      + "both visible, so step 1's count can distinguish a miss from a hairstyle"
    : REHEARSE
      ? "  ears: not asked — a rehearsal cannot spend, so the precondition has nothing to refuse"
      : "  ears: NO READ — her face could not be fetched");

  console.log(
    `\nTHE WALK — ${WALK.length} steps, ${WALK.length * COST_PER_STEP} credits `
    + `(${COST_PER_STEP} each, every step expected to deliver)`,
  );
  for (const [index, step] of WALK.entries()) {
    console.log(`  ${index + 1}. "${step.instruction}"  · serves finding ${step.serves}`);
  }

  if (!SPEND && !REHEARSE) {
    console.log(
      "\nDRY RUN — the face is found, her glasses are proven and the price is stated. "
      + "Pass --rehearse to drive the browser without typing, or --spend to walk it. "
      + "Nothing was charged.",
    );
    return true;
  }

  const { browser, page } = await openDrivenPage({ base: APP_BASE, token: TOKEN, height: 1100 });
  const openViewer = createViewerOpener({
    page, base: APP_BASE, sessionId, rollLabel, currentFaceKey, indexLabelForError: indexLabel,
  });
  const steps: StepRecord[] = [];

  try {
    /*
      BACK TO THE ORIGINAL BEFORE ANYTHING IS TYPED — and it is free.

      Findings 2 and 4 are about what a LATER render does to an EARLIER one, so
      the chain this walk measures has to be the walk's own. Starting from
      whatever version happened to be selected would put someone else's facets
      into every step's composition. Selecting a version is navigation between
      pictures that already exist, so it costs nothing (D-121).
    */
    console.log("\n── reset: selecting the original");
    await openViewer();
    const reset = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>('.dpc-refine__pick[aria-label="The original"]');
      if (!button) return null;
      const wasPressed = button.getAttribute("aria-pressed") === "true";
      button.click();
      return { wasPressed };
    });
    if (reset === null) {
      const hasStack = await page.$(".dpc-refine__stack");
      if (hasStack) {
        checks.neverArmed("[reset] the original is addressable", "a version stack with no Original in it");
      } else {
        absent("[reset] the walk starts from the original face", "she has no versions yet — she IS the original");
      }
    } else {
      await page.waitForFunction(
        () => document.querySelector('.dpc-refine__pick[aria-label="The original"]')
          ?.getAttribute("aria-pressed") === "true",
        { timeout: 30_000 },
      ).catch(() => undefined);
      const pressed = await page.evaluate(() =>
        document.querySelector('.dpc-refine__pick[aria-label="The original"]')?.getAttribute("aria-pressed"));
      check(
        pressed === "true",
        "[reset] the walk starts from the original face",
        `Original aria-pressed="${pressed}" (was ${reset.wasPressed ? "already" : "not"} selected)`,
      );
    }

    /*
      THE REHEARSAL STOPS HERE — at the keystroke, which is the only line in this
      function that costs money.

      What it has just proved is everything upstream of it: her sheet opened, the
      rail found her roll, her tile was matched by her own picture, the version
      stack settled, the Original was addressable. What it proves below is the
      kept panel — that its thumbnails really do carry segment object keys this
      file can join on, which assertion E assumes on all five steps and which
      nothing had ever checked.
    */
    if (REHEARSE) {
      /*
        AND THE PANEL IS ASKED OF A VERSION THAT KEEPS SOMETHING.

        The first rehearsal read it straight after the reset and found no panel
        on a face with three live segment rows — which looked like a defect and
        is the product being right: the panel lists what THIS VERSION is keeping,
        and the Original keeps nothing by definition. During the walk the panel
        is always read on a version that has just landed, so the rehearsal has to
        select the newest one to be rehearsing the same thing.
      */
      const selected = await page.evaluate(() => {
        const picks = Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick:not(.dpc-refine__pick--ghost)"));
        const last = picks[picks.length - 1];
        if (!last) return null;
        last.click();
        return last.getAttribute("aria-label");
      });
      await page.waitForFunction(
        () => {
          const picks = Array.from(document.querySelectorAll<HTMLElement>(".dpc-refine__pick:not(.dpc-refine__pick--ghost)"));
          return picks[picks.length - 1]?.getAttribute("aria-pressed") === "true";
        },
        { timeout: 30_000, polling: 500 },
      ).catch(() => undefined);
      console.log(`  selected the newest version: ${selected ?? "she has no versions"}`);

      const panel = await readKeptPanel(page);
      const rows = await segmentsNow();
      await page.screenshot({ path: `${OUT}/rehearsal.png` });
      if (panel.rows === null) {
        absent(
          "[rehearsal] the kept panel's thumbnails join to segment rows",
          `no panel on this face — she keeps nothing (${rows.length} segment row(s) on her). `
          + "E's join is unproven on her; rehearse a face that keeps something",
        );
      } else {
        /* LIVE rows only — the same join assertion E makes on every step, so the
           rehearsal proves the thing the walk will rely on rather than a looser
           cousin of it. */
        const live = rows.filter((segment) => segment.retiredAt === null);
        const mapped = panel.keys.filter((key) => live.some((segment) => segment.contentKey === key));
        check(
          panel.rows > 0 && mapped.length === panel.keys.length,
          "[rehearsal] every kept-panel thumbnail joins to a LIVE segment row by its own object key",
          `${mapped.length}/${panel.keys.length} of the panel's ${panel.rows} row(s) matched a live `
          + `casting_segments.contentKey — facets [${
            [...new Set(mapped.map((key) => live.find((s) => s.contentKey === key)!.facet))].join(", ")}]`
          + ` · she keeps ${live.length} live segment(s) in total on this face`,
        );
      }
      console.log(`\nREHEARSAL — the browser path is proved up to the keystroke. Nothing was charged.`);
      return failures().length === 0;
    }

    for (const [index, step] of WALK.entries()) {
      const position = `${index + 1}/${WALK.length}`;
      console.log(`\n── ${position} "${step.instruction}"  · serves finding ${step.serves}`);

      const seen = await refineStep({
        page,
        base: APP_BASE,
        checks,
        label: `[${position}]`,
        instruction: step.instruction,
        openViewer,
        landedImageKey,
        indexLabel,
        /* Every step of this walk is a paid edit. The spec forbids dropping one
           for being expensive, and none of them has a free-question branch. */
        expectsDelivery: true,
      });

      /*
        THE PANEL, RE-OPENED AND THEN READ — with the store read in the same breath.

        Assertion E is free and it is the only one the founder can make himself at
        a glance, so it is taken every step rather than once at the end. The
        viewer is re-opened first (free navigation, D-121) because the panel's
        query resolved before this render's segments were persisted, and a stale
        projection compared against a fresh table is a disagreement about time
        rather than about the product.
      */
      await openViewer();
      const panel = await readKeptPanel(page);
      const segmentsThen = await segmentsNow();

      steps.push({
        instruction: step.instruction,
        serves: step.serves,
        outcome: seen.outcome,
        said: seen.said,
        answers: seen.answers,
        imageUrl: seen.shown,
        seconds: seen.seconds,
        panelContentKeys: panel.keys,
        panelRows: panel.rows,
        segmentsAtPanelRead: segmentsThen,
      });
      console.log(`   → ${seen.outcome} in ${seen.seconds}s · panel keeps ${panel.rows ?? "no panel"}`);

      await page.screenshot({
        path: `${OUT}/${String(index + 1).padStart(2, "0")}-${step.instruction.replace(/\W+/g, "-")}.png`,
      });
      if (seen.shown) {
        try {
          const image = await fetch(seen.shown);
          await writeFile(
            `${OUT}/${String(index + 1).padStart(2, "0")}-delivered.png`,
            Buffer.from(await image.arrayBuffer()),
          );
        } catch (error) {
          console.log(`     (could not fetch the delivered image: ${String(error).slice(0, 80)})`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  /*
    EVERY STEP LANDED WHERE IT SAID IT WOULD — or the walk is not a replay.

    A collision is void rather than a failure (the deploy took it), and it is the
    one outcome that asks for a re-run instead of a diagnosis.
  */
  const collisions = steps.filter((step) => step.outcome === "collided").length;
  for (const [index, step] of steps.entries()) {
    const position = `${index + 1}/${WALK.length}`;
    if (step.outcome === "collided") {
      absent(`[${position}] lands where it said it would`, "void — the deploy took it");
      continue;
    }
    check(
      step.outcome === "delivered" || step.outcome === "refused",
      `[${position}] "${step.instruction}" landed`,
      `outcome ${step.outcome}`
      + (step.said ? ` — panel said "${step.said.slice(0, 110)}"` : "")
      + (step.outcome === "refused" ? " (a refusal is data; the money check below decides whether it was honest)" : ""),
    );
  }

  /* ---------------------------------------------------- the rows, once settled */

  const settled = await settleAttemptRows({ since: startedAt });
  if (settled.unsettled > 0) {
    checks.neverArmed(
      "[rows] every attempt this walk started has settled",
      `${settled.unsettled} row(s) still in flight after ${Math.round(settled.waitedMs / 1000)}s — `
      + "the assertions below would be reading a half-written state",
    );
  } else {
    check(true, "[rows] every attempt this walk started has settled", `waited ${Math.round(settled.waitedMs / 1000)}s`);
  }

  const [variantRows] = await connection.query<any[]>(
    `SELECT v.id, v.publicId, v.parentVariantId, v.requestText, v.imageKey, v.status,
            v.pointsCost, v.internalPrompt, v.createdAt, o.refundedCredits
       FROM casting_candidate_variants v
       JOIN casting_candidates c ON c.id = v.candidateId
       LEFT JOIN generation_operations o ON o.id = v.operationId
      WHERE c.publicId = ? ORDER BY v.id ASC`,
    [CANDIDATE],
  );
  const [segmentRows] = await connection.query<any[]>(
    `SELECT s.* FROM casting_segments s
       JOIN casting_candidates c ON c.id = s.candidateId
      WHERE c.publicId = ? ORDER BY s.id ASC`,
    [CANDIDATE],
  );

  const parsePrompt = (value: unknown): any => {
    if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
    return value ?? null;
  };

  /**
   * WHICH ROW EACH STEP PRODUCED — the newest one wearing this sentence that this
   * walk created. A row from an earlier run wearing the same words is the
   * coordinate-versus-identity trap one table over, so the window matters.
   */
  const rowOfStep = (instruction: string): any | null =>
    variantRows
      .filter((row) => row.requestText === instruction && new Date(row.createdAt) >= startedAt)
      .sort((a, b) => b.id - a.id)[0] ?? null;
  const walkRows = WALK.map((step) => ({ step, row: rowOfStep(step.instruction) }));

  /* ------------------------------------------------------------ the money */

  const charged = walkRows.reduce((total, entry) => total + Number(entry.row?.pointsCost ?? 0), 0);
  const refunded = walkRows.reduce((total, entry) => total + Number(entry.row?.refundedCredits ?? 0), 0);
  const delivered = walkRows.filter((entry) => entry.row?.status === "ready").length;
  check(
    charged - refunded === delivered * COST_PER_STEP,
    "[money] she paid for what she received and nothing else",
    `charged ${charged}, refunded ${refunded}, net ${charged - refunded} against `
    + `${delivered} delivered × ${COST_PER_STEP}`,
  );

  /* --------------------- A. Both ears, or an honest refusal (finding 1) */

  /*
    ASKED OF BOTH ACCESSORY STEPS, not just the first.

    Steps 1 and 2 each promise a PAIR — hoops, then crosses — so each is its own
    instance of his finding, and the second is the more interesting one: a
    replacement that arrives on one ear is the same defect with a swap on top.
    Both run while her ears are still visible, which is the whole reason
    fable-135 put them first.
  */
  const countedAt = new Map<number, Awaited<ReturnType<typeof countEarringPair>>>();
  for (const index of [STEP.hoops, STEP.crosses]) {
    const entry = walkRows[index];
    const row = entry.row;
    const label = `step ${index + 1} ("${entry.step.instruction}")`;
    const stored = parsePrompt(row?.internalPrompt);
    const accessory = (stored?.verification?.checks ?? []).find((c: any) => c?.facet === "statedAccessories");
    if (!row) {
      checks.neverArmed(`[A] ${label} — both ears, or an honest refusal`, "this step wrote no row at all");
      continue;
    }
    if (row.status !== "ready") {
      /*
        THE REFUSAL BRANCH THE SPEC ALLOWS — and it is only honest if the money
        came back. A refusal that kept the credits is finding 1 wearing a
        different hat.
      */
      check(
        Number(row.refundedCredits ?? 0) >= Number(row.pointsCost ?? 0),
        `[A] ${label} refused, and refused HONESTLY — the credits came back`,
        `status ${row.status}, charged ${row.pointsCost}, refunded ${row.refundedCredits}`,
      );
      continue;
    }
    const response = await fetch(`${base}/${row.imageKey}`);
    if (!response.ok) {
      checks.neverArmed(`[A] ${label} — both ears, or an honest refusal`,
        `the delivered frame came back HTTP ${response.status}`);
      continue;
    }
    const counted = await countEarringPair(Buffer.from(await response.arrayBuffer()), `walk-${index + 1}-v${row.id}`);
    countedAt.set(index, counted);
    /*
      ONE HOOP DELIVERED IS THE FINDING, and it fails the run outright. The
      pixels decide it; the stored verdict's own words are recorded beside them,
      because D-235's asymmetry is what made the original miss legible — *"gold
      hoop earring visible on visible ear"*, singular, one ear, accepted.

      RE-DERIVED UNDER D-246 (2026-08-11): a failure here is a defect report, not
      a billing dispute. The two sentences used to be one — "delivered AND
      CHARGED is a false pass" asserted that the money should have come back —
      and under D-246 the runtime refuses only its four classes. This one is
      inside them: a pair is one thing in the user's ontology, so half of it is
      the asked thing ABSENT rather than a subtle shortfall in it, and the build
      already agrees (accessories are presence-BINDING and the pair clause rides
      the question). The money check below is a separate assertion on purpose,
      so a walk that fails on the pixels and finds the credits handled correctly
      says exactly that.

      Unless an ear is not THERE — a NO-READ, recorded as one: unarmed, which
      fails the run, because a walk that cannot see her ears has not closed
      finding 1 and must not be able to say it has. Under fable-135's order this
      should not happen here (nothing has touched her hair yet), so if it does,
      it is news rather than an expected excuse.
    */
    if (counted.unreadable.length > 0) {
      checks.neverArmed(
        `[A] ${label} delivered an earring on BOTH ears`,
        `${counted.saw} — no ear on the ${counted.unreadable.join("/")}, so "no earring there" is a `
        + "no-read rather than a miss. His finding was one hoop with the other ear bare AND VISIBLE. "
        + "Nothing has asked about her hair by this step, so this is unexpected",
      );
    } else {
      check(
        counted.isPair,
        `[A] ${label} delivered an earring on BOTH ears`,
        `${counted.saw} → ${counted.isPair ? "a pair" : "NOT a pair"}`,
      );
    }
    check(
      true,
      `[A] ${label} — and the product's own verdict on the same frame, verbatim`,
      accessory
        ? `verified=${accessory.verified} — saw: ${String(accessory.saw ?? "").slice(0, 140)}`
        : "the row carries no statedAccessories check",
    );
  }

  /* ------------------------------- B. The ears do not move (finding 2) */

  /*
    THE TWO CONDITIONS FABLE-133 PUT ON B, AND THEY ARE NOT THE SAME CONDITION.

    1. The result is stated with its OWN n, on the REAL `statedAccessories`
       segments — not on the reader's mask, which is what the pre-walk control
       stands in with.
    2. **If the two accessory steps produce no segments at all, the walk is NOT
       clean whatever else passes.** There was no `statedAccessories` segment
       anywhere in production when this was written — all 14 were marks/makeup/
       hairWorn/eye.colour — so an empty result here is a live risk rather than a
       formality, and it must never read as "nothing to report".

    (fable-133 wrote "steps 2→3"; under fable-135's order those are steps 1→2.
    Named through `STEP` rather than by number, so the next reorder cannot
    silently re-aim this at the wrong pair.)
  */
  let accessorySegments = 0;
  let carriedVerdicts = 0;
  {
    const hoopsRow = walkRows[STEP.hoops].row;
    const crossesRow = walkRows[STEP.crosses].row;
    const copperHairRow = walkRows[STEP.copperHair].row;
    const minted = segmentRows.filter((segment) =>
      segment.facet === "statedAccessories"
      && [hoopsRow?.id, crossesRow?.id].includes(segment.variantId));
    accessorySegments = minted.length;
    check(
      accessorySegments > 0,
      "[B] the accessory steps minted a real `statedAccessories` segment — the thing an earring persists AS",
      accessorySegments > 0
        ? `${accessorySegments} segment(s): ${minted.map((s) => `${s.facet}@v${s.version} from v#${s.variantId}`).join(", ")}`
        : "no accessory segment exists on this face — an earring is still a sentence, "
          + "so finding 2 cannot be closed by this walk whatever else passes",
    );

    /*
      THE ASSERTION ITSELF, through the product's own adjudicator — the same
      module `scripts/adjudicate-carried.mts` and the self-walk use, so a
      carried-fact verdict cannot mean two things in two harnesses.
    */
    if (accessorySegments > 0) {
      const adjudication = await adjudicateCandidateCarries({
        variants: variantRows.filter((row) => new Date(row.createdAt) >= startedAt),
        segments: segmentRows,
        fetchBytes: async (key: string) => {
          const response = await fetch(`${base}/${key}`);
          if (!response.ok) throw new Error(`${key} → HTTP ${response.status}`);
          return Buffer.from(await response.arrayBuffer());
        },
      });
      const accessory = adjudication.verdicts.filter((verdict) => verdict.facet === "statedAccessories");
      const unjudgeable = adjudication.unadjudicable.filter((entry) => entry.facet === "statedAccessories");
      carriedVerdicts = accessory.length;
      for (const verdict of accessory) console.log(`  v#${verdict.variantId} ${formatCarriedVerdict(verdict)}`);

      if (carriedVerdicts === 0) {
        checks.neverArmed(
          "[B] the earring pixels survive an unrelated ask",
          `no render of this walk CARRIED the accessory (n=0)`
          + (unjudgeable.length ? ` — ${unjudgeable.map((e) => e.why).join("; ")}` : ""),
        );
      } else {
        const deficits = accessory.filter((verdict) => !verdict.kept);
        check(
          deficits.length === 0,
          `[B] the earring pixels survive an unrelated ask — n=${carriedVerdicts} on the REAL segments`,
          accessory.map((v) => formatCarriedVerdict(v)).join(" | "),
        );
      }

      /*
        AND THE OTHER DIRECTION, INSIDE THE WALK: step 2 REPLACED the hoops, so
        step 1's segment must NOT survive into step 2's frame.

        Judged with NO recorded intersections on purpose. The question here is
        "did these pixels survive", not "did the compositor account for their
        loss" — a replacement that the assembly dutifully recorded would come
        back explained, and an instrument that can only ever say KEPT cannot
        fail. This is the spec's own control for B, run on the walk's own frames
        rather than on a stand-in.
      */
      const hoop = minted.filter((segment) => segment.variantId === hoopsRow?.id).sort((a, b) => b.version - a.version)[0];
      const fetchKey = async (key: string) => {
        const response = await fetch(`${base}/${key}`);
        if (!response.ok) throw new Error(`${key} → HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      };
      if (!hoop || !crossesRow?.imageKey) {
        checks.neverArmed(
          "[B] CONTROL — the same arithmetic reports DIFFERENT where the accessory was replaced",
          hoop ? "step 2 delivered no frame to compare against" : "step 1 minted no accessory segment to compare",
        );
      } else {
        const verdict = await adjudicateCarried({
          facet: "statedAccessories",
          version: hoop.version,
          maskBytes: await fetchKey(hoop.maskKey),
          contentBytes: await fetchKey(hoop.contentKey),
          frameBytes: await fetchKey(crossesRow.imageKey),
          /* The row's own columns, exactly as `adjudicateCandidateCarries` reads
             them — the geometry is four ints on the row, not a json blob. */
          bbox: { x: hoop.bboxX, y: hoop.bboxY, width: hoop.bboxW, height: hoop.bboxH },
          intersections: [],
        });
        check(
          !verdict.kept,
          "[B] CONTROL — the same arithmetic reports DIFFERENT where the accessory was replaced",
          `${formatCarriedVerdict(verdict)} against step 2's frame (hoops → crosses) — `
          + "KEPT here would mean the comparison is measuring the wrong region",
        );
      }

      /*
        AND THE PICTURE, BESIDE THE ARITHMETIC — the hole in the new order, closed.

        Step 3 is *"copper hair"*, and hair covers ears. The adjudicator forgives
        a loss the assembly RECORDED as an intersection, which is right for its
        question ("was this accounted for") and blind to this one: if the copper
        repaint wins the whole earring region and the compositor dutifully writes
        that down, B reads KEPT over a hoop that is simply gone from her picture.
        An instrument at its own floor reporting a clean result — working law 2's
        exact shape.

        So the counter runs on step 3's frame as well. It is the same instrument
        A uses, and it answers a question the arithmetic structurally cannot: is
        the jewellery still THERE. A disagreement between the two is the finding.
      */
      if (copperHairRow?.status === "ready" && copperHairRow.imageKey) {
        const after = await countEarringPair(await fetchKey(copperHairRow.imageKey), `walk-3-v${copperHairRow.id}`);
        const before = countedAt.get(STEP.crosses) ?? null;
        if (after.unreadable.length > 0) {
          absent(
            "[B] and the earrings are still IN THE PICTURE after the unrelated ask",
            `${after.saw} — the copper repaint put hair over the ${after.unreadable.join("/")} ear, so the `
            + "counter cannot answer here. The byte arithmetic above is the surviving instrument",
          );
        } else {
          check(
            after.present > 0 && (before === null || after.present >= before.present),
            "[B] and the earrings are still IN THE PICTURE after the unrelated ask",
            `${after.saw}`
            + (before ? ` · step 2 had ${before.present} of 2 sides wearing one` : "")
            + " — the arithmetic forgives a RECORDED loss, so this asks the question it cannot",
          );
        }
      }
    }
  }

  /* --------- C. The seam is on the record, and the record agrees with his eye */

  /*
    NOTHING HERE IS A PASS/FAIL AGAINST A THRESHOLD, because the threshold is
    exactly what is being decided (roadmap §0, the shadow→enforce flip). What is
    assertable is that the verdict RIDES the row at all; the number is the output,
    and his eye on the frame is the other half.
  */
  {
    /* HIS OWN ASK — *"wear her hair down"* is the render he called "like it was
       pasted there", and under fable-135's order that is step 4. */
    const row = walkRows[STEP.hairDown].row;
    const seam = row ? readSeamRow({
      id: row.id, requestText: row.requestText, status: row.status, internalPrompt: row.internalPrompt,
    }) : null;
    check(
      seam !== null,
      "[C] step 4's row (\"wear her hair down\") carries a seam verdict, torn or clean",
      seam
        ? `worstExcess ${seam.worstExcess.toFixed(1)} · torn ${seam.torn} (${seam.tornPixels}/${seam.boundaryPixels}px) `
          + `· coherence ${seam.coherence?.toFixed(3) ?? "absent"} · enforced ${seam.enforced}`
        : row ? "the row carries no seam key — nothing was composited, or the verdict did not ride" : "step 4 wrote no row",
    );
    absent(
      "[C] the founder's verdict on the same frame",
      "three outcomes are all useful and none of them is this harness's to record: he sees a seam "
      + "and the instrument scored it (the flip has its calibration), he sees one it did NOT (the "
      + "blind spot is at his exact amplitude — worse, and the more important finding), or he sees "
      + "none (the class is closed on his eye and the number is a baseline)",
    );

    /*
      AND THE PICTURE FOR HIS EYE — the boundary at 3×.

      The seam verdict records no coordinates, so the boundary is DERIVED rather
      than read: the composited region is where step 4's frame differs from the
      face it was made from, and its bounding box is that region's edge. Stated
      because it is a derivation — a crop that points somewhere wrong is visible
      to him instantly, which is exactly why a picture may be derived where a
      verdict may not.
    */
    if (row?.imageKey) {
      try {
        const sharpModule = (await import("sharp")).default;
        const parent = variantRows.find((entry) => entry.id === row.parentVariantId);
        const parentKey = parent?.imageKey ?? null;
        const beforeUrl = parentKey ? `${base}/${parentKey}` : imageUrl;
        const [afterBytes, beforeBytes] = await Promise.all([
          fetch(`${base}/${row.imageKey}`).then(async (r) => Buffer.from(await r.arrayBuffer())),
          fetch(beforeUrl).then(async (r) => Buffer.from(await r.arrayBuffer())),
        ]);
        await writeFile(path.join(OUT, "C-step4-hairdown-delivered-full.png"), afterBytes);
        const meta = await sharpModule(afterBytes).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        const [afterRaw, beforeRaw] = await Promise.all([
          sharpModule(afterBytes).resize({ width, height, fit: "fill" }).toColourspace("b-w").raw().toBuffer(),
          sharpModule(beforeBytes).resize({ width, height, fit: "fill" }).toColourspace("b-w").raw().toBuffer(),
        ]);
        let minX = width; let minY = height; let maxX = -1; let maxY = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (Math.abs(afterRaw[y * width + x] - beforeRaw[y * width + x]) <= MOVED_AT) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        if (maxX < 0) {
          absent("[C] the boundary at 3× for his eye", "step 4's frame differs nowhere from the face it was made from");
        } else {
          const pad = 24;
          const left = Math.max(0, minX - pad);
          const top = Math.max(0, minY - pad);
          const cropW = Math.min(width - left, maxX - minX + pad * 2);
          const cropH = Math.min(height - top, maxY - minY + pad * 2);
          await writeFile(
            path.join(OUT, "C-step4-hairdown-boundary-3x.png"),
            await sharpModule(afterBytes)
              .extract({ left, top, width: cropW, height: cropH })
              .resize({ width: cropW * 3, height: cropH * 3, kernel: "nearest" })
              .png().toBuffer(),
          );
          console.log(
            `  [C] boundary crop ${cropW}×${cropH} at (${left},${top}), written at 3× — `
            + `derived from where the frame differs from ${parentKey ? `v#${parent?.id}` : "her original"}`,
          );
        }
      } catch (error) {
        absent("[C] the boundary at 3× for his eye", `could not be derived — ${String(error).slice(0, 120)}`);
      }
    }
  }

  /* -------------------------------- D. The hair stays down (finding 4) */

  /*
    TWO INSTRUMENTS, BOTH REQUIRED, because they fail differently: the RECIPE
    (hairWorn is still in the resolved identity, so the words were not dropped)
    and the PICTURE (a read of the delivered frame says the hair is down).
    The picture is the one that matters and the recipe is the one that explains
    it — a recipe that still says "down" over a frame that is not is the same
    defect with a better alibi.
  */
  /*
    STEP 4 SETS IT AND STEP 5 IS THE LATER ASK — which is his own sequence's
    length, not a shortened one. His finding was *"wear her hair down"* followed
    by ONE further request, after which the hair had reverted. Step 4 is asserted
    because a step must deliver what it promised; step 5 is asserted because that
    is where the disease reproduces.
  */
  for (const index of [STEP.hairDown, STEP.removeGlasses]) {
    const entry = walkRows[index];
    const row = entry.row;
    const position = `${index + 1}/${WALK.length}`;
    if (!row || row.status !== "ready") {
      absent(`[D] ${position} "${entry.step.instruction}" — her hair is still down`,
        `this step delivered nothing (${row?.status ?? "no row"}), so there is no frame to read`);
      continue;
    }
    const stored = parsePrompt(row.internalPrompt);
    /* The product's own readers, not a second parse of its json. */
    const recipe = currentValueOfFacet(readResolvedIdentity(stored), "hairWorn");
    const picture = (stored?.verification?.checks ?? []).find((c: any) => c?.facet === "hairWorn");
    check(
      Boolean(recipe),
      `[D] ${position} the RECIPE still says how she wears her hair`,
      recipe ? `resolved hairWorn = "${recipe}"` : "hairWorn is absent from the resolved identity — the words were dropped",
    );
    check(
      Boolean(picture) && picture.read === true && picture.verified === true,
      `[D] ${position} the PICTURE says her hair is still down`,
      picture
        ? `read=${picture.read} verified=${picture.verified} — saw: ${String(picture.saw ?? "").slice(0, 120)}`
        : "the row carries no hairWorn check at all, so the frame was never read for it",
    );
  }

  /*
    AND THE PIN, ON EVERY STEP — the earliest and sharpest record of the three,
    and the only one that is never graded (fable-137 §1).

    Traced on his own rows before this walk ever ran (v#163 → v#164, at the
    wire): v#163 asked for her hair down, delivered it, and captioned it
    correctly — *"Straight dark hair worn down, center-parted…"*. Its child
    v#164, asking for earrings, was then handed **"HAIR WORN: gathered — the bulk
    of the hair drawn away from the face and gathered behind the head"** under an
    ALREADY TRUE clause, and the painter obeyed. The reader then marked
    `hairWorn` verified FALSE against `asked: "down"`.

    So finding 4 is not the hair drifting. **The later render was told to undo
    the edit she had just paid for**, and the product argued with itself about it
    afterwards. The pinned caption and the resolved recipe are two records of one
    fact, and when they part, the PICTURE follows the caption.

    **Not a claim that it is still live.** His chain rendered 2026-08-08 23:52Z
    and `59c22762` changed exactly this path eleven hours later (fable-118 (a3):
    pin the frame she is standing on, not the one she started from). Whether the
    cure holds is what this walk is for.

    # RECORDED, NOT GRADED — and the reason is a negative control

    The obvious version is a check: fail if the pinned caption names a gathered
    arrangement. Driven against real production captions, it fails a CORRECT
    walk — v#162's own pin reads *"worn exactly as cut — short enough that it is
    not gathered, tied or pinned at all"*, which means the opposite of every word
    in it. A regex over model-written prose cannot see negation, and a false
    failure on a 125-credit walk is the expensive direction.

    Nothing is lost: if the hair really does go back up, the PICTURE check above
    fails on its own. **The pin adds attribution, not detection** — whether the
    painter drifted or was told to — and attribution is what an observation is
    for. So it rides EVERY step rather than only the two D grades: attribution is
    cheap, and the step where the caption first turns is the step that explains
    all the ones after it.
  */
  for (const [index, entry] of walkRows.entries()) {
    const position = `${index + 1}/${WALK.length}`;
    const stored = parsePrompt(entry.row?.internalPrompt);
    const pin = typeof stored?.captions?.hairWorn === "string" ? stored.captions.hairWorn : null;
    const recipe = currentValueOfFacet(readResolvedIdentity(stored), "hairWorn");
    absent(
      `[D] ${position} "${entry.step.instruction}" — the hair caption this render carried, verbatim`,
      !entry.row
        ? "this step wrote no row"
        : pin
          ? `pinned: "${pin.slice(0, 180)}"${recipe ? ` · recipe says "${recipe}"` : " · no recipe value"}`
          : "no hairWorn caption on this render — nothing was pinned",
    );
  }

  /* ------------- E. The panel agrees with the assembly (new, free) */

  /*
    THE PANEL AND THE COMPOSITOR READ THE SAME STORE THROUGH DIFFERENT PATHS, so
    a disagreement is a real finding either way.

    # Two corrections to the spec's wording, both found by driving rather than by
    # reading, both stated rather than quietly applied

    The spec says the panel lists *exactly the facets the assembly says were
    carried — no more, no fewer.* Driven against production, that is wrong twice:

    1. **No fewer is wrong.** A render that WRITES a facet does not carry it, so
       the panel is longer than the carried list by exactly the facet the step
       just asked for, on every step that asks for one.
    2. **No more is wrong too.** The rehearsal on his own v#157 found a panel of
       two rows over three live segments and no assembly record at all — the
       panel lists what is live on the BRANCH, which is a superset of what any
       one render carried. Asserting equality would have failed all five steps of
       a perfectly correct walk.

    So the assertion is a containment plus a join, which is what actually has
    teeth, and the extras are NAMED rather than counted:

      every panel row joins to a LIVE segment row      a panel showing a retired
                                                       segment is a real defect
      every carried-or-kept facet is ON the panel      the picture contains those
                                                       pixels; a panel hiding them
                                                       is the disagreement E exists
                                                       to catch
      anything else the panel shows                    printed in the observation

    The one honest caveat, seen on his own face: the projection DROPS a row whose
    delivered value cannot be found (`hairWorn` from a render that never asked
    about hair), by design — "a silent row is honest where an ugly one is not".
    On this walk step 1 sets a hair arrangement, so its value exists; if a carried
    facet still fails to appear, that IS the finding, and the observation says so.
  */
  for (const [index, entry] of walkRows.entries()) {
    const position = `${index + 1}/${WALK.length}`;
    const row = entry.row;
    const step = steps[index];
    if (!row || !step) {
      absent(`[E] ${position} the panel agrees with the assembly`, "this step produced no row to compare against");
      continue;
    }
    /* The store as it was when the panel was photographed — see the field's note. */
    const thenRows = step.segmentsAtPanelRead;
    const stored = parsePrompt(row.internalPrompt);
    const carried: string[] = (stored?.assembly?.segmentsApplied ?? []).map((applied: any) => String(applied.facet));
    const kept: string[] = thenRows.filter((segment) => segment.variantId === row.id).map((segment) => segment.facet);
    if (step.panelRows === null) {
      /* A face keeping nothing renders nothing — legitimately absent, and the
         first step of a fresh branch carries nothing by definition. */
      if (carried.length === 0 && kept.length === 0) {
        absent(`[E] ${position} the panel agrees with the assembly`,
          "no panel, and nothing was carried or kept — a face keeping nothing renders nothing");
      } else {
        check(false, `[E] ${position} the panel agrees with the assembly`,
          `the panel was absent while this render carried [${carried.join(", ")}] and kept [${kept.join(", ")}]`);
      }
      continue;
    }
    const owed = [...new Set([...carried, ...kept])].sort();
    const live = thenRows.filter((segment) => segment.retiredAt === null);
    const shown = [...new Set(
      step.panelContentKeys
        .map((key) => live.find((segment) => segment.contentKey === key)?.facet)
        .filter((facet): facet is string => Boolean(facet)),
    )].sort();
    /* A row whose object is not a LIVE segment: either a retired one still on
       screen, or a thumbnail pointing at something the store does not know. */
    const orphaned = step.panelContentKeys.filter((key) => !live.some((segment) => segment.contentKey === key));
    const missing = owed.filter((facet) => !shown.includes(facet));
    const extra = shown.filter((facet) => !owed.includes(facet));

    check(
      orphaned.length === 0,
      `[E] ${position} every kept-panel row is a LIVE segment of this face`,
      orphaned.length === 0
        ? `${step.panelContentKeys.length} row(s), all joined to live casting_segments rows by object key`
        : `${orphaned.length} row(s) point at no live segment: ${orphaned.map((k) => k.slice(-28)).join(", ")}`,
    );
    check(
      missing.length === 0,
      `[E] ${position} everything this render carried or kept is ON the panel`,
      `panel [${shown.join(", ")}] · carried [${carried.join(", ")}] · kept [${kept.join(", ")}]`
      + (missing.length ? ` — MISSING from the panel: ${missing.join(", ")}` : "")
      + (extra.length ? ` · also shown (live on the branch from an earlier render): ${extra.join(", ")}` : ""),
    );
  }

  await writeFile(
    path.join(OUT, "walk.json"),
    `${JSON.stringify({
      startedAt, candidate: CANDIDATE, sessionId, steps,
      money: { charged, refunded, delivered },
      accessorySegments, carriedVerdicts,
      checks: records,
    }, null, 2)}\n`,
    "utf8",
  );

  /*
    THE VERDICT. `accessorySegments === 0` is its own clause rather than one more
    failing check, because fable-133 made it decisive: the walk is not clean
    whatever else passes.
  */
  return failures().length === 0 && collisions === 0 && accessorySegments > 0;
}

/* ==========================================================================
   The run.
   ========================================================================== */

let controlsGreen: boolean | null = null;
if (CONTROLS || SPEND) {
  await runControls();
  controlsGreen = failures().length === 0;
  console.log(
    controlsGreen
      ? "\nEvery instrument here has been shown able to fail."
      : "\nNOT READY: an instrument that cannot fail cannot pass. The walk does not run on these.",
  );
}

/*
  THE CONTROLS ARE A PRECONDITION, NOT A FLAG SOMEBODY REMEMBERS TO PASS.

  `--spend` executes them; it does not consult `--controls`. So there is no
  invocation in which the walk spends on instruments that were not proved in the
  same run, and no way to get there by leaving an argument off.
*/
if (SPEND) {
  const red = failures();
  try {
    assertPreconditionsProved(
      `spend ${WALK.length * COST_PER_STEP} credits walking the finding replay`,
      controlsGreen,
      red.length ? `red controls: ${red.map((record) => record.law).join(" · ")}` : "",
    );
  } catch (error) {
    /* A refusal must not leave an open connection holding the process alive —
       the database is the one resource this script opens before the gate. */
    await connection.end().catch(() => undefined);
    throw error;
  }
}

let walkClean: boolean | null = null;
if (CANDIDATE || SPEND) walkClean = await runWalk();

await connection.end();
print();
/*
  ONLY A RUN THAT DROVE THE CONTROLS WRITES `controls.json`.

  A dry run declares no checks, and writing its empty record over a green one
  would leave an artifact that reads as "the instruments were driven and found
  nothing" — the opposite of what happened. Artifacts are facts (working law 1),
  so an artifact nobody earned does not get written.
*/
if (controlsGreen !== null) {
  await writeFile(path.join(OUT, "controls.json"), `${JSON.stringify(records, null, 2)}\n`, "utf8");
  console.log(`\nrecords: ${path.join(OUT, "controls.json")}`);
}
if (SPEND) {
  console.log(
    walkClean
      ? "\nWALK CLEAN — the five steps landed, and all four findings were driven back at the build."
      : "\nWALK NOT CLEAN — the founder is not called.",
  );
}
/* `getDb()`'s pool has no shutdown, so a script that touched an app service
   never exits on its own. */
process.exit(failures().length === 0 && walkClean !== false ? 0 : 1);
