import { assertProductionEnvOrThrow } from "@/lib/env.server";
import { ensurePrismaConnectionInDev } from "@/lib/prisma";
import { warnIfLegacyPaymentSecretsPresentAtStartup } from "@/lib/payment-secret-startup-check";

export async function register() {
  assertProductionEnvOrThrow();
  await ensurePrismaConnectionInDev();
  await warnIfLegacyPaymentSecretsPresentAtStartup();
}
