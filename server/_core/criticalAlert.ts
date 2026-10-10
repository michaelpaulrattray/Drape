/**
 * The alert payload for an unhandled server error. Since #800 (the Slack
 * retirement, 2026-09-11) its consumer writes it into a critical audit row —
 * the admin overview's alerts feed — rather than a Slack channel; the shape
 * is unchanged so the arms that drive it did not move.
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
 * Only the payload is lifted. The dynamic imports and the swallow-everything
 * `catch` stay at the call site, because a crash handler that throws while
 * reporting a crash is worse than one that says nothing.
 */

import { redactQueryValuesInText } from "../monitoring/queryErrorRedaction";

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
    /* A failed query's values are withheld here too (#2218): the crash
       handlers reduce an Error before calling, but a STRING rejection reason
       arrives as-is, and this row is read by staff. Message and stack are
       reduced separately, because the params tail runs to the end of a text. */
    description: error instanceof Error
      ? `${redactQueryValuesInText(error.message)}\n\`\`\`${redactQueryValuesInText(String(error.stack?.slice(0, 500)))}\`\`\``
      : redactQueryValuesInText(String(error)),
  };
}
