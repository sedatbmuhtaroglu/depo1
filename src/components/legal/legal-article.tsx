import Link from "next/link";
import type { ReactNode } from "react";

type LegalArticleProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

/**
 * Ortak yasal metin sayfası kabuğu (landing / blog ile uyumlu koyu tema).
 */
export function LegalArticle({ title, lastUpdated, children }: LegalArticleProps) {
  return (
    <main className="min-h-screen bg-[#020817] px-4 py-12 text-[#f3f7ff] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-[#243252] bg-[#0f1b33] p-6 sm:p-8">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-[#22c55e] transition-colors hover:text-[#4ade80]"
          >
            ← Ana sayfa
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#94a3b8]">
            Son güncelleme: {lastUpdated}
          </p>
        </div>

        <div className="legal-prose space-y-6 text-sm leading-7 text-[#e2e8f0] [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[#f8fafc] [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#f1f5f9] [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-3 [&_ul]:list-disc">
          {children}
        </div>
      </article>
    </main>
  );
}
