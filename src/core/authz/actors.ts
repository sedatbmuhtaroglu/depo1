import type { StaffRole } from "@prisma/client";

export type AuthorizationActor =
  | {
      kind: "STAFF";
      tenantId: number;
      username: string;
      role: StaffRole;
    }
  | {
      kind: "HQ_SUPPORT";
      tenantId: number;
      hqUsername: string;
      supportSessionId: number;
    }
  | {
      kind: "HQ_ADMIN";
      username: string;
    }
  | {
      kind: "STOREFRONT_GUEST";
      tenantId?: number;
    }
  | {
      kind: "SYSTEM";
      service: string;
    }
  | {
      kind: "ANONYMOUS";
    };

export function createStaffActor(input: {
  tenantId: number;
  username: string;
  role: StaffRole;
}): AuthorizationActor {
  return {
    kind: "STAFF",
    tenantId: input.tenantId,
    username: input.username,
    role: input.role,
  };
}

export function createHqAdminActor(username: string): AuthorizationActor {
  return { kind: "HQ_ADMIN", username };
}

export function createHqSupportActor(input: {
  tenantId: number;
  hqUsername: string;
  supportSessionId: number;
}): AuthorizationActor {
  return {
    kind: "HQ_SUPPORT",
    tenantId: input.tenantId,
    hqUsername: input.hqUsername,
    supportSessionId: input.supportSessionId,
  };
}

export function createStorefrontGuestActor(tenantId?: number): AuthorizationActor {
  return { kind: "STOREFRONT_GUEST", tenantId };
}

export function createSystemActor(service: string): AuthorizationActor {
  return { kind: "SYSTEM", service };
}

export function createAnonymousActor(): AuthorizationActor {
  return { kind: "ANONYMOUS" };
}
