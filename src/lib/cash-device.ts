export const NON_FISCAL_DISCLAIMER =
  "Bu cikti resmi mali fis degildir; sadece bilgi fisi/siparis fisi/tahsilat ozeti amaclidir.";

export type CashSlipType =
  | "ORDER_SLIP"
  | "PAYMENT_SUMMARY_SLIP"
  | "NON_FISCAL_INFO_SLIP";

export type CashSlipPayload = {
  slipType: CashSlipType;
  fiscalNature: "NON_FISCAL_INFORMATION_ONLY";
  disclaimer: string;
  restaurantName: string;
  tableNo: string;
  issuedAtIso: string;
  orderReference: string;
  paymentMethod: string;
  amount: number;
  description: string;
};

export type CashDeviceType =
  | "POS_TERMINAL"
  | "FISCAL_DEVICE"
  | "THERMAL_PRINTER"
  | "BARCODE_PRINTER";

export type DeviceIntegrationState =
  | "READY"
  | "NOT_CONFIGURED"
  | "UNSUPPORTED"
  | "OFFLINE";

export class DeviceIntegrationUnavailableError extends Error {
  readonly state: DeviceIntegrationState;
  readonly deviceType: CashDeviceType;

  constructor(deviceType: CashDeviceType, state: DeviceIntegrationState, message: string) {
    super(message);
    this.name = "DeviceIntegrationUnavailableError";
    this.deviceType = deviceType;
    this.state = state;
  }
}

export function assertNonFiscalSlipPayload(payload: CashSlipPayload): void {
  if (payload.fiscalNature !== "NON_FISCAL_INFORMATION_ONLY") {
    throw new Error("Mali belge uretimi bu katmanda desteklenmez.");
  }
  if (!payload.disclaimer || payload.disclaimer.trim().length < 12) {
    throw new Error("Non-fiscal aciklamasi zorunludur.");
  }
}

