/**
 * CanvasHelpers — Small UI helpers used by ImageViewerPanel.
 *
 * Extracted to keep ImageViewerPanel under the 500-line limit.
 */
import { useState, useEffect, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useStudioStore } from "@/features/studio/stores/useStudioStore";

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
      className="px-3 py-1.5 rounded-full transition-all"
      style={{
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        fontSize: 12, color: '#52524B',
        border: '1px solid rgba(0,0,0,0.04)',
        maxWidth: 200, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1a1a1a'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.color = '#777'; }}
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

export function ToolButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
      style={{
        background: active ? '#1a1a1a' : 'rgba(255,255,255,0.85)',
        color: active ? '#fff' : '#888',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {icon}
    </button>
  );
}

// ============ NextStepChip ============

/** Contextual next-step nudge that lives inside the shortcuts bar. */
export function NextStepChip({ nextStage }: {
  nextStage: { label: string; action: () => void; step: number; total: number };
}) {
  // Derive a short, vibe-appropriate label
  const chipLabel = (() => {
    switch (nextStage.step) {
      case 2: return 'Full Body';
      case 3: return 'Side View';
      case 4: return 'Export Pack';
      default: return nextStage.label;
    }
  })();

  // Step 4 (all views done) = switch to export tool; otherwise run nextStage action
  const handleClick = () => {
    if (nextStage.step === 4) {
      useStudioStore.getState().setActiveTool('export');
    } else {
      nextStage.action();
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 pointer-events-auto transition-colors"
      style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }}
      onMouseEnter={e => { e.currentTarget.style.color = '#555'; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#1a1a1a'; }}
    >
      {chipLabel}
      <ChevronRight size={10} strokeWidth={2.5} />
    </button>
  );
}
