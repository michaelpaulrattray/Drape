/**
 * Home page — hero-only landing with fullscreen video background,
 * glassmorphism navbar, headline + waitlist CTA, and partner marquee.
 */
import { HomeNavbar } from "@/features/home/HomeNavbar";
import { HeroContent } from "@/features/home/HeroContent";
import { PartnersBar } from "@/features/home/PartnersBar";

const MUX_VIDEO_SRC =
  "https://stream.mux.com/jxEf6XiJs00yfbQgSHjypHNMCZDsNjSo/high.mp4";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* ── Fullscreen Video Background ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src={MUX_VIDEO_SRC}
      />

      {/* ── Dark overlay + bottom gradient fade ── */}
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent" />

      {/* ── Content layer ── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <HomeNavbar />

        {/* Hero — vertically centered */}
        <div className="flex-1 flex items-center justify-center">
          <HeroContent />
        </div>

        {/* Partners marquee at bottom */}
        <PartnersBar />

        {/* Powered by badge — bottom right */}
        <div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-60">
          <span className="font-body text-xs text-white/70 tracking-wider uppercase">
            Powered by Gemini
          </span>
        </div>
      </div>
    </div>
  );
}
