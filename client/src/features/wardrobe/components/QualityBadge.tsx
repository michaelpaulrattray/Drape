/**
 * QualityBadge — Shows quality issue indicators on garment cards.
 *
 * Displays a small colored dot in the corner of the garment card
 * with a tooltip showing the issue details on hover.
 */
import type { QualityIssue } from "../types";

interface QualityBadgeProps {
  issues: QualityIssue[];
}

const SEVERITY_COLORS: Record<QualityIssue["severity"], string> = {
  low: "#8B7355",
  medium: "#D4A017",
  high: "#C75050",
};

export function QualityBadge({ issues }: QualityBadgeProps) {
  if (!issues || issues.length === 0) return null;

  const worst = issues.reduce((a, b) => {
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.severity] > order[a.severity] ? b : a;
  }, issues[0]);

  return (
    <div className="absolute bottom-2 right-2 z-10 group/badge">
      <div
        className="w-2 h-2 rounded-full"
        style={{ background: SEVERITY_COLORS[worst.severity] }}
      />
      {/* Tooltip */}
      <div
        className="absolute bottom-full right-0 mb-1 px-2 py-1 rounded opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
        style={{
          background: "#1a1a1a",
          color: "#fff",
          fontSize: 9,
          maxWidth: 180,
        }}
      >
        {issues.map((issue, i) => (
          <div key={i}>{issue.message}</div>
        ))}
      </div>
    </div>
  );
}
