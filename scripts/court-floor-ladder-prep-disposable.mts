/**
 * THE FLOOR LADDER'S THREE PICTURES — the free half of the floor court
 * (ordered fable-1183 §3, designed opus-900/901, ratified fable-1207/1208,
 * model named opus-902 §1).
 *
 *   npx tsx scripts/court-floor-ladder-prep-disposable.mts
 *
 * # The one variable
 *
 * `INK_DESIGN_MIN_EDGE = 256` has never been measured against a render — its
 * whole justification is an asserted sentence in its own docblock. This builds
 * the three references that measure it, differing in NOTHING but the pixel
 * dimensions the engine receives:
 *
 * ```
 *   A   the design as it is                   1200x1697   clears the floor
 *   B   scaled to short edge 183               183x259    UNDER it
 *   C   B's pixels through a real upscaler     ~732x1036  clears it again
 * ```
 *
 * **183 is not an invented rung.** It is S1's measured upper-arm short edge —
 * what the founder's own *"copy his right arm sleeve"* would have supplied if
 * the floor let it through — carried to a placement whose frame can be read.
 *
 * # C IS A REAL SUPER-RESOLUTION MODEL AND NEVER A RESIZE
 *
 * `fal-ai/aura-sr`: 4x GAN, no prompt, no diffusion, **no invention**. The
 * fidelity law names the dedicated tool, and 1207 §2 forbids a lanczos in a
 * fidelity court.
 *
 * ⚠ **`fal-ai/clarity-upscaler` was considered and REJECTED** (opus-902 §1): it
 * is a diffusion refiner that hallucinates plausible detail, which on a
 * customer's OWN ARTWORK invents strokes they did not draw. If C fails, the
 * honest verdict is *the floor is real* — not *try the one that makes things
 * up*.
 *
 * C is NOT resized to match A afterwards. A lanczos step to make a number look
 * tidy is the very thing the ruling forbids; its real dimensions are printed.
 *
 * # It grades nothing
 *
 * Law 9. Whether B is legible is for eyes, and the frames after them. This
 * writes files and prints dimensions.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import "dotenv/config";
import sharp from "sharp";

import { QUEUE_BASE, falHeaders } from "../server/providers/falTransport";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/court-floor");
const DESIGN = resolve(
  REPO,
  "docs/specs/references/build-two-founder-specimens/tattoo-sleeve-trex-geometric-design.png",
);

/** S1's measured upper-arm short edge (opus-899, re-driven opus-900 §1). */
const RUNG_B_SHORT_EDGE = 183;

/** Named in opus-902 §1 BEFORE it was called, which is the ruling's condition. */
const UPSCALER = "fal-ai/aura-sr";
/** Declared fallback, same class — faithful, no prompt. Reported if it is used. */
const UPSCALER_FALLBACK = "fal-ai/esrgan";

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("REFUSING: FAL_KEY is not set — arm C needs a real upscaler and this will not fake one.");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const lines: string[] = [];
const say = (line: string) => { console.log(line); lines.push(line); };

const native = await readFile(DESIGN);
const nativeMeta = await sharp(native).metadata();
say(`A  native      ${nativeMeta.width}x${nativeMeta.height}  ${native.length} B`);
await writeFile(resolve(OUT, "A-native.png"), native);

/*
  THE SHORT EDGE IS THE ONE THAT IS SET, because the floor is a shortest-edge
  test — `cropClearsMinimumEdge` takes `Math.min(width, height)`. Scaling on the
  long edge would land the short one somewhere nobody chose.
*/
const shortest = Math.min(nativeMeta.width ?? 0, nativeMeta.height ?? 0);
if (shortest === 0) {
  console.error("REFUSING: the design has no dimensions");
  process.exit(1);
}
const scale = RUNG_B_SHORT_EDGE / shortest;
const small = await sharp(native)
  .resize({
    width: Math.round((nativeMeta.width ?? 0) * scale),
    height: Math.round((nativeMeta.height ?? 0) * scale),
    fit: "fill",
  })
  .png()
  .toBuffer();
const smallMeta = await sharp(small).metadata();
say(`B  scaled      ${smallMeta.width}x${smallMeta.height}  ${small.length} B   (short edge ${RUNG_B_SHORT_EDGE}, UNDER the 256 floor)`);
await writeFile(resolve(OUT, "B-small.png"), small);

/*
  AND C IS B'S OWN BYTES THROUGH THE UPSCALER — not the native picture
  downscaled and re-upscaled in one chain. Sent as a data URI so no object is
  created on anybody's CDN, the same posture every image job in this codebase
  takes (`inlineResult`).
*/
const asDataUri = `data:image/png;base64,${small.toString("base64")}`;

/*
  ⚠ THIS DOES NOT GO THROUGH `runFalImageJob`, AND THE REASON COST TWO CALLS.

  That function reads its result as `payload.images[0].url` and nothing else —
  which is the contract of every GENERATOR this product dispatches to. An
  upscaler answers `{ image: { url } }`, SINGULAR. Both attempts through it
  therefore ran, cost money, and came back as *"fal.ai completed without an
  image"* — a shape mismatch reported as a provider failure, which is the
  loudest way a court can be wrong about what it just bought.

  So the call is made here, minimally, accepting EITHER shape, and the endpoint
  URLs come from fal's own submit response rather than being constructed (the
  sub-path trap the transport's own comment records). Nothing about the shipped
  transport changes: no product path dispatches to an upscaler.
*/
const attempt = async (endpoint: string): Promise<Buffer | null> => {
  const headers = falHeaders(apiKey);
  const submit = await fetch(`${QUEUE_BASE}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ image_url: asDataUri, sync_mode: true }),
  });
  if (!submit.ok) {
    say(`   ${endpoint} refused the request (${submit.status}): ${(await submit.text().catch(() => "")).slice(0, 200)}`);
    return null;
  }
  const submitted = (await submit.json()) as {
    request_id?: string; status_url?: string; response_url?: string;
  };
  if (!submitted.request_id) { say(`   ${endpoint} returned no request id`); return null; }
  const statusUrl = submitted.status_url ?? `${QUEUE_BASE}/${endpoint}/requests/${submitted.request_id}/status`;
  const resultUrl = submitted.response_url ?? `${QUEUE_BASE}/${endpoint}/requests/${submitted.request_id}`;
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 3_000));
    const status = await fetch(statusUrl, { headers }).catch(() => null);
    if (!status?.ok) continue;
    if (((await status.json()) as { status?: string }).status !== "COMPLETED") continue;
    const result = await fetch(resultUrl, { headers });
    if (!result.ok) { say(`   ${endpoint} result fetch failed (${result.status})`); return null; }
    /* EITHER SHAPE, and the one that is present is named in the log. */
    const payload = (await result.json()) as {
      image?: { url?: string };
      images?: Array<{ url?: string }>;
    };
    const url = payload.image?.url ?? payload.images?.[0]?.url;
    if (!url) { say(`   ${endpoint} completed with neither \`image\` nor \`images[0]\``); return null; }
    say(`   ${endpoint} answered in the \`${payload.image?.url ? "image" : "images[0]"}\` field`);
    return url.startsWith("data:")
      ? Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
      : Buffer.from(await (await fetch(url)).arrayBuffer());
  }
  say(`   ${endpoint} did not complete inside five minutes`);
  return null;
};

let usedEndpoint = UPSCALER;
let big = await attempt(UPSCALER);
if (big === null) {
  usedEndpoint = UPSCALER_FALLBACK;
  say(`   FALLING BACK to ${UPSCALER_FALLBACK} — declared in opus-902 §1, and said here rather than quietly`);
  big = await attempt(UPSCALER_FALLBACK);
}
if (big === null || big.length === 0) {
  say("STOPPED: no upscaler answered — arm C cannot be built and the court must not run two thirds of itself");
  await writeFile(resolve(OUT, "court.log"), `${lines.join("\n")}\n`, "utf8");
  process.exit(1);
}

const bigMeta = await sharp(big).metadata();
say(`C  upscaled    ${bigMeta.width}x${bigMeta.height}  ${big.length} B   via ${usedEndpoint}`);
await writeFile(resolve(OUT, "C-upscaled.png"), big);

say("");
say("EVERY FILE ABOVE IS FOR EYES BEFORE IT IS FOR AN ENGINE. B is the one to look hard at.");
await writeFile(resolve(OUT, "court.log"), `${lines.join("\n")}\n`, "utf8");
process.exit(0);
