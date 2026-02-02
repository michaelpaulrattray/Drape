import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

// Process steps data
const processSteps = [
  {
    id: 1,
    number: "01",
    title: "Share Your Vision + Guidelines",
    description: "A simple brief or a 15-minute sync is all we need. We digest your brand guidelines, goals, and aesthetic preferences to build a custom model that understands your visual language.",
    cta: "Start a project",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop",
  },
  {
    id: 2,
    number: "02",
    title: "(Intelligent) Model Generation",
    description: "We configure our AI models to your style. Instead of generic outputs, you get high-fidelity options tailored to your specific campaign needs in hours, not weeks.",
    cta: "See examples",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&auto=format&fit=crop",
  },
  {
    id: 3,
    number: "03",
    title: "Launch & Automated Scaling",
    description: "Receive production-ready assets for every platform. We can even set up automated pipelines so your content scales effortlessly as your audience grows.",
    cta: "Scale now",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&auto=format&fit=crop",
  },
];

export default function StickyScrollSection() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const sectionRect = sectionRef.current.getBoundingClientRect();
      const sectionTop = sectionRect.top;
      const viewportHeight = window.innerHeight;

      // Only update when section is in view
      if (sectionTop > viewportHeight || sectionRect.bottom < 0) return;

      // Find which step is most visible
      let closestStep = 0;
      let closestDistance = Infinity;

      stepsRef.current.forEach((step, index) => {
        if (!step) return;
        const rect = step.getBoundingClientRect();
        const stepCenter = rect.top + rect.height / 2;
        const viewportCenter = viewportHeight / 2;
        const distance = Math.abs(stepCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestStep = index;
        }
      });

      setActiveStep(closestStep);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="relative bg-zinc-950 border-b border-zinc-900/50"
    >
      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          
          {/* Left Column: Sticky Image Wrapper */}
          <div className="hidden lg:block relative h-full min-h-screen border-r border-zinc-800/50">
            <div className="sticky top-0 h-screen w-full flex items-center justify-center p-12 lg:p-16">
              <div className="relative w-full h-[85vh] max-h-[800px] flex items-start">
                
                {/* Dynamic Image Container */}
                <div className="relative w-3/4 h-full overflow-hidden">
                  {processSteps.map((step, index) => (
                    <img
                      key={step.id}
                      src={step.image}
                      alt={`Process Step ${step.number}`}
                      className={`absolute inset-0 w-full h-full object-cover grayscale opacity-90 transition-all duration-700 ease-out ${
                        activeStep === index 
                          ? "opacity-90 scale-100" 
                          : "opacity-0 scale-105"
                      }`}
                    />
                  ))}
                </div>

                {/* Large Sticky Number */}
                <div className="absolute -right-4 top-8 z-20">
                  <span 
                    className="font-geist text-7xl lg:text-8xl text-zinc-100/90 tracking-tight transition-all duration-500"
                  >
                    {processSteps[activeStep]?.number || "01"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Scrolling Text */}
          <div className="px-6 md:px-12 py-24 md:py-32 flex flex-col gap-32 lg:gap-64 relative">
            
            {/* Mobile Header */}
            <div className="lg:hidden mb-8">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1 mb-6 tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-orange" />
                Process
              </div>
              <h2 className="text-4xl md:text-5xl font-geist font-semibold text-white tracking-tight">
                How it works
              </h2>
            </div>

            {/* Steps */}
            {processSteps.map((step, index) => (
              <div
                key={step.id}
                ref={(el) => { stepsRef.current[index] = el; }}
                className="group flex flex-col justify-center min-h-[40vh]"
              >
                {/* Mobile Number */}
                <span className="lg:hidden text-6xl font-geist text-zinc-700 mb-6 block">
                  {step.number}
                </span>

                {/* Mobile Image */}
                <div className="lg:hidden mb-8 relative aspect-[4/3] overflow-hidden">
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-full object-cover grayscale"
                  />
                </div>

                <h3 className="text-4xl md:text-5xl lg:text-6xl font-geist font-semibold text-zinc-100 tracking-tight mb-8 group-hover:text-white transition-colors">
                  {step.title}
                </h3>
                <p className="text-lg md:text-xl text-zinc-400 font-light leading-relaxed max-w-lg mb-10">
                  {step.description}
                </p>
                <a 
                  href="#contact" 
                  className="text-sm uppercase tracking-widest font-medium text-white border-b border-zinc-600 pb-1 w-fit hover:border-white hover:text-orange transition-all flex items-center gap-2 group/link"
                >
                  {step.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
