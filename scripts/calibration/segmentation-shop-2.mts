/**
 * SEGMENTATION SHOP, ROUND TWO — the two rows round one left unfilled, plus the
 * positive control it could not run.
 *
 * Round one ratified `birefnet/v2 · Matting` for whole-subject work and rejected
 * `evf-sam` (binary masks, visually crude, and it invented a confident eyeglasses
 * blob on a face wearing none — D-213). It left three things open:
 *
 *   1. a real FACE-PARSING model for named facial regions
 *   2. a HAIR-SPECIFIC matting model
 *   3. the POSITIVE eyeglasses control, which needed a bespectacled face and
 *      there wasn't one
 *
 * # What the catalogue actually contains, looked up not recalled
 *
 * **There is no dedicated face-parsing model on fal.** The catalogue search for
 * "face parsing" returns zero rows. That is a finding, not a gap in the search:
 * the face-parsing row has to be filled by the best text-promptable segmenter, or
 * left empty and honestly marked so. SAM 3 / SAM 3.1 are the leading candidates
 * and are newer than the EVF-SAM2 round one rejected.
 *
 * Every endpoint id and every field name below was read from fal's own OpenAPI
 * (`/api/openapi/queue/openapi.json?endpoint_id=...`), because the docs site is
 * bot-blocked and **a guessed field name is accepted silently and does nothing**
 * — D-202's class.
 *
 * # The instrument, and why it is shaped this way
 *
 * Round one's negative control caught a real defect, so it is permanent (D-213).
 * But a negative control alone cannot tell you a segmenter is GOOD — only that it
 * is not obviously lying. D-203 is binding: both controls or it does not ship. So
 * eyeglasses is asked as a **PAIR on the same endpoint** — a face wearing chunky
 * frames and a face wearing none — and the number that decides the row is the
 * SEPARATION between them, never either figure alone.
 *
 * SAM 3 exposes `include_scores`, which is the thing EVF-SAM lacked: a
 * confidence figure to gate on. A segmenter that scores "eyeglasses" alike on
 * both faces cannot back the record gate no matter how pretty its mask is.
 *
 * Measured per row:
 *   coverage   alpha-weighted, so a faint halo is not scored as solid area
 *   softness   share of pixels strictly between 0 and 255 — a MATTE has an edge,
 *              a binary outline does not, and the founder's rider (D-212) says
 *              soft boundaries must be mattes
 *   score      the model's own confidence, where it reports one
 *   field      WHICH response field the mask was found in, so a wrong-field read
 *              cannot masquerade as a zero-coverage result
 *
 * Nothing is chosen here. This produces the routing table's evidence column.
 *
 *   npx tsx scripts/calibration/segmentation-shop-2.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage } from "../../server/castingV2/maskGeometry";

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error("FAL_KEY required");

const OUT = "output/masked/segmentation-shop-2";
mkdirSync(OUT, { recursive: true });

/*
  Three specimens, each doing a job no other one can do.

  `bespectacled` is this workstream's own material — chunky opaque full-rim
  frames, clear lens interiors with the eye plainly visible behind them, brows
  above the frames, and flyaway hair against a plain ground. Verified by opening
  it at full resolution, not by looking at a contact sheet (D-202).

  `thinFrames` is the hard end of the same question: fine low-contrast wire.

  `bare` wears no glasses at all and exists only to be asked for them.
*/
const SPECIMENS = {
  bespectacled: "output/masked/specimens/fresh-02.png",
  thinFrames: "output/masked/specimens/wire-04.png",
  bare: "output/quality-unit/specimens/built-base.png",
} as const;

type SpecimenKey = keyof typeof SPECIMENS;

const loaded = new Map<SpecimenKey, { dataUri: string; width: number; height: number }>();
for (const [key, file] of Object.entries(SPECIMENS) as [SpecimenKey, string][]) {
  const bytes = readFileSync(file);
  const meta = await sharp(bytes).metadata();
  loaded.set(key, {
    dataUri: `data:image/png;base64,${bytes.toString("base64")}`,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  });
}

async function run(endpoint: string, body: Record<string, unknown>) {
  const started = Date.now();
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${KEY}`,
      "Content-Type": "application/json",
      /* D-208 — a mask is a picture of a person's face. One hour on fal's CDN. */
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false as const, detail: (await response.text()).slice(0, 240), ms: Date.now() - started };
  }
  return { ok: true as const, json: await response.json() as any, ms: Date.now() - started };
}

/**
 * Find the mask, and SAY WHERE IT CAME FROM.
 *
 * Round one's extractor tried a list of field names and returned null on a miss.
 * That is one silent step from scoring a mask nobody located as 0% coverage, so
 * the field it matched is now carried into the row and printed.
 */
async function fetchMask(json: any): Promise<{ bytes: Buffer; field: string } | null> {
  const sources: [string, unknown][] = [
    ["masks[0]", json?.masks?.[0]?.url ?? (typeof json?.masks?.[0] === "string" ? json.masks[0] : undefined)],
    ["mask_image", json?.mask_image?.url],
    ["image", json?.image?.url],
    ["images[0]", json?.images?.[0]?.url],
  ];
  for (const [field, url] of sources) {
    if (typeof url !== "string") continue;
    if (url.startsWith("data:")) return { bytes: Buffer.from(url.split(",")[1], "base64"), field };
    const response = await fetch(url);
    if (response.ok) return { bytes: Buffer.from(await response.arrayBuffer()), field };
  }
  return null;
}

/**
 * Normalise into our one-byte-per-pixel mask — and PROVE where the mask lives
 * rather than assuming it (D-210).
 *
 * Round one, and this script's own first run, converted the response to
 * greyscale and measured that. For a segmenter that answers with a **cut-out**
 * — RGBA, where the alpha channel IS the segmentation and RGB carries picture
 * content — that reads the darkness of the subject's hair and calls it a mask.
 * SAM 3 answers exactly that way, so its first-run figures were measurements of
 * the photograph. The tell was `fully-opaque 0.00%` on a mask whose alpha turned
 * out to be perfectly binary.
 *
 * `.toColourspace("b-w")` cannot catch this: it CONVERTS four channels to one,
 * so the single-channel guard it was paired with could never fire. A check whose
 * passing state required it to have read nothing is not a check.
 *
 * The rule, and the reason it is safe: a cut-out's alpha is precisely its
 * segmentation, so where there is an alpha channel, the alpha IS the mask;
 * where the answer is already single-channel, the image is the mask. Which
 * branch ran is returned and recorded, so a wrong choice cannot be silent.
 */
async function toMask(bytes: Buffer, expect: { width: number; height: number }) {
  const meta = await sharp(bytes).metadata();
  const source = meta.hasAlpha ? "alpha" : "luma";
  const { data, info } = meta.hasAlpha
    ? await sharp(bytes).extractChannel(3).raw().toBuffer({ resolveWithObject: true })
    : await sharp(bytes).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  /* Now the guard can actually fire — neither branch converts channel count. */
  if (data.length !== info.width * info.height) {
    throw new Error(`mask is not single-channel: ${data.length} bytes for ${info.width}x${info.height}`);
  }
  let soft = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] !== 0 && data[index] !== 255) soft += 1;
  }
  return {
    mask: { data, width: info.width, height: info.height },
    dims: `${info.width}x${info.height}`,
    mismatched: info.width !== expect.width || info.height !== expect.height,
    softness: soft / data.length,
    source,
  };
}

type Candidate = {
  name: string;
  endpoint: string;
  specimen: SpecimenKey;
  /** Marks the two halves of the eyeglasses control so the report can pair them. */
  control?: "positive" | "negative";
  body: (dataUri: string) => Record<string, unknown>;
};

const REGIONS = ["eyeglasses", "hair", "eyebrows", "eyes", "face skin", "lips"] as const;

const CANDIDATES: Candidate[] = [];

/* ---- SAM 3 and SAM 3.1: the face-parsing row's only real candidates ---- */
for (const [tag, endpoint] of [["sam-3", "fal-ai/sam-3/image"], ["sam-3-1", "fal-ai/sam-3-1/image"]] as const) {
  for (const region of REGIONS) {
    CANDIDATES.push({
      name: `${tag} · ${region}`,
      endpoint,
      specimen: "bespectacled",
      control: region === "eyeglasses" ? "positive" : undefined,
      body: (image_url) => ({ image_url, prompt: region, include_scores: true, output_format: "png" }),
    });
  }
  /* The permanent negative control — same endpoint, same word, a face with none. */
  CANDIDATES.push({
    name: `${tag} · eyeglasses (NEGATIVE CONTROL — she wears none)`,
    endpoint,
    specimen: "bare",
    control: "negative",
    body: (image_url) => ({ image_url, prompt: "eyeglasses", include_scores: true, output_format: "png" }),
  });
  /* The hard end of the same question: fine low-contrast wire. */
  CANDIDATES.push({
    name: `${tag} · eyeglasses (thin wire frames)`,
    endpoint,
    specimen: "thinFrames",
    body: (image_url) => ({ image_url, prompt: "eyeglasses", include_scores: true, output_format: "png" }),
  });
}

/* ---- the hair / whole-subject matting row ---- */
CANDIDATES.push({
  name: "birefnet/v2 · Matting (whole subject)",
  endpoint: "fal-ai/birefnet/v2",
  specimen: "bespectacled",
  body: (image_url) => ({ image_url, mask_only: true, model: "Matting", output_format: "png" }),
});
CANDIDATES.push({
  name: "birefnet v1 · Portrait @2048",
  endpoint: "fal-ai/birefnet",
  specimen: "bespectacled",
  body: (image_url) => ({
    image_url,
    model: "Portrait",
    operating_resolution: "2048x2048",
    output_mask: true,
    refine_foreground: true,
    output_format: "png",
  }),
});
CANDIDATES.push({
  name: "sa2va/4b · hair (text)",
  endpoint: "fal-ai/sa2va/4b/image",
  specimen: "bespectacled",
  body: (image_url) => ({ image_url, prompt: "<image>Please segment the hair." }),
});
CANDIDATES.push({
  name: "sa2va/4b · eyeglasses (text)",
  endpoint: "fal-ai/sa2va/4b/image",
  specimen: "bespectacled",
  control: "positive",
  body: (image_url) => ({ image_url, prompt: "<image>Please segment the eyeglasses." }),
});
CANDIDATES.push({
  name: "sa2va/4b · eyeglasses (NEGATIVE CONTROL — she wears none)",
  endpoint: "fal-ai/sa2va/4b/image",
  specimen: "bare",
  control: "negative",
  body: (image_url) => ({ image_url, prompt: "<image>Please segment the eyeglasses." }),
});

/*
  EVF-SAM re-measured, not re-litigated.

  Round one rejected it on numbers produced by the same wrong-channel reader this
  round just fixed, including the 0.1% figure that became D-213's negative
  control. The REJECTION very likely stands — it returned something for glasses
  that were not there, and nonzero is nonzero however you read it — but the
  magnitude was measured on the photograph. A verdict is allowed to survive; a
  number that fed a ruling is not allowed to stay unchecked.
*/
for (const region of ["eyeglasses", "hair"] as const) {
  CANDIDATES.push({
    name: `evf-sam · ${region} (RE-MEASURED on the fixed reader)`,
    endpoint: "fal-ai/evf-sam",
    specimen: "bespectacled",
    body: (image_url) => ({ image_url, prompt: region, mask_only: true, blur_mask: region === "hair" ? 5 : 3 }),
  });
}
CANDIDATES.push({
  name: "evf-sam · eyeglasses (NEGATIVE CONTROL — RE-MEASURED)",
  endpoint: "fal-ai/evf-sam",
  specimen: "bare",
  body: (image_url) => ({ image_url, prompt: "eyeglasses", mask_only: true, blur_mask: 3 }),
});

const rows: any[] = [];
for (const candidate of CANDIDATES) {
  const specimen = loaded.get(candidate.specimen)!;
  const result = await run(candidate.endpoint, candidate.body(specimen.dataUri));
  const label = candidate.name.padEnd(52);
  if (!result.ok) {
    console.log(`  ${label} FAILED — ${result.detail}`);
    rows.push({ ...candidate, body: undefined, ok: false, detail: result.detail });
    continue;
  }
  const found = await fetchMask(result.json);
  if (!found) {
    /*
      An EMPTY mask set and an unreadable response are not the same event, and
      collapsing them is how the correct answer to a negative control gets filed
      as a broken reader. "It found nothing" is a RESULT — for the negative
      control it is the result we want. "I could not find where it put the mask"
      is a defect in this script. They are reported apart.
    */
    const empty = Array.isArray(result.json?.masks) && result.json.masks.length === 0;
    if (empty) {
      console.log(`  ${label} RETURNED NOTHING — masks: [] (for the negative control this is the right answer)`);
      rows.push({
        name: candidate.name, endpoint: candidate.endpoint, specimen: candidate.specimen,
        control: candidate.control ?? null, ok: true, empty: true,
        coverage: 0, softness: 0, score: null, ms: result.ms,
      });
    } else {
      console.log(`  ${label} UNREADABLE — keys: ${Object.keys(result.json).join(",")}`);
      rows.push({ name: candidate.name, endpoint: candidate.endpoint, ok: false, detail: `mask not located; keys=${Object.keys(result.json).join(",")}` });
    }
    continue;
  }
  const read = await toMask(found.bytes, specimen);
  const area = coverage(read.mask);
  const score = result.json?.scores?.[0] ?? result.json?.metadata?.[0]?.score ?? null;
  writeFileSync(`${OUT}/${candidate.name.replace(/[^a-z0-9]+/gi, "-")}.png`, found.bytes);
  console.log(
    `  ${label} ${read.dims}${read.mismatched ? " (MISMATCH)" : ""}`
    + `  cov ${(area * 100).toFixed(2)}%  soft ${(read.softness * 100).toFixed(1)}%`
    + `  score ${score === null ? "n/a" : Number(score).toFixed(3)}`
    + `  [${found.field}/${read.source}]  ${result.ms}ms`,
  );
  rows.push({
    name: candidate.name,
    endpoint: candidate.endpoint,
    specimen: candidate.specimen,
    control: candidate.control ?? null,
    ok: true,
    dims: read.dims,
    matchesMaster: !read.mismatched,
    maskField: found.field,
    /* Which channel the mask was read from — the thing the first run got wrong. */
    maskSource: read.source,
    coverage: area,
    softness: read.softness,
    score: score === null ? null : Number(score),
    ms: result.ms,
  });
}

/*
  The control verdict, computed rather than eyeballed. A row earns the eyeglasses
  routing slot only if it separates a face wearing frames from one that isn't.
*/
console.log("\n=== eyeglasses control pairs (the number that decides the row) ===");
for (const endpoint of [...new Set(rows.filter((r) => r.control).map((r) => r.endpoint))]) {
  const positive = rows.find((r) => r.endpoint === endpoint && r.control === "positive" && r.ok);
  const negative = rows.find((r) => r.endpoint === endpoint && r.control === "negative" && r.ok);
  if (!positive || !negative) {
    console.log(`  ${endpoint.padEnd(24)} INCOMPLETE PAIR — no verdict is available`);
    continue;
  }
  const ratio = negative.coverage > 0 ? positive.coverage / negative.coverage : Infinity;
  console.log(
    `  ${endpoint.padEnd(24)} positive ${(positive.coverage * 100).toFixed(2)}%  `
    + `negative ${(negative.coverage * 100).toFixed(2)}%  separation ${ratio === Infinity ? "CLEAN — the negative returned nothing at all" : `${ratio.toFixed(1)}x`}`
    + `  scores ${positive.score ?? "n/a"} vs ${negative.score ?? "n/a"}`,
  );
}

writeFileSync(
  `${OUT}/results.json`,
  `${JSON.stringify({ specimens: SPECIMENS, rows }, null, 2)}\n`,
);
console.log(`\nmasks and results written to ${OUT}`);
