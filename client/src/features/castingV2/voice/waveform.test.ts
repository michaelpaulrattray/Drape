import { describe, expect, it } from "vitest";

import {
  VOICE_WAVE_BARS,
  VOICE_WAVE_FLOOR_PCT,
  barsPlayed,
  peaksFromSamples,
  spokenDuration,
} from "./waveform";

/**
 * THE WAVEFORM REDUCTION, DRIVEN ON ARRAYS WHOSE ANSWER IS KNOWN BY HAND —
 * N4b-2 (#2470).
 *
 * The component does the part only a browser can do (`decodeAudioData`); this
 * module does the part a mistake would hide in, so it is pure and driven
 * directly. Working law 3's shape: *if the only test of a thing runs through
 * something that usually behaves, the thing is untested.*
 */

describe("peaksFromSamples", () => {
  it("returns one bar per requested bar", () => {
    const samples = new Float32Array(1000).fill(0.5);
    expect(peaksFromSamples(samples, 30)).toHaveLength(30);
    expect(peaksFromSamples(samples)).toHaveLength(VOICE_WAVE_BARS);
  });

  it("takes the PEAK of each window, not its mean", () => {
    /*
      The whole reason the reduction is a peak: one loud sample in a quiet
      window is a consonant, and a mean erases it. Window 0 here is
      [0, 0, 0, 1] — a mean would read 0.25 and the bar would be near the
      floor; the peak reads 1 and the bar is full.
    */
    const samples = [0, 0, 0, 1, 0, 0, 0, 0];
    const bars = peaksFromSamples(samples, 2);
    expect(bars[0]).toBe(100);
    expect(bars[1]).toBe(VOICE_WAVE_FLOOR_PCT);
  });

  it("reads magnitude, so a negative trough is as loud as a positive crest", () => {
    /* Audio samples are signed; a reader that forgot `Math.abs` would draw
       half of every voice as silence. */
    expect(peaksFromSamples([-1, 0, 0, 0], 1)).toEqual([100]);
  });

  it("normalises to the loudest bar, so a quiet recording still fills the strip", () => {
    const loud = peaksFromSamples([1, 0.5], 2);
    const quiet = peaksFromSamples([0.02, 0.01], 2);
    expect(quiet).toEqual(loud);
  });

  it("never draws a bar below the floor", () => {
    const bars = peaksFromSamples([1, 0, 0, 0, 0, 0, 0, 0], 4);
    for (const bar of bars) expect(bar).toBeGreaterThanOrEqual(VOICE_WAVE_FLOOR_PCT);
  });

  it("draws a flat floor for genuinely silent audio rather than dividing by zero", () => {
    const bars = peaksFromSamples(new Float32Array(100), 5);
    expect(bars).toEqual([
      VOICE_WAVE_FLOOR_PCT, VOICE_WAVE_FLOOR_PCT, VOICE_WAVE_FLOOR_PCT,
      VOICE_WAVE_FLOOR_PCT, VOICE_WAVE_FLOOR_PCT,
    ]);
  });

  it("answers empty for no audio, so a caller can fall back to the resting strip", () => {
    /* Empty is NOT a strip of zeros: the component must be able to tell "no
       audio" from "silent audio", because only one of them is at rest. */
    expect(peaksFromSamples([], 30)).toEqual([]);
    expect(peaksFromSamples(new Float32Array(0))).toEqual([]);
  });

  it("refuses a nonsense bar count rather than looping", () => {
    expect(peaksFromSamples([1, 2, 3], 0)).toEqual([]);
    expect(peaksFromSamples([1, 2, 3], -4)).toEqual([]);
    expect(peaksFromSamples([1, 2, 3], 1.5)).toEqual([]);
  });

  it("covers every sample when the count does not divide evenly", () => {
    /*
      THE OFF-BY-ONE THIS EXISTS FOR. Seven samples into three bars: a running
      cursor of `floor(7/3) = 2` reads six and drops the last — so the loudest
      sample in the clip, which is the final one here, would never be seen and
      the strip would normalise to the wrong maximum.
    */
    const bars = peaksFromSamples([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 1], 3);
    expect(bars[2]).toBe(100);
  });

  it("gives every bar at least one sample when there are fewer samples than bars", () => {
    const bars = peaksFromSamples([1, 0], 6);
    expect(bars).toHaveLength(6);
    for (const bar of bars) expect(Number.isFinite(bar)).toBe(true);
  });
});

describe("barsPlayed", () => {
  it("lights nothing before anything has been heard", () => {
    /* A naive `round` lights the first bar at position 0, which reads as
       "already playing" on a strip nobody has pressed. */
    expect(barsPlayed({ positionSeconds: 0, durationSeconds: 10, bars: 10 })).toBe(0);
  });

  it("lights every bar at the end", () => {
    expect(barsPlayed({ positionSeconds: 10, durationSeconds: 10, bars: 10 })).toBe(10);
  });

  it("lights proportionally in between", () => {
    expect(barsPlayed({ positionSeconds: 5, durationSeconds: 10, bars: 10 })).toBe(5);
    expect(barsPlayed({ positionSeconds: 2.9, durationSeconds: 10, bars: 10 })).toBe(2);
  });

  it("never lights more than the strip has, whatever the element reports", () => {
    expect(barsPlayed({ positionSeconds: 99, durationSeconds: 10, bars: 10 })).toBe(10);
  });

  it("lights nothing on a duration the element has not worked out yet", () => {
    /* `HTMLMediaElement.duration` is NaN until metadata loads, and Infinity on
       a stream — both would otherwise produce a NaN bar count. */
    expect(barsPlayed({ positionSeconds: 3, durationSeconds: Number.NaN, bars: 10 })).toBe(0);
    expect(barsPlayed({ positionSeconds: 3, durationSeconds: Number.POSITIVE_INFINITY, bars: 10 })).toBe(0);
    expect(barsPlayed({ positionSeconds: 3, durationSeconds: 0, bars: 10 })).toBe(0);
  });
});

describe("spokenDuration", () => {
  it("says a clip's length the way a person reads a player", () => {
    expect(spokenDuration(137.7)).toBe("2:18");
    expect(spokenDuration(16.9)).toBe("0:17");
    expect(spokenDuration(60)).toBe("1:00");
    expect(spokenDuration(61)).toBe("1:01");
  });

  it("says nothing when there is nothing to say", () => {
    expect(spokenDuration(null)).toBeNull();
    expect(spokenDuration(undefined)).toBeNull();
    expect(spokenDuration(0)).toBeNull();
    expect(spokenDuration(Number.NaN)).toBeNull();
  });
});
