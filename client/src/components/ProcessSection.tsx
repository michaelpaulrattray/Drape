import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Process steps data - adapted for FormaStudio
const processSteps = [
  {
    id: 1,
    number: "01",
    title: "Discovery & Strategy",
    description: "We dive deep into your brand guidelines, visual identity, and business goals to configure the AI specifically for your aesthetic.",
    image: "https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2700&auto=format&fit=crop",
  },
  {
    id: 2,
    number: "02",
    title: "Model Generation",
    description: "Our systems ingest your data to create a custom LoRA model. This ensures every pixel generated adheres strictly to your brand's DNA.",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2670&auto=format&fit=crop",
  },
  {
    id: 3,
    number: "03",
    title: "Automated Scale",
    description: "Once approved, the pipeline opens. Generate thousands of variations for ads, social media, and product listings in minutes, not weeks.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2670&auto=format&fit=crop",
  },
];

export function ProcessSection() {
  const [activeStep, setActiveStep] = useState(0);
  const observerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: "-40% 0px -40% 0px",
      threshold: 0.2,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute("data-index"));
          setActiveStep(index);
        }
      });
    }, options);

    observerRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative w-full bg-zinc-950 text-zinc-100 border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
          
          {/* LEFT COLUMN: Sticky Image Container */}
          <div className="hidden lg:flex relative h-screen sticky top-0 items-center justify-center py-12">
            <div className="relative w-full aspect-[4/5] max-h-[800px] rounded-[2rem] overflow-hidden border border-zinc-800 bg-zinc-900/50">
              
              {/* Dynamic Image Rendering */}
              {processSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "absolute inset-0 w-full h-full transition-all duration-700 ease-in-out transform",
                    activeStep === index
                      ? "opacity-100 scale-100 grayscale-0"
                      : "opacity-0 scale-105 grayscale"
                  )}
                >
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 to-transparent" />
                </div>
              ))}

              {/* Floating Counter Badge */}
              <div className="absolute top-8 right-8 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 px-4 py-2 rounded-full z-20">
                <span className="font-mono text-sm text-zinc-400">
                  <span className="text-white font-semibold">0{activeStep + 1}</span> / 0{processSteps.length}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Scrolling Text Content */}
          <div className="flex flex-col py-24 lg:py-0">
            {/* Intro Header */}
            <div className="lg:h-[50vh] flex flex-col justify-center mb-12 lg:mb-0">
              <div className="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 text-xs font-medium uppercase tracking-wider mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Workflow
              </div>
              <h2 className="text-4xl md:text-6xl font-serif tracking-tight text-white mb-6">
                From Concept to <br />
                <span className="text-zinc-500">Execution.</span>
              </h2>
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-32 lg:gap-0">
              {processSteps.map((step, index) => (
                <div
                  key={step.id}
                  data-index={index}
                  ref={(el) => { if (el) observerRefs.current[index] = el; }}
                  className="flex flex-col justify-center min-h-[50vh] lg:h-screen group"
                >
                  {/* Mobile Image (Visible only on small screens) */}
                  <div className="lg:hidden w-full aspect-video rounded-2xl overflow-hidden mb-8 border border-zinc-800">
                    <img 
                      src={step.image} 
                      alt={step.title} 
                      className="w-full h-full object-cover" 
                    />
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <span className="flex items-center justify-center w-12 h-12 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono text-sm group-hover:border-orange-500/50 group-hover:text-orange-400 transition-colors duration-300">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-3xl md:text-5xl font-medium text-white mb-6 tracking-tight">
                    {step.title}
                  </h3>
                  
                  <p className="text-lg text-zinc-400 font-light leading-relaxed max-w-md mb-8">
                    {step.description}
                  </p>

                  <div className="flex items-center gap-4 opacity-50 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-4 group-hover:translate-y-0">
                    <Button variant="outline" className="border-zinc-700 hover:bg-white hover:text-black">
                      Learn More <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Bottom spacer to allow last item to scroll fully into view */}
            <div className="h-[20vh]" />
          </div>
        </div>
      </div>
    </section>
  );
}
