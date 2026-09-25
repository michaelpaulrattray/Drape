/**
 * WHICH TILES ARE BEING MADE — the room's one reading of busy (#1235).
 *
 * His three reports about Try again were all the same missing fact: a view being
 * asked for again is a view being MADE, and until now only the button's own
 * label knew it. That put the word *"Asking…"* where the product's casting state
 * belongs, disabled the other tiles because one string held the whole room, and
 * lost the fact entirely on a reload — where a second press charged again.
 *
 * So busy is SERVER TRUTH per slot (`slot.retrying`, from the operation rows),
 * and the press we just made is an optimistic first frame over the top of it,
 * the way the roll's dispatch latch is. These three predicates are the whole
 * derivation, in one place, because the room asks the same question four times
 * (skeleton, caption, button, poll) and four inline conditions drift.
 *
 * Kept as plain functions of plain data rather than a hook: they are decisions
 * about a projection, they have no state of their own, and it is what lets
 * `roomBusy.test.ts` drive every combination instead of a source-text guard
 * reading the page and believing it.
 */

/** Only what these predicates read, so a fixture cannot drift from the DTO. */
export type BusySlotRead = {
  angle: string;
  state: string;
  url: string | null;
  retrying?: true;
};

/**
 * Is this view being asked for again right now?
 *
 * The server's answer OR our own press. The press is what makes the tile
 * respond in the same frame the finger leaves the button; the server's answer
 * is what makes it still true in another tab, after a reload, and once this
 * page has forgotten everything.
 */
export function slotIsBeingAsked(
  slot: BusySlotRead,
  asking: ReadonlySet<string>,
): boolean {
  return slot.retrying === true || asking.has(slot.angle);
}

/**
 * Does this tile draw the working state over itself?
 *
 * ⚠ **A BUILDING SLOT THAT ALREADY HAS A PICTURE IS NOT ALWAYS BUSY-LOOKING,
 * AND THAT DISTINCTION IS OLDER THAN THIS CARD.** While her package builds, the
 * headshot slot shows the face she signed standing in — *"the customer is never
 * looking at an empty room"* — so a skeleton over it would take away the one
 * picture she has at the one moment she has nothing else. That is why this reads
 * `retrying` and not merely `building`: a stand-in keeps its picture, and a view
 * she is having re-made covers it while the new one renders.
 */
export function slotShowsWorking(
  slot: BusySlotRead,
  asking: ReadonlySet<string>,
): boolean {
  if (slotIsBeingAsked(slot, asking)) return true;
  return slot.state === "building" && !slot.url;
}

/**
 * Should the room keep polling?
 *
 * The Cast's own status covers the Sign; a slot's covers a Try again, which
 * never touches the Cast's status at all. Without the second half a retried view
 * landed only on a manual reload — his *"if i hit try again leave the page and
 * come back it looks like it stopped generating?"*.
 */
export function castRoomIsWorking(
  data: { status: string; slots: readonly { state: string }[] } | undefined,
): boolean {
  if (!data) return false;
  return data.status === "building" || data.slots.some((slot) => slot.state === "building");
}
