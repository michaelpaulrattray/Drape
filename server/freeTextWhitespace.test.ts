import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FREE TEXT REFUSES WHITESPACE-ONLY — the banner, the bug report, the
 * attachment name (#816, the wider class).
 *
 * The shape of the mistake (PR #818's reviewer, observation 1): *whitespace-only
 * free text passes a non-empty check and lands on a record or a customer-visible
 * surface.* The four freeze roads (#818) and the three staff reasons (#820)
 * were the rows with the word "reason" in them; these three are the rows
 * without it, and none had a driven caller anywhere in the suite:
 *
 *   · `announcements.createBanner` / `updateBanner` — an admin-typed banner of
 *     one space is a blank strip on EVERY customer's screen.
 *   · `bugReports.submit` — ten spaces reached the admin inbox #255 exists to
 *     protect, as a report saying nothing.
 *   · `moderatorAttachments.uploadAttachment` — a filename of spaces was stored
 *     as the attachment's name and sanitised to `___` in its key.
 *
 * (The other three rows of the class — change-request title/description,
 * wardrobe `classifyEdit` instruction, legacy iterate feedback — already had a
 * driven or schema-level arm and got their whitespace arm there:
 * `changeRequests.test.ts`, `wardrobe.test.ts`, `modelCreatePayload.test.ts`.)
 *
 * Every arm goes through the real router; the gate passes through and only
 * the far end is stubbed. Each "refuses" arm was RED on the unfixed product and
 * each "trims" arm was red too — the writer received the padding. Green after.
 */

// ── announcements ──────────────────────────────────────────────────────────
const mockCreateAnnouncement = vi.fn().mockResolvedValue({ id: 7 });
const mockUpdateAnnouncement = vi.fn().mockResolvedValue(undefined);
vi.mock("./db/announcementQueries", () => ({
  listAnnouncements: vi.fn(),
  createAnnouncement: (...args: any[]) => mockCreateAnnouncement(...args),
  updateAnnouncement: (...args: any[]) => mockUpdateAnnouncement(...args),
  toggleAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
}));

// ── bug reports + attachments share `./db` ─────────────────────────────────
const mockCreateBugReport = vi.fn().mockResolvedValue(91);
const mockInsertValues = vi.fn().mockResolvedValue([{ insertId: 5 }]);
vi.mock("./db", () => ({
  createBugReport: (...args: any[]) => mockCreateBugReport(...args),
  getDb: async () => ({ insert: () => ({ values: (...args: any[]) => mockInsertValues(...args) }) }),
}));
vi.mock("./db/connection", () => ({ getDb: vi.fn() }));

const mockStoragePut = vi.fn().mockResolvedValue({ url: "https://pub.example/x" });
vi.mock("./storage", () => ({ storagePut: (...args: any[]) => mockStoragePut(...args) }));

vi.mock("./auditLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auditLog")>();
  return { ...actual, logAuditEvent: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("./security/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/adminSecurity")>();
  return {
    ...actual,
    logAdminAction: vi.fn().mockResolvedValue(undefined),
    writeImmutableLog: vi.fn().mockResolvedValue(undefined),
  };
});

import { logAuditEvent } from "./auditLog";
import { announcementsRouter } from "./routes/admin/announcements";
import { bugReportsRouter } from "./routes/bugReports";
import { moderatorAttachmentsRouter } from "./routes/moderatorAttachments";

function ctx(role: "user" | "moderator" | "admin", id: number) {
  return {
    user: {
      id, role, email: `${role}${id}@example.com`, name: "Someone", openId: null,
      suspendedAt: null, lockedUntil: null, approved: true, emailVerified: true,
    },
    // `getClientIp` reads `req.ip` (Express's trust-proxy answer) — each bug-report arm
    // gets its own address so the in-memory rate limiter never answers for an arm above it.
    req: { protocol: "https", ip: `203.0.113.${id}`, headers: {}, socket: {} },
    res: { clearCookie: vi.fn() },
  } as never;
}
const ADMIN = ctx("admin", 2);
const MODERATOR = ctx("moderator", 7);

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateAnnouncement.mockResolvedValue({ id: 7 });
  mockUpdateAnnouncement.mockResolvedValue(undefined);
  mockCreateBugReport.mockResolvedValue(91);
  mockInsertValues.mockResolvedValue([{ insertId: 5 }]);
  mockStoragePut.mockResolvedValue({ url: "https://pub.example/x" });
});

describe("announcements — the banner every customer sees", () => {
  const caller = () => announcementsRouter.createCaller(ADMIN);
  const banner = { type: "info" as const, isActive: false, startsAt: null, endsAt: null };

  it("createBanner refuses a whitespace-only title or message before the writer and the audit row", async () => {
    await expect(caller().createBanner({ ...banner, title: "   ", message: "Maintenance tonight" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller().createBanner({ ...banner, title: "Heads up", message: "\n\t" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockCreateAnnouncement).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("createBanner trims the title and message before the writer and the audit row", async () => {
    await expect(caller().createBanner({ ...banner, title: "  Heads up \n", message: "\t Maintenance tonight  " })).resolves.toEqual({ id: 7 });
    expect(mockCreateAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Heads up", message: "Maintenance tonight", createdBy: 2 }),
    );
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ title: "Heads up" }) }));
  });

  it("updateBanner refuses whitespace-only on either field and trims a real one — the optional shape carries the same rule", async () => {
    await expect(caller().updateBanner({ id: 7, title: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().updateBanner({ id: 7, message: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockUpdateAnnouncement).not.toHaveBeenCalled();
    await expect(caller().updateBanner({ id: 7, title: "  New title " })).resolves.toBeUndefined();
    expect(mockUpdateAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ id: 7, title: "New title" }));
  });
});

describe("bugReports.submit — a customer's words to the admin inbox", () => {
  it("refuses ten spaces — the floor is ten characters of something, not ten characters", async () => {
    const caller = bugReportsRouter.createCaller(ctx("user", 10));
    await expect(caller.submit({ description: " ".repeat(10) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.submit({ description: " ".repeat(40) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockCreateBugReport).not.toHaveBeenCalled();
  });

  it("trims a padded description before the row, and the row is the notification", async () => {
    const caller = bugReportsRouter.createCaller(ctx("user", 11));
    await expect(caller.submit({ description: "  The export button does nothing on Safari \n" })).resolves.toEqual({ success: true, id: 91 });
    expect(mockCreateBugReport).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 11, description: "The export button does nothing on Safari" }),
    );
  });

  it("POSITIVE CONTROL — exactly ten real characters is accepted, so the refusals above are the trim and not a raised floor", async () => {
    const caller = bugReportsRouter.createCaller(ctx("user", 12));
    await expect(caller.submit({ description: "x".repeat(10) })).resolves.toMatchObject({ success: true });
  });
});

describe("moderatorAttachments.uploadAttachment — the stored filename", () => {
  const caller = () => moderatorAttachmentsRouter.createCaller(MODERATOR);
  const png = { mimeType: "image/png", base64Data: Buffer.from("not really a png").toString("base64") };

  it("refuses a whitespace-only filename before the bucket and the row", async () => {
    await expect(caller().uploadAttachment({ ...png, filename: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockStoragePut).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("trims a padded filename before the key, the row and the answer", async () => {
    const answer = await caller().uploadAttachment({ ...png, filename: "  receipt.png \n" });
    expect(answer.filename).toBe("receipt.png");
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ filename: "receipt.png" }));
    const [key] = mockStoragePut.mock.calls[0] as [string];
    expect(key.endsWith("-receipt.png")).toBe(true);
  });
});
