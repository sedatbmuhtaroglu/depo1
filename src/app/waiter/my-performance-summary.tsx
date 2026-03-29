"use client";

import React from "react";

type Props = {
  ordersDelivered: number;
  callResponseAvgMinutes: number | null;
  billResponseAvgMinutes: number | null;
};

export default function MyPerformanceSummary({
  ordersDelivered,
  callResponseAvgMinutes,
  billResponseAvgMinutes,
}: Props) {
  return (
    <div className="waiter-card waiter-card-muted rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold text-[color:var(--ui-text-primary)]">Benim performansım (son 7 gün)</h3>
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-[color:var(--ui-text-secondary)]">Teslim ettiğim sipariş: </span>
          <span className="font-semibold text-[color:var(--ui-text-primary)]">{ordersDelivered}</span>
        </div>
        <div>
          <span className="text-[color:var(--ui-text-secondary)]">Ort. garson çağrı yanıtı: </span>
          <span className="font-semibold text-[color:var(--ui-text-primary)]">
            {callResponseAvgMinutes != null ? `${callResponseAvgMinutes} dk` : "—"}
          </span>
        </div>
        <div>
          <span className="text-[color:var(--ui-text-secondary)]">Ort. hesap yanıtı: </span>
          <span className="font-semibold text-[color:var(--ui-text-primary)]">
            {billResponseAvgMinutes != null ? `${billResponseAvgMinutes} dk` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
