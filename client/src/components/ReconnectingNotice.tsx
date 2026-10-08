/**
 * ReconnectingNotice — what a self-guarding page shows when the session check
 * has failed several times in a row and is still being retried (#2018).
 *
 * Before this, a sustained outage drew an empty surface with no words: the
 * page was waiting correctly (#1997) and looked dead. This says the one thing
 * the customer needs — it is being handled and they need do nothing — in
 * their words, with no server or engine vocabulary, and nothing to press.
 * When the next attempt succeeds the page renders as normal and this is gone.
 *
 * Tokens only, so it follows the theme like the rest of the app — including
 * over the legacy studio, whose canvas field is a light-only colour.
 */
import { KliegWordmark } from '@/foundation/KliegWordmark';

export function ReconnectingNotice() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="reconnecting-notice"
      style={{
        minHeight: '100vh',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--s-5)',
        padding: 'var(--s-9)',
        fontFamily: 'var(--font-sans)',
        textAlign: 'center',
      }}
    >
      <span style={{ color: 'var(--meta)' }}>
        <KliegWordmark fontSize={15} />
      </span>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>
        Reconnecting to Klieg…
      </p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--metaStrong)' }}>
        This usually takes a moment. You don't need to do anything.
      </p>
    </div>
  );
}
