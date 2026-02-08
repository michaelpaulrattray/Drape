import { motion } from "framer-motion";
import { Button } from "@/components/design-system";
import { fadeIn, fadeInUp, staggerContainer, testimonials } from "./homeData";
import { SectionLabel } from "./SectionLabel";

export function WhyUsSection() {
  return (
    <section className="py-12 sm:py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="Why us" number="03" />
        </motion.div>

        {/* Two-tone Headline - smaller size, font-weight 500 */}
        <motion.h2 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-[clamp(2rem,5vw,3.375rem)] font-medium leading-[1.15] mb-8 sm:mb-16 w-full lg:w-[1018px]"
        >
          <span className="text-[#0A0A0A]">We cut through noise to create designs that are </span>
          <span className="text-gray-secondary">thoughtful, timeless, and impactful.</span>
        </motion.h2>

        {/* 4-Column Bento Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1"
        >
          {/* Card 1 - #EBEBEB outer with 2 inner cards */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2 flex flex-col gap-2">
            {/* Top: Dark card with building image */}
            <div className="relative rounded-xl overflow-hidden bg-[#0A0A0A] min-h-[240px] h-bento-card flex flex-col justify-between">
              <img
                src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80"
                alt="Architecture"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale"
              />
              <div className="relative z-10 p-5">
                <h3 className="text-card-title font-semibold text-white leading-tight">Purposeful Design<br />for Modern Brands.</h3>
                <p className="text-white/50 text-xs mt-2">© 2025</p>
              </div>
              <div className="relative z-10 p-5 pt-0">
                <Button href="/#contact" variant="secondary" size="sm" showPlus>
                  Get started
                </Button>
              </div>
            </div>
            {/* Bottom: Bullet list card */}
            <div className="bg-white rounded-xl p-4">
              <ul className="space-y-2">
                {["Collaborative Approach", "Quick turnaround", "Clear Communication", "Consistent Quality", "Reliable Support"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-body-md text-[#0A0A0A]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Card 2 - #EBEBEB single card with background content */}
          <div className="bg-[#EBEBEB] rounded-2xl p-5 flex flex-col justify-between min-h-[400px]">
            {/* Top: Clients/avatars */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex -space-x-2">
                  {["photo-1494790108377-be9c29b29330", "photo-1507003211169-0a1dd7228f2d", "photo-1438761681033-6461ffad8d80", "photo-1472099645785-5658abf4ff4e"].map((id, i) => (
                    <img
                      key={i}
                      src={`https://images.unsplash.com/${id}?w=100&q=80`}
                      alt="Client"
                      className="w-9 h-9 rounded-full border-2 border-[#EBEBEB] object-cover"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-[#0A0A0A]">4.9/5</span>
                  <svg className="w-3.5 h-3.5 text-[#0A0A0A] fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm"><span className="font-semibold text-[#0A0A0A]">100+</span> <span className="text-[#757575]">Happy clients worldwide</span></p>
            </div>
            {/* Bottom: Testimonial */}
            <div>
              <div className="flex items-center gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3 h-3 text-[#0A0A0A] fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-body-md text-[#0A0A0A] mb-4">
                "{testimonials[0].quote}"
              </blockquote>
              <div className="flex items-center gap-3">
                <img
                  src={testimonials[0].image}
                  alt={testimonials[0].name}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">{testimonials[0].name}</p>
                  <p className="text-xs text-[#757575]">{testimonials[0].title}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 - #EBEBEB outer with 3 white module cards */}
          <div className="bg-[#EBEBEB] rounded-2xl p-2 flex flex-col gap-2">
            {[
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, title: "Streamlined Process", desc: "Our focused, step-by-step approach saves time and keeps projects moving smoothly." },
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>, title: "Scalable Design", desc: "We create systems that grow with your brand and stay effective over time." },
              { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, title: "24/7 Dedicated Support", desc: "We're always here when you need us, ready to answer questions, provide updates." },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-4 flex-1">
                <div className="text-[#0A0A0A] mb-3">{feature.icon}</div>
                <h4 className="font-semibold text-[#0A0A0A] text-lg mb-1.5">{feature.title}</h4>
                <p className="text-body-md text-gray-secondary">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Column 4 - Tall dark card with silhouette */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0A0A0A] min-h-[300px] sm:min-h-[500px] md:min-h-full flex flex-col justify-between">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80"
              alt="Silhouette"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale"
            />
            <div className="relative z-10 p-6 text-right">
              <span className="text-white/80 text-lg font-medium mr-20">Forma®</span>
            </div>
            <div className="relative z-10 p-6">
              <h3 className="text-2xl font-semibold text-white leading-tight">Design with intent.</h3>
              <p className="text-white/60 text-sm mt-1">No excess, no fluff.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
