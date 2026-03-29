import Link from "next/link";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { listHqRedirectRules } from "@/modules/content/server/content-queries";
import {
  createRedirectRuleAction,
  deleteRedirectRuleAction,
  updateRedirectRuleAction,
} from "@/modules/hq/actions/content";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default async function HqContentRedirectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const params = await searchParams;
  const rows = await listHqRedirectRules({
    q: params.q ?? null,
    active: params.active ?? null,
  });

  async function createRedirectFormAction(formData: FormData) {
    "use server";
    await createRedirectRuleAction(formData);
  }

  async function updateRedirectFormAction(formData: FormData) {
    "use server";
    await updateRedirectRuleAction(formData);
  }

  async function deleteRedirectFormAction(formData: FormData) {
    "use server";
    await deleteRedirectRuleAction(formData);
  }

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Redirect Manager</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          301/302 yonlendirmeleri merkezi olarak yonetin. Slug degisimi sonrasi trafik kaybini azaltin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-4">
          <input name="q" defaultValue={params.q ?? ""} placeholder="from / to / not" className={fieldClasses()} />
          <select name="active" defaultValue={params.active ?? ""} className={selectClasses()}>
            <option value="">Tum durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Pasif</option>
          </select>
          <button type="submit" className={buttonClasses({ variant: "outline" })}>Filtrele</button>
          <Link href="/hq/content/redirects" className={buttonClasses({ variant: "ghost" })}>Temizle</Link>
        </form>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Yeni Redirect</h3>
        <form action={createRedirectFormAction} className="mt-3 grid gap-3 md:grid-cols-6">
          <div className="space-y-1 md:col-span-2">
            <label className={labelClasses()}>From Path</label>
            <input name="fromPath" className={fieldClasses()} placeholder="/eski-yol" required />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={labelClasses()}>To Path</label>
            <input name="toPath" className={fieldClasses()} placeholder="/yeni-yol veya https://..." required />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()}>Tip</label>
            <select name="statusCode" defaultValue="301" className={selectClasses()}>
              <option value="301">301</option>
              <option value="302">302</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm text-[var(--ui-text-secondary)]">
            <input type="checkbox" name="isActive" defaultChecked /> Aktif
          </label>
          <div className="space-y-1 md:col-span-5">
            <label className={labelClasses()}>Not</label>
            <textarea name="note" className={textareaClasses({ className: "min-h-[80px]" })} />
          </div>
          <div className="md:col-span-6">
            <button type="submit" className={buttonClasses({ variant: "primary" })}>Kural Ekle</button>
          </div>
        </form>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">Redirect kaydi bulunamadi.</div>
        ) : (
          <div className="divide-y divide-[var(--ui-border)]">
            {rows.map((row) => (
              <div key={row.id} className="p-4">
                <form action={updateRedirectFormAction} className="grid gap-3 md:grid-cols-6">
                  <input type="hidden" name="id" value={String(row.id)} />

                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClasses()}>From Path</label>
                    <input name="fromPath" defaultValue={row.fromPath} className={fieldClasses()} required />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClasses()}>To Path</label>
                    <input name="toPath" defaultValue={row.toPath} className={fieldClasses()} required />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClasses()}>Tip</label>
                    <select name="statusCode" defaultValue={String(row.statusCode)} className={selectClasses()}>
                      <option value="301">301</option>
                      <option value="302">302</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pt-6 text-sm text-[var(--ui-text-secondary)]">
                    <input type="checkbox" name="isActive" defaultChecked={row.isActive} /> Aktif
                  </label>

                  <div className="space-y-1 md:col-span-4">
                    <label className={labelClasses()}>Not</label>
                    <textarea
                      name="note"
                      defaultValue={row.note ?? ""}
                      className={textareaClasses({ className: "min-h-[74px]" })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 pt-7">
                      <span className={badgeClasses(row.isActive ? "success" : "warning")}>{row.isActive ? "Aktif" : "Pasif"}</span>
                      <span className="text-xs text-[var(--ui-text-secondary)]">{formatDate(row.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="md:col-span-6">
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })}>Guncelle</button>
                      <button
                        type="submit"
                        formAction={deleteRedirectFormAction}
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
