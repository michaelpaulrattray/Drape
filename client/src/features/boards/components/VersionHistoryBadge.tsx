/**
 * VersionHistoryBadge — Clean layers icon on the upper-left corner of a node.
 *
 * Only visible when the item has iteration history (version count > 0).
 * Clicking opens the VersionHistoryModal.
 */
import { Layers } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface VersionHistoryBadgeProps {
  itemId: number;
  onClick: () => void;
}

export function VersionHistoryBadge({ itemId, onClick }: VersionHistoryBadgeProps) {
  const { data } = trpc.boards.getItemVersionCount.useQuery({ itemId });

  // Don't show if no versions
  if (!data || data.count === 0) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute z-10 flex items-center justify-center transition-all"
      style={{
        top: 8,
        left: 8,
        width: 28,
        height: 28,
        borderRadius: 8,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        color: '#71716A',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
        e.currentTarget.style.color = '#1a1a1a';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.92)';
        e.currentTarget.style.color = '#71716A';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.08)';
      }}
      title={`${data.count} version${data.count === 1 ? '' : 's'}`}
    >
      <Layers size={14} strokeWidth={1.5} />
    </button>
  );
}
