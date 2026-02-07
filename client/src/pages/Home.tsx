/**
 * Home page — thin shell that composes feature sub-components.
 * All section implementations live in @/features/home/.
 */
import {
  Header,
  HeroSection,
  AboutSection,
  WorkSection,
  WhyUsSection,
  ServicesSection,
  ProcessSection,
  FAQSection,
  BlogSection,
  Footer,
} from "@/features/home";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Skip to main content link for accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content">
        <HeroSection />
        <AboutSection />
        <WorkSection />
        <WhyUsSection />
        <ServicesSection />
        <ProcessSection />
        <FAQSection />
        <BlogSection />
      </main>
      <Footer />
    </div>
  );
}
