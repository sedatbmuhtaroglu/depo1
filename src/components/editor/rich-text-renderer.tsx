/**
 * RichTextRenderer – displays sanitised HTML content in a
 * styled, non-editable container using the editor's prose styles.
 *
 * This is a server component-safe renderer (no "use client").
 * It reuses the same `.rte-content` CSS class for visual consistency
 * with the edit view.
 */

interface RichTextRendererProps {
  /** Sanitised HTML to render */
  html: string;
  /** Optional CSS class */
  className?: string;
  /** Min height */
  minHeight?: string;
}

export function RichTextRenderer({
  html,
  className,
  minHeight,
}: RichTextRendererProps) {
  if (!html) return null;
  return (
    <div
      className={`rte-content rte-content--readonly ${className ?? ""}`}
      style={minHeight ? { minHeight } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
