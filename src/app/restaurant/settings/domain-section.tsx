'use client';

import React, { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { addTenantDomain, removeTenantDomain } from "@/app/actions/tenant-domain";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";

type DomainRow = {
  id: number;
  domain: string;
  isPrimary: boolean;
  isVerified: boolean;
};

type Props = {
  domains: DomainRow[];
};

export default function DomainSection({ domains }: Props) {
  const [isPending, startTransition] = useTransition();
  const [newDomain, setNewDomain] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const value = newDomain.trim();
    if (!value) {
      toast.error("Domain giriniz.");
      return;
    }
    startTransition(async () => {
      const result = await addTenantDomain(value);
      if (result.success) {
        toast.success("Domain eklendi.");
        setNewDomain("");
      } else {
        toast.error(result.message ?? "Domain eklenemedi.");
      }
    });
  };

  const handleRemove = (id: number) => {
    if (!confirm("Bu domain kaydını silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const result = await removeTenantDomain(id);
      if (result.success) {
        toast.success("Domain kaldırıldı.");
      } else {
        toast.error(result.message ?? "Domain kaldırılamadı.");
      }
    });
  };

  return (
    <section className={cardClasses({ className: "space-y-4 p-4 shadow-none sm:p-5" })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Özel domainler</h3>
        <span className="text-xs text-[color:var(--ui-text-muted)]">
          Planınızda özel domain özelliği aktif.
        </span>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-3 py-2.5"
      >
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="ör. restoran.com"
          className={fieldClasses({
            size: "md",
            className: "min-w-0 flex-1 text-sm sm:min-w-[180px]",
          })}
        />
        <button
          type="submit"
          disabled={isPending}
          className={buttonClasses({ variant: "primary", size: "sm", className: "shrink-0" })}
        >
          Ekle
        </button>
      </form>

      <div className="rm-table-wrap">
        <table className="rm-table rm-table--compact">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 ? (
              <tr>
                <td colSpan={3} className="!py-8 text-center text-xs text-[color:var(--ui-text-muted)]">
                  Henüz domain tanımlı değil.
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="block max-w-[20rem] break-all text-xs text-[color:var(--ui-text-primary)]">
                      {d.domain}
                    </span>
                    {d.isPrimary && (
                      <span className="mt-1 inline-block rounded-full bg-[color:var(--ui-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--ui-text-secondary)]">
                        Ana
                      </span>
                    )}
                  </td>
                  <td>
                    {d.isVerified ? (
                      <span className={badgeClasses("success", "text-[11px]")}>Doğrulandı</span>
                    ) : (
                      <span className={badgeClasses("warning", "text-[11px]")}>
                        Bekliyor / Doğrulama bekleniyor
                      </span>
                    )}
                  </td>
                  <td>
                    {!d.isPrimary && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleRemove(d.id)}
                        className={buttonClasses({
                          variant: "outline",
                          size: "xs",
                          className: "border-[color:var(--ui-danger-border)] text-[11px] text-[color:var(--ui-danger)] hover:bg-[color:var(--ui-danger-soft)]",
                        })}
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

