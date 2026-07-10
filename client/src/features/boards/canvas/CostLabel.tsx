/**
 * The one way credit cost appears next to an affordance — DESIGN_SYSTEM.md §5.15.
 * `credits` always comes from a boardOps plan (`estimatedCreditCost`); rendering
 * a literal here is the anti-pattern this component exists to prevent. The "~"
 * is deliberate: Flash-fallback pricing may halve the actual charge.
 */
export function CostLabel({ credits }: { credits: number | null }) {
  if (credits === null) return null; // plan still loading — never show a guess
  return (
    <span className="text-canvas-xs text-canvas-ink-faint whitespace-nowrap">
      ~{credits.toLocaleString()} credits
    </span>
  );
}
