import { motion } from "framer-motion";
import { Button } from "@/components/design-system";
import { fadeIn, fadeInUp, staggerContainer, blogPosts } from "./homeData";
import { SectionLabel } from "./SectionLabel";

export function BlogSection() {
  return (
    <section id="blog" className="py-12 sm:py-24 bg-white">
      <div className="max-w-[1520px] mx-auto container-full-bleed">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeIn}
        >
          <SectionLabel label="Blog" number="09" />
        </motion.div>

        {/* Header with title and button */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-0 mb-8 sm:mb-16"
        >
          <div>
            <h2 className="text-section-title text-[#0A0A0A] mb-4">Latest insights from our blog.</h2>
            <p className="text-body-md text-gray-muted w-full sm:w-[330px]">Thoughts, ideas, and perspectives on design, simplicity, and creative process.</p>
          </div>
          <Button href="#" variant="secondary-invert" showPlus className="hidden md:inline-flex mt-[100px] font-medium">
            View all articles
          </Button>
        </motion.div>

        {/* Blog Grid - Drape style: Featured (50%) + Two cards side by side (25% each) */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid sm:grid-cols-2 md:grid-cols-4 gap-1 items-start"
        >
          {/* Featured Post (First - Large with text overlay, spans 2 columns) */}
          <a
            href="#"
            className="group block rounded-2xl overflow-hidden bg-[#EBEBEB] hover:bg-[#0A0A0A] transition-colors duration-500 md:col-span-2 md:row-span-2"
          >
            <div className="relative h-full min-h-[300px] sm:min-h-[500px] overflow-hidden rounded-xl m-1.5">
              <img
                src={blogPosts[0].image}
                alt={blogPosts[0].title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {/* Dark gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {/* Category badge */}
              <span className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-[#0A0A0A]">
                {blogPosts[0].category}
              </span>
              {/* Text overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="text-sm text-white/70">{blogPosts[0].date}</span>
                <h3 className="text-xl font-semibold text-white mt-2 mb-2">
                  {blogPosts[0].title}
                </h3>
                <p className="text-sm text-white/80 line-clamp-2">{blogPosts[0].excerpt}</p>
              </div>
            </div>
          </a>

          {/* Second and Third cards - each takes 1 column, side by side */}
          {blogPosts.slice(1, 3).map((post, index) => (
            <a
              key={index}
              href="#"
              className="group block"
            >
              {/* Card with image */}
              <div className="rounded-2xl overflow-hidden bg-[#EBEBEB] group-hover:bg-[#0A0A0A] transition-colors duration-500">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl m-1.5">
                  <img
                    src={post.image}
                    alt={post.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Category badge */}
                  <span className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-[#0A0A0A]">
                    {post.category}
                  </span>
                </div>
              </div>
              {/* Text below card */}
              <div className="pt-4 pb-2">
                <span className="text-sm text-[#757575]">{post.date}</span>
                <h3 className="text-lg font-semibold text-[#0A0A0A] mt-1 mb-1 group-hover:text-[#0A0A0A]/70 transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-[#757575] line-clamp-2">{post.excerpt}</p>
              </div>
            </a>
          ))}
        </motion.div>

        {/* Mobile view all link */}
        <Button href="#" variant="secondary-invert" showPlus className="md:hidden mt-8 font-medium">
          View all articles
        </Button>
      </div>
    </section>
  );
}
