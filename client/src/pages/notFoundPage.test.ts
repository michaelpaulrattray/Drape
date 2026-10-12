/**
 * ⚠ A WRONG ADDRESS LOOKS LIKE KLIEG AND LEADS BACK INTO IT (#2380).
 *
 * The 404 was the scaffold's template: a slate gradient, a pulsing red icon, a
 * blue button drawn in fixed colours that ignored the theme, and "Go Home" to
 * the marketing `/` for everyone — so a signed-in customer who mistyped a link
 * was sent out of the product. These arms drive the real `NotFoundView` and
 * `notFoundHomeHref` and read the element tree they return; component
 * RENDERING is outside `pnpm test`, but a function component is an ordinary
 * function and its return value is plain data.
 */
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ERROR_PAGE_HOME_HREF } from "@/components/ErrorBoundary";
import { NOT_FOUND_VISITOR_HOME_HREF, NotFoundView, notFoundHomeHref } from "./NotFound";

/** Every string in an element tree; `visit` sees every element's props. */
function walk(node: ReactNode, visit: (props: Record<string, unknown>) => void): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap((child) => walk(child, visit));
  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    visit(props);
    return walk(props.children as ReactNode, visit);
  }
  return [];
}

function page(onGoHome: () => void = () => {}) {
  const tree = NotFoundView({ onGoHome });
  const classes: string[] = [];
  const buttons: { label: string; onClick: () => void }[] = [];
  const text = walk(tree, (props) => {
    if (typeof props.className === "string") classes.push(props.className);
    if (typeof props.onClick === "function") {
      buttons.push({
        label: walk(props.children as ReactNode, () => {}).join(""),
        onClick: props.onClick as () => void,
      });
    }
  }).join(" ");
  return { text, classes: classes.join(" "), buttons };
}

describe("⚠ the 404's way home (#2380)", () => {
  it("a signed-in customer goes to the lobby — the same home the crash page uses", () => {
    expect(notFoundHomeHref({ loading: false, isAuthenticated: true })).toBe(ERROR_PAGE_HOME_HREF);
    expect(ERROR_PAGE_HOME_HREF).toBe("/app");
  });

  it("a visitor the session check has settled as signed out goes to the landing page", () => {
    expect(notFoundHomeHref({ loading: false, isAuthenticated: false })).toBe(NOT_FOUND_VISITOR_HOME_HREF);
    expect(NOT_FOUND_VISITOR_HOME_HREF).toBe("/");
  });

  it("while the session check is still out, the lobby — its guard sends a visitor to sign in", () => {
    expect(notFoundHomeHref({ loading: true, isAuthenticated: false })).toBe("/app");
  });

  it("the page has exactly one button, Go to Home, and it is the one that goes home", () => {
    const onGoHome = vi.fn();
    const { buttons } = page(onGoHome);
    expect(buttons.map((b) => b.label)).toEqual(["Go to Home"]);
    buttons[0].onClick();
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});

describe("⚠ the 404 is drawn from the app's tokens (#2380)", () => {
  it("positive control: the reader sees the page's own sentence and token classes", () => {
    const { text, classes } = page();
    expect(text).toContain("There is no page at this address.");
    expect(classes).toContain("bg-background");
    expect(classes).toContain("text-foreground");
  });

  it("carries no fixed palette colour, gradient or pulse — nothing that ignores the theme", () => {
    const { classes } = page();
    expect(classes).not.toMatch(
      /\b(?:bg|text|from|to|via|border|ring|shadow)-(?:slate|gray|zinc|neutral|stone|red|blue|white|black)\b/,
    );
    expect(classes).not.toMatch(/\bbg-gradient|\banimate-pulse\b/);
  });

  it("names no technology and no status code on the page a customer must walk", () => {
    const { text } = page();
    const lower = text.toLowerCase();
    for (const word of ["404", "error", "not found", "route", "undefined"]) {
      expect(lower).not.toContain(word);
    }
  });
});
