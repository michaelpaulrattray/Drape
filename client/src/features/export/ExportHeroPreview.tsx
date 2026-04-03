/**
 * ExportHeroPreview — Center panel hero image for the Export tool.
 *
 * Shows the latest saved wardrobe look if available, otherwise falls
 * back to the casting full body or headshot view.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { GeneratedAsset } from "@/features/casting/constants";

interface ExportHeroPreviewProps {
  assets: GeneratedAsset[];
  modelId: number | null;
  centerReady: boolean;
}

export function ExportHeroPreview({ assets, modelId, centerReady }: ExportHeroPreviewProps) {
  const looksQuery = trpc.wardrobe.looks.list.useQuery(
    { modelId: modelId! },
    { enabled: !!modelId, staleTime: 10_000 },
  );

  const [imageLoaded, setImageLoaded] = useState(false);

  const latestLook = looksQuery.data?.[0];
  const heroAsset = assets.find((a) => a.viewType === "frontFull")
    || assets.find((a) => a.viewType === "frontClose");

  const heroUrl = latestLook?.imageUrl || heroAsset?.storageUrl;
  const heroLabel = latestLook ? (latestLook.name || "Latest Look") : "Model Preview";

  if (!heroUrl) return <div className="flex-1" />;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-6"
      style={{
        opacity: centerReady ? 1 : 0,
        transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <img
        src={heroUrl}
        alt={heroLabel}
        className="max-h-full max-w-full object-contain rounded-2xl transition-opacity duration-300"
        style={{
          boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
          opacity: imageLoaded ? 1 : 0,
        }}
        onLoad={() => setImageLoaded(true)}
      />
      {latestLook && (
        <p
          className="mt-3 text-center"
          style={{ fontSize: 12, color: "#52524B", fontWeight: 500 }}
        >
          {heroLabel}
        </p>
      )}
    </div>
  );
}
