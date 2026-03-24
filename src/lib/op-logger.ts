/**
 * Operasyon odaklı structured log. Production'da sorun tespiti için
 * hassas veri (müşteri adı, kart no vb.) yazılmaz; tenantId, entityId, sonuç yeterli.
 */
type LogContext = {
  tenantId?: number;
  tableId?: number;
  orderId?: number;
  billRequestId?: number;
  waiterCallId?: number;
  action: string;
  result: "ok" | "error";
  message?: string;
};

export function opLog(ctx: LogContext) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...ctx,
  });
  if (ctx.result === "error") {
    console.error("[op]", line);
  } else {
    console.info("[op]", line);
  }
}
