import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type { RefineFigure } from "@shared/refineFigure";
import {
  DUST_COUNT,
  DUST_MOUSE_REACH,
  DUST_PICTURE_SCALE,
  DUST_RIPPLE_SECONDS,
  DUST_TUNED_HEIGHT,
  DUST_TUNED_WIDTH,
  dustBreath,
  dustCount,
  seedDust,
  stepDust,
  type DustParticle,
} from "./refineDust";

/**
 * HER PICTURE AS DUST — the laws of board E, mechanized (#55).
 *
 * The founder's UI contract: a design law that CAN be checked belongs in the
 * suite rather than in review memory. What is deliberately not here is whether
 * the field looks alive — he judged that on his own boards across an evening and
 * closed it with *"i just adjusted thew ripple. its perfect now file it"*, and no
 * assertion holds that.
 *
 * What these arms hold is everything a later edit could quietly undo: that the
 * dust lands on HER and not on the wall, that his own numbers are still his, that
 * the field is never a second progress indicator, and that nothing here is a
 * control the customer has to understand.
 */

const MOCKUP = new URL("../../../../docs/specs/refine-loader-mockup/Particles.dc.html", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);
const DUST = new URL("./refineDust.ts", import.meta.url);
const COMPONENT = new URL("./components/RefineDust.tsx", import.meta.url);
const VIEWER = new URL("./components/CandidateViewer.tsx", import.meta.url);

/**
 * A SEQUENCE, NOT A DIE — so the sampler's own behaviour is the subject.
 *
 * `Math.random` would make every statistic below a coin toss with a tolerance,
 * and a tolerance wide enough never to flake is a tolerance wide enough to pass
 * with the map ignored. A deterministic stream makes the acceptance rule itself
 * the thing under test.
 */
function stream(values: readonly number[]): () => number {
  let at = 0;
  return () => {
    const value = values[at % values.length];
    at += 1;
    return value;
  };
}

/** Left half of the picture is all her; right half is all wall. */
const LEFT_HALF: RefineFigure = { w: 2, h: 1, cells: "90" };
/** Nothing anywhere — the wall on both sides. */
const NO_ONE: RefineFigure = { w: 2, h: 1, cells: "00" };
/** Her, evenly, everywhere — the shape a uniform field would have. */
const EVERYWHERE: RefineFigure = { w: 2, h: 1, cells: "99" };

function homesLeftOf(figure: RefineFigure, share = 0.5): number {
  const particles = seedDust({ figure, width: 400, height: 400, count: 4000 });
  return particles.filter((p) => p.hx < 400 * share).length / particles.length;
}

describe("the dust sits on her shape", () => {
  /*
    THE POSITIVE CONTROL. Her on the left, wall on the right, 4,000 samples.

    The acceptance rule is `0.03 + weight x 1.1`, so a cell at 1 is kept ~100 %
    of the time and a cell at 0 is kept 3 % of the time — about 97 % of the dust
    on her side. Asserted well inside that, because the point is the direction
    and the magnitude, not the third decimal.
  */
  it("puts the overwhelming majority of the dust on her — the POSITIVE control", () => {
    expect(homesLeftOf(LEFT_HALF)).toBeGreaterThan(0.9);
  });

  /*
    THE NEGATIVE CONTROL, AND IT IS THE ARM THAT MATTERS MOST.

    With her weighted EVERYWHERE the dust must split evenly — because if it does
    not, the statistic above was measuring a bias in the sampler rather than her
    shape, and every reading in this file would be worthless. Same with nobody
    anywhere: a map of pure wall still scatters evenly, at the 3 % floor, which is
    what keeps a little dust in the air rather than making a stencil of her.
  */
  it("splits evenly when she is everywhere — the NEGATIVE control", () => {
    expect(homesLeftOf(EVERYWHERE)).toBeGreaterThan(0.44);
    expect(homesLeftOf(EVERYWHERE)).toBeLessThan(0.56);
  });

  it("splits evenly when she is nowhere, rather than piling up somewhere", () => {
    expect(homesLeftOf(NO_ONE)).toBeGreaterThan(0.44);
    expect(homesLeftOf(NO_ONE)).toBeLessThan(0.56);
  });

  /*
    AND IT SAMPLES WHERE THE PHOTOGRAPH IS, NOT WHERE THE CANVAS IS.

    The picture is `scale(1.04)` while it waits, so a particle at the canvas's
    own edge is looking at a point 4 % further in. Driven at the extreme: a map
    whose right-hand 10 % is the only part of her, with the sampler forced to the
    canvas's far right, must still find her — which it only does if the zoom is
    divided out.
  */
  it("samples her through the picture's own zoom", () => {
    const rightEdge: RefineFigure = { w: 10, h: 1, cells: "0000000009" };
    /* First draw = x fraction, second = y, third = the acceptance roll. A roll of
       0 is always accepted, so the sampled WEIGHT is what decides nothing here —
       instead take the first home and read where it looked. */
    const atFarRight = seedDust({
      figure: rightEdge,
      width: 1000,
      height: 1000,
      count: 1,
      random: stream([0.995, 0.5, 0.999]),
    });
    /* 0.995 of the canvas is 0.9952 of the picture once the zoom is divided out,
       which is still inside her right-hand tenth — so this particle is kept on
       its first try and its home is exactly where it looked. */
    expect(atFarRight[0].hx).toBeCloseTo(995, 0);
  });
});

describe("his numbers are his", () => {
  /*
    ⚠ READ OFF THE MOCKUP HE TUNED, NEVER RESTATED.

    He set these on the sliders himself and the file is checked in as he left it.
    A later edit that "tidied" 1,700 to 2,000 or the ripple to 7 s would be
    changing a design he judged by eye, and this is the arm that says so.
  */
  it("takes the count, the reach and the ripple from board E itself", async () => {
    const mockup = await readFile(MOCKUP, "utf8");
    const props = /data-props="([^"]*)"/.exec(mockup)?.[1] ?? "";
    const decoded = props.replace(/&quot;/g, '"');
    const slider = (name: string) =>
      Number(new RegExp(`"${name}":\\{[^}]*"default":(\\d+(?:\\.\\d+)?)`).exec(decoded)?.[1]);
    expect(slider("density"), "his particle count").toBe(DUST_COUNT);
    expect(slider("reach"), "his mouse reach").toBe(DUST_MOUSE_REACH);
    expect(slider("ripple"), "his seconds between ripples").toBe(DUST_RIPPLE_SECONDS);
  });

  it("was tuned on board E's own preview box", async () => {
    const mockup = await readFile(MOCKUP, "utf8");
    expect(mockup).toContain(`"$preview":{"width":${DUST_TUNED_WIDTH},"height":${DUST_TUNED_HEIGHT}}`
      .replace(/"/g, "&quot;"));
  });

  /*
    THE ZOOM IS ONE NUMBER IN TWO FILES, which is the shape working law 4 exists
    about: the stylesheet scales the picture and the sampler divides that out. If
    one moves and the other does not, every particle drifts off her outline at the
    edges and nothing goes red — so this pins them together.
  */
  it("divides out exactly the zoom the stylesheet applies", async () => {
    const css = await readFile(CSS, "utf8");
    const rule = css.slice(css.indexOf('.dpc-viewer__frame[data-wait="true"] img'));
    const scale = Number(/transform:\s*scale\(([\d.]+)\)/.exec(rule)?.[1]);
    expect(scale, "the stylesheet still zooms the waiting picture").toBeGreaterThan(1);
    expect(scale).toBe(DUST_PICTURE_SCALE);
  });
});

describe("the field is alive, and it is not a progress bar", () => {
  /*
    ⚠ THE SAME FIELD EVERY TIME, and this is not tidiness.

    The first draft of the ripple's repeat arm seeded twice with `Math.random`
    and compared the two — 13 lit against 17, a red on a law that holds. It was
    comparing two different fields and calling the difference drift. A seeded
    generator makes "the same ring lights the same dust" an assertion about the
    ring rather than about the weather.
  */
  const mulberry = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const seeded = (): DustParticle[] => seedDust({
    figure: EVERYWHERE, width: 400, height: 600, count: 60, random: mulberry(7),
  });

  function run(particles: DustParticle[], input: {
    t: number;
    mouse?: { x: number; y: number } | null;
  }): { lit: number[]; moved: number } {
    const before = particles.map((p) => ({ x: p.x, y: p.y }));
    const lit: number[] = [];
    stepDust({
      particles,
      width: 400,
      height: 600,
      t: input.t,
      mouse: input.mouse ?? null,
      random: () => 0.5,
      draw: (_p, amount) => lit.push(amount),
    });
    const moved = particles.filter((p, i) =>
      Math.abs(p.x - before[i].x) > 1e-9 || Math.abs(p.y - before[i].y) > 1e-9).length;
    return { lit, moved };
  }

  /*
    NEVER STILL — his own correction, late in the evening: *"they are sort of
    moving around constantly not sitting still . i think we remove the progress
    bar effect of the particles and just add movement"*.

    Driven with the pointer away and the ripple nowhere near, which is the state
    a static field would look identical in: every particle must still move.
  */
  it("moves every particle with no pointer and no ripple touching it", () => {
    const particles = seeded();
    const { moved, lit } = run(particles, { t: 5 });
    expect(moved).toBe(particles.length);
    expect(lit.every((amount) => amount === 0), "and nothing is lit").toBe(true);
  });

  /*
    THE RIPPLE, EVERY TEN SECONDS — a ring that leaves the centre, lights the
    dust it passes, and is gone.

    Three readings of the same clock: just after a ripple starts almost nothing
    is lit (the ring is still tiny), part-way through a band of dust is, and at
    9.9 s — the far end of his ten — the ring has run off the picture and the
    field is dark again waiting for the next one.
  */
  it("lights a band of dust as the ring passes, and nothing between rings", () => {
    const early = run(seeded(), { t: 0.02 }).lit.filter((x) => x > 0).length;
    const passing = run(seeded(), { t: 1.2 }).lit.filter((x) => x > 0).length;
    const between = run(seeded(), { t: 9.9 }).lit.filter((x) => x > 0).length;
    expect(passing, "the ring lights what it passes").toBeGreaterThan(0);
    expect(early).toBeLessThan(passing);
    expect(between, "and the picture is dark again before the next drop").toBe(0);
  });

  it("repeats on his ten seconds rather than drifting", () => {
    const first = run(seeded(), { t: 1.2 }).lit;
    const second = run(seeded(), { t: 1.2 + DUST_RIPPLE_SECONDS }).lit;
    expect(second.filter((x) => x > 0).length).toBe(first.filter((x) => x > 0).length);
  });

  /*
    THE MOUSE SCATTERS IT AND IT SETTLES BACK — the one thing in the loader a
    person can do, and the reason he chose this board (*"the particles which if
    you run your mouse through them they move"*).
  */
  it("pushes dust AWAY from the pointer, and only what is within reach", () => {
    const near: DustParticle[] = [{
      hx: 200, hy: 300, x: 200, y: 300, vx: 0, vy: 0, r: 1, a: 0.5, phase: 0, speed: 1,
    }];
    const far: DustParticle[] = [{
      hx: 380, hy: 580, x: 380, y: 580, vx: 0, vy: 0, r: 1, a: 0.5, phase: 0, speed: 1,
    }];
    run(near, { t: 5, mouse: { x: 190, y: 300 } });
    run(far, { t: 5, mouse: { x: 190, y: 300 } });
    expect(near[0].x, "pushed away from the pointer, not toward it").toBeGreaterThan(200);
    expect(Math.abs(far[0].x - 380), "and out of reach is untouched by it")
      .toBeLessThan(0.2);
  });

  it("brings a scattered particle home again", () => {
    const particles: DustParticle[] = [{
      hx: 200, hy: 300, x: 260, y: 300, vx: 0, vy: 0, r: 1, a: 0.5, phase: 0, speed: 1,
    }];
    for (let frame = 0; frame < 600; frame++) {
      run(particles, { t: 5 + frame * 0.016 });
    }
    expect(Math.abs(particles[0].x - 200), "the leash is loose, not broken").toBeLessThan(12);
  });

  /*
    AND THE FIELD SAYS NOTHING ABOUT PROGRESS — he removed that himself.

    Asserted at the SOURCE as well as by shape, because this is the one law here
    that a well-meaning later edit would break on purpose: `stepDust` takes no
    progress, no step and no fraction, so there is nothing for a future version
    to reach for without changing the signature in front of a reviewer.
  */
  it("takes no progress, no step and no fraction — there is nothing to reach for", async () => {
    const source = await readFile(DUST, "utf8");
    const body = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(/\bprogress\b/.test(body), "no progress reaches the physics").toBe(false);
    expect(/\bfraction\b/.test(body)).toBe(false);
    expect(/\bRefineStep\b/.test(body)).toBe(false);
  });

  it("breathes with the picture rather than on its own clock", () => {
    /* `dpc-settle` runs six seconds and the field's swell rides it. */
    expect(dustBreath(0)).toBeCloseTo(0.8, 5);
    expect(dustBreath(3)).toBeCloseTo(1.0, 5);
    expect(dustBreath(6)).toBeCloseTo(0.8, 5);
  });
});

describe("the frame budget is a device's, never a customer's", () => {
  it("carries his density onto a bigger picture rather than his count", () => {
    const tuned = dustCount({ width: DUST_TUNED_WIDTH, height: DUST_TUNED_HEIGHT });
    expect(tuned).toBe(DUST_COUNT);
    const twice = dustCount({ width: DUST_TUNED_WIDTH * 2, height: DUST_TUNED_HEIGHT });
    expect(twice, "twice the picture, twice the dust").toBe(DUST_COUNT * 2);
  });

  it("halves it on a small machine", () => {
    const many = dustCount({ width: DUST_TUNED_WIDTH, height: DUST_TUNED_HEIGHT, cores: 8 });
    const few = dustCount({ width: DUST_TUNED_WIDTH, height: DUST_TUNED_HEIGHT, cores: 4 });
    expect(few).toBe(Math.round(many / 2));
  });

  it("is bounded at both ends, so no window can starve or flood it", () => {
    expect(dustCount({ width: 40, height: 40 })).toBe(400);
    expect(dustCount({ width: 6000, height: 4000 })).toBe(3400);
  });

  /*
    ⚠ AND IT IS READ, NOT OFFERED. The disappearing-technology law's clause 6 —
    a control the customer must understand to use is the defect, and the card
    says it in his own terms: *"cap the particle count by device, never by a
    slider the customer sees"*.

    So the component may read the device and must not accept a prop, a setting or
    a query parameter for any of it. Asserted at the source, because this is a
    thing that gets added later "for testing" and then ships.
  */
  it("offers the customer no control over any of it", async () => {
    const component = await readFile(COMPONENT, "utf8");
    const body = component.replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(/\bfunction RefineDust\(\{ figure \}/.test(body), "her shape and nothing else").toBe(true);
    expect(/input|<select|range|slider|localStorage|searchParams/i.test(body)).toBe(false);
  });
});

describe("a row with no map of her gets the field that never claimed to be her", () => {
  /*
    THE HONEST DEGRADATION, PINNED AT THE VIEWER.

    A row claimed before this shipped, or a master sharp could not read, has no
    shape — and the answer is the ambient dot field that shipped before board E,
    never 1,700 particles scattered uniformly and called dust on her shape. That
    substitution is exactly the fidelity law's violation rather than its
    shortcut, and it is a two-character edit away in the JSX, so it is asserted
    rather than remembered.
  */
  it("draws the canvas only when her shape is known, and the dot field otherwise", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    const withoutComments = viewer
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
    expect(withoutComments).toContain("wait.figure ? (");
    expect(withoutComments).toContain("<RefineDust figure={wait.figure} />");
    expect(withoutComments, "and the ambient field is still the other answer")
      .toContain('<span className="dpc-viewer__dots" aria-hidden="true" />');
  });

  /*
    AND NEITHER FIELD IS DRAWN OVER A SETTLING ROW. Nobody is rendering it — the
    sweep is refunding it — so a surface claiming work is in progress is the
    *"being drawn"* lie fable-467 was written about, whichever texture draws it.
  */
  it("draws neither over a row the sweep has taken", async () => {
    const viewer = await readFile(VIEWER, "utf8");
    expect(viewer).toContain('{wait.stage === "settling" ? null : wait.figure ? (');
  });

  /*
    AND THE CANVAS TAKES NO POINTER EVENTS.

    The plate underneath owns press-and-hold to see the previous frame. A
    transparent canvas over the photograph that accepted pointer events would
    swallow that gesture — the same class the viewer's own `closest("img")` guard
    exists for — so the rule is in the stylesheet and pinned here.
  */
  it("lets the press-and-hold gesture through to the photograph", async () => {
    const css = await readFile(CSS, "utf8");
    const rule = css.slice(css.indexOf(".dpc-viewer__dust {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("pointer-events: none");
  });
});
