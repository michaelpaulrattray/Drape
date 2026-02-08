import { motion } from "framer-motion";
import { Button } from "@/components/design-system";
import { fadeIn, fadeInUp, processSteps } from "./homeData";
import { SectionLabel } from "./SectionLabel";

export function ProcessSection() {
  return (
    <section className="py-12 sm:py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="Process" number="05" />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 sm:gap-16">
          {/* Left - Headline */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-section-title leading-[1.1] mb-8 text-dark">
              Our process is simple, purposeful, and adaptable.
            </h2>
            <p className="text-body-md text-gray-secondary mb-8">
              We believe great design is a result of clarity, collaboration, and craft.
            </p>
            <Button href="/#contact" variant="secondary-invert" showPlus>
              Let's talk
            </Button>
          </motion.div>

          {/* Right - Steps in big card container */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2">
            <div className="flex flex-col">
              {processSteps.map((step, index) => (
                <div 
                  key={index} 
                  className={`bg-white rounded-xl p-6 ${index < processSteps.length - 1 ? 'mb-1' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-card-title font-bold text-[#0A0A0A]">{step.title}</h3>
                    <span className="text-sm text-[#0A0A0A]/30">{step.number}</span>
                  </div>
                  <p className="text-body-md text-gray-secondary">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
