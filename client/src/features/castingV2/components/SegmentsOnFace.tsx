/**
 * ON HER FACE — what this version is keeping (fable-113, founder-cleared).
 *
 * # Read and prefill, and deliberately nothing else
 *
 * Tapping a row writes the opening of a sentence into the ask box below it.
 * Nothing changes until she finishes it and asks — so there is no delete here,
 * no restyle, no reorder, and no menu. The panel's whole job is to answer
 * "what is this face still holding" and to make talking about one of those
 * things one tap shorter.
 *
 * # What the founder cleared, and what had to be adapted
 *
 * PROTOTYPE-VERIFIED (his ruling, 2026-08-09 — "KEEP as mocked"): the heading
 * "On her face", the sub "Things this version is keeping. Tap one to talk about
 * it.", the row shape (thumbnail · name · provenance), and the row names
 * themselves, which come from the server projection.
 *
 * DROPPED on his ruling: the `v1` tags — "ugly and not required".
 *
 * ADAPTED, and stated because the UI contract says quotation is not
 * requirement: **the mock is a card on `--surface`; this panel lives on the
 * SCRIM** under the expanded picture, beside a field already written in
 * `--onScrim`. Rendering the mock's card treatment here would put a white panel
 * on a dark viewer. The structure and the copy are his; the surface language is
 * the one its actual neighbours speak.
 *
 * # The thumbnail is the crop CUT BY ITS OWN MASK
 *
 * The mock's own finding, and it is the reason the list is legible: a `marks`
 * segment's stored crop IS her whole face and a `hairWorn` crop is her head, so
 * three raw crops read as the same photograph three times. Masked, a row shows
 * only the pixels it owns — freckles read as a face-skin shape, gloss as lips,
 * hair as a silhouette.
 *
 * Honest limit, kept from the mock: the cut shows WHERE a facet lives, not WHAT
 * it is. Freckles are not visible at 44px; the row is legible because its shape
 * differs from its neighbours.
 */

export type FaceRow = {
  facet: string;
  publicId: string;
  name: string;
  from: string;
  prefill: string;
  maskUrl: string;
  contentUrl: string;
};

export function SegmentsOnFace({
  rows,
  onPrefill,
}: {
  rows: readonly FaceRow[];
  /** Writes the opening of her sentence into the ask box. Never submits it. */
  onPrefill: (prefill: string) => void;
}) {
  /*
    A face keeping nothing renders NOTHING — not an empty panel with a heading
    over a blank list. The first edit of a face carries nothing by definition,
    so an empty state here would be the most common state, and a permanent
    "nothing yet" box is a heading competing for the eye with the picture.
  */
  if (rows.length === 0) return null;

  return (
    <div className="dpc-kept" aria-labelledby="dpc-kept-title">
      <div className="dpc-kept__head">
        <p className="dpc-kept__title" id="dpc-kept-title">On her face</p>
        <p className="dpc-kept__sub">Things this version is keeping. Tap one to talk about it.</p>
      </div>
      <ul className="dpc-kept__rows">
        {rows.map((row) => (
          <li key={row.publicId}>
            <button
              type="button"
              className="dpc-kept__row"
              /* Her own words for the thing, and where it came from — the whole
                 label, because the thumbnail is a shape rather than a legend. */
              aria-label={`${row.name}, ${row.from}. Talk about it.`}
              onClick={() => onPrefill(row.prefill)}
            >
              <span
                className="dpc-kept__thumb"
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${JSON.stringify(row.contentUrl)})`,
                  /* Both spellings: the unprefixed property is the standard and
                     the prefixed one is what older WebKit still reads. */
                  WebkitMaskImage: `url(${JSON.stringify(row.maskUrl)})`,
                  maskImage: `url(${JSON.stringify(row.maskUrl)})`,
                }}
              />
              <span className="dpc-kept__body">
                <span className="dpc-kept__name">{row.name}</span>
                <span className="dpc-kept__from">{row.from}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
