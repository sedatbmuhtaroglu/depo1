import {
  DeviceIntegrationUnavailableError,
  type CashDeviceType,
  type DeviceIntegrationState,
} from "@/lib/cash-device";

export type PosCollectionIntent = {
  billRequestId: number;
  tableId: number;
  amount: number;
  currency: "TRY";
};

export type PosCollectionResult =
  | {
      ok: true;
      state: "READY";
      externalTransactionId: string;
      providerName: string;
    }
  | {
      ok: false;
      state: Exclude<DeviceIntegrationState, "READY">;
      message: string;
    };

export interface PosGateway {
  readonly deviceType: Extract<CashDeviceType, "POS_TERMINAL" | "FISCAL_DEVICE">;
  collectPayment(intent: PosCollectionIntent): Promise<PosCollectionResult>;
}

export class UnconfiguredPosGateway implements PosGateway {
  readonly deviceType: Extract<CashDeviceType, "POS_TERMINAL" | "FISCAL_DEVICE">;

  constructor(deviceType: Extract<CashDeviceType, "POS_TERMINAL" | "FISCAL_DEVICE">) {
    this.deviceType = deviceType;
  }

  async collectPayment(intent: PosCollectionIntent): Promise<PosCollectionResult> {
    void intent;
    const error = new DeviceIntegrationUnavailableError(
      this.deviceType,
      "NOT_CONFIGURED",
      "POS/Yazarkasa entegrasyonu henuz bagli degil.",
    );
    return {
      ok: false,
      state: "NOT_CONFIGURED",
      message: error.message,
    };
  }
}
