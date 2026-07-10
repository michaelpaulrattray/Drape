/**
 * LibraryRow — one labeled horizontal thumbnail strip in the Library.
 * Hidden when empty.
 */
export interface LibraryItem {
  key: string;
  imageUrl: string;
  title: string;
  onClick: () => void;
}

interface LibraryRowProps {
  label: string;
  items: LibraryItem[];
}

export function LibraryRow({ label, items }: LibraryRowProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#B0AFA8', fontVariantNumeric: 'tabular-nums' }}>
          {items.length}
        </span>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {items.map((item) => (
          <button
            key={item.key}
            onClick={item.onClick}
            className="group/thumb flex-shrink-0 text-left"
            style={{ width: 108 }}
          >
            <div
              className="overflow-hidden rounded-xl"
              style={{
                width: 108,
                height: 144,
                background: '#F5F3F0',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
              />
            </div>
            <span
              className="block mt-1.5"
              style={{
                fontSize: 12,
                color: '#71716A',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
