"use client";

import { toCSV } from "@/lib/csv";

export type CSVCell = string | number | null | undefined;

export function CsvDownload({
  rows,
  filename,
  label = "Export CSV",
  title = "Download these records as a CSV file",
}: {
  rows: CSVCell[][];
  filename: string;
  label?: string;
  title?: string;
}) {
  const download = () => {
    const safeName = filename
      .replace(/\.csv$/i, "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "export";
    const csv = `\uFEFF${toCSV(rows).replace(/\r?\n/g, "\r\n")}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <button
      type="button"
      onClick={download}
      className="wr-btn wr-btn--neutral wr-btn--small"
      title={title}
      aria-label={title}
    >
      {label}
    </button>
  );
}
