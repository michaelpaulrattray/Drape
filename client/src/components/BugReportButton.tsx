import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Bug, X, Send } from "lucide-react";

/**
 * Inline bug report trigger — place inside any nav bar.
 * Renders just the icon button + the popout modal.
 * Category is hardcoded to "other" (no chips).
 */
export function BugReportTrigger() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoutRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const submitMutation = trpc.bugReports.submit.useMutation({
    onSuccess: () => {
      toast.success("Bug report submitted. Thank you!");
      setDescription("");
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoutRef.current &&
        !popoutRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) return null;

  const handleSubmit = () => {
    if (description.trim().length < 10) {
      toast.error("Please describe the issue in at least 10 characters.");
      return;
    }
    submitMutation.mutate({
      description: description.trim(),
      category: "other",
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
    <div className="relative">
      {/* Trigger icon */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-full transition-all"
        style={{
          background: open ? 'rgba(0,0,0,0.06)' : 'transparent',
          color: open ? '#1a1a1a' : '#999',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
          e.currentTarget.style.color = '#1a1a1a';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#999';
          }
        }}
        aria-label="Report a bug"
        title="Report a bug"
      >
        <Bug className="h-3.5 w-3.5" />
      </button>

      {/* Popout card */}
      {open && (
        <div
          ref={popoutRef}
          className="absolute top-full right-0 mt-2 w-[320px] rounded-xl shadow-lg z-[9999]"
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
              Report a Bug
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors"
              style={{ color: '#71717A' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#1a1a1a'; e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
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
              className="w-full resize-none rounded-lg px-3 py-2 focus:outline-none"
              style={{
                fontSize: 13,
                color: '#1a1a1a',
                background: '#faf9f7',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 pb-4">
            <span style={{ fontSize: 10, color: '#A1A1AA' }}>
              {description.length}/2000
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || description.trim().length < 10}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontSize: 12,
                fontWeight: 500,
                background: '#1a1a1a',
                color: '#fff',
              }}
            >
              {submitMutation.isPending ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @deprecated Use BugReportTrigger inside nav bars instead.
 * Kept for backwards compatibility — renders nothing.
 */
