'use client';

import React, { useTransition } from "react";
import { Clock, Check } from "lucide-react";
import toast from "react-hot-toast";
import { updateWaiterCallStatus } from "@/app/actions/update-waiter-call-status";

type WaiterCall = {
  id: number;
  table: { tableNo: number };
  status: "PENDING" | "ACKNOWLEDGED" | "RESOLVED";
  createdAt: Date;
};

type Props = {
  calls: WaiterCall[];
};

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WaiterCallsSection({ calls }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (
    callId: number,
    status: "ACKNOWLEDGED" | "RESOLVED",
  ) => {
    startTransition(async () => {
      const result = await updateWaiterCallStatus(callId, status);
      if (result.success) {
        toast.success("Garson çağrısı durumu güncellendi.");
      } else {
        toast.error(result.message || "Garson çağrısı güncellenemedi.");
      }
    });
  };

  if (!calls.length) {
    return null;
  }

  const openCalls = calls.filter(
    (c) => c.status === "PENDING" || c.status === "ACKNOWLEDGED",
  );
  const resolvedCalls = calls.filter((c) => c.status === "RESOLVED");

  return (
    <section className="waiter-section space-y-4 rounded-2xl p-4">
      {openCalls.length > 0 && (
        <div>
          <h2 className="waiter-section-title mb-3 text-lg font-semibold">
            Garson Çağrıları
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {openCalls.map((call) => (
              <div
                key={call.id}
                className="waiter-card waiter-card-muted flex flex-col rounded-2xl border-amber-300 px-3 py-3 text-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Masa
                    </p>
                    <p className="text-lg font-bold text-neutral-900">
                      {call.table.tableNo}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      call.status === "PENDING"
                        ? "waiter-status-chip-warning"
                        : "waiter-status-chip-info"
                    }`}
                  >
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    {call.status === "PENDING"
                      ? "Yeni çağrı"
                      : "Garson yolda"}
                  </span>
                </div>

                <p className="mb-3 text-xs text-neutral-500">
                  {formatTime(call.createdAt)}
                </p>

                <div className="mt-auto flex justify-end gap-2">
                  {call.status === "PENDING" && (
                    <button
                      disabled={isPending}
                      onClick={() =>
                        handleStatusChange(call.id, "ACKNOWLEDGED")
                      }
                      className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                    >
                      Alındı
                    </button>
                  )}
                  <button
                    disabled={isPending}
                    onClick={() => handleStatusChange(call.id, "RESOLVED")}
                    className="rounded-xl bg-[color:var(--ui-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[color:var(--ui-primary-hover)] disabled:opacity-60"
                  >
                    Tamamlandı
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolvedCalls.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-muted)]">
            Son Çağrılar
          </h3>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {resolvedCalls.slice(0, 8).map((call) => (
              <div
                key={call.id}
                className="waiter-card waiter-card-muted flex flex-col rounded-2xl px-3 py-2 text-xs"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">
                    Masa {call.table.tableNo}
                  </span>
                  <span className="text-neutral-500">
                    {formatTime(call.createdAt)}
                  </span>
                </div>
                <span className="waiter-status-chip-success mt-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  <Check className="mr-1 h-3 w-3" />
                  Tamamlandı
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

