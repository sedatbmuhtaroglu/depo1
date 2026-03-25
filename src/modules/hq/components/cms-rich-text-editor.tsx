"use client";

import { useEffect, useId, useRef } from "react";
import { buttonClasses, labelClasses } from "@/lib/ui/button-variants";

type CmsRichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  minHeightClassName?: string;
};

function ToolbarButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={buttonClasses({
        variant: "outline",
        size: "xs",
        className: "rounded-lg px-2.5 py-1 text-[11px]",
      })}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function CmsRichTextEditor({
  label,
  value,
  onChange,
  placeholder = "Metin girin...",
  helperText,
  minHeightClassName = "min-h-[110px]",
}: CmsRichTextEditorProps) {
  const editorId = useId();
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  const runCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    onChange(editor.innerHTML);
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={editorId} className={labelClasses()}>
        {label}
      </label>

      <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-2">
        <div className="mb-2 flex flex-wrap gap-1.5 border-b border-[var(--ui-border-subtle)] pb-2">
          <ToolbarButton label="B" onClick={() => runCommand("bold")} />
          <ToolbarButton label="I" onClick={() => runCommand("italic")} />
          <ToolbarButton label="U" onClick={() => runCommand("underline")} />
          <ToolbarButton label="Liste" onClick={() => runCommand("insertUnorderedList")} />
          <ToolbarButton
            label="Link"
            onClick={() => {
              const href = window.prompt("Link girin (https:// veya /):", "https://");
              if (!href) return;
              runCommand("createLink", href);
            }}
          />
          <ToolbarButton label="Temizle" onClick={() => runCommand("removeFormat")} />
        </div>

        <div
          id={editorId}
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          className={`cms-rich-editor ${minHeightClassName} rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)] px-3 py-2 text-sm text-[var(--ui-text-primary)] outline-none focus:border-[var(--ui-primary)] focus:ring-2 focus:ring-[var(--ui-field-focus-ring)]`}
          onInput={(event) => {
            onChange((event.currentTarget as HTMLDivElement).innerHTML);
          }}
        />
      </div>

      {helperText ? <p className="text-xs text-[var(--ui-text-secondary)]">{helperText}</p> : null}
    </div>
  );
}
