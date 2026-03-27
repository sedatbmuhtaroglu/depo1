/**
 * Shared types for the centralized RichTextEditor system.
 */

/** Toolbar feature sets */
export type ToolbarVariant = "full" | "compact" | "minimal";

/** Output format options */
export type OutputFormat = "html" | "text";

/** Props accepted by the main RichTextEditor component */
export interface RichTextEditorProps {
  /** Current HTML value */
  value: string;
  /** Called when content changes */
  onChange: (value: string) => void;
  /** Placeholder text shown when editor is empty */
  placeholder?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether the editor is read-only (renders content without editable UI) */
  readOnly?: boolean;
  /** Minimum height CSS value, e.g. "200px" */
  minHeight?: string;
  /** Toolbar variant controlling which buttons are shown */
  toolbarVariant?: ToolbarVariant;
  /** Output format (default: "html") */
  outputFormat?: OutputFormat;
  /** Optional hidden input name for form submission */
  hiddenInputName?: string;
  /** Label text above the editor */
  label?: string;
  /** Helper text below the editor */
  helperText?: string;
  /** Show character/word count */
  showCount?: boolean;
  /** Max character count (soft limit – only for display) */
  maxLength?: number;
  /** CSS class names for the outer wrapper */
  className?: string;
}

/** Toolbar button definition */
export interface ToolbarButtonDef {
  id: string;
  label: string;
  icon: string;
  ariaLabel: string;
  action: string;
  shortcut?: string;
  group: "format" | "heading" | "list" | "block" | "insert" | "history" | "tools";
}
