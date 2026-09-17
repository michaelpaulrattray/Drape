/**
 * Pill strip below the card — DESIGN_SYSTEM.md §5.8. Selected nodes only.
 * Root cast: `+ Views · vN · ···`; view cast: `vN · ···` (+ pin glyph when
 * pinned). No view-switcher segment exists on any cast strip.
 */

export interface ControlSegment {
  kind: "label" | "dropdown" | "action" | "pin";
  content: string;
  icon?: "chevron" | "more";
  onClick?: () => void;
  active?: boolean;
}

