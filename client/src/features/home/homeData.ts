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
  { value: "4 Studios", label: "Casting · Wardrobe · Photo · Motion" },
  { value: "Zero Prompts", label: "Visual-first creation" },
  { value: "1 Identity", label: "Consistent across campaigns" },
  { value: "Studio-grade", label: "Built for premium brands" },
];

export const projects: Project[] = [
  { name: "Lune", year: "2025", category: "Editorial Campaign", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80" },
  { name: "Aren", year: "2025", category: "Casting + Wardrobe", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80" },
  { name: "Oura", year: "2025", category: "E-Commerce Lookbook", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80" },
  { name: "Forma", year: "2025", category: "Brand Identity System", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80" },
  { name: "Oko", year: "2025", category: "Campaign Production", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80" },
  { name: "Velin", year: "2025", category: "Model Casting", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80" },
];

export const services: Service[] = [
  {
    title: "Model Casting",
    number: 1,
    description: "Cast a high-fidelity model identity from scratch. Visual controls, no prompts. Your model stays consistent across every tool in the suite.",
    items: ["Model Generation", "Identity Systems", "Character Guidelines", "Ethnicity & Aesthetic", "Pose Libraries", "Expression Ranges"],
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80",
  },
  {
    title: "Outfit Generation",
    number: 2,
    description: "Dress your model in any look — streetwear to couture. High-fidelity fabric and fit, no physical samples required.",
    items: ["Virtual Try-On", "Garment Design", "Fabric Simulation", "Color Variants", "Style Matching", "Seasonal Collections"],
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80",
  },
  {
    title: "Campaign Production",
    number: 3,
    description: "Generate full campaign sets with controlled lighting, environments, and consistent model identity. Studio-grade output, zero reshoots.",
    items: ["Scene Composition", "Lighting Design", "Background Generation", "Multi-angle Shots", "Post-processing", "Asset Delivery"],
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
  },
  {
    title: "Brand Consistency",
    number: 4,
    description: "One model identity across every channel. Repeatable, brand-safe outputs with exportable documentation and ownership proof.",
    items: ["Style Guidelines", "Asset Libraries", "Cross-platform Assets", "Brand Templates", "Quality Control", "Version Management"],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
  },
];

export const processSteps: ProcessStep[] = [
  { title: "Cast", number: 1, description: "Build your model identity from scratch using visual controls. Choose ethnicity, features, expression, and style — no prompt engineering required." },
  { title: "Refine", number: 2, description: "Iterate with precision. Adjust details, generate variations, and lock in the identity that represents your brand." },
  { title: "Produce", number: 3, description: "Take your model into wardrobe, photo, and campaign tools. Every output maintains the identity you built." },
  { title: "Own", number: 4, description: "Export with a casting sheet, unique identifiers, and ownership documentation. Your model is yours." },
];

export const testimonials: Testimonial[] = [
  { quote: "Drape understood our brand better than we did. Their ability to generate the perfect model identities is what sets them apart.", name: "Sofia Ford", title: "Creative Director", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
  { quote: "Working with Drape felt effortless. They have a rare ability to take complex briefs and distill them into something beautifully simple.", name: "Emma V.", title: "Founder", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" },
  { quote: "Drape doesn't just generate images—they listen, interpret, and then create with precision.", name: "Julian M.", title: "Creative Director", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80" },
];

export const faqs: FAQ[] = [
  { question: "What is Drape?", answer: "Drape is a studio-grade AI creative suite that lets you cast, style, and shoot with consistent model identities — without prompt engineering. Prompts run in the background while you work visually." },
  { question: "Who is Drape built for?", answer: "Creative directors, agency owners, brand content teams, and e-commerce marketers who need high-fidelity, repeatable campaign imagery without the friction of traditional AI tools." },
  { question: "How does pricing work?", answer: "Drape uses a points-based system tied to generation output — think of it as production capacity. Plans scale with your team's usage. No hourly billing, no per-seat surprises." },
  { question: "What can I create right now?", answer: "The Casting Studio is live — you can build a high-fidelity model identity from scratch using visual controls. Wardrobe Studio and Campaign Production tools are coming soon." },
  { question: "Do I own what I create?", answer: "Yes. Every model you cast comes with a casting sheet, unique identifiers, and exportable ownership documentation designed for commercial use and client handoff." },
  { question: "How is this different from other AI image tools?", answer: "Most tools require prompt engineering or node-based workflows. Drape replaces both with guided visual controls and maintains a persistent model identity across every tool in the suite." },
  { question: "When will the full suite be available?", answer: "We're rolling out tools progressively. Join the waitlist to get priority access as each studio launches." },
];

export const blogPosts: BlogPost[] = [
  { date: "Feb 1, 2026", title: "Why Identity Persistence Changes Everything", excerpt: "Most AI tools generate one-off images. Here's why a reusable model identity is the missing primitive in creative production.", category: "Insights", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80" },
  { date: "Jan 25, 2026", title: "No Prompts. No Node Graphs. A Third Path.", excerpt: "The AI creative tool market has split into prompt boxes and node-based systems. Drape offers a visual-first alternative.", category: "Technology", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80" },
  { date: "Jan 18, 2026", title: "From Casting to Campaigns: The Drape Workflow", excerpt: "How a single model identity flows through casting, wardrobe, and photo production — with consistency locked in.", category: "Strategy", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" },
];
