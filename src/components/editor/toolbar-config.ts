import type { ToolbarButtonDef, ToolbarVariant } from "./types";

/**
 * Full toolbar button registry.
 * Each button defines its id, display label/icon, aria label,
 * the tiptap action string, optional keyboard shortcut, and logical group.
 */
const ALL_BUTTONS: ToolbarButtonDef[] = [
  // ── Format ───────────────────────────────────────────────
  { id: "bold", label: "B", icon: "B", ariaLabel: "Kalın", action: "bold", shortcut: "Ctrl+B", group: "format" },
  { id: "italic", label: "I", icon: "I", ariaLabel: "İtalik", action: "italic", shortcut: "Ctrl+I", group: "format" },
  { id: "underline", label: "U", icon: "U", ariaLabel: "Altı Çizili", action: "underline", shortcut: "Ctrl+U", group: "format" },
  { id: "strike", label: "S", icon: "S", ariaLabel: "Üstü Çizili", action: "strike", shortcut: "Ctrl+Shift+X", group: "format" },
  { id: "code", label: "<>", icon: "<>", ariaLabel: "Satır İçi Kod", action: "code", shortcut: "Ctrl+E", group: "format" },
  { id: "clearFormatting", label: "Tx", icon: "Tx", ariaLabel: "Biçimi Temizle", action: "clearFormatting", group: "format" },

  // ── Heading ──────────────────────────────────────────────
  { id: "h1", label: "H1", icon: "H1", ariaLabel: "Başlık 1", action: "h1", group: "heading" },
  { id: "h2", label: "H2", icon: "H2", ariaLabel: "Başlık 2", action: "h2", group: "heading" },
  { id: "h3", label: "H3", icon: "H3", ariaLabel: "Başlık 3", action: "h3", group: "heading" },
  { id: "h4", label: "H4", icon: "H4", ariaLabel: "Başlık 4", action: "h4", group: "heading" },
  { id: "paragraph", label: "¶", icon: "¶", ariaLabel: "Paragraf", action: "paragraph", group: "heading" },

  // ── List ─────────────────────────────────────────────────
  { id: "bulletList", label: "•", icon: "•", ariaLabel: "Madde İşaretli Liste", action: "bulletList", group: "list" },
  { id: "orderedList", label: "1.", icon: "1.", ariaLabel: "Numaralı Liste", action: "orderedList", group: "list" },

  // ── Block ────────────────────────────────────────────────
  { id: "blockquote", label: "❝", icon: "❝", ariaLabel: "Alıntı", action: "blockquote", group: "block" },
  { id: "codeBlock", label: "{ }", icon: "{ }", ariaLabel: "Kod Bloğu", action: "codeBlock", group: "block" },
  { id: "horizontalRule", label: "—", icon: "—", ariaLabel: "Yatay Çizgi", action: "horizontalRule", group: "block" },

  // ── Insert ───────────────────────────────────────────────
  { id: "link", label: "🔗", icon: "🔗", ariaLabel: "Link Ekle/Düzenle", action: "link", group: "insert" },
  { id: "unlink", label: "🔗✕", icon: "🔗✕", ariaLabel: "Link Kaldır", action: "unlink", group: "insert" },

  // ── History ──────────────────────────────────────────────
  { id: "undo", label: "↩", icon: "↩", ariaLabel: "Geri Al", action: "undo", shortcut: "Ctrl+Z", group: "history" },
  { id: "redo", label: "↪", icon: "↪", ariaLabel: "Yinele", action: "redo", shortcut: "Ctrl+Shift+Z", group: "history" },

  // ── Tools ──────────────────────────────────────────────────
  { id: "sourceCode", label: "</>", icon: "</>", ariaLabel: "Kaynak Kod", action: "sourceCode", group: "tools" },
];

/**
 * Which button IDs are shown for each toolbar variant.
 */
const VARIANT_BUTTONS: Record<ToolbarVariant, string[]> = {
  full: ALL_BUTTONS.map((b) => b.id),
  compact: [
    "sourceCode",
    "bold", "italic", "underline", "strike",
    "h2", "h3", "paragraph",
    "bulletList", "orderedList",
    "blockquote", "codeBlock", "link", "unlink",
    "clearFormatting",
    "undo", "redo",
  ],
  minimal: [
    "sourceCode",
    "bold", "italic", "underline",
    "bulletList",
    "codeBlock",
    "link",
    "clearFormatting",
  ],
};

/**
 * Returns the ordered list of toolbar button definitions for a given variant.
 */
export function getToolbarButtons(variant: ToolbarVariant): ToolbarButtonDef[] {
  const ids = VARIANT_BUTTONS[variant];
  return ids
    .map((id) => ALL_BUTTONS.find((b) => b.id === id))
    .filter((b): b is ToolbarButtonDef => b !== undefined);
}

/**
 * Group buttons by their logical group for rendering dividers.
 */
export function groupToolbarButtons(buttons: ToolbarButtonDef[]): ToolbarButtonDef[][] {
  const groups: ToolbarButtonDef[][] = [];
  let currentGroup: string | null = null;
  let current: ToolbarButtonDef[] = [];

  for (const btn of buttons) {
    if (btn.group !== currentGroup) {
      if (current.length > 0) groups.push(current);
      current = [];
      currentGroup = btn.group;
    }
    current.push(btn);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
