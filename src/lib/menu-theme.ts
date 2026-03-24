export const MIN_MENU_FONT_SIZE_PX = 12;
export const MAX_MENU_FONT_SIZE_PX = 24;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

type ThemeColor = "primary" | "secondary";

type MenuThemeBase = {
  textColor: string;
  backgroundColor: string;
  buttonBackgroundColor: string;
  headerBackgroundColor: string;
};

export type MenuThemeInput = {
  themeColor?: ThemeColor | null;
  menuFontSizePx?: number | null;
  menuTextColor?: string | null;
  menuBackgroundColor?: string | null;
  menuButtonBackgroundColor?: string | null;
  menuHeaderBackgroundColor?: string | null;
};

export type ResolvedMenuTheme = {
  fontSizePx: number;
  textColor: string;
  backgroundColor: string;
  buttonBackgroundColor: string;
  headerBackgroundColor: string;
};

const THEME_BASE_DEFAULTS: Record<ThemeColor, MenuThemeBase> = {
  primary: {
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    buttonBackgroundColor: "#F97316",
    headerBackgroundColor: "#111827",
  },
  secondary: {
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    buttonBackgroundColor: "#10B981",
    headerBackgroundColor: "#0F172A",
  },
};

const DEFAULT_FONT_SIZE_PX = 16;

const normalizeThemeColor = (value: ThemeColor | null | undefined): ThemeColor =>
  value === "secondary" ? "secondary" : "primary";

const clampFontSize = (value: number): number =>
  Math.max(
    MIN_MENU_FONT_SIZE_PX,
    Math.min(MAX_MENU_FONT_SIZE_PX, Math.round(value)),
  );

const normalizeHexColor = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
};

export const isValidHexColor = (value: string): boolean =>
  HEX_COLOR_PATTERN.test(value.trim());

export const validateMenuThemeInput = (input: {
  menuFontSizePx?: number | null;
  menuTextColor?: string | null;
  menuBackgroundColor?: string | null;
  menuButtonBackgroundColor?: string | null;
  menuHeaderBackgroundColor?: string | null;
}): { valid: true } | { valid: false; message: string } => {
  if (input.menuFontSizePx !== undefined && input.menuFontSizePx !== null) {
    if (
      !Number.isFinite(input.menuFontSizePx) ||
      !Number.isInteger(input.menuFontSizePx) ||
      input.menuFontSizePx < MIN_MENU_FONT_SIZE_PX ||
      input.menuFontSizePx > MAX_MENU_FONT_SIZE_PX
    ) {
      return {
        valid: false,
        message: `Yazi boyutu ${MIN_MENU_FONT_SIZE_PX}-${MAX_MENU_FONT_SIZE_PX} px araliginda olmalidir.`,
      };
    }
  }

  const colorFields: Array<[string | null | undefined, string]> = [
    [input.menuTextColor, "Yazi rengi"],
    [input.menuBackgroundColor, "Arkaplan rengi"],
    [input.menuButtonBackgroundColor, "Buton arkaplan rengi"],
    [input.menuHeaderBackgroundColor, "Header arkaplan rengi"],
  ];
  for (const [value, label] of colorFields) {
    if (value == null) continue;
    if (!isValidHexColor(value)) {
      return {
        valid: false,
        message: `${label} #RRGGBB formatinda olmalidir.`,
      };
    }
  }

  return { valid: true };
};

export const resolveMenuTheme = (input: MenuThemeInput): ResolvedMenuTheme => {
  const themeColor = normalizeThemeColor(input.themeColor);
  const defaults = THEME_BASE_DEFAULTS[themeColor];

  const fontSizePx =
    typeof input.menuFontSizePx === "number" && Number.isFinite(input.menuFontSizePx)
      ? clampFontSize(input.menuFontSizePx)
      : DEFAULT_FONT_SIZE_PX;

  return {
    fontSizePx,
    textColor: normalizeHexColor(input.menuTextColor) ?? defaults.textColor,
    backgroundColor:
      normalizeHexColor(input.menuBackgroundColor) ?? defaults.backgroundColor,
    buttonBackgroundColor:
      normalizeHexColor(input.menuButtonBackgroundColor) ??
      defaults.buttonBackgroundColor,
    headerBackgroundColor:
      normalizeHexColor(input.menuHeaderBackgroundColor) ??
      defaults.headerBackgroundColor,
  };
};

export const getReadableTextColor = (
  backgroundColor: string,
): "#000000" | "#FFFFFF" => {
  const normalized = normalizeHexColor(backgroundColor);
  if (!normalized) return "#FFFFFF";

  const rgb = normalized.slice(1);
  const r = Number.parseInt(rgb.slice(0, 2), 16);
  const g = Number.parseInt(rgb.slice(2, 4), 16);
  const b = Number.parseInt(rgb.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness >= 150 ? "#000000" : "#FFFFFF";
};
