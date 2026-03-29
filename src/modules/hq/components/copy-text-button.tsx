"use client";

import { useState } from "react";
import { buttonClasses } from "@/lib/ui/button-variants";

type CopyTextButtonProps = {
  value: string;
  label?: string;
  size?: "xs" | "sm" | "md";
};

export function CopyTextButton({ value, label = "Kopyala", size = "xs" }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={buttonClasses({ variant: "ghost", size })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Kopyalandi" : label}
    </button>
  );
}
