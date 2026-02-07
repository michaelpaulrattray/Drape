/**
 * Announcement / Maintenance Banner queries.
 * Supports admin CRUD and a public "active banners" endpoint.
 */

import { eq, desc, and, lte, or, isNull, sql, count } from "drizzle-orm";
import { announcements } from "../../drizzle/schema";
import { getDb } from "./connection";

// ============================================================================
// PUBLIC — active banners visible to all users
// ============================================================================

export async function getActiveBanners() {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.isActive, true),
        or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
        or(isNull(announcements.endsAt), sql`${announcements.endsAt} > ${now}`)
      )
    )
    .orderBy(desc(announcements.createdAt))
    .limit(5);

  return rows;
}

export async function getActiveBannerCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();

  const [row] = await db
    .select({ count: count() })
    .from(announcements)
    .where(
      and(
        eq(announcements.isActive, true),
        or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
        or(isNull(announcements.endsAt), sql`${announcements.endsAt} > ${now}`)
      )
    );

  return row?.count ?? 0;
}

// ============================================================================
// ADMIN — full CRUD
// ============================================================================

export async function listAnnouncements(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const [items, [totalRow]] = await Promise.all([
    db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(announcements),
  ]);

  return { items, total: totalRow?.count ?? 0 };
}

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  type: "info" | "warning" | "maintenance" | "feature";
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdBy: number;
}

export async function createAnnouncement(input: CreateAnnouncementInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(announcements).values({
    title: input.title,
    message: input.message,
    type: input.type,
    isActive: input.isActive,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    createdBy: input.createdBy,
  });

  return { id: result.insertId };
}

export interface UpdateAnnouncementInput {
  id: number;
  title?: string;
  message?: string;
  type?: "info" | "warning" | "maintenance" | "feature";
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export async function updateAnnouncement(input: UpdateAnnouncementInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.message !== undefined) updates.message = input.message;
  if (input.type !== undefined) updates.type = input.type;
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  if (input.startsAt !== undefined) updates.startsAt = input.startsAt;
  if (input.endsAt !== undefined) updates.endsAt = input.endsAt;

  await db
    .update(announcements)
    .set(updates)
    .where(eq(announcements.id, input.id));
}

export async function toggleAnnouncement(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(announcements)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(announcements.id, id));
}

export async function deleteAnnouncement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(announcements).where(eq(announcements.id, id));
}
