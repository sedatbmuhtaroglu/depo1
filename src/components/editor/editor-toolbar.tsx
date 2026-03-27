"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { ToolbarVariant } from "./types";
import { getToolbarButtons, groupToolbarButtons } from "./toolbar-config";

interface EditorToolbarProps {
  editor: Editor | null;
  variant: ToolbarVariant;
  onSourceCodeOpen?: () => void;
}

/**
 * Renders the toolbar buttons for the Tiptap editor.
 * Respects the variant to show full / compact / minimal button sets.
 */
export function EditorToolbar({ editor, variant, onSourceCodeOpen }: EditorToolbarProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const buttons = getToolbarButtons(variant);
  const groups = groupToolbarButtons(buttons);

  const handleLinkOpen = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previousUrl ?? "https://");
    setLinkDialogOpen(true);
  }, [editor]);

  const handleLinkConfirm = useCallback(() => {
    if (!editor) return;
    const trimmed = linkUrl.trim();

    if (!trimmed || trimmed === "https://") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: trimmed, target: "_blank" })
        .run();
    }

    setLinkDialogOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleLinkRemove = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setLinkDialogOpen(false);
    setLinkUrl("");
  }, [editor]);

  const executeAction = useCallback(
    (actionId: string) => {
      if (!editor) return;

      switch (actionId) {
        case "sourceCode":
          onSourceCodeOpen?.();
          break;
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "underline":
          editor.chain().focus().toggleUnderline().run();
          break;
        case "strike":
          editor.chain().focus().toggleStrike().run();
          break;
        case "code":
          editor.chain().focus().toggleCode().run();
          break;
        case "clearFormatting":
          editor.chain().focus().clearNodes().unsetAllMarks().run();
          break;
        case "h1":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "h2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "h3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "h4":
          editor.chain().focus().toggleHeading({ level: 4 }).run();
          break;
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "codeBlock":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "horizontalRule":
          editor.chain().focus().setHorizontalRule().run();
          break;
        case "link":
          handleLinkOpen();
          break;
        case "unlink":
          editor.chain().focus().unsetLink().run();
          break;
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
      }
    },
    [editor, onSourceCodeOpen, handleLinkOpen],
  );

  const isActive = useCallback(
    (actionId: string): boolean => {
      if (!editor) return false;
      switch (actionId) {
        case "bold": return editor.isActive("bold");
        case "italic": return editor.isActive("italic");
        case "underline": return editor.isActive("underline");
        case "strike": return editor.isActive("strike");
        case "code": return editor.isActive("code");
        case "h1": return editor.isActive("heading", { level: 1 });
        case "h2": return editor.isActive("heading", { level: 2 });
        case "h3": return editor.isActive("heading", { level: 3 });
        case "h4": return editor.isActive("heading", { level: 4 });
        case "bulletList": return editor.isActive("bulletList");
        case "orderedList": return editor.isActive("orderedList");
        case "blockquote": return editor.isActive("blockquote");
        case "codeBlock": return editor.isActive("codeBlock");
        case "link": return editor.isActive("link");
        default: return false;
      }
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <>
      <div className="rte-toolbar" role="toolbar" aria-label="Metin biçimlendirme">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="rte-toolbar-group">
            {group.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className={`rte-toolbar-btn ${isActive(btn.action) ? "rte-toolbar-btn--active" : ""}`}
                onClick={() => executeAction(btn.action)}
                aria-label={btn.ariaLabel}
                aria-pressed={isActive(btn.action)}
                title={btn.shortcut ? `${btn.ariaLabel} (${btn.shortcut})` : btn.ariaLabel}
              >
                <span className={`rte-toolbar-btn-label ${btn.id === "bold" ? "rte-toolbar-btn-label--bold" : ""} ${btn.id === "italic" ? "rte-toolbar-btn-label--italic" : ""} ${btn.id === "underline" ? "rte-toolbar-btn-label--underline" : ""} ${btn.id === "strike" ? "rte-toolbar-btn-label--strike" : ""}`}>
                  {btn.label}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Link dialog */}
      {linkDialogOpen ? (
        <div className="rte-link-dialog">
          <label className="rte-link-dialog-label">Link URL</label>
          <div className="rte-link-dialog-row">
            <input
              type="url"
              className="rte-link-dialog-input"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLinkConfirm();
                }
                if (e.key === "Escape") {
                  setLinkDialogOpen(false);
                }
              }}
              placeholder="https://ornek.com"
              autoFocus
            />
            <button
              type="button"
              className="rte-link-dialog-confirm"
              onClick={handleLinkConfirm}
            >
              Uygula
            </button>
            <button
              type="button"
              className="rte-link-dialog-remove"
              onClick={handleLinkRemove}
            >
              Kaldir
            </button>
            <button
              type="button"
              className="rte-link-dialog-cancel"
              onClick={() => setLinkDialogOpen(false)}
            >
              Iptal
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
