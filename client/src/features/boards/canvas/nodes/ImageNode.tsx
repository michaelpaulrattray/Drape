/**
 * ImageNode — minimal renderer for non-cast image-kind items (uploads,
 * references, backfilled legacy rows). Replaces BoardItemNode for these
 * kinds; garment/VTO get richer nodes in pass 2.
 */
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { CanvasNodeShell } from "../CanvasNodeShell";
import { NodeLabelRow } from "../NodeLabelRow";
import { SafeImage } from "../ImageFallback";
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
  const typeName = data.provenance ? PROVENANCE_LABEL[data.provenance.type] ?? "Image" : "Image";
  const typeLabel = data.label ? `${typeName} · ${data.label}` : typeName;
  const engine =
    data.provenance && "engine" in data.provenance && data.provenance.engine !== "unknown"
      ? data.provenance.engine
      : undefined;

  return (
    <div className="relative" style={{ width: data.width }}>
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
