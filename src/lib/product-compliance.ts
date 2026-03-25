export const PRODUCT_COMPLIANCE_STATUS_VALUES = [
  "YES",
  "NO",
  "UNSPECIFIED",
] as const;

export type ProductComplianceStatusValue =
  (typeof PRODUCT_COMPLIANCE_STATUS_VALUES)[number];

export const PRODUCT_ALLERGEN_VALUES = [
  "CEREALS_CONTAINING_GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOYBEANS",
  "MILK",
  "TREE_NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHUR_DIOXIDE_AND_SULPHITES",
  "LUPIN",
  "MOLLUSCS",
] as const;

export type ProductAllergenValue = (typeof PRODUCT_ALLERGEN_VALUES)[number];

export type ProductComplianceInfoView = {
  basicIngredients?: string | null;
  caloriesKcal?: number | null;
  allergens?: ProductAllergenValue[] | null;
  customAllergens?: string[] | null;
  alcoholStatus?: ProductComplianceStatusValue | null;
  porkStatus?: ProductComplianceStatusValue | null;
  crossContaminationNote?: string | null;
};

export const PRODUCT_COMPLIANCE_STATUS_LABELS: Record<
  ProductComplianceStatusValue,
  string
> = {
  YES: "Var",
  NO: "Yok",
  UNSPECIFIED: "Belirtilmedi",
};

export const PRODUCT_ALLERGEN_LABELS: Record<ProductAllergenValue, string> = {
  CEREALS_CONTAINING_GLUTEN: "Gluten içeren tahıllar",
  CRUSTACEANS: "Kabuklular",
  EGGS: "Yumurta",
  FISH: "Balık",
  PEANUTS: "Yer fıstığı",
  SOYBEANS: "Soya",
  MILK: "Süt",
  TREE_NUTS: "Sert kabuklu yemişler",
  CELERY: "Kereviz",
  MUSTARD: "Hardal",
  SESAME: "Susam",
  SULPHUR_DIOXIDE_AND_SULPHITES: "Sülfitler",
  LUPIN: "Acı bakla",
  MOLLUSCS: "Yumuşakçalar",
};

export function isProductComplianceStatus(
  value: unknown,
): value is ProductComplianceStatusValue {
  return (
    typeof value === "string" &&
    PRODUCT_COMPLIANCE_STATUS_VALUES.includes(
      value as ProductComplianceStatusValue,
    )
  );
}

export function isProductAllergen(value: unknown): value is ProductAllergenValue {
  return (
    typeof value === "string" &&
    PRODUCT_ALLERGEN_VALUES.includes(value as ProductAllergenValue)
  );
}

export function normalizeOptionalComplianceText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function hasProductComplianceDisplayData(
  info: ProductComplianceInfoView | null | undefined,
) {
  if (!info) return false;
  return Boolean(
    info.basicIngredients?.trim() ||
      info.crossContaminationNote?.trim() ||
      info.caloriesKcal !== null && info.caloriesKcal !== undefined ||
      (info.allergens?.length ?? 0) > 0 ||
      (info.customAllergens?.length ?? 0) > 0 ||
      (info.alcoholStatus && info.alcoholStatus !== "UNSPECIFIED") ||
      (info.porkStatus && info.porkStatus !== "UNSPECIFIED"),
  );
}
