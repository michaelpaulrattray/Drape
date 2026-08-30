import {
  ArrowRight,
  Bookmark,
  Check,
  Copy,
  Download,
  Lock,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import {
  AppShell,
  Button,
  Card,
  Chip,
  CostedOption,
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
  MilestoneRail,
  Progress,
  RequiredMarker,
  ScopePill,
  SectionHead,
  severityLook,
  Skeleton,
  StatusPill,
  SurfaceBar,
  Transcript,
} from "@/foundation";

/**
 * The primitive gallery, on the unlinked `/casting/foundation` route.
 *
 * This is the shell's proving ground, not the product: it renders every
 * primitive the foundation ships so the light/dark screenshot drive
 * (scripts/drive-foundation-theme-parity.mts) has one page to compare, and so
 * the founder can eyeball the system against the living reference
 * (docs/specs/Casting-ui-ux-design/drape-foundation/Drape Foundation.dc.html).
 *
 * M5 took `/casting` for the real product and left this page its own address
 * rather than deleting it — theme parity is easier to check on one page that
 * exercises everything than across the surfaces that each use a little.
 * Nothing here calls the API, spends a credit, or claims a capability the
 * product does not have; the copy describes the foundation itself.
 */
export default function CastingFoundation() {
  const [bar, setBar] = useState("all");

  return (
    <AppShell breadcrumb="Casting / Foundation" current="casting" width="working">
      <div className="dp-stack" style={{ gap: 9 }}>
        <span className="dp-eyebrow">Klieg foundation · M1</span>
        <h1 className="dp-headline">
          Shared app foundation.
          <br />
          Every surface is built from this.
        </h1>
        <p className="dp-body">
          Tokens, type, chrome and primitives, live in both themes. Toggle the theme in the
          topbar — nothing on this page branches on it. This route is unlinked: it exists so
          the system can be checked before a product surface depends on it.
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
          <StatusPill tone="accent">Mascot</StatusPill>
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
            <MediaFrame
              selected
              topLeft={<StatusPill tone="onMedia">Signed</StatusPill>}
              overlay={
                <>
                  <Check size={10} strokeWidth={2.1} aria-hidden="true" />
                  Kept · warm alto
                </>
              }
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
            state="gap"
            ratio="4/5"
            label="New cast member"
            meta="ADD"
            onClick={() => undefined}
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
          <SurfaceBar
            eyebrow="ADMIN"
            title="Klieg Studio — everything"
            segments={{
              value: bar,
              options: [
                { value: "all", label: "Everything" },
                { value: "decide", label: "To decide" },
                { value: "log", label: "Log" },
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
              actions: (
                <>
                  <Button variant="secondary" size="small">Open the customer</Button>
                  <Button variant="quiet" size="small">Copy reference</Button>
                </>
              ),
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
        <SectionHead eyebrow="08 · Decisions & progress" aside="a choice states its cost" />
        <div className="dp-split">
          <div className="dp-stack dp-split__main" style={{ gap: 10 }}>
            <CostedOption
              optionKey="TAKE"
              label="Ship looks only"
              costs={[
                { sign: "−", text: "3 items out of M4" },
                { sign: "!", text: "per-garment moves to M5" },
              ]}
            />
            <CostedOption
              optionKey="HOLD"
              label="Keep the whole milestone together"
              costs={[
                { sign: "+", text: "one surface, one review" },
                { sign: "=", text: "no change to the ladder" },
              ]}
            />
          </div>
          <Card className="dp-split__side">
            <span className="dp-label">Milestone rail</span>
            <MilestoneRail
              milestones={[
                { id: "M1", name: "Foundation", weight: 3, done: 3, total: 3 },
                { id: "M2", name: "Chrome", weight: 2, done: 2, total: 2 },
                { id: "M3", name: "Shelf + composer", weight: 5, done: 6, total: 9 },
                { id: "M4", name: "Takes", weight: 4, done: 0, total: 7 },
              ]}
            />
            <span className="dp-secondary">
              Segment width is proportional to the size of the milestone. Equal segments would say
              a nine-item milestone and a two-item one are the same amount of work.
            </span>
          </Card>
        </div>
      </section>

      <section className="dp-stack" style={{ gap: 16 }}>
        <SectionHead eyebrow="09 · Transcript" aside="speaker column is 80px" />
        <Card>
          <Transcript
            entries={[
              {
                who: "night shift",
                when: "07:14",
                body: "Section 00 is in: nine shared components, four keyframes and the popover hook. No surface moved.",
              },
              {
                who: "you",
                when: "07:21",
                body: "Good. Bring the menus onto the same grammar next.",
                own: true,
                ref: { kind: "RULING", text: "00b is the next PR, then stop" },
              },
            ]}
          />
        </Card>
        <p className="dp-secondary">
          "night shift" needs 69.3px at the 10.5px mono floor and clips at 64px, so the column is
          80px and does not shrink. The answer to a long label is never a smaller font.
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
    </AppShell>
  );
}
