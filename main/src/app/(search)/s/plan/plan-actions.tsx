"use client";

interface CalendarItem { date: string; title: string; detail: string }

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function PlanActions({ items, gradYear }: { items: CalendarItem[]; gradYear: number }) {
  const download = () => {
    const events = items.map((item) => [
      "BEGIN:VEVENT",
      `UID:${item.date}-${gradYear}@swimahead`,
      `DTSTART;VALUE=DATE:${item.date.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${nextDate(item.date).replaceAll("-", "")}`,
      `SUMMARY:${icsEscape(item.title)}`,
      `DESCRIPTION:${icsEscape(`${item.detail} Verify the current rule and program policy before relying on this date.`)}`,
      "END:VEVENT",
    ].join("\r\n")).join("\r\n");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SwimAhead//Recruiting dates//EN", "CALSCALE:GREGORIAN", events, "END:VCALENDAR", ""].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `class-of-${gradYear}-recruiting-dates.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={download}>Add dates to calendar</button>
      <button type="button" className="wr-btn wr-btn--ghost wr-btn--small" onClick={() => window.print()}>Print timeline</button>
    </div>
  );
}
