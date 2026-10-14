/**
 * THE SHAPE OF A VOICE — N4b-2 (#2470), design
 * `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md` §1 (*"each with play and a
 * waveform"*).
 *
 * # ⚠ WHY THIS IS DECODED RATHER THAN DRAWN
 *
 * The voice card already draws a bar strip at rest — a fixed 30-value ornament
 * in `CastingRoom.tsx` — and the nearest-to-hand way to meet the design's word
 * would have been to draw that same ornament three times and call it a
 * waveform. **That is the fidelity law's violation exactly**: *"a matting model
 * instead of a binary outline, a real library instead of an approximation"*.
 * Three identical strips beside three genuinely different voices tell a
 * customer nothing, and the thing the design asks them to do is COMPARE.
 *
 * The browser ships the dedicated tool: `AudioContext.decodeAudioData` gives
 * real samples, so the bars are measured from the audio they sit under. This
 * module is the measurement, kept pure so it can be driven without a DOM, an
 * `AudioContext` or an MP3 — `waveform.test.ts` drives it on arrays whose
 * answer is known by hand.
 *
 * The resting ornament is still correct for a clip nobody has pressed yet: it
 * is a strip at rest, not a claim about a recording, and the component says so.
 */

/** How many bars a strip draws. The resting ornament's own count, so the two states are the same width. */
export const VOICE_WAVE_BARS = 30;

/** The shortest bar drawn, as a percentage — a silent passage is still a strip. */
export const VOICE_WAVE_FLOOR_PCT = 12;

/**
 * Reduce samples to one peak per bar, as percentages of the loudest bar.
 *
 * **Peak rather than mean**, and that is the one real choice here: a mean over
 * tens of thousands of samples flattens speech into a nearly straight line
 * (consonants are brief and loud), which is how an honest measurement can still
 * produce a useless picture. The peak per window is what makes two voices look
 * different from each other.
 *
 * Normalised to the loudest bar so a quiet recording and a loud one both fill
 * the strip: the strip is about the SHAPE of a reading, never its volume, and
 * nothing in the product invites a customer to compare two clips' loudness.
 *
 * Returns an empty array for an empty input rather than a strip of zeros, so a
 * caller can tell "no audio" from "silent audio" and fall back to the resting
 * ornament.
 */
export function peaksFromSamples(
  samples: ArrayLike<number>,
  bars: number = VOICE_WAVE_BARS,
): number[] {
  if (!Number.isInteger(bars) || bars <= 0) return [];
  const length = samples.length;
  if (length === 0) return [];

  const peaks: number[] = [];
  let loudest = 0;
  for (let bar = 0; bar < bars; bar += 1) {
    /*
      Window boundaries from the bar index rather than a running cursor: with a
      cursor, `length / bars` rounding drops or doubles the last window, and a
      strip whose final bar is computed from three samples is the kind of error
      that looks like a quiet ending.
    */
    const start = Math.floor((bar * length) / bars);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * length) / bars));
    let peak = 0;
    for (let index = start; index < end && index < length; index += 1) {
      const magnitude = Math.abs(samples[index]);
      if (magnitude > peak) peak = magnitude;
    }
    peaks.push(peak);
    if (peak > loudest) loudest = peak;
  }

  if (loudest === 0) {
    /* Genuinely silent audio: a flat strip at the floor, which is true, rather
       than a division by zero or an invented shape. */
    return peaks.map(() => VOICE_WAVE_FLOOR_PCT);
  }

  return peaks.map((peak) => {
    const pct = (peak / loudest) * 100;
    return Math.round(Math.max(VOICE_WAVE_FLOOR_PCT, Math.min(100, pct)));
  });
}

/**
 * How far through a clip a strip has played, as a bar count.
 *
 * Kept here rather than in the component because it is the one place an
 * off-by-one would misreport: at `position === duration` every bar is played,
 * and at `position === 0` none is — a naive `round` gives the first bar a
 * played look before anything has been heard.
 */
export function barsPlayed(input: {
  positionSeconds: number;
  durationSeconds: number;
  bars?: number;
}): number {
  const bars = input.bars ?? VOICE_WAVE_BARS;
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) return 0;
  if (!Number.isFinite(input.positionSeconds) || input.positionSeconds <= 0) return 0;
  const fraction = Math.min(1, input.positionSeconds / input.durationSeconds);
  return Math.floor(fraction * bars);
}

/** `2:18` — how long a clip is, for a customer rather than for a receipt. */
export function spokenDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
