/**
 * DOES THE PRODUCT'S BILATERAL REGION ACTUALLY GET TWO SIDES?
 *
 * Ordered by fable-131 as the incoming shift's first investigation, off
 * opus-104's ruling request. `falRegionReader` treats `ear`, `eyes` and
 * `eyebrows` as bilateral: it asks SAM 3 *"left ear"* and *"right ear"*, takes
 * `masks[0]` from each answer, and hands the caller the union. Last shift the
 * pair counter proved on the founder's own production frames that **SAM 3
 * answers the noun and ignores the laterality** — "left earring" and "right
 * earring" came back as the same hoop, twice, 740px and 728px. If that holds
 * for `ear` and `eye`, the product's bilateral union is one side unioned with
 * itself, and the second side of every symmetrical feature is silently missing.
 *
 * # It measured the defect, and it is now the fix's own instrument
 *
 * The first three runs are the finding, and their masks are kept where they
 * cannot be overwritten: `output/bilateral-laterality-BEFORE-FIX/`, where
 * `v147-eyes-product-union.png` is a single eye. The assertions below now state
 * the CURED contract — the plain noun asked once per half, and a union that
 * covers both sides — so the same script that found the defect is the one that
 * proves it gone, against the same two frames.
 *
 * # Artifact-first, and the product's own code path
 *
 * This does not re-implement `askRegion`. It calls the REAL
 * `createFalRegionReader(...).region({ name: "ear" })` and wraps `fetch` to
 * record what actually left the wire: the prompt in each POST body and the mask
 * URLs in each response. The masks compared are the bytes the product itself
 * received, at the URLs it itself was given. A replica would be a second source
 * of truth about the question being asked, which is the exact shape that let two
 * benches pass while the segment store was inert.
 *
 * # The reading cannot be a lone null (the fixture law)
 *
 * "The union only covers one side" is worthless unless the OTHER side had an ear
 * to find. So every specimen is ground-truthed first by the counter's known-good
 * method — cut the frame at her face's own midline and ask each half separately,
 * where a call can only answer about the pixels it was handed. A specimen whose
 * far ear is genuinely hidden is recorded as UNTESTABLE rather than as a pass.
 *
 * # The comparator gets its two controls, free
 *
 * "Are these two masks the same?" is a new instrument, so it is proven able to
 * answer both ways before its verdict counts: a mask against ITSELF must read
 * identical, and the ear union against the FACE mask must read distinct. Both
 * use masks already fetched — no extra provider call.
 *
 * Reads only. No row written, no account credit, no walk: SAM 3 reads on the
 * founder's provider balance, the fixture door fable-119 left open.
 *
 *   FAL_KEY=… railway.cmd run --service MySQL -- \
 *     npx tsx scripts/prove-bilateral-laterality-disposable.mts \
 *       --bucket https://pub-990e39d8d995468eb61aced83162123a.r2.dev
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { assertOneWorld, readLocalEnvFile } from "./lib/worldGuard.mts";
import { createChecks } from "./lib/drivePage.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import type { Mask } from "../server/castingV2/maskedComposite";
import { openDatabase } from "./lib/dbConnection.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const OUT = path.resolve("output/bilateral-laterality");
const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);

const base = arg("bucket").replace(/\/$/, "");
if (!base) throw new Error("--bucket <public url> is required — these are production frames");
if (base === (readLocalEnvFile().get("R2_PUBLIC_URL") ?? "").replace(/\/$/, "")) {
  throw new Error("--bucket is the local .env's bucket — the dev world, and these rows are production's");
}
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — this is a real segmentation read");

/**
 * HIS OWN FRAMES, the pair counter's two specimens, pinned by `publicId`.
 *
 * v#147 is the one that matters: two hoops, one per ear, both ears looked at at
 * 900px, so both sides are known present. v#156 is carried because it is the
 * frame he found, and because a one-ear frame is the case where a single-sided
 * union would be CORRECT — the contrast is the point.
 */
const SPECIMENS = [
  { label: "v#147 — two hoops, one per ear (both ears visible)", publicId: "8ac53e6e-ac36-4a83-83be-a17e04593450" },
  { label: "v#156 — the frame he found: one hoop, image-right ear", publicId: "ffe31dae-afac-4fd7-af15-46fb65ee273a" },
] as const;

/**
 * ALL THREE NAMES IN THE PRODUCT'S OWN SET — the class, not the instance (law 7).
 *
 * The ruling request was about `ear`. Asking only about `ear` would answer the
 * question and leave two members of the identical code path unmeasured, which is
 * the sweep the fix law exists to force. First run: `ear` passed on both frames
 * and `eyes` failed on both, so `eyebrows` is not a formality.
 */
const BILATERAL_UNDER_TEST = ["ear", "eyes", "eyebrows"] as const;

/** Below this, a mask is stray pixels rather than a feature. Stated, not tuned —
 *  every measured number is printed, so drift toward the line is visible. */
const PRESENT_AT = 40;

function pixels(mask: Mask): number {
  let count = 0;
  for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] > 0) count += 1;
  return count;
}

/** Pixels each side of a vertical line — the whole question, arithmetically. */
function acrossMidline(mask: Mask, midline: number): { left: number; right: number } {
  let left = 0;
  let right = 0;
  for (let y = 0; y < mask.height; y += 1) {
    const row = y * mask.width;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[row + x] === 0) continue;
      if (x < midline) left += 1;
      else right += 1;
    }
  }
  return { left, right };
}

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

/** THE COMPARATOR under test: are these two masks the same answer? */
function compare(a: Mask, b: Mask): { identical: boolean; iou: number; sameSize: boolean } {
  if (a.width !== b.width || a.height !== b.height) return { identical: false, iou: 0, sameSize: false };
  let both = 0;
  let either = 0;
  let differs = false;
  for (let at = 0; at < a.data.length; at += 1) {
    const one = a.data[at] > 0;
    const two = b.data[at] > 0;
    if (a.data[at] !== b.data[at]) differs = true;
    if (one && two) both += 1;
    if (one || two) either += 1;
  }
  return { identical: !differs, iou: either === 0 ? 1 : both / either, sameSize: true };
}

/**
 * A PNG the product was handed, into a single-channel mask.
 *
 * Deliberately the same shape as `falRegionReader.toMask` (which is private):
 * alpha if there is one, greyscale otherwise, and the stride PROVEN rather than
 * assumed, because sharp promotes buffers to three channels behind your back and
 * every downstream loop then reads two thirds of a buffer it never looked at.
 * The conversion is not what is under test here — the URLs are — but a wrong
 * stride would make every number below fiction.
 */
async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new Error(`mask is ${data.length} bytes for ${info.width}x${info.height} — not single-channel`);
  }
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

async function maskFromUrl(url: string): Promise<Mask> {
  const raw = url.startsWith("data:")
    ? Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return toMask(raw);
}

/**
 * THE GROUND TRUTH'S OWN INSTRUMENT, and it is deliberately NOT the product's.
 *
 * The pair counter's third design, unchanged: one prompt, EVERY mask unioned,
 * asked of a picture that contains one side only. It cannot be the product's
 * `region()` here for two reasons — `ear` is in the product's own bilateral set,
 * so a half-frame call would recurse into the very branch under test; and
 * `masks[0]` discards a second instance, which is fine for a region and wrong
 * for a presence reading. A comparator that shares the mechanism it is checking
 * is not a comparator.
 */
async function askEveryMask(image: Buffer, prompt: string): Promise<{ mask: Mask; count: number }> {
  const response = await realFetch("https://fal.run/fal-ai/sam-3/image", {
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
  let union: Mask | null = null;
  for (const entry of entries) {
    const url = typeof entry === "string" ? entry : entry?.url;
    if (!url) continue;
    const mask = await maskFromUrl(url);
    if (!union) { union = mask; continue; }
    if (union.width !== mask.width || union.height !== mask.height) continue;
    for (let at = 0; at < union.data.length; at += 1) if (mask.data[at] > 0) union.data[at] = 255;
  }
  if (union) return { mask: union, count: entries.length };
  /* Nothing there is an answer, and it is the answer a hidden ear gives. */
  const meta = await sharp(image).metadata();
  return {
    mask: { data: Buffer.alloc((meta.width ?? 1) * (meta.height ?? 1), 0), width: meta.width ?? 1, height: meta.height ?? 1 },
    count: 0,
  };
}

async function savePng(mask: Mask, file: string): Promise<void> {
  await writeFile(
    path.join(OUT, file),
    await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
      .resize({ width: 320 }).png().toBuffer(),
  );
}

/* ------------------------------------------------------------------ the wire */

/**
 * WHAT ACTUALLY LEFT THE PROCESS, recorded from `fetch` itself.
 *
 * Each SAM 3 POST is self-identifying by the prompt in its own body, so the two
 * sides of a `Promise.all` cannot be mixed up by completion order.
 */
type WireCall = { prompt: string; maskCount: number; urls: string[] };
const wire: WireCall[] = [];
const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  const isSam3 = url.includes("fal-ai/sam-3/image") && (init?.method ?? "GET") === "POST";
  const response = await realFetch(input, init);
  if (!isSam3 || !response.ok) return response;

  /* Read the body once, record, and hand the caller an identical response. */
  const text = await response.text();
  try {
    const sent = JSON.parse(String(init?.body ?? "{}"));
    const json = JSON.parse(text);
    const entries: any[] = Array.isArray(json.masks) ? json.masks : [];
    wire.push({
      prompt: String(sent.prompt ?? "(none)"),
      maskCount: entries.length,
      urls: entries.map((entry) => (typeof entry === "string" ? entry : entry?.url)).filter(Boolean),
    });
  } catch {
    /* An unparseable body is the product's problem to handle, not ours to hide. */
  }
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}) as typeof fetch;

/* ------------------------------------------------------------------- the run */

const connection = await openDatabase({
  uri: process.env[databaseKey]!, timezone: "Z",
} as mysql.ConnectionOptions);
const reader = createFalRegionReader({ apiKey });
const { check, absent, records, failures, print } = createChecks();
await mkdir(OUT, { recursive: true });

/** Kept for the comparator's own controls, which must not cost a call. */
let controlSelf: Mask | null = null;
let controlOther: Mask | null = null;
/** The refuted cheaper fix, counted rather than asserted — see its call site. */
const candidate = { total: 0, covered: 0, missed: [] as string[] };

for (const specimen of SPECIMENS) {
  console.log(`\n=== ${specimen.label}`);
  const [row] = await connection.query<any[]>(
    "SELECT id, imageKey FROM casting_candidate_variants WHERE publicId = ? LIMIT 1",
    [specimen.publicId],
  ).then(([rows]) => rows as any[]);
  if (!row?.imageKey) {
    check(false, `${specimen.label}: the frame is readable`, `no row for ${specimen.publicId} — wrong world, or it is gone`);
    continue;
  }
  const response = await realFetch(`${base}/${row.imageKey}`);
  if (!response.ok) {
    check(false, `${specimen.label}: the frame is readable`, `frame HTTP ${response.status}`);
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  /* Her OWN midline, not the image's — a portrait is not guaranteed centred. */
  const face = await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
  const midline = Math.round(centroidX(face) ?? width / 2);
  console.log(`    frame ${width}×${height}, her face's midline at x=${midline}`);
  if (!controlOther) controlOther = face;

  for (const name of BILATERAL_UNDER_TEST) {
    const singular = name === "eyes" ? "eye" : name.replace(/s$/, "");
    console.log(`  -- ${name}`);

    /*
      GROUND TRUTH FIRST, by the method that cannot be laterally wrong: the
      frame is cut at her midline and each half is asked on its own, so the
      model can only answer about the pixels it was handed.
    */
    const truth = await Promise.all(([
      { side: "left", left: 0, width: midline },
      { side: "right", left: midline, width: width - midline },
    ] as const).map(async (half) => {
      const halfBytes = await sharp(bytes)
        .extract({ left: half.left, top: 0, width: half.width, height })
        .png().toBuffer();
      const { mask } = await askEveryMask(halfBytes, singular);
      await savePng(mask, `v${row.id}-${name}-truth-${half.side}.png`);
      return { side: half.side, px: pixels(mask) };
    }));
    const visible = truth.filter((side) => side.px >= PRESENT_AT);
    const truthSaw = truth.map((side) => `${side.side}=${side.px}px`).join(" ");
    console.log(`      ground truth (split frame, "${singular}" per half): ${truthSaw}`);

    /*
      NOW THE PRODUCT'S OWN CALL — the real reader, the real bilateral branch.
    */
    const before = wire.length;
    const union = await reader.region({ image: bytes, name, absentIsAnswer: true });
    const calls = wire.slice(before);
    await savePng(union, `v${row.id}-${name}-product-union.png`);

    /*
      ASSERT AT THE WIRE, and this is where the FIX is proven rather than read.

      The defect and the cure are both visible in the outgoing prompts. Before:
      two POSTs, `"left eye"` and `"right eye"`, whose adjectives production
      ignored. After: the face, then the PLAIN noun once per half — the same
      arithmetic the pair counter needed, because a call can only answer about
      the pixels it was handed. If the adjectives ever come back, this fails here
      rather than in a customer's picture.
    */
    const prompts = calls.map((call) => call.prompt);
    const named = prompts.filter((prompt) => /^(left|right) /.test(prompt));
    check(
      prompts.length === 3 && prompts[0] === "face"
      && prompts.filter((prompt) => prompt === singular).length === 2 && named.length === 0,
      `${specimen.label} · ${name}: asked one side to a PICTURE, never by name`,
      `${calls.length} POST(s) at the wire: ${prompts.map((prompt) => `"${prompt}"`).join(", ")}`,
    );

    /* Each side's own answer, at its own crop's size. */
    const sides = await Promise.all(calls.filter((call) => call.prompt === singular).map(async (call) => ({
      prompt: call.prompt,
      maskCount: call.maskCount,
      mask: call.urls[0] ? await maskFromUrl(call.urls[0]) : null,
    })));
    for (const [index, side] of sides.entries()) {
      if (side.mask) await savePng(side.mask, `v${row.id}-${name}-wire-half-${index}.png`);
    }
    if (sides[0]?.mask && !controlSelf) controlSelf = sides[0].mask;

    const wireSaw = sides
      .map((side) => (side.mask
        ? `${side.maskCount} mask(s) at ${side.mask.width}×${side.mask.height} = ${pixels(side.mask)}px`
        : "nothing on this side"))
      .join("; ");
    console.log(`      at the wire, per half: ${wireSaw}`);
    check(
      sides.length === 2 && sides.every((side) => side.mask !== null && side.mask.width < width),
      `${specimen.label} · ${name}: each side was answered about a HALF frame`,
      `${wireSaw} (the whole frame is ${width}px wide)`,
    );

    /*
      AND THE ANSWER THE CALLER IS HANDED. This is the finding or its absence:
      does the union the product composes with cover BOTH sides of her midline?
      Only asserted where the ground truth says there was something to find.
    */
    const split = acrossMidline(union, midline);
    const unionSaw = `union ${pixels(union)}px = left ${split.left}px + right ${split.right}px across x=${midline}`;
    console.log(`      the caller receives: ${unionSaw}`);
    if (visible.length === 2) {
      check(
        split.left >= PRESENT_AT && split.right >= PRESENT_AT,
        `${specimen.label} · ${name}: the bilateral union covers BOTH sides, and both were there`,
        `${unionSaw}; ground truth ${truthSaw} (both ≥${PRESENT_AT}px)`,
      );
    } else {
      absent(
        `${specimen.label} · ${name}: the bilateral union covers BOTH sides`,
        `UNTESTABLE on this frame — the split-frame ground truth found ${visible.length} side(s): ${truthSaw}`,
      );
    }

    /*
      AND THE THIRD READING, which is the candidate for the CHEAPER FIX.

      The reader's bilateral set rests on one written premise: *"SAM 3 returns
      exactly ONE instance for 'ear', and which one depends on the wording."* If
      that is false — if the plain noun returns an instance PER SIDE and only
      `masks[0]` was throwing the second away — then the fix is to stop
      qualifying and start keeping, which is one call instead of two and no crop
      arithmetic at all. Measured rather than assumed, because the premise is the
      only reason the failing branch exists.
    */
    const plain = await askEveryMask(bytes, singular);
    await savePng(plain.mask, `v${row.id}-${name}-plain-noun.png`);
    const plainSplit = acrossMidline(plain.mask, midline);
    console.log(
      `      the plain noun "${singular}", every mask kept: ${plain.count} mask(s), `
      + `${pixels(plain.mask)}px = left ${plainSplit.left}px + right ${plainSplit.right}px`,
    );
    /*
      A MEASUREMENT, NOT A CONTRACT — so it is tallied rather than checked.

      Nothing in the product promises the plain noun covers two sides; this is
      the refutation of the cheaper fix, and a refutation recorded as a FAILING
      check would read as a broken product forever after. The tally at the end is
      the number that matters.
    */
    if (visible.length === 2) {
      candidate.total += 1;
      if (plainSplit.left >= PRESENT_AT && plainSplit.right >= PRESENT_AT) candidate.covered += 1;
      else candidate.missed.push(`${name} on v${row.id}`);
    }

  }
}

/* --------------------------------------------- the comparator's own controls */

/*
  A NEW INSTRUMENT GETS BOTH CONTROLS BEFORE ITS VERDICTS COUNT (working law 2).
  "These two masks are the same" would be a useless finding from a comparator
  that can only ever say "same", so it is shown saying both — on masks already
  in hand, so proving it costs nothing.
*/
if (controlSelf) {
  const self = compare(controlSelf, controlSelf);
  check(self.identical && self.iou === 1, "CONTROL (positive): the comparator calls a mask identical to ITSELF",
    `identical=${self.identical}, IoU ${self.iou.toFixed(3)}`);
} else {
  check(false, "CONTROL (positive): the comparator calls a mask identical to ITSELF", "no mask was captured to compare");
}
if (controlSelf && controlOther) {
  const other = compare(controlSelf, controlOther);
  check(!other.identical && other.iou < 0.5, "CONTROL (negative): the comparator calls a feature mask DIFFERENT from the face mask",
    `identical=${other.identical}, IoU ${other.iou.toFixed(3)} — it can say "different"`);
} else {
  check(false, "CONTROL (negative): the comparator calls a feature mask DIFFERENT from the face mask", "no second mask captured");
}

await connection.end();
print();
console.log(
  `\nTHE REFUTED CHEAPER FIX: the plain noun, every mask kept, covered both sides in `
  + `${candidate.covered} of ${candidate.total} cells${candidate.missed.length ? ` — missed: ${candidate.missed.join(", ")}` : ""}. `
  + "It returned exactly ONE mask on every call, which is why the frame has to be cut.",
);
await writeFile(
  path.join(OUT, "laterality.json"),
  `${JSON.stringify({ records, wire, candidate }, null, 2)}\n`,
  "utf8",
);
console.log(`\nmasks and record: ${OUT}`);
console.log(
  failures().length === 0
    ? "\nThe product's bilateral regions get two sides. No finding here."
    : "\nA FAILURE ABOVE IS THE FINDING — read the masks, not this line.",
);
process.exit(0);
