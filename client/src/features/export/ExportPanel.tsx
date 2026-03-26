/**
 * ExportPanel — Right-side panel for the Export Pack tool.
 *
 * Shows model identity card, view gallery with individual downloads,
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
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { useExportPack, type ExportStep } from "./useExportPack";
import type { GeneratedAsset } from "@/features/casting/constants";

interface ExportPanelProps {
  modelId: number | null;
  assets: GeneratedAsset[];
}

/** Step label mapping */
const STEP_LABELS: Record<ExportStep, string> = {
  idle: "",
  minting: "Minting identity...",
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
    preferences,
    isLoading,
    step,
    progress,
    isExporting,
    mintModel,
    downloadImage,
    downloadPdf,
    downloadZip,
  } = useExportPack({ modelId, assets });

  const [hoveredView, setHoveredView] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2
          className="w-5 h-5 animate-spin"
          style={{ color: "#b8b3a8" }}
        />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center" style={{ color: "#999" }}>
          <Package className="w-8 h-8 mx-auto mb-3" style={{ color: "#ccc" }} />
          <p style={{ fontSize: 12, fontWeight: 500 }}>No model loaded</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>
            Cast and generate views first
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-3"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "#b8b3a8",
              letterSpacing: "0.08em",
            }}
          >
            EXPORT PACK
          </span>
          {isMinted && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "#1a1a1a",
                background: "#eae7e1",
              }}
            >
              <Shield className="w-2.5 h-2.5" />
              MINTED
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1a1a1a",
            marginBottom: 2,
          }}
        >
          {modelName}
        </p>
        {agencyId && (
          <p style={{ fontSize: 10, color: "#b8b3a8", fontFamily: "monospace" }}>
            {agencyId}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ gap: 20 }}>
        {/* ── View Gallery ────────────────────────────────── */}
        <section className="mb-5">
          <SectionLabel icon={ImageIcon} label="VIEWS" count={viewAssets.length} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            {viewAssets.map((asset) => (
              <div
                key={asset.viewType}
                className="relative rounded-xl overflow-hidden cursor-pointer group"
                style={{
                  background: "#f5f3ef",
                  aspectRatio: "1",
                }}
                onMouseEnter={() => setHoveredView(asset.viewType)}
                onMouseLeave={() => setHoveredView(null)}
                onClick={() => downloadImage(asset)}
              >
                <img
                  src={asset.storageUrl}
                  alt={asset.label}
                  className="w-full h-full object-cover"
                />
                {/* Hover overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
                  style={{
                    background: "rgba(26,26,26,0.4)",
                    opacity: hoveredView === asset.viewType ? 1 : 0,
                  }}
                >
                  <Download className="w-4 h-4" style={{ color: "#fff" }} />
                </div>
                {/* Label */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      color: "#fff",
                    }}
                  >
                    {asset.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Model Attributes ────────────────────────────── */}
        {preferences && (
          <section className="mb-5">
            <SectionLabel icon={Shield} label="IDENTITY" />
            <div
              className="mt-2 rounded-xl p-3"
              style={{ background: "#f5f3ef" }}
            >
              <AttributeGrid preferences={preferences} />
            </div>
          </section>
        )}

        {/* ── Export Progress ─────────────────────────────── */}
        {isExporting && (
          <section className="mb-5">
            <div
              className="rounded-xl p-3"
              style={{ background: "#f5f3ef" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Loader2
                  className="w-3.5 h-3.5 animate-spin"
                  style={{ color: "#1a1a1a" }}
                />
                <span style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a" }}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: 3, background: "rgba(0,0,0,0.06)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: "#1a1a1a",
                  }}
                />
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Footer Actions ────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}
      >
        {/* Mint button — shown only if not yet minted */}
        {!isMinted && (
          <button
            onClick={mintModel}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 mb-2 transition-all duration-200"
            style={{
              background: "transparent",
              border: "1.5px solid rgba(0,0,0,0.1)",
              color: "#1a1a1a",
              fontSize: 11,
              fontWeight: 600,
              opacity: isExporting ? 0.5 : 1,
              cursor: isExporting ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!isExporting) e.currentTarget.style.borderColor = "rgba(0,0,0,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)";
            }}
          >
            <Shield className="w-3.5 h-3.5" />
            Mint Identity
          </button>
        )}

        {/* PDF download */}
        <button
          onClick={downloadPdf}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 mb-2 transition-all duration-200"
          style={{
            background: "transparent",
            border: "1.5px solid rgba(0,0,0,0.1)",
            color: "#1a1a1a",
            fontSize: 11,
            fontWeight: 600,
            opacity: isExporting ? 0.5 : 1,
            cursor: isExporting ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!isExporting) e.currentTarget.style.borderColor = "rgba(0,0,0,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)";
          }}
        >
          <FileText className="w-3.5 h-3.5" />
          Identity Document
        </button>

        {/* Full ZIP pack */}
        <button
          onClick={downloadZip}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200"
          style={{
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            opacity: isExporting ? 0.7 : 1,
            cursor: isExporting ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!isExporting) e.currentTarget.style.background = "#333";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#1a1a1a";
          }}
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Package className="w-3.5 h-3.5" />
          )}
          Download Full Pack (2K)
        </button>

        <p
          className="text-center mt-2"
          style={{ fontSize: 9, color: "#b8b3a8" }}
        >
          All exports rendered at 2K resolution
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
      <Icon className="w-3 h-3" style={{ color: "#b8b3a8" }} />
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "#b8b3a8",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          className="ml-auto px-1.5 py-0.5 rounded-full"
          style={{
            fontSize: 8,
            fontWeight: 600,
            color: "#999",
            background: "rgba(0,0,0,0.04)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function AttributeGrid({
  preferences,
}: {
  preferences: Record<string, string | undefined>;
}) {
  const entries = Object.entries(preferences).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  if (entries.length === 0) {
    return (
      <p style={{ fontSize: 10, color: "#999" }}>No attributes recorded</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span
            style={{
              fontSize: 8,
              fontWeight: 600,
              color: "#b8b3a8",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {formatLabel(key)}
          </span>
          <p
            style={{
              fontSize: 10,
              color: "#1a1a1a",
              fontWeight: 500,
              lineHeight: 1.3,
            }}
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
