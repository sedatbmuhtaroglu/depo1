type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "success"
  | "warning"
  | "danger";

type ButtonSize = "xs" | "sm" | "md";

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary: "ui-btn-primary",
  secondary: "ui-btn-secondary",
  outline: "ui-btn-outline",
  ghost: "ui-btn-ghost",
  success: "ui-btn-success",
  warning: "ui-btn-warning",
  danger: "ui-btn-danger",
};

const sizeClassMap: Record<ButtonSize, string> = {
  xs: "ui-btn-xs",
  sm: "ui-btn-sm",
  md: "ui-btn-md",
};

function cx(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function buttonClasses({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonClassOptions = {}) {
  return cx([
    "ui-btn",
    variantClassMap[variant],
    sizeClassMap[size],
    fullWidth && "w-full",
    className,
  ]);
}

type ChipVariant = "neutral" | "success" | "warning" | "danger";

export function chipClasses(variant: ChipVariant = "neutral", className?: string) {
  return cx(["ui-chip", `ui-chip-${variant}`, className]);
}

export function actionLinkClasses(className?: string) {
  return cx(["ui-action-link", className]);
}

type CardTone = "default" | "subtle" | "warning" | "danger" | "success";

type CardClassOptions = {
  tone?: CardTone;
  className?: string;
};

const cardToneClassMap: Record<CardTone, string> = {
  default: "ui-card-default",
  subtle: "ui-card-subtle",
  warning: "ui-card-warning",
  danger: "ui-card-danger",
  success: "ui-card-success",
};

export function cardClasses({ tone = "default", className }: CardClassOptions = {}) {
  return cx(["ui-card", cardToneClassMap[tone], className]);
}

type FieldSize = "sm" | "md";

type FieldClassOptions = {
  size?: FieldSize;
  invalid?: boolean;
  className?: string;
};

const fieldSizeClassMap: Record<FieldSize, string> = {
  sm: "ui-field-sm",
  md: "ui-field-md",
};

export function fieldClasses({
  size = "md",
  invalid = false,
  className,
}: FieldClassOptions = {}) {
  return cx(["ui-field", fieldSizeClassMap[size], invalid && "ui-field-invalid", className]);
}

export function selectClasses(options: FieldClassOptions = {}) {
  return fieldClasses({ ...options, className: cx(["ui-select", options.className]) });
}

export function textareaClasses(options: FieldClassOptions = {}) {
  return fieldClasses({ ...options, className: cx(["ui-textarea", options.className]) });
}

export function labelClasses(className?: string) {
  return cx(["ui-label", className]);
}

export function helperTextClasses(className?: string) {
  return cx(["ui-helper-text", className]);
}

type CheckboxControlClassOptions = {
  checked?: boolean;
  compact?: boolean;
  className?: string;
};

export function checkboxControlClasses({
  checked = false,
  compact = false,
  className,
}: CheckboxControlClassOptions = {}) {
  return cx([
    "ui-checkbox-control",
    checked && "ui-checkbox-control-active",
    compact && "ui-checkbox-control-compact",
    className,
  ]);
}

export function checkboxInputClasses(className?: string) {
  return cx(["ui-checkbox", className]);
}

export function checkboxLabelClasses(className?: string) {
  return cx(["ui-checkbox-label", className]);
}

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

export function badgeClasses(variant: BadgeVariant = "neutral", className?: string) {
  return cx(["ui-badge", `ui-badge-${variant}`, className]);
}
