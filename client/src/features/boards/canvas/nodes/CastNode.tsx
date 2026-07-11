/**
 * CastNode — the single React Flow node type for casts (DESIGN_SYSTEM.md
 * §5.11). One component for cast_root, cast_view, and library_cast
 * provenance; branch on provenance.type, never split into separate files.
 *
 * M4 (VC2) scope: empty → run → generating → complete on roots, D-28 library
 * fill-in-place, error state with retry. Known-inert until later milestones:
 * attribute popovers (M5), toolbar (M6), views (M7), Edit → studio (M8).
 */
import { memo, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { CanvasNodeShell } from "../CanvasNodeShell";
import { NodeLabelRow } from "../NodeLabelRow";
import { ConnectionDot } from "../ConnectionDot";
import { CastImageArea } from "../CastImageArea";
import { NodeInlinePrompt } from "../NodeInlinePrompt";
import { NodeControlStrip, type ControlSegment } from "../NodeControlStrip";
import { NodeAttributeBlock, type AttributeDescriptor } from "../NodeAttributeBlock";
import { NodeStatusBadge } from "../NodeStatusBadge";
import { Popover, PopoverTrigger, CanvasPopoverContent } from "../CanvasPopover";
import { LibraryPickerContent } from "../LibraryPickerPopover";
import { useZoomTierContext } from "../zoomTiers";
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

/** Attribute rows from parsed/user attributes — popovers land in M5. */
function attributeRows(attrs: CastAttributes | undefined): AttributeDescriptor[] {
  const a = (attrs ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  const inert = (
    <div className="text-canvas-sm text-canvas-ink-soft leading-relaxed">
      Tactile editing arrives in M5. Values shown are from your prompt.
    </div>
  );
  return [
    { id: "brand", label: "Brand", value: str(a.castingBrand), popoverContent: inert, popoverWidth: 260 },
    { id: "vibe", label: "Vibe", value: a.castingVibe ? "Set" : null, popoverContent: inert, popoverWidth: 280 },
    {
      id: "ethnicity",
      label: "Ethnicity",
      value: Array.isArray(a.ethnicityBlend) && a.ethnicityBlend.length
        ? (a.ethnicityBlend as Array<{ name: string }>).map((e) => e.name).join(" + ")
        : str(a.ethnicity),
      popoverContent: inert,
      popoverWidth: 320,
    },
    { id: "skin", label: "Skin", value: str(a.skinTone)?.split(" / ")[0] ?? null, popoverContent: inert, popoverWidth: 280 },
    { id: "hair", label: "Hair", value: str(a.hairColor), popoverContent: inert, popoverWidth: 300 },
    { id: "eyes", label: "Eyes", value: str(a.eyeColor), popoverContent: inert, popoverWidth: 240 },
  ];
}

function CastNodeInner({ data, selected }: NodeProps<CastFlowNode>) {
  const controller = useCastNodeController(data);
  const { tier } = useZoomTierContext();
  const [activeAttrId, setActiveAttrId] = useState<string | null>(null);
  const [attrsExpanded, setAttrsExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!selected && (attrsExpanded || activeAttrId)) {
    setAttrsExpanded(false);
    setActiveAttrId(null);
  }

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
          {/* D-28: the pick-existing path, at the node */}
          {controller.isEmpty && !errored && controller.promptState !== "generating" && tier === "working" && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    className="text-canvas-xs text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors bg-canvas-surface-inset px-2"
                  >
                    or choose from your models
                  </button>
                </PopoverTrigger>
                <CanvasPopoverContent side="right" align="start" style={{ width: 320 }}>
                  <LibraryPickerContent
                    disabled={controller.fillPending}
                    onPick={(modelId) => {
                      setPickerOpen(false);
                      controller.fillFromLibrary(modelId);
                    }}
                    onCastInstead={() => setPickerOpen(false)}
                  />
                </CanvasPopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {!isLibrary && (
          <NodeInlinePrompt
            value={controller.promptValue}
            onChange={controller.setPromptValue}
            onSubmit={controller.runOrEdit}
            state={controller.isEmpty && !errored ? (controller.canRun ? "ready" : "empty") : controller.promptState}
            placeholder={isRoot ? "Describe your model..." : "Pose..."}
            runCost={controller.runCost}
            canRun={controller.canRun}
            autoFocus={controller.isEmpty && selected}
          />
        )}
      </CanvasNodeShell>

      {selected && (
        <>
          {!controller.isEmpty && <NodeControlStrip segments={controlSegments} />}
          {isRoot && !isLibrary && (
            <NodeAttributeBlock
              attributes={attributeRows(data.attributes)}
              expanded={attrsExpanded}
              onExpandedChange={setAttrsExpanded}
              activeId={activeAttrId}
              onActiveChange={setActiveAttrId}
            />
          )}
        </>
      )}
    </div>
  );
}

export const CastNode = memo(CastNodeInner);
