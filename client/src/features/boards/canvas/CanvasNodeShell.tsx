/**
 * The generic white card every node type composes — DESIGN_SYSTEM.md §5.6.
 * Renders identically at every zoom (D-37 spatial constancy): hairline at
 * rest, 1px ink when selected.
 */
import { cn } from "@/lib/utils";

export interface CanvasNodeShellProps {
  selected?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CanvasNodeShell({ selected, children, className }: CanvasNodeShellProps) {
  return (
    <div
      className={cn(
        "relative bg-canvas-surface overflow-hidden border-solid rounded-canvas-md transition-colors duration-150 ease-out",
        selected ? "border-canvas-ink" : "border-canvas-border",
        className,
      )}
      style={{ borderWidth: selected ? "1px" : "0.5px" }}
    >
      {children}
    </div>
  );
}
