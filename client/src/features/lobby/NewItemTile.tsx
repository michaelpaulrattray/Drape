/**
 * NewItemTile — the leading "+" card in a collection grid (Canvas, Models).
 * Dashed hairline, centered plus, quiet label. Grid-stretched to match
 * the sibling cards' height unless given an explicit aspect via style.
 */
import { Plus, Loader2 } from 'lucide-react';
import type { CSSProperties } from 'react';

interface NewItemTileProps {
  label: string;
  onClick: () => void;
  pending?: boolean;
  style?: CSSProperties;
}

export function NewItemTile({ label, onClick, pending, style }: NewItemTileProps) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl transition-colors duration-200"
      style={{
        border: '1px dashed var(--dashed)',
        color: 'var(--metaStrong)',
        cursor: pending ? 'wait' : 'pointer',
        minHeight: 160,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink)';
        e.currentTarget.style.color = 'var(--ink)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--dashed)';
        e.currentTarget.style.color = 'var(--metaStrong)';
      }}
    >
      {pending ? (
        <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1.5} />
      ) : (
        <Plus className="w-6 h-6" strokeWidth={1.5} />
      )}
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
}
