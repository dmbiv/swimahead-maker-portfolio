"use client";

import Link from "./app-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import type { Topology } from "topojson-specification";
import type { PublicProgramMapItem } from "@/lib/public-programs";
import { programCardId } from "@/lib/explore-navigation";
import nationTopo from "@/lib/geo/us-nation.json";
import { STATE_BORDERS, STATE_LABELS } from "@/lib/geo/states";

const VIEW_W = 960;
const VIEW_H = 600;
const MIN_VIEW_W = 15;

const nation = feature(
  nationTopo as unknown as Topology,
  (nationTopo as unknown as Topology).objects.nation,
) as unknown as FeatureCollection;
const projection = geoAlbersUsa().fitSize([VIEW_W, VIEW_H], nation);
const US_PATH = geoPath(projection)(nation) ?? "";

type Campus = {
  institutionId: string;
  institutionName: string;
  city: string | null;
  stateCode: string | null;
  division: string | null;
  conferences: string[];
  netPrice: number | null;
  programs: Array<{ id: string; squad: PublicProgramMapItem["squad"]; listHref: string }>;
  squads: PublicProgramMapItem["squad"][];
  x: string;
  y: string;
};

const priceFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function squadLabel(s: PublicProgramMapItem["squad"]): string {
  return s === "men" ? "Men's" : s === "women" ? "Women's" : "Coed";
}

const EMPTY_LIST_HREFS: Record<string, string> = {};

export function CampusMap({ programs, programListHrefs = EMPTY_LIST_HREFS }: {
  programs: PublicProgramMapItem[];
  programListHrefs?: Record<string, string>;
}) {
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  const [isDragging, setIsDragging] = useState(false);
  const viewRef = useRef(view);
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const campuses = useMemo<Campus[]>(() => {
    const map = new Map<string, Campus>();
    for (const p of programs) {
      if (p.latitude === null || p.longitude === null) continue;
      const existing = map.get(p.institutionId);
      if (existing) {
        if (!existing.squads.includes(p.squad)) existing.squads.push(p.squad);
        if (p.conferenceName && !existing.conferences.includes(p.conferenceName)) existing.conferences.push(p.conferenceName);
        if (!existing.programs.some((program) => program.id === p.id)) {
          existing.programs.push({ id: p.id, squad: p.squad, listHref: programListHrefs[p.id] ?? `#${programCardId(p.id)}` });
        }
        continue;
      }
      const xy = projection([p.longitude, p.latitude]);
      if (!xy) continue;
      map.set(p.institutionId, {
        institutionId: p.institutionId,
        institutionName: p.institutionName,
        city: p.city,
        stateCode: p.stateCode,
        division: p.division,
        conferences: p.conferenceName ? [p.conferenceName] : [],
        netPrice: p.averageNetPrice,
        programs: [{ id: p.id, squad: p.squad, listHref: programListHrefs[p.id] ?? `#${programCardId(p.id)}` }],
        squads: [p.squad],
        x: xy[0].toFixed(3),
        y: xy[1].toFixed(3),
      });
    }
    return [...map.values()];
  }, [programListHrefs, programs]);

  const selected = selectedInstitutionId
    ? campuses.find((campus) => campus.institutionId === selectedInstitutionId) ?? null
    : null;

  const zoomScale = view.w / VIEW_W;
  const dotR = 5.4 * zoomScale;
  const hitR = 18 * zoomScale;

  const zoom = (factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const nw = Math.min(VIEW_W, Math.max(MIN_VIEW_W, v.w * factor));
      const nh = nw * (VIEW_H / VIEW_W);
      const focusX = cx ?? v.x + v.w / 2;
      const focusY = cy ?? v.y + v.h / 2;
      let nx = focusX - (focusX - v.x) * (nw / v.w);
      let ny = focusY - (focusY - v.y) * (nh / v.h);
      nx = Math.max(0, Math.min(VIEW_W - nw, nx));
      ny = Math.max(0, Math.min(VIEW_H - nh, ny));
      return { x: nx, y: ny, w: nw, h: nh };
    });
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = svg.getBoundingClientRect();
      const px = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
      const py = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
      const factor = e.deltaY < 0 ? 0.92 : 1 / 0.92;
      zoom(factor, px, py);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="usmap">
      <div className="usmap-controls">
        <button type="button" onClick={() => zoom(0.7)} aria-label="Zoom in" className="usmap-btn">＋</button>
        <button type="button" onClick={() => zoom(1 / 0.7)} aria-label="Zoom out" className="usmap-btn">－</button>
        <button type="button" onClick={() => setView({ x: 0, y: 0, w: VIEW_W, h: VIEW_H })} aria-label="Reset" className="usmap-btn">⊡</button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="usmap-svg"
        role="group"
        aria-label={`${campuses.length} campuses on a US map`}
        onClick={() => setSelectedInstitutionId(null)}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
          setIsDragging(true);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const rect = svgRef.current!.getBoundingClientRect();
          const dx = ((e.clientX - drag.current.px) / rect.width) * view.w;
          const dy = ((e.clientY - drag.current.py) / rect.height) * view.h;
          setView((v) => ({
            ...v,
            x: Math.max(0, Math.min(VIEW_W - v.w, drag.current!.vx - dx)),
            y: Math.max(0, Math.min(VIEW_H - v.h, drag.current!.vy - dy)),
          }));
        }}
        onPointerUp={() => { drag.current = null; setIsDragging(false); }}
        onPointerCancel={() => { drag.current = null; setIsDragging(false); }}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <path className="usmap-land" d={US_PATH} style={{ strokeWidth: 1.2 * zoomScale }} />
        <path className="usmap-borders" d={STATE_BORDERS} style={{ strokeWidth: 0.6 * zoomScale }} />
        {STATE_LABELS.map((s) => (
          <text
            key={s.a}
            className="usmap-state-label"
            x={s.x}
            y={s.y}
            fontSize={(view.w / VIEW_W) * 11}
          >
            {s.a}
          </text>
        ))}
        {campuses.map((c) => (
          <g
            key={c.institutionId}
            className="usmap-pin"
            onClick={(e) => { e.stopPropagation(); setSelectedInstitutionId(c.institutionId); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedInstitutionId(c.institutionId); }
            }}
            role="button"
            tabIndex={0}
            aria-label={`${c.institutionName}, ${[c.city, c.stateCode].filter(Boolean).join(", ")}`}
          >
            <circle className="usmap-hit" cx={c.x} cy={c.y} r={hitR} />
            <circle
              className={`usmap-dot ${selected?.institutionId === c.institutionId ? "usmap-dot--on" : ""}`}
              cx={c.x}
              cy={c.y}
              r={c.squads.length > 1 ? dotR + zoomScale : dotR}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>

      {selected && (
        <div className="usmap-panel">
          <button type="button" className="usmap-panel-close" onClick={() => setSelectedInstitutionId(null)} aria-label="Close">×</button>
          <div className="usmap-panel-name">{selected.institutionName}</div>
          <div className="usmap-panel-meta">
            {[[selected.city, selected.stateCode].filter(Boolean).join(", "), selected.division, selected.squads.map(squadLabel).join(" / ") + " swimming"]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="usmap-panel-meta">Conference: {selected.conferences.length ? selected.conferences.join(" / ") : "Not reported"}</div>
          {selected.netPrice !== null && <div className="usmap-panel-meta">Net price {priceFmt.format(selected.netPrice)}/yr</div>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.programs.map((program) => (
              <Link
                key={program.id}
                href={program.listHref}
                className="wr-btn wr-btn--neutral wr-btn--small"
                onClick={() => {
                  const el = document.getElementById(programCardId(program.id));
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.classList.add("program-flash");
                    setTimeout(() => el.classList.remove("program-flash"), 1200);
                  }
                }}
              >
                {selected.programs.length === 1 ? "View in list" : `View ${squadLabel(program.squad).toLowerCase()} in list`}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
