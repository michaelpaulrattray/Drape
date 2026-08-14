import { describe, expect, it } from "vitest";

import { chipSrc } from "./railThumb";

/**
 * The legacy fallback as an ARM rather than an assumption (fable-503's own
 * condition). Every version delivered before thumbnails existed has none, and
 * a rail that required one would draw nothing for every face on the record.
 */
describe("what a version chip draws", () => {
  const full = "https://pub.example/casting-v2/variants/frame.png";
  const small = "https://pub.example/casting-v2/variants/frame.webp";

  it("prefers the small copy when the delivery made one", () => {
    expect(chipSrc({ thumbUrl: small, imageUrl: full })).toBe(small);
  });

  it("FALLS BACK to the full frame on a version delivered before thumbnails", () => {
    expect(chipSrc({ thumbUrl: null, imageUrl: full })).toBe(full);
    expect(chipSrc({ imageUrl: full })).toBe(full);
  });

  it("draws nothing when there is nothing — never an empty src", () => {
    /* `<img src="">` re-requests the page itself in some browsers, which is a
       real request for a picture that does not exist. */
    expect(chipSrc({ thumbUrl: null, imageUrl: null })).toBeNull();
    expect(chipSrc({})).toBeNull();
  });
});
