"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/cn";

const ACCENT = "var(--color-accent)";
const GRID = "#2a2c2e";
const AXIS = "#8e8f90";

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-hairline bg-graphite px-3 py-2 text-xs shadow-lg">
      <div className="text-mist">{label}</div>
      <div className="font-display text-lg font-bold text-chalk">
        {payload[0].value.toLocaleString()} <span className="text-xs text-mist">{unit}</span>
      </div>
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ v: T; l: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-line bg-matte p-[3px]">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("press h-9 flex-1 truncate rounded-[9px] px-2.5 text-[13px] font-bold", value === o.v ? "bg-chalk text-matte" : "text-mist")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export type StrengthSeries = { movementId: string; name: string; points: Array<{ date: string; label: string; e1rm: number }> };

/** Estimated 1RM over time, one movement at a time. */
export function StrengthChart({ series }: { series: StrengthSeries[] }) {
  const [id, setId] = useState(series[0]?.movementId);
  const current = series.find((s) => s.movementId === id) ?? series[0];
  if (!current) return null;
  const first = current.points[0]?.e1rm ?? 0;
  const last = current.points[current.points.length - 1]?.e1rm ?? 0;
  const delta = Math.round((last - first) * 10) / 10;

  return (
    <div className="flex flex-col gap-3.5">
      {series.length > 1 ? (
        <Toggle label="Movement" value={current.movementId} onChange={setId} options={series.slice(0, 4).map((s) => ({ v: s.movementId, l: s.name }))} />
      ) : null}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-eyebrow text-ash">{current.name} · est. 1RM</div>
          <div className="font-display text-[44px] font-extrabold leading-none">
            {last}
            <span className="text-xl text-ash"> lb</span>
          </div>
        </div>
        {current.points.length > 1 ? (
          <span className="flex h-7 items-center rounded-full bg-accent/14 px-2.5 text-xs font-bold text-accent">
            {delta >= 0 ? "+" : "−"}
            {Math.abs(delta)} lb since {current.points[0].label}
          </span>
        ) : null}
      </div>
      {current.points.length > 1 ? (
        <div className="h-[170px]" role="img" aria-label={`${current.name} estimated one-rep max: ${current.points.map((p) => `${p.label} ${p.e1rm} lb`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={current.points} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} allowDecimals={false} width={48} />
              <Tooltip content={<ChartTooltip unit="lb" />} cursor={{ stroke: "#4a4c4e" }} />
              <Line type="monotone" dataKey="e1rm" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: "#171819", stroke: ACCENT, strokeWidth: 2 }} activeDot={{ r: 6, fill: ACCENT, stroke: "#171819", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="m-0 text-sm text-mist">Log {current.name.toLowerCase()} again to start a trend line.</p>
      )}
      <p className="m-0 text-xs text-ash">Estimated from your best set each day (Epley formula, sets of 10 reps or fewer).</p>
    </div>
  );
}

type Bucket = { key: string; label: string; days: number; classes: number };

/** Training days per week or month. */
export function ActivityChart({ weekly, monthly }: { weekly: Bucket[]; monthly: Bucket[] }) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const data = mode === "week" ? weekly : monthly;
  const total = data.reduce((s, d) => s + d.days, 0);
  const avg = data.length ? Math.round((total / data.length) * 10) / 10 : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-eyebrow text-ash">
          Training days · avg {avg} / {mode}
        </div>
        <div className="w-44 flex-none">
          <Toggle label="Period" value={mode} onChange={setMode} options={[{ v: "week", l: "Week" }, { v: "month", l: "Month" }]} />
        </div>
      </div>
      <div className="h-[130px]" role="img" aria-label={`Training days per ${mode}: ${data.map((d) => `${d.label} ${d.days}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -14 }} barCategoryGap={4}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
            <Tooltip content={<ChartTooltip unit="days" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="days" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Weekly strength volume. */
export function VolumeChart({ data }: { data: Array<{ key: string; label: string; volume: number }> }) {
  const total = data.reduce((s, d) => s + d.volume, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-eyebrow text-ash">
        Strength volume · {total.toLocaleString()} lb over {data.length} weeks
      </div>
      <div className="h-[120px]" role="img" aria-label={`Weekly strength volume: ${data.map((d) => `${d.label} ${d.volume} lb`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={4}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
            <Tooltip content={<ChartTooltip unit="lb" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="volume" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
