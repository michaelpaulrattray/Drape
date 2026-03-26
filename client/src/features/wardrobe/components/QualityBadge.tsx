/**
 * QualityBadge — Subtle quality indicator on garment cards.
 *
 * Displays a small muted info dot in the corner of the garment card.
 * On hover, a tooltip shows the detected issues. Uses the warm
 * muted palette to avoid feeling alarming or breaking immersion.
 */
import type { QualityIssue } from "../types";

interface QualityBadgeProps {
  issues: QualityIssue[];
}

export function QualityBadge({ issues }: QualityBadgeProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="absolute bottom-2 right-2 z-10 group/badge">
      {/* Subtle muted dot — warm palette, not alarming */}
      <div
        className="w-2.5 h-2.5 rounded-full flex items-center justify-center"
        style={{ background: "rgba(139,115,85,0.35)" }}
      >
        <span style={{ fontSize: 7, color: "#8B7355", fontWeight: 700, lineHeight: 1 }}>!</span>
      </div>
      {/* Tooltip on hover */}
      <div
        className="absolute bottom-full right-0 mb-1.5 px-2.5 py-1.5 rounded-lg opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: "rgba(26,26,26,0.9)",
          backdropFilter: "blur(8px)",
          color: "#e8e4de",
          fontSize: 9,
          maxWidth: 200,
          lineHeight: 1.4,
        }}
      >
        {issues.map((issue, i) => (
          <div key={i} className="flex items-start gap-1">
            <span style={{ color: "#8B7355", flexShrink: 0 }}>&middot;</span>
            <span>{issue.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
