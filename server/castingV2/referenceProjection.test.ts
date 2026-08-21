import { describe, expect, it } from "vitest";

import { referencesOf } from "./refineService";

/**
 * THE REFERENCE PROJECTION'S BOUNDARY — three fields, and the rest of the
 * recipe stays inside (his ask 1264 §1; the pinning condition ruled
 * fable-1332 §4).
 *
 * `internalPrompt` is INTERNAL (§J), and this reader is the whole reason it can
 * stay that way while a customer still sees which pictures made her version.
 * What it lifts is `{url, kind, slot}`. What it must never lift is the rest of
 * the recipe the render was sent:
 *
 *   prompt    the composed instruction — the product's own words about her
 *   digest    a byte-identity claim about a stored object
 *   geometry  what was sent to an engine
 *
 * None of the three answers her question, which is *which pictures*.
 *
 * **The shape of this suite is `staffImageBoundary`'s**: a field group stays out
 * BY CONSTRUCTION rather than by callers remembering to omit it, so the guard is
 * on the OBJECT and not on a caller's spread. A fourth field arriving here is a
 * deliberate edit that turns this red.
 */
describe("what a render's references tell the customer, and what they do not", () => {
  /* A recipe in the shape the repaint road actually stores — read off v508 on
     dev, 2026-08-22, rather than invented: master plus one carried ink crop. */
  const storedRecipe = {
    census: { anything: "else" },
    prompt: "Edit this photograph of this exact person, changing ONLY …",
    repaint: {
      edited: ["skin"],
      carried: ["ink:upperArm@left"],
      prompt: "Reference 1 is the photograph of this person — reproduce him exactly …",
      engineId: "fal:openai/gpt-image-2/edit",
      references: [
        {
          key: "casting-v2/candidates/9b846249.png",
          kind: "master",
          slot: null,
          digest: "daee11c1ae6d14482b034abb8f8561572ac655ca2f2182b246a9418a3c9adb6d",
          sentGeometry: "1024x1536",
        },
        {
          key: "casting-v2/ink-delivery/930091c6.png",
          kind: "carry",
          slot: "ink:upperArm@left",
          digest: "62f8f92ebe522bd9767ae524a1cd50f240dbcfd341bd0ddd5c32f8bc1b4483d9",
          sentGeometry: "896x1392",
        },
      ],
    },
  };

  it("gives back one entry per reference, in the order the render was sent them", () => {
    const projected = referencesOf(storedRecipe);
    expect(projected).toHaveLength(2);
    expect(projected[0]!.kind).toBe("master");
    expect(projected[1]!.slot).toBe("ink:upperArm@left");
    /* A url rather than a storage key: the client shows a picture, and a key
       would make every caller build the address a fifth way. */
    expect(projected[0]!.url).toContain("casting-v2/candidates/9b846249.png");
  });

  it("⚠ CARRIES EXACTLY THREE FIELDS AND NO FOURTH", () => {
    /*
      The guard, and it is on the OBJECT. A projection that merely omitted the
      recipe today would be reopened by the first caller who spread an entry —
      which is precisely how `passwordHash` reached `auth.me` and how image URLs
      reached the moderator surface (invariant 8).
    */
    for (const entry of referencesOf(storedRecipe)) {
      expect(Object.keys(entry).sort()).toEqual(["kind", "slot", "url"]);
    }
  });

  it("⚠ NEITHER THE PROMPT, THE DIGEST NOR THE GEOMETRY CAN REACH THE WIRE", () => {
    /*
      Asserted over the SERIALIZED projection rather than field by field, so a
      value smuggled inside one of the three that DO cross — a digest packed
      into a slot, say — is caught by the same arm. The strings are taken from
      the stored recipe above, so this cannot pass by testing for something the
      fixture never contained.
    */
    const wire = JSON.stringify(referencesOf(storedRecipe));
    expect(wire).not.toContain("daee11c1ae6d1448");
    expect(wire).not.toContain("62f8f92ebe522bd9");
    expect(wire).not.toContain("1024x1536");
    expect(wire).not.toContain("896x1392");
    expect(wire).not.toContain("Reference 1 is the photograph");
    expect(wire).not.toContain("Edit this photograph");
    expect(wire).not.toContain("gpt-image-2");
  });

  it("CONTROL — the fixture really does contain all of them", () => {
    /*
      The arm that stops the one above passing over nothing. A guard asserting
      the absence of strings its input never held is the checker that cannot
      fail, and this project has bought that lesson more than once.
    */
    const inside = JSON.stringify(storedRecipe);
    for (const secret of [
      "daee11c1ae6d1448", "62f8f92ebe522bd9", "1024x1536", "896x1392",
      "Reference 1 is the photograph", "Edit this photograph", "gpt-image-2",
    ]) {
      expect(inside, secret).toContain(secret);
    }
  });

  it.each([
    ["a row with no recipe at all — every paste-road render", { prompt: "x" }],
    ["a row from before the recipe was stored", {}],
    ["null", null],
    ["a repaint with no references list", { repaint: { edited: [] } }],
    ["references that are not a list", { repaint: { references: "master" } }],
  ])("answers EMPTY for %s rather than throwing", (_what, stored) => {
    expect(referencesOf(stored)).toEqual([]);
  });

  it("skips a reference with no key rather than showing a broken picture", () => {
    /* A thumbnail with no image is worse than an absent one: it reads as a
       feature that half works. */
    const projected = referencesOf({
      repaint: { references: [{ kind: "carry", slot: "lips" }, { key: "a/b.png", kind: "master" }] },
    });
    expect(projected).toHaveLength(1);
    expect(projected[0]!.kind).toBe("master");
  });
});
