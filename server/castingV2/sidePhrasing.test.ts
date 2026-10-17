import { describe, expect, it } from "vitest";

import { assembleRecipe } from "./recipeAssembler";
import { personSideNamedIn, sideNamedIn } from "./sidePhrasing";

/**
 * #2618 — a side word inside a ONE-PIECE feature's words is the person's side,
 * and the painter is told which half of the picture that is.
 */
describe("the person's side, named inside a one-piece feature", () => {
  it("reads one side, and refuses to read none, both, or an idiom", () => {
    expect(personSideNamedIn("nose piercing in the right nostril")).toBe("right");
    expect(personSideNamedIn("darker on the left side of the lip")).toBe("left");
    expect(personSideNamedIn("bright red")).toBeNull();
    expect(personSideNamedIn("left and right")).toBeNull();
    expect(personSideNamedIn("make it just right")).toBeNull();
    expect(personSideNamedIn("on the left of the picture as you look at it")).toBeNull();
    /* The pair door's reader is unchanged: the idiom guard is this one's alone. */
    expect(sideNamedIn("make it just right")).toBe("right");
  });

  const pronouns = { subject: "she", object: "her", possessive: "her", plural: false } as const;
  const master = { key: "casting-v2/candidates/master.png" };

  it("the description road tells the painter the half too, and the stored facts never carry it", () => {
    const recipe = assembleRecipe({
      master, pronouns, library: [],
      asks: [{ slot: "lips", noun: "lips", words: "darker on the left side of the lip" }],
      currentDescription: "A woman in her thirties with darker colour on the left side of her lip.",
    } as never);
    if (!recipe.ok) throw new Error("expected a recipe");
    expect(recipe.prompt).toContain("The left side named for her lips is on the right of the picture as you look at it.");
    expect(recipe.changeFacts).not.toContain("picture");
  });

  it("the change clause says it after the words, and a paired slot is untouched", () => {
    const recipe = assembleRecipe({
      master, pronouns, library: [],
      asks: [
        { slot: "skin", noun: "skin", words: "a small mole on the right cheek" },
        { slot: "eye@left", noun: "left eye", words: "green" },
      ],
    } as never);
    if (!recipe.ok) throw new Error("expected a recipe");
    expect(recipe.prompt).toContain("a small mole on the right cheek (on the left of the picture as you look at it)");
    expect(recipe.prompt).toContain("her left eye (on the right of the picture as you look at it): green");
  });
});
