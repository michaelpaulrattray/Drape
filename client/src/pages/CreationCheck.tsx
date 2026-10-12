import { useEffect } from "react";
import { Link, useRoute } from "wouter";

import { KliegWordmark } from "@/foundation/KliegWordmark";
import { trpc } from "@/lib/trpc";
import {
  CreationCheckRecordView,
  NoPublicRecordView,
} from "@/features/castingV2/creationCheck/CreationCheckRecord";
import {
  PUBLIC_CHECK_CHECKING,
  PUBLIC_CHECK_HEADING,
  PUBLIC_CHECK_TOO_MANY,
  PUBLIC_CHECK_UNAVAILABLE,
} from "@shared/creationCheckCopy";
import "@/features/castingV2/creationCheck/creationCheck.css";

/**
 * THE PUBLIC CHECK PAGE — `/check/:kliegId` (N2d-3, #2313).
 *
 * Anyone, signed in or not, holding a Klieg ID whose owner turned this page on
 * can confirm the ID is real and when the character was made — and see
 * nothing else (design §1, §3; `docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`).
 *
 * It owns no gate of its own because it needs none: the one call it makes,
 * `creationCheck.lookup`, is the enumerated public endpoint, and an ID that is
 * unknown, private or deleted comes back as the same `{ found: false }` — so
 * this page draws one "No public record for this ID" for all three and cannot
 * tell them apart even if it wanted to. No picture is ever on this page; the
 * server never sends one.
 */
export default function CreationCheck() {
  const [, params] = useRoute("/check/:kliegId");
  const kliegId = params?.kliegId ? decodeURIComponent(params.kliegId) : "";
  const lookup = trpc.creationCheck.lookup.useQuery(
    { kliegId },
    { enabled: kliegId.length > 0 && kliegId.length <= 32, retry: false, refetchOnWindowFocus: false },
  );

  const found = lookup.data?.found === true ? lookup.data : null;
  useEffect(() => {
    document.title = found
      ? `${found.kliegId} · ${PUBLIC_CHECK_HEADING} · Klieg`
      : `${PUBLIC_CHECK_HEADING} · Klieg`;
  }, [found]);

  const tooMany = (lookup.error as { data?: { code?: string } } | null)?.data?.code === "TOO_MANY_REQUESTS";
  const settled = !lookup.isLoading || kliegId.length === 0 || kliegId.length > 32;

  return (
    <div className="dp-root">
      <div className="dpx-checkpage">
        <Link href="/" className="dpx-checkpage__mark" aria-label="Klieg">
          <KliegWordmark fontSize={20} />
        </Link>
        <main className="dpx-checkpage__main">
          <div className="dpx-checkpage__card" aria-busy={!settled}>
            {!settled ? (
              <p className="dpx-checkpage__status" role="status">{PUBLIC_CHECK_CHECKING}</p>
            ) : tooMany ? (
              <p className="dpx-checkpage__status" role="alert">{PUBLIC_CHECK_TOO_MANY}</p>
            ) : found ? (
              <CreationCheckRecordView record={found} />
            ) : lookup.error ? (
              <p className="dpx-checkpage__status" role="alert">{PUBLIC_CHECK_UNAVAILABLE}</p>
            ) : (
              <NoPublicRecordView />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
