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

  /*
    ⚠ AND THE SAME RECIPE WITH A PICTURE SHE ATTACHED — the `source` role, which
    is the only one the chip may show (founder ruling, fable-1419 §2).
  */
  const withSupplied = {
    ...storedRecipe,
    repaint: {
      ...storedRecipe.repaint,
      references: [
        ...storedRecipe.repaint.references,
        {
          key: "casting-v2/reference-attachments/aa11bb22.png",
          kind: "source",
          slot: "hair",
          digest: "11".repeat(32),
          sentGeometry: "512x512",
        },
      ],
    },
  };

  it("⚠ SHOWS ONLY THE PICTURES SHE SUPPLIED — not the master, not our carries", () => {
    /*
      His words: *"the only reference that go into that box are ones you use to
      generate the previous image with … that would ride in this box not her
      horns."* The master and a carried ink crop are MACHINERY — she did not
      attach them, and a chip that lists them turns "replay my ask" into a list
      of our internals.
    */
    const projected = referencesOf(withSupplied);
    expect(projected).toHaveLength(1);
    expect(projected[0]!.kind).toBe("source");
    expect(projected[0]!.slot).toBe("hair");
    expect(projected[0]!.url).toContain("aa11bb22");
  });

  it("shows NOTHING for a render she attached nothing to", () => {
    /* Which is almost every render: the master and the carries rode, she gave
       nothing, and the honest chip is a sentence with no thumbnails. */
    expect(referencesOf(storedRecipe)).toEqual([]);
  });

  it("gives back one entry per SUPPLIED reference, in the order they were sent", () => {
    const two = {
      ...withSupplied,
      repaint: {
        ...withSupplied.repaint,
        references: [
          ...withSupplied.repaint.references,
          {
            key: "casting-v2/reference-attachments/cc33dd44.png",
            kind: "source",
            slot: "ink:neck",
            digest: "22".repeat(32),
            sentGeometry: "512x512",
          },
        ],
      },
    };
    const projected = referencesOf(two);
    expect(projected).toHaveLength(2);
    expect(projected[0]!.slot).toBe("hair");
    expect(projected[1]!.slot).toBe("ink:neck");
    /* A url rather than a storage key: the client shows a picture, and a key
       would make every caller build the address a fifth way. */
    expect(projected[0]!.url).toContain("casting-v2/reference-attachments/aa11bb22.png");
  });

  it("⚠ CARRIES EXACTLY THREE FIELDS AND NO FOURTH", () => {
    /*
      The guard, and it is on the OBJECT. A projection that merely omitted the
      recipe today would be reopened by the first caller who spread an entry —
      which is precisely how `passwordHash` reached `auth.me` and how image URLs
      reached the moderator surface (invariant 8).
    */
    /* ⚠ OVER `withSupplied`, NOT `storedRecipe` — since the founder's chip
       ruling, a recipe with no attached picture projects NOTHING, and a
       for-loop over an empty list is a guard that cannot fail. The same trap
       this file's own CONTROL arm exists to name, arriving through a product
       change rather than through a fixture. */
    const entries = referencesOf(withSupplied);
    expect(entries.length, "the guard must have something to guard").toBeGreaterThan(0);
    for (const entry of entries) {
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
    const projected = referencesOf(withSupplied);
    expect(projected.length, "an absence proven over nothing is not a proof").toBeGreaterThan(0);
    const wire = JSON.stringify(projected);
    expect(wire).not.toContain("11111111111111");
    expect(wire).not.toContain("512x512");
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
    const inside = JSON.stringify(withSupplied);
    for (const secret of [
      "11111111111111", "512x512",
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

  it("skips a SUPPLIED reference with no key rather than showing a broken picture", () => {
    /* A thumbnail with no image is worse than an absent one: it reads as a
       feature that half works. */
    const projected = referencesOf({
      repaint: {
        references: [
          { kind: "source", slot: "hair" },
          { key: "a/b.png", kind: "source", slot: "ink:neck" },
        ],
      },
    });
    expect(projected).toHaveLength(1);
    expect(projected[0]!.slot).toBe("ink:neck");
  });
});
