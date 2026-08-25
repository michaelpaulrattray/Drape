/**
 * LobbyUtilityMenu — the quiet three-dot help menu in the lobby's topbar,
 * rendered into the shell's `topbarRight` slot beside the credits chip.
 *
 * It used to sit `absolute top-4 right-5` — the viewport's top-right
 * corner, Luma-style — which was fine until the M2 foundation shell put
 * the theme toggle in that exact square (`Topbar.tsx`, shell-owned per
 * plan §D.8). Two controls in one 30px box: the z-40 one won and the
 * theme toggle became unclickable (#73). So the menu is now an ordinary
 * `dp-iconbtn` in the topbar's row, and the shell keeps its corner.
 *
 * v1 holds only live destinations, per the no-dead-links rule: a HELP
 * group with Send feedback and Report a bug, both submitting through
 * the existing bugReports.submit mutation (same flows as the studio
 * header). Documentation, theme, and cookie preferences join when
 * those systems exist.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal, MessageSquare, Bug, X, Send, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

type FormMode = 'feedback' | 'bug';

const FORM_COPY: Record<FormMode, { title: string; placeholder: string; category: 'feedback' | 'other' }> = {
  feedback: {
    title: 'Send feedback',
    placeholder: 'What should we improve?',
    category: 'feedback',
  },
  bug: {
    title: 'Report a bug',
    placeholder: 'What happened, and what did you expect?',
    category: 'other',
  },
};

export function LobbyUtilityMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormMode | null>(null);
  const [description, setDescription] = useState('');

  const submitMutation = trpc.bugReports.submit.useMutation({
    onSuccess: () => {
      toast.success(mode === 'bug' ? 'Bug report submitted. Thank you!' : 'Feedback submitted. Thank you!');
      close();
    },
    onError: (err) => {
      logRawFailure('bugReports.submit', err);
      toast.error(readableFailure(err, 'Failed to submit. Please try again.'));
    },
  });

  const close = () => {
    setOpen(false);
    setMode(null);
    setDescription('');
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSubmit = () => {
    if (!mode) return;
    if (description.trim().length < 10) {
      toast.error('Please describe it in at least 10 characters.');
      return;
    }
    submitMutation.mutate({
      description: description.trim(),
      category: FORM_COPY[mode].category,
      page: window.location.pathname,
    });
  };

  return (
    <div className="hidden md:block relative">
      <style>{`
        .lobby-menu-item { color: var(--faint); }
        .lobby-menu-item:hover { background: var(--well); color: var(--ink); }
      `}</style>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        type="button"
        className="dp-iconbtn"
        aria-label="Help and preferences"
        title="Help and preferences"
      >
        <MoreHorizontal size={15} strokeWidth={1.8} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            className="absolute right-0 top-10 z-50 rounded-xl"
            style={{
              background: 'var(--surface)',
              boxShadow: 'var(--shadowPop)',
              border: '1px solid var(--border)',
              width: mode ? 300 : 200,
              padding: mode ? 14 : 6,
            }}
          >
            {!mode ? (
              <>
                <span
                  className="block px-3 pt-1.5 pb-1"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--meta)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Help
                </span>
                <MenuItem icon={MessageSquare} label="Send feedback" onClick={() => setMode('feedback')} />
                <MenuItem icon={Bug} label="Report a bug" onClick={() => setMode('bug')} />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2.5">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {FORM_COPY[mode].title}
                  </span>
                  <button onClick={close} aria-label="Close">
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--metaStrong)' }} />
                  </button>
                </div>
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={FORM_COPY[mode].placeholder}
                  rows={4}
                  className="w-full rounded-lg outline-none resize-none p-2.5"
                  style={{
                    fontSize: 13,
                    color: 'var(--ink)',
                    background: 'var(--fill)',
                    border: '1px solid var(--border)',
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 rounded-lg"
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--surface)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: submitMutation.isPending ? 'wait' : 'pointer',
                  }}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg w-full transition-colors lobby-menu-item"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
    </button>
  );
}
