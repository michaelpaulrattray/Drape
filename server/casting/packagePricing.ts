import type { CanonicalViewAngle } from "../../shared/boardTypes";
import { CREDIT_COSTS } from "./castingCreditCosts";

/** D-15 package-slot price authority, safe for pure/read-only planners. */
export function slotCost(angle: CanonicalViewAngle): number {
  return angle === "frontFull" ? CREDIT_COSTS.fullBody : CREDIT_COSTS.multiView;
}
