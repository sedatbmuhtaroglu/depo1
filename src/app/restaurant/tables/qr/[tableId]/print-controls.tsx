"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PrintControls({
  backHref,
  autoPrint,
}: {
  backHref: string;
  autoPrint: boolean;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const id = window.setTimeout(() => {
      window.print();
    }, 250);
    return () => window.clearTimeout(id);
  }, [autoPrint]);

  return (
    <div className="qr-print-actions mb-4 flex items-center justify-between gap-2 print:hidden">
      <Link
        href={backHref}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        Masalara Don
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
      >
        Yazdir
      </button>
    </div>
  );
}
