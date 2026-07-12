/**
 * CharacterSheetImageArea — the COMP CARD (DS §5.17; D-29 as amended by
 * D-39; vocabulary per D-51 — "character sheet" is docs shorthand only).
 *
 * A minted model's root renders its package as one composite: the
 * headshot-dominant mosaic (founder-ruled at R5 planning). The whole grid
 * keeps the sacred 3:4 — a thirds grid makes every cell 3:4 too, so the
 * node's geometry is IDENTICAL to the single-image card at every state.
 *
 * Restraint rules (D-29 — the card must not become a mini-app):
 *  - tiles are images only at rest; NO buttons, labels, or toolbars in tiles
 *  - the one per-view surface is the tile-click popover (hosted by CastNode)
 *  - ghost tiles are the D-39c add-view affordance (upgrade anytime)
 *  - per-tile status dots stay screen-legible at any zoom (D-37 survivor)
 */
import { useRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeImage } from "./ImageFallback";
import { useCanvasZoom, screenLegibleScale } from "./canvasZoom";
import type { CanonicalViewAngle } from "@shared/boardTypes";

export interface SheetTile {
  angle: CanonicalViewAngle;
  label: string;
  url: string | null;
  filled: boolean;
  pinned: boolean;
  stale: boolean;
  failed: { reason: string } | null;
  /** A live board placement exists for this angle (⤢ corner glyph). */
  poppedOut: boolean;
  /** A refresh is in flight for this angle (shimmer treatment). */
  refreshing: boolean;
}

/** The mosaic (founder-ruled): headshot spans 2×2; views fill around it.
 *  One frame for every package state — missing slots render as ghosts. */
const TILE_AREAS: Record<CanonicalViewAngle, string> = {
  frontClose: "head",
  threeQuarter: "tq",
  sideClose: "side",
  frontFull: "ff",
  sideFull: "walk",
  backFull: "back",
};

export interface CharacterSheetImageAreaProps {
  tiles: SheetTile[];
  /** The tile whose popover is open — holds the inset ring. */
  activeTileAngle: CanonicalViewAngle | null;
  /** Tile click — CastNode anchors the per-view popover to the element. */
  onTileClick: (angle: CanonicalViewAngle, el: HTMLElement) => void;
  /** Tile double-click — opens the viewer on the CLICKED view (VC-R5 fix 5). */
  onTileDoubleClick: (angle: CanonicalViewAngle, url: string) => void;
  /** Ghost click — opens the takeover with upgrade intent (D-39c/D-51). */
  onGhostClick: () => void;
}

export function CharacterSheetImageArea({
  tiles,
  activeTileAngle,
  onTileClick,
  onTileDoubleClick,
  onGhostClick,
}: CharacterSheetImageAreaProps) {
  const { zoom } = useCanvasZoom();
  const dotScale = screenLegibleScale(zoom);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      // gap-px over the border color: the grid's seams read as hairlines
      className="aspect-[3/4] grid gap-px bg-canvas-border"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gridTemplateAreas: '"head head tq" "head head side" "ff walk back"',
      }}
    >
      {tiles.map((tile) => {
        const area = TILE_AREAS[tile.angle];
        if (!tile.filled) {
          return (
            // No mousedown stopPropagation: the card must stay selectable and
            // draggable by its face (the tiles ARE the face); the 4px
            // click-vs-drag threshold (VC-R4 fix 4) keeps clicks clean
            <button
              key={tile.angle}
              type="button"
              style={{ gridArea: area }}
              onClick={tile.failed ? (e) => onTileClick(tile.angle, e.currentTarget) : onGhostClick}
              className={cn(
                "relative bg-canvas-surface-inset flex flex-col items-center justify-center gap-0.5",
                "text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors group",
              )}
            >
              {/* Ghost affordance (D-39c): dashed inset, + glyph, slot name */}
              <span className="absolute inset-1 border border-dashed border-canvas-border group-hover:border-canvas-border-strong rounded-canvas-sm pointer-events-none" />
              <Plus className="w-3 h-3" strokeWidth={1.4} />
              <span className="text-[9px] leading-tight">{tile.label}</span>
              {tile.failed && (
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-canvas-destructive"
                  style={{ transform: `scale(${dotScale})`, transformOrigin: "top right" }}
                />
              )}
            </button>
          );
        }
        return (
          <button
            key={tile.angle}
            type="button"
            style={{ gridArea: area }}
            onClick={(e) => onTileClick(tile.angle, e.currentTarget)}
            onDoubleClick={(e) => {
              // stopPropagation: React Flow's node dblclick would otherwise
              // open the viewer on the ROOT headshot over this one (fix 5)
              e.stopPropagation();
              onTileDoubleClick(tile.angle, tile.url!);
            }}
            className="relative bg-canvas-surface-inset overflow-hidden group"
          >
            <SafeImage
              src={tile.url!}
              alt=""
              draggable={false}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-250",
                tile.stale && !tile.pinned && "opacity-70",
                tile.refreshing && "opacity-40",
              )}
            />
            {/* Hover / active: 1px inset ink ring — the one tile affordance */}
            <span
              className={cn(
                "absolute inset-0 pointer-events-none border border-canvas-ink opacity-0 transition-opacity duration-120",
                activeTileAngle === tile.angle ? "opacity-100" : "group-hover:opacity-60",
              )}
            />
            {tile.refreshing && (
              <span className="absolute inset-x-[22%] top-1/2 h-[2px] -translate-y-1/2 bg-canvas-surface rounded-full overflow-hidden">
                <span className="block h-full w-1/2 bg-canvas-ink opacity-45 animate-pulse" />
              </span>
            )}
            {/* Screen-legible status dot (D-37): stale = ink, never invisible */}
            {tile.stale && !tile.pinned && !tile.refreshing && (
              <span
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-canvas-ink"
                style={{ transform: `scale(${dotScale})`, transformOrigin: "top right" }}
              />
            )}
            {/* Popped-out marker: the view also lives on the board */}
            {tile.poppedOut && (
              <span className="absolute bottom-0.5 right-1 text-[9px] leading-none text-canvas-surface [text-shadow:0_0_2px_rgba(0,0,0,0.55)] pointer-events-none">
                ⤢
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
