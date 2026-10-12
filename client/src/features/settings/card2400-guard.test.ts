import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";
import { profileRouter } from "../../../../server/routes/profile";
import { avatarUploadPayload } from "./sections/ProfileSection";

/**
 * #2400 — THE AVATAR UPLOAD STOPS SENDING `fileSize`, AND THE SCHEMA STOPS
 * ACCEPTING IT. Both steps of the card, in the order its removal contract
 * demands and in two commits.
 *
 * The server has measured the picture from its own decoded bytes since #2378
 * and ignores a client-declared size. Under CLAUDE.md invariant 4's removal
 * contract the client stops sending the field FIRST (step 1, #2424) and the
 * schema keeps accepting it for one full deploy, because this object is
 * `.strict()` — an unknown key is a `BAD_REQUEST`, so dropping the field while
 * an open tab's bundle still sent it would refuse somebody's upload.
 *
 * **Step 2 landed once that was read at the artifacts** (#2424's squash
 * `1032c939` an ancestor of the serving production build `ce094eca6`, 19
 * first-parent deploys since, no sender left anywhere in `client/` or
 * `shared/`), and the arms below moved with it: the acceptance arm became a
 * REFUSAL arm, which is the behaviour change the second commit actually makes.
 *
 * The arms drive the real payload builder and parse its output through the
 * real `profile.uploadAvatar` input parser, so what the server takes is proven
 * on the object, not on a constant beside it.
 */

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SECTION = join(HERE, "sections", "ProfileSection.tsx");

const COMPRESSED = { base64: "AAAA", mimeType: "image/jpeg", size: 3 };

function pictureInput(name: "uploadAvatar" | "uploadBanner") {
  const procedure = (profileRouter as unknown as Record<string, any>)._def.procedures[name];
  const inputs = procedure._def.inputs as Array<{ safeParse: (input: unknown) => { success: boolean } }>;
  if (inputs?.length !== 1) throw new Error(`${name} should declare exactly one input parser`);
  return inputs[0]!;
}

const uploadAvatarInput = () => pictureInput("uploadAvatar");

describe("card 2400 — the avatar upload sends only the picture and its type", () => {
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

describe("card 2400 step 2 — the schema no longer accepts the size it never read", () => {
  /*
    ⚠ **BOTH UPLOADS, because both are built by `profilePictureInput` and a
    guard naming only the avatar would pass while the banner kept the field.**
    The card and its step-1 guard are written about the avatar — the shared
    factory is what makes the banner part of the change without anything saying
    so, which is the shape worth an arm rather than a sentence.
  */
  const PICTURE = { base64Data: "AAAA", mimeType: "image/jpeg" } as const;

  for (const name of ["uploadAvatar", "uploadBanner"] as const) {
    it(`${name} refuses a request carrying fileSize`, () => {
      expect(pictureInput(name).safeParse({ ...PICTURE, fileSize: 3 }).success).toBe(false);
    });

    it(`${name} still accepts the picture and its type — the arm that proves the refusal is about the KEY`, () => {
      expect(pictureInput(name).safeParse(PICTURE).success).toBe(true);
    });
  }

  it("⚠ the field is gone from the declaration, not merely unreachable through one procedure", () => {
    const route = withoutComments(
      readFileSync(join(HERE, "..", "..", "..", "..", "server", "routes", "profile.ts"), "utf8"),
    );
    expect(route).not.toMatch(/fileSize/);
    /* The refusal above is only meaningful while the object stays strict: drop
       `.strict()` and an unknown key goes back to being silently ignored, which
       passes nothing here but changes what the server accepts. */
    expect(route).toMatch(/mimeType: z\.enum\(PROFILE_PICTURE_TYPES\),\s*\}\)\.strict\(\);/);
  });
});
