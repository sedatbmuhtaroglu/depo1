"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { fieldClasses } from "@/lib/ui/button-variants";

export type PanelSelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

type PanelSelectProps = {
  value: string | number;
  options: PanelSelectOption[];
  onValueChange: (value: string) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
};

function findNextEnabledIndex(
  options: Array<{ disabled?: boolean }>,
  startIndex: number,
  direction: 1 | -1,
) {
  if (options.length === 0) return -1;

  let index = startIndex;
  for (let i = 0; i < options.length; i += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index]?.disabled) {
      return index;
    }
  }

  return -1;
}

export function PanelSelect({
  value,
  options,
  onValueChange,
  size = "md",
  disabled = false,
  placeholder = "Seciniz",
  name,
  className,
  "aria-label": ariaLabel,
}: PanelSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        value: String(option.value),
      })),
    [options],
  );

  const selectedValue = String(value);
  const selectedIndex = normalizedOptions.findIndex((option) => option.value === selectedValue);
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const openMenu = (direction: 1 | -1 = 1) => {
    if (disabled || normalizedOptions.length === 0) return;
    const fallbackStart = direction === 1 ? -1 : normalizedOptions.length;
    const fallbackIndex = findNextEnabledIndex(normalizedOptions, fallbackStart, direction);
    const nextIndex =
      selectedIndex >= 0 && !normalizedOptions[selectedIndex]?.disabled
        ? selectedIndex
        : fallbackIndex;
    setActiveIndex(nextIndex);
    setOpen(true);
  };

  const closeMenu = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  };

  const selectAt = (index: number) => {
    const option = normalizedOptions[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    closeMenu(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        openMenu(-1);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Tab") {
      closeMenu(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction: 1 | -1 = event.key === "ArrowDown" ? 1 : -1;
      const start =
        activeIndex >= 0 ? activeIndex : direction === 1 ? -1 : normalizedOptions.length;
      const nextIndex = findNextEnabledIndex(normalizedOptions, start, direction);
      if (nextIndex >= 0) {
        setActiveIndex(nextIndex);
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(findNextEnabledIndex(normalizedOptions, -1, 1));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(findNextEnabledIndex(normalizedOptions, normalizedOptions.length, -1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0) {
        selectAt(activeIndex);
      }
    }
  };

  return (
    <div ref={rootRef} className={["ui-select-root w-full", className].filter(Boolean).join(" ")}>
      {name ? <input type="hidden" name={name} value={selectedOption?.value ?? ""} /> : null}
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu(1))}
        onKeyDown={onTriggerKeyDown}
        className={fieldClasses({
          size,
          className: `ui-select-trigger ${open ? "ui-select-trigger-open" : ""}`,
        })}
      >
        <span
          className={`ui-select-value ${selectedOption ? "" : "text-[var(--ui-text-muted)]"}`}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`ui-select-chevron ${open ? "rotate-180 text-[var(--ui-primary)]" : ""}`}
        />
      </button>

      {open && (
        <div className="ui-select-popover">
          <ul id={listboxId} role="listbox" aria-label={ariaLabel} className="ui-select-options">
            {normalizedOptions.map((option, index) => {
              const isSelected = option.value === selectedValue;
              const isActive = index === activeIndex;

              return (
                <li
                  key={`${option.value}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isActive ? "true" : "false"}
                  data-selected={isSelected ? "true" : "false"}
                  data-disabled={option.disabled ? "true" : "false"}
                  className="ui-select-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectAt(index)}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="ui-select-check" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
