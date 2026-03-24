export type ClientRiskSignals = {
  fingerprint?: string | null;
  userAgent?: string | null;
  language?: string | null;
  timezone?: string | null;
  platform?: string | null;
  screen?: string | null;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    capturedAtMs?: number | null;
  } | null;
};

export type RiskReasonCode =
  | "RATE_LIMIT_SPIKE"
  | "IP_PROXY_MEDIUM"
  | "IP_PROXY_HIGH"
  | "POOR_GPS_ACCURACY"
  | "RAPID_TABLE_SWITCH"
  | "RAPID_GEO_JUMP"
  | "IP_GPS_MISMATCH"
  | "MISSING_FINGERPRINT"
  | "UNKNOWN";

export type RiskDecision = "allow" | "suspicious" | "block";

export type RiskEvaluationResult = {
  score: number;
  level: "low" | "medium" | "high";
  decision: RiskDecision;
  reasons: RiskReasonCode[];
  details: Record<string, string | number | boolean | null>;
};

export type IpRiskResult = {
  risk: "low" | "medium" | "high";
  provider: string;
  country?: string | null;
  city?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isProxy?: boolean | null;
  isHosting?: boolean | null;
  notes?: string | null;
};
