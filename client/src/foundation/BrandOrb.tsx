import "./brand-orb.css";

/**
 * The brand orb (foundation README §4 — 34px at the top of the rail).
 *
 * This is the one component allowed raw hex literals: the orb's gradient is a
 * documented carve-out from the no-hex rule (README rule 1, plan §D.1), because
 * its stops are a piece of brand artwork rather than a semantic colour, and
 * they are identical in both themes. The carve-out is named explicitly in
 * client/src/foundation/token-guard.test.ts — nowhere else may do this.
 *
 * Ambient drift (9–23s) is the only motion allowed to exceed 340ms, and only
 * because it never sits next to a control (README §8). Reduced motion kills it
 * through the .dp-root rule in tokens.css.
 */
export function BrandOrb({ size = 34 }: { size?: number }) {
  return (
    <div className="dp-orb" style={{ width: size, height: size }} aria-hidden="true">
      <div className="dp-orb__halo" />
      <div className="dp-orb__body">
        <div className="dp-orb__drift dp-orb__drift--a" />
        <div className="dp-orb__drift dp-orb__drift--b" />
        <div className="dp-orb__drift dp-orb__drift--c" />
        <div className="dp-orb__drift dp-orb__drift--d" />
      </div>
    </div>
  );
}
