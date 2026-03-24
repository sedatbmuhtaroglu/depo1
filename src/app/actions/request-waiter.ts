'use server';

import { runRequestWaiter } from "@/lib/waiter-request-core";
import { logServerError } from "@/lib/server-error-log";

export async function requestWaiter(
  tableId: string,
  riskSignals?: import("@/lib/security/types").ClientRiskSignals | null,
) {
  try {
    return await runRequestWaiter(tableId, riskSignals);
  } catch (error) {
    logServerError("request-waiter", error);
    return {
      success: false,
      message: "Garson cagirma istegi oluşturulurken bir hata olustu.",
    };
  }
}
