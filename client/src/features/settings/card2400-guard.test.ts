import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { profileRouter } from "../../../../server/routes/profile";
import { avatarUploadPayload } from "./sections/ProfileSection";

/**
 * #2400 step 1 — the avatar upload stops sending `fileSize`.
 *
 * The server has measured the picture from its own decoded bytes since #2378
 * and ignores a client-declared size. Under CLAUDE.md invariant 4's removal
 * contract the client stops sending the field FIRST; the server schema keeps
 * accepting it for one full deploy, and dropping it is a later card.
 *
 * The arms drive the real payload builder and parse its output through the
 * real `profile.uploadAvatar` input parser, so "the server still takes what the
 * client sends" is proven on the object, not on a constant beside it.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SECTION = join(HERE, "sections", "ProfileSection.tsx");

const COMPRESSED = { base64: "AAAA", mimeType: "image/jpeg", size: 3 };

function uploadAvatarInput() {
  const procedure = (profileRouter as unknown as Record<string, any>)._def.procedures.uploadAvatar;
  const inputs = procedure._def.inputs as Array<{ safeParse: (input: unknown) => { success: boolean } }>;
  if (inputs?.length !== 1) throw new Error("uploadAvatar should declare exactly one input parser");
  return inputs[0]!;
}

describe("#2400 — the avatar upload sends only the picture and its type", () => {
  it("the payload carries the picture and its type, and no size", () => {
    expect(avatarUploadPayload(COMPRESSED)).toEqual({
      base64Data: "AAAA",
      mimeType: "image/jpeg",
    });
    expect(Object.keys(avatarUploadPayload(COMPRESSED))).not.toContain("fileSize");
  });

  it("the real uploadAvatar parser accepts exactly what the client now sends", () => {
    expect(uploadAvatarInput().safeParse(avatarUploadPayload(COMPRESSED)).success).toBe(true);
  });

  it("negative control: the strict parser does refuse a key it does not know", () => {
    // Proves the acceptance arm above can fail: the schema is strict, so an
    // unknown key is a rejection rather than a silent drop.
    expect(
      uploadAvatarInput().safeParse({ ...avatarUploadPayload(COMPRESSED), notAField: 1 }).success,
    ).toBe(false);
  });

  it("the upload sends the builder's payload, not an inline object", () => {
    const code = withoutComments(readFileSync(SECTION, "utf8"));
    expect(code).toMatch(/uploadAvatar\.mutateAsync\(avatarUploadPayload\(compressed\)\)/);
    expect(code).not.toMatch(/fileSize/);
  });
});
