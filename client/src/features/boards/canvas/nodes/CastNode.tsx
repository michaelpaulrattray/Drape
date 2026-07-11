/**
 * CastNode — the single React Flow node type for casts (DESIGN_SYSTEM.md
 * §5.11). One component for cast_root, cast_view, and library_cast
 * provenance; branch on provenance.type, never split into separate files.
 *
 * Node face = label row, image, control strip — nothing else (D-34). The
 * empty node's front door is the CastPickerModal (D-33): choose existing or
 * cast new. No inline prompt, no attribute chrome; configuration and
 * post-cast editing consolidate in the casting environment (D-35, gated).
 */
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { CanvasNodeShell } from "../CanvasNodeShell";
import { NodeLabelRow } from "../NodeLabelRow";
import { ConnectionDot } from "../ConnectionDot";
import { CastImageArea } from "../CastImageArea";
import { NodeControlStrip, type ControlSegment } from "../NodeControlStrip";
import { NodeStatusBadge } from "../NodeStatusBadge";
import { useCastNodeController } from "./useCastNodeController";
import type { Provenance, NodeStatus, CastAttributes } from "@shared/boardTypes";

export interface CastNodeData extends Record<string, unknown> {
  itemId: number;
  boardId: number;
  provenance: Extract<Provenance, { type: "cast_root" | "cast_view" | "library_cast" }> | null;
  label: string | null;
  imageUrl: string | null;
  userPrompt?: string;
  attributes?: CastAttributes;
  status?: NodeStatus | null;
  pinned?: boolean;
  version: number;
}

export type CastFlowNode = Node<CastNodeData, "cast">;

const VIEW_ANGLE_LABEL: Record<string, string> = {
  frontClose: "Headshot",
  frontFull: "Full front",
  sideClose: "Side close",
  sideFull: "Side full",
  backFull: "Back full",
};

function CastNodeInner({ data, selected }: NodeProps<CastFlowNode>) {
  const controller = useCastNodeController(data);

  const prov = data.provenance;
  const isRoot = !prov || prov.type === "cast_root"; // empty nodes are roots-to-be
  const isLibrary = prov?.type === "library_cast";
  // Card size (VC2 ruling, 2026-07-11): canonical/library 280, views 200; the
  // image area is a 3:4 portrait matching the generation ratio exactly.
  const isView = prov?.type === "cast_view";
  const cardWidth = isView ? 200 : 280;
  const baseLabel = data.label ? `Cast · ${data.label}` : "Cast";
  const typeLabel = isLibrary
    ? `${baseLabel} · Library`
    : prov?.type === "cast_view"
      ? `${baseLabel} · ${VIEW_ANGLE_LABEL[prov.viewAngle] ?? prov.viewAngle}`
      : baseLabel;
  const engine = prov && "engine" in prov ? prov.engine : undefined;
  const errored = data.status?.type === "error";
  const showFrontDoor =
    controller.isEmpty && !errored && controller.promptState !== "generating";

  const controlSegments: ControlSegment[] = isRoot && !isLibrary
    ? [
        { kind: "action", content: "+ Views", onClick: () => {} }, // M7
        { kind: "label", content: `v${data.version || 1}` },
        { kind: "action", content: "···", onClick: () => {} }, // M6
      ]
    : [
        ...(data.pinned ? [{ kind: "pin", content: "Pinned — kept as finished work" } as ControlSegment] : []),
        { kind: "label", content: `v${data.version || 1}` },
        { kind: "action", content: "···", onClick: () => {} },
      ];

  return (
    <div className="relative" style={{ width: cardWidth }}>
      <NodeLabelRow type={typeLabel} engine={engine} selected={selected} />

      <CanvasNodeShell selected={selected}>
        <ConnectionDot kind="prompt" id="prompt-in" top={22} />
        {isRoot && !isLibrary && <ConnectionDot kind="image" id="ref-in" top={40} />}
        {/* Output anchor — edges need a source handle to render (M1 finding) */}
        <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0, right: -2 }} />

        {data.status && !data.pinned && !errored && (
          <NodeStatusBadge status={data.status} onPrimary={controller.retry} />
        )}

        <div className="relative">
          <CastImageArea
            imageUrl={data.imageUrl}
            promptState={controller.isEmpty && !errored ? "empty" : controller.promptState}
            progressFraction={controller.progressFraction}
            progressSeconds={controller.progressSeconds}
            dimmed={data.status?.type === "stale" && !data.pinned}
            error={errored}
            onRetry={controller.retry}
          />
          {/* The front door (D-33): one dark pill, below the empty-slot glyph.
              The picker itself is hosted by BoardPage — node-local state dies
              on the optimistic temp→real id remount. */}
          {showFrontDoor && (
            <div className="absolute inset-x-0 top-[58%] flex justify-center">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("board-open-cast-picker", { detail: { itemId: data.itemId } }),
                  )
                }
                className="px-3 py-1.5 rounded-canvas-pill text-canvas-xs font-medium bg-canvas-ink text-canvas-surface hover:opacity-90 transition-opacity"
              >
                Choose or cast a model
              </button>
            </div>
          )}
        </div>
      </CanvasNodeShell>

      {selected && !controller.isEmpty && <NodeControlStrip segments={controlSegments} />}
    </div>
  );
}

export const CastNode = memo(CastNodeInner);
