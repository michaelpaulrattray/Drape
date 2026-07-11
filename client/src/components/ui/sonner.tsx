/**
 * Toast primitive — restyled app-wide in Drape's language (founder directive,
 * post-R2 2026-07-11): flat white surface, hairline border, no shadow, ink
 * type, minimal radius. One monochrome icon set; error keeps the destructive
 * red glyph (the one red mark, per D-8's reasoning). Every toast call site
 * inherits this — never restyle per-surface.
 *
 * Principle (D-40): feedback renders where the action happened — toasts are
 * for outcomes with no visible surface of their own. Prefer inline feedback
 * when the action's surface is on screen.
 */
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Check, XCircle, Info, AlertTriangle, Loader2 } from "lucide-react";

const INK = "#0A0A0A";
const DESTRUCTIVE = "#B3261E"; // --color-canvas-destructive (tokens.css is canvas-scoped; toasts are app-wide)

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // Toasts render in Drape's light language everywhere — the working
      // surfaces (canvas, studio, lobby) are light regardless of app theme
      theme="light"
      className="toaster group"
      gap={8}
      icons={{
        success: <Check size={14} strokeWidth={1.6} style={{ color: INK }} />,
        error: <XCircle size={14} strokeWidth={1.6} style={{ color: DESTRUCTIVE }} />,
        info: <Info size={14} strokeWidth={1.6} style={{ color: INK }} />,
        warning: <AlertTriangle size={14} strokeWidth={1.6} style={{ color: INK }} />,
        loading: <Loader2 size={14} strokeWidth={1.6} className="animate-spin" style={{ color: INK }} />,
      }}
      style={
        {
          "--normal-bg": "#FFFFFF",
          "--normal-text": INK,
          "--normal-border": "rgba(10, 10, 10, 0.14)",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          boxShadow: "none",
          borderRadius: 8,
          borderWidth: 1,
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: "0.01em",
          padding: "10px 14px",
        },
        classNames: {
          description: "text-[12px] opacity-70",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
