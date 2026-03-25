import Link from "next/link";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  selectClasses,
} from "@/lib/ui/button-variants";
import { deletePageAction } from "@/modules/hq/actions/content";
import { listHqPages } from "@/modules/content/server/content-queries";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function HqContentPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const pages = await listHqPages({
    q: params.q ?? null,
    status: params.status ?? null,
  });

  async function deletePageFormAction(formData: FormData) {
    "use server";
    await deletePageAction(formData);
  }

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">Content</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">Sayfalar</h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Kurumsal ve statik icerikleri draft/published akisiyla yonetin.
            </p>
          </div>
          <Link href="/hq/content/pages/new" className={buttonClasses({ variant: "primary" })}>
            Yeni Sayfa
          </Link>
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-4">
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
          <button type="submit" className={buttonClasses({ variant: "outline" })}>
            Filtrele
          </button>
          <Link href="/hq/content/pages" className={buttonClasses({ variant: "ghost" })}>
            Temizle
          </Link>
        </form>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {pages.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">Sayfa bulunamadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">Baslik</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">SEO</th>
                  <th className="px-4 py-3">Guncelleme</th>
                  <th className="px-4 py-3">Yayin</th>
                  <th className="px-4 py-3">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const previewHref =
                    page.status === "PUBLISHED" ? `/pages/${page.slug}` : `/hq/content/pages/${page.id}/preview`;
                  const seoVariant =
                    page.seo.status === "strong"
                      ? "success"
                      : page.seo.status === "medium"
                        ? "warning"
                        : "danger";
                  const seoLabel =
                    page.seo.status === "strong"
                      ? "SEO iyi"
                      : page.seo.status === "medium"
                        ? "SEO orta"
                        : "SEO zayif";

                  return (
                    <tr key={page.id} className="border-b border-[var(--ui-border)]/70 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--ui-text-primary)]">{page.title}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--ui-text-secondary)]">/pages/{page.slug}</td>
                      <td className="px-4 py-3">
                        <span className={badgeClasses(page.status === "PUBLISHED" ? "success" : "warning")}>
                          {page.status === "PUBLISHED" ? "Yayinda" : "Taslak"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={badgeClasses(seoVariant)}>
                          {seoLabel} (%{page.seo.score})
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatDate(page.updatedAt)}</td>
                      <td className="px-4 py-3">{formatDate(page.publishedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/hq/content/pages/${page.id}/edit`}
                            className={buttonClasses({ variant: "outline", size: "xs" })}
                          >
                            Duzenle
                          </Link>
                          <Link href={previewHref} className={buttonClasses({ variant: "ghost", size: "xs" })}>
                            Preview
                          </Link>
                          <form action={deletePageFormAction}>
                            <input type="hidden" name="id" value={String(page.id)} />
                            <button
                              type="submit"
                              className={buttonClasses({ variant: "danger", size: "xs" })}
                            >
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
