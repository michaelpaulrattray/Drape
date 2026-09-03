import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brief 11's rules, as assertions rather than as review memory
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/11-staff-dialogs.md`, #436).
 *
 * His §9 is the definition of done. The lines here are the ones a later brief
 * would casually undo without anybody noticing, and the first is the one the
 * card was actually filed about.
 *
 * # ⚠ THE DEFECT THIS EXISTS TO STOP COMING BACK
 *
 * `ChangeRequestModal` carried `max-h-[90vh] overflow-y-auto` on the CARD, so
 * the whole card scrolled and `Submit request` sat below the fold on a
 * fifteen-field form. His framing: *"every modal defect in this product's
 * history was viewport-height dependent and looked correct in a tall window."*
 * A source guard cannot see a window at all — so what it holds is the
 * STRUCTURE that makes the defect impossible: `overflow` on the card is
 * `hidden`, the footer is a sibling of the scrolling body rather than a child
 * of it, and the two strings that say so live in one place.
 *
 * ⚠ **THE POPULATION IS DERIVED, NOT TYPED.** Section 06's guard records why:
 * a hand-written list of staff surfaces shares the blind spot of whoever typed
 * it. Here the population is *every file under `features/admin` and
 * `features/moderator` that mounts a `DialogContent`* — so a sixth staff
 * dialog is measured the moment it exists, without anyone remembering to add
 * it to a list.
 *
 * ⚠ **EVERY ABSENCE ARM IS PAIRED WITH A POSITIVE CONTROL.** An absence arm
 * alone is green when its subject is deleted and green when its own matcher is
 * wrong — both have happened in this repo (working law 2, and the
 * `absence-only expect passes on nothing` finding).
 *
 * **What a source read cannot see**, stated rather than implied: whether
 * `Submit request` is actually reachable at 540px, whether the segmented
 * control fits its column, whether `SelectContent` survives both themes. Those
 * were DRIVEN in the running app and recorded in
 * `docs/specs/STAFF_DIALOGS_436_EVIDENCE.md`.
 */

const HERE = __dirname;
const CLIENT_SRC = path.resolve(HERE, "..", "..");
const ADMIN = path.resolve(CLIENT_SRC, "features/admin");
const MODERATOR = path.resolve(CLIENT_SRC, "features/moderator");

const read = (absolute: string) => fs.readFileSync(absolute, "utf8");

/** Strip comments, so a docblock explaining a rule cannot trip the rule. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function tsxUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * THE POPULATION — every staff file that mounts a dialog.
 *
 * Derived from `<DialogContent`, because that is the element the structural
 * rule is *about*. A file that imports `Dialog` and never mounts content is
 * not a dialog surface, and a sixth one that does is caught the day it lands.
 */
const DIALOG_FILES = [...tsxUnder(ADMIN), ...tsxUnder(MODERATOR)]
  .filter((file) => code(read(file)).includes("<DialogContent"))
  .map((file) => ({ file, rel: path.relative(CLIENT_SRC, file).replace(/\\/g, "/"), src: read(file) }));

const GRAMMAR = read(path.resolve(HERE, "staffDialog.tsx"));
const MODALS_CSS = read(path.resolve(CLIENT_SRC, "foundation/modals.css"));

/** The two shared shell strings, read from the grammar rather than retyped. */
const CONTENT_CLASSES = /STAFF_DIALOG_CONTENT\s*=\s*\n?\s*"([^"]+)"/.exec(GRAMMAR)?.[1] ?? "";
const BODY_CLASSES = /STAFF_DIALOG_BODY\s*=\s*\n?\s*"([^"]+)"/.exec(GRAMMAR)?.[1] ?? "";

describe("brief 11 — the population is real", () => {
  it("finds the four staff dialog files the brief names", () => {
    const names = DIALOG_FILES.map((d) => d.rel).sort();
    expect(names, `derived population: ${names.join(", ")}`).toEqual([
      "features/admin/AuditActionModals.tsx",
      "features/admin/ReviewModal.tsx",
      "features/admin/UserActionModals.tsx",
      "features/moderator/ChangeRequestModal.tsx",
    ]);
  });

  /* THE NEGATIVE CONTROL for the finder itself: a file that mounts no dialog
     must not be collected, or every arm below is measuring the whole tree and
     passing for the wrong reason. */
  it("does not collect a staff file that mounts no dialog", () => {
    const all = [...tsxUnder(ADMIN), ...tsxUnder(MODERATOR)].length;
    expect(all).toBeGreaterThan(DIALOG_FILES.length);
    expect(DIALOG_FILES.map((d) => d.rel)).not.toContain("features/admin/UserTable.tsx");
  });
});

describe("brief 11 §2 — the primary action never sits in the scrolling region", () => {
  /**
   * The class list a `<DialogContent …>` actually renders, with the shared
   * constants resolved to their values.
   *
   * ⚠ **THE FIRST SHAPE OF THIS READER COULD NOT SEE
   * `className={STAFF_DIALOG_CONTENT}`** — it required a quote after the brace,
   * so a card built entirely from the shared string produced ZERO matches. The
   * arm went red rather than green, which is the only reason that is a story
   * about a reader and not a story about a defect: the emptiness check below
   * is what refused to pass over a file it had not read. An absence arm over
   * an empty list is the failure this repository keeps meeting.
   */
  const cardClasses = ({ rel, src }: { rel: string; src: string }): string[] => {
    const tags = [...code(src).matchAll(/<DialogContent\b([^>]*)>/g)].map((m) => m[1]);
    expect(tags.length, `${rel}: no readable <DialogContent> tag`).toBeGreaterThan(0);
    return tags.map((tag) =>
      tag
        .replace(/STAFF_DIALOG_CONTENT/g, CONTENT_CLASSES)
        .replace(/STAFF_DIALOG_BODY/g, BODY_CLASSES));
  };

  it("no staff dialog puts overflow-y-auto on its card", () => {
    for (const dialog of DIALOG_FILES) {
      for (const cls of cardClasses(dialog)) {
        expect(cls, `${dialog.rel}: overflow-y-auto on the card is the defect (§2)`)
          .not.toMatch(/overflow-y-auto/);
        /* And the positive half of the same read: the card DOES carry the
           bound and the clip, so this is not passing because it read nothing. */
        expect(cls, `${dialog.rel}: the card must bound its height`).toMatch(/max-h-\[90vh\]/);
        expect(cls, `${dialog.rel}: the card must clip, or min-h-0 means nothing`).toMatch(/overflow-hidden/);
      }
    }
  });

  /* POSITIVE CONTROL — the matcher above can actually fail. Without this, a
     regex that never matches anything reads exactly like a clean tree. */
  it("the card-overflow matcher fires on the shape the defect had", () => {
    const defect = `<DialogContent className="text-foreground max-w-lg max-h-[90vh] overflow-y-auto">`;
    const found = [...defect.matchAll(/<DialogContent\b([^>]*)>/g)].map((m) => m[1]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/overflow-y-auto/);
  });

  it("every staff dialog builds its card from the shared shell strings", () => {
    for (const { rel, src } of DIALOG_FILES) {
      expect(code(src), `${rel} uses STAFF_DIALOG_CONTENT`).toContain("STAFF_DIALOG_CONTENT");
      expect(code(src), `${rel} uses STAFF_DIALOG_BODY`).toContain("STAFF_DIALOG_BODY");
    }
  });

  it("the shell is a flex column that hides its own overflow, and the body is the only scroller", () => {
    const content = /STAFF_DIALOG_CONTENT\s*=\s*\n?\s*"([^"]+)"/.exec(GRAMMAR)?.[1] ?? "";
    const body = /STAFF_DIALOG_BODY\s*=\s*\n?\s*"([^"]+)"/.exec(GRAMMAR)?.[1] ?? "";
    expect(content, "STAFF_DIALOG_CONTENT is readable").not.toBe("");
    expect(body, "STAFF_DIALOG_BODY is readable").not.toBe("");

    expect(content).toContain("flex");
    expect(content).toContain("flex-col");
    expect(content).toContain("overflow-hidden");
    expect(content).toMatch(/max-h-\[90vh\]/);
    expect(content, "the card must not scroll").not.toContain("overflow-y-auto");

    expect(body).toContain("overflow-y-auto");
    /* `min-h-0` is load-bearing: without it a flex child refuses to shrink
       below its content and the card grows past the window instead. */
    expect(body, "min-h-0 is what makes the body able to shrink").toContain("min-h-0");
    expect(body).toContain("flex-1");
  });

  it("the footer is a sibling of the scrolling body, never inside it", () => {
    for (const { rel, src } of DIALOG_FILES) {
      const stripped = code(src);
      expect(stripped, `${rel} mounts a DialogFooter`).toContain("<DialogFooter");
      /* Every body opens with the shared string; a footer INSIDE one would sit
         between that opening tag and its close. Reading it structurally is
         beyond a regex, so the arm holds the thing that made it possible
         before: buttons in a bare div at the bottom of the body. */
      expect(stripped, `${rel}: buttons in a bare flex row are how AuditActionModals lost its footer`)
        .not.toMatch(/className="flex gap-2 justify-end"/);
      expect(stripped, `${rel} pins the footer out of the scroll`).toMatch(/<DialogFooter\s+className="shrink-0/);
    }
  });
});

describe("brief 11 §3 — no icon in a title, and none in a confirm button", () => {
  const BANNED = ["ShieldOff", "Coins", "Shield", "UserCog", "Ban", "Globe", "FileText", "CheckCircle", "XCircle", "AlertTriangle"];

  it("none of the eight title glyphs is imported by a staff dialog any more", () => {
    for (const { rel, src } of DIALOG_FILES) {
      const imports = [...code(src).matchAll(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/g)]
        .flatMap((m) => m[1].split(",").map((s) => s.trim()));
      for (const banned of BANNED) {
        expect(imports, `${rel} still imports ${banned}`).not.toContain(banned);
      }
    }
  });

  /* POSITIVE CONTROL — the import reader sees what is there, so its silence
     means something. `Upload` and `Trash2` are the two the brief KEEPS: one
     labels an affordance, the other IS the control. */
  it("the same reader still finds the two glyphs the brief keeps", () => {
    const cr = DIALOG_FILES.find((d) => d.rel.endsWith("ChangeRequestModal.tsx"))!;
    const imports = [...code(cr.src).matchAll(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/g)]
      .flatMap((m) => m[1].split(",").map((s) => s.trim()));
    expect(imports).toContain("Upload");
    expect(imports).toContain("Trash2");
  });

  it("the header component cannot take a node as its title", () => {
    /* A `ReactNode` title is how a glyph gets back in without anyone noticing;
       the type is the guard, and this arm is what keeps the type. */
    expect(GRAMMAR).toMatch(/title:\s*string;/);
    expect(GRAMMAR).not.toMatch(/title:\s*ReactNode/);
  });
});

describe("brief 11 §4/§5 — one eyebrow, one field label, no asterisks", () => {
  it("every staff dialog opens with the shared header and a mono eyebrow", () => {
    for (const { rel, src } of DIALOG_FILES) {
      expect(code(src), `${rel} uses StaffDialogHeader`).toContain("<StaffDialogHeader");
      expect(code(src), `${rel} declares an eyebrow`).toMatch(/eyebrow="(ACCOUNT|AUDIT|CHANGE REQUEST)"/);
    }
  });

  it("no staff dialog declares its own field label any more", () => {
    for (const { rel, src } of DIALOG_FILES) {
      const stripped = code(src);
      /* The three treatments the brief is collapsing. A raw <label> in one of
         these files is a fourth one being born. */
      expect(stripped, `${rel} still hand-rolls a <label>`).not.toMatch(/<label\s/);
      expect(stripped, `${rel} uses StaffField`).toContain("<StaffField");
    }
  });

  it("the one label treatment is the foundation's own, not a second declaration", () => {
    /* `.dpc-modal__label` already existed and was already exactly the spec.
       The row zeroes its confirm-shell margin; it does not restate the font. */
    expect(GRAMMAR).toContain('className="dpc-modal__label"');
    expect(MODALS_CSS).toMatch(/\.dp-sfield > \.dpc-modal__label\s*\{[^}]*margin-top:\s*0/);
    const sfield = /\.dp-sfield\s*\{([^}]*)\}/.exec(MODALS_CSS)?.[1] ?? "";
    expect(sfield, "the row is layout only — a font here would be a fourth label").not.toMatch(/font:/);
  });

  it("no required marker is smuggled back into a label string", () => {
    for (const { rel, src } of DIALOG_FILES) {
      const labels = [...code(src).matchAll(/label=\{?[`"']([^`"'}]+)/g)].map((m) => m[1]);
      for (const label of labels) {
        expect(label, `${rel}: "${label}" carries an asterisk (§5)`).not.toMatch(/\*/);
        expect(label, `${rel}: "${label}" carries a parenthesised rule (§5)`).not.toMatch(/\(min\s|\(max\s/);
      }
    }
  });

  /* POSITIVE CONTROL for the label reader — it must find the real labels, or
     the arm above is passing over an empty list. */
  it("the label reader finds the request form's own labels", () => {
    const cr = DIALOG_FILES.find((d) => d.rel.endsWith("ChangeRequestModal.tsx"))!;
    const labels = [...code(cr.src).matchAll(/label=\{?[`"']([^`"'}]+)/g)].map((m) => m[1]);
    expect(labels).toContain("Target user ID");
    expect(labels).toContain("Title");
    expect(labels.length).toBeGreaterThan(8);
  });

  it("form fields are spaced by gap, never by margin between siblings", () => {
    for (const { rel, src } of DIALOG_FILES) {
      expect(code(src), `${rel} still uses space-y-* (§5: hidden fields leave collapsed margins)`)
        .not.toMatch(/\bspace-y-\d/);
    }
  });
});

describe("brief 11 §6/§7 — the segmented priority, the plain Slack line, one pending pattern", () => {
  it("priority is the house segmented control, and type and duration stay selects", () => {
    const cr = DIALOG_FILES.find((d) => d.rel.endsWith("ChangeRequestModal.tsx"))!.src;
    expect(code(cr), "priority uses .dp-segmented").toContain('className="dp-segmented"');
    /* Nine options and five-with-an-outlier stay lists — his own line, and the
       arm exists so a later tidy-up does not "finish the job". */
    expect(code(cr)).toContain('<SelectItem value="stripe_refund">');
    const audit = DIALOG_FILES.find((d) => d.rel.endsWith("AuditActionModals.tsx"))!.src;
    expect(code(audit)).toContain('<SelectItem value="permanent">');
    expect(code(audit), "duration is not segmented").not.toContain('className="dp-segmented"');
  });

  it("the Slack note is a plain line, and the Stripe slab keeps its warning", () => {
    const user = DIALOG_FILES.find((d) => d.rel.endsWith("UserActionModals.tsx"))!.src;
    expect(code(user), "the routine fact keeps its words").toContain("This action will be logged and reported to Slack");
    expect(code(user), "…and loses the slab (§7)").not.toContain("severityLook");

    const cr = DIALOG_FILES.find((d) => d.rel.endsWith("ChangeRequestModal.tsx"))!.src;
    expect(code(cr), "the Stripe block is the case §7 says is EARNED").toContain('severityLook("warning")');
  });

  it("no pending state puts a spinner in a button, and each names its act", () => {
    for (const { rel, src } of DIALOG_FILES) {
      expect(code(src), `${rel} still renders a Loader2`).not.toContain("Loader2");
      expect(code(src), `${rel}: "Processing..." is the pipeline's word for several acts`)
        .not.toContain("Processing...");
      /* Three dots are not an ellipsis (§7), and the difference is visible. */
      expect(code(src), `${rel} uses three dots where an ellipsis belongs`)
        .not.toMatch(/(Suspending|Blocking|Submitting|Uploading|Adding|Promoting|Demoting|Approving|Denying)\.\.\./);
    }
  });

  /* POSITIVE CONTROL — the pending arms above are absence arms over a set that
     must not be empty. This proves the acts are actually named somewhere. */
  it("the named pending labels exist", () => {
    const all = DIALOG_FILES.map((d) => code(d.src)).join("\n");
    for (const act of ["Suspending…", "Blocking…", "Submitting…", "Adding credits…", "Promoting…"]) {
      expect(all, `no dialog says "${act}"`).toContain(act);
    }
  });
});

describe("brief 11 §8 — what the PR was told not to do", () => {
  it("no hex literal came back into any staff dialog", () => {
    /* token-guard owns this population too; the arm is here because §8 names
       it as the way this PR could go backwards, and a second reader that does
       not share the first one's path list is the point. */
    for (const { rel, src } of DIALOG_FILES) {
      const hex = code(src).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      /* `#{crRelatedAuditLogId}` and `#{selectedRequestId}` are interpolated
         ids, not colours — they carry a `{`, which a colour never does. */
      const colours = hex.filter((h) => !/^#\{/.test(h));
      expect(colours, `${rel} reintroduced ${colours.join(", ")}`).toEqual([]);
    }
  });

  /*
    ⚠ The card number is in THIS comment and not in the test title, and that is
    the documented trap rather than a style choice: `token-guard`'s matcher is
    `#[0-9a-fA-F]{3,8}`, every issue number from #100 up is a valid hex, and it
    strips comments but not strings. A test TITLE is a string. It caught this
    file on its first full run.
  */
  it("the earlier colour fix's header findings are still on the files that hold them", () => {
    const cr = DIALOG_FILES.find((d) => d.rel.endsWith("ChangeRequestModal.tsx"))!.src;
    expect(cr, "the 89-hex finding is a finding, not decoration").toContain("89 hex literals");
    const user = DIALOG_FILES.find((d) => d.rel.endsWith("UserActionModals.tsx"))!.src;
    expect(user).toContain("THE FIX IS DELETION, NOT SUBSTITUTION");
  });

  it("no dialog was rebuilt onto the promoted confirm shell", () => {
    for (const { rel, src } of DIALOG_FILES) {
      expect(code(src), `${rel} was folded into ConfirmDialog (§8 forbids it)`).not.toMatch(/<ConfirmDialog/);
      expect(code(src), `${rel} was folded into the casting modal shell`).not.toMatch(/<CastingModal/);
    }
  });

  it("no type-the-name arming was added to suspend or block IP", () => {
    /* His words: *"Arming is for the irreversible; over-applying it makes it
       noise."* `DestructiveConfirm` is the product's arming control. */
    for (const { rel, src } of DIALOG_FILES) {
      expect(code(src), `${rel} added arming`).not.toContain("DestructiveConfirm");
    }
  });

  it("ChangeRequestConstants' Title Case was not lowercased in this PR", () => {
    const constants = read(path.resolve(ADMIN, "ChangeRequestConstants.tsx"));
    expect(constants, "nineteen strings feeding a shipped surface is a copy change, not a modal change")
      .toContain("Approve Refund");
  });
});
