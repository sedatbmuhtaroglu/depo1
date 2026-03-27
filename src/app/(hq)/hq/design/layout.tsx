import { DesignSubnav } from "@/modules/hq/components/design/design-subnav";

export default function HqDesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <DesignSubnav />
      {children}
    </div>
  );
}
