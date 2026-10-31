import "server-only";
import sanitizeHtml from "sanitize-html";
import { emailBodyToHtml, type EmailBodyFormat } from "./email-content";

const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;

export function sanitizeEmailHtml(body: string, format?: EmailBodyFormat): string {
  return sanitizeHtml(emailBodyToHtml(body, format), {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li",
      "h1", "h2", "h3", "blockquote", "a", "hr", "span", "div", "table",
      "thead", "tbody", "tfoot", "tr", "th", "td", "img",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      table: ["width", "cellpadding", "cellspacing", "border", "style"],
      th: ["colspan", "rowspan", "style"],
      td: ["colspan", "rowspan", "style"],
      p: ["style"],
      div: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      span: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedStyles: {
      "*": {
        color: [COLOR],
        "background-color": [COLOR],
        "text-align": [/^(?:left|center|right)$/],
      },
      table: {
        width: [/^(?:\d{1,4}px|\d{1,3}%)$/],
        "border-collapse": [/^collapse$/],
      },
      td: {
        width: [/^(?:\d{1,4}px|\d{1,3}%)$/],
        padding: [/^[\d\s.px]+$/],
      },
      th: {
        width: [/^(?:\d{1,4}px|\d{1,3}%)$/],
        padding: [/^[\d\s.px]+$/],
      },
    },
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
    disallowedTagsMode: "discard",
  });
}
