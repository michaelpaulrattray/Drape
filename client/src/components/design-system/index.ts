/**
 * FormaStudio™ Design System Components
 * 
 * This file exports all reusable UI components that follow the
 * FormaStudio design system. Import from this file for convenience.
 * 
 * @example
 * import { Section, Card, Button, SectionHeading } from "@/components/design-system";
 */

// Layout Components
export { 
  Section, 
  SectionLabel, 
  Container,
  type SectionProps,
  type SectionLabelProps,
  type ContainerProps,
} from "./Section";

// Card Components
export { 
  Card, 
  ProjectCard, 
  ServiceCard, 
  StatCard,
  type CardProps,
  type ProjectCardProps,
  type ServiceCardProps,
  type StatCardProps,
} from "./Card";

// Button Components
export { 
  Button, 
  IconButton, 
  LinkButton,
  NavLink,
  SocialLink,
  FooterLink,
  ConveyorText,
  ConveyorTextColor,
  ConveyorIcon,
  type ButtonProps,
  type IconButtonProps,
  type LinkButtonProps,
  type NavLinkProps,
  type SocialLinkProps,
  type FooterLinkProps,
} from "./Button";

// Typography Components
export { 
  SectionHeading, 
  HeroHeading, 
  Tag, 
  BodyText, 
  Label,
  type HeadingProps,
  type TagProps,
  type BodyTextProps,
  type LabelProps,
} from "./Typography";

// Grid Components
export { 
  Grid, 
  GridItem, 
  AnimatedGridItem, 
  TwoColumn,
  type GridProps,
  type GridItemProps,
  type TwoColumnProps,
} from "./Grid";
