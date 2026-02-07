/**
 * AnnouncementBanner — global banner shown to all users when active announcements exist.
 * Dismissible per-session, color-coded by type, auto-refreshes every 60s.
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { X, Info, AlertTriangle, Wrench, Sparkles } from "lucide-react";

const TYPE_STYLES = {
  info: {
    bg: "bg-blue-600",
    icon: Info,
    label: "Info",
  },
  warning: {
    bg: "bg-amber-500",
    icon: AlertTriangle,
    label: "Warning",
  },
  maintenance: {
    bg: "bg-orange-600",
    icon: Wrench,
    label: "Maintenance",
  },
  feature: {
    bg: "bg-emerald-600",
    icon: Sparkles,
    label: "New",
  },
} as const;

type BannerType = keyof typeof TYPE_STYLES;

export function AnnouncementBanner() {
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const { data: banners } = trpc.announcements.getActive.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const handleDismiss = useCallback((id: number) => {
    setDismissedIds((prev) => { const next = new Set(Array.from(prev)); next.add(id); return next; });
  }, []);

  if (!banners?.length) return null;

  const visibleBanners = banners.filter((b) => !dismissedIds.has(b.id));
  if (!visibleBanners.length) return null;

  return (
    <div className="w-full z-[60]">
      {visibleBanners.map((banner) => {
        const style = TYPE_STYLES[banner.type as BannerType] ?? TYPE_STYLES.info;
        const Icon = style.icon;

        return (
          <div
            key={banner.id}
            className={`${style.bg} text-white`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
              <Icon className="w-4 h-4 shrink-0 opacity-90" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium mr-2">{banner.title}</span>
                <span className="text-sm opacity-90">{banner.message}</span>
              </div>
              <button
                onClick={() => handleDismiss(banner.id)}
                className="p-1 rounded-md hover:bg-white/20 transition-colors shrink-0"
                aria-label="Dismiss announcement"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
