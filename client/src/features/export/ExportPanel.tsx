/**
 * ExportPanel — Right-side panel for the Export Pack tool.
 *
 * Shows model identity card, view gallery, saved wardrobe looks gallery,
 * mint status, and full pack / PDF download actions.
 *
 * Matches the warm minimalist design language (cream/obsidian/stone).
 */
import { useState } from "react";
import {
  Download,
  FileText,
  Package,
  Shield,
  Loader2,
  Image as ImageIcon,
  Bookmark,
  Trash2,
} from "lucide-react";
import { useExportPack, type ExportStep, type SavedLook } from "./useExportPack";
import type { GeneratedAsset } from "@/features/casting/constants";

interface ExportPanelProps {
  modelId: number | null;
  assets: GeneratedAsset[];
}

/** Step label mapping */
const STEP_LABELS: Record<ExportStep, string> = {
  idle: "",
  minting: "Casting identity...",
  upscaling: "Upscaling to 2K...",
  "generating-pdf": "Generating document...",
  compressing: "Compressing pack...",
  done: "Complete",
};

export function ExportPanel({ modelId, assets }: ExportPanelProps) {
  const {
    model,
    modelName,
    isMinted,
    agencyId,
    viewAssets,
    savedLooks,
    preferences,
    isLoading,
    step,
    progress,
    isExporting,
    mintModel,
    downloadImage,
    downloadLookImage,
    downloadPdf,
    downloadZip,
    deleteSavedLook,
  } = useExportPack({ modelId, assets });

  const [hoveredView, setHoveredView] = useState<string | null>(null);
  const [hoveredLook, setHoveredLook] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#52525B" }} />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center" style={{ color: "#999" }}>
          <Package className="w-8 h-8 mx-auto mb-3" style={{ color: "#ccc" }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>No model loaded</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Cast and generate views first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontSize: 11, fontWeight: 600, color: "#52525B", letterSpacing: "0.08em" }}>
            EXPORT PACK
          </span>
          {isMinted && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a", background: "#eae7e1" }}
            >
              <Shield className="w-2.5 h-2.5" />
              CASTED
            </span>
          )}
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>
          {modelName}
        </p>
        {agencyId && (
          <p style={{ fontSize: 12, color: "#52525B", fontFamily: "monospace" }}>{agencyId}</p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* ── View Gallery ────────────────────────────────── */}
        <section className="mb-5">
          <SectionLabel icon={ImageIcon} label="VIEWS" count={viewAssets.length} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            {viewAssets.map((asset) => (
              <ViewThumbnail
                key={asset.viewType}
                asset={asset}
                isHovered={hoveredView === asset.viewType}
                onMouseEnter={() => setHoveredView(asset.viewType)}
                onMouseLeave={() => setHoveredView(null)}
                onDownload={() => downloadImage(asset)}
              />
            ))}
          </div>
        </section>

        {/* ── Saved Looks Gallery ─────────────────────────── */}
        {savedLooks.length > 0 && (
          <section className="mb-5">
            <SectionLabel icon={Bookmark} label="LOOKS" count={savedLooks.length} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              {savedLooks.map((look) => (
                <LookThumbnail
                  key={look.id}
                  look={look}
                  isHovered={hoveredLook === look.id}
                  onMouseEnter={() => setHoveredLook(look.id)}
                  onMouseLeave={() => setHoveredLook(null)}
                  onDownload={() => downloadLookImage(look)}
                  onDelete={() => deleteSavedLook(look.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Model Attributes ────────────────────────────── */}
        {preferences && (
          <section className="mb-5">
            <SectionLabel icon={Shield} label="IDENTITY" />
            <div className="mt-2 rounded-xl p-3" style={{ background: "#F4F4F5" }}>
              <AttributeGrid preferences={preferences} />
            </div>
          </section>
        )}

        {/* ── Export Progress ─────────────────────────────── */}
        {isExporting && (
          <section className="mb-5">
            <div className="rounded-xl p-3" style={{ background: "#F4F4F5" }}>
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#1a1a1a" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: "rgba(0,0,0,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "#1a1a1a" }}
                />
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Footer Actions ────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
        {!isMinted && (
          <ActionButton
            onClick={mintModel}
            disabled={isExporting}
            variant="outline"
            icon={Shield}
            label="Cast Identity"
            className="mb-2"
          />
        )}

        <ActionButton
          onClick={downloadPdf}
          disabled={isExporting}
          variant="outline"
          icon={FileText}
          label="Identity Document"
          className="mb-2"
        />

        <ActionButton
          onClick={downloadZip}
          disabled={isExporting}
          variant="primary"
          icon={isExporting ? Loader2 : Package}
          label={
            savedLooks.length > 0
              ? `Download Full Pack (2K) · ${viewAssets.length + savedLooks.length} files`
              : "Download Full Pack (2K)"
          }
          iconSpin={isExporting}
        />

        <p className="text-center mt-2" style={{ fontSize: 11, color: "#52525B" }}>
          {savedLooks.length > 0
            ? `${viewAssets.length} views + ${savedLooks.length} looks · 2K resolution`
            : "All exports rendered at 2K resolution"}
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3" style={{ color: "#52525B" }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#52525B", letterSpacing: "0.08em" }}>
        {label}
      </span>
      {count !== undefined && (
        <span
          className="ml-auto px-1.5 py-0.5 rounded-full"
          style={{ fontSize: 10, fontWeight: 600, color: "#999", background: "rgba(0,0,0,0.04)" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function ViewThumbnail({
  asset,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onDownload,
}: {
  asset: GeneratedAsset & { label: string };
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer group"
      style={{ background: "#F4F4F5", aspectRatio: "1" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onDownload}
    >
      <img src={asset.storageUrl} alt={asset.label} className="w-full h-full object-cover" />
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
        style={{ background: "rgba(26,26,26,0.4)", opacity: isHovered ? 1 : 0 }}
      >
        <Download className="w-4 h-4" style={{ color: "#fff" }} />
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: "#fff" }}>{asset.label}</span>
      </div>
    </div>
  );
}

function LookThumbnail({
  look,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onDownload,
  onDelete,
}: {
  look: SavedLook;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const displayName = look.name || `Look ${look.id}`;

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer group"
      style={{ background: "#F4F4F5", aspectRatio: "1" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onDownload}
    >
      <img src={look.imageUrl} alt={displayName} className="w-full h-full object-cover" />
      {/* Hover overlay with download + delete */}
      <div
        className="absolute inset-0 flex items-center justify-center gap-3 transition-opacity duration-200"
        style={{ background: "rgba(26,26,26,0.4)", opacity: isHovered ? 1 : 0 }}
      >
        <Download className="w-4 h-4" style={{ color: "#fff" }} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded-full transition-colors"
          style={{ background: "rgba(255,255,255,0.2)" }}
          title="Remove look"
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: "#fff" }} />
        </button>
      </div>
      {/* Label */}
      <div
        className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: "#fff" }}>{displayName}</span>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  variant,
  icon: Icon,
  label,
  iconSpin,
  className = "",
}: {
  onClick: () => void;
  disabled: boolean;
  variant: "outline" | "primary";
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  iconSpin?: boolean;
  className?: string;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${className}`}
      style={{
        background: isPrimary ? "#1a1a1a" : "transparent",
        border: isPrimary ? "none" : "1.5px solid rgba(0,0,0,0.1)",
        color: isPrimary ? "#fff" : "#1a1a1a",
        fontSize: 13,
        fontWeight: 600,
        opacity: disabled ? (isPrimary ? 0.7 : 0.5) : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = isPrimary ? "#333" : "rgba(0,0,0,0.02)";
          if (!isPrimary) e.currentTarget.style.borderColor = "rgba(0,0,0,0.25)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isPrimary ? "#1a1a1a" : "transparent";
        if (!isPrimary) e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)";
      }}
    >
      <Icon className={`w-3.5 h-3.5 ${iconSpin ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}

function AttributeGrid({ preferences }: { preferences: Record<string, string | undefined> }) {
  const entries = Object.entries(preferences).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  if (entries.length === 0) {
    return <p style={{ fontSize: 12, color: "#999" }}>No attributes recorded</p>;
  }

  return (
    <div className="flex flex-col">
      {entries.map(([key, value], i) => (
        <div
          key={key}
          className="flex items-baseline justify-between gap-3 py-1.5"
          style={i < entries.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.05)" } : undefined}
        >
          <span
            className="flex-shrink-0"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#52525B",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              minWidth: 70,
            }}
          >
            {formatLabel(key)}
          </span>
          <p
            className="text-right"
            style={{ fontSize: 12, color: "#1a1a1a", fontWeight: 500, lineHeight: 1.4 }}
          >
            {String(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Convert camelCase to readable label */
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
