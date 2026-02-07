/**
 * Home page shared data, types, and animation variants.
 * All Home sub-components import from this single source.
 */
import type { Variants } from "framer-motion";

// ============ EASING CURVES ============

export const easeOut: [number, number, number, number] = [0, 0, 0.2, 1];
export const easeInOut: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

// ============ ANIMATION VARIANTS ============

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeInOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: easeOut },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: easeOut },
  },
};

// ============ TYPES ============

export interface ClientLogo {
  name: string;
  logo: string;
}

export interface StatsMarqueeItem {
  value: string;
  label: string;
}

export interface Project {
  name: string;
  year: string;
  category: string;
  image: string;
}

export interface Service {
  title: string;
  number: number;
  description: string;
  items: string[];
  image: string;
}

export interface ProcessStep {
  title: string;
  number: number;
  description: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  title: string;
  image: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface BlogPost {
  date: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
}

// ============ DATA ============

export const clientLogos: ClientLogo[] = [
  { name: "Google", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/KWvxGyeHeOdCWDBA.svg" },
  { name: "Shopify", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/RrYrMQAByeXLDYvF.svg" },
  { name: "Meta", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/IVQzagtquxBRPCYL.svg" },
  { name: "Nike", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/TiXyLFbvFHbHEbTs.svg" },
  { name: "Facebook", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/OeUyRoFtFBfOvhUj.svg" },
  { name: "Instagram", logo: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/mikmpxOOFgYakoyl.svg" },
];

export const statsMarqueeItems: StatsMarqueeItem[] = [
  { value: "97%", label: "Customer satisfaction rate" },
  { value: "6", label: "Industry awards" },
  { value: "15+", label: "Years of Experience" },
  { value: "140+", label: "Projects completed" },
  { value: "100+", label: "Customer satisfaction rate" },
];

export const projects: Project[] = [
  { name: "Lune", year: "2025", category: "App Visual Direction", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80" },
  { name: "Aren", year: "2025", category: "Fashion Brand Launch", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80" },
  { name: "Oura", year: "2024", category: "Brand Refinement", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80" },
  { name: "Forma", year: "2024", category: "Product UI", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80" },
  { name: "Oko", year: "2023", category: "Portfolio Website", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80" },
  { name: "Velin", year: "2022", category: "Skincare Rebrand", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80" },
];

export const services: Service[] = [
  {
    title: "Model Identity",
    number: 1,
    description: "We generate unique, consistent AI model identities for your brand with photorealistic quality and complete creative control.",
    items: ["Model Generation", "Identity Systems", "Character Guidelines", "Ethnicity & Aesthetic", "Pose Libraries", "Expression Ranges"],
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
  },
  {
    title: "Outfit Generation",
    number: 2,
    description: "We create any outfit on your AI models. From streetwear to haute couture, no physical samples needed.",
    items: ["Virtual Try-On", "Garment Design", "Fabric Simulation", "Color Variants", "Style Matching", "Seasonal Collections"],
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80",
  },
  {
    title: "Campaign Production",
    number: 3,
    description: "Full photoshoot generation with complete lighting and environment control for campaign-ready assets.",
    items: ["Scene Composition", "Lighting Design", "Background Generation", "Multi-angle Shots", "Post-processing", "Asset Delivery"],
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
  },
  {
    title: "Brand Consistency",
    number: 4,
    description: "Maintain perfect visual consistency across all channels with AI-powered brand asset generation.",
    items: ["Style Guidelines", "Asset Libraries", "Cross-platform Assets", "Brand Templates", "Quality Control", "Version Management"],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
  },
];

export const processSteps: ProcessStep[] = [
  { title: "Discover", number: 1, description: "We begin by listening, gaining a deep understanding of your goals, audience, and creative vision through research and conversation." },
  { title: "Define", number: 2, description: "We distill insights into a clear direction. Strategy, model specifications, and creative foundations are established to guide the work forward." },
  { title: "Generate", number: 3, description: "Ideas take shape through AI generation. We explore, refine, and iterate with intention, always rooted in purpose and brand alignment." },
  { title: "Deliver", number: 4, description: "We finalize and hand off with care. Every asset is prepared for implementation with clarity, consistency, and attention to detail." },
];

export const testimonials: Testimonial[] = [
  { quote: "FormaStudio understood our brand better than we did. Their ability to generate the perfect model identities is what sets them apart.", name: "Sofia Ford", title: "Creative Director", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
  { quote: "Working with FormaStudio felt effortless. They have a rare ability to take complex briefs and distill them into something beautifully simple.", name: "Emma V.", title: "Founder", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" },
  { quote: "FormaStudio doesn't just generate images—they listen, interpret, and then create with precision.", name: "Julian M.", title: "Creative Director", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" },
];

export const faqs: FAQ[] = [
  { question: "What kind of clients do you work with?", answer: "We work with fashion brands, e-commerce companies, and creative teams who value consistency, speed, and photorealistic quality. Whether you're launching something new or scaling an existing presence, we adapt our approach to your needs." },
  { question: "What services do you offer?", answer: "Our core services include AI model casting, outfit generation, campaign production, and brand consistency systems. We often work across multiple touchpoints to ensure cohesion in everything we create." },
  { question: "How do you price your projects?", answer: "We price based on scope, timeline, and deliverables—never by the hour. After a discovery call, we'll provide a custom proposal aligned with your goals and budget." },
  { question: "What is your typical project timeline?", answer: "Timelines vary by project, but most model generation projects take 1-2 weeks, while full campaign projects may range from 2-4 weeks. We'll always agree on key milestones before starting." },
  { question: "Can we collaborate remotely?", answer: "Absolutely. All of our work is done remotely, and we've partnered successfully with clients across time zones. Clear communication and structured check-ins keep everything on track." },
  { question: "Do you accept one-off generation tasks or only full projects?", answer: "We typically take on full-scope projects to ensure cohesion and quality. However, if you have a smaller need that aligns with our approach, we're open to discussing it." },
  { question: "How many variations or revisions are included?", answer: "Our process is collaborative and structured. Rather than presenting dozens of options, we focus on one strong direction—refined through feedback. The number of revisions depends on the scope, but clarity and alignment are our priority from the start." },
];

export const blogPosts: BlogPost[] = [
  { date: "May 30, 2025", title: "The Power of AI in Fashion Photography", excerpt: "A look at how AI-generated models can sharpen brand communication and increase campaign impact.", category: "Insights", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" },
  { date: "May 23, 2025", title: "Designing for Scale: AI Beyond the Shoot", excerpt: "An exploration of how AI model generation enables unlimited variations without traditional constraints.", category: "Technology", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80" },
  { date: "May 16, 2025", title: "Building a Timeless Brand Identity", excerpt: "A guide to creating consistent model personas that transcend trends and seasonal campaigns.", category: "Strategy", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" },
];
