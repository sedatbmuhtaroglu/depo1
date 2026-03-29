import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { sanitizeRichHtmlClient } from "@/lib/sanitize-rich-html-client";
import { hasDisallowedRichHtmlTags, stripScriptsStylesComments } from "@/lib/sanitize-rich-html-walk";

const PASTE_MAX = 40_000;

/**
 * When clipboard HTML contains tags outside the rich-text allowlist, insert sanitized HTML
 * (disallowed subtrees become visible <pre><code class="rte-preserved-block">...</code></pre>).
 * Scripts/styles are stripped; nothing executes in the editor.
 */
export const PastePreserveExtension = Extension.create({
  name: "pastePreserve",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("pastePreserve"),
        props: {
          handlePaste(_view, event) {
            const html = event.clipboardData?.getData("text/html");
            if (!html || !hasDisallowedRichHtmlTags(html)) {
              return false;
            }

            event.preventDefault();
            const stripped = stripScriptsStylesComments(html);
            const sanitized = sanitizeRichHtmlClient(stripped, PASTE_MAX);
            editor.chain().focus().insertContent(sanitized).run();
            return true;
          },
        },
      }),
    ];
  },
});
