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
import { createChecks } from "./lib/drivePage.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import type { Mask } from "../server/castingV2/maskedComposite";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const CONTROLS = process.argv.includes("--controls");
const SPEND = process.argv.includes("--spend");
const OUT = path.resolve("output/finding-replay");

if (SPEND) {
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
const { check, neverArmed, records, failures, print } = createChecks();
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

/* --------------------------------------- the controls that are not armed yet */

/*
  A CONTROL THAT DID NOT RUN DOES NOT EXIST (invariant 7), so these FAIL rather
  than passing quietly. Each names what it is waiting for.
*/
neverArmed(
  "B: the earring pixels move / do not move",
  "its control is a REPLACEMENT comparison (hoops → crosses) between two frames of one "
  + "walk, and no walk has run on this build — the pre-fix pair v#156→v#157 cannot serve, "
  + "because that is the side-swap itself rather than a deliberate replacement",
);
neverArmed(
  "C: the seam number",
  "the seam reader's own positive control lives in `sweep-seam-rows-disposable --selftest` "
  + "and is driven there; this harness reads the walk's own rows, and there are none",
);
neverArmed(
  "D: the hair is still down",
  "needs the 'is it down' read wired to the product's own verification reader rather than "
  + "a second opinion about hair — his v#163 (down) and its parent (up) are the specimen pair, "
  + "and they are waiting on that wiring, not on a render",
);

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
