import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { resolveCanonicalAppOrigin } from "@/lib/security/allowed-origins";
import { getHqBlogPostById, listHqBlogCategories, listHqMediaAssets } from "@/modules/content/server/content-queries";
import { ContentBlogPostForm } from "@/modules/hq/components/content-blog-post-form";

export default async function HqContentBlogPostEditPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  const [post, categories, mediaAssets] = await Promise.all([
    getHqBlogPostById(postId),
    listHqBlogCategories(),
    listHqMediaAssets({ limit: 200 }),
  ]);

  if (!post) notFound();

  const baseUrl = resolveCanonicalAppOrigin();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Blog Yazisi Duzenle</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Baslik, kategori, icerik ve SEO metadatasini tek formda guncelleyebilirsiniz.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <ContentBlogPostForm
          mode="edit"
          baseUrl={baseUrl}
          initial={post}
          categories={categories.map((item) => ({ id: item.id, name: item.name }))}
          mediaAssets={mediaAssets}
        />
      </section>
    </div>
  );
}
