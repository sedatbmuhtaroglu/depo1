import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";
import { landingBrand } from "@/content/landing";
import { resolveLegalPageBody } from "@/modules/marketing/server/legal-public-pages";

export const metadata: Metadata = {
  title: `KVKK Aydınlatma Metni | ${landingBrand.name}`,
  description: `6698 sayılı KVKK kapsamında ${landingBrand.name} kişisel veri işleme faaliyetleri ve haklarınız.`,
  robots: { index: true, follow: true },
};

export default async function KvkkAydinlatmaPage() {
  const { html, lastUpdatedLabel } = await resolveLegalPageBody("kvkkHtml");

  return (
    <LegalArticle title="Kişisel Verilerin Korunması Kanunu (KVKK) Aydınlatma Metni" lastUpdated={lastUpdatedLabel}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </LegalArticle>
  );
}
