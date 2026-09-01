/**
 * Settings → Profile (brief §5).
 *
 * The one section where most of what the brief draws has a server behind it:
 * `profile.update` takes the display name and `profile.uploadAvatar` takes the
 * picture, both unchanged — §1 excludes what the mutations DO, and nothing here
 * touches them.
 *
 * ## What the reconciliation changed (BRIEF-RECONCILIATION Q3, Q4)
 *
 * - **`Remove` has no server.** `server/routes/profile.ts` has `uploadAvatar`
 *   and `uploadBanner` and no removal of either, so Remove ships as a stub
 *   rather than as a button that silently does nothing.
 * - **`Workspace name` has no server.** There is no workspace, team or
 *   organisation row anywhere in `drizzle/schema.ts`; the name in the top bar
 *   is the workspace's own (`WORKSPACE_NAME`). The field is drawn and inert, and
 *   the note says which name it is going to be — read from the SAME constant
 *   the modal header reads, which is #381's actual finding.
 * - **`Changes save as you edit` is a promise the footer makes, so this section
 *   keeps it** — the display name commits on blur rather than on a Save button
 *   the brief forbids (§10).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Field, Input } from "@/foundation";
import { ProfileAvatar } from "@/features/profile/ProfileVisual";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { compressImage, AVATAR_COMPRESSION } from "@/lib/imageUtils";
import { WORKSPACE_NAME } from "@/foundation/brand";
import { INK_DESIGN_FORMATS, inkDesignContentType } from "@shared/pictureFormats";
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
} from "@shared/inputLimits";

import { SettingsField, SettingsGroup, StubControl, StubNote } from "../parts";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The format vocabulary is IMPORTED, never typed — `shared/pictureFormats.ts`
 * owns it for both sides, and `server/clientInputCaps.test.ts` bans the second
 * copy. Its failure mode is the quiet one: a fourth format added at the door
 * and missed here does not error, the picker just filters the customer's file
 * away and nothing says why.
 */
const AVATAR_TYPES = INK_DESIGN_FORMATS.map(inkDesignContentType);
const AVATAR_ACCEPT = AVATAR_TYPES.join(",");

export function ProfileSection({
  user,
  avatarUrl,
  onAvatarChange,
}: {
  user: { name?: string | null; email?: string | null } | null;
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
}) {
  const { data: profile, refetch } = trpc.profile.get.useQuery();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || profile.name || "");
    setBio(profile.bio || "");
  }, [profile]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      void refetch();
    },
    onError: (error) => {
      logRawFailure("profile.update", error);
      toast.error(readableFailure(error, "That change could not be saved."));
    },
  });

  const uploadAvatar = trpc.profile.uploadAvatar.useMutation({
    onSuccess: (result) => {
      if (result?.avatarUrl) onAvatarChange(result.avatarUrl);
      void refetch();
    },
    onError: (error) => {
      logRawFailure("profile.uploadAvatar", error);
      toast.error(readableFailure(error, "That picture could not be uploaded."));
    },
  });

  /* Commit on blur — the footer says changes save as you edit, and a Save
     button is on the brief's do-not list. */
  const commitName = () => {
    const next = displayName.trim();
    const current = profile?.displayName || profile?.name || "";
    if (!next || next === current) return;
    updateProfile.mutate({ displayName: next });
  };

  const commitBio = () => {
    const next = bio.trim();
    if (next === (profile?.bio || "")) return;
    updateProfile.mutate({ bio: next });
  };

  const pickAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("That picture is over 5 MB.");
      return;
    }
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Pictures must be JPG, PNG or WebP.");
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(
        file,
        AVATAR_COMPRESSION.maxWidth,
        AVATAR_COMPRESSION.maxHeight,
        AVATAR_COMPRESSION.quality,
      );
      await uploadAvatar.mutateAsync({
        base64Data: compressed.base64,
        mimeType: compressed.mimeType as "image/jpeg" | "image/png" | "image/webp",
        fileSize: compressed.size,
      });
    } catch {
      /* The mutation's own onError already spoke. */
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <SettingsGroup title="Profile">
      {/*
        The prototype's avatar block (#381): picture, then the two actions
        BESIDE it, then the constraint line under the actions. There is no
        "Picture" label — the picture is the label — and the constraint line
        belongs under the button it constrains, not opposite it.
      */}
      <div className="dp-set__avatarblock">
        <span className="dp-set__avatar">
          <ProfileAvatar
            src={avatarUrl}
            identity={user ?? "You"}
            alt={user?.name ?? "You"}
            className="w-full h-full object-cover"
          />
        </span>
        <div className="dp-set__avataractions">
          <span className="dp-set__control">
            <label className="dp-btn dp-btn--secondary dp-btn--small" style={{ cursor: "pointer" }}>
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept={AVATAR_ACCEPT}
                onChange={pickAvatar}
                style={{ display: "none" }}
              />
            </label>
            {/* No removal exists on the server — see the docblock. */}
            <StubControl reason="Removing a picture is not built yet">
              <StubNote>REMOVE</StubNote>
            </StubControl>
          </span>
          <span className="dp-set__fieldnote">
            JPG, PNG or WebP · up to 5 MB · square works best
          </span>
        </div>
      </div>

      <SettingsField label="Display name" note="Shown on shared canvases and comments.">
        {/*
          ⚠ `Input` IS A BARE BORDERLESS <input> AND MUST SIT INSIDE `Field`.
          Caught by opening the app: rendered on its own it draws no box at all,
          so the display name read as a right-aligned label and the empty Bio
          row rendered as literally nothing. `foundation.css` says so at
          `.dp-input` — `border: none; background: transparent` — and the focus
          ring is deliberately on the WRAPPER, so a bare Input is also a control
          you cannot see yourself focus.
        */}
        <Field compact className="dp-set__fullfield">
          <Input
            value={displayName}
            maxLength={PROFILE_DISPLAY_NAME_MAX_LENGTH}
            onChange={(event) => setDisplayName(event.target.value)}
            onBlur={commitName}
            aria-label="Display name"
          />
        </Field>
      </SettingsField>

      {/*
        ⚠ **BIO IS NOT IN THE BRIEF’S PROFILE TABLE AND IT IS KEPT ANYWAY**, as a
        deliberate carry-over rather than an addition. The modal this replaces
        was the only place a bio could be written, and unlike the banner (which
        nothing in the product displays and which therefore went) a bio IS read:
        it is in the customer’s own GDPR export (`server/db/gdprExport.ts`) and
        on the admin user view (`server/db/admin.ts`). Deleting the only editor
        for text a customer wrote, while staff and her own export can still see
        it, is a capability loss the brief did not ask for — §8’s own stub rules
        say never stub something that already exists, and this is the same
        instinct one row over.
      */}
      <SettingsField label="Bio" note="A line about you, on your own export and nowhere public.">
        <Field compact className="dp-set__fullfield">
          <Input
            value={bio}
            maxLength={PROFILE_BIO_MAX_LENGTH}
            placeholder="A line about you"
            onChange={(event) => setBio(event.target.value)}
            onBlur={commitBio}
            aria-label="Bio"
          />
        </Field>
      </SettingsField>

      {/*
        §5: *"Email is shown and disabled, not hidden. Hiding it makes people
        think the account has no email; disabling it with a reason answers the
        question they actually have."*
      */}
      <SettingsField
        label="Email"
        note="Contact support to change the address on the account."
      >
        <Field compact className="dp-set__fullfield dp-set__field--off">
          <Input
            value={user?.email ?? profile?.email ?? ""}
            readOnly
            disabled
            aria-label="Email"
          />
        </Field>
      </SettingsField>

      {/*
        ⚠ SHOWN AND DISABLED, exactly as Email is — not a naked stub chip.
        Looked at in the running app (#381): stacked, the chip alone sat where a
        field should be and read as a missing control rather than an inert one.
        His own §5 ruling on Email is the precedent and it applies word for word
        here: *"Hiding it makes people think the account has no email; disabling
        it with a reason answers the question they actually have."* The name in
        the box is the true one — every workspace IS this name today — so the
        field is honest, out of the tab order, and says why on hover.
      */}
      <SettingsField
        label="Workspace name"
        note={`Appears in the top bar and on client shares. Every workspace is ${WORKSPACE_NAME} until workspaces exist.`}
      >
        <Field compact className="dp-set__fullfield dp-set__field--off">
          <Input
            value={WORKSPACE_NAME}
            readOnly
            disabled
            title="Renaming a workspace is not built yet"
            aria-label="Workspace name"
          />
        </Field>
      </SettingsField>
    </SettingsGroup>
  );
}
