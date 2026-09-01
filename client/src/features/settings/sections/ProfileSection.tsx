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
 * - **`Remove` HAS a server now — #387 item 5.** It shipped as a stub because
 *   `server/routes/profile.ts` had `uploadAvatar` and `uploadBanner` and no
 *   removal of either; he asked for the other half: *"next to profile image
 *   where it says remove code that in so that if you remove it goes to a
 *   default profile image."* `profile.removeAvatar` clears the row and deletes
 *   the object, and the picture falls back to the SAME default a new account
 *   gets — `getProfileVisualDefaults(identity).avatar`, not a blank.
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
import { Button, Field, Input } from "@/foundation";
import { ProfileAvatar } from "@/features/profile/ProfileVisual";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { compressImage, AVATAR_COMPRESSION } from "@/lib/imageUtils";
import { WORKSPACE_NAME } from "@/foundation/brand";
import { INK_DESIGN_FORMATS, inkDesignContentType } from "@shared/pictureFormats";
import { PROFILE_DISPLAY_NAME_MAX_LENGTH } from "@shared/inputLimits";

import { SettingsField, SettingsGroup } from "../parts";

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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || profile.name || "");
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

  const removeAvatar = trpc.profile.removeAvatar.useMutation({
    onSuccess: () => {
      /* The parent holds the displayed avatar, so it is told rather than left
         to re-read: "" is the absence the chip already understands. */
      onAvatarChange("");
      void refetch();
    },
    onError: (error) => {
      logRawFailure("profile.removeAvatar", error);
      toast.error(readableFailure(error, "That picture could not be removed."));
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
            {/*
              Only offered when there IS one to remove — a Remove beside a
              default picture is a control with nothing to do, and the default
              is what removing lands on.

              ⚠ **IT ASKS THE SERVER, NOT THE `avatarUrl` PROP**, and that is
              working law 4 rather than fussiness. The prop is filled by two
              different hosts: `AppChrome` resolves it
              (`profileImage ?? user?.avatarUrl ?? null`) while `DrapeStudio`
              passes a session-local `useState(null)`. So on the legacy studio
              the prop is null for somebody who HAS a picture, and a Remove
              gated on it would have been invisible to exactly the person who
              wanted it. `profile.get` is the one thing that knows.
            */}
            {profile?.avatarUrl ? (
              <Button
                variant="secondary"
                size="small"
                disabled={removeAvatar.isPending}
                onClick={() => removeAvatar.mutate()}
              >
                {removeAvatar.isPending ? "Removing…" : "Remove"}
              </Button>
            ) : null}
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
        ⚠ **BIO IS GONE ON HIS WORD — #387 item 5, verbatim: *"remove the bio
        line from profile its not required."***

        It was kept here deliberately once, and the argument is worth keeping
        because it says exactly what this change does and does not do: a bio IS
        read elsewhere — it is in the customer's own GDPR export
        (`server/db/gdprExport.ts`) and on the admin user view
        (`server/db/admin.ts`) — so removing the only editor is a capability
        loss rather than a tidy-up.

        He has ruled, so the FIELD goes. **Nothing else does**: `users.bio`
        stays, `profile.update` still accepts it, and every bio already written
        is still in its owner's export. This removes a control, not a customer's
        words — which is the same line the bug-report inbox draws, and it is the
        reversible half if he wants the field back.
      */}
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
