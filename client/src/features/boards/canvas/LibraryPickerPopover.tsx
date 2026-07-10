/**
 * LibraryPickerPopover — DESIGN_SYSTEM.md §7.3 (D-13 library bridge, D-28
 * both-paths-at-the-node). M4 scope: Models tab only, most-recent with
 * search, no pagination. Canonical cast reference imagery ONLY — this list
 * never shows VTO outputs, styled renders, or scene imagery (§1.5).
 *
 * Two hosts, one component: the empty cast node's "or choose from your
 * models" link (fill-in-place) and, in M9, the Add menu (placement).
 */
import { useMemo, useState } from "react";
import { User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SafeImage } from "./ImageFallback";

export interface LibraryPickerContentProps {
  onPick: (modelId: number) => void;
  onCastInstead?: () => void;
  disabled?: boolean;
}

export function LibraryPickerContent({ onPick, onCastInstead, disabled }: LibraryPickerContentProps) {
  const [search, setSearch] = useState("");
  const { data: models, isLoading } = trpc.boardOps.listCastableModels.useQuery({ limit: 30 });

  const filtered = useMemo(() => {
    const list = models ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((m) => (m.name ?? "").toLowerCase().includes(q));
  }, [models, search]);

  return (
    <div className="w-full">
      <div className="text-canvas-md font-medium text-canvas-ink mb-0.5">Your models</div>
      <div className="text-canvas-xs text-canvas-ink-faint mb-3">Canonical casts only</div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search models..."
        className="w-full mb-3 px-2.5 py-1.5 bg-canvas-surface-inset rounded-canvas-md text-canvas-sm text-canvas-ink placeholder:text-canvas-ink-faint focus:outline-none"
      />

      {isLoading ? (
        <div className="py-8 text-center text-canvas-xs text-canvas-ink-faint">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-6 flex flex-col items-center text-canvas-ink-faint">
          <User className="w-4 h-4 opacity-50" strokeWidth={1.2} />
          <span className="text-canvas-xs mt-1.5">No models yet</span>
          {onCastInstead && (
            <button
              type="button"
              onClick={onCastInstead}
              className="mt-2 text-canvas-xs text-canvas-ink-soft hover:text-canvas-ink transition-colors"
            >
              Cast one on this board
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(m.id)}
              className="text-left group disabled:opacity-50"
            >
              <div className="aspect-square rounded-canvas-sm overflow-hidden border-hairline border-canvas-border group-hover:border-canvas-border-strong transition-colors bg-canvas-surface-inset">
                <SafeImage
                  src={m.headshotUrl}
                  alt=""
                  fallbackIconOnly
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-canvas-xs text-canvas-ink-soft truncate mt-1">
                {m.name ?? "Untitled"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
