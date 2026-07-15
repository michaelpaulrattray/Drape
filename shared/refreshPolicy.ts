/**
 * refreshPolicy — the ONE refresh-refusal predicate, shared client/server.
 *
 * Audit V8: the board strip's `{N} stale` count and the bulk-refresh dialog's
 * rows once used two different read models — the strip counted a stale
 * headshot the refresh structurally refuses, leaving a permanently stuck
 * "1 stale" with no advertised exit. Both sides now derive from this file,
 * so the count and the dialog can never disagree again.
 *
 * Refusal law (F6 / D-43 / D-21):
 *  - `frontClose` is NEVER refreshable — the headshot IS the identity;
 *    regenerating it would cast a different person. Its exits are iterate
 *    in the environment (draft) / fork (minted), or restore a version.
 *  - Pinned slots are accepted-final work — unpin first.
 *  - Never-attempted slots are upgrades (mint gate), not refreshes — but a
 *    failed-marker slot IS refreshable (the retry path).
 */
import type { CanonicalViewAngle } from "./boardTypes";

export type RefreshRefusal = "identity_anchor" | "pinned" | "unfilled" | null;

/** The slot fields the refusal law reads — both the server's PackageSlot and
 *  the client's SheetSlotState satisfy this shape. */
export interface RefreshPolicySlot {
  angle: CanonicalViewAngle;
  pinned: boolean;
  filled: boolean;
  failed: unknown | null;
}

export function refreshRefusalFor(slot: RefreshPolicySlot): RefreshRefusal {
  if (slot.angle === "frontClose") return "identity_anchor";
  if (slot.pinned) return "pinned";
  if (!slot.filled && !slot.failed) return "unfilled";
  return null;
}

/** V8: a slot the refresh dialog can ACTUALLY refresh. The `{N} stale`
 *  count is `slots.filter(isActionableStale).length` — nothing else. */
export function isActionableStale(slot: RefreshPolicySlot & { stale: boolean }): boolean {
  return slot.stale && refreshRefusalFor(slot) === null;
}
