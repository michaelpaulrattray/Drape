/**
 * WHICH PICTURE A 90-PIXEL CHIP DRAWS (fable-503).
 *
 * The rail used to draw the full frame — `thumbKey` was a column nothing wrote,
 * so eight chips meant eight ~2.6 MB PNGs, and the version switch was only
 * instant because the rail had already paid for every full picture.
 *
 * Now a delivered frame gets a small copy beside it. But **every version
 * delivered before that has none**, and a rail that assumed one would draw
 * nothing at all for every face already on the record — so the fallback is the
 * rule rather than a safety net, and it is a function so it can be driven
 * rather than read.
 */
export function chipSrc(entry: {
  /** The small copy, where the delivery made one. */
  thumbUrl?: string | null;
  /** The full frame — what every row before fable-503 has, and all it has. */
  imageUrl?: string | null;
}): string | null {
  return entry.thumbUrl ?? entry.imageUrl ?? null;
}
