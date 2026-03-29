import Link from "next/link";
import {
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { listHqMediaAssets } from "@/modules/content/server/content-queries";
import {
  deleteMediaAssetAction,
  updateMediaAssetAction,
  uploadMediaAssetAction,
} from "@/modules/hq/actions/content";
import { CopyTextButton } from "@/modules/hq/components/copy-text-button";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function HqMediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const assets = await listHqMediaAssets({ q: params.q ?? null, limit: 400 });

  async function uploadMediaFormAction(formData: FormData) {
    "use server";
    await uploadMediaAssetAction(formData);
  }

  async function updateMediaFormAction(formData: FormData) {
    "use server";
    await updateMediaAssetAction(formData);
  }

  async function deleteMediaFormAction(formData: FormData) {
    "use server";
    await deleteMediaAssetAction(formData);
  }

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Media Library</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Tekrarlanan gorsel yuklemelerini azaltin; kapak, featured ve OG gorselleri buradan secin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-3">
          <input name="q" defaultValue={params.q ?? ""} className={fieldClasses()} placeholder="Baslik / alt / yol ara" />
          <button type="submit" className={buttonClasses({ variant: "outline" })}>Ara</button>
          <Link href="/hq/media" className={buttonClasses({ variant: "ghost" })}>Temizle</Link>
        </form>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Yeni Gorsel Yukle</h3>
        <form action={uploadMediaFormAction} className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-3">
            <label className={labelClasses()}>Dosya</label>
            <input type="file" name="file" accept="image/*" required className={fieldClasses()} />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()}>Title</label>
            <input name="title" className={fieldClasses()} placeholder="Hero mockup" />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()}>Alt Text</label>
            <input name="altText" className={fieldClasses()} placeholder="Restoran paneli onizlemesi" />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()}>Caption</label>
            <input name="caption" className={fieldClasses()} placeholder="Opsiyonel aciklama" />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className={buttonClasses({ variant: "primary" })}>Yukle</button>
          </div>
        </form>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        {assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--ui-border)] p-6 text-sm text-[var(--ui-text-secondary)]">
            Media bulunamadi.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.id} className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-3">
                <img
                  src={asset.storagePath}
                  alt={asset.altText ?? asset.title ?? asset.fileName}
                  className="h-40 w-full rounded-lg border border-[var(--ui-border-subtle)] object-cover"
                />
                <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--ui-text-primary)]">{asset.title || asset.fileName}</p>
                <p className="line-clamp-1 text-xs text-[var(--ui-text-secondary)]">{asset.storagePath}</p>
                <p className="text-[11px] text-[var(--ui-text-secondary)]">
                  {asset.width && asset.height ? `${asset.width}x${asset.height}` : "Olcu yok"} - {asset.mimeType} - {formatSize(asset.byteSize)}
                </p>
                <p className="text-[11px] text-[var(--ui-text-secondary)]">{formatDate(asset.createdAt)}</p>

                <form action={updateMediaFormAction} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={String(asset.id)} />
                  <input name="title" defaultValue={asset.title ?? ""} className={fieldClasses()} placeholder="Title" />
                  <input name="altText" defaultValue={asset.altText ?? ""} className={fieldClasses()} placeholder="Alt text" />
                  <textarea
                    name="caption"
                    defaultValue={asset.caption ?? ""}
                    className={textareaClasses({ className: "min-h-[68px]" })}
                    placeholder="Caption"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className={buttonClasses({ variant: "outline", size: "xs" })}>Kaydet</button>
                    <CopyTextButton value={asset.storagePath} label="URL Kopyala" size="xs" />
                    <button
                      type="submit"
                      formAction={deleteMediaFormAction}
                      className={buttonClasses({ variant: "danger", size: "xs" })}
                    >
                      Sil
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
