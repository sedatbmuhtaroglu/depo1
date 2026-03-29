import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";
import { landingBrand } from "@/content/landing";
import { resolveLegalPageBody } from "@/modules/marketing/server/legal-public-pages";

export const metadata: Metadata = {
  title: `Kullanıcı Sözleşmesi | ${landingBrand.name}`,
  description: `${landingBrand.name} platformunu kullanım şartları ve yükümlülükler.`,
  robots: { index: true, follow: true },
};

export default async function KullaniciSozlesmesiPage() {
  const { html, lastUpdatedLabel } = await resolveLegalPageBody("kullaniciSozlesmesiHtml");

  return (
    <LegalArticle title="Kullanıcı Sözleşmesi" lastUpdated={lastUpdatedLabel}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </LegalArticle>
  );
}
