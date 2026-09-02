import {
  ArrowRight,
  Bookmark,
  Copy,
  Download,
  Lock,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import {
  CardMenu,
  ConfirmDialog,
  DestructiveConfirm,
  RenameDialog,
  Button,
  Card,
  BRAND_NAME,
  Chip,
  DataTable,
  DerivedChip,
  Dock,
  DropZone,
  EmptyState,
  Field,
  GradientTile,
  HoverActions,
  IconButton,
  Input,
  Instruction,
  Marquee,
  MediaCard,
  MediaFrame,
  Progress,
  RequiredMarker,
  ScopePill,
  SectionHead,
  severityLook,
  Skeleton,
  StatusPill,
  SurfaceBar,
  TableFilter,
  TableHead,
  TableSearch,
  TableSort,
} from "@/foundation";
import { Redirect } from "wouter";

import { useAuth } from "@/_core/hooks/useAuth";
import { Popover } from "@/foundation/Popover";
import { AppChrome } from "@/components/AppChrome";

/**
 * THE COMPONENT SPECIMEN SHEET — a house tool, at a staff address (#261).
 *
 * # What this page is
 *
 * One page that renders every primitive the foundation ships, so a component's
 * shape can be checked against real app chrome before anything is built on it.
 * It is the fixture the light/dark screenshot drive compares
 * (`scripts/drive-foundation-theme-parity.mts`), the surface the design-law
 * drive audits (`scripts/drive-casting-design-laws.mts`), and the page the
 * promotion pass points at
 * (`docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`).
 *
 * # Who it is for, and where it is allowed to live
 *
 * **Us, and only us — it lives at `/admin/foundation` and nowhere else.**
 *
 * Until 2026-09-01 it sat at `/casting/foundation`, inside the customer's own
 * product namespace, and rendered for anyone including a signed-out stranger.
 * Nothing here is customer data — every value is invented specimen content —
 * and that is exactly the problem: a fake ledger, fake prices (`Sign · 500 cr`,
 * `Roll again · 160 cr`) and a fake transcript of a night shift talking to the
 * founder, at a public address inside the product a customer pays for.
 *
 * The founder ruled the fix twice, and the second sentence settled the choice
 * the first one left open:
 *
 *   2026-08-30: *"fix it by moving the page, not gating it. A component
 *   specimen has no business inside the `/casting` namespace at all. Move it to
 *   the staff routes or a dev-only build, then do the sweep you proposed. An
 *   admin gate on a customer route leaves the wrong thing in the wrong place."*
 *
 *   2026-09-01: *"where does this re-usable component page live[?] its not
 *   public facing or still a follow of casting is it? it should be admin"*
 *
 * So it took the staff route rather than a dev-only build: the page has to stay
 * reachable on production, because that is where a shape gets checked against
 * the chrome the customer actually sees.
 *
 * # Two things that follow from that, for whoever edits this next
 *
 * - **The guard below is the page's own, in the shape every other admin page
 *   uses.** There is no route-level guard anywhere in `App.tsx`; each page owns
 *   its gate, so a page that consults nothing renders for everyone. That was
 *   this page for five days.
 * - **It keeps `AppChrome` on purpose, and it is now the only staff page that
 *   wears it BARE.** Brief 05 put every other staff page inside `StaffSurface`
 *   — the same chrome plus the staff bar and its tabs. This one deliberately
 *   stays outside that frame: it is a specimen sheet, not a staff surface, and
 *   the founder ruled it gets no tab. Putting it in the frame would draw a
 *   staff bar whose tabs do not include the page you are looking at.
 */
export default function AdminFoundation() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [bar, setBar] = useState("all");
  /* Section 07b — the staff table's own head, so its three controls can be
     driven here rather than only on a staff surface with real rows. */
  const [specimenSearch, setSpecimenSearch] = useState("");
  const [specimenSeverity, setSpecimenSeverity] = useState("all");
  const [specimenCategory, setSpecimenCategory] = useState("all");
  const [specimenSort, setSpecimenSort] = useState("when");
  const [specimenDirection, setSpecimenDirection] = useState<"asc" | "desc">("desc");
  /* Section 11 — one specimen open at a time, which is also the rule the
     promoted overflow menu enforces for real. */
  const [shown, setShown] = useState<null | "rename" | "delete" | "confirm">(null);
  const [menuOpen, setMenuOpen] = useState(false);
  /* Section 12 — the sentence popover's two axes, so both can be opened and
     the "one open at a time" rule can be seen rather than believed. */
  const [build, setBuild] = useState("athletic");
  const [age, setAge] = useState<string | null>("late twenties");

  /* ─── auth guard, the shape every other admin page uses ───
     Hooks first, returns after: this page's specimen state is declared above so
     a signed-out visitor and an admin run the same number of hooks. */
  if (authLoading) {
    /* Tokens, not the raw hexes the other admin pages spell out: this file is
       on the token guard's enrolled list (`foundation/token-guard.test.ts`),
       and it should be — a specimen sheet that hardcodes a colour is the one
       page whose own subject it contradicts. */
    return (
      <AppChrome breadcrumb="Staff / Foundation" width="working">
        <span className="dp-metadata">Loading…</span>
      </AppChrome>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  /* Brief 05 §6 — the redirect is silent now. The `toast.error` that used to
     sit here fired from the render body, which double-fires under strict mode,
     and somebody who cannot see Admin does not need telling why. Swept across
     all nine staff pages together (working law 7: fix the class). */
  if (user?.role !== "admin") return <Redirect to="/app" />;

  return (
    <AppChrome breadcrumb="Staff / Foundation" width="working">
      <div className="dp-stack" style={{ gap: 9 }}>
        <span className="dp-eyebrow">Klieg foundation · M1</span>
        <h1 className="dp-headline">
          Shared app foundation.
          <br />
          Every surface is built from this.
        </h1>
        <p className="dp-body">
          Tokens, type, chrome and primitives, live in both themes. Toggle the theme in the
          topbar — nothing on this page branches on it. This is a staff route behind the
          admin gate: it exists so the system can be checked before a product surface
          depends on it.
        </p>
      </div>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="01 · Buttons" aside="one primary per view" />
        <div className="dp-row">
          <Button variant="primary">
            Cast it · 160 cr
            <ArrowRight size={12} strokeWidth={2.2} aria-hidden="true" />
          </Button>
          <Button variant="secondary">Open in canvas</Button>
          <Button variant="secondary" destructive size="small">
            Delete
          </Button>
          <Button variant="quiet">Back</Button>
          <IconButton label="More">
            <Search size={14} strokeWidth={1.9} />
          </IconButton>
          <Instruction>Keep the ones worth a second look</Instruction>
        </div>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="02 · Inputs" aside="placeholders are examples" />
        <div className="dp-stack" style={{ gap: 12, maxWidth: 720 }}>
          <Field>
            <Input placeholder="a fitness creator in their 30s, close-cropped hair" />
            <Button variant="primary" size="small">
              Cast it · 160 cr
            </Button>
          </Field>
          <div className="dp-row" style={{ gap: 12 }}>
            <Field compact className="dp-split__main">
              <Search size={13} strokeWidth={2} aria-hidden="true" />
              <Input placeholder="Search cast by name, voice, or vibe" />
            </Field>
            <Field compact invalid className="dp-split__side">
              <Input placeholder="Name is required" />
              <RequiredMarker />
            </Field>
          </div>
        </div>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="03 · Chips, pills & status" />
        <div className="dp-row">
          <span className="dp-chrome">NUDGE</span>
          <Chip>Warmer light</Chip>
          <Chip>Older</Chip>
          <Chip>Less polished</Chip>
        </div>
        <div className="dp-row">
          <DerivedChip label="30s" />
          <DerivedChip label="cluttered garage" />
          <DerivedChip label="dry humour" />
        </div>
        <div className="dp-row">
          <ScopePill active>Everyone</ScopePill>
          <ScopePill>Signed</ScopePill>
          <ScopePill>Unsigned</ScopePill>
        </div>
        <div className="dp-row">
          {/* Types, never states. Founder at the frames (2026-08-30):
              "MASCOT and PERFORMER shouldn't be coral. Those are types, not
              states - colour is encoding a category, which is the one thing
              it's not allowed to do." IDENTITY LOCKED below keeps the accent,
              because locked IS a state. */}
          <StatusPill>Mascot</StatusPill>
          <StatusPill>Performer</StatusPill>
          <StatusPill
            tone="accent"
            icon={<Lock size={11} strokeWidth={2} aria-hidden="true" />}
          >
            Identity locked
          </StatusPill>
        </div>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="04 · Cards, media & states" aside="stream, don't batch" />
        <div className="dp-grid">
          <Card interactive>
            <span className="dp-label">Route card</span>
            <span className="dp-secondary">
              A secondary way into a flow. Copy states the cost or the size.
            </span>
          </Card>

          <div className="dp-stack" style={{ gap: 9 }}>
            {/* ONE STATE, ONE SIGNAL. This wore four accents at once - a coral
                border, a coral check, the SIGNED pill and the kept bar - for a
                single fact. Founder at the frames (2026-08-30): "Four signals
                for one fact is how a system starts shouting, and it makes the
                genuinely urgent things - a failed run, a destructive confirm -
                indistinguishable from a good outcome." Matched to 05: badge
                plus caption, no border change, no check. */}
            <MediaFrame
              topLeft={<StatusPill tone="onMedia">Signed</StatusPill>}
              overlay={<>Kept · warm alto</>}
            />
            <span className="dp-label">Media card</span>
            <span className="dp-secondary">4:5 · scrim for text over image</span>
          </div>

          <div className="dp-stack" style={{ gap: 9 }}>
            <Skeleton style={{ aspectRatio: "4 / 5" }} label="CASTING 04" />
            <span className="dp-label">Skeleton tile</span>
            <span className="dp-secondary">swaps on its own arrival</span>
          </div>

          <div className="dp-stack" style={{ gap: 9 }}>
            <DropZone style={{ aspectRatio: "4 / 5" }}>
              <span className="dp-secondary">Empty / add target</span>
            </DropZone>
            <span className="dp-label">Drop target</span>
            <span className="dp-secondary">dashed means you can put something here</span>
          </div>
        </div>

        <div className="dp-split">
          <Card raised className="dp-split__main">
            <span className="dp-label">Media below 64px uses a gradient tile</span>
            <div className="dp-row" style={{ gap: 8 }}>
              <GradientTile width={52} height={64} label="V2" title="Second candidate" />
              <GradientTile width={34} height={42} title="Third candidate" />
            </div>
            <span className="dp-secondary">
              Placeholder prose clips mid-word under about 64px and reads as broken text.
            </span>
          </Card>
          <Card className="dp-split__side">
            <EmptyState
              title="No cast signed yet"
              body="Describe who you need and pick from eight candidates."
              action={
                <Button variant="primary" size="small">
                  Cast someone
                </Button>
              }
            />
            <Progress value={62} />
          </Card>
        </div>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="05 · Media cards" aside="the create tile stays first" />
        <div className="dp-grid">
          <MediaCard
            state="create"
            ratio="4/5"
            label="New cast member"
            meta="ADD"
            onClick={() => undefined}
          />
          {/* The same shape saying the other sentence, shown beside it so the
              difference is visible rather than described. */}
          <MediaCard
            state="gap"
            ratio="4/5"
            label="The Broker"
            meta="no wardrobe yet · needed by SC 5"
          />
          <MediaCard
            ratio="4/5"
            badge="IMAGE"
            label="Rooftop, overcast"
            meta="09:41"
            onClick={() => undefined}
            actions={
              <HoverActions
                meta="4:5"
                items={[
                  { icon: <Sparkles size={12} strokeWidth={1.9} />, title: "Use as reference" },
                  { icon: <Download size={12} strokeWidth={1.9} />, title: "Download" },
                  { icon: <Copy size={12} strokeWidth={1.9} />, title: "Copy image" },
                  { icon: <Bookmark size={12} strokeWidth={1.9} />, title: "Save to assets" },
                ]}
              />
            }
          />
          <MediaCard
            state="kept"
            ratio="4/5"
            corner={<StatusPill tone="accent">Kept</StatusPill>}
            label="Warm alto, third look"
            meta="09:44"
            onClick={() => undefined}
          />
          <MediaCard state="pending" ratio="4/5" label="Still casting" meta="~40s" />
        </div>
        <p className="dp-secondary">
          The label row sits below the media, never over it — a caption centred in a short card
          lands exactly where a bottom overlay's text does. Hover a card to reveal its actions;
          the reveal is driven by the card, not by the strip the buttons live in.
        </p>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="06 · Surface bar" aside="wraps, never scrolls sideways" />
        <div className="dp-card" style={{ padding: 0, overflow: "hidden" }}>
          {/* ⚠ Composed from `BRAND_NAME`, exactly as the two REAL bars are
              (#417). It said `Klieg Studio — everything` until the gate review
              caught it — a third hardcoded copy of the string his ruling
              removed, sitting on a live admin page, on this of all surfaces:
              the specimen sheet is how a shape gets judged against the chrome
              a customer sees, so a stale specimen misinforms the next brief as
              well as reading to him as the bug coming back. */}
          <SurfaceBar
            eyebrow="ADMIN"
            title={`${BRAND_NAME} Console`}
            segments={{
              value: bar,
              options: [
                { value: "all", label: "Everything" },
                /* Brief 05 folded a count pill into the segmented control. The
                   specimen carries one because a capability the foundation
                   gained that this page does not show is one he cannot see —
                   and the third segment carries none, so the "omitted at zero"
                   rule is visible rather than described. */
                { value: "decide", label: "To decide", count: 3 },
                { value: "log", label: "Log", count: 0 },
              ],
              onChange: setBar,
            }}
            meta="updated 07:14"
            right={<Button variant="primary">3 to decide</Button>}
          />
        </div>
        <p className="dp-secondary">
          Narrow the window: the bar wraps and the primary action stays on screen. Four overflow
          bugs in the prototype came from this row, the last one pushing the primary action fully
          out of view at 924px.
        </p>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="07 · Data table" aside="rows open in place" />
        {/*
          Brief 06 — the staff table's head and filter cluster, on the specimen
          page because this page is how the promotion pass is judged (#366:
          *"so we are not designing 50 different styles of the same
          components"*). Eleven staff surfaces draw exactly this row.

          The two filters below show the rule working in both directions:
          three options is a segmented control, six is a select, and
          `TableFilter` decides rather than the call site.
        */}
        <TableHead eyebrow="07b · Table head">
          <TableSearch
            label="A real, debounced search — not the topbar's stub"
            placeholder="Name, email or id"
            value={specimenSearch}
            onChange={setSpecimenSearch}
          />
          <TableFilter
            label="Severity"
            value={specimenSeverity}
            onChange={setSpecimenSeverity}
            options={[
              { value: "all", label: "All" },
              { value: "warning", label: "Warning" },
              { value: "critical", label: "Critical" },
            ]}
          />
          <TableFilter
            label="Category"
            value={specimenCategory}
            onChange={setSpecimenCategory}
            options={[
              { value: "all", label: "All categories" },
              { value: "billing", label: "Billing" },
              { value: "model", label: "Model" },
              { value: "security", label: "Security" },
              { value: "abuse", label: "Abuse" },
              { value: "refunds", label: "Refunds" },
            ]}
          />
          <TableSort
            value={specimenSort}
            onChange={setSpecimenSort}
            direction={specimenDirection}
            onDirectionChange={setSpecimenDirection}
            options={[
              { value: "when", label: "When" },
              { value: "severity", label: "Severity" },
            ]}
          />
        </TableHead>
        <DataTable
          columns={[
            { label: "SEVERITY", width: "0 0 104px" },
            { label: "ACTION", width: "1 1 0" },
            { label: "WHEN", width: "0 0 96px" },
          ]}
          rows={[
            {
              id: "a",
              cells: [
                <span key="s" className="dp-statuspill" style={severityLook("critical")}>
                  critical
                </span>,
                <span key="a" className="dp-metadata">stripe.refund.manual</span>,
                <span key="w" className="dp-metadata">07:14</span>,
              ],
              facts: [
                { label: "OPERATOR", value: "verify-bot" },
                { label: "AMOUNT", value: "160 credits" },
                { label: "REFERENCE", value: "op_5f31c0" },
              ],
              evidence:
                "A refund was issued by hand after a roll failed on all eight slices. The customer kept nothing and was charged nothing.",
              /* Brief 06 §5: a destructive action cannot be written without
                 its consequence — the union type refuses the build otherwise,
                 which is why this specimen carries one. */
              actions: [
                { key: "open", label: "Open the customer", variant: "secondary" },
                { key: "copy", label: "Copy reference" },
                {
                  key: "reverse",
                  label: "Reverse the refund",
                  onClick: () => undefined,
                  destructive: true,
                  consequence:
                    "Reversing takes the 160 credits back off the customer's balance; it does not re-charge their card.",
                },
              ],
            },
            {
              id: "b",
              cells: [
                <span key="s" className="dp-statuspill" style={severityLook("warning")}>
                  warning
                </span>,
                <span key="a" className="dp-metadata">auth.login.locked</span>,
                <span key="w" className="dp-metadata">06:02</span>,
              ],
              facts: [{ label: "ATTEMPTS", value: "5" }],
            },
            {
              id: "c",
              cells: [
                <span key="s" className="dp-statuspill" style={severityLook("info")}>
                  info
                </span>,
                <span key="a" className="dp-metadata">credits.topup.auto</span>,
                <span key="w" className="dp-metadata">04:30</span>,
              ],
            },
          ]}
          footer={{ meta: "3 of 4,471 entries", onBack: () => undefined, onNext: () => undefined }}
        />
        <p className="dp-secondary">
          Seven tints across the two staff surfaces collapse to three looks: greyscale, plus the
          one red for genuinely urgent state. What an entry is about is carried by its mono action
          string, which says more than a colour can.
        </p>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="10 · Marquee" aside="no jump at the loop" />
        <Marquee
          itemWidth={172}
          gap={14}
          duration={62}
          items={[
            "Editorial portrait",
            "Product on seamless",
            "Overcast rooftop",
            "Studio three-point",
            "Golden hour street",
            "Flat lay, top down",
          ].map((name) => (
            <Card key={name} interactive>
              <span className="dp-label">{name}</span>
              <span className="dp-metadata">TEMPLATE</span>
            </Card>
          ))}
        />
        <p className="dp-secondary">
          The animated track carries no padding and no gap — the shift has to equal exactly one
          copy's stride, and a gap applies between items only, which leaves the loop one gap short
          and visibly jumping. Hover pauses it.
        </p>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead
          eyebrow="11 · Promoted from casting"
          aside="one shell, different contents"
        />
        {/*
          THE FIVE THE FOUNDER PROMOTED (#262, 2026-08-30). They were app
          concepts that happened to be built in casting first, and they are on
          this page for the same reason everything else here is: a shared
          component nobody can LOOK at is a shared component that drifts.

          The three dialogs run on one `ModalScrim` — his ruling — so what
          differs below is the card and the copy, never the behaviour. Open each
          and press Escape: the dismissal is the same code in all three.
        */}
        <div className="dp-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => setShown("rename")}>
            Rename dialog
          </Button>
          <Button variant="secondary" onClick={() => setShown("delete")}>
            Delete by typing
          </Button>
          <Button variant="secondary" onClick={() => setShown("confirm")}>
            Destructive confirm
          </Button>
          <span className="dpc-menuhost" style={{ position: "relative" }}>
            <CardMenu
              label="this specimen"
              open={menuOpen}
              onToggle={() => setMenuOpen((was) => !was)}
              onCancel={() => setMenuOpen(false)}
              align="fromTheLeft"
              items={[
                { label: "Rename", onSelect: () => { setMenuOpen(false); setShown("rename"); } },
                { label: "Delete permanently", danger: true, onSelect: () => { setMenuOpen(false); setShown("delete"); } },
              ]}
            />
          </span>
        </div>
        <p className="dp-small">
          The overflow menu&rsquo;s hover reveal belongs to the card it sits on,
          so the trigger above is always visible here and fades in on a real
          card.
        </p>

        {shown === "rename" ? (
          <RenameDialog
            currentName="Maya Rasmussen"
            imageUrl={null}
            busy={false}
            onCancel={() => setShown(null)}
            onSave={() => setShown(null)}
          />
        ) : null}
        {shown === "delete" ? (
          <DestructiveConfirm
            name="Maya Rasmussen"
            imageUrl={null}
            signed
            busy={false}
            onCancel={() => setShown(null)}
            onConfirm={() => setShown(null)}
          />
        ) : null}
        {shown === "confirm" ? (
          <ConfirmDialog
            title="Discard this sheet?"
            body="The eight faces on it go, and the credits it cost don't come back."
            confirmLabel="Discard it"
            busyLabel="Discarding…"
            busy={false}
            onCancel={() => setShown(null)}
            onConfirm={() => setShown(null)}
          />
        ) : null}
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead
          eyebrow="12 · The anchored panel"
          aside="one behaviour, two shapes"
        />
        {/*
          HIS RULING ON #304, verbatim and entire: "Option one" — one owner of
          the behaviour, two shapes on top of it. The two shapes are both here
          because that is the only way to see that they behave identically: the
          menu above and the words below open, close on Escape, close on an
          outside click and land beside their trigger through the same code.

          Open one and then the other without closing the first. Only one stays
          open, which is a rule `Popover.tsx` has claimed in prose since it was
          written and nothing implemented until the collapse.
        */}
        <p className="dp-body">
          The sheet reads back{" "}
          <Popover
            label={`Change build, currently ${build}`}
            heading="Build"
            options={["athletic", "slight", "broad", "willowy"].map((value) => ({
              value,
              label: value,
              current: value === build,
            }))}
            onSelect={(value) => setBuild(value)}
          >
            {build}
          </Popover>{" "}
          and{" "}
          <Popover
            label={age ? `Change age, currently ${age}` : "Pin age, currently left to the roll"}
            heading={age ? "Age" : "Age · varying"}
            className={age ? undefined : "dp-pop__trigger--open"}
            options={["early twenties", "late twenties", "thirties", "forties"].map((value) => ({
              value,
              label: value,
              current: value === age,
            }))}
            footer={age ? { label: `Undo — let age vary`, onSelect: () => setAge(null) } : null}
            onSelect={(value) => setAge(value)}
          >
            {age ?? "varying"}
          </Popover>
          , which is the brief echo's own shape.
        </p>
        <p className="dp-small">
          A word in a sentence is a listbox and the overflow menu in section 11
          is a menu; underneath they are the same owner, so a placement or
          dismissal fix lands on both at once rather than on whichever one
          somebody remembered.
        </p>
      </section>

      <Dock>
        <div className="dp-row" style={{ gap: 10, flexWrap: "nowrap" }}>
          <Field className="dp-split__main">
            <Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
            <Input placeholder="Sticky dock — the persistent input for a working surface" />
          </Field>
          <Button variant="secondary">Roll again · 160 cr</Button>
        </div>
        <div className="dp-row">
          <span className="dp-small" style={{ flex: 1, minWidth: 160 }}>
            2 discarded
          </span>
          <Button variant="quiet">
            <RotateCcw size={11} strokeWidth={2.1} aria-hidden="true" />
            Undo
          </Button>
          <Button variant="primary">Sign · 500 cr</Button>
        </div>
      </Dock>
    </AppChrome>
  );
}
