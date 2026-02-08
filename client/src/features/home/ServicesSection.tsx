import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/design-system";
import { scaleIn, services } from "./homeData";

export function ServicesSection() {
  const [expandedService, setExpandedService] = useState<number | null>(null);
  const [hoveredService, setHoveredService] = useState<number | null>(null);

  const toggleService = (index: number) => {
    setExpandedService(expandedService === index ? null : index);
  };

  return (
    <section id="services" className="py-12 sm:py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        {/* Contained dark card */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          className="bg-[#121212] rounded-2xl sm:rounded-3xl px-4 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-services-header">
            <span className="text-sm sm:text-base font-medium text-white tracking-wide">/ Services</span>
            <span className="text-xs sm:text-sm font-medium text-white/60">(04)</span>
          </div>

          {/* Service List - Accordion */}
          <div className="space-y-1 mb-8 sm:mb-12">
            {services.map((service, index) => {
              const isExpanded = expandedService === index;
              const isHovered = hoveredService === index;
              const showImage = isExpanded || isHovered;
              const showPlus = isExpanded || isHovered;
              
              return (
                <div key={index}>
                  {/* Service Row - Clickable */}
                  <div
                    className="group cursor-pointer py-3 sm:py-4"
                    onClick={() => toggleService(index)}
                    onMouseEnter={() => setHoveredService(index)}
                    onMouseLeave={() => setHoveredService(null)}
                  >
                    <div className="flex items-center justify-between">
                      {/* Left side - Image + Title with slide animation */}
                      <div className="relative flex items-center">
                        {/* Image thumbnail - hidden on mobile, revealed on hover/expand on desktop */}
                        <div className="absolute left-0 w-28 h-16 overflow-hidden rounded-xl hidden sm:block">
                          <img
                            src={service.image}
                            alt={service.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* Title - slides right on hover/expand to reveal image (desktop only) */}
                        <span className={`bg-[#121212] rounded-xl px-2 sm:px-4 py-1 sm:py-2 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight transition-all duration-700 ease-out ${
                          showImage 
                            ? "text-white sm:translate-x-36 translate-x-0" 
                            : "text-white/80 translate-x-0 group-hover:text-white"
                        }`}>
                          {service.title}
                        </span>
                        {service.number > 1 && (
                          <span className="ml-2 sm:ml-3 px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tracking-wide uppercase bg-white/10 text-white/50 rounded-full border border-white/10">
                            Coming Soon
                          </span>
                        )}
                      </div>

                      {/* Right side - Number / Plus / X transitions */}
                      <div className="relative w-10 h-10 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden shrink-0">
                        {/* Number - slides out to the LEFT on hover */}
                        <span 
                          className={`absolute text-[clamp(1.5rem,6vw,5rem)] font-semibold text-white/25 transition-all duration-700 ease-out ${
                            showPlus 
                              ? "-translate-x-12 sm:-translate-x-24 opacity-0" 
                              : "translate-x-0 opacity-100"
                          }`}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {service.number}
                        </span>
                        
                        {/* Plus - slides in from RIGHT, rotates to X on expand */}
                        <span 
                          className={`absolute text-[clamp(1.5rem,6vw,5rem)] font-light text-white/25 transition-all duration-700 ease-out ${
                            isExpanded
                              ? "translate-x-0 -rotate-[135deg]"
                              : isHovered
                                ? "translate-x-0 -rotate-90"
                                : "translate-x-12 sm:translate-x-24 rotate-0 opacity-0"
                          } ${
                            showPlus ? "opacity-100" : "opacity-0"
                          }`}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: 'clamp(40px, 10vw, 110px)' }}
                        >
                          +
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-out ${
                      isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="pb-4 sm:pb-6 pl-0 lg:pl-[calc(7rem+1.5rem)]">
                      {/* Description */}
                      <p className="text-white/60 text-sm sm:text-base leading-relaxed max-w-xl mb-4 sm:mb-6">
                        {service.description}
                      </p>
                      
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {service.items.map((item, itemIndex) => (
                          <span
                            key={itemIndex}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 border border-white/20 rounded-full text-xs sm:text-sm text-white/80"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          <Button href="/#contact" variant="secondary" showPlus>
            Join waitlist
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
