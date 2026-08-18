/**
 * THE LOGIN-ATTACK ALARM, PLUGGED IN (founder ruling 2026-08-19: *"wire and
 * explain in plain english"*, relayed fable-1017 §4).
 *
 * Three helpers in `rateLimit.ts` have counted failed logins across the whole
 * site since they were written months ago, and **nothing has ever called
 * them.** `CLAUDE.md`'s "currently not enforced" list is where that was
 * honestly recorded; `docs/RATE_LIMITING.md` is where it was dishonestly
 * recorded, carrying a worked example of wiring that did not exist. This module
 * is the call site those helpers never had.
 *
 * # WHY A MODULE RATHER THAN FOUR LINES IN THE LOGIN ROUTE
 *
 * Working law 3: a backstop needs a test the model cannot rescue. A guard that
 * only exists inside an Express handler can only be tested by driving the whole
 * login route — so its threshold, its once-per-window promise and its
 * never-break-login promise would all be tested through a door that has its own
 * reasons to fail. Here they are driven directly.
 *
 * # IT CANNOT TAKE A LOGIN AWAY FROM ANYBODY
 *
 * Every failure inside is swallowed and logged. A Slack outage, a bad webhook,
 * a network stall — none of them may turn "your password was wrong" into a 500,
 * and none of them may make a correct login slow. The alert is dispatched
 * fire-and-forget for the same reason: telemetry never takes an answer away
 * from somebody who asked for one.
 *
 * # THE CAVEAT, STATED RATHER THAN SHIPPED QUIETLY
 *
 * `globalAttackWindow` lives in memory, in one process, and **resets on every
 * deploy** — and this product deploys several times a day. So this catches a
 * FAST, LOUD attack (50 failures in five minutes) and would miss a slow patient
 * one that spreads its attempts across a deploy. That is worth having and it is
 * not worth overselling; it is written into `CLAUDE.md` beside the alarm rather
 * than left for an auditor to discover.
 */
import {
  markGlobalAttackAlertSent,
  recordGlobalFailedLogin,
  shouldSendGlobalAttackAlert,
} from "./rateLimit";
import { sendSlackAlert } from "../slack/slackNotification";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("security/loginAttackAlert");

/** The dispatcher, injectable so the alarm can be driven without a webhook. */
export type AttackAlertSender = (input: {
  failedCount: number;
  severity: "warning" | "critical";
}) => Promise<unknown>;

const slackSender: AttackAlertSender = ({ failedCount, severity }) =>
  sendSlackAlert({
    title: severity === "critical"
      ? "Login attack — CRITICAL"
      : "Login attack detected",
    description:
      `${failedCount} failed logins across all accounts in the last five minutes. `
      + "The counter is in memory and resets on deploy, so this is the floor rather than the total.",
    severity,
    fields: [
      { title: "Failed logins in window", value: String(failedCount), short: true },
      { title: "Window", value: "5 minutes", short: true },
    ],
  });

/**
 * ONE FAILED LOGIN, COUNTED — and an alert if this is the one that trips it.
 *
 * Called from EVERY failed-login exit, including the one where the email is not
 * a real account. That is deliberate and it is the case that matters most:
 * credential stuffing works from a leaked list, so most of its attempts name
 * addresses we have never seen. An alarm wired only to the wrong-password exit
 * would sleep through the commonest attack there is.
 *
 * The count is GLOBAL and carries no email, so counting an unknown address
 * leaks nothing — the enumeration defence at the route (one generic sentence
 * for both exits) is untouched.
 *
 * Returns what it observed so a caller can assert at the wire; the login path
 * itself ignores it.
 */
export async function noteFailedLogin(
  send: AttackAlertSender = slackSender,
): Promise<{ failedCount: number; alerted: boolean }> {
  try {
    const status = recordGlobalFailedLogin();
    /* Asked AFTER recording, and it is the helper's own question rather than a
       second threshold written here — a copy of `>= 50` in this file is law 4's
       parallel list on security code. */
    if (!shouldSendGlobalAttackAlert()) {
      return { failedCount: status.failedCount, alerted: false };
    }
    /* MARKED BEFORE THE SEND, not after. The send is the slow part; two
       failures arriving during it would both see an unmarked window and both
       alert. Marking first means a lost Slack message costs one alert, and
       marking after would cost a flood — and a flood is how an alarm gets
       muted by the person it is alarming. */
    markGlobalAttackAlertSent();
    await send({
      failedCount: status.failedCount,
      severity: status.severity === "critical" ? "critical" : "warning",
    });
    return { failedCount: status.failedCount, alerted: true };
  } catch (error) {
    /* A broken alarm may never break a login. */
    log.error({ err: error }, "[loginAttackAlert] the alarm failed; the login path is unaffected");
    return { failedCount: 0, alerted: false };
  }
}
