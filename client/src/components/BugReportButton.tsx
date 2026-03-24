import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Bug, X, Send } from "lucide-react";

const CATEGORIES = [
  { value: "casting", label: "Casting" },
  { value: "export", label: "Export" },
  { value: "billing", label: "Billing" },
  { value: "ui", label: "UI" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export default function BugReportButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submitMutation = trpc.bugReports.submit.useMutation({
    onSuccess: () => {
      toast.success("Bug report submitted. Thank you!");
      setDescription("");
      setCategory("other");
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit. Please try again.");
    },
  });

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Don't render for unauthenticated users
  if (!user) return null;

  const handleSubmit = () => {
    if (description.trim().length < 10) {
      toast.error("Please describe the issue in at least 10 characters.");
      return;
    }

    submitMutation.mutate({
      description: description.trim(),
      category,
      page: window.location.pathname,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-[9999] flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-all hover:shadow-md hover:scale-105 active:scale-95"
        aria-label="Report a bug"
        title="Report a bug"
      >
        <Bug className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[10000]" onClick={() => setOpen(false)}>
          {/* Popout card — anchored above the trigger */}
          <div
            className="absolute bottom-16 right-5 w-[340px] rounded-xl border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Report a Bug
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Category chips */}
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-colors ${
                      category === cat.value
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="px-4 pb-2">
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell us what went wrong..."
                rows={4}
                maxLength={2000}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 pb-4">
              <span className="text-[10px] text-muted-foreground/50">
                {description.length}/2000
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending || description.trim().length < 10}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitMutation.isPending ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
