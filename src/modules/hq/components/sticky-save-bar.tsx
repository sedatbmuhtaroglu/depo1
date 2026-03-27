"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/lib/ui/button-variants";

type StickySaveBarProps = {
  saveLabel: string;
  savingLabel?: string;
  isPending?: boolean;
  isDirty?: boolean;
  dirtyLabel?: string;
  cleanLabel?: string;
  message?: string;
  isMessageSuccess?: boolean;
  className?: string;
  actions?: ReactNode;
};

function cx(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function serializeFormData(form: HTMLFormElement) {
  const formData = new FormData(form);
  const entries = Array.from(formData.entries())
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
      return leftKey.localeCompare(rightKey);
    });

  return JSON.stringify(entries);
}

function serializeDeps(deps: ReadonlyArray<unknown>) {
  try {
    return JSON.stringify(deps);
  } catch {
    return String(deps.length);
  }
}

export function useFormDirtyState<T extends HTMLFormElement>(
  formRef: React.RefObject<T | null>,
  deps: ReadonlyArray<unknown> = [],
) {
  const initialSnapshotRef = useRef<string>("");
  const lastDepsKeyRef = useRef<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const depsKey = serializeDeps(deps);

  const markCurrentAsClean = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    initialSnapshotRef.current = serializeFormData(form);
    setIsDirty(false);
  }, [formRef]);

  const evaluateDirtyState = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const currentSnapshot = serializeFormData(form);
    setIsDirty(currentSnapshot !== initialSnapshotRef.current);
  }, [formRef]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    initialSnapshotRef.current = serializeFormData(form);

    const handleChange = () => evaluateDirtyState();
    form.addEventListener("input", handleChange, true);
    form.addEventListener("change", handleChange, true);

    return () => {
      form.removeEventListener("input", handleChange, true);
      form.removeEventListener("change", handleChange, true);
    };
  }, [evaluateDirtyState, formRef]);

  useEffect(() => {
    if (lastDepsKeyRef.current === depsKey) return;
    lastDepsKeyRef.current = depsKey;
    evaluateDirtyState();
  });

  return {
    isDirty,
    markCurrentAsClean,
  };
}

export function StickySaveBar({
  saveLabel,
  savingLabel = "Kaydediliyor...",
  isPending = false,
  isDirty,
  dirtyLabel = "Kaydedilmemis degisiklikler var",
  cleanLabel = "Tum degisiklikler kayitla senkron",
  message,
  isMessageSuccess,
  className,
  actions,
}: StickySaveBarProps) {
  const helperToneClass = message
    ? isMessageSuccess
      ? "text-[color:var(--ui-success)]"
      : "text-[color:var(--ui-danger)]"
    : isDirty
      ? "text-[color:var(--ui-warning)]"
      : "text-[var(--ui-text-secondary)]";

  const helperText = message ?? (isDirty ? dirtyLabel : cleanLabel);

  return (
    <div className={cx(["sticky top-3 z-40", className])}>
      <div
        className={cx([
          "rounded-2xl border border-[var(--ui-border)] px-3 py-2.5 shadow-sm sm:px-4",
          "bg-[color:color-mix(in_srgb,var(--ui-surface-bg)_94%,transparent)] supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--ui-surface-bg)_82%,transparent)]",
          "supports-[backdrop-filter]:backdrop-blur-[6px]",
        ])}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cx(["text-xs font-medium sm:text-sm", helperToneClass])}>{helperText}</p>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary", size: "sm" })}>
              {isPending ? savingLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
