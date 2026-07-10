import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge doesn't know our custom utilities, so by default it
 * misclassifies them and silently drops them on conflict:
 *   twMerge("text-canvas-xs text-canvas-ink-soft") -> "text-canvas-ink-soft"
 *   twMerge("border-hairline border-canvas-border") -> "border-canvas-border"
 * Register the canvas type scale as font sizes and the hairline utilities as
 * border widths (styles/canvas-tokens.css) so colors never clobber them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["canvas-xs", "canvas-sm", "canvas-md", "canvas-lg", "canvas-xl"] }],
      "border-w": ["border-hairline"],
      "border-w-b": ["border-b-hairline"],
      "border-w-t": ["border-t-hairline"],
      "border-w-l": ["border-l-hairline"],
      "border-w-r": ["border-r-hairline"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
