/**
 * CastPickerModal — the empty cast node's front door (D-32/D-33).
 *
 * Modal-class SELECTION surface per the refined no-modal rule: single-purpose
 * choose-and-dismiss, one purpose, no nesting, no editing workflows inside.
 * Pick an existing model (canonical cast reference imagery only, §1.5 — never
 * VTO outputs, styled renders, or scene imagery) or take "Cast new" into the
 * casting takeover (D-35). Click-to-open is permanent (founder, 2026-07-11).
 *
 * Portaled to <body>. Hosted by BoardPage — node-local state wouldn't survive
 * the optimistic temp→real id remount.
 *
 * FOLLOWS THE APP THEME (#2322, the founder's yes on 2026-10-12). It used to
 * sit inside its own `canvas-scope` wrapper and draw from the canvas palette,
 * which has no dark values (`styles/canvas-tokens.css`, #916) — so in dark
 * mode it opened as a white sheet. Its colours now come from the foundation
 * tokens (`foundation/tokens.css`), the same ones the app's own modals use
 * (`.dpc-modal` in `foundation/modals.css`): `--viewerScrim`, `--surface`,
 * `--borderCard`, `--fill`, `--well`, `--ink`, `--metaStrong`, `--meta`. The
 * canvas type scale and radii stay — they are sizes, not colours.
 *
 * Stated limit: a picture that fails to load falls back to `SafeImage`'s own
 * placeholder, which is shared with the board and still draws the light canvas
 * palette. The board itself stays light until the canvas redesign (#916).
 */
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
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
      <div className="relative aspect-[3/4] rounded-canvas-sm overflow-hidden border-hairline border-[var(--borderCard)] group-hover:border-[var(--ink)] transition-colors bg-[var(--fill)]">
        <SafeImage src={model.headshotUrl} alt="" fallbackIconOnly className="w-full h-full object-cover" />
        {model.draft && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-[1px] rounded-canvas-sm bg-[var(--surface)] border-hairline border-[var(--borderCard)] text-canvas-xs text-[var(--metaStrong)]">
            Draft
          </span>
        )}
      </div>
      <div className="text-canvas-xs text-[var(--metaStrong)] truncate mt-1.5">
        {model.name ?? (model.draft ? <span className="text-[var(--meta)]">Untitled</span> : "Untitled")}
      </div>
    </button>
  );
}

/** How long typing must pause before the search goes to the server. */
const SEARCH_SETTLE_MS = 250;

export function CastPickerModal({ boardId, itemId, onClose, onCastNew }: CastPickerModalProps) {
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setSettledSearch(search.trim()), SEARCH_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [search]);

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

  // #2406: the search is asked of the SERVER, which reads signed characters
  // and drafts as separate groups, each searched and sorted before its own
  // limit — so an older signed character is never out of reach. (It used to
  // filter the newest 30 rows here, drafts included, and answered "No
  // characters match" for a character who exists.) With no search the input
  // is exactly `{ limit: 30 }`, the key the board and the Cast node prefetch.
  const { data: models, isLoading } = trpc.boardOps.listCastableModels.useQuery(
    settledSearch ? { limit: 30, search: settledSearch } : { limit: 30 },
    { placeholderData: keepPreviousData },
  );

  // D-42: minted models first, drafts in a quieter section below
  const { minted, drafts } = useMemo(() => {
    const list = models ?? [];
    return {
      minted: list.filter((m) => !m.draft),
      drafts: list.filter((m) => m.draft),
    };
  }, [models]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center text-[var(--ink)]">
      {/* Scrim — click dismisses (choose-and-dismiss surface). The app modal's
          own scrim token, so it darkens correctly in both themes. */}
      <div
        className="absolute inset-0 bg-[var(--viewerScrim)]"
        onClick={onClose}
      />

      <div className="relative w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col bg-[var(--surface)] border-hairline border-[var(--borderCard)] rounded-canvas-md">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3">
          <span className="text-canvas-md font-medium text-[var(--ink)]">Your characters</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 rounded-canvas-sm flex items-center justify-center text-[var(--metaStrong)] hover:text-[var(--ink)] hover:bg-[var(--well)] transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-5 pb-5">
          {/* Search + the create path, one row (ElevenLabs picker pattern) */}
          <div className="shrink-0 flex items-center gap-2.5 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search characters…"
              autoFocus
              className="flex-1 min-w-0 px-3 py-2 bg-[var(--fill)] rounded-canvas-md text-canvas-sm text-[var(--ink)] placeholder:text-[var(--meta)] focus:outline-none"
            />
            <button
              type="button"
              onClick={onCastNew}
              className="shrink-0 px-3.5 py-2 rounded-canvas-md text-canvas-xs font-medium bg-[var(--ink)] text-[var(--surface)] hover:opacity-90 transition-opacity"
            >
              + New character
            </button>
          </div>

          {isLoading ? (
            <div className="py-14 text-center text-canvas-xs text-[var(--meta)]">Loading…</div>
          ) : minted.length === 0 && drafts.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-[var(--meta)]">
              <User className="w-4 h-4 opacity-50" strokeWidth={1.2} />
              <span className="text-canvas-xs mt-1.5">
                {search.trim() ? "No characters match" : "No characters yet"}
              </span>
              {!search.trim() && (
                <button
                  type="button"
                  onClick={onCastNew}
                  className="mt-2.5 text-canvas-xs text-[var(--metaStrong)] hover:text-[var(--ink)] transition-colors"
                >
                  Cast someone
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
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
                    <span className="text-canvas-xs text-[var(--meta)]">
                      Drafts — exploring, not yet signed
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
