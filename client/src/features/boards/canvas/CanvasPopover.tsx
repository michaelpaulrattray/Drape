/**
 * Popover primitive for all canvas popovers — DESIGN_SYSTEM.md §5.13.
 * shadcn Popover with the canvas-language overrides: no shadow, hairline
 * border, canvas surface. Use for blender chips, view generation, menus.
 */
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export { Popover, PopoverTrigger };

export function CanvasPopoverContent({
  className,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      sideOffset={12}
      className={cn(
        "bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none p-4 text-canvas-ink",
        className,
      )}
      {...props}
    />
  );
}
