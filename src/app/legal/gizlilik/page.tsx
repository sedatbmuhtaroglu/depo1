import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";
import { landingBrand } from "@/content/landing";
import { resolveLegalPageBody } from "@/modules/marketing/server/legal-public-pages";

export const metadata: Metadata = {
  title: `Gizlilik Politikası | ${landingBrand.name}`,
  description: `${landingBrand.name} gizlilik ve çerez uygulamaları hakkında bilgilendirme.`,
  robots: { index: true, follow: true },
};

export default async function GizlilikPolitikasiPage() {
  const { html, lastUpdatedLabel } = await resolveLegalPageBody("gizlilikHtml");

  return (
    <LegalArticle title="Gizlilik Politikası" lastUpdated={lastUpdatedLabel}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </LegalArticle>
  );
}
