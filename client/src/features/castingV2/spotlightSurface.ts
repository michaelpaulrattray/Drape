/**
 * WHAT THE SPOTLIGHT SHOWS, DECIDED APART FROM DRAWING IT — #14 slice 3b.
 *
 * Two answers arrive from the server — an opened picture and a taken tap — and
 * each has to be turned into one of a very few things the surface can be. That
 * decision is here, with no DOM in it, so the fail-open rule is a suite rather
 * than a hope (the UI milestone contract's mechanizable half).
 *
 * ## Fail-open is the whole posture (§3 item 1, §4)
 *
 * *"A split that fails or stalls leaves the picture exactly as an attach looks
 * today — words road untouched, nothing charged, nothing said about
 * machinery."* So every way an open can go wrong — the server says it will not
 * light, the call throws, it never answers, the map will not decode, the map
 * describes a differently shaped picture — lands on ONE state, `unlit`, and
 * the surface draws nothing for it. There is no error state on purpose: the
 * customer did not ask for a spotlight, they attached a picture, and the
 * picture is still attached.
 */
import {
  bytesOfBase64,
  decodeSpotlightMap,
  mapFitsPicture,
  type SpotlightIndex,
} from "./spotlightMap";
import { SPOTLIGHT_NOT_A_FACE, SPOTLIGHT_NOTHING_THERE } from "./referenceSpotlightCopy";

/** `castingV2.reference.openSpotlight`'s answer, as this surface reads it. */
export type SpotlightOpenAnswer =
  | { lit: true; map: string; width: number; height: number; pieces: number }
  | { lit: false; why: string };

/** `castingV2.reference.tapSpotlight`'s answer, as this surface reads it. */
export type SpotlightTapAnswer =
  | {
      took: true;
      cut: string;
      width: number;
      height: number;
      bounds: { x: number; y: number; width: number; height: number };
      name: string | null;
    }
  | { took: false; why: string };

export type SpotlightView =
  | { state: "reading" }
  | { state: "lit"; map: SpotlightIndex; pieces: number }
  | { state: "unlit" };

/**
 * HOW LONG AN OPEN MAY TAKE BEFORE THE PICTURE STOPS WAITING FOR IT.
 *
 * The court measured the split at 4.3–6.6 s and once at 52.3 s on the
 * provider's bad minute; the shipped road measured 16 s end to end after its
 * download fix (#2872). Seventy-five seconds keeps the bad minute and still
 * means "stalls" in §3's sentence — past it the picture goes back to looking
 * like an attach, and a late answer is ignored rather than lighting a picture
 * the customer has stopped waiting on.
 */
export const SPOTLIGHT_STALL_MS = 75_000;

/**
 * TURN AN OPEN'S ANSWER INTO WHAT THE SURFACE SHOWS.
 *
 * `answer` is `null` when the call threw or stalled. `picture` is the attached
 * picture's own pixel size as THIS browser decoded it, or `null` if it never
 * decoded — and a picture the browser cannot draw cannot be lit either.
 */
export async function settleOpen(
  answer: SpotlightOpenAnswer | null,
  picture: { width: number; height: number } | null,
): Promise<SpotlightView> {
  if (answer === null || !answer.lit) return { state: "unlit" };
  if (!(answer.pieces > 0) || picture === null) return { state: "unlit" };
  let map: SpotlightIndex;
  try {
    map = await decodeSpotlightMap(bytesOfBase64(answer.map));
  } catch {
    return { state: "unlit" };
  }
  /* The header the server sent and the bytes it sent must agree, and both
     must describe the picture on screen. */
  if (map.width !== answer.width || map.height !== answer.height) return { state: "unlit" };
  if (!mapFitsPicture(map, picture)) return { state: "unlit" };
  return { state: "lit", map, pieces: answer.pieces };
}

/** A tap the server took — the cut as a one-piece map at the frame's size, and its own name. */
export type TakenPiece = {
  /** Stable for React and for letting go; never sent anywhere. */
  key: string;
  cut: SpotlightIndex;
  bounds: { x: number; y: number; width: number; height: number };
  /** The reader's bare noun, or `null` — the chip then shows the cut and guesses nothing. */
  name: string | null;
};

export type TapSettled =
  | { ok: true; taken: Omit<TakenPiece, "key"> }
  | { ok: false; note: string };

/**
 * TURN A TAP'S ANSWER INTO A CHIP OR A SENTENCE.
 *
 * Every refusal the road has is one of two things to the customer: a face (the
 * likeness fence — said, because silence reads as broken) or nothing takeable
 * there (the design's own sentence). The road's `why` strings are machinery and
 * never reach the screen.
 */
export async function settleTap(
  answer: SpotlightTapAnswer,
  frame: { width: number; height: number },
): Promise<TapSettled> {
  if (!answer.took) {
    return {
      ok: false,
      note: answer.why === "only-a-face-was-under-the-tap" ? SPOTLIGHT_NOT_A_FACE : SPOTLIGHT_NOTHING_THERE,
    };
  }
  let cut: SpotlightIndex;
  try {
    cut = await decodeSpotlightMap(bytesOfBase64(answer.cut));
  } catch {
    return { ok: false, note: SPOTLIGHT_NOTHING_THERE };
  }
  /* The cut must be drawn over the same frame the map was — a cut at another
     size would light the wrong place, so it is not shown at all. */
  if (cut.width !== frame.width || cut.height !== frame.height) {
    return { ok: false, note: SPOTLIGHT_NOTHING_THERE };
  }
  const name = typeof answer.name === "string" && answer.name.trim() ? answer.name.trim() : null;
  return { ok: true, taken: { cut, bounds: answer.bounds, name } };
}

/**
 * IS THIS POINT ON SOMETHING ALREADY TAKEN? — "tap again to let go" (§3 item 3).
 *
 * Read off the CUT rather than the split map, because a tap is honoured where
 * no piece is lit (an earring) and the cut is the only shape that knows where
 * that thing is.
 *
 * ⚠ **WITH A REACH, AND THE REACH WAS MEASURED.** Driven on a real hoop earring,
 * the second tap landed one pixel inside the hoop — a hoop's cut is a thin ring
 * with a hole in it — and the earring would not let go. So the question is
 * "is any of a taken cut within `reach` frame pixels of the finger", which the
 * caller sets to a few SCREEN pixels so it means the same at any picture size.
 */
export function takenAt(
  taken: readonly TakenPiece[],
  point: { x: number; y: number } | null,
  reach = 0,
): TakenPiece | null {
  if (!point) return null;
  const r = Math.max(0, Math.floor(reach));
  for (const piece of taken) {
    const { cut } = piece;
    for (let y = Math.max(0, point.y - r); y <= Math.min(cut.height - 1, point.y + r); y += 1) {
      for (let x = Math.max(0, point.x - r); x <= Math.min(cut.width - 1, point.x + r); x += 1) {
        if (cut.indices[y * cut.width + x] !== 0) return piece;
      }
    }
  }
  return null;
}

/**
 * RACE AN OPEN AGAINST THE STALL CEILING — `null` for a throw or a stall.
 *
 * The promise is not cancelled (nothing on this road stores anything, so a late
 * answer harms nothing); it is simply no longer listened to.
 */
export function withinStall<T>(work: Promise<T>, ms: number = SPOTLIGHT_STALL_MS): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
