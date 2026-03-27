"use client";

import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";

interface SourceCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (sourceHtml: string) => void;
  initialValue: string;
}

export function SourceCodeDialog({ isOpen, onClose, onApply, initialValue }: SourceCodeDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Sync initial value when dialog opens (render-phase update to satisfy react-compiler)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setValue(initialValue);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--ui-surface-bg)] shadow-2xl ring-1 ring-[var(--ui-border)]">
        <div className="flex items-center justify-between border-b border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)] px-5 py-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Kaynak Kod (HTML)</h3>
            <p className="text-xs text-[var(--ui-text-secondary)]">
              İzinli HTML (başlıklar, paragraflar, liste, bağlantı, div/section, form alanları, görsel vb.) burada{" "}
              <strong>gerçek içerik</strong> olarak uygulanır. Script ve stil etiketleri kaldırılır; izin dışı
              etiketler güvenlik için kod bloğu olarak saklanır.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-text-primary)]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="relative min-h-[300px] max-h-[60vh] flex-1 overflow-auto bg-[var(--ui-surface-muted)] text-[13px]">
          <CodeMirror
            value={value}
            height="100%"
            minHeight="300px"
            extensions={[html()]}
            onChange={(val) => setValue(val)}
            theme="dark" // We can use dark theme or unstyled to match. For code, dark is usually safe and distinct.
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              tabSize: 2,
            }}
            className="h-full"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ui-border-subtle)] bg-[var(--ui-surface-bg)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-text-primary)]"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => onApply(value)}
            className="rounded-lg bg-[var(--ui-primary)] px-5 py-2 text-sm font-medium text-[var(--ui-primary-foreground)] hover:bg-[var(--ui-primary-hover)] active:scale-[0.98]"
          >
            Uygula
          </button>
        </div>
      </div>
    </div>
  );
}
