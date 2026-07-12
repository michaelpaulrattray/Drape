/**
 * CanvasHelpers — Small UI helpers used by ImageViewerPanel.
 *
 * Extracted to keep ImageViewerPanel under the 500-line limit.
 */
import { useState, useEffect, useMemo } from "react";

// ============ SlotChip + RotatingSuggestions ============

export function SlotChip({ slotIdeas, intervalMs, onSelect }: { slotIdeas: string[]; intervalMs: number; onSelect: (idea: string) => void }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => { setIndex(0); setVisible(true); }, [slotIdeas]);

  useEffect(() => {
    if (slotIdeas.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % slotIdeas.length);
        setVisible(true);
      }, 300);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slotIdeas, intervalMs]);

  if (!slotIdeas.length) return null;
  const idea = slotIdeas[index];

  return (
    <button
      onClick={() => onSelect(idea)}
      title={idea}
      className="px-3 py-1.5 rounded-canvas-pill bg-canvas-surface border-hairline border-canvas-border text-canvas-md text-canvas-ink-soft hover:border-canvas-border-strong hover:text-canvas-ink flex-shrink-0"
      style={{
        maxWidth: 200, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease, color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {idea}
    </button>
  );
}

export function RotatingSuggestions({ ideas, onSelect }: { ideas: string[]; onSelect: (idea: string) => void }) {
  const slots = useMemo(() => {
    const buckets: string[][] = [[], [], []];
    ideas.forEach((idea, i) => buckets[i % 3].push(idea));
    return buckets;
  }, [ideas]);
  const intervals = [5000, 6500, 8000];
  return (
    <div className="flex items-center gap-1.5 justify-center" style={{ flexWrap: 'nowrap' }}>
      {slots.map((slot, i) => slot.length > 0 && (
        <SlotChip key={i} slotIdeas={slot} intervalMs={intervals[i]} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ============ ToolButton ============

export function ToolButton({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        active
          ? "w-10 h-10 rounded-canvas-md flex items-center justify-center cursor-pointer transition-colors bg-canvas-ink text-canvas-surface"
          : "w-10 h-10 rounded-canvas-md flex items-center justify-center cursor-pointer transition-colors bg-canvas-surface border-hairline border-canvas-border text-canvas-ink-soft hover:text-canvas-ink hover:border-canvas-border-strong"
      }
    >
      {icon}
    </button>
  );
}

// (NextStepChip died with the A4 belt-slimming — the export verb lives in
// the viewer's ··· menu; the floating chip was the last belt nudge.)
