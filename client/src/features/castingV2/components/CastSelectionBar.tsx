import { X } from "lucide-react";

import { IconButton } from "@/foundation";
import { Popover } from "@/foundation/Popover";
import { selectedLabel } from "@/features/castingV2/castSelection";

/**
 * THE BAR THAT FILES A SELECTION (card #2251, rung N2c).
 *
 * It takes the place of the roster's heading while anything is ticked:
 * how many, **Add to…** and **Remove from…**, and a way to let go. Both
 * actions are the existing campaign doors (`addCastsToCampaign`,
 * `removeCastsFromCampaign`) — no new server road, no price, no credit.
 *
 * **Remove from…** takes casts OUT OF a campaign. It never deletes a cast, and
 * nothing on this bar can.
 *
 * The two choosers are the foundation's own picker (`Popover` — the brief
 * echo's word-picker), not a third menu: choosing a campaign is choosing a
 * value, and one owner of how a panel opens, lands and closes is the #304
 * ruling. So each reads as an underlined phrase, like every other choice
 * made inside a line on this surface.
 *
 * Items that cannot happen are ABSENT, never disabled (the no-dead-controls
 * law): with no campaign yet, **Remove from…** is not drawn, and **Add to…**
 * offers only a new campaign. While a filing is in flight the choosers are
 * not drawn at all, so nothing can be sent twice.
 */

export type BarCampaign = { campaignId: string; name: string; castCount: number };

export function CastSelectionBar({
  count,
  campaigns,
  busy,
  onAdd,
  onRemove,
  onNewCampaign,
  onClear,
}: {
  count: number;
  campaigns: readonly BarCampaign[];
  busy: boolean;
  onAdd: (campaign: BarCampaign) => void;
  onRemove: (campaign: BarCampaign) => void;
  onNewCampaign: () => void;
  onClear: () => void;
}) {
  const options = campaigns.map((campaign) => ({ value: campaign.campaignId, label: campaign.name }));
  const byId = (campaignId: string) => campaigns.find((campaign) => campaign.campaignId === campaignId);

  return (
    <div className="dpc-pickbar" role="toolbar" aria-label="Selected characters">
      <span className="dpc-pickbar__count" aria-live="polite">
        {selectedLabel(count)}
      </span>
      <IconButton
        label="Clear selection"
        className="dpc-pickbar__clear"
        disabled={busy}
        onClick={onClear}
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </IconButton>
      <span className="dpc-pickbar__actions">
        {busy ? (
          <span className="dp-metadata">Saving…</span>
        ) : (
          <>
            <Popover
              label="Add the selected characters to a campaign"
              heading="Add to campaign"
              options={options}
              footer={{ label: "New campaign…", onSelect: onNewCampaign }}
              onSelect={(campaignId) => {
                const campaign = byId(campaignId);
                if (campaign) onAdd(campaign);
              }}
            >
              Add to…
            </Popover>
            {campaigns.length > 0 ? (
              <Popover
                label="Take the selected characters out of a campaign"
                heading="Remove from campaign"
                options={options}
                onSelect={(campaignId) => {
                  const campaign = byId(campaignId);
                  if (campaign) onRemove(campaign);
                }}
              >
                Remove from…
              </Popover>
            ) : null}
          </>
        )}
      </span>
    </div>
  );
}
