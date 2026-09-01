import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
} from "@shared/inputLimits";
import {
  AlertTriangle,
  Info,
  Wrench,
  Sparkles,
} from "lucide-react";
import { Button, Chip, EmptyState, Field, Input, Skeleton } from "@/foundation";

/**
 * BANNERS (brief 07 §8) — *"keeps every action. Its create form uses the
 * foundation's field and button primitives."*
 *
 * Every mutation, its payload and its invalidations are untouched: create,
 * toggle, delete, with the same three `onSuccess` refreshes and the same
 * toasts. This is a restyle.
 *
 * ## `TYPE_CONFIG` loses its colour, like `ACTION_CONFIG` next door
 *
 * Info blue, warning amber, maintenance orange, feature emerald — four hues for
 * four *kinds* of banner, which is §3's forbidden shape and the reason it is
 * forbidden: with all four spent on category, nothing is left to mean urgent.
 * The icon and the label identify the kind.
 *
 * ⚠ **Selection needed its own style, because the foundation's `Chip` has
 * none.** `.dp-chip` carries `:hover`, `--derived` and `--static` and no
 * selected state at all, so the first shape of this file — which reached for a
 * `dp-chip--on` that does not exist — left the chosen type looking exactly
 * like the three unchosen ones. `.dp-ov__typechip--on` in this section's sheet
 * is the fix; the foundation gap is recorded in the promotion pass rather than
 * patched here, since `Chip` has eight other consumers.
 *
 * ## `Live` is greyscale, and that is the rule rather than an oversight
 *
 * It was `bg-green-100 text-green-700`. Brief 06 settled the test: *"a status
 * may carry accent, and only where somebody needs to act."* A live banner is
 * doing exactly what an admin told it to do — it wants no one. It reads as a
 * state without shouting.
 *
 * ⚠ **The delete confirmation is still `window.confirm`, deliberately left.**
 * `DestructiveConfirm` is in the foundation and this is the surface that should
 * eventually use it, but swapping it changes an action's mechanism inside a PR
 * whose bar is *"every number, series and action identical to before"*. It is
 * recorded in this section's promotion pass instead of smuggled in here.
 */

const TYPE_CONFIG = {
  info: { label: "Info", icon: Info },
  warning: { label: "Warning", icon: AlertTriangle },
  maintenance: { label: "Maintenance", icon: Wrench },
  feature: { label: "Feature", icon: Sparkles },
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
    createMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      type,
      isActive,
      startsAt: null,
      endsAt: null,
    });
  }

  return (
    <div className="dp-ov__card">
      <div className="dp-ov__cardhead">
        <span className="dp-ov__blocklabel">BANNERS</span>
        {data && <span className="dp-ov__count">{data.total}</span>}
        <span className="dp-ov__spacer" />
        <Button
          size="small"
          variant={showForm ? "secondary" : "primary"}
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
        >
          {showForm ? "Cancel" : "New banner"}
        </Button>
      </div>

      {showForm && (
        <div className="dp-panel">
          <Field>
            <Input
              type="text"
              placeholder="Scheduled maintenance on Sunday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
            />
          </Field>
          <Field>
            <textarea
              className="dp-input dp-ov__textarea"
              placeholder="Shown to every signed-in customer until you turn it off."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={ANNOUNCEMENT_MESSAGE_MAX_LENGTH}
              rows={2}
            />
          </Field>
          <div className="dp-ov__formrow">
            {(Object.keys(TYPE_CONFIG) as BannerType[]).map((key) => (
              <Chip
                key={key}
                onClick={() => setType(key)}
                className={`dp-ov__typechip${type === key ? " dp-ov__typechip--on" : ""}`}
                aria-pressed={type === key}
              >
                {TYPE_CONFIG[key].label}
              </Chip>
            ))}
            <span className="dp-ov__spacer" />
            <label className="dp-ov__check">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Activate immediately
            </label>
          </div>
          <div className="dp-ov__formfoot">
            <Button
              variant="primary"
              size="small"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create banner"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton style={{ height: 64 }} />
      ) : !data?.items.length ? (
        <EmptyState
          title="No banners yet"
          body="A banner appears at the top of the app for every signed-in customer."
        />
      ) : (
        <div className="dp-ov__banners">
          {data.items.map((banner) => {
            const cfg = TYPE_CONFIG[banner.type as BannerType] ?? TYPE_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <div
                key={banner.id}
                className={`dp-ov__banner${banner.isActive ? "" : " dp-ov__banner--off"}`}
              >
                <Icon className="dp-ov__bannericon" />
                <div className="dp-ov__bannerbody">
                  <div className="dp-ov__bannertop">
                    <span className="dp-ov__bannertitle">{banner.title}</span>
                    <span className="dp-ov__bannerkind">{cfg.label}</span>
                    {banner.isActive && <span className="dp-ov__bannerlive">Live</span>}
                  </div>
                  <p className="dp-ov__bannermsg">{banner.message}</p>
                </div>
                <div className="dp-ov__banneracts">
                  <Button
                    size="small"
                    variant="quiet"
                    onClick={() =>
                      toggleMutation.mutate({ id: banner.id, isActive: !banner.isActive })
                    }
                    disabled={toggleMutation.isPending}
                  >
                    {banner.isActive ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="small"
                    variant="quiet"
                    destructive
                    onClick={() => {
                      if (confirm("Delete this banner permanently?")) {
                        deleteMutation.mutate({ id: banner.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
