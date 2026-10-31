export type EmailBodyFormat = "text" | "html";

const HTML_BLOCK = /<(?:p|div|br|h[1-6]|ul|ol|li|blockquote|table|img|strong|em|span|a)\b/i;

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function detectEmailBodyFormat(body: string, format?: EmailBodyFormat): EmailBodyFormat {
  if (format) return format;
  return HTML_BLOCK.test(body) ? "html" : "text";
}

export function plainTextToEmailHtml(body: string): string {
  const clean = body.replace(/\r\n?/g, "\n").trim();
  if (!clean) return "<p></p>";
  return clean
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeEmailHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function emailBodyToHtml(body: string, format?: EmailBodyFormat): string {
  return detectEmailBodyFormat(body, format) === "html" ? body : plainTextToEmailHtml(body);
}

const MERGE_TOKEN = /\{\{\s*([a-z_]+)\s*\}\}|\{\s*([a-z_]+)\s*\}/g;

function renderMergeTokens(
  input: string,
  values: Record<string, string>,
  transform: (value: string) => string,
): string {
  return input.replace(MERGE_TOKEN, (match, doubled: string | undefined, single: string | undefined) => {
    const key = doubled ?? single;
    return key && key in values ? transform(values[key]) : match;
  });
}

export function renderEmailHtml(html: string, values: Record<string, string>): string {
  return renderMergeTokens(html, values, escapeEmailHtml);
}

export function renderEmailText(text: string, values: Record<string, string>): string {
  return renderMergeTokens(text, values, (value) => value);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function emailHtmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(p|div|h[1-6]|blockquote|tr|table)\s*>/gi, "\n\n")
      .replace(/<\s*li\b[^>]*>/gi, "• ")
      .replace(/<\s*\/\s*li\s*>/gi, "\n")
      .replace(/<\s*hr\b[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}
