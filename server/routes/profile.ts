import { protectedProcedure, router } from "../_core/trpc";
import { randomUUID } from "node:crypto";
import { getUserById, updateUserProfile, getUserStorageInfo, updateUserStorageUsed, markCanvasIntroSeen, markFollowHintSeen } from "../db";
import { storagePut, storageDelete, storageReadBytes } from "../storage";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
import { PROFILE_BIO_MAX_LENGTH, PROFILE_DISPLAY_NAME_MAX_LENGTH } from "../../shared/inputLimits";
import { supportedImageMime } from "../security/trustedImageFetch";
const log = createModuleLogger("routes/profile");

/**
 * THE PROFILE PICTURE AND BANNER ARE MEASURED FROM THE BYTES THE SERVER
 * RECEIVES, NEVER FROM WHAT THE BROWSER SAYS ABOUT THEM (#2378, the audit's M2).
 *
 * Both uploads used to check their 5 MB / 10 MB cap AND the storage meter
 * against a `fileSize` number the request carried, and trusted the declared
 * type: `fileSize: 1` stored ~11 MB and moved the meter one byte, a negative
 * figure LOWERED the meter, and any bytes at all could be parked in the public
 * bucket under an image content type. Now:
 *
 * - the base64 STRING is capped at the length that can decode to the cap, so
 *   an oversized body is refused before it is decoded;
 * - the payload must be canonical base64 (a round trip reproduces it), so the
 *   decoder cannot silently drop characters and store something else;
 * - the cap and the meter both read `bytes.length` of the DECODED buffer;
 * - the magic bytes must say the type the request declared — the same reader
 *   (`supportedImageMime`) every evidence path already uses, not a second one.
 *
 * ⚠ **`fileSize` IS GONE FROM THE SCHEMA — #2400 step 2, 2026-10-12.** It was
 * ACCEPTED and IGNORED for exactly as long as the removal contract (CLAUDE.md
 * invariant 4) requires: *a strict input field is removed only after clients
 * have stopped sending it for one full deploy, never in the commit that stops
 * sending it.* The contract is not a waiting period for its own sake — this
 * object is `.strict()`, so an unknown key is a `BAD_REQUEST` rather than a
 * silent drop, and removing the field while a bundle in somebody's open tab
 * still sent it would refuse their upload.
 *
 * **Read at the artifacts before this landed, not argued from the dates:** step
 * 1 (#2424, squash `1032c939`) is an ancestor of the SERVING production build
 * `ce094eca6` — read at `/api/health` on a 480-second uptime, so a new process
 * and not the old one passing as new — with **19 first-parent commits, each of
 * them a deploy, since it merged**; and `git grep fileSize` over `client/` and
 * `shared/` on `main` returns the step-1 guard and nothing else, so **no code
 * anywhere sends the field** to either upload.
 */
const PROFILE_PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ProfilePictureType = (typeof PROFILE_PICTURE_TYPES)[number];

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const BANNER_MAX_BYTES = 10 * 1024 * 1024;

const AVATAR_TOO_LARGE = "That picture is over 5 MB.";
const BANNER_TOO_LARGE = "That banner is over 10 MB.";
const NOT_A_PICTURE = "That file is not a JPG, PNG or WebP picture.";

/** The longest base64 string that can decode to `maxBytes`. */
function base64LengthFor(maxBytes: number): number {
  return Math.ceil(maxBytes / 3) * 4;
}

function profilePictureInput(maxBytes: number, tooLarge: string) {
  return z.object({
    base64Data: z.string().max(base64LengthFor(maxBytes), tooLarge),
    mimeType: z.enum(PROFILE_PICTURE_TYPES),
  }).strict();
}

function refuse(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/**
 * Decode, size and identify an uploaded profile picture. Returns the bytes
 * that will be stored, so the size the meter is charged IS the size stored.
 */
function decodeProfilePicture(input: {
  base64Data: string;
  declaredMime: ProfilePictureType;
  maxBytes: number;
  tooLarge: string;
}): Buffer {
  const payload = input.base64Data;
  if (payload.length > base64LengthFor(input.maxBytes)) refuse(input.tooLarge);
  if (
    payload.length === 0
    || payload.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)
  ) {
    refuse(NOT_A_PICTURE);
  }
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== payload) refuse(NOT_A_PICTURE);
  if (bytes.length > input.maxBytes) refuse(input.tooLarge);
  if (supportedImageMime(bytes) !== input.declaredMime) refuse(NOT_A_PICTURE);
  return bytes;
}

/**
 * Delete the picture a new upload replaced, and give back its REAL size.
 *
 * The replace paths used to subtract a flat 100 KB (avatar) / 500 KB (banner)
 * guess, so the meter drifted on every honest replace. This is the same
 * read-then-delete `removeAvatar` already does. A failed read costs the
 * accounting (nothing is subtracted, the meter over-counts), never the upload.
 */
async function releaseReplacedPicture(
  userId: number,
  oldKey: string,
  what: "avatar" | "banner",
): Promise<void> {
  let freed = 0;
  try {
    freed = (await storageReadBytes(oldKey)).bytes.length;
  } catch (e) {
    log.warn({ err: e }, `Could not size the old ${what} before deleting it`);
  }
  try {
    const deleted = await storageDelete(oldKey);
    if (deleted.success) {
      if (freed > 0) await updateUserStorageUsed(userId, -freed);
    } else {
      log.warn(
        { errorCode: deleted.errorCode, retryable: deleted.retryable },
        `Failed to delete old ${what}`,
      );
    }
  } catch (e) {
    log.warn({ err: e }, `Failed to delete old ${what}:`);
  }
}

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
      displayName: z.string().max(PROFILE_DISPLAY_NAME_MAX_LENGTH).optional(),
      bio: z.string().max(PROFILE_BIO_MAX_LENGTH).optional(),
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

  /**
   * The Follow hint on the sheet (#1909): permanent dismissal, fired by the
   * FIRST Keep rather than by the dismissal, so the line can never appear a
   * second time on a second device.
   *
   * ⚠ No input, deliberately — invariant 3 (`userId` comes from `ctx.user.id`,
   * never from procedure input), and there is nothing else to say: this flag
   * only ever goes one way.
   */
  markFollowHintSeen: protectedProcedure.mutation(async ({ ctx }) => {
    await markFollowHintSeen(ctx.user.id);
    return { success: true };
  }),

  // Upload avatar image
  uploadAvatar: protectedProcedure
    .input(profilePictureInput(AVATAR_MAX_BYTES, AVATAR_TOO_LARGE))
    .mutation(async ({ ctx, input }) => {
      const buffer = decodeProfilePicture({
        base64Data: input.base64Data,
        declaredMime: input.mimeType,
        maxBytes: AVATAR_MAX_BYTES,
        tooLarge: AVATAR_TOO_LARGE,
      });

      // Check storage limit against the bytes that will actually be stored
      const storageInfo = await getUserStorageInfo(ctx.user.id);
      if (storageInfo && storageInfo.used + buffer.length > storageInfo.limit) {
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
      const key = `avatars/${ctx.user.id}/${Date.now()}-${randomUUID()}.${ext}`;

      // Upload to S3
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Update user profile with new avatar
      await updateUserProfile(ctx.user.id, {
        avatarUrl: url,
        avatarKey: key,
      });

      // Update storage used, from the decoded bytes
      await updateUserStorageUsed(ctx.user.id, buffer.length);

      // Delete the replaced avatar and give back its real size
      if (oldAvatarKey) await releaseReplacedPicture(ctx.user.id, oldAvatarKey, "avatar");

      return { success: true, avatarUrl: url };
    }),

  /**
   * REMOVE THE PROFILE PICTURE — #387 item 5, his words: *"next to profile
   * image where it says remove code that in so that if you remove it goes to a
   * default profile image."*
   *
   * `Remove` shipped as a stub because there was no server for it. There is
   * now, and three things about its shape are deliberate:
   *
   * - **The row is cleared BEFORE the object is deleted.** The customer's
   *   action must land even if R2 is unhappy; the other order leaves a row
   *   pointing at bytes that are gone, which is the failure that shows.
   * - **The default is not a blank.** Clearing `avatarUrl` puts
   *   `ProfileAvatar` back on `getProfileVisualDefaults(identity).avatar` —
   *   the SAME default a brand-new account gets, which is what he asked for.
   * - **The owner is in the writing statement** (invariant 1):
   *   `updateUserProfile` scopes on `users.id = userId` and `userId` is
   *   `ctx.user.id`, never input (invariant 3).
   *
   * ⚠ The storage figure is the object's REAL length — and since #2378 the
   * replace paths in `uploadAvatar` / `uploadBanner` give back the real length
   * too (`releaseReplacedPicture`), where they used to subtract a flat guess. An avatar is one
   * small client-compressed object, so reading it to learn its size is cheap
   * and true; a failed read costs the accounting, never the removal.
   */
  removeAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const oldKey = user.avatarKey;
    if (!user.avatarUrl && !oldKey) {
      /* Already on the default. Idempotent rather than an error — a second
         click on a slow connection is not a failure. */
      return { success: true };
    }

    const cleared = await updateUserProfile(ctx.user.id, {
      avatarUrl: null,
      avatarKey: null,
    });
    if (!cleared.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: cleared.error || "Failed to remove the picture",
      });
    }

    if (oldKey) {
      let freed = 0;
      try {
        freed = (await storageReadBytes(oldKey)).bytes.length;
      } catch (e) {
        log.warn({ err: e }, "Could not size the old avatar before deleting it");
      }
      try {
        const deleted = await storageDelete(oldKey);
        if (deleted.success) {
          if (freed > 0) await updateUserStorageUsed(ctx.user.id, -freed);
        } else {
          log.warn(
            { errorCode: deleted.errorCode, retryable: deleted.retryable },
            "Failed to delete removed avatar",
          );
        }
      } catch (e) {
        log.warn({ err: e }, "Failed to delete removed avatar:");
      }
    }

    return { success: true };
  }),

  // Upload banner image
  uploadBanner: protectedProcedure
    .input(profilePictureInput(BANNER_MAX_BYTES, BANNER_TOO_LARGE))
    .mutation(async ({ ctx, input }) => {
      const buffer = decodeProfilePicture({
        base64Data: input.base64Data,
        declaredMime: input.mimeType,
        maxBytes: BANNER_MAX_BYTES,
        tooLarge: BANNER_TOO_LARGE,
      });

      // Check storage limit against the bytes that will actually be stored
      const storageInfo = await getUserStorageInfo(ctx.user.id);
      if (storageInfo && storageInfo.used + buffer.length > storageInfo.limit) {
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
      const key = `banners/${ctx.user.id}/${Date.now()}-${randomUUID()}.${ext}`;

      // Upload to S3
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Update user profile with new banner
      await updateUserProfile(ctx.user.id, {
        bannerUrl: url,
        bannerKey: key,
      });

      // Update storage used, from the decoded bytes
      await updateUserStorageUsed(ctx.user.id, buffer.length);

      // Delete the replaced banner and give back its real size
      if (oldBannerKey) await releaseReplacedPicture(ctx.user.id, oldBannerKey, "banner");

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
