import { ArrowRight, Check, Lock, RotateCcw, Search, Sparkles } from "lucide-react";

import {
  AppShell,
  Button,
  Card,
  Chip,
  DerivedChip,
  Dock,
  DropZone,
  EmptyState,
  Field,
  GradientTile,
  IconButton,
  Input,
  Instruction,
  MediaFrame,
  Progress,
  RequiredMarker,
  ScopePill,
  SectionHead,
  Skeleton,
  StatusPill,
} from "@/foundation";

/**
 * M1 foundation surface, mounted on the unlinked `/casting` route.
 *
 * This is the shell's proving ground, not the product: it renders every
 * primitive M1 ships so the light/dark screenshot drive
 * (scripts/drive-foundation-theme-parity.mts) has one page to compare, and so
 * the founder can eyeball the system against the living reference
 * (docs/specs/Casting-ui-ux-design/drape-foundation/Drape Foundation.dc.html).
 *
 * M5 replaces this body with the real roster brief screen. Nothing here calls
 * the API, spends a credit, or claims a capability the product does not have —
 * the copy describes the foundation itself.
 */
export default function CastingFoundation() {
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
            Cast it
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
            <Input placeholder="a dad in his 30s in a cluttered garage, dry humour" />
            <Button variant="primary" size="small">
              Cast it
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
            <span className="dp-metadata">4:5 · scrim for text over image</span>
          </div>

          <div className="dp-stack" style={{ gap: 9 }}>
            <Skeleton style={{ aspectRatio: "4 / 5" }} label="CASTING 04" />
            <span className="dp-label">Skeleton tile</span>
            <span className="dp-metadata">swaps on its own arrival</span>
          </div>

          <div className="dp-stack" style={{ gap: 9 }}>
            <DropZone style={{ aspectRatio: "4 / 5" }}>
              <span className="dp-secondary">Empty / add target</span>
            </DropZone>
            <span className="dp-label">Drop target</span>
            <span className="dp-metadata">dashed means you can put something here</span>
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
