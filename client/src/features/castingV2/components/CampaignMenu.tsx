import { useState } from "react";

import { CardMenu, type CardMenuItem } from "@/foundation";

/**
 * THE CAMPAIGN'S OWN ⋯ — rename it, delete it (card #2273, rung N2c).
 *
 * It sits beside the campaign's name over the grid, and only while that
 * campaign is the chip on screen — so the chip row gains no new buttons, and
 * the act is next to the name it changes. It is the one `CardMenu` every other
 * menu in casting uses, in its `row` placement (always visible: a heading has
 * no card to hover), the cast room's name line being the precedent.
 */
export function campaignMenuItems(onRename: () => void, onDelete: () => void): CardMenuItem[] {
  return [
    { label: "Rename campaign", onSelect: onRename },
    { label: "Delete campaign", danger: true, onSelect: onDelete },
  ];
}

export function CampaignMenu({
  name,
  onRename,
  onDelete,
}: {
  name: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <CardMenu
      placement="row"
      align="fromTheLeft"
      label={`the campaign “${name}”`}
      open={open}
      onToggle={() => setOpen(!open)}
      onCancel={close}
      items={campaignMenuItems(
        () => { close(); onRename(); },
        () => { close(); onDelete(); },
      )}
    />
  );
}
