/**
 * PICK SEVERAL CASTS AND FILE THEM IN ONE GO (card #2251, rung N2c — his Desk
 * reply #273, verbatim and entire: *"N2c — Campaigns"*).
 *
 * The library's multi-select, as rules free of React so they can be driven
 * directly. The page holds the ticked ids; everything it decides about them is
 * here:
 *
 *  - **A selection belongs to the view it was made in.** It is keyed on the
 *    chip and the search text, and a new key empties it — a hidden selection
 *    acting on casts the customer can no longer see is the surprise the card
 *    refuses (*"the selection clears when the chip or the search text
 *    changes"*).
 *  - **Only a cast still on screen counts.** A cast deleted or taken out of
 *    this campaign drops out of the selection by itself, so the bar never
 *    files a cast the grid no longer draws.
 *  - **A batch the server would refuse is never sent.** The campaign doors take
 *    at most `CAMPAIGN_CASTS_PER_CALL` ids, and a selection can be longer once
 *    the grid has paged, so it goes in slices.
 */

import type { RosterChip } from "./rosterChips";

/**
 * The most casts one `addCastsToCampaign` / `removeCastsFromCampaign` call
 * takes — the server's `CAMPAIGN_CASTS_PER_CALL_MAX` (`server/db/castCampaigns.ts`).
 * A copy the browser can import; `castSelection.test.ts` reddens if the two
 * ever disagree.
 */
export const CAMPAIGN_CASTS_PER_CALL = 60;

/** The view a selection was made in. A different key means a different view. */
export function selectionViewKey(chip: RosterChip, search: string): string {
  const where = chip.kind === "campaign" ? `campaign:${chip.campaignId}` : chip.kind;
  return `${where}|${search}`;
}

/** The selection with `castId` ticked if it was not, and unticked if it was. */
export function togglePick(selected: ReadonlySet<string>, castId: string): Set<string> {
  const next = new Set(selected);
  if (next.has(castId)) next.delete(castId);
  else next.add(castId);
  return next;
}

/** The ticked casts the grid still draws, in the grid's own order. */
export function pickedInView(
  selected: ReadonlySet<string>,
  shown: readonly { castId: string }[],
): string[] {
  if (selected.size === 0) return [];
  return shown.filter((cast) => selected.has(cast.castId)).map((cast) => cast.castId);
}

/** `ids` in slices the campaign doors accept. */
export function castIdBatches(ids: readonly string[], size = CAMPAIGN_CASTS_PER_CALL): string[][] {
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += size) {
    batches.push(ids.slice(start, start + size));
  }
  return batches;
}

function castMembers(count: number): string {
  return count === 1 ? "1 cast member" : `${count} cast members`;
}

/** The bar's own count. */
export function selectedLabel(count: number): string {
  return `${count} selected`;
}

/**
 * What filing said, in the customer's terms. `asked` is how many were ticked,
 * `added` how many the server newly filed — a cast already in the campaign is
 * not filed twice, and the sentence says so rather than overstating.
 */
export function filedSentence(added: number, asked: number, campaignName: string): string {
  const where = `“${campaignName}”`;
  if (added === 0) {
    return asked === 1 ? `Already in ${where}.` : `All ${asked} are already in ${where}.`;
  }
  const already = asked - added;
  return already > 0
    ? `${castMembers(added)} added to ${where}. ${already} ${already === 1 ? "was" : "were"} already in it.`
    : `${castMembers(added)} added to ${where}.`;
}

/**
 * What unfiling said. Taking a cast out of a campaign never deletes the cast,
 * and the sentence says "taken out of", never "removed" on its own.
 */
export function unfiledSentence(removed: number, asked: number, campaignName: string): string {
  const where = `“${campaignName}”`;
  if (removed === 0) {
    return asked === 1 ? `Not in ${where}.` : `None of them are in ${where}.`;
  }
  const absent = asked - removed;
  return absent > 0
    ? `${castMembers(removed)} taken out of ${where}. ${absent} ${absent === 1 ? "wasn't" : "weren't"} in it.`
    : `${castMembers(removed)} taken out of ${where}.`;
}
