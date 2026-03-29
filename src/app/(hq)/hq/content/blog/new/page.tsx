import { cardClasses } from "@/lib/ui/button-variants";
import { resolveCanonicalAppOrigin } from "@/lib/security/allowed-origins";
import { listHqBlogCategories, listHqMediaAssets } from "@/modules/content/server/content-queries";
import { ContentBlogPostForm } from "@/modules/hq/components/content-blog-post-form";

export default async function HqContentBlogCreatePage() {
  const [categories, mediaAssets, baseUrl] = await Promise.all([
    listHqBlogCategories(),
    listHqMediaAssets({ limit: 200 }),
    Promise.resolve(resolveCanonicalAppOrigin()),
  ]);

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Yeni Blog Yazisi</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Yazinizi draft veya published olarak kaydedin, SEO paneliyle arama gorunumunu duzenleyin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <ContentBlogPostForm
          mode="create"
          baseUrl={baseUrl}
          categories={categories.map((item) => ({ id: item.id, name: item.name }))}
          mediaAssets={mediaAssets}
        />
      </section>
    </div>
  );
}
