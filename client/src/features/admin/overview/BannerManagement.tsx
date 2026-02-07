/**
 * BannerManagement — admin UI for creating, toggling, and deleting platform banners.
 * Designed for the light-theme admin overview page.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Info,
  Wrench,
  Sparkles,
  X,
} from "lucide-react";

const TYPE_CONFIG = {
  info: { label: "Info", icon: Info, color: "bg-blue-100 text-blue-700" },
  warning: { label: "Warning", icon: AlertTriangle, color: "bg-amber-100 text-amber-700" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "bg-orange-100 text-orange-700" },
  feature: { label: "Feature", icon: Sparkles, color: "bg-emerald-100 text-emerald-700" },
} as const;

type BannerType = keyof typeof TYPE_CONFIG;

export function BannerManagement() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<BannerType>("info");
  const [isActive, setIsActive] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.listBanners.useQuery({ limit: 10, offset: 0 });

  const createMutation = trpc.admin.createBanner.useMutation({
    onSuccess: () => {
      toast.success("Banner created");
      utils.admin.listBanners.invalidate();
      utils.announcements.getActive.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.admin.toggleBanner.useMutation({
    onSuccess: () => {
      utils.admin.listBanners.invalidate();
      utils.announcements.getActive.invalidate();
      toast.success("Banner toggled");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deleteBanner.useMutation({
    onSuccess: () => {
      utils.admin.listBanners.invalidate();
      utils.announcements.getActive.invalidate();
      toast.success("Banner deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setShowForm(false);
    setTitle("");
    setMessage("");
    setType("info");
    setIsActive(false);
  }

  function handleCreate() {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    createMutation.mutate({ title: title.trim(), message: message.trim(), type, isActive, startsAt: null, endsAt: null });
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e0e0e0]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[#0A0A0A]" />
          <h3 className="text-base font-semibold text-[#0A0A0A]">Platform Banners</h3>
          {data && <Badge variant="secondary" className="text-xs">{data.total}</Badge>}
        </div>
        <Button
          size="sm"
          variant={showForm ? "outline" : "default"}
          onClick={() => showForm ? resetForm() : setShowForm(true)}
          className={showForm ? "border-[#ccc]" : "bg-[#0A0A0A] text-white hover:bg-[#222]"}
        >
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? "Cancel" : "New Banner"}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-4 p-4 rounded-xl bg-[#f5f5f5] border border-[#e0e0e0] space-y-3">
          <input
            type="text"
            placeholder="Banner title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-[#ddd] bg-white text-sm text-[#0A0A0A] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
          />
          <textarea
            placeholder="Banner message (shown to all users)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#ddd] bg-white text-sm text-[#0A0A0A] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(TYPE_CONFIG) as BannerType[]).map((t) => {
              const cfg = TYPE_CONFIG[t];
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    type === t ? cfg.color + " ring-2 ring-offset-1 ring-[#0A0A0A]/30" : "bg-[#eee] text-[#666] hover:bg-[#ddd]"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
            <label className="flex items-center gap-1.5 ml-auto text-xs text-[#666] cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Activate immediately
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-[#0A0A0A] text-white hover:bg-[#222]"
            >
              {createMutation.isPending ? "Creating..." : "Create Banner"}
            </Button>
          </div>
        </div>
      )}

      {/* Banner List */}
      {isLoading ? (
        <div className="text-sm text-[#999] py-4 text-center">Loading banners...</div>
      ) : !data?.items.length ? (
        <div className="text-sm text-[#999] py-4 text-center">No banners yet. Create one to notify users.</div>
      ) : (
        <div className="space-y-2">
          {data.items.map((banner) => {
            const cfg = TYPE_CONFIG[banner.type as BannerType] ?? TYPE_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <div
                key={banner.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  banner.isActive ? "bg-[#f9f9f9] border-[#d0d0d0]" : "bg-[#fafafa] border-[#eee] opacity-60"
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#666]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-[#0A0A0A] truncate">{banner.title}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                    {banner.isActive && <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">Live</Badge>}
                  </div>
                  <p className="text-xs text-[#666] line-clamp-1">{banner.message}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate({ id: banner.id, isActive: !banner.isActive })}
                    disabled={toggleMutation.isPending}
                    className="p-1.5 rounded-lg hover:bg-[#eee] transition-colors"
                    title={banner.isActive ? "Deactivate" : "Activate"}
                  >
                    {banner.isActive ? (
                      <ToggleRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-[#999]" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this banner permanently?")) {
                        deleteMutation.mutate({ id: banner.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
