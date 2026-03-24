export type RestaurantThemeMode = "day" | "night";

export const RESTAURANT_THEME_STORAGE_KEY = "menucy:restaurant-manager-theme";
export const DEFAULT_RESTAURANT_THEME: RestaurantThemeMode = "day";

export function normalizeRestaurantTheme(
  value: string | null | undefined,
): RestaurantThemeMode {
  return value === "night" ? "night" : "day";
}
