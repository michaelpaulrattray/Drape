import { facetOfSubject } from "../server/castingV2/refineFacets";
import { isSurfaceFacet } from "../server/castingV2/changeAmplitude";

for (const subject of ["marks", "skinTone", "skinCharacter", "cheekbones", "hairShade", "statedAccessories"] as const) {
  const facet = facetOfSubject(subject);
  console.log(`${subject.padEnd(20)} ${facet.padEnd(24)} ${isSurfaceFacet(facet) ? "SURFACE" : "-"}`);
}
