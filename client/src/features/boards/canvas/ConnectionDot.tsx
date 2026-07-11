/**
 * Input pins on the card's left edge — DESIGN_SYSTEM.md §5.4. Double as
 * React Flow connection handles. Purple = prompt input, blue = image input;
 * the only affordance whose meaning IS its color (§2.1).
 */
import { Handle, Position } from "@xyflow/react";

export interface ConnectionDotProps {
  kind: "prompt" | "image";
  id: string;
  top: number; // px offset from card top
}

export function ConnectionDot({ kind, id, top }: ConnectionDotProps) {
  return (
    <Handle
      type="target"
      position={Position.Left}
      id={id}
      style={{
        top,
        left: -5,
        width: 10,
        height: 10,
        background:
          kind === "prompt"
            ? "var(--color-canvas-pin-prompt)"
            : "var(--color-canvas-pin-image)",
        border: "1.5px solid var(--color-canvas-surface)",
        borderRadius: "50%",
      }}
      className="!transform-none"
    />
  );
}
