/**
 * THE LIBRARY'S CHIPS — All · Unfiled · <campaigns> · + (card #2250, rung N2c;
 * his Desk reply #273, verbatim and entire: *"N2c — Campaigns"*).
 *
 * The rules a chip row has to keep, in one place and free of React so they can
 * be driven directly:
 *
 *  - **Unfiled exists only while there is a campaign.** His ruling on the
 *    rung's design: with no campaigns, All and Unfiled are the same list, and
 *    two chips meaning one thing is machinery showing.
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

/*
  ⚠ **THE CAMPAIGN-NAME CAP IS NOT HERE, AND ITS ABSENCE IS THE REPAIR (#2277).**
  This file declared `CAMPAIGN_NAME_MAX_LENGTH = 64` with a docblock saying the
  server had its own copy, guarded by an arm comparing the two numbers — working
  law 4 with an alarm bolted on, which tells you WHEN two numbers disagree where
  one declaration tells you they cannot. Both fields that drew on it now import
  `shared/inputLimits.ts` directly, which `server/db/castCampaigns.ts`
  re-exports too, so the number is written down once. A re-export was tried here
  first and dropped: nothing in the product would have imported it, and an
  export kept alive by a test is the next sweep's puzzle.
*/

/** The box is read a quarter second after the last keystroke (the brief's ~250 ms). */
export const ROSTER_SEARCH_DEBOUNCE_MS = 250;

export type RosterChip =
  | { kind: "all" }
  | { kind: "unfiled" }
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
  if (chip.kind === "unfiled") return campaigns.length > 0;
  return campaigns.some((row) => row.campaignId === chip.campaignId);
}

/** What the roster is asked for under this chip and this search. */
export function rosterFilterInput(
  chip: RosterChip,
  search: string,
): { scope: "all" | "unfiled" | "campaign"; campaignId?: string; search?: string } {
  const trimmed = search.trim();
  return {
    scope: chip.kind,
    ...(chip.kind === "campaign" ? { campaignId: chip.campaignId } : {}),
    ...(trimmed.length > 0 ? { search: trimmed } : {}),
  };
}

/** The heading over the grid. */
export function chipHeading(chip: RosterChip, campaigns: readonly CampaignRow[]): string {
  if (chip.kind === "all") return "All cast";
  if (chip.kind === "unfiled") return "Unfiled";
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
  if (chip.kind === "unfiled") return "Every cast member is in a campaign.";
  // The rung's design of record names this empty state (the noun ruling of 2026-09-29).
  if (chip.kind === "campaign") return "No cast in this campaign yet";
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
 * Deleting the campaign on screen returns the library to All; so does deleting
 * the LAST campaign while Unfiled is chosen, because Unfiled is hidden with no
 * campaigns (his ruling on #1469). Any other chip stays where it is.
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

/** What the delete question says. It asks once, and it says the casts stay. */
export function campaignDeleteBody(name: string, castCount: number): string {
  if (castCount === 0) return `“${name}” is empty, so only the campaign goes.`;
  const who = castCount === 1 ? "The 1 cast member in it stays" : `The ${castCount} cast members in it stay`;
  return `Deleting “${name}” keeps its cast. ${who} in your library, exactly as before. Only the campaign goes.`;
}
