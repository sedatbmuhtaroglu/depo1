import { prisma } from "@/lib/prisma";
import {
  calculateDistanceMeters,
  DEFAULT_ORDER_RADIUS_METERS,
  MAX_ORDER_RADIUS_METERS,
  MIN_ORDER_RADIUS_METERS,
  isValidLatitude,
  isValidLongitude,
} from "@/lib/location";

export type OrderLocationInput = {
  latitude: number;
  longitude: number;
};

export type OrderLocationValidationResult =
  | {
      allowed: true;
      enforced: boolean;
      distanceMeters?: number;
      radiusMeters?: number;
    }
  | {
      allowed: false;
      code:
        | "RESTAURANT_NOT_FOUND"
        | "RESTAURANT_LOCATION_NOT_CONFIGURED"
        | "CUSTOMER_LOCATION_REQUIRED"
        | "CUSTOMER_LOCATION_INVALID"
        | "OUT_OF_RANGE";
      message: string;
      distanceMeters?: number;
      radiusMeters?: number;
    };

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function validateOrderLocationForTenant(options: {
  tenantId: number;
  restaurantId: number;
  customerLocation?: OrderLocationInput | null;
}): Promise<OrderLocationValidationResult> {
  const { tenantId, restaurantId, customerLocation } = options;

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      id: restaurantId,
      tenantId,
    },
    select: {
      id: true,
      locationEnforcementEnabled: true,
      orderRadiusMeters: true,
      locationLatitude: true,
      locationLongitude: true,
    },
  });

  if (!restaurant) {
    return {
      allowed: false,
      code: "RESTAURANT_NOT_FOUND",
      message: "Restoran bulunamadi.",
    };
  }

  if (!restaurant.locationEnforcementEnabled) {
    return { allowed: true, enforced: false };
  }

  const restaurantLat = toNumberOrNull(restaurant.locationLatitude);
  const restaurantLng = toNumberOrNull(restaurant.locationLongitude);

  if (
    restaurantLat === null ||
    restaurantLng === null ||
    !isValidLatitude(restaurantLat) ||
    !isValidLongitude(restaurantLng)
  ) {
    return {
      allowed: false,
      code: "RESTAURANT_LOCATION_NOT_CONFIGURED",
      message:
        "Restoran konum ayarlari eksik. Lutfen isletme yöneticisine basvurun.",
    };
  }

  const radiusCandidate = Number(restaurant.orderRadiusMeters);
  const radiusMeters = Number.isFinite(radiusCandidate)
    ? Math.min(
        MAX_ORDER_RADIUS_METERS,
        Math.max(MIN_ORDER_RADIUS_METERS, Math.round(radiusCandidate)),
      )
    : DEFAULT_ORDER_RADIUS_METERS;

  if (!customerLocation) {
    return {
      allowed: false,
      code: "CUSTOMER_LOCATION_REQUIRED",
      message: "Sipariş verebilmek icin konum dogrulamasi gerekli.",
      radiusMeters,
    };
  }

  if (
    !isValidLatitude(customerLocation.latitude) ||
    !isValidLongitude(customerLocation.longitude)
  ) {
    return {
      allowed: false,
      code: "CUSTOMER_LOCATION_INVALID",
      message: "Konum bilgisi gecersiz. Lutfen tekrar deneyin.",
      radiusMeters,
    };
  }

  const distanceMeters = calculateDistanceMeters(
    restaurantLat,
    restaurantLng,
    customerLocation.latitude,
    customerLocation.longitude,
  );

  if (distanceMeters > radiusMeters) {
    return {
      allowed: false,
      code: "OUT_OF_RANGE",
      message: `Restorana yeterince yakin degilsiniz. Mesafe: ${Math.round(distanceMeters)} m, izin verilen: ${radiusMeters} m.`,
      distanceMeters,
      radiusMeters,
    };
  }

  return {
    allowed: true,
    enforced: true,
    distanceMeters,
    radiusMeters,
  };
}

