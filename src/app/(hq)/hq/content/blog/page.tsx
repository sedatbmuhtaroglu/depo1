import Link from "next/link";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  selectClasses,
} from "@/lib/ui/button-variants";
import { deleteBlogPostAction } from "@/modules/hq/actions/content";
import { listHqBlogCategories, listHqBlogPosts } from "@/modules/content/server/content-queries";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function HqContentBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}) {
  const params = await searchParams;
  const [posts, categories] = await Promise.all([
    listHqBlogPosts({
      q: params.q ?? null,
      status: params.status ?? null,
      category: params.category ?? null,
    }),
    listHqBlogCategories(),
  ]);

  async function deleteBlogPostFormAction(formData: FormData) {
    "use server";
    await deleteBlogPostAction(formData);
  }

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">Content</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">Blog</h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Blog yazilarini, kategorileri ve SEO durumunu tek panelden yonetin.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/hq/content/blog/categories" className={buttonClasses({ variant: "outline" })}>
              Kategoriler
            </Link>
            <Link href="/hq/content/blog/new" className={buttonClasses({ variant: "primary" })}>
              Yeni Yazi
            </Link>
          </div>
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-5">
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Baslik / slug ara"
            className={fieldClasses()}
          />
          <select name="status" defaultValue={params.status ?? ""} className={selectClasses()}>
            <option value="">Tum durumlar</option>
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayinda</option>
          </select>
          <select name="category" defaultValue={params.category ?? ""} className={selectClasses()}>
            <option value="">Tum kategoriler</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClasses({ variant: "outline" })}>
            Filtrele
          </button>
          <Link href="/hq/content/blog" className={buttonClasses({ variant: "ghost" })}>
            Temizle
          </Link>
        </form>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {posts.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">Blog yazisi bulunamadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">Baslik</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">SEO</th>
                  <th className="px-4 py-3">Okuma</th>
                  <th className="px-4 py-3">Guncelleme</th>
                  <th className="px-4 py-3">Yayin</th>
                  <th className="px-4 py-3">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const previewHref =
                    post.status === "PUBLISHED" ? `/blog/${post.slug}` : `/hq/content/blog/${post.id}/preview`;
                  const seoVariant =
                    post.seo.status === "strong"
                      ? "success"
                      : post.seo.status === "medium"
                        ? "warning"
                        : "danger";
                  const seoLabel =
                    post.seo.status === "strong"
                      ? "SEO iyi"
                      : post.seo.status === "medium"
                        ? "SEO orta"
                        : "SEO zayif";
                  return (
                    <tr key={post.id} className="border-b border-[var(--ui-border)]/70 align-top">
                      <td className="px-4 py-3 font-semibold text-[var(--ui-text-primary)]">{post.title}</td>
                      <td className="px-4 py-3 text-[var(--ui-text-secondary)]">/blog/{post.slug}</td>
                      <td className="px-4 py-3">{post.category?.name ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span className={badgeClasses(post.status === "PUBLISHED" ? "success" : "warning")}>
                          {post.status === "PUBLISHED" ? "Yayinda" : "Taslak"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={badgeClasses(seoVariant)}>
                          {seoLabel} (%{post.seo.score})
                        </span>
                      </td>
                      <td className="px-4 py-3">{post.readingTimeMinutes} dk</td>
                      <td className="px-4 py-3">{formatDate(post.updatedAt)}</td>
                      <td className="px-4 py-3">{formatDate(post.publishedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/hq/content/blog/${post.id}/edit`}
                            className={buttonClasses({ variant: "outline", size: "xs" })}
                          >
                            Duzenle
                          </Link>
                          <Link href={previewHref} className={buttonClasses({ variant: "ghost", size: "xs" })}>
                            Preview
                          </Link>
                          <form action={deleteBlogPostFormAction}>
                            <input type="hidden" name="id" value={String(post.id)} />
                            <button type="submit" className={buttonClasses({ variant: "danger", size: "xs" })}>
                              Sil
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
