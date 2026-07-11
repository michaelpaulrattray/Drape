/**
 * CastPickerModal — the empty cast node's front door (D-32/D-33).
 *
 * Modal-class SELECTION surface per the refined no-modal rule: single-purpose
 * choose-and-dismiss, one purpose, no nesting, no editing workflows inside.
 * Pick an existing model (canonical cast reference imagery only, §1.5 — never
 * VTO outputs, styled renders, or scene imagery) or take "Cast new" into the
 * casting takeover (D-35). Click-to-open is permanent (founder, 2026-07-11).
 *
 * Portaled to <body> with its own canvas-scope wrapper (D-22) so it renders
 * in the canvas light language regardless of host theme. Hosted by BoardPage
 * — node-local state wouldn't survive the optimistic temp→real id remount.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { User, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SafeImage } from "./ImageFallback";
import { useCastActions } from "./useCastActions";

export interface CastPickerModalProps {
  boardId: number;
  /** The empty cast node being filled. May briefly be an optimistic negative
   *  id — actions stay disabled until the server id is confirmed (BoardPage
   *  swaps the prop in place on confirm). */
  itemId: number;
  onClose: () => void;
  /** "Cast new" chosen — host closes the picker and opens the takeover. */
  onCastNew: () => void;
}

interface PickableModel {
  id: number;
  name: string | null;
  headshotUrl: string;
  draft: boolean;
}

function ModelCard({
  model,
  disabled,
  onPick,
}: {
  model: PickableModel;
  disabled: boolean;
  onPick: (m: PickableModel) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(model)}
      className="text-left group disabled:opacity-50"
    >
      {/* 3:4 — canonical cast geometry (D-31); the model image is sacred */}
      <div className="relative aspect-[3/4] rounded-canvas-sm overflow-hidden border-hairline border-canvas-border group-hover:border-canvas-ink transition-colors bg-canvas-surface-inset">
        <SafeImage src={model.headshotUrl} alt="" fallbackIconOnly className="w-full h-full object-cover" />
        {model.draft && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-[1px] rounded-canvas-sm bg-canvas-surface border-hairline border-canvas-border text-canvas-xs text-canvas-ink-soft">
            Draft
          </span>
        )}
      </div>
      <div className="text-canvas-xs text-canvas-ink-soft truncate mt-1.5">
        {model.name ?? (model.draft ? <span className="text-canvas-ink-faint">Untitled</span> : "Untitled")}
      </div>
    </button>
  );
}

export function CastPickerModal({ boardId, itemId, onClose, onCastNew }: CastPickerModalProps) {
  const [search, setSearch] = useState("");

  const actions = useCastActions({ boardId, itemId });
  const disabled = actions.fillPending || itemId < 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const { data: models, isLoading } = trpc.boardOps.listCastableModels.useQuery({ limit: 30 });

  // D-42: minted models first, drafts in a quieter section below
  const { minted, drafts } = useMemo(() => {
    let list = models ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => (m.name ?? "").toLowerCase().includes(q));
    }
    return {
      minted: list.filter((m) => !m.draft),
      drafts: list.filter((m) => m.draft),
    };
  }, [models, search]);

  const pick = (model: PickableModel) => {
    // The picker's thumbnail fills the node optimistically (D-38/D-42)
    actions.fillFromLibrary(model.id, {
      headshotUrl: model.headshotUrl,
      name: model.name,
      draft: model.draft,
    });
    onClose();
  };

  return createPortal(
    <div className="canvas-scope fixed inset-0 z-50 flex items-center justify-center">
      {/* Scrim — click dismisses (choose-and-dismiss surface) */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(10,10,10,0.3)" }}
        onClick={onClose}
      />

      <div className="relative w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <span className="text-canvas-md font-medium text-canvas-ink">Your models</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 rounded-canvas-sm flex items-center justify-center text-canvas-ink-soft hover:text-canvas-ink hover:bg-canvas-surface-inset transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-5 pb-5">
          {/* Search + the create path, one row (ElevenLabs picker pattern) */}
          <div className="flex items-center gap-2.5 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              autoFocus
              className="flex-1 min-w-0 px-3 py-2 bg-canvas-surface-inset rounded-canvas-md text-canvas-sm text-canvas-ink placeholder:text-canvas-ink-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={onCastNew}
              className="shrink-0 px-3.5 py-2 rounded-canvas-md text-canvas-xs font-medium bg-canvas-ink text-canvas-surface hover:opacity-90 transition-opacity"
            >
              + Cast new
            </button>
          </div>

          {isLoading ? (
            <div className="py-14 text-center text-canvas-xs text-canvas-ink-faint">Loading…</div>
          ) : minted.length === 0 && drafts.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-canvas-ink-faint">
              <User className="w-4 h-4 opacity-50" strokeWidth={1.2} />
              <span className="text-canvas-xs mt-1.5">
                {search.trim() ? "No models match" : "No models yet"}
              </span>
              {!search.trim() && (
                <button
                  type="button"
                  onClick={onCastNew}
                  className="mt-2.5 text-canvas-xs text-canvas-ink-soft hover:text-canvas-ink transition-colors"
                >
                  Cast your first model
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto pr-1">
              {minted.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {minted.map((m) => (
                    <ModelCard key={m.id} model={m} disabled={disabled} onPick={pick} />
                  ))}
                </div>
              )}
              {/* Drafts — placeable, honestly presented, visually quieter (D-42) */}
              {drafts.length > 0 && (
                <>
                  <div className={minted.length > 0 ? "mt-4 mb-2.5" : "mb-2.5"}>
                    <span className="text-canvas-xs text-canvas-ink-faint">
                      Drafts — exploring, not yet cast
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 opacity-80">
                    {drafts.map((m) => (
                      <ModelCard key={m.id} model={m} disabled={disabled} onPick={pick} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
