/**
 * The Slack payload for an unhandled server error.
 *
 * Lifted out of `alertCriticalError` in `_core/index.ts` BYTE-PRESERVING
 * (2026-08-25, 3g) so the message can be driven without booting the server.
 * `_core/index.ts` is its first and production reader.
 *
 * ⚠ WHY: `server/serverResilience.test.ts` opened a section headed "ALERT
 * CRITICAL ERROR — mirrors the helper in server/_core/index.ts" and re-typed
 * it. The copy had DRIFTED in a way its own arms then asserted: it took a
 * dispatch function as an argument and RETURNED A BOOLEAN (`result.sent`),
 * where the real helper imports `dispatch` itself and returns `void`. An arm
 * read `expect(sent).toBe(true)` about a function that has never returned
 * anything. Working law 4: derive, never mirror.
 *
 * Only the payload is lifted. The dynamic `dispatch` import and the
 * swallow-everything `catch` stay at the call site, because a crash handler
 * that throws while reporting a crash is worse than one that says nothing.
 */

export interface CriticalErrorAlert {
  type: "critical_security_server_crash";
  severity: "critical";
  title: string;
  description: string;
}

export function buildCriticalErrorAlert(label: string, error: unknown): CriticalErrorAlert {
  return {
    type: "critical_security_server_crash",
    severity: "critical",
    title: `Server ${label}`,
    description: error instanceof Error
      ? `${error.message}\n\`\`\`${error.stack?.slice(0, 500)}\`\`\``
      : String(error),
  };
}
