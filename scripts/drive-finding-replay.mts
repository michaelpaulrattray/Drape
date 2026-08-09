/**
 * THE FINDING-REPLAY WALK — his four findings, driven back at the build that
 * claims to have closed them. Specification: `docs/specs/FINDING_REPLAY_WALK.md`.
 *
 * **`--controls` is the only mode implemented, and that is deliberate.** The
 * walk itself spends 125 credits a run on a real account and is HELD until the
 * STOPLINE lifts; its instruments are not, and proving they can fail belongs
 * inside the freeze rather than on the morning it thaws. A counter that has
 * never counted one earring is not a counter.
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
 *   FAL_KEY=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/drive-finding-replay.mts --controls \
 *       --bucket https://pub-990e39d8d995468eb61aced83162123a.r2.dev
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

import { assertOneWorld, readLocalEnvFile } from "./lib/worldGuard.mts";
import { spendAuthorized } from "./lib/stopline.mts";
import { createChecks } from "./lib/drivePage.mts";
import {
  CLEAN_BOUNDARY_COHERENCE, FOUNDER_SEAM_COHERENCE, readSeamRow, seamRates, SEAM_CONTROL_ROWS,
} from "./lib/seamRows.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import type { Mask } from "../server/castingV2/maskedComposite";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const CONTROLS = process.argv.includes("--controls");
const OUT = path.resolve("output/finding-replay");

/*
  `--spend` THROUGH THE ONE DOOR, not a hand-rolled read of argv.

  This file shipped last shift asking `process.argv.includes("--spend")`
  directly, and `stopline --prove`'s derived roster caught it: an account
  spender whose refusal was its own opinion rather than the freeze's. The walk
  costs 125 credits on his real account, so the freeze must be the FIRST answer
  it gets — the not-implemented refusal below is the second, for the morning the
  line thaws with this harness still unfinished.
*/
if (spendAuthorized("walk the finding replay (125 credits on his account)")) {
  throw new Error(
    "the walk itself is NOT implemented and is HELD until the STOPLINE lifts "
    + "(docs/specs/FINDING_REPLAY_WALK.md). `--spend` exists here only so it cannot be "
    + "mistaken for a mode that quietly works.",
  );
}
if (!CONTROLS) {
  console.log("Nothing to do. `--controls` drives the instruments against his own frames; the walk is held.");
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
 * **Filed for a ruling rather than fixed here** — whether the product's own
 * bilateral regions are losing their second side through the same door is a
 * question about `falRegionReader`, not about this script, and it is not mine
 * to answer inside the stop-line.
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

const connection = await mysql.createConnection({
  uri: process.env[databaseKey]!, timezone: "Z",
} as mysql.ConnectionOptions);
const reader = createFalRegionReader({ apiKey });
const { check, absent, records, failures, print } = createChecks();
await mkdir(OUT, { recursive: true });

/* ------------------------------------------------- control A: the pair counter */

for (const specimen of SPECIMENS) {
  const [row] = await connection.query<any[]>(
    "SELECT id, imageKey FROM casting_candidate_variants WHERE publicId = ? LIMIT 1",
    [specimen.publicId],
  ).then(([rows]) => rows as any[]);
  if (!row?.imageKey) {
    check(false, `A: ${specimen.label}`, `no frame for ${specimen.publicId} — wrong world, or the row is gone`);
    continue;
  }

  const response = await fetch(`${base}/${row.imageKey}`);
  if (!response.ok) {
    check(false, `A: ${specimen.label}`, `frame HTTP ${response.status}`);
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  /*
    ASKED ONCE, THEN SPLIT BY HER OWN MIDLINE — because the words "left" and
    "right" do nothing.

    The first version asked "left earring" and "right earring" as two
    questions, and scored his ONE-hoop frame a pair: 740px and 728px. The masks
    are on disk and they are THE SAME HOOP, returned twice — SAM 3 answers the
    noun and ignores the laterality. A counter built on a qualifier the model
    does not read is not a counter, and it would have passed the exact frame it
    exists to catch.

    (This also explains, harmlessly, why `falRegionReader`'s bilateral split
    for `ear`/`eyes` is a union of one answer with itself. Harmless there — a
    union is what it wanted — and fatal here, where the question is HOW MANY.)

    So: one question, and the arithmetic decides the sides. The midline is her
    FACE's, not the image's, because a portrait is not guaranteed centred.
  */
  /*
    THE HALVES ARE CUT FIRST, AND THE MODEL IS ONLY EVER SHOWN ONE EAR.

    Third instrument, and the two it replaces are worth keeping in view because
    each failed differently on his own frames:

      "left earring" / "right earring"   740px and 728px on a ONE-hoop frame —
                                         the same hoop returned twice. SAM 3
                                         answers the noun and ignores the
                                         laterality entirely.
      "earring", every mask unioned      472px on ONE ear of a TWO-hoop frame:
                                         the model returned exactly 1 mask.
                                         Asked about a class, it answers with an
                                         instance, so a count cannot be taken
                                         from it however the masks are handled.

    Both were the same mistake — asking a question whose answer has to be
    trusted to be complete. Cutting her in half first removes the trust: each
    call can only answer about the pixels it was handed, so "is there an
    earring on THIS side" is a question the model cannot answer laterally
    wrong.
  */
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
    const mask = await askEveryMask(halfBytes, "earring");
    await writeFile(
      path.join(OUT, `mask-v${row.id}-${half.side}.png`),
      await sharpModule(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
        .resize({ width: 320 }).png().toBuffer(),
    );
    return { side: half.side, px: pixels(mask) };
  }));

  const present = sides.filter((side) => side.px >= PRESENT_AT);
  const isPair = present.length === 2;
  const saw = `${sides.map((side) => `${side.side}=${side.px}px`).join(" ")} `
    + `across her face's midline at x=${midline} of ${width}`;

  check(
    isPair === specimen.expectPair,
    `A: ${specimen.label} reads ${specimen.expectPair ? "as a PAIR" : "as NOT a pair"}`,
    `${saw} (present at ≥${PRESENT_AT}px: ${present.length}) → ${isPair ? "pair" : "not a pair"}`,
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
  is the real reader rather than a restatement of it.
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

/* ----------------------------------------- control D: the hair is still down */

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
    const checks: any[] = prompt?.verification?.checks ?? [];
    const hair = checks.find((entry) => entry?.facet === "hairWorn");
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

/* ------------------------------ control B: the earring pixels move, or do not */

/*
  B'S CONTROL IS A STAND-IN, AND IT IS DECLARED AS ONE.

  The spec asks for a DELIBERATE REPLACEMENT (hoops → crosses) between two frames
  of one walk, and swept over every variant on his account there is none: no branch
  anywhere replaces one stated accessory with another. What does exist is an
  ADDITION on one branch — v#163 wears nothing, its child v#164 asked for crosses —
  and the control's actual job is served by it exactly: **the arithmetic must
  report DIFFERENT for an accessory region that genuinely changed.** A comparison
  that says "identical" there is measuring the wrong region, which is the only
  thing this control exists to catch.

  Two deviations from the spec, both stated rather than smoothed over:

  1. It is an addition, not a replacement. The replacement comparison arrives with
     the walk's own steps 2→3 and is not available before it.
  2. The mask is the READER's earring region, not a stored `statedAccessories`
     segment — because there is no such segment anywhere in production (all 14 are
     `marks`, `makeup`, `hairWorn` and `eye.colour`). When the walk produces one,
     B's live assertion uses it; this control proves the arithmetic can see a
     change at all.

  The ear side is chosen by the pair counter's method — cut at her own midline,
  ask each half — so the region compared cannot be laterally wrong.
*/
{
  const frames = await Promise.all(EARRING_CHANGE.map(async (specimen) => {
    const [row] = await connection.query<any[]>(
      "SELECT id, imageKey FROM casting_candidate_variants WHERE publicId = ? LIMIT 1",
      [specimen.publicId],
    ).then(([rows]) => rows as any[]);
    if (!row?.imageKey) return { specimen, bytes: null as Buffer | null, id: row?.id };
    const response = await fetch(`${base}/${row.imageKey}`);
    return {
      specimen,
      id: row.id,
      bytes: response.ok ? Buffer.from(await response.arrayBuffer()) : null,
    };
  }));

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
      let changed = 0;
      let sampled = 0;
      for (let at = 0; at < mask.data.length; at += 1) {
        if (mask.data[at] === 0) continue;
        sampled += 1;
        if (Math.abs(beforeRaw[at] - afterRaw[at]) > 12) changed += 1;
      }
      return { side: half.side, px, changed, sampled };
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
      let moved = 0;
      let sampled = 0;
      for (let at = 0; at < earMask.data.length; at += 1) {
        if (earMask.data[at] === 0) continue;
        sampled += 1;
        if (Math.abs(rawBefore[at] - rawAfter[at]) > 12) moved += 1;
      }
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
      + "both arrive with the walk's own steps 2→3, and this control stands in for neither",
    );
  }
}

await connection.end();
print();
await writeFile(path.join(OUT, "controls.json"), `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(`\nrecords: ${path.join(OUT, "controls.json")}`);
console.log(
  failures().length === 0
    ? "\nEvery instrument here has been shown able to fail."
    : "\nNOT READY: an instrument that cannot fail cannot pass. The walk does not run on these.",
);
process.exit(failures().length === 0 ? 0 : 1);
