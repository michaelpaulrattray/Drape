/**
 * Subtle animated SVG flow lines across the hero section background.
 * 3 organic curves that slowly morph, creating depth and movement.
 * Uses CSS keyframe animations for smooth path morphing.
 */

const FLOW_LINES_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  zIndex: 1,
  opacity: 0.12,
};

export default function FlowLines() {
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="none"
      style={FLOW_LINES_STYLE}
      aria-hidden="true"
    >
      {/* Upper flowing curve */}
      <path
        d="M-100,200 Q200,80 450,220 T900,180 T1300,220"
        stroke="#b0b0b0"
        strokeWidth="2"
        fill="none"
        className="animate-flow-1"
      />
      {/* Middle flowing curve */}
      <path
        d="M-100,350 Q300,480 600,340 T1000,380 T1300,350"
        stroke="#b0b0b0"
        strokeWidth="1.5"
        fill="none"
        className="animate-flow-2"
      />
      {/* Lower flowing curve */}
      <path
        d="M-100,500 Q250,420 500,520 T850,460 T1300,500"
        stroke="#b0b0b0"
        strokeWidth="1.2"
        fill="none"
        className="animate-flow-3"
      />
    </svg>
  );
}
