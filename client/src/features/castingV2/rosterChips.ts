/**
 * THE LIBRARY'S CHIPS — All · <campaigns> · + (card #2250, rung N2c;
 * his Desk reply #273, verbatim and entire: *"N2c — Campaigns"*).
 *
 * The rules a chip row has to keep, in one place and free of React so they can
 * be driven directly:
 *
 *  - **There is no Unfiled chip** (card #2304, his word 2026-10-12, verbatim:
 *    *"why do we have unfiled? should it just be all + if theres any
 *    campaigns?"* … *"yes remove it"*). It superseded the 2026-09-29 design's
 *    Unfiled chip (#1469 note 1). The row is All, then the customer's
 *    campaigns, then +; with no campaigns it is All and +. The chip kind is
 *    gone from the type, so nothing can select it, and an old link naming it
 *    (`?campaign=unfiled`) is not a campaign id and lands on All.
 *  - **A chip that no longer exists is not a chip.** A deleted campaign, a link
 *    naming somebody else's campaign — the page falls back to All.
 *  - **The empty line says what is true of THIS chip**, not a generic "nothing
 *    here".
 */

/**
 * One page of the roster. The server's own most (`ROSTER_PAGE_MAX`); a full
 * page means there may be more, a short one means the list has ended.
 */
export const ROSTER_PAGE_SIZE = 60;

/* The longest campaign name is not declared here: it is
   `CAMPAIGN_NAME_MAX_LENGTH` in `shared/inputLimits.ts`, the one number the
   server's schema, the column and every client field import (card #2277). */

/** The box is read a quarter second after the last keystroke (the brief's ~250 ms). */
export const ROSTER_SEARCH_DEBOUNCE_MS = 250;

export type RosterChip =
  | { kind: "all" }
  | { kind: "campaign"; campaignId: string };

type CampaignRow = { campaignId: string; name: string };

/** A campaign's public id: 32 hex characters. Anything else in a link is ignored. */
const CAMPAIGN_ID = /^[0-9a-f]{32}$/;

/** The chip a page address names (`?campaign=<id>`), or All. */
export function chipFromLocation(search: string): RosterChip {
  const campaignId = new URLSearchParams(search).get("campaign");
  return campaignId && CAMPAIGN_ID.test(campaignId) ? { kind: "campaign", campaignId } : { kind: "all" };
}

/** Whether `chip` is one the row actually draws for these campaigns. */
export function isChip(chip: RosterChip, campaigns: readonly CampaignRow[]): boolean {
  if (chip.kind === "all") return true;
  return campaigns.some((row) => row.campaignId === chip.campaignId);
}

/** What the roster is asked for under this chip and this search. */
export function rosterFilterInput(
  chip: RosterChip,
  search: string,
): { scope: "all" | "campaign"; campaignId?: string; search?: string } {
  const trimmed = search.trim();
  return {
    scope: chip.kind,
    ...(chip.kind === "campaign" ? { campaignId: chip.campaignId } : {}),
    ...(trimmed.length > 0 ? { search: trimmed } : {}),
  };
}

/** The heading over the grid. */
export function chipHeading(chip: RosterChip, campaigns: readonly CampaignRow[]): string {
  if (chip.kind === "all") return "All characters";
  return campaigns.find((row) => row.campaignId === chip.campaignId)?.name ?? "Campaign";
}

/**
 * The sentence under an empty grid.
 * `signedCount` is every signed cast this customer has, whatever the chip.
 */
export function rosterEmptyLine(chip: RosterChip, search: string, signedCount: number): string {
  const trimmed = search.trim();
  if (trimmed.length > 0) return `No names here match “${trimmed}”.`;
  if (signedCount === 0) {
    return "No one signed yet — roll a casting, then sign the candidate you want to keep working with.";
  }
  // The rung's design of record names this empty state (the noun ruling of 2026-09-29).
  if (chip.kind === "campaign") return "No characters in this campaign yet";
  return "No one signed yet — roll a casting, then sign the candidate you want to keep working with.";
}

/*
  RENAME AND DELETE A CAMPAIGN (card #2273). The server doors
  (`castingV2.renameCampaign` / `deleteCampaign`, owner-scoped) shipped with
  #2249; nothing in the app called them, so a campaign made by mistake stayed
  a chip forever and its name stayed taken.
*/

/**
 * The chip to show once a campaign has gone, given the campaigns that remain.
 * Deleting the campaign on screen returns the library to All. Any other chip
 * stays where it is.
 */
export function chipAfterCampaignGone(chip: RosterChip, remaining: readonly CampaignRow[]): RosterChip {
  return isChip(chip, remaining) ? chip : { kind: "all" };
}

/**
 * Whether a typed campaign name can be saved: something other than spaces, and,
 * when renaming, different from the name it already has — saving a no-op is
 * the commonest accident a rename box invites.
 */
export function campaignNameReady(typed: string, currentName?: string): boolean {
  const trimmed = typed.trim();
  if (trimmed.length === 0) return false;
  return currentName === undefined || trimmed !== currentName.trim();
}

/** What the delete question says. It asks once, and it says the characters stay. */
export function campaignDeleteBody(name: string, castCount: number): string {
  if (castCount === 0) return `“${name}” is empty, so only the campaign goes.`;
  const who = castCount === 1 ? "The 1 character in it stays" : `The ${castCount} characters in it stay`;
  return `Deleting “${name}” keeps its characters. ${who} in your library, exactly as before. Only the campaign goes.`;
}
