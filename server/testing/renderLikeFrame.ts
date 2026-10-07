/**
 * A FRAME THAT IS ACTUALLY A PICTURE — the fixture every conformance suite
 * needed and none of them had (#1903 repair, the finding owed on PR #1915).
 *
 * ⚠ **THE REASON THIS FILE EXISTS IS ITSELF THE FINDING.** Until the `intact`
 * axis got a deterministic reader, every suite that drove the view judge handed
 * it `Buffer.from("anchor")` — thirteen bytes of ASCII that no decoder on earth
 * will open. Nothing noticed, because the only thing that ever looked at those
 * bytes was a vision model behind a stub. **So the suites that proved the
 * checker worked were, every one of them, judging a frame that was not an
 * image**, and the first reader to actually open the bytes turned 30 of them
 * red in one run. That is the gap working law 3 names: *a backstop needs a test
 * the model cannot rescue.*
 *
 * **Small by default on purpose.** 64x96 encodes in about a millisecond and
 * carries the only property the gate reads — real variance. The
 * production-geometry fixture lives in `judgeFrame.test.ts`, where the payload
 * measurements need it; a suite that only needs *this is a photograph* should
 * not pay 2 MB for the privilege.
 *
 * ⚠ **Deterministic, with no seed and no run-to-run drift** — a fixture whose
 * variance wandered could put a suite one side of the blank threshold on a
 * Tuesday. The light's periods SCALE with the frame, so the pattern is the same
 * picture at every size rather than turning into flat grey when a caller asks
 * for something small. `judgeFrame.test.ts` holds the margin as an arm:
 * measured lowest per-channel stdev ~60 against a threshold of 12 and a real
 * production floor of 24.57.
 */
import sharp from "sharp";

const cache = new Map<string, Buffer>();

/**
 * One real PNG per size, built once per process.
 *
 * Callers must not mutate the buffer; they are handed the same instance, which
 * is the point — a fixture rebuilt per test would dominate the clock of suites
 * with hundreds of cases.
 *
 * **Ask for two different sizes when order matters.** The arm that reads which
 * image the judge was posted FIRST cannot compare bytes — the frames are
 * bounded and re-encoded on the way out — so it compares dimensions, and two
 * fixtures of one size are indistinguishable at the wire.
 */
export async function renderLikeFrame(width = 64, height = 96): Promise<Buffer> {
  const key = `${width}x${height}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const channels = 3;
  const raw = Buffer.allocUnsafe(width * height * channels);
  /* Roughly nine light cycles across the frame whatever its size. */
  const periodX = Math.max(2, width / 9);
  const periodY = Math.max(2, height / 9);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      const light = 128 + 110 * Math.sin(x / periodX) * Math.cos(y / periodY);
      const grain = ((x * 7 + y * 11) % 17) - 8;
      const clamp = (value: number): number => Math.max(0, Math.min(255, value));
      raw[index] = clamp(light + grain);
      raw[index + 1] = clamp(light * 0.86 + grain);
      raw[index + 2] = clamp(light * 0.72 + grain);
    }
  }
  const png = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
  cache.set(key, png);
  return png;
}

/*
  ⚠ **THERE IS NO `renderLikeImage` CONVENIENCE WRAPPER, AND THE REASON IS
  MEASURED RATHER THAN TASTE — including the half that turned out wrong.**

  One was written, and it landed on the uncalled-export reading list the same
  minute: an export whose only callers are test files has no production importer.
  It was removed on the reasoning that this would avoid a disposition row
  entirely — **and that reasoning was wrong, which is why it is written down
  rather than quietly dropped.** The wrapper had been `renderLikeFrame`'s only
  in-module caller, so deleting it simply moved the listing one name along.

  What the removal is actually worth is the thing it did buy: ONE export needing
  ONE row, instead of two exports needing two, for a module whose whole surface
  is a fixture. Callers spell the two-field literal themselves, which is three
  words and reads plainly at the call site.
*/
