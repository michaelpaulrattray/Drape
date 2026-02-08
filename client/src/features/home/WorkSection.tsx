import { motion } from "framer-motion";
import { Button } from "@/components/design-system";
import { fadeInUp, staggerContainer, projects } from "./homeData";

export function WorkSection() {
  return (
    <section id="work" className="py-12 sm:py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        {/* Header with subtext and button */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-0 mb-8 sm:mb-16"
        >
          <div>
            <h2 className="text-section-title leading-[1.1] tracking-tight text-[#0A0A0A] mb-4">Selected Work.</h2>
            <p className="text-body-md text-gray-muted max-w-sm">
              A curated selection of projects that reflect our commitment to simplicity and purposeful design.
            </p>
          </div>
          <Button href="#" variant="secondary-invert" showPlus className="sm:mt-[100px] font-medium">
            View all projects
          </Button>
        </motion.div>

        {/* Project Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid sm:grid-cols-2 gap-1"
        >
          {projects.map((project, index) => (
            <a
              key={index}
              href="#"
              className="group block rounded-2xl overflow-hidden transition-all duration-500 bg-[#EBEBEB] hover:bg-[#0A0A0A]"
            >
              {/* Image Container with zoom effect - border stays constant */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl m-1.5">
                <img
                  src={project.image}
                  alt={project.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              {/* Info Bar with text replacement scroll animation */}
              <div className="flex items-center justify-between p-4 pt-3">
                <div className="overflow-hidden">
                  {/* Project Name - stacked text */}
                  <div className="relative h-6 overflow-hidden">
                    <h3 className="text-lg font-semibold text-[#0A0A0A] transition-transform duration-500 group-hover:-translate-y-full">{project.name}</h3>
                    <h3 className="text-lg font-semibold text-white absolute top-full left-0 transition-transform duration-500 group-hover:-translate-y-full">{project.name}</h3>
                  </div>
                  {/* Category - stacked text */}
                  <div className="relative h-5 overflow-hidden">
                    <p className="text-sm text-[#4D4D4D] transition-transform duration-500 group-hover:-translate-y-full">{project.category}</p>
                    <p className="text-sm text-white/60 absolute top-full left-0 transition-transform duration-500 group-hover:-translate-y-full">{project.category}</p>
                  </div>
                </div>
                {/* Year - stacked text */}
                <div className="relative h-5 overflow-hidden">
                  <span className="text-sm text-[#0A0A0A]/40 block transition-transform duration-500 group-hover:-translate-y-full">{project.year}</span>
                  <span className="text-sm text-white/50 absolute top-full left-0 transition-transform duration-500 group-hover:-translate-y-full">{project.year}</span>
                </div>
              </div>
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
