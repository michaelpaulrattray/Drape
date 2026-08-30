/**
 * The feedback / bug-report form, once (section 02 §1d).
 *
 * It used to live inline inside `LobbyUtilityMenu`, which was fine while both
 * ways in were rows of the same menu. Section 02 splits them: **Report a bug
 * becomes its own topbar icon** — his reason, verbatim from the brief, is that
 * *"two clicks deep gets you fewer bug reports, which is backwards"* — while
 * Send feedback stays a row of the help menu. Two entrances, one form, and the
 * mutation, the copy, the 10-character floor and the toasts are the ones that
 * were already there. Nothing about what a customer sends changed.
 *
 * The report lands in `bug_reports` and, since #255 (2026-08-30), in front of a
 * human: the admin inbox reads that table. Before that it reached nobody.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, X } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { logRawFailure, readableFailure } from '@/lib/failureSentence';

export type FeedbackMode = 'feedback' | 'bug';

export const FEEDBACK_COPY: Record<
  FeedbackMode,
  { title: string; placeholder: string; category: 'feedback' | 'other' }
> = {
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

/** The server's own floor, said here so the refusal is instant rather than a round trip. */
const MIN_DESCRIPTION = 10;

export function FeedbackForm({ mode, onDone }: { mode: FeedbackMode; onDone: () => void }) {
  const [description, setDescription] = useState('');

  const submitMutation = trpc.bugReports.submit.useMutation({
    onSuccess: () => {
      toast.success(
        mode === 'bug' ? 'Bug report submitted. Thank you!' : 'Feedback submitted. Thank you!',
      );
      onDone();
    },
    onError: (err) => {
      logRawFailure('bugReports.submit', err);
      toast.error(readableFailure(err, 'Failed to submit. Please try again.'));
    },
  });

  const handleSubmit = () => {
    if (description.trim().length < MIN_DESCRIPTION) {
      toast.error(`Please describe it in at least ${MIN_DESCRIPTION} characters.`);
      return;
    }
    submitMutation.mutate({
      description: description.trim(),
      category: FEEDBACK_COPY[mode].category,
      page: window.location.pathname,
    });
  };

  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--s-5)' }}>
        <span style={{ font: '500 12.5px var(--font-sans)', color: 'var(--ink)' }}>
          {FEEDBACK_COPY[mode].title}
        </span>
        <button type="button" onClick={onDone} aria-label="Close" className="dp-iconbtn">
          <X size={13} strokeWidth={1.8} />
        </button>
      </div>
      <textarea
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={FEEDBACK_COPY[mode].placeholder}
        rows={4}
        className="w-full outline-none resize-none"
        style={{
          padding: 'var(--s-4)',
          borderRadius: 'var(--r-sm)',
          font: '400 12.5px var(--font-sans)',
          color: 'var(--ink)',
          background: 'var(--fill)',
          border: '1px solid var(--borderInput)',
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitMutation.isPending}
        className="flex items-center justify-center gap-1.5 w-full"
        style={{
          marginTop: 'var(--s-3)',
          padding: 'var(--s-3)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--ink)',
          color: 'var(--surface)',
          font: '500 12.5px var(--font-sans)',
          cursor: submitMutation.isPending ? 'wait' : 'pointer',
        }}
      >
        {submitMutation.isPending ? (
          <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <Send size={13} strokeWidth={1.8} />
        )}
        Send
      </button>
    </>
  );
}

/**
 * The panel the form sits in, shared by both entrances so they cannot drift.
 *
 * ⚠ **THIS 264 IS NOT `LobbyUtilityMenu`'s 264, and it is deliberately not
 * derived from it.** 00b's ruling — *"One width, 264px, in both states"* — was
 * about the MENU not resizing when a row was clicked inside it. The menu has
 * one state now and the form is a separate panel with a separate reason to be
 * this wide (the textarea reads comfortably at it). Two panels that agree on a
 * number are not one fact wearing two names; binding them would make a future
 * change to either one silently move the other.
 */
export const FEEDBACK_PANEL_STYLE = {
  zIndex: 50,
  width: 264,
  padding: 'var(--s-6)',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--borderCard)',
  background: 'var(--surface)',
  boxShadow: 'var(--shadowPop)',
} as const;
