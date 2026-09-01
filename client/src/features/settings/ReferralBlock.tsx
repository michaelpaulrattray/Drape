/**
 * Refer a friend — a BLOCK inside Settings → Billing (brief §9).
 *
 * *"Referral credits are billing, so this is not a seventh nav section. A
 * section visited twice a year should not own a permanent nav row."* It
 * replaces `ReferralModal` entirely.
 *
 * ## Two things the brief writes as numbers, and this reads off the server
 * (BRIEF-RECONCILIATION Q3)
 *
 * - **`500 credits … up to 250,000 a year`** is the mockup's arithmetic. Ours
 *   is `REFERRAL_REWARD_CREDITS` and `REFERRAL_LIFETIME_CAP`, both returned by
 *   `referral.getMyCode` / `getStats`, and the cap is a **lifetime** cap rather
 *   than an annual one. The sentence is built from those two fields, so a
 *   pricing change moves the copy and nobody has to remember to.
 * - **`0 / 250,000` is not rendered at all** — §9: *"Never show a zero as an
 *   achievement. The current ReferralModal renders `0 / 250,000` and `0 / 0` in
 *   large type, in the position reserved for progress — showing someone their
 *   nothing."* The earnings line appears only once there is some, and the cap
 *   lives in the promise rather than as a denominator.
 */
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button, Field, Input } from "@/foundation";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

export function ReferralBlock() {
  const [email, setEmail] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [code, setCode] = useState("");

  const { data: myCode } = trpc.referral.getMyCode.useQuery();
  const { data: stats } = trpc.referral.getStats.useQuery();
  const { data: history } = trpc.referral.getHistory.useQuery(undefined, {
    enabled: showHistory,
  });
  const utils = trpc.useUtils();

  const sendInvite = trpc.referral.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent.");
      setEmail("");
    },
    onError: (error) => {
      logRawFailure("referral.sendInvite", error);
      toast.error(readableFailure(error, "That invitation could not be sent."));
    },
  });

  const redeem = trpc.referral.redeem.useMutation({
    onSuccess: () => {
      toast.success("Code redeemed.");
      setCode("");
      setRedeeming(false);
      void utils.referral.getStats.invalidate();
    },
    onError: (error) => {
      logRawFailure("referral.redeem", error);
      toast.error(readableFailure(error, "That code could not be redeemed."));
    },
  });

  const reward = myCode?.rewardCredits ?? stats?.rewardCredits ?? 0;
  const cap = stats?.lifetimeCap ?? 0;
  const earned = stats?.totalCreditsEarned ?? 0;
  const joined = stats?.completedReferrals ?? 0;

  const copyLink = async () => {
    if (!myCode?.referralLink) return;
    try {
      await navigator.clipboard.writeText(myCode.referralLink);
      toast.success("Link copied.");
    } catch {
      toast.error("That link could not be copied.");
    }
  };

  return (
    <div className="dp-ref">
      <div>
        <p className="dp-set__grouphead">Refer a friend</p>
        <p className="dp-set__note">
          {reward > 0
            ? `They get ${reward.toLocaleString()} credits on their first signed cast, and so do you${
                cap > 0 ? ` — up to ${cap.toLocaleString()} in total` : ""
              }.`
            : "Invite someone to the studio."}
        </p>
      </div>

      <div className="dp-ref__fields">
        <div className="dp-ref__field">
          <span className="dp-set__minilabel">SHARE LINK</span>
          <span className="dp-ref__inputrow">
            <span className="dp-ref__link">{myCode?.referralLink ?? "—"}</span>
            <Button variant="secondary" size="small" onClick={copyLink}>
              Copy
            </Button>
          </span>
        </div>
        <div className="dp-ref__field">
          <span className="dp-set__minilabel">INVITE BY EMAIL</span>
          <span className="dp-ref__inputrow">
            <Field compact className="dp-ref__input">
              <Input
                type="email"
                value={email}
                placeholder="name@company.com"
                aria-label="Invite by email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              size="small"
              disabled={!email.trim() || sendInvite.isPending}
              onClick={() => sendInvite.mutate({ email: email.trim() })}
            >
              Send
            </Button>
          </span>
        </div>
      </div>

      <div className="dp-ref__foot">
        {/* Progress only once there IS some — never a zero as an achievement. */}
        {joined > 0 || earned > 0 ? (
          <span className="dp-set__note">
            {joined > 0 ? `${joined} ${joined === 1 ? "friend" : "friends"} joined` : null}
            {joined > 0 && earned > 0 ? " · " : null}
            {earned > 0 ? `${earned.toLocaleString()} credits earned so far` : null}
          </span>
        ) : null}
        <span className="dp-set__spacer" />
        {redeeming ? (
          <span className="dp-ref__inputrow">
            <Field compact className="dp-set__field dp-set__field--narrow">
              <Input
                value={code}
                placeholder="Code"
                aria-label="Referral code"
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
            <Button
              variant="secondary"
              size="small"
              disabled={!code.trim() || redeem.isPending}
              onClick={() => redeem.mutate({ code: code.trim() })}
            >
              Redeem
            </Button>
          </span>
        ) : (
          <button type="button" className="dp-set__linkbtn" onClick={() => setRedeeming(true)}>
            Redeem a code
          </button>
        )}
        <button
          type="button"
          className="dp-set__linkbtn"
          onClick={() => setShowHistory((open) => !open)}
        >
          {showHistory ? "Hide who has joined" : "Who has joined ›"}
        </button>
      </div>

      {showHistory ? (
        <div>
          {(history ?? []).length === 0 ? (
            <p className="dp-set__note">Nobody has joined on your link yet.</p>
          ) : (
            (history ?? []).map((entry, index) => (
              <div className="dp-set__invoice" key={`${entry.status}-${index}`}>
                <span>{entry.status}</span>
                <span className="dp-set__spacer" />
                <span className="dp-set__value">
                  {(entry.creditsAwarded ?? 0).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
