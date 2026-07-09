import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
import {
  sendAdminActionNotification,
  sendSlackAlert,
} from "../slack/slackNotification";

const log = createModuleLogger("notification");

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Dispatches an owner notification through the Slack webhooks
 * (#admin-actions when configured, falling back to #security-alerts).
 * Returns `true` if the message was delivered, `false` when no webhook is
 * configured or the send failed. Validation errors bubble up as TRPC errors
 * so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL) {
    return sendAdminActionNotification({
      title,
      description: content,
      severity: "info",
    });
  }

  if (process.env.SLACK_WEBHOOK_URL) {
    return sendSlackAlert({
      title,
      description: content,
      severity: "info",
    });
  }

  log.warn(
    `[Notification] No Slack webhook configured — owner notification not delivered: ${title}`
  );
  return false;
}
