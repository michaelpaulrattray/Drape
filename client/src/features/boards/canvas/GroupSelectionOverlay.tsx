/**
 * GroupSelectionOverlay — D-50 group selection grammar, items 1–2.
 *
 * Selection >1 renders as a GROUP: one padded container around the set in
 * the selection language (hairline/ink — no blue), and ONE group toolbar
 * replacing the suppressed per-node toolbars. Actions, pass-1-honest:
 * Duplicate · Download all · Focus · Delete (the existing soft-delete +
 * cascade trust net; one red confirm covers the set) — plus the reserved
 * Run all slot (D-50.4: semantics ratified, execution arrives with the
 * first consumer nodes in pass 2/3).
 *
 * Rendered in flow space inside the React Flow viewport; the toolbar
 * counter-scales like all screen-legible chrome (D-37).
 */
import { useMemo } from "react";
import { useStore, ViewportPortal, type ReactFlowState } from "@xyflow/react";
import { NodeFloatingToolbar } from "./NodeFloatingToolbar";

/** True when more than one node is selected (per-node toolbars suppress). */
export function useIsMultiSelect(): boolean {
  return useStore((s: ReactFlowState) => {
    let count = 0;
    for (const node of s.nodes) {
      if (node.selected && ++count > 1) return true;
    }
    return false;
  });
}

const GROUP_PAD = 16;

export function GroupSelectionOverlay({
  onGroupAction,
}: {
  onGroupAction: (action: "duplicate" | "download" | "focus" | "delete", itemIds: number[]) => void;
}) {
  // One subscription keyed on a bounds signature — drags re-render it, but
  // the math is a handful of comparisons
  const signature = useStore((s: ReactFlowState) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const ids: number[] = [];
    for (const node of s.nodes) {
      if (!node.selected) continue;
      const itemId = parseInt(node.id.replace("item-", ""), 10);
      if (!isNaN(itemId)) ids.push(itemId);
      const w = node.measured?.width ?? 280;
      const h = node.measured?.height ?? 420;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }
    if (ids.length < 2) return null;
    return `${ids.sort((a, b) => a - b).join(",")}|${Math.round(minX)},${Math.round(minY)},${Math.round(maxX)},${Math.round(maxY)}`;
  });

  const parsed = useMemo(() => {
    if (!signature) return null;
    const [idPart, boundsPart] = signature.split("|");
    const [minX, minY, maxX, maxY] = boundsPart.split(",").map(Number);
    return { itemIds: idPart.split(",").map(Number), minX, minY, maxX, maxY };
  }, [signature]);

  if (!parsed) return null;
  const { itemIds, minX, minY, maxX, maxY } = parsed;

  return (
    <ViewportPortal>
      <div
        className="border border-canvas-ink/50 rounded-canvas-sm pointer-events-none"
        style={{
          position: "absolute",
          left: minX - GROUP_PAD,
          top: minY - GROUP_PAD,
          width: maxX - minX + GROUP_PAD * 2,
          height: maxY - minY + GROUP_PAD * 2,
        }}
      >
        <div className="pointer-events-auto">
          {/* The GROUP toolbar keeps its ABOVE placement (founder, drive 2:
              "the selection floating toolbar above is fine") */}
          <NodeFloatingToolbar
            position="top"
            actions={[
              { id: "duplicate", label: `Duplicate ${itemIds.length}`, onClick: () => onGroupAction("duplicate", itemIds) },
              { id: "download", label: "Download all", onClick: () => onGroupAction("download", itemIds) },
              { id: "focus", label: "Focus", onClick: () => onGroupAction("focus", itemIds) },
              {
                id: "runAll",
                label: "Run all — arrives with consumer nodes",
                onClick: () => {},
                disabled: true, // D-50.4: the slot is reserved; execution ships with pass 2/3's first consumers
              },
              { id: "delete", label: `Delete ${itemIds.length}`, onClick: () => onGroupAction("delete", itemIds) },
            ]}
          />
        </div>
      </div>
    </ViewportPortal>
  );
}
