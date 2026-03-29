import { cardClasses } from "@/lib/ui/button-variants";

/** Ana içerik kartı — gölge tema ile kontrollü; çoğu panel yüzeyi için. */
export const rmPanelCard = (className?: string) =>
  cardClasses({ className: className ? `shadow-none ${className}` : "shadow-none" });

/** Üst özet / KPI satırı kartları */
export const rmStatCard = (className?: string) =>
  cardClasses({ tone: "subtle", className: className ? `shadow-none ${className}` : "shadow-none" });
