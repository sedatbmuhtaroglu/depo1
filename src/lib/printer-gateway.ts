import {
  assertNonFiscalSlipPayload,
  DeviceIntegrationUnavailableError,
  type CashDeviceType,
  type CashSlipPayload,
  type DeviceIntegrationState,
} from "@/lib/cash-device";

export type PrinterGatewayResult =
  | { ok: true; jobId: string; state: "READY" }
  | { ok: false; state: Exclude<DeviceIntegrationState, "READY">; message: string };

export interface PrinterGateway {
  readonly deviceType: Extract<CashDeviceType, "THERMAL_PRINTER" | "BARCODE_PRINTER">;
  printNonFiscalSlip(payload: CashSlipPayload): Promise<PrinterGatewayResult>;
}

export class UnconfiguredPrinterGateway implements PrinterGateway {
  readonly deviceType: Extract<CashDeviceType, "THERMAL_PRINTER" | "BARCODE_PRINTER">;

  constructor(deviceType: Extract<CashDeviceType, "THERMAL_PRINTER" | "BARCODE_PRINTER">) {
    this.deviceType = deviceType;
  }

  async printNonFiscalSlip(payload: CashSlipPayload): Promise<PrinterGatewayResult> {
    assertNonFiscalSlipPayload(payload);
    const error = new DeviceIntegrationUnavailableError(
      this.deviceType,
      "NOT_CONFIGURED",
      "Yazici entegrasyonu henuz bagli degil.",
    );
    return {
      ok: false,
      state: "NOT_CONFIGURED",
      message: error.message,
    };
  }
}
