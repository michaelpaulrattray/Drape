/**
 * appRoutes — pins the entrances App.tsx must keep answering.
 *
 * #68: the founder typed /admin from the lobby and met a 404, because every
 * admin page lives one segment deeper and the bare address had no route.
 * The redirect is the fix; this suite is what stops a route reshuffle from
 * silently reopening that dead end.
 *
 * Reads are newline-normalized on purpose: these assertions are about tokens
 * on one line, and a CRLF working copy (issue #71) must not fail them.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  resolve(__dirname, "App.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("App routes — the admin entrance (#68)", () => {
  it("routes the bare /admin address", () => {
    expect(appSource).toContain('<Route path="/admin">');
  });

  it("redirects it to the overview, replacing the history entry", () => {
    expect(appSource).toContain('<Redirect to="/admin/overview" replace />');
  });

  it("still holds the real admin pages one segment deeper", () => {
    expect(appSource).toContain('<Route path="/admin/overview"');
    expect(appSource).toContain('<Route path="/admin/users"');
  });
});
