"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EVENTS_BY_COURSE, eventLabelForCourse } from "@/lib/events";
import { addSwimTime } from "@/lib/swimmer-actions";
import { parseClock } from "@/lib/time";
import type { Course } from "@/lib/types";

export function AddTimeForm({ today }: { today: string }) {
  const [course, setCourse] = useState<Course>("SCY");
  const [event, setEvent] = useState(EVENTS_BY_COURSE.SCY[0]);
  const [time, setTime] = useState("");
  const [date, setDate] = useState(today);
  const [meet, setMeet] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <details className="wr-card p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold">Add a time manually <span className="ml-1 font-normal text-ink-3">For results missing from USA Swimming</span></summary>
      <form className="mt-4" onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const seconds = parseClock(time);
        if (seconds === null) {
          setMessage({ tone: "error", text: "Enter a time like 52.34 or 1:52.34." });
          return;
        }
        setMessage(null);
        startTransition(async () => {
          const result = await addSwimTime({ event, course, seconds, date, meet });
          if (!result.ok) {
            setMessage({ tone: "error", text: result.error ?? "Couldn’t add that time." });
            return;
          }
          setTime("");
          setMeet("");
          setMessage({ tone: "ok", text: "Time added to your history." });
          router.refresh();
        });
      }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[0.8fr_1.25fr_1fr_1fr_1.6fr]">
          <label>
            <span className="wr-field-label block">Course</span>
            <FormControl.Select className="wr-control" value={course} onChange={(changeEvent) => {
              const next = changeEvent.target.value as Course;
              setCourse(next);
              setEvent(EVENTS_BY_COURSE[next][0]);
            }}>
              <option value="SCY">SCY</option>
              <option value="SCM">SCM</option>
              <option value="LCM">LCM</option>
            </FormControl.Select>
          </label>
          <label>
            <span className="wr-field-label block">Event</span>
            <FormControl.Select className="wr-control" value={event} onChange={(changeEvent) => setEvent(changeEvent.target.value)}>
              {EVENTS_BY_COURSE[course].map((value) => {
                return <option key={value} value={value}>{eventLabelForCourse(value, course)}</option>;
              })}
            </FormControl.Select>
          </label>
          <label>
            <span className="wr-field-label block">Time</span>
            <FormControl.Input className="wr-control font-data" inputMode="decimal" value={time} onChange={(changeEvent) => setTime(changeEvent.target.value)} placeholder="1:52.34" required aria-describedby="manual-time-help" />
          </label>
          <label>
            <span className="wr-field-label block">Date</span>
            <FormControl.Input className="wr-control" type="date" max={today} value={date} onChange={(changeEvent) => setDate(changeEvent.target.value)} required />
          </label>
          <label className="sm:col-span-2 lg:col-span-1">
            <span className="wr-field-label block">Meet (optional)</span>
            <FormControl.Input className="wr-control" value={meet} onChange={(changeEvent) => setMeet(changeEvent.target.value)} maxLength={180} placeholder="Meet name" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div id="manual-time-help" aria-live="polite" className={`text-xs ${message?.tone === "error" ? "text-bad" : "text-ink-3"}`}>
            {message?.text ?? "Use minutes:seconds.hundredths. Manual results are labeled in your export."}
          </div>
          <button type="submit" className="wr-btn wr-btn--primary" disabled={pending || !time.trim() || !date}>{pending ? "Adding…" : "Add time"}</button>
        </div>
      </form>
    </details>
  );
}
