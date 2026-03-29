import { Mark, mergeAttributes, Node } from "@tiptap/core";

function sharedBlockAttrs() {
  return {
    style: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.getAttribute("style"),
      renderHTML: (attrs: Record<string, unknown>) => {
        const s = attrs.style as string | null | undefined;
        return s ? { style: s } : {};
      },
    },
    class: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.getAttribute("class"),
      renderHTML: (attrs: Record<string, unknown>) => {
        const c = attrs.class as string | null | undefined;
        return c ? { class: c } : {};
      },
    },
  };
}

/** Matches sanitized HTML from `sanitize-source-html-*` for editor parse/render. */
export const RteDiv = Node.create({
  name: "rteDiv",
  group: "block",
  content: "block+",
  parseHTML() {
    return [{ tag: "div" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "rte-user-div" }), 0];
  },
  addAttributes() {
    return sharedBlockAttrs();
  },
});

export const RteSection = Node.create({
  name: "rteSection",
  group: "block",
  content: "block+",
  parseHTML() {
    return [{ tag: "section" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { class: "rte-user-section" }), 0];
  },
  addAttributes() {
    return sharedBlockAttrs();
  },
});

export const RteArticle = Node.create({
  name: "rteArticle",
  group: "block",
  content: "block+",
  parseHTML() {
    return [{ tag: "article" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["article", mergeAttributes(HTMLAttributes, { class: "rte-user-article" }), 0];
  },
  addAttributes() {
    return sharedBlockAttrs();
  },
});

export const RteForm = Node.create({
  name: "rteForm",
  group: "block",
  content: "block+",
  parseHTML() {
    return [{ tag: "form" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["form", mergeAttributes(HTMLAttributes, { class: "rte-user-form" }), 0];
  },
  addAttributes() {
    return {
      ...sharedBlockAttrs(),
      method: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("method"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const m = attrs.method as string | null | undefined;
          return m ? { method: m } : {};
        },
      },
      autocomplete: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("autocomplete"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const a = attrs.autocomplete as string | null | undefined;
          return a ? { autocomplete: a } : {};
        },
      },
    };
  },
});

export const RteLabel = Node.create({
  name: "rteLabel",
  group: "block",
  content: "inline*",
  parseHTML() {
    return [{ tag: "label" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["label", mergeAttributes(HTMLAttributes, { class: "rte-user-label" }), 0];
  },
  addAttributes() {
    return {
      ...sharedBlockAttrs(),
      htmlFor: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("for"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const f = attrs.htmlFor as string | null | undefined;
          return f ? { for: f } : {};
        },
      },
    };
  },
});

export const RteInput = Node.create({
  name: "rteInput",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  parseHTML() {
    return [
      {
        tag: "input",
        getAttrs: (el: HTMLElement) => ({
          type: el.getAttribute("type") ?? "text",
          name: el.getAttribute("name"),
          value: el.getAttribute("value"),
          placeholder: el.getAttribute("placeholder"),
          disabled: el.hasAttribute("disabled"),
          readOnly: el.hasAttribute("readonly"),
          checked: el.hasAttribute("checked"),
          style: el.getAttribute("style"),
          class: el.getAttribute("class"),
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["input", mergeAttributes(HTMLAttributes, { class: "rte-user-input" })];
  },
  addAttributes() {
    return {
      type: {
        default: "text",
        parseHTML: (element: HTMLElement) => element.getAttribute("type") ?? "text",
      },
      name: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("name"),
      },
      value: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("value"),
      },
      placeholder: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("placeholder"),
      },
      disabled: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute("disabled"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.disabled ? { disabled: "disabled" } : {},
      },
      readOnly: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute("readonly"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.readOnly ? { readonly: "readonly" } : {},
      },
      checked: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute("checked"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.checked ? { checked: "checked" } : {},
      },
      style: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("style"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const s = attrs.style as string | null | undefined;
          return s ? { style: s } : {};
        },
      },
      class: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("class"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const c = attrs.class as string | null | undefined;
          return c ? { class: c } : {};
        },
      },
    };
  },
});

export const RteButton = Node.create({
  name: "rteButton",
  group: "block",
  content: "inline*",
  parseHTML() {
    return [{ tag: "button" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["button", mergeAttributes({ class: "rte-user-button" }, HTMLAttributes), 0];
  },
  addAttributes() {
    return {
      ...sharedBlockAttrs(),
      type: {
        default: "button",
        parseHTML: (element: HTMLElement) => element.getAttribute("type") ?? "button",
      },
      name: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("name"),
      },
      disabled: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute("disabled"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.disabled ? { disabled: "disabled" } : {},
      },
    };
  },
});

export const RteImage = Node.create({
  name: "rteImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  parseHTML() {
    return [
      {
        tag: "img",
        getAttrs: (el: HTMLElement) => ({
          src: el.getAttribute("src"),
          alt: el.getAttribute("alt") ?? "",
          width: el.getAttribute("width"),
          height: el.getAttribute("height"),
          loading: el.getAttribute("loading"),
          style: el.getAttribute("style"),
          class: el.getAttribute("class"),
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { class: "rte-user-img" })];
  },
  addAttributes() {
    return {
      src: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("src"),
      },
      alt: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("alt") ?? "",
      },
      width: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("width"),
      },
      height: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("height"),
      },
      loading: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("loading"),
      },
      style: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("style"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const s = attrs.style as string | null | undefined;
          return s ? { style: s } : {};
        },
      },
      class: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("class"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const c = attrs.class as string | null | undefined;
          return c ? { class: c } : {};
        },
      },
    };
  },
});

export const RteSpanMark = Mark.create({
  name: "rteSpan",
  parseHTML() {
    return [{ tag: "span" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "rte-user-span" }), 0];
  },
  addAttributes() {
    return {
      style: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("style"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const s = attrs.style as string | null | undefined;
          return s ? { style: s } : {};
        },
      },
      class: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("class"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const c = attrs.class as string | null | undefined;
          return c ? { class: c } : {};
        },
      },
    };
  },
});

export const rteSourceHtmlExtensions = [
  RteDiv,
  RteSection,
  RteArticle,
  RteForm,
  RteLabel,
  RteInput,
  RteButton,
  RteImage,
  RteSpanMark,
];
