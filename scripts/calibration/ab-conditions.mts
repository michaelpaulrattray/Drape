/**
 * The A/B's remaining pre-registered conditions (Fable condition 1).
 *
 * §E.1's decision rule has four parts. The first — diversity — was reported in
 * the M3 calibration. This closes the other three from the artifacts already on
 * disk, so Path B can become M5's default on evidence rather than on the one
 * measure that happened to be easy:
 *
 *   lock fidelity   do path B's treatments violate the brief's stated facts?
 *   quality parity  does B lose visual quality relative to A?
 *   latency delta   what does the treatment stage actually add?
 *
 * Lock fidelity is the one that could sink Path B. §E.1 requires every
 * treatment to be validated against the CastingIntent's locked facts, with
 * violating treatments dropped and a fall back to Path A if fewer than eight
 * survive. That validator does not exist yet — it is M5 work — so this checks
 * the same property directly against the treatment text.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = ".calibration";

/**
 * Facts a brief states explicitly. If the brief says "50s", a treatment that
 * says "twenties" has broken a lock. Deliberately narrow and literal: only
 * checks what the brief actually pinned, because inventing locks would
 * manufacture violations.
 */
const BRIEF_LOCKS: Record<string, Array<{ label: string; forbidden: RegExp }>> = {
  "tight-1": [
    { label: "age 30s", forbidden: /\b(teen|twenties|20s|forties|40s|fifties|50s|sixties|60s|elderly|young boy)\b/i },
    { label: "male", forbidden: /\b(she|her|woman|girl|female)\b/i },
  ],
  "tight-2": [
    { label: "age 50s", forbidden: /\b(teen|twenties|20s|thirties|30s|seventies|70s|child)\b/i },
  ],
  "tight-3": [
    { label: "age 20s", forbidden: /\b(teen|forties|40s|fifties|50s|sixties|60s|elderly)\b/i },
    { label: "female", forbidden: /\b(\bhe\b|his|man\b|male\b|boy)\b/i },
  ],
  "tight-4": [
    { label: "bald", forbidden: /\b(long hair|flowing hair|ponytail|curly hair|thick hair|braids)\b/i },
    { label: "age 40s", forbidden: /\b(teen|twenties|20s|seventies|70s|child)\b/i },
  ],
  "nonhuman-1": [{ label: "orc", forbidden: /\b(human|elf|dwarf|android|robot)\b/i }],
  "nonhuman-2": [{ label: "cel-shaded", forbidden: /\b(photoreal|photorealistic|live action)\b/i }],
  "nonhuman-3": [{ label: "android", forbidden: /\b(orc|elf|purely human|flesh and blood)\b/i }],
  "nonhuman-4": [{ label: "elf", forbidden: /\b(orc|android|robot|dwarf)\b/i }],
};

/** Sharpness proxy: variance of a Laplacian-ish high-pass, via stdev of edges. */
async function qualityScore(file: string): Promise<{ sharpness: number; contrast: number }> {
  /*
    `sharp.stats()` computes on the INPUT image, not the result of the pipeline
    it is chained onto — so calling it after `.convolve()` silently returns the
    unconvolved statistics. My first version did exactly that and reported the
    same contrast figure twice under two names. The convolution has to be
    materialised to a buffer before it can be measured.
  */
  const base = sharp(file).greyscale().resize(512, 512, { fit: "cover" });
  const contrast = (await base.clone().stats()).channels[0].stdev;

  const edges = await base
    .clone()
    .convolve({ width: 3, height: 3, kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] })
    .raw()
    .toBuffer();
  let sum = 0;
  for (const value of edges) sum += value;
  const mean = sum / edges.length;
  let variance = 0;
  for (const value of edges) variance += (value - mean) ** 2;
  const sharpness = Math.sqrt(variance / edges.length);

  return { sharpness, contrast };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8")) as {
    calls: Record<string, { id: string; phase: string; status: string; latencyMs?: number; dispatchedAt: number }>;
  };
  const calls = Object.values(manifest.calls);

  /* ---------------------------------------------------------- lock fidelity */

  console.log("LOCK FIDELITY — do Kimi's treatments violate facts the brief stated?\n");
  let totalTreatments = 0;
  let violations = 0;
  for (const [brief, locks] of Object.entries(BRIEF_LOCKS)) {
    const file = path.join(DIR, `treatments-${brief}.txt`);
    if (!fs.existsSync(file)) continue;
    const treatments = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    const hits: string[] = [];
    treatments.forEach((treatment, index) => {
      totalTreatments += 1;
      for (const lock of locks) {
        if (lock.forbidden.test(treatment)) {
          violations += 1;
          hits.push(`      #${index + 1} broke "${lock.label}": ${treatment.slice(0, 90)}`);
        }
      }
    });
    console.log(`  ${brief.padEnd(12)} ${treatments.length} treatments, ${hits.length} violation(s)`);
    hits.forEach((hit) => console.log(hit));
  }
  console.log(
    `\n  TOTAL: ${violations} violation(s) across ${totalTreatments} treatments ` +
      `(${((violations / Math.max(totalTreatments, 1)) * 100).toFixed(1)}%)\n`,
  );

  /* --------------------------------------------------------- quality parity */

  console.log("QUALITY PARITY — does path B lose visual quality?\n");
  const briefs = [...new Set(Object.keys(BRIEF_LOCKS))];
  const scores: Record<string, { sharpness: number[]; contrast: number[] }> = {
    A: { sharpness: [], contrast: [] },
    B: { sharpness: [], contrast: [] },
  };
  for (const brief of briefs) {
    for (const pathName of ["A", "B"]) {
      for (let i = 1; i <= 8; i += 1) {
        const file = path.join(DIR, "images", `ab_${brief}_${pathName}_${i}.png`);
        if (!fs.existsSync(file)) continue;
        const score = await qualityScore(file);
        scores[pathName].sharpness.push(score.sharpness);
        scores[pathName].contrast.push(score.contrast);
      }
    }
  }
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  for (const pathName of ["A", "B"]) {
    console.log(
      `  path ${pathName}: n=${scores[pathName].sharpness.length}  ` +
        `sharpness ${mean(scores[pathName].sharpness).toFixed(2)}  ` +
        `contrast ${mean(scores[pathName].contrast).toFixed(2)}`,
    );
  }
  const sharpnessDelta =
    ((mean(scores.B.sharpness) - mean(scores.A.sharpness)) / mean(scores.A.sharpness)) * 100;
  console.log(`  sharpness change B vs A: ${sharpnessDelta.toFixed(1)}%\n`);

  /* ----------------------------------------------------------- latency cost */

  console.log("LATENCY — what does the treatment stage add?\n");
  const treatmentCalls = calls.filter((call) => call.id.startsWith("treatments:") && call.status === "ok");
  const intentCalls = calls.filter((call) => call.id.startsWith("intent:") && call.status === "ok");
  console.log(`  interpreter calls: ${intentCalls.length}, treatment calls: ${treatmentCalls.length}`);
  console.log(
    "  Text-stage latency was not recorded per call in this run — the manifest stores\n" +
      "  latency only for image calls. What IS known: both stages are single text\n" +
      "  completions issued once per roll, before any image dispatch, and the whole\n" +
      "  A/B (24 text calls + 187 images) fits the observed wall clock. §E.1's +5s\n" +
      "  median budget therefore cannot be confirmed or refuted from these artifacts.\n" +
      "  Recording per-call text latency is a one-line harness change for the next run.",
  );
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
