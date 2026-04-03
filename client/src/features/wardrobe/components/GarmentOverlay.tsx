/**
 * GarmentOverlay — Clickable bounding boxes over VTO result images.
 *
 * Renders invisible hit-zones for each detected garment. On hover a
 * cursor-following tooltip shows the garment label. On click a small
 * floating popover appears with a text input for refinement instructions
 * like "roll sleeves" or "unbutton". When multiple garments overlap at
 * the click point, a layer picker is shown first.
 */
import React, { useState, useRef, useCallback } from "react";
import type { DetectedItem } from "../types";

interface GarmentOverlayProps {
  items: DetectedItem[];
  onStyleNote: (note: {
    garmentLabel: string;
    category: string;
    instruction: string;
  }) => void;
  disabled?: boolean;
}

/** Z-order by category — outermost layers sort first */
const LAYER_Z: Record<string, number> = {
  tops: 1,
  bottoms: 2,
  shoes: 3,
  full_look: 4,
  accessories: 5,
};

export const GarmentOverlay: React.FC<GarmentOverlayProps> = ({
  items,
  onStyleNote,
  disabled = false,
}) => {
  // Cursor tooltip
  const [cursorLabel, setCursorLabel] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [hitCount, setHitCount] = useState(0);

  // Click state
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const [hitsAtClick, setHitsAtClick] = useState<DetectedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DetectedItem | null>(null);
  const [styleInput, setStyleInput] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Find all items whose bounding box contains a screen point */
  const getHitsAt = useCallback(
    (clientX: number, clientY: number): DetectedItem[] => {
      if (!containerRef.current || items.length === 0) return [];
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      const hits: DetectedItem[] = [];
      for (const item of items) {
        const [ymin, xmin, ymax, xmax] = item.box_2d;
        if (x >= xmin && x <= xmax && y >= ymin && y <= ymax) {
          hits.push(item);
        }
      }
      // Sort: highest z (outermost) first
      hits.sort(
        (a, b) => (LAYER_Z[b.category] || 0) - (LAYER_Z[a.category] || 0),
      );
      return hits;
    },
    [items],
  );

  // ── Mouse move: update cursor tooltip ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (clickPos || disabled) {
        setCursorLabel(null);
        return;
      }
      const hits = getHitsAt(e.clientX, e.clientY);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      if (hits.length > 0) {
        setCursorLabel(hits[0].label);
        setHitCount(hits.length);
      } else {
        setCursorLabel(null);
        setHitCount(0);
      }
    },
    [getHitsAt, clickPos, disabled],
  );

  // ── Click: open picker or direct prompt ──
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;

      // If popover is already open, clicking the overlay background dismisses it
      if (clickPos) {
        dismissAll();
        return;
      }

      const hits = getHitsAt(e.clientX, e.clientY);
      if (hits.length === 0) return;

      const rect = containerRef.current!.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;

      setCursorLabel(null);

      if (hits.length === 1) {
        // Single garment — skip picker, go straight to prompt
        setClickPos({ x: xPct, y: yPct });
        setHitsAtClick(hits);
        setSelectedItem(hits[0]);
        setStyleInput("");
        setTimeout(() => inputRef.current?.focus(), 80);
      } else {
        // Multiple — show layer picker
        setClickPos({ x: xPct, y: yPct });
        setHitsAtClick(hits);
        setSelectedItem(null);
      }
    },
    [getHitsAt, clickPos, disabled],
  );

  // ── Pick from layer list ──
  const pickItem = (item: DetectedItem) => {
    setSelectedItem(item);
    setStyleInput("");
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  // ── Submit style note ──
  const submitNote = () => {
    if (!selectedItem || !styleInput.trim()) return;
    onStyleNote({
      garmentLabel: selectedItem.label,
      category: selectedItem.category,
      instruction: styleInput.trim(),
    });
    dismissAll();
  };

  // ── Dismiss everything ──
  const dismissAll = () => {
    setClickPos(null);
    setHitsAtClick([]);
    setSelectedItem(null);
    setStyleInput("");
    setCursorLabel(null);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: cursorLabel && !clickPos ? "pointer" : "default" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (!clickPos) setCursorLabel(null);
      }}
      onClick={handleClick}
    >
      {/* ── Cursor-Following Tooltip ── */}
      {cursorLabel && !clickPos && (
        <div
          className="pointer-events-none absolute z-[70]"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            transform: "translate(16px, -50%)",
            transition: "left 0.04s linear, top 0.04s linear",
          }}
        >
          <div
            className="px-3 py-1.5 rounded-xl whitespace-nowrap flex items-center gap-2"
            style={{
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: "#555" }}>
              {cursorLabel}
            </span>
            {hitCount > 1 && (
              <span style={{ fontSize: 10, color: "#bbb" }}>
                +{hitCount - 1}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Click Popover (Picker or Prompt) ── */}
      {clickPos && (
        <div
          className="absolute z-[80] pointer-events-auto"
          style={{
            top: `${Math.min(clickPos.y, 72)}%`,
            left: `${clickPos.x}%`,
            transform: "translateX(-50%)",
            animation: "popIn 0.15s ease-out forwards",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="rounded-2xl overflow-hidden w-[280px]"
            style={{
              background: "#fff",
              boxShadow:
                "0 16px 56px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* ── Layer Picker ── */}
            {!selectedItem && hitsAtClick.length > 1 && (
              <>
                <div
                  className="px-3.5 pt-2.5 pb-2 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#999",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {hitsAtClick.length} LAYERS — PICK ONE
                  </span>
                  <button
                    onClick={dismissAll}
                    className="w-5 h-5 flex items-center justify-center transition-colors"
                    style={{ color: "#bbb", fontSize: 16 }}
                  >
                    ×
                  </button>
                </div>
                <div className="py-1">
                  {hitsAtClick.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => pickItem(item)}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left transition-colors group rounded-lg mx-1"
                      style={{ width: "calc(100% - 8px)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#F5F3F0")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate"
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#1a1a1a",
                          }}
                        >
                          {item.label}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#bbb",
                            letterSpacing: "0.06em",
                            marginTop: 2,
                          }}
                        >
                          {item.category.toUpperCase()}
                          {(LAYER_Z[item.category] || 0) <= 2
                            ? " · INNER LAYER"
                            : ""}
                        </div>
                      </div>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        stroke="#ccc"
                        className="flex-shrink-0"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Style Prompt ── */}
            {selectedItem && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    {hitsAtClick.length > 1 && (
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center mr-1 transition-colors"
                        style={{
                          background: "#F5F3F0",
                          color: "#999",
                          fontSize: 13,
                        }}
                      >
                        ←
                      </button>
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1a1a1a",
                      }}
                    >
                      {selectedItem.label}
                    </span>
                  </div>
                  <button
                    onClick={dismissAll}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                    style={{
                      background: "#F5F3F0",
                      color: "#bbb",
                      fontSize: 16,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={styleInput}
                    onChange={(e) => setStyleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNote();
                      if (e.key === "Escape") dismissAll();
                    }}
                    placeholder="e.g. unzip halfway, roll sleeves..."
                    className="flex-1 rounded-xl px-3 py-2 outline-none"
                    style={{
                      background: "#F5F3F0",
                      border: "1px solid rgba(0,0,0,0.06)",
                      fontSize: 14,
                      color: "#1a1a1a",
                    }}
                  />
                  <button
                    onClick={submitNote}
                    disabled={!styleInput.trim()}
                    className="rounded-xl px-4 py-2 whitespace-nowrap transition-all"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      background: styleInput.trim() ? "#1a1a1a" : "#F5F3F0",
                      color: styleInput.trim() ? "#FAFAFA" : "#ccc",
                      cursor: styleInput.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
