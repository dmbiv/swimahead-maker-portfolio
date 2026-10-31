
export function parseDelimited(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const s = text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(cur); cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const head = text.slice(0, 2000);
  const tabs = (head.match(/\t/g) || []).length;
  const commas = (head.match(/,/g) || []).length;
  const semis = (head.match(/;/g) || []).length;
  if (tabs >= commas && tabs >= semis) return tabs > 0 ? "\t" : ",";
  return semis > commas ? ";" : ",";
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const raw = cell == null ? "" : String(cell);
          const s = typeof cell === "string" && (/^[\t\r\n]/.test(raw) || /^\s*[=+\-@]/.test(raw))
            ? `'${raw}`
            : raw;
          return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

export function guessColumn(header: string): string | null {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const table: [RegExp, string][] = [
    [/^(first|fname|firstname|given)/, "firstName"],
    [/^(last|lname|lastname|surname|family)/, "lastName"],
    [/^(name|swimmer|athlete|fullname)$/, "fullName"],
    [/(grad|class|year|hsgrad)/, "gradYear"],
    [/(email|mail)/, "email"],
    [/(phone|cell|mobile)/, "phone"],
    [/^(club|team)/, "club"],
    [/(state|st)$/, "state"],
    [/(gpa)/, "gpa"],
    [/(sat)/, "sat"],
    [/(act)/, "act"],
    [/(gender|sex|mf)/, "gender"],
    [/(event|stroke)/, "event"],
    [/(time|best|seed)/, "time"],
    [/(course|pool|scy|scm|lcm)/, "course"],
    [/(notes?|comments?)/, "notes"],
  ];
  for (const [re, field] of table) if (re.test(h)) return field;
  return null;
}
