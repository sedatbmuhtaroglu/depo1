import { notFound } from "next/navigation";
import { ContentEmbedBlocksRenderer } from "@/components/content/content-embed-blocks-renderer";
import { cardClasses } from "@/lib/ui/button-variants";
import { getHqBlogPostById } from "@/modules/content/server/content-queries";
import { normalizeEmbedBlocksForRender } from "@/modules/content/shared/embed-blocks";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function HqContentBlogPostPreviewPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const post = await getHqBlogPostById(postId);
  if (!post) notFound();

  const embedBlocks = normalizeEmbedBlocksForRender(post.embedBlocks);

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">HQ Preview</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--ui-text-primary)]">{post.title}</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Durum: {post.status === "PUBLISHED" ? "Yayinda" : "Taslak"} / Slug: /blog/{post.slug}
        </p>
        <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
          Yayin: {formatDate(post.publishedAt)} / Okuma: {post.readingTimeMinutes} dk
        </p>
      </section>

      <article className={cardClasses({ className: "p-5" })}>
        {post.featuredImageUrl ? (
          <img
            src={post.featuredImageUrl}
            alt={post.title}
            className="mb-4 h-56 w-full rounded-xl object-cover"
          />
        ) : null}

        {post.excerpt ? (
          <p className="mb-4 text-base text-[var(--ui-text-secondary)]">{post.excerpt}</p>
        ) : null}

        <div
          className="space-y-3 text-sm leading-7 text-[var(--ui-text-primary)] [&_a]:text-[var(--ui-accent)] [&_li]:ml-5 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        <ContentEmbedBlocksRenderer blocks={embedBlocks} />
      </article>
    </div>
  );
}
