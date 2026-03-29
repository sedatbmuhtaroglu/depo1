import type { ContentEmbedBlockStored } from "@/modules/content/shared/embed-blocks";

type ContentEmbedBlocksRendererProps = {
  blocks: ContentEmbedBlockStored[] | null | undefined;
  className?: string;
};

/**
 * Renders persisted embed blocks (already server-sanitized at save time).
 * html_embed: sandboxed iframe markup; custom_code: static HTML subset.
 */
export function ContentEmbedBlocksRenderer({ blocks, className }: ContentEmbedBlocksRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div
      className={
        className ??
        "content-embed-blocks mt-8 space-y-6 border-t border-slate-700/80 pt-8 text-inherit"
      }
    >
      {blocks.map((block) => (
        <section
          key={block.id}
          className="content-embed-block rounded-2xl border border-slate-700/80 bg-slate-950/35 p-4"
          data-embed-kind={block.kind}
          aria-label={block.kind === "html_embed" ? "HTML Embed" : "Custom Code"}
        >
          {block.kind === "html_embed" ? (
            <div
              className="content-embed-html-embed [&_iframe]:min-h-[200px] [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:rounded-xl [&_iframe]:border [&_iframe]:border-slate-600"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          ) : (
            <div
              className="content-embed-custom-code rte-content space-y-3 text-sm leading-7 [&_a]:text-emerald-400 [&_h2]:text-xl [&_h3]:text-lg [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_td]:border [&_td]:border-slate-600 [&_td]:p-2 [&_th]:border [&_th]:border-slate-600 [&_th]:p-2 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          )}
        </section>
      ))}
    </div>
  );
}
