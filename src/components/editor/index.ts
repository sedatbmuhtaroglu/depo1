/**
 * Centralized Editor — barrel export
 *
 * Usage:
 *   import { RichTextEditor } from "@/components/editor";
 *   import { RichTextRenderer } from "@/components/editor";
 *   import { sanitizeEditorHtml } from "@/components/editor";
 *
 * Disallowed HTML is preserved as visible <pre><code class="rte-preserved-block"> (not executed).
 */

// CSS import – must be imported once in the consuming tree
import "./editor.css";

export { RichTextEditor } from "./rich-text-editor";
export { RichTextRenderer } from "./rich-text-renderer";
export { EditorToolbar } from "./editor-toolbar";
export { sanitizeEditorHtml, stripHtmlClient, countWords, countCharacters } from "./sanitize";
export { getToolbarButtons, groupToolbarButtons } from "./toolbar-config";
export type {
  RichTextEditorProps,
  ToolbarVariant,
  OutputFormat,
  ToolbarButtonDef,
} from "./types";
