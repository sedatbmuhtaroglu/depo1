'use client';

import React, { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { addTenantDomain, removeTenantDomain } from "@/app/actions/tenant-domain";

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
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">
          Özel domainler
        </h3>
        <span className="text-xs text-neutral-500">
          Planınızda özel domain özelliği aktif.
        </span>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2"
      >
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="ör. restoran.com"
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm sm:min-w-[180px]"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Ekle
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs font-semibold text-neutral-500">
              <th className="px-2 py-2">Domain</th>
              <th className="px-2 py-2">Durum</th>
              <th className="px-2 py-2">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-2 py-4 text-center text-xs text-neutral-500"
                >
                  Henüz domain tanımlı değil.
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-neutral-100 text-xs text-neutral-700"
                >
                  <td className="px-2 py-2">
                    <span className="block max-w-[20rem] break-all">{d.domain}</span>
                    {d.isPrimary && (
                      <span className="ml-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                        Ana
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {d.isVerified ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Doğrulandı
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Bekliyor / Doğrulama bekleniyor
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {!d.isPrimary && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleRemove(d.id)}
                        className="rounded border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
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

