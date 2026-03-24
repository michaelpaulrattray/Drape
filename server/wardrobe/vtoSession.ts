/**
 * VTO Session Manager — Service 9: "The Memory"
 *
 * Maintains in-memory Gemini chat sessions so consecutive refinements
 * share context. Sessions are keyed by userId-sessionId and auto-evict
 * after 30 minutes.
 *
 * Gemini model: gemini-2.5-flash-image (TEXT-only response for seeding)
 * Queue lane: none (seeding is lightweight, no image generation)
 */
import { getAiClient, SAFETY_SETTINGS, toInlinePart } from "./utils";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("wardrobe/vtoSession");

// ── Types ──────────────────────────────────────────────────────────────────

export interface VTOSessionEntry {
  chat: any;
  lastResultUrl: string;
  createdAt: number;
}

// ── In-memory store ────────────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessions = new Map<string, VTOSessionEntry>();

function makeKey(userId: number, sessionId: string): string {
  return `${userId}-${sessionId}`;
}

// ── Auto-cleanup interval (every 5 minutes) ───────────────────────────────

setInterval(() => {
  const now = Date.now();
  let evicted = 0;
  Array.from(sessions.entries()).forEach(([key, entry]) => {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      sessions.delete(key);
      evicted++;
    }
  });
  if (evicted > 0) {
    log.info(`Evicted ${evicted} stale VTO session(s)`);
  }
}, 5 * 60 * 1000);

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Seed a new Gemini chat session with model + result context.
 * The chat is created with TEXT-only response modality (no image generation).
 */
export async function seedSession(
  userId: number,
  sessionId: string,
  modelImageUrl: string,
  resultUrl: string,
  outfitDescription?: string,
): Promise<void> {
  const ai = getAiClient();

  const modelPart = await toInlinePart(modelImageUrl);
  const resultPart = await toInlinePart(resultUrl);

  const chat = ai.chats.create({
    model: "gemini-2.5-flash-image",
    config: {
      responseModalities: ["TEXT"],
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const outfitLine = outfitDescription
    ? `\nThe current outfit consists of: ${outfitDescription}.`
    : "";

  const seedMessage = [
    {
      text: `This is the current state of a virtual try-on session. Image 1 is the original model (identity reference). Image 2 is the current result after garment changes.${outfitLine}\n\nAcknowledge and remember this context for future edits. Do not generate a new image.`,
    },
    modelPart,
    resultPart,
  ];

  try {
    await chat.sendMessage({ message: seedMessage });

    const key = makeKey(userId, sessionId);
    sessions.set(key, {
      chat,
      lastResultUrl: resultUrl,
      createdAt: Date.now(),
    });

    log.info(`Session seeded for user ${userId}, session ${sessionId}`);
  } catch (e) {
    log.warn(
      `Failed to seed session for user ${userId}, session ${sessionId}: ${e}`,
    );
    // Don't throw — refinements will use stateless fallback
  }
}

/**
 * Get an active session if it exists and is less than 30 minutes old.
 * Returns null if expired or not found (auto-evicts stale entries).
 */
export function getSession(
  userId: number,
  sessionId: string,
): VTOSessionEntry | null {
  const key = makeKey(userId, sessionId);
  const entry = sessions.get(key);

  if (!entry) return null;

  if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
    sessions.delete(key);
    log.info(`Session expired for user ${userId}, session ${sessionId}`);
    return null;
  }

  return entry;
}

/**
 * Clear a specific session.
 */
export function clearSession(userId: number, sessionId: string): void {
  const key = makeKey(userId, sessionId);
  const existed = sessions.delete(key);
  if (existed) {
    log.info(`Session cleared for user ${userId}, session ${sessionId}`);
  }
}

/**
 * Clear all sessions for a user.
 */
export function clearAllUserSessions(userId: number): void {
  const prefix = `${userId}-`;
  let cleared = 0;
  Array.from(sessions.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      sessions.delete(key);
      cleared++;
    }
  });
  if (cleared > 0) {
    log.info(`Cleared ${cleared} session(s) for user ${userId}`);
  }
}
