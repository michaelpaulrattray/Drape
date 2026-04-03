/**
 * Home page — hero-only landing with fullscreen video background,
 * glassmorphism navbar, headline + waitlist CTA, and partner names.
 *
 * Layout matches celestial-horizon reference exactly.
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

      {/* ── Powered by Gemini badge ── */}
      <div className="fixed bottom-6 right-6 z-50">
        <a
          href="https://deepmind.google/technologies/gemini/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-geist font-medium text-white/90 hover:text-white transition-colors bg-black/40 backdrop-blur-md border border-white/10 shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C14 7.732 7.732 14 0 14C7.732 14 14 20.268 14 28C14 20.268 20.268 14 28 14C20.268 14 14 7.732 14 0Z" fill="url(#gemini-gradient)"/>
            <defs>
              <linearGradient id="gemini-gradient" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4285F4"/>
                <stop offset="0.5" stopColor="#9B72CB"/>
                <stop offset="1" stopColor="#D96570"/>
              </linearGradient>
            </defs>
          </svg>
          Powered by Gemini
        </a>
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
