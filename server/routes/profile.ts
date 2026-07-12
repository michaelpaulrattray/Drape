import { protectedProcedure, router } from "../_core/trpc";
import { getUserById, updateUserProfile, getUserStorageInfo, updateUserStorageUsed, markCanvasIntroSeen } from "../db";
import { storagePut, storageDelete } from "../storage";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("routes/profile");

export const profileRouter = router({
  // Get current user's full profile
  get: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return {
      id: user.id,
      openId: user.openId,
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      role: user.role,
      storageUsed: user.storageUsed,
      storageLimit: user.storageLimit,
      createdAt: user.createdAt,
    };
  }),

  // Update profile fields (displayName, bio)
  update: protectedProcedure
    .input(z.object({
      displayName: z.string().max(100).optional(),
      bio: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await updateUserProfile(ctx.user.id, {
        displayName: input.displayName,
        bio: input.bio,
      });
      
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to update profile",
        });
      }
      
      return { success: true };
    }),

  // D-9 first-run intro: permanent dismissal (any board interaction fires it)
  markCanvasIntroSeen: protectedProcedure.mutation(async ({ ctx }) => {
    await markCanvasIntroSeen(ctx.user.id);
    return { success: true };
  }),

  // Upload avatar image
  uploadAvatar: protectedProcedure
    .input(z.object({
      base64Data: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      fileSize: z.number().max(5 * 1024 * 1024, "File size must be under 5MB"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check storage limit
      const storageInfo = await getUserStorageInfo(ctx.user.id);
      if (storageInfo && storageInfo.used + input.fileSize > storageInfo.limit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Storage limit exceeded. Please delete some files or upgrade your plan.",
        });
      }

      // Get current user to check for existing avatar
      const user = await getUserById(ctx.user.id);
      const oldAvatarKey = user?.avatarKey;

      // Generate unique key
      const ext = input.mimeType.split("/")[1];
      const key = `avatars/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      // Convert base64 to buffer
      const buffer = Buffer.from(input.base64Data, "base64");
      
      // Upload to S3
      const { url } = await storagePut(key, buffer, input.mimeType);
      
      // Update user profile with new avatar
      await updateUserProfile(ctx.user.id, {
        avatarUrl: url,
        avatarKey: key,
      });

      // Update storage used
      await updateUserStorageUsed(ctx.user.id, input.fileSize);

      // Delete old avatar from S3 if exists
      if (oldAvatarKey) {
        try {
          await storageDelete(oldAvatarKey);
          // Subtract old file size (estimate ~100KB for avatars)
          await updateUserStorageUsed(ctx.user.id, -100 * 1024);
        } catch (e) {
          log.warn({ err: e }, "Failed to delete old avatar:");
        }
      }

      return { success: true, avatarUrl: url };
    }),

  // Upload banner image
  uploadBanner: protectedProcedure
    .input(z.object({
      base64Data: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      fileSize: z.number().max(10 * 1024 * 1024, "File size must be under 10MB"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check storage limit
      const storageInfo = await getUserStorageInfo(ctx.user.id);
      if (storageInfo && storageInfo.used + input.fileSize > storageInfo.limit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Storage limit exceeded. Please delete some files or upgrade your plan.",
        });
      }

      // Get current user to check for existing banner
      const user = await getUserById(ctx.user.id);
      const oldBannerKey = user?.bannerKey;

      // Generate unique key
      const ext = input.mimeType.split("/")[1];
      const key = `banners/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      // Convert base64 to buffer
      const buffer = Buffer.from(input.base64Data, "base64");
      
      // Upload to S3
      const { url } = await storagePut(key, buffer, input.mimeType);
      
      // Update user profile with new banner
      await updateUserProfile(ctx.user.id, {
        bannerUrl: url,
        bannerKey: key,
      });

      // Update storage used
      await updateUserStorageUsed(ctx.user.id, input.fileSize);

      // Delete old banner from S3 if exists
      if (oldBannerKey) {
        try {
          await storageDelete(oldBannerKey);
          // Subtract old file size (estimate ~500KB for banners)
          await updateUserStorageUsed(ctx.user.id, -500 * 1024);
        } catch (e) {
          log.warn({ err: e }, "Failed to delete old banner:");
        }
      }

      return { success: true, bannerUrl: url };
    }),

  // Get storage usage info
  storageInfo: protectedProcedure.query(async ({ ctx }) => {
    const info = await getUserStorageInfo(ctx.user.id);
    if (!info) {
      return { used: 0, limit: 500 * 1024 * 1024, percentage: 0 };
    }
    return {
      used: info.used,
      limit: info.limit,
      percentage: Math.round((info.used / info.limit) * 100),
    };
  }),
});
