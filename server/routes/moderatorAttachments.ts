/**
 * Moderator Attachments Router — upload/list/link file attachments for change requests.
 */
import { moderatorProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ATTACHMENTS_PER_REQUEST = 5;
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const moderatorAttachmentsRouter = router({
  /**
   * Upload a file attachment (pre-upload before creating the change request).
   * Accepts base64-encoded file data, uploads to S3, stores metadata.
   */
  uploadAttachment: moderatorProcedure
    .input(z.object({
      filename: z.string().min(1).max(256),
      mimeType: z.string().refine((v) => ALLOWED_MIME_TYPES.includes(v), {
        message: "Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, PDF, CSV, TXT, XLSX",
      }),
      base64Data: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("../storage");
      const { changeRequestAttachments } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const buffer = Buffer.from(input.base64Data, "base64");
      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }

      const suffix = Math.random().toString(36).slice(2, 10);
      const sanitizedName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `change-requests/${ctx.user.id}/${Date.now()}-${suffix}-${sanitizedName}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      const [inserted] = await db.insert(changeRequestAttachments).values({
        filename: input.filename,
        fileKey,
        url,
        mimeType: input.mimeType,
        size: buffer.length,
        uploadedById: ctx.user.id,
      });

      return {
        id: inserted.insertId,
        filename: input.filename,
        url,
        mimeType: input.mimeType,
        size: buffer.length,
      };
    }),

  /**
   * Link pre-uploaded attachments to a change request after creation.
   */
  linkAttachments: moderatorProcedure
    .input(z.object({
      changeRequestId: z.number(),
      attachmentIds: z.array(z.number()).max(MAX_ATTACHMENTS_PER_REQUEST),
    }))
    .mutation(async ({ ctx, input }) => {
      const { changeRequestAttachments } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
      const { eq, and, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      for (const attachmentId of input.attachmentIds) {
        await db.update(changeRequestAttachments)
          .set({ changeRequestId: input.changeRequestId })
          .where(
            and(
              eq(changeRequestAttachments.id, attachmentId),
              eq(changeRequestAttachments.uploadedById, ctx.user.id),
              isNull(changeRequestAttachments.changeRequestId),
            )
          );
      }

      return { linked: input.attachmentIds.length };
    }),

  /**
   * Get attachments for a specific change request.
   */
  getAttachments: moderatorProcedure
    .input(z.object({ changeRequestId: z.number() }))
    .query(async ({ input }) => {
      const { changeRequestAttachments } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const attachments = await db.select()
        .from(changeRequestAttachments)
        .where(eq(changeRequestAttachments.changeRequestId, input.changeRequestId));

      return attachments;
    }),
});
