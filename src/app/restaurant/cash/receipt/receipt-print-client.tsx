"use client";

import { useEffect } from "react";
import { buttonClasses } from "@/lib/ui/button-variants";

type ReceiptPrintClientProps = {
  autoPrint: boolean;
  printKey: string;
};

export default function ReceiptPrintClient({ autoPrint, printKey }: ReceiptPrintClientProps) {
  useEffect(() => {
    if (!autoPrint) return;
    const sessionKey = `cash_receipt_autoprint_${printKey}`;
    if (window.sessionStorage.getItem(sessionKey) === "1") return;
    window.sessionStorage.setItem(sessionKey, "1");
    const timer = window.setTimeout(() => {
      window.print();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [autoPrint, printKey]);

  return (
    <div className="mt-4 flex gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className={buttonClasses({ variant: "primary", size: "md", className: "h-10 flex-1 justify-center" })}
      >
        Yazdir
      </button>
    </div>
  );
}
