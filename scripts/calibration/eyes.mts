/**
 * The ocular check for calibration grading (founder item 14, 2026-08-01).
 *
 * Mismatched pupils recurred across sheets — and recurred in legacy output too
 * — without anyone catching them at grading time. The reason is mundane: at
 * contact-sheet scale a pupil is about four pixels across. The defect was never
 * hidden, it was just never visible. So this does two things, in that order of
 * trust:
 *
 *   1. Crops the eye band out of every candidate and lays the crops up at 4×,
 *      which is what actually lets a human see the defect. This is the check.
 *   2. Optionally runs a vision model over those crops to flag likely
 *      asymmetry, so a long grid does not depend on sustained attention.
 *
 * The second is a screen, not a verdict — the same standing this file's sibling
 * `analyse.mts` gives its perceptual metric. A flag means look closer; a clean
 * pass means nothing on its own, because a model that misses a subtle pupil
 * mismatch is exactly as plausible as a human who does.
 *
 * Usage:
 *   npx tsx scripts/calibration/eyes.mts <dir> [--screen]
 *
 * Writes <dir>/eyes/ with one crop per source image plus `contact.png`.
 * `--screen` additionally calls OpenRouter and needs OPENROUTER_API_KEY.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const VISION_MODEL = "anthropic/claude-sonnet-5";

/**
 * The band to keep, as fractions of image height. Casting framing puts the eye
 * line high and consistently — chest-up, head not cropped — so a fixed band
 * lands rather than needing face detection. Generous enough to survive a tilted
 * head; if a crop misses, that is visible in the contact sheet immediately.
 */
const BAND_TOP = 0.14;
const BAND_BOTTOM = 0.42;

const CROP_WIDTH = 720;
const COLUMNS = 2;

export type EyeCrop = { name: string; file: string };

export async function cropEyeBands(dir: string, outDir: string): Promise<EyeCrop[]> {
  const sources = fs
    .readdirSync(dir)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort();
  if (sources.length === 0) throw new Error(`no images in ${dir}`);

  fs.mkdirSync(outDir, { recursive: true });
  const crops: EyeCrop[] = [];

  for (const name of sources) {
    const source = path.join(dir, name);
    const { width = 0, height = 0 } = await sharp(source).metadata();
    if (!width || !height) continue;

    const top = Math.round(height * BAND_TOP);
    const bandHeight = Math.max(1, Math.round(height * (BAND_BOTTOM - BAND_TOP)));
    const file = path.join(outDir, `eyes_${path.parse(name).name}.png`);

    await sharp(source)
      .extract({ left: 0, top, width, height: Math.min(bandHeight, height - top) })
      // Enlarge rather than fit: the whole point is to make a four-pixel pupil
      // big enough to judge. Lanczos keeps the pupil edge honest instead of
      // smoothing a mismatch into something that reads as depth of field.
      .resize({ width: CROP_WIDTH, kernel: "lanczos3" })
      .png()
      .toFile(file);

    crops.push({ name, file });
  }
  return crops;
}

export async function contactSheet(crops: EyeCrop[], outFile: string): Promise<void> {
  const tiles = await Promise.all(
    crops.map(async (crop) => ({ crop, meta: await sharp(crop.file).metadata() })),
  );
  const cellHeight = Math.max(...tiles.map((tile) => tile.meta.height ?? 0));
  const rows = Math.ceil(tiles.length / COLUMNS);

  await sharp({
    create: {
      width: CROP_WIDTH * COLUMNS,
      height: cellHeight * rows,
      channels: 3,
      background: { r: 10, g: 10, b: 10 },
    },
  })
    .composite(
      tiles.map((tile, index) => ({
        input: tile.crop.file,
        left: (index % COLUMNS) * CROP_WIDTH,
        top: Math.floor(index / COLUMNS) * cellHeight,
      })),
    )
    .png()
    .toFile(outFile);
}

const SCREEN_PROMPT = [
  "This is a tight crop of the eye region of one portrait, enlarged.",
  "Judge only the eyes. Report, as JSON with no prose:",
  '{"pupilsMatch": boolean, "catchlightsMatch": boolean, "gazeAligned": boolean, "note": string}',
  "",
  "pupilsMatch: are both pupils the same size and shape, round, and centred in the iris?",
  "catchlightsMatch: do both eyes carry the same number of specular highlights in the same relative position?",
  "gazeAligned: do both eyes converge on the camera, with neither drifting?",
  "note: one short sentence, and only about what fails.",
  "",
  "Facial asymmetry — a higher brow, an uneven lid, a crooked nose — is normal and is NOT a failure.",
  "Judge the pupils and highlights alone. If a crop is too blurred or too dark to tell, say so in the note",
  "and answer false, because an unreadable eye is not a passing eye.",
].join("\n");

export type EyeVerdict = {
  name: string;
  pupilsMatch: boolean;
  catchlightsMatch: boolean;
  gazeAligned: boolean;
  note: string;
};

async function screenCrop(crop: EyeCrop, apiKey: string): Promise<EyeVerdict> {
  const dataUri = `data:image/png;base64,${fs.readFileSync(crop.file).toString("base64")}`;
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SCREEN_PROMPT },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`${VISION_MODEL} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as Omit<EyeVerdict, "name">;
  return { name: crop.name, ...parsed };
}

if (process.argv[1]?.endsWith("eyes.mts")) {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage: eyes.mts <dir> [--screen]");
  const outDir = path.join(dir, "eyes");

  const crops = await cropEyeBands(dir, outDir);
  const sheet = path.join(outDir, "contact.png");
  await contactSheet(crops, sheet);
  console.log(`${crops.length} eye crops → ${outDir}`);
  console.log(`contact sheet → ${sheet}`);

  if (process.argv.includes("--screen")) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for --screen");

    const verdicts = await Promise.all(crops.map((crop) => screenCrop(crop, apiKey)));
    console.log("\nimage                          pupils  lights  gaze");
    let flagged = 0;
    for (const verdict of verdicts) {
      const clean = verdict.pupilsMatch && verdict.catchlightsMatch && verdict.gazeAligned;
      if (!clean) flagged += 1;
      console.log(
        verdict.name.slice(0, 29).padEnd(30),
        (verdict.pupilsMatch ? "ok" : "FLAG").padEnd(7),
        (verdict.catchlightsMatch ? "ok" : "FLAG").padEnd(7),
        verdict.gazeAligned ? "ok" : "FLAG",
        verdict.note ? `\n    ${verdict.note}` : "",
      );
    }
    console.log(`\n${flagged} of ${verdicts.length} flagged.`);
    console.log("A flag means look at the contact sheet. A clean pass is not a verdict.");
  }
  process.exit(0);
}
