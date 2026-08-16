/**
 * ONE DOWNLOAD PER PICTURE, HELD BY URL — and now shared, so a neighbour can be
 * fetched before it is clicked (fable-686 §2c).
 *
 * This was a `useRef` inside the viewer, holding exactly one in-flight decode.
 * That fixed the founder's stuck plate (fable-609/610): the effect re-ran on
 * every render, each run started a rival download, and a 2.6MB PNG on a slow
 * connection therefore never finished at all. Holding the decode BY URL means a
 * re-render joins the download already running.
 *
 * Lifting it out of the component adds the thing a ref could not do: **somebody
 * else can start one.** A version the viewer is not showing can be decoded
 * quietly while she looks at this one, and the click that follows finds it
 * already in hand. It is the same holder, so the prefetch and the click cannot
 * start two downloads of one picture — which is the defect this holder exists
 * because of, and it would come straight back if the prefetch had its own.
 *
 * # What it is not
 *
 * Not a cache of images: the browser's own HTTP cache does that, and this
 * cannot make it keep anything. What is held is the PROMISE — the answer to
 * *has this picture already been decoded, or is somebody already decoding it* —
 * and that is what turns a second click into one paint instead of a wait.
 */

/** How the bytes are actually fetched and decoded. Injected for tests. */
export type FrameDecoder = (url: string) => Promise<void>;

const browserDecode: FrameDecoder = (url) => {
  const picture = new Image();
  picture.src = url;
  return picture.decode();
};

/**
 * Held promises, oldest first.
 *
 * Capped because a long sitting walks many versions and each entry is a promise
 * that will never be collected while the map holds it. Fifty is far more than
 * a face has versions and small enough that nobody has to think about it; the
 * eviction only forgets that we ONCE decoded a picture, which costs a browser
 * cache hit and never a wrong frame.
 */
const HELD = 50;
const decodes = new Map<string, Promise<void>>();

/**
 * Decode this picture, or join the decode already running for it.
 *
 * The returned promise settles when the bytes can be painted — never rejects,
 * because a viewer stranded on a picture nobody asked for is worse than a
 * frame that arrives unverified.
 */
export function decodeFrame(url: string, decode: FrameDecoder = browserDecode): Promise<void> {
  const held = decodes.get(url);
  if (held) return held;
  /*
    THE FAILURE IS SWALLOWED HERE, not in the decoder — one place, so every
    joiner settles the same way and no caller can be stranded by a picture that
    would not decode. It was in the browser decoder, which left an INJECTED one
    free to reject: the viewer's `void decodeFrame(url).then(…)` would then never
    run its `then` and would leave an unhandled rejection behind it. Found by
    this module's own suite disagreeing with the name of its test.
  */
  const started = decode(url).catch(() => undefined);
  decodes.set(url, started);
  if (decodes.size > HELD) {
    const oldest = decodes.keys().next();
    if (!oldest.done) decodes.delete(oldest.value);
  }
  return started;
}

/**
 * Quietly fetch pictures she has not asked for yet.
 *
 * Deliberately returns nothing: a prefetch nobody waits on cannot delay the
 * frame she IS looking at, and a caller that awaited it would have invented a
 * gate out of an optimisation. Empty and duplicate URLs are dropped here rather
 * than at four call sites.
 */
export function prefetchFrames(
  urls: ReadonlyArray<string | null | undefined>,
  decode: FrameDecoder = browserDecode,
): void {
  const seen = new Set<string>();
  for (const url of urls) {
    if (typeof url !== "string" || url === "" || seen.has(url)) continue;
    seen.add(url);
    void decodeFrame(url, decode);
  }
}

/** Whether this picture is already decoded or on its way. For tests. */
export function frameIsHeld(url: string): boolean {
  return decodes.has(url);
}
