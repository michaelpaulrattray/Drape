/**
 * Home page — hero-only landing with fullscreen video background,
 * glassmorphism navbar, headline + waitlist CTA, and partner names.
 *
 * Layout matches celestial-horizon reference exactly — with ONE deliberate
 * departure from it, so that "matches the reference exactly" is never read as
 * an instruction to put it back: **the reference's fixed corner badge naming an
 * engine is gone (#1560).** It sat at bottom-right on every scroll position and
 * said *Powered by Gemini*, linking out to deepmind.google, and it arrived with
 * the scaffold-era homepage redesign rather than by anyone's decision. The
 * disappearing-technology law's one narrow prohibition names exactly it — *no
 * engine name on a path someone must walk to reach their picture* — and by
 * 2026-09-30 it had also stopped being true: a roll renders on GPT Image 2.5
 * Sunburst and a signed view on Nano Banana Pro, both through fal, neither
 * through Google AI Studio. The first picture anybody gets is not a Google
 * model's.
 *
 * `client/src/features/home/landingEngineNames.test.ts` keeps it out.
 */
import { useState } from "react";
import { HomeNavbar } from "@/features/home/HomeNavbar";
import { HeroContent } from "@/features/home/HeroContent";
import { PartnersBar } from "@/features/home/PartnersBar";
import { WaitlistModal } from "@/features/home/WaitlistModal";
import { VideoPreviewModal } from "@/features/home/VideoPreviewModal";

// Proxied through /api/hero/video to bypass preview iframe URL safety check.
// TODO: Switch back to direct CDN URL before launch for better performance.
const VIDEO_URL = "/api/hero/video";

export default function Home() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* ── Background Video — hero only ── */}
      <div className="absolute inset-0 z-0" style={{ height: "100vh" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/35 z-0" />
      </div>

      {/* ── Gradient fade to white ── */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent to-white z-[1] pointer-events-none"
        style={{ top: "60vh", height: "40vh" }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col">
        <HomeNavbar onClaimSpot={() => setWaitlistOpen(true)} />
        <div className="min-h-screen flex flex-col justify-center">
          <HeroContent onPlayDemo={() => setDemoOpen(true)} />
          <PartnersBar />
        </div>
      </div>

      {/* ── Waitlist Modal (triggered by "Claim a Spot" CTA) ── */}
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
      />

      {/* ── Video Preview Modal (triggered by "See it in action") ── */}
      <VideoPreviewModal
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
      />
    </div>
  );
}
