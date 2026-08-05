import { useEffect, useRef } from "react";

/**
 * THE SET NEVER MOVES (founder-directed hero motion, 2026-08-05).
 *
 * One split-face composition carried as two slots; the studio background is
 * identical in every frame, so what reads as changing is only the people —
 * which is the product: same set, take after take.
 *
 * The score's laws, each earned in the demo rounds before this shipped:
 *   - HARD CUTS, softened by a 90ms fade-in ONLY. A longer fade ghosts two
 *     faces over each other; the incoming frame fades in OVER the previous
 *     one, which stays fully opaque beneath until covered, so the slot never
 *     dips toward the background mid-swap (the v2 flicker).
 *   - FORWARD-ONLY. Each side walks its deck in one direction and wraps; a
 *     cut can never return to the frame it just left (the v4 "flicks back"
 *     glitch). No riffles: with a four-frame deck a fast flick-through
 *     re-crosses faces the eye just left (v5's lesson).
 *   - The two sides NEVER cut together after the arrival — out-of-sync
 *     clocks are what make it a working set rather than a looping GIF.
 *   - Mostly stillness. Motion is the accent, not the state (D-169's family).
 *
 * Honest-motion notes: pointer over the pair pauses it (an invitation to
 * look, not a billboard); `prefers-reduced-motion` gets a static resting
 * frame and no timers at all; a hidden tab stops the clock.
 */

/** frame-{side}-0 is the empty set; 1..4 are the looks, in flick order. */
const FRAME_SRC = (side: "l" | "r", index: number) => `/casting-hero/frame-${side}-${index}.webp`;
const LOOK_COUNT = 4;

const INTRO_PLATE_MS = 900;
const ARRIVE_HOLD_MS = 2100;
/** Single forward cuts, alternating sides, varied holds — demo v5's score. */
const LOOP: ReadonlyArray<{ side: "l" | "r"; hold: number }> = [
  { side: "r", hold: 1600 },
  { side: "l", hold: 1300 },
  { side: "r", hold: 2000 },
  { side: "l", hold: 1500 },
  { side: "r", hold: 1200 },
  { side: "l", hold: 2300 },
];
/** How long the 90ms fade needs before the covered frame can drop silently. */
const DROP_AFTER_MS = 140;

export function HeroMotion() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slots = { l: leftRef.current, r: rightRef.current };
    if (!slots.l || !slots.r) return;
    const frames = {
      l: Array.from(slots.l.querySelectorAll("img")),
      r: Array.from(slots.r.querySelectorAll("img")),
    };

    let z = 1;
    const dropTimers: Partial<Record<"l" | "r", ReturnType<typeof setTimeout>>> = {};
    const show = (side: "l" | "r", index: number) => {
      const imgs = frames[side];
      const target = imgs[index];
      if (!target) return;
      target.style.zIndex = String(++z);
      target.classList.add("dpc-hero__frame--on");
      clearTimeout(dropTimers[side]);
      dropTimers[side] = setTimeout(() => {
        imgs.forEach((img, i) => {
          if (i === index) return;
          /* Suppress the transition while dropping — nothing on screen may
             ever animate toward transparent (that was the v2 flicker). */
          img.style.transition = "none";
          img.classList.remove("dpc-hero__frame--on");
          requestAnimationFrame(() => {
            img.style.transition = "";
          });
        });
      }, DROP_AFTER_MS);
    };

    /* Reduced motion: the resting pair, no clock. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show("l", 1);
      show("r", 1);
      return () => {
        clearTimeout(dropTimers.l);
        clearTimeout(dropTimers.r);
      };
    }

    const pos = { l: 1, r: 1 };
    let paused = false;
    let step = -2; // -2 = plate, -1 = arrival, then LOOP
    let timer: ReturnType<typeof setTimeout>;

    const pair = slots.l.parentElement;
    const onEnter = () => {
      paused = true;
    };
    const onLeave = () => {
      paused = false;
    };
    pair?.addEventListener("pointerenter", onEnter);
    pair?.addEventListener("pointerleave", onLeave);
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(next, 200);
    };
    document.addEventListener("visibilitychange", onVisibility);

    function next() {
      if (paused) {
        timer = setTimeout(next, 300);
        return;
      }
      if (step === -2) {
        show("l", 0);
        show("r", 0);
        timer = setTimeout(next, INTRO_PLATE_MS);
      } else if (step === -1) {
        show("l", 1);
        show("r", 1);
        timer = setTimeout(next, ARRIVE_HOLD_MS);
      } else {
        const cut = LOOP[step % LOOP.length];
        pos[cut.side] = (pos[cut.side] % LOOK_COUNT) + 1;
        show(cut.side, pos[cut.side]);
        timer = setTimeout(next, cut.hold);
      }
      step += 1;
    }

    /* Start only once every frame is decoded — a cut to a half-loaded image
       is a worse glitch than a late start. */
    let cancelled = false;
    Promise.all(
      [...frames.l, ...frames.r].map((img) => img.decode().catch(() => undefined)),
    ).then(() => {
      if (!cancelled) next();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(dropTimers.l);
      clearTimeout(dropTimers.r);
      pair?.removeEventListener("pointerenter", onEnter);
      pair?.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const indices = [0, 1, 2, 3, 4];
  return (
    <>
      <div className="dpc-hero__slot" ref={leftRef}>
        {indices.map((i) => (
          /* Brand art, not a cast — decorative, so no alt text and no pill. */
          <img key={i} src={FRAME_SRC("l", i)} alt="" />
        ))}
      </div>
      <div className="dpc-hero__slot" ref={rightRef}>
        {indices.map((i) => (
          <img key={i} src={FRAME_SRC("r", i)} alt="" />
        ))}
      </div>
    </>
  );
}
