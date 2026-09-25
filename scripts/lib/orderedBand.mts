/**
 * The ordered band's sort now lives in `shared/crewOrderedBand.ts` (#1193,
 * 2026-09-25) so the server can rank NEXT UP live by the same rule the sweep
 * and the escalation reader use. This module is a re-export kept for the
 * three script callers; import the shared file directly in new code.
 */
export {
  ORDERED_BAND_RULE,
  compareOrderedBand,
  filedKey,
  rankFromLabels,
  sortOrderedBand,
  type OrderedBandRow,
} from "../../shared/crewOrderedBand.js";
