/**
 * ⚠ THE PAGE A CRASH LEAVES BEHIND SHOWS NO MACHINERY AND ALWAYS HAS A WAY HOME (#2379).
 *
 * The boundary printed `error.stack` to every visitor and kept its "Go Home"
 * button behind a prop the app's only boundary never passed. These arms drive
 * the real `render()` the way React would after `getDerivedStateFromError`,
 * and read the element tree it returns — component RENDERING is outside
 * `pnpm test` (`vitest.config.ts`), but `render()` is an ordinary method and
 * its return value is plain data. No DOM is needed.
 */
import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary, { ERROR_PAGE_HOME_HREF } from "./ErrorBoundary";

/** A crash whose stack and message carry text no customer may ever see. */
const CRASH = new Error("Rendered more hooks than during the previous render. SECRET_MESSAGE");
CRASH.stack = `${CRASH.message}\n    at RollSheet (/src/features/casting/components/RollSheet.tsx:41:7)`;

/** React hands `getDerivedStateFromError` the thrown error; so does this. */
const deriveFrom = ErrorBoundary.getDerivedStateFromError as (error: unknown) => Record<string, unknown>;

/** Drive the boundary into its crashed state the way React does, then render. */
function crashedPage(): ReactNode {
  const boundary = new ErrorBoundary({ children: "the app" });
  boundary.state = { ...boundary.state, ...deriveFrom(CRASH) };
  return boundary.render();
}

/** Every string anywhere in an element tree, plus every element's props. */
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

function buttons(tree: ReactNode): { label: string; onClick: () => void }[] {
  const found: { label: string; onClick: () => void }[] = [];
  walk(tree, (props) => {
    if (typeof props.onClick === "function") {
      found.push({
        label: walk(props.children as ReactNode, () => {}).join(""),
        onClick: props.onClick as () => void,
      });
    }
  });
  return found;
}

let location: { href: string; reload: ReturnType<typeof vi.fn> };
let restoreWindow: () => void;

beforeEach(() => {
  location = { href: "http://localhost/app/casting", reload: vi.fn() };
  const had = "window" in globalThis;
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { location };
  restoreWindow = () => {
    if (had) (globalThis as { window?: unknown }).window = previous;
    else delete (globalThis as { window?: unknown }).window;
  };
});

afterEach(() => {
  restoreWindow();
});

describe("⚠ the crash page (#2379)", () => {
  it("positive control: with no crash the boundary renders the app itself", () => {
    expect(new ErrorBoundary({ children: "the app" }).render()).toBe("the app");
  });

  it("⚠ prints neither the stack nor the error message, even after a real crash was caught", () => {
    /* The boundary must not even keep the error where render() could reach it. */
    const derived = deriveFrom(CRASH);
    expect(Object.values(derived)).not.toContain(CRASH);

    const text = walk(crashedPage(), () => {}).join(" ");
    /* Negative control on the reader: it does see the page's own words. */
    expect(text).toContain("Something went wrong on this page.");
    expect(text).not.toContain("SECRET_MESSAGE");
    expect(text).not.toMatch(/\bat \w+ \(|\.tsx?:\d+/);
  });

  it("⚠ always offers a way home, and it leads to the lobby rather than the marketing page", () => {
    const home = buttons(crashedPage()).find((b) => b.label === "Go to Home");
    expect(home, "the crash page has a Go to Home button").toBeDefined();
    home!.onClick();
    expect(ERROR_PAGE_HOME_HREF).toBe("/app");
    expect(location.href).toBe("/app");
  });

  it("Try again reloads the page", () => {
    const tryAgain = buttons(crashedPage()).find((b) => b.label === "Try again");
    expect(tryAgain).toBeDefined();
    tryAgain!.onClick();
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it("names no technology on the page a customer must walk", () => {
    const text = walk(crashedPage(), () => {}).join(" ").toLowerCase();
    for (const word of ["error", "stack", "exception", "javascript", "react", "undefined"]) {
      expect(text).not.toContain(word);
    }
  });
});
