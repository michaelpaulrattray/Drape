/**
 * LobbyUtilityMenu — the quiet three-dot menu in the lobby's top-right
 * corner (Luma-style utility corner).
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
      toast.error(err.message || 'Failed to submit. Please try again.');
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
    <div className="hidden md:block absolute top-4 right-5 z-40">
      <style>{`
        .lobby-menu-item { color: #888; }
        .lobby-menu-item:hover { background: rgba(0,0,0,0.04); color: #1a1a1a; }
      `}</style>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-[rgba(0,0,0,0.05)]"
        aria-label="Help and preferences"
      >
        <MoreHorizontal className="w-4 h-4" style={{ color: '#71716A' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            className="absolute right-0 top-10 z-50 rounded-xl"
            style={{
              background: '#fff',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.06)',
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
                    color: '#B0AFA8',
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                    {FORM_COPY[mode].title}
                  </span>
                  <button onClick={close} aria-label="Close">
                    <X className="w-3.5 h-3.5" style={{ color: '#71716A' }} />
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
                    color: '#1a1a1a',
                    background: '#F5F3F0',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 rounded-lg"
                  style={{
                    background: '#1a1a1a',
                    color: '#fff',
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
