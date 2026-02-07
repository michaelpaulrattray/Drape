import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/design-system";
import { fadeIn, fadeInUp, faqs } from "./homeData";
import { SectionLabel } from "./SectionLabel";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="FAQs" number="08" />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left - Headline */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2 className="text-section-title leading-[1.1] mb-8 text-dark">
              Wondering How We Work?
            </h2>
            <p className="text-body-md text-gray-secondary mb-8">
              Answers to common questions about our process, services, and how we work.
            </p>
            <Button href="/#contact" variant="secondary-invert" showPlus>
              Contact us
            </Button>
          </motion.div>

          {/* Right - Accordion in #EBEBEB container */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2">
            <div className="flex flex-col">
              {faqs.map((faq, index) => (
                <div 
                  key={index} 
                  className={`bg-white rounded-xl ${index < faqs.length - 1 ? 'mb-1' : ''}`}
                >
                  <button
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="font-medium text-[#0A0A0A] text-lg">{index + 1}. {faq.question}</span>
                    <div className="w-6 h-6 rounded-full border border-[#0A0A0A]/20 flex items-center justify-center flex-shrink-0">
                      <Plus
                        className={`w-3 h-3 text-[#0A0A0A] transition-transform duration-700 ease-out ${
                          openIndex === index ? "rotate-45" : ""
                        }`}
                      />
                    </div>
                  </button>
                  <div 
                    className={`overflow-hidden transition-all duration-500 ${
                      openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-5 pb-5">
                      <p className="text-[#757575]">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
