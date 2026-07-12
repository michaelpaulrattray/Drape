/** THE floor (R-7/R-9, VC-R6b): the one field + dot pair every work surface
 *  shares — board, image viewer, studio work area. 20px grid, 1px dot.
 *  Used where React Flow's Background isn't mounted (loading/empty states). */
export function DottedGridBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: "var(--color-canvas-field)",
        backgroundImage:
          "radial-gradient(circle, var(--color-canvas-field-dot) 0.75px, transparent 0.75px)",
        backgroundSize: "24px 24px",
      }}
      aria-hidden
    />
  );
}
