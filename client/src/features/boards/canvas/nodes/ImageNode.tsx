/**
 * ImageNode — minimal renderer for non-cast image-kind items (uploads,
 * references, backfilled legacy rows). Replaces BoardItemNode for these
 * kinds; garment/VTO get richer nodes in pass 2.
 *
 * R4: carries the same six-slot toolbar as every node (grammar stays
 * predictable — Decision 7); Rerun/Variations are visibly disabled because
 * these nodes don't generate.
 */
import { memo, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { CanvasNodeShell } from "../CanvasNodeShell";
import { NodeLabelRow } from "../NodeLabelRow";
import { SafeImage } from "../ImageFallback";
import { NodeFloatingToolbar, type NodeToolbarAction } from "../NodeFloatingToolbar";
import { useIsMultiSelect } from "../GroupSelectionOverlay";
import { downloadImage } from "../imageActions";
import type { Provenance } from "@shared/boardTypes";

export interface ImageNodeData extends Record<string, unknown> {
  itemId: number;
  boardId: number;
  provenance: Provenance | null;
  label: string | null;
  imageUrl: string | null;
  width: number;
  height: number;
}

export type ImageFlowNode = Node<ImageNodeData, "image">;

const PROVENANCE_LABEL: Record<string, string> = {
  upload: "Upload",
  reference: "Reference",
  vto_output: "Try-on",
  library_garment: "Garment",
  text2img: "Image",
};

function ImageNodeInner({ data, selected }: NodeProps<ImageFlowNode>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const typeName = data.provenance ? PROVENANCE_LABEL[data.provenance.type] ?? "Image" : "Image";
  const typeLabel = data.label ? `${typeName} · ${data.label}` : typeName;
  const engine =
    data.provenance && "engine" in data.provenance && data.provenance.engine !== "unknown"
      ? data.provenance.engine
      : undefined;

  const dispatchNodeEvent = (name: string) =>
    window.dispatchEvent(new CustomEvent(name, { detail: { itemId: data.itemId } }));

  const toolbarActions: NodeToolbarAction[] = [
    { id: "rerun", label: "This node doesn't generate", disabled: true, onClick: () => {} },
    { id: "variations", label: "This node doesn't generate", disabled: true, onClick: () => {} },
    {
      id: "duplicate",
      label: "Duplicate",
      disabled: data.itemId <= 0,
      onClick: () => dispatchNodeEvent("board-duplicate-node"),
    },
    {
      id: "download",
      label: data.imageUrl ? "Download" : "No image",
      disabled: !data.imageUrl,
      onClick: () => {
        if (data.imageUrl) void downloadImage(data.imageUrl, `drape-${data.label || data.itemId}.png`);
      },
    },
    {
      id: "delete",
      label: "Delete",
      disabled: data.itemId <= 0,
      onClick: () => dispatchNodeEvent("board-delete-node"),
    },
    {
      id: "info",
      label: "Info",
      disabled: data.itemId <= 0,
      onClick: () => {
        const rect = containerRef.current?.getBoundingClientRect();
        window.dispatchEvent(
          new CustomEvent("board-node-info", {
            detail: {
              itemId: data.itemId,
              x: rect ? rect.right + 12 : window.innerWidth / 2,
              y: rect ? rect.top : window.innerHeight / 2,
            },
          }),
        );
      },
    },
  ];

  // D-50: in a multi-selection the group toolbar replaces per-node toolbars
  const multiSelect = useIsMultiSelect();

  return (
    <div ref={containerRef} className="relative" style={{ width: data.width }}>
      {selected && !multiSelect && <NodeFloatingToolbar actions={toolbarActions} />}
      <NodeLabelRow type={typeLabel} engine={engine} selected={selected} />
      <CanvasNodeShell selected={selected}>
        <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0, left: -2 }} />
        <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0, right: -2 }} />
        <div style={{ height: data.height }} className="bg-canvas-surface-inset">
          <SafeImage src={data.imageUrl ?? undefined} alt="" draggable={false} className="w-full h-full object-cover" />
        </div>
      </CanvasNodeShell>
    </div>
  );
}

export const ImageNode = memo(ImageNodeInner);
