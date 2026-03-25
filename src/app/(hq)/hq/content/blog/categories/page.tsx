import Link from "next/link";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import {
  createBlogCategoryAction,
  deleteBlogCategoryAction,
  updateBlogCategoryAction,
} from "@/modules/hq/actions/content";
import { listHqBlogCategories } from "@/modules/content/server/content-queries";

export default async function HqContentBlogCategoriesPage() {
  const categories = await listHqBlogCategories();

  async function createCategoryFormAction(formData: FormData) {
    "use server";
    await createBlogCategoryAction(formData);
  }

  async function updateCategoryFormAction(formData: FormData) {
    "use server";
    await updateBlogCategoryAction(formData);
  }

  async function deleteCategoryFormAction(formData: FormData) {
    "use server";
    await deleteBlogCategoryAction(formData);
  }

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">Blog</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">Kategoriler</h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Blog kategori yapisini yonetin. Slug alanlari uniq olmalidir.
            </p>
          </div>
          <Link href="/hq/content/blog" className={buttonClasses({ variant: "ghost" })}>
            Blog Listesi
          </Link>
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Yeni Kategori</h3>
        <form action={createCategoryFormAction} className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <label className={labelClasses()}>Kategori Adi</label>
            <input name="name" className={fieldClasses()} required />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()}>Slug</label>
            <input name="slug" className={fieldClasses()} placeholder="otomatik-uretilebilir" />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()}>Sira</label>
            <input name="sortOrder" type="number" min={0} defaultValue={0} className={fieldClasses()} />
          </div>
          <div className="space-y-1 md:col-span-3">
            <label className={labelClasses()}>Aciklama</label>
            <textarea name="description" className={textareaClasses({ className: "min-h-[80px]" })} />
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm text-[var(--ui-text-secondary)]">
            <input type="checkbox" name="isActive" defaultChecked /> Aktif
          </label>
          <div className="md:col-span-4">
            <button type="submit" className={buttonClasses({ variant: "primary" })}>
              Kategori Ekle
            </button>
          </div>
        </form>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {categories.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">Henuz kategori yok.</div>
        ) : (
          <div className="divide-y divide-[var(--ui-border)]">
            {categories.map((category) => (
              <div key={category.id} className="p-4">
                <form action={updateCategoryFormAction} className="grid gap-3 md:grid-cols-6">
                  <input type="hidden" name="id" value={String(category.id)} />

                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClasses()}>Kategori Adi</label>
                    <input name="name" defaultValue={category.name} className={fieldClasses()} required />
                  </div>

                  <div className="space-y-1">
                    <label className={labelClasses()}>Slug</label>
                    <input name="slug" defaultValue={category.slug} className={fieldClasses()} />
                  </div>

                  <div className="space-y-1">
                    <label className={labelClasses()}>Sira</label>
                    <input
                      name="sortOrder"
                      defaultValue={category.sortOrder}
                      type="number"
                      min={0}
                      className={fieldClasses()}
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClasses()}>Aciklama</label>
                    <textarea
                      name="description"
                      defaultValue={category.description ?? ""}
                      className={textareaClasses({ className: "min-h-[80px]" })}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" name="isActive" defaultChecked={category.isActive} />
                    <span className="text-sm text-[var(--ui-text-secondary)]">Aktif</span>
                    <span className={badgeClasses(category.isActive ? "success" : "warning")}>
                      {category.isActive ? "Yayinda" : "Pasif"}
                    </span>
                  </div>

                  <div className="text-sm text-[var(--ui-text-secondary)] md:col-span-2">
                    {category._count.posts} yazi bagli
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })}>
                        Guncelle
                      </button>
                      <button
                        type="submit"
                        formAction={deleteCategoryFormAction}
                        className={buttonClasses({ variant: "danger", size: "sm" })}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
