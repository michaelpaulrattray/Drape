import { useEffect, useRef } from "react";

import type { RefineFigure } from "@shared/refineFigure";
import {
  dustBreath,
  dustCount,
  seedDust,
  stepDust,
  type DustParticle,
} from "../refineDust";

/**
 * THE DUST, ON THE PICTURE SHE IS WAITING FOR (#55, board E).
 *
 * The canvas and the loop only. Every number and every force is in
 * `../refineDust`, where they can be driven without a browser; this file owns
 * the three things that genuinely need a DOM — the size of the box, the pointer,
 * and the frame clock.
 *
 * # It draws only when it knows where she is
 *
 * `figure` is her shape, cut from the master by the server (the bucket sends no
 * CORS header, so the browser cannot read her pixels — `shared/refineFigure.ts`
 * carries that whole reading). **A row without one does not mount this
 * component**: the caller draws the ambient CSS field that shipped before this,
 * because a uniform scatter presented as dust on her shape is the fidelity law's
 * violation rather than its shortcut, and the honest degradation is the field
 * that never claimed to be her in the first place.
 *
 * # Reduced motion
 *
 * His spec's clause 7: the motion goes, the bar and the word stay. So the field
 * is drawn ONCE, still, and no frame is ever requested — not a slower animation,
 * and not nothing at all. The dust is part of the picture's treatment; a person
 * who has asked for less movement should still see the same picture.
 */
export function RefineDust({ figure }: { figure: RefineFigure }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let raf = 0;
    let particles: DustParticle[] = [];
    let width = 0;
    let height = 0;
    let colour = "white";
    const mouse: { x: number; y: number } | null = { x: 0, y: 0 };
    let pointerInside = false;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    /*
      THE DUST IS THE SAME WHITE AS THE WORDS ON THE PICTURE.

      `--onScrim` is the token the bar, the stage word and her own sentence are
      all set in — what the product draws ON a darkened photograph. A canvas
      cannot use `var()`, so it is read once per measure rather than written as a
      literal: the day that token moves, the dust moves with it instead of being
      the one white on the picture that did not.

      The keyword is a last resort for a canvas with no stylesheet behind it, and
      it is a keyword rather than a hex so that nothing here reads as a second
      copy of the token's value. An invalid `fillStyle` is silently ignored by
      the canvas, which would leave the dust drawn in whatever colour came before.
    */
    const dustColour = () =>
      getComputedStyle(parent).getPropertyValue("--onScrim").trim() || "white";

    /*
      THE BOX IS THE PICTURE'S BOX, and it is measured rather than assumed.

      `.dpc-viewer__plate` is sized by the photograph inside it (its own comment
      says so: the picture and everything laid over it share one box), and the
      viewer is full-screen, so this changes with the window and with every frame
      that has a different aspect. The canvas is re-sized and RE-SEEDED when it
      does: her shape is a fraction of the box, so the homes have to move with it.
    */
    const measure = () => {
      const rect = parent.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      /*
        DRAWN AT THE DEVICE'S OWN RESOLUTION. A 0.6 px particle on a 3x phone is
        a fifth of a device pixel without this, which is a grey haze rather than
        dust. Capped at 2: past that the cost is real and the difference is not.
      */
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      colour = dustColour();
      particles = seedDust({
        figure,
        width,
        height,
        count: dustCount({
          width,
          height,
          cores: navigator.hardwareConcurrency,
        }),
      });
    };

    const paint = (t: number) => {
      const breath = dustBreath(t);
      context.clearRect(0, 0, width, height);
      context.fillStyle = colour;
      stepDust({
        particles,
        width,
        height,
        t,
        mouse: pointerInside ? mouse : null,
        draw: (p, lit) => {
          const alpha = p.a * breath + lit * 0.6;
          context.globalAlpha = alpha > 1 ? 1 : alpha;
          context.beginPath();
          context.arc(p.x, p.y, p.r + lit * 0.6, 0, Math.PI * 2);
          context.fill();
        },
      });
      context.globalAlpha = 1;
    };

    measure();

    if (reduce) {
      paint(0);
      return () => {
        /* Nothing was started; the cleanup exists so both roads out of this
           effect have the same shape and neither can grow a leak the other
           does not have. */
      };
    }

    /*
      THE CLOCK IS THE FRAME'S OWN, not a counter.

      `t` comes from `requestAnimationFrame`'s timestamp rather than `+= 0.016`
      as the mockup has it, because a mockup runs on one machine and this runs on
      a laptop that is also rendering a paid edit: a fixed increment makes the
      ripple's "every 10 seconds" mean "every 10 seconds if nothing else is
      happening", and his number is a number of seconds.
    */
    let origin = 0;
    const frame = (now: number) => {
      if (!origin) origin = now;
      paint((now - origin) / 1000);
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    /*
      AND THE BOX IS RE-MEASURED WHEN IT CHANGES, NEVER PER FRAME.

      `getBoundingClientRect` forces layout. Calling it inside the loop — which
      is what the first draft of this did — is sixty forced layouts a second on a
      page that is also waiting on a paid render, for an answer that changes when
      the window does. A `ResizeObserver` is the same fact, delivered.
    */
    const observer = new ResizeObserver(() => measure());
    observer.observe(parent);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      mouse.x = ((event.clientX - rect.left) / rect.width) * width;
      mouse.y = ((event.clientY - rect.top) / rect.height) * height;
      pointerInside = true;
    };
    const onPointerLeave = () => {
      pointerInside = false;
    };
    /*
      LISTENED FOR ON THE PLATE, NOT ON THE CANVAS — because the canvas takes no
      pointer events at all.

      It must not: the plate owns press-and-hold to see the previous frame, and a
      transparent canvas over the photograph would eat that gesture (the same
      class the viewer's own `closest("img")` guard exists for). So the dust
      reads the pointer where the pointer already goes.
    */
    parent.addEventListener("pointermove", onPointerMove);
    parent.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      parent.removeEventListener("pointermove", onPointerMove);
      parent.removeEventListener("pointerleave", onPointerLeave);
    };
    /* Re-seeded when her shape changes, which is once per render at most. */
  }, [figure]);

  return (
    <canvas
      ref={canvasRef}
      className="dpc-viewer__dust"
      /* Furniture over a photograph: there is nothing here to describe that the
         stage word below does not say in words. */
      aria-hidden="true"
      /* The one marker the drive and the suites look for — her shape is known
         and the dust is on it, as against the ambient field. */
      data-dust="true"
    />
  );
}
