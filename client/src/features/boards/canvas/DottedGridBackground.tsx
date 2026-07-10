/** Canvas background — DESIGN_SYSTEM.md §5.1. Replaces React Flow's Background. */
export function DottedGridBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--color-canvas-border) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        opacity: 0.6,
      }}
      aria-hidden
    />
  );
}
