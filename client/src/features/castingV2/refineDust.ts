/**
 * HER PICTURE AS DUST — the motion of board E, as numbers (#55).
 *
 * # Where every figure in this file comes from
 *
 * He drew this loader himself across an evening of boards and closed with *"i
 * just adjusted thew ripple. its perfect now file it"*. Board E is checked in at
 * `docs/specs/refine-loader-mockup/Particles.dc.html` **exactly as he left it,
 * including the values he set on its sliders** — 1,700 particles, a 40 px mouse
 * reach, a ripple every 10 s. Every constant below is read off that file. None
 * of them was chosen here, and a change to any of them is a change to a design
 * he tuned by eye, not a tuning.
 *
 * The physics is in a plain module rather than in the component for one reason
 * worth the split: **it can then be driven directly.** A canvas animation tested
 * only through a React render is tested by photograph, and the thing most worth
 * asserting — that the dust lands on HER and not on the wall — is a statistic
 * over thousands of samples that no screenshot can state (working law 3).
 *
 * # What the dust is NOT, and he removed this himself
 *
 * It does not track progress. His own words, late in the evening: *"they are
 * sort of moving around constantly not sitting still . i think we remove the
 * progress bar effect of the particles and just add movement"*. The bar and the
 * stage word carry the real progress; the field is alive regardless of it. A
 * field that sped up as the render advanced would be a second progress
 * indicator, drawn from the same four events, saying it less honestly.
 */
import { refineFigureAt, type RefineFigure } from "@shared/refineFigure";

/** His slider, as he left it. */
export const DUST_COUNT = 1700;
/** His slider, as he left it: how far the pointer reaches, in px of the picture. */
export const DUST_MOUSE_REACH = 40;
/** His slider, as he left it: seconds between ripples. */
export const DUST_RIPPLE_SECONDS = 10;

/** The ring: px per second, and how wide a band of dust it lights. */
export const DUST_RIPPLE_SPEED = 150;
export const DUST_RIPPLE_BAND = 26;
/** Where the drop falls — the centre, a little above the middle. */
export const DUST_RIPPLE_ORIGIN_Y = 0.47;

/**
 * THE BOX THE NUMBERS WERE TUNED ON — 466 x 695, board E's own preview.
 *
 * Kept because the leash, the wander and the ripple are all in PIXELS on that
 * box. The viewer is full-screen and its picture is whatever size the window
 * allows, so a field of 1,700 particles with a 40 px reach reads differently at
 * 1,400 px tall — which is what `dustCount` is for.
 */
export const DUST_TUNED_WIDTH = 466;
export const DUST_TUNED_HEIGHT = 695;

/**
 * ⚠ THE PICTURE IS ZOOMED WHILE IT WAITS AND THE DUST MUST BE TOO.
 *
 * `castingV2.css`'s `.dpc-viewer__frame[data-wait="true"] img` carries
 * `transform: scale(1.04)`, so the photograph under the canvas is 4 % larger
 * than the canvas's own box. Sampling her shape without that factor puts every
 * particle up to one grid cell off her outline at the frame's edges — invisible
 * in the middle, wrong at the shoulders.
 *
 * It is DECLARED here and PINNED by a test that reads the stylesheet
 * (`refineDust.test.ts`), because this is one number in two files and that is
 * the shape working law 4 exists about.
 */
export const DUST_PICTURE_SCALE = 1.04;

/**
 * HOW MANY PARTICLES THIS DEVICE GETS — the frame budget, and it is never a
 * control.
 *
 * The card asks for the count capped BY DEVICE and explicitly not by anything
 * the customer can see: *"cap the particle count by device, never by a slider
 * the customer sees"* — the disappearing-technology law, clause 6, which is that
 * a control somebody must understand to use is the defect.
 *
 * Two facts decide it and both are cheap to read:
 *
 *   - **The area of the picture**, against the box he tuned on. A bigger canvas
 *     gets proportionally more dust so the DENSITY he chose is what travels,
 *     rather than 1,700 particles thinning out across a 4K display.
 *   - **How many cores the browser admits to.** A four-core machine (every small
 *     laptop, every phone) takes half, which is the one honest lever there is:
 *     `hardwareConcurrency` is coarse, but a canvas loop's cost is per particle
 *     per frame and halving it is measurable.
 *
 * Bounded at both ends: never fewer than 400, or the field stops reading as dust
 * and starts reading as specks; never more than 3,400, because past that a mid
 * laptop's frame time is the thing the customer notices instead of the picture.
 */
export function dustCount(input: {
  width: number;
  height: number;
  cores?: number;
}): number {
  const area = Math.max(1, input.width * input.height);
  const tuned = DUST_TUNED_WIDTH * DUST_TUNED_HEIGHT;
  const scaled = DUST_COUNT * (area / tuned);
  const cores = input.cores ?? 8;
  const budget = cores <= 4 ? scaled * 0.5 : scaled;
  return Math.round(Math.max(400, Math.min(3400, budget)));
}

export type DustParticle = {
  /** Home: the spot it roams around, in px of the canvas. */
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  phase: number;
  speed: number;
};

/**
 * WHERE ONE PARTICLE LIVES — rejection sampling against her shape.
 *
 * His mockup's own loop: pick a point, keep it with probability `0.03 + v x
 * 1.1`, give up after 80 tries and take it anyway. The floor of 0.03 is what
 * keeps a little dust in the air around her instead of a hard cut-out of her
 * silhouette — the difference between dust and a stencil.
 *
 * With no map at all every point is accepted, which is a uniform field. **No
 * caller does that**: the component draws the ambient CSS field instead, because
 * a uniform scatter presented as "dust on her shape" is the fidelity law's
 * violation rather than its shortcut. The branch exists so this function is
 * total, and its test asserts what it means.
 */
export function dustHome(
  figure: RefineFigure | null,
  width: number,
  height: number,
  random: () => number = Math.random,
): { x: number; y: number } {
  for (let tries = 0; tries < 80; tries++) {
    const x = random() * width;
    const y = random() * height;
    if (!figure) return { x, y };
    /*
      SAMPLED WHERE THE PHOTOGRAPH ACTUALLY IS, not where the canvas is — the
      4 % zoom above. A point outside the picture's own extent answers 0 and is
      simply less likely to be kept.
    */
    const fx = 0.5 + (x / width - 0.5) / DUST_PICTURE_SCALE;
    const fy = 0.5 + (y / height - 0.5) / DUST_PICTURE_SCALE;
    const weight = refineFigureAt(figure, fx, fy);
    if (random() < 0.03 + weight * 1.1) return { x, y };
  }
  return { x: random() * width, y: random() * height };
}

/** A field of them, seeded on her shape. */
export function seedDust(input: {
  figure: RefineFigure | null;
  width: number;
  height: number;
  count: number;
  random?: () => number;
}): DustParticle[] {
  const random = input.random ?? Math.random;
  const particles: DustParticle[] = [];
  for (let i = 0; i < input.count; i++) {
    const home = dustHome(input.figure, input.width, input.height, random);
    particles.push({
      hx: home.x,
      hy: home.y,
      x: home.x,
      y: home.y,
      vx: 0,
      vy: 0,
      /* Board E: radii 0.6-1.7 px, alpha 0.35-0.9. */
      r: 0.6 + random() * 1.1,
      a: 0.35 + random() * 0.55,
      phase: random() * Math.PI * 2,
      speed: 0.6 + random() * 0.8,
    });
  }
  return particles;
}

/**
 * ONE FRAME OF THE FIELD — his four forces, in his order.
 *
 * Mutates in place and returns nothing: this runs 1,700 times per frame at
 * 60 Hz, and allocating a particle per particle per frame is the difference
 * between a decoration and a reason the page is slow.
 *
 * What it hands the drawing instead is the one thing the physics owns and the
 * canvas needs: how lit the ripple has left each particle.
 */
export function stepDust(input: {
  particles: DustParticle[];
  width: number;
  height: number;
  /** Seconds since the field started. */
  t: number;
  /** Pointer in canvas px, or null when it is not over the picture. */
  mouse: { x: number; y: number } | null;
  reach?: number;
  random?: () => number;
  /** Called per particle with its lit amount, 0..1 — the drawing's only input. */
  draw: (particle: DustParticle, lit: number) => void;
}): void {
  const random = input.random ?? Math.random;
  const reach = input.reach ?? DUST_MOUSE_REACH;
  const cx = input.width / 2;
  const cy = input.height * DUST_RIPPLE_ORIGIN_Y;
  const rippleReach = Math.sqrt(cx * cx + cy * cy) + DUST_RIPPLE_BAND;
  const since = input.t % DUST_RIPPLE_SECONDS;
  const ringR = since * DUST_RIPPLE_SPEED;
  const ringOn = ringR < rippleReach;
  const ringFade = ringOn ? 1 - ringR / rippleReach : 0;

  for (const p of input.particles) {
    /* Never still: a slow wander around its own spot, different for every one. */
    const wx = Math.sin(input.t * p.speed + p.phase) * 0.045 + (random() - 0.5) * 0.06;
    const wy = Math.cos(input.t * p.speed * 0.8 + p.phase * 1.7) * 0.045 + (random() - 0.5) * 0.06;

    if (input.mouse) {
      const dx = p.x - input.mouse.x;
      const dy = p.y - input.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < reach) {
        const f = (reach - dist) / reach;
        p.vx += (dx / (dist + 0.01)) * f * 1.6;
        p.vy += (dy / (dist + 0.01)) * f * 1.6;
      }
    }

    let lit = 0;
    if (ringOn) {
      const rx = p.x - cx;
      const ry = p.y - cy;
      const rd = Math.sqrt(rx * rx + ry * ry);
      const gap = Math.abs(rd - ringR);
      if (gap < DUST_RIPPLE_BAND) {
        lit = (1 - gap / DUST_RIPPLE_BAND) * ringFade;
        const push = lit * 0.35;
        p.vx += (rx / (rd + 0.01)) * push;
        p.vy += (ry / (rd + 0.01)) * push;
      }
    }

    /* A loose leash home, so the roaming stays on her shape. */
    p.vx += (p.hx - p.x) * 0.006 + wx;
    p.vy += (p.hy - p.y) * 0.006 + wy;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.x += p.vx;
    p.y += p.vy;

    input.draw(p, lit);
  }
}

/**
 * THE BREATH — the field's own, on the picture's clock.
 *
 * Board E gives the whole field one slow swell, `0.9 + 0.1 sin`, on the same six
 * seconds as the picture's brightness underneath it (`dpc-settle`), phase-shifted
 * a quarter turn exactly as his file has it: one breath, two layers.
 */
export function dustBreath(t: number): number {
  return 0.9 + 0.1 * Math.sin((t / 6) * Math.PI * 2 - Math.PI / 2);
}
