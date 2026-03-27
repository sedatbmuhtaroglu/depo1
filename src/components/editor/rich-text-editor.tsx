"use client";

import { useEffect, useRef, useState, useId } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

import type { RichTextEditorProps } from "./types";
import { EditorToolbar } from "./editor-toolbar";
import { SourceCodeDialog } from "./source-code-dialog";
import { PastePreserveExtension } from "./paste-preserve-extension";
import { countWords, countCharacters, sanitizeSourceHtmlForEditor } from "./sanitize";
import { rteSourceHtmlExtensions } from "./rte-source-html-extensions";

/**
 * Centralized RichTextEditor – Tiptap-based, production-grade.
 *
 * API:
 *  value / onChange  – controlled HTML string
 *  placeholder       – shown when empty
 *  disabled          – prevents editing
 *  readOnly          – renders content in non-editable mode
 *  minHeight         – CSS value for editor area min-height
 *  toolbarVariant    – "full" | "compact" | "minimal"
 *  outputFormat      – "html" (default)
 *  hiddenInputName   – adds a hidden <input> for native form submission
 *  label / helperText / showCount / maxLength / className
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Metin girin...",
  disabled = false,
  readOnly = false,
  minHeight = "160px",
  toolbarVariant = "compact",
  hiddenInputName,
  label,
  helperText,
  showCount = false,
  maxLength,
  className,
}: RichTextEditorProps) {
  /** Track whether the onChange comes from within the editor (avoid loop) */
  const internalUpdate = useRef(false);

  // Source Code Dialog State
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [sourceHtml, setSourceHtml] = useState("");

  const editor = useEditor({
    extensions: [
      PastePreserveExtension,
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: { HTMLAttributes: { class: "rte-code-block" } },
        blockquote: { HTMLAttributes: { class: "rte-blockquote" } },
        horizontalRule: false, // use standalone extension
        code: { HTMLAttributes: { class: "rte-inline-code" } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "rte-link",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "rte-placeholder",
      }),
      CharacterCount.configure({
        limit: maxLength,
      }),
      HorizontalRule,
      ...rteSourceHtmlExtensions,
    ],
    content: value || "",
    editable: !readOnly && !disabled,
    editorProps: {
      attributes: {
        class: "rte-content",
        style: `min-height: ${minHeight}`,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label ?? "Metin editörü",
      },
      // Normalize pasted content (strip Word junk, etc.)
      transformPastedHTML(html: string) {
        return html
          .replace(/<meta[^>]*>/gi, "")
          .replace(/<link[^>]*>/gi, "")
          .replace(/class="[^"]*"/gi, "")
          .replace(/style="[^"]*"/gi, "")
          .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "");
      },
    },
    onUpdate({ editor: ed }) {
      internalUpdate.current = true;
      const html = ed.getHTML();
      // Tiptap returns <p></p> for empty content
      const normalized = html === "<p></p>" ? "" : html;
      onChange(normalized);
    },
    // SSR safety – suppress hydration warnings
    immediatelyRender: false,
  });

  // Sync external value → editor (only when value changes externally)
  useEffect(() => {
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    if (!editor) return;
    const current = editor.getHTML();
    const normalizedCurrent = current === "<p></p>" ? "" : current;
    if (normalizedCurrent !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  // Update editable state when disabled/readOnly changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly && !disabled);
  }, [readOnly, disabled, editor]);

  const wordCount = showCount ? countWords(value) : 0;
  const charCount = showCount ? countCharacters(value) : 0;

  const editorId = useId();

  if (readOnly) {
    return (
      <div className={`rte-readonly ${className ?? ""}`}>
        {label ? <p className="rte-readonly-label">{label}</p> : null}
        <div
          className="rte-content rte-content--readonly"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      </div>
    );
  }

  return (
    <div className={`rte-wrapper ${disabled ? "rte-wrapper--disabled" : ""} ${className ?? ""}`}>
      {label ? (
        <label htmlFor={editorId} className="rte-label">
          {label}
        </label>
      ) : null}

      <div className="rte-chrome">
        <EditorToolbar 
          editor={editor} 
          variant={toolbarVariant} 
          onSourceCodeOpen={() => {
            if (!editor) return;
            setSourceHtml(editor.getHTML());
            setIsSourceOpen(true);
          }}
        />

        <div className="rte-editor-area">
          <EditorContent editor={editor} id={editorId} />
        </div>

        {(showCount || helperText) ? (
          <div className="rte-footer">
            {helperText ? <span className="rte-helper">{helperText}</span> : <span />}
            {showCount ? (
              <span className="rte-count">
                {wordCount} kelime · {charCount} karakter
                {maxLength ? ` / ${maxLength}` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {hiddenInputName ? (
        <input type="hidden" name={hiddenInputName} value={value} readOnly />
      ) : null}

      {/* Source Code editing modal */}
      <SourceCodeDialog
        isOpen={isSourceOpen}
        initialValue={sourceHtml}
        onClose={() => setIsSourceOpen(false)}
        onApply={(updatedHtml) => {
          if (editor) {
            editor.commands.setContent(sanitizeSourceHtmlForEditor(updatedHtml));
          }
          setIsSourceOpen(false);
        }}
      />
    </div>
  );
}
