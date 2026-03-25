import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { getHqPageById } from "@/modules/content/server/content-queries";

export default async function HqContentPagePreviewPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await getHqPageById(pageId);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">HQ Preview</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--ui-text-primary)]">{page.title}</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Durum: {page.status === "PUBLISHED" ? "Yayinda" : "Taslak"} / Slug: /pages/{page.slug}
        </p>
      </section>

      <article className={cardClasses({ className: "p-5" })}>
        {page.coverImageUrl ? (
          <img
            src={page.coverImageUrl}
            alt={page.title}
            className="mb-4 h-52 w-full rounded-xl object-cover"
          />
        ) : null}

        {page.excerpt ? (
          <p className="mb-4 text-base text-[var(--ui-text-secondary)]">{page.excerpt}</p>
        ) : null}

        <div
          className="space-y-3 text-sm leading-7 text-[var(--ui-text-primary)] [&_a]:text-[var(--ui-accent)] [&_li]:ml-5 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: page.contentHtml }}
        />
      </article>
    </div>
  );
}
