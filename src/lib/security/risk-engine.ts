import { prisma } from "@/lib/prisma";
import { calculateDistanceMeters } from "@/lib/location";
import { writeAuditLog } from "@/lib/audit-log";
import { SECURITY_THRESHOLDS, SecurityAction } from "@/lib/security/config";
import { hashValue } from "@/lib/security/hash";
import { assessIpRisk } from "@/lib/security/ip-risk-provider";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import {
  ClientRiskSignals,
  IpRiskResult,
  RiskEvaluationResult,
  RiskReasonCode,
} from "@/lib/security/types";

export type RiskEngineFailureMode = "observe" | "degrade-safe" | "fail-closed";

function normalizeSignals(signals?: ClientRiskSignals | null): ClientRiskSignals {
  return signals ?? {};
}

function resolveFingerprintHash(signals: ClientRiskSignals): string | null {
  const raw =
    signals.fingerprint ||
    [
      signals.userAgent ?? "",
      signals.language ?? "",
      signals.timezone ?? "",
      signals.platform ?? "",
      signals.screen ?? "",
    ].join("|");
  return hashValue(raw);
}

function levelFromScore(score: number): "low" | "medium" | "high" {
  if (score >= SECURITY_THRESHOLDS.riskHighMin) return "high";
  if (score > SECURITY_THRESHOLDS.riskLowMax) return "medium";
  return "low";
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function failOpenResult(): RiskEvaluationResult & {
  fingerprintHash: string | null;
  ipRisk: IpRiskResult;
} {
  return {
    score: 0,
    level: "low",
    decision: "allow",
    reasons: ["UNKNOWN"],
    details: { riskEngine: "fail_open" },
    fingerprintHash: null,
    ipRisk: {
      risk: "low",
      provider: "risk-engine-fallback",
      notes: "risk_engine_failed",
    },
  };
}

function buildFailureResult(mode: RiskEngineFailureMode): RiskEvaluationResult & {
  fingerprintHash: string | null;
  ipRisk: IpRiskResult;
} {
  if (mode === "fail-closed") {
    return {
      score: 100,
      level: "high",
      decision: "block",
      reasons: ["UNKNOWN"],
      details: { riskEngine: "fail_closed" },
      fingerprintHash: null,
      ipRisk: {
        risk: "high",
        provider: "risk-engine-fallback",
        notes: "risk_engine_failed_fail_closed",
      },
    };
  }

  if (mode === "degrade-safe") {
    return {
      score: 70,
      level: "medium",
      decision: "suspicious",
      reasons: ["UNKNOWN"],
      details: { riskEngine: "degrade_safe" },
      fingerprintHash: null,
      ipRisk: {
        risk: "medium",
        provider: "risk-engine-fallback",
        notes: "risk_engine_failed_degrade_safe",
      },
    };
  }

  return failOpenResult();
}

export async function evaluateAndLogRisk(options: {
  tenantId: number;
  tableId?: number | null;
  tableSessionId?: number | null;
  action: SecurityAction;
  signals?: ClientRiskSignals | null;
  failureMode?: RiskEngineFailureMode;
}) {
  try {
    const { tenantId, tableId, tableSessionId, action } = options;
    const resolvedTableId =
      tableId == null || Number.isNaN(Number(tableId)) ? null : Number(tableId);
    const failureMode = options.failureMode ?? "observe";
    const signals = normalizeSignals(options.signals);
    const requestCtx = await getRequestSecurityContext();
    const fingerprintHash = resolveFingerprintHash(signals);
    const now = new Date();

    const reasons: RiskReasonCode[] = [];
    const details: RiskEvaluationResult["details"] = {};
    let score = 0;

    if (!fingerprintHash) {
      score += 8;
      reasons.push("MISSING_FINGERPRINT");
    }

    const ipRisk = await assessIpRisk(requestCtx.ipRaw);
    const ipProviderUnavailable =
      ipRisk.provider === "ip-api" &&
      typeof ipRisk.notes === "string" &&
      (ipRisk.notes === "service_unavailable" ||
        ipRisk.notes === "service_non_200" ||
        ipRisk.notes === "service_failed");

    if (ipRisk.risk === "medium") {
      score += 20;
      reasons.push("IP_PROXY_MEDIUM");
    } else if (ipRisk.risk === "high") {
      score += 45;
      reasons.push("IP_PROXY_HIGH");
    }

    if (ipProviderUnavailable) {
      if (failureMode === "fail-closed") {
        score += 85;
      } else if (failureMode === "degrade-safe") {
        score += 55;
      } else {
        score += 10;
      }
      reasons.push("UNKNOWN");
      details.ipRiskSignal = "provider_unavailable";
    }

    if (
      signals.location?.accuracyMeters &&
      signals.location.accuracyMeters > SECURITY_THRESHOLDS.poorGpsAccuracyMeters
    ) {
      score += 12;
      reasons.push("POOR_GPS_ACCURACY");
      details.gpsAccuracy = Math.round(signals.location.accuracyMeters);
    }

    const sinceRateWindow = new Date(now.getTime() - 30_000);
    const rapidAttempts = await prisma.securityEvent.count({
      where: {
        tenantId,
        actionType: action,
        createdAt: { gte: sinceRateWindow },
        ...(fingerprintHash ? { fingerprintHash } : {}),
        ...(requestCtx.ipHash ? { ipHash: requestCtx.ipHash } : {}),
      },
    });
    if (rapidAttempts >= 4) {
      score += 25;
      reasons.push("RATE_LIMIT_SPIKE");
      details.rapidAttempts = rapidAttempts;
    }

    if (fingerprintHash) {
      const sinceSwitchWindow = new Date(
        now.getTime() - SECURITY_THRESHOLDS.tableSwitchWindowMs,
      );

      const recentFingerprintEvents = await prisma.securityEvent.findMany({
        where: {
          tenantId,
          fingerprintHash,
          createdAt: { gte: sinceSwitchWindow },
        },
        select: { tableId: true },
        take: 30,
        orderBy: { createdAt: "desc" },
      });

      const tableSet = new Set(
        recentFingerprintEvents
          .map((x) => x.tableId)
          .filter((v): v is number => typeof v === "number"),
      );

      if (
        tableSet.size >= 3 ||
        (resolvedTableId != null && tableSet.size >= 2 && !tableSet.has(resolvedTableId))
      ) {
        score += 30;
        reasons.push("RAPID_TABLE_SWITCH");
        details.tableSwitchCount = tableSet.size;
      }

      const lastWithLocation = await prisma.securityEvent.findFirst({
        where: {
          tenantId,
          fingerprintHash,
          clientLat: { not: null },
          clientLng: { not: null },
        },
        select: {
          createdAt: true,
          clientLat: true,
          clientLng: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const currentLat = toFiniteNumber(signals.location?.latitude);
      const currentLng = toFiniteNumber(signals.location?.longitude);

      if (lastWithLocation && currentLat != null && currentLng != null) {
        const previousLat = toFiniteNumber(lastWithLocation.clientLat);
        const previousLng = toFiniteNumber(lastWithLocation.clientLng);

        if (previousLat != null && previousLng != null) {
          const minutesDiff =
            (now.getTime() - new Date(lastWithLocation.createdAt).getTime()) /
            60000;

          if (
            minutesDiff >= 0 &&
            minutesDiff <= SECURITY_THRESHOLDS.geoJumpWindowMs / 60000
          ) {
            const jumpMeters = calculateDistanceMeters(
              previousLat,
              previousLng,
              currentLat,
              currentLng,
            );
            if (jumpMeters > SECURITY_THRESHOLDS.geoJumpDistanceMeters) {
              score += 25;
              reasons.push("RAPID_GEO_JUMP");
              details.geoJumpMeters = Math.round(jumpMeters);
            }
          }
        }
      }
    }

    const ipLat = toFiniteNumber(ipRisk.latitude);
    const ipLng = toFiniteNumber(ipRisk.longitude);
    const signalLat = toFiniteNumber(signals.location?.latitude);
    const signalLng = toFiniteNumber(signals.location?.longitude);

    if (signalLat != null && signalLng != null && ipLat != null && ipLng != null) {
      const ipGpsMismatch = calculateDistanceMeters(
        ipLat,
        ipLng,
        signalLat,
        signalLng,
      );
      if (ipGpsMismatch > SECURITY_THRESHOLDS.ipGpsMismatchMeters) {
        score += 18;
        reasons.push("IP_GPS_MISMATCH");
        details.ipGpsMismatchMeters = Math.round(ipGpsMismatch);
      }
    }

    const level = levelFromScore(score);
    const decision: RiskEvaluationResult["decision"] =
      level === "high" ? "block" : level === "medium" ? "suspicious" : "allow";

    const result: RiskEvaluationResult = {
      score,
      level,
      decision,
      reasons,
      details,
    };

    await prisma.securityEvent.create({
      data: {
        tenantId,
        tableId: resolvedTableId,
        tableSessionId: tableSessionId ?? null,
        actionType: action,
        outcome: decision.toUpperCase(),
        riskScore: score,
        riskLevel: level,
        reasons,
        ipHash: requestCtx.ipHash,
        fingerprintHash,
        userAgentHash: requestCtx.userAgentHash,
        clientTimezone: signals.timezone ?? null,
        clientLat: signalLat,
        clientLng: signalLng,
        clientAccuracyM:
          signals.location?.accuracyMeters != null
            ? signals.location.accuracyMeters
            : null,
        ipCountry: ipRisk.country ?? null,
        ipCity: ipRisk.city ?? null,
        ipTimezone: ipRisk.timezone ?? null,
        ipRiskLevel: ipRisk.risk,
        ipRiskProvider: ipRisk.provider,
        meta: {
          action,
          acceptLanguage: requestCtx.acceptLanguage ?? null,
          ipNotes: ipRisk.notes ?? null,
          details,
        },
      },
    });

    if (decision !== "allow") {
      await writeAuditLog({
        tenantId,
        actor: { type: "admin", id: "system" },
        actionType: `SECURITY_${action}_${decision.toUpperCase()}`,
        entityType: "SecurityEvent",
        description: `risk=${score}; reasons=${reasons.join(",") || "none"}`,
      });
    }

    return {
      ...result,
      fingerprintHash,
      ipRisk,
    };
  } catch (error) {
    const failureMode = options.failureMode ?? "observe";
    const message = error instanceof Error ? error.message : String(error);
    if (failureMode === "observe") {
      console.error("Risk engine failed-open:", message);
    } else {
      console.error("Risk engine failure mode activated:", failureMode, message);
    }
    return buildFailureResult(failureMode);
  }
}

export async function evaluateAuthLoginRisk(options: {
  ipRaw: string;
  failureMode?: RiskEngineFailureMode;
}): Promise<{ decision: "allow" | "suspicious" | "block"; score: number; provider: string; notes?: string | null }> {
  const failureMode = options.failureMode ?? "fail-closed";
  try {
    const ipRisk = await assessIpRisk(options.ipRaw);
    const providerUnavailable =
      ipRisk.provider === "ip-api" &&
      typeof ipRisk.notes === "string" &&
      (ipRisk.notes === "service_unavailable" ||
        ipRisk.notes === "service_non_200" ||
        ipRisk.notes === "service_failed");

    if (providerUnavailable && failureMode === "fail-closed") {
      return {
        decision: "block",
        score: 100,
        provider: ipRisk.provider,
        notes: ipRisk.notes ?? null,
      };
    }

    if (ipRisk.risk === "high") {
      return { decision: "block", score: 95, provider: ipRisk.provider, notes: ipRisk.notes ?? null };
    }
    if (ipRisk.risk === "medium") {
      return { decision: "suspicious", score: 65, provider: ipRisk.provider, notes: ipRisk.notes ?? null };
    }
    return { decision: "allow", score: 15, provider: ipRisk.provider, notes: ipRisk.notes ?? null };
  } catch {
    if (failureMode === "fail-closed") {
      return { decision: "block", score: 100, provider: "risk-engine-fallback", notes: "auth_risk_eval_failed" };
    }
    return { decision: "suspicious", score: 70, provider: "risk-engine-fallback", notes: "auth_risk_eval_failed" };
  }
}
