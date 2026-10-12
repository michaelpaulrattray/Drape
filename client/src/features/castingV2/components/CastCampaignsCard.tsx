import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ChevronRight, Plus } from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import { CAMPAIGN_NAME_MAX_LENGTH } from "@shared/inputLimits";

import {
  CampaignRowIcon,
  PostSignCampaignOffer,
  isPostSignOfferSilenced,
  peekJustSigned,
  postSignOfferState,
  silencePostSignOffer,
  takeJustSigned,
  type PostSignOfferState,
} from "./PostSignCampaignOffer";

/**
 * IN CAMPAIGNS — the cast page's panel, made real (rung N2c, card #2252).
 *
 * His word, 2026-09-29, verbatim and entire: *"yes."* — to the note that N2c
 * also builds this panel (memberships by name, plus one add row) and removes
 * the header's campaign button. Until now the card said campaigns weren't
 * built, beside a disabled button; they are built, so it lists the ones this
 * cast is in and files it into one.
 *
 * ONE STORE, TWO DOORS. The add row calls the same `addCastsToCampaign` the
 * library files with, and a new campaign is the library's own
 * `createCampaign` — there is no second road to a membership, so what this
 * page adds the library shows and the other way round.
 *
 * WHAT IS DELIBERATELY NOT DRAWN. The prototype's rows carry a hero thumbnail
 * and a "12 frames · live" line; neither exists (a campaign holds casts, not
 * frames, and has no picture of its own), so a row is the campaign's name and
 * how many casts are in it — both read from the store — beside a clapperboard
 * mark (#2308, his "build D"), which is decoration and never a picture.
 */

export type CastCampaignMembership = { campaignId: string; name: string };
export type CampaignSummary = { campaignId: string; name: string; castCount: number };

/** Where a campaign row goes: the library, with that campaign's chip selected. */
export function campaignLibraryHref(campaignId: string): string {
  return `/app/casting?campaign=${encodeURIComponent(campaignId)}`;
}

function castCountLine(count: number): string {
  return count === 1 ? "1 cast" : `${count} casts`;
}

export type CastCampaignsPanelProps = {
  /** The campaigns this cast is in; `undefined` while the first read is in flight. */
  memberships: CastCampaignMembership[] | undefined;
  /** Every campaign the customer has, for the counts and the add list. */
  campaigns: CampaignSummary[] | undefined;
  busy: boolean;
  /** Resolves null when the cast was filed, or the sentence saying why not. */
  onAdd: (campaignId: string) => Promise<string | null>;
  /** Resolves null when the campaign was made and the cast filed into it. */
  onCreate: (name: string) => Promise<string | null>;
  /** Tests only: render with the add control already open. */
  defaultOpen?: boolean;
  /**
   * The post-Sign offer (#2253), present only while it is showing. It takes the
   * place of the empty line and the add row — one question, the customer's
   * campaigns, and two ways out — and files through this panel's own `onAdd`.
   */
  offer?: PostSignOfferProps | null;
};

export type PostSignOfferProps = {
  castName: string;
  refusal: string | null;
  onFile: (campaignId: string) => void;
  onNotNow: () => void;
  onNever: () => void;
};

export function CastCampaignsPanel({
  memberships,
  campaigns,
  busy,
  onAdd,
  onCreate,
  defaultOpen = false,
  offer = null,
}: CastCampaignsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState("");
  /*
    A REFUSAL SAYS WHY IN PLACE (D-110: a toast is the fallback channel). The
    control is open in front of the customer, so the reason goes under it —
    a name already taken, a cast that could not be filed — rather than in a
    pill somewhere else on the page.
  */
  const [refusal, setRefusal] = useState<string | null>(null);
  const close = () => {
    setDraft("");
    setRefusal(null);
    setOpen(false);
  };

  const loaded = memberships !== undefined;
  const memberIds = new Set((memberships ?? []).map((row) => row.campaignId));
  const countFor = new Map((campaigns ?? []).map((row) => [row.campaignId, row.castCount]));
  /* The campaigns this cast could still go into — never one it is already in. */
  const available = (campaigns ?? []).filter((row) => !memberIds.has(row.campaignId));
  /* His approved room wording (Desk, 2026-10-09): "Use in a campaign" and "Use
     in a new campaign" — the second only when there is no other campaign to
     offer, so the label never promises a choice the control does not have. */
  const addLabel = available.length > 0 ? "Use in a campaign" : "Use in a new campaign";
  /* The offer draws only over a real choice: loaded, and at least one campaign to offer. */
  const offering = offer !== null && loaded && !open && available.length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name || busy) return;
    const why = await onCreate(name);
    if (why === null) close();
    else setRefusal(why);
  };

  return (
    <section className="dpc-rcard dpc-rcard--flush" aria-label="In campaigns">
      <div className="dpc-camp__head">
        <span className="dpc-rcard__label">IN CAMPAIGNS</span>
        {loaded ? <span className="dpc-camp__count">{memberships.length}</span> : null}
      </div>

      {loaded && memberships.length === 0 && !offering ? (
        <p className="dpc-camp__empty">Not in any campaign yet.</p>
      ) : null}

      {loaded && memberships.length > 0 ? (
        <ul className="dpc-camp__list">
          {memberships.map((row) => {
            const count = countFor.get(row.campaignId);
            return (
              <li key={row.campaignId}>
                <Link href={campaignLibraryHref(row.campaignId)} className="dpc-camp__row">
                  <CampaignRowIcon />
                  <span className="dpc-camp__text">
                    <span className="dpc-camp__name" title={row.name}>{row.name}</span>
                    {count !== undefined ? (
                      <span className="dpc-camp__meta">{castCountLine(count)}</span>
                    ) : null}
                  </span>
                  <ChevronRight size={12} strokeWidth={2} aria-hidden="true" className="dpc-camp__chev" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {offering ? (
        <PostSignCampaignOffer
          castName={offer.castName}
          campaigns={available}
          busy={busy}
          refusal={offer.refusal}
          onFile={offer.onFile}
          onNotNow={offer.onNotNow}
          onNever={offer.onNever}
        />
      ) : open ? (
        <div className="dpc-camp__picker">
          {available.length > 0 ? (
            <ul className="dpc-camp__list" aria-label="Your campaigns">
              {available.map((row) => (
                <li key={row.campaignId}>
                  <button
                    type="button"
                    className="dpc-camp__row dpc-camp__row--pick"
                    disabled={busy}
                    onClick={async () => {
                      const why = await onAdd(row.campaignId);
                      if (why === null) close();
                      else setRefusal(why);
                    }}
                  >
                    <CampaignRowIcon />
                    <span className="dpc-camp__text">
                      <span className="dpc-camp__name" title={row.name}>{row.name}</span>
                      <span className="dpc-camp__meta">{castCountLine(row.castCount)}</span>
                    </span>
                    <Plus size={12} strokeWidth={2} aria-hidden="true" className="dpc-camp__chev" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form className="dpc-camp__new" onSubmit={submit}>
            <input
              className="dpc-camp__input"
              value={draft}
              maxLength={CAMPAIGN_NAME_MAX_LENGTH}
              autoFocus
              placeholder="New campaign name"
              aria-label="New campaign name"
              disabled={busy}
              onChange={(event) => {
                setDraft(event.target.value);
                setRefusal(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
              }}
            />
            <button type="submit" className="dpc-camp__create" disabled={busy || draft.trim().length === 0}>
              Create
            </button>
          </form>
          {refusal ? (
            <p className="dpc-camp__refusal" role="alert">{refusal}</p>
          ) : null}
          <button type="button" className="dpc-camp__add" onClick={close}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="dpc-camp__add"
          disabled={!loaded || campaigns === undefined}
          onClick={() => setOpen(true)}
        >
          <Plus size={12} strokeWidth={1.9} aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </section>
  );
}

/** The panel, wired to the store. `castName` is what the post-Sign offer calls the cast. */
export function CastCampaignsCard({ castId, castName }: { castId: string; castName: string }) {
  const utils = trpc.useUtils();
  const memberships = trpc.castingV2.listCastCampaigns.useQuery({ castId }, { enabled: Boolean(castId) });
  const campaigns = trpc.castingV2.listCampaigns.useQuery({});
  const add = trpc.castingV2.addCastsToCampaign.useMutation();
  const create = trpc.castingV2.createCampaign.useMutation();

  /*
    THE POST-SIGN OFFER (#2253). Pending at mount only if this cast was signed
    in this tab a moment ago. The marker is only PEEKED here and taken in the
    effect, so a render that runs twice cannot spend it on the throwaway pass.
    "Don't ask again" is read for the SIGNED-IN ACCOUNT (#2274), so the offer
    waits until that account is known rather than reading anyone else's choice.
  */
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const accountEmail = user?.email ?? null;
  const [offerState, setOfferState] = useState<PostSignOfferState>(() =>
    peekJustSigned(castId) ? "pending" : "gone",
  );
  const [offerRefusal, setOfferRefusal] = useState<string | null>(null);
  useEffect(() => {
    takeJustSigned(castId);
  }, [castId]);
  useEffect(() => {
    if (offerState !== "pending") return;
    /* No account yet: wait. An account with no address on file can still be
       asked; its "don't ask again" has nowhere to live, so it asks again. */
    const silenced = !signedIn ? undefined : accountEmail ? isPostSignOfferSilenced(accountEmail) : false;
    setOfferState(postSignOfferState(offerState, campaigns.data, silenced));
  }, [offerState, campaigns.data, signedIn, accountEmail]);

  /* Every write moves three readings: this panel, the counts, and the library. */
  const refresh = () => {
    void utils.castingV2.listCastCampaigns.invalidate({ castId });
    void utils.castingV2.listCampaigns.invalidate();
    void utils.castingV2.roster.invalidate();
  };

  const file = async (campaignId: string): Promise<string | null> => {
    try {
      await add.mutateAsync({ campaignId, castIds: [castId] });
      return null;
    } catch (error) {
      logRawFailure("castingV2.addCastsToCampaign", error);
      return readableFailure(error, "This cast couldn't be added to that campaign.");
    } finally {
      refresh();
    }
  };

  const onCreate = async (name: string): Promise<string | null> => {
    let campaignId: string;
    try {
      campaignId = (await create.mutateAsync({ name })).campaignId;
    } catch (error) {
      logRawFailure("castingV2.createCampaign", error);
      return readableFailure(error, "That campaign couldn't be made.");
    }
    return file(campaignId);
  };

  const offer: PostSignOfferProps | null =
    offerState === "showing"
      ? {
          castName,
          refusal: offerRefusal,
          onFile: (campaignId) => {
            void file(campaignId).then((why) => {
              if (why === null) setOfferState("gone");
              else setOfferRefusal(why);
            });
          },
          onNotNow: () => setOfferState("gone"),
          onNever: () => {
            if (accountEmail) silencePostSignOffer(accountEmail);
            setOfferState("gone");
          },
        }
      : null;

  return (
    <CastCampaignsPanel
      memberships={memberships.data}
      campaigns={campaigns.data}
      busy={add.isPending || create.isPending}
      onAdd={file}
      onCreate={onCreate}
      offer={offer}
    />
  );
}
