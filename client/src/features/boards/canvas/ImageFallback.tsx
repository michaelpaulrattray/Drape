/**
 * "Source unavailable" state + SafeImage wrapper — DESIGN_SYSTEM.md §5.16
 * (founder amendment to D-12). No canvas surface ever shows a broken image:
 * every node image, version thumbnail, and provenance snapshot renders
 * through SafeImage (or hand-wires ImageFallback on error).
 */
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageFallback({
  label = "Source unavailable",
  iconOnly = false,
}: {
  label?: string;
  /** Tiny contexts (history thumbs, snapshot chips) render icon-only. */
  iconOnly?: boolean;
}) {
  return (
    <div className="w-full h-full bg-canvas-surface-inset flex flex-col items-center justify-center gap-1 text-canvas-ink-faint">
      <ImageOff className="w-3.5 h-3.5" strokeWidth={1.4} />
      {!iconOnly && <span className="text-canvas-xs">{label}</span>}
    </div>
  );
}

export interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackLabel?: string;
  fallbackIconOnly?: boolean;
}

export function SafeImage({
  fallbackLabel,
  fallbackIconOnly,
  className,
  onError,
  ...img
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !img.src) {
    return <ImageFallback label={fallbackLabel} iconOnly={fallbackIconOnly} />;
  }
  return (
    <img
      {...img}
      className={cn(className)}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}
