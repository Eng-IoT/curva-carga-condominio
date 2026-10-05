"use client";

import { useMemo, useState } from "react";
import type { EvSimulationResult } from "@/lib/types";

type SeriesKey = "base" | "unmanaged" | "managed" | "limit";

type SeriesDef = {
  key: SeriesKey;
  label: string;
  color: string;
  dashed?: boolean;
};

const SERIES: SeriesDef[] = [
  { key: "base", label: "Carga base", color: "#38a8ff" },
  { key: "unmanaged", label: "Total sem gerenciamento", color: "#ff9a46" },
  { key: "managed", label: "Total com gerenciamento", color: "#30efbd" },
  { key: "limit", label: "Limite de demanda", color: "#ff566b", dashed: true }
];

function dataFor(result: EvSimulationResult, key: SeriesKey) {
  if (key === "base") return result.baseKw;
  if (key === "unmanaged") return result.totalUnmanagedKw;
  if (key === "managed") return result.totalManagedKw;
  return result.demandLimitKw;
}

export function LoadChart({ result, compact = false }: { result: EvSimulationResult; compact?: boolean }) {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({ base: true, unmanaged: true, managed: true, limit: true });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = compact ? 760 : 1000;
  const height = compact ? 310 : 420;
  const pad = compact ? { l: 58, r: 20, t: 26, b: 42 } : { l: 64, r: 28, t: 30, b: 48 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;

  const maxY = useMemo(() => {
    const all = [
      ...result.baseKw,
      ...result.totalUnmanagedKw,
      ...result.totalManagedKw,
      ...result.demandLimitKw
    ];
    const peak = Math.max(10, ...all);
    return Math.ceil((peak * 1.12) / 10) * 10;
  }, [result]);

  const x = (i: number) => pad.l + (i / 95) * plotW;
  const y = (v: number) => pad.t + plotH - (v / maxY) * plotH;
  const poly = (values: number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const yTicks = Array.from({ length: 6 }, (_, i) => (maxY / 5) * i);
  const hIdx = hoverIndex ?? result.criticalIndex;

  return (
    <div className="chartBox">
      <div className="chartLegend">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={visible[s.key] ? "on" : "off"}
            onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
          >
            <i style={{ background: s.color }} />{s.label}
          </button>
        ))}
      </div>
      <div className="svgWrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Gráfico da curva de carga"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * width;
            const raw = Math.round(((px - pad.l) / plotW) * 95);
            setHoverIndex(Math.max(0, Math.min(95, raw)));
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="managedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30efbd" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#30efbd" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x={pad.l} y={pad.t} width={plotW} height={plotH} rx="10" fill="#05111c" />
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={pad.l} x2={pad.l + plotW} y1={y(tick)} y2={y(tick)} stroke="#173347" strokeWidth="1" />
              <text x={pad.l - 10} y={y(tick) + 4} fill="#7794a8" fontSize="12" textAnchor="end">{tick.toFixed(0)}</text>
            </g>
          ))}
          {Array.from({ length: 13 }, (_, i) => i * 2).map((hour) => {
            const idx = hour * 4;
            return (
              <g key={hour}>
                <line x1={x(idx)} x2={x(idx)} y1={pad.t} y2={pad.t + plotH} stroke="#102a3c" strokeWidth="1" />
                <text x={x(idx)} y={height - 14} fill="#7794a8" fontSize="12" textAnchor="middle">{hour}</text>
              </g>
            );
          })}
          <text x={18} y={pad.t + plotH / 2} fill="#9db2bf" fontSize="12" transform={`rotate(-90 18 ${pad.t + plotH / 2})`} textAnchor="middle">Demanda (kW)</text>
          <text x={pad.l + plotW / 2} y={height - 2} fill="#9db2bf" fontSize="12" textAnchor="middle">Hora do dia</text>

          {visible.managed ? (
            <polygon
              points={`${x(0)},${y(0)} ${poly(result.totalManagedKw)} ${x(95)},${y(0)}`}
              fill="url(#managedFill)"
            />
          ) : null}

          {SERIES.map((s) => visible[s.key] ? (
            <polyline
              key={s.key}
              points={poly(dataFor(result, s.key))}
              fill="none"
              stroke={s.color}
              strokeWidth={s.key === "limit" ? 2.5 : 3.2}
              strokeDasharray={s.dashed ? "9 7" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null)}

          <line x1={x(hIdx)} x2={x(hIdx)} y1={pad.t} y2={pad.t + plotH} stroke="#d7f8ff" strokeOpacity=".35" strokeWidth="1" />
          {SERIES.filter((s) => visible[s.key]).map((s) => {
            const v = dataFor(result, s.key)[hIdx];
            return <circle key={s.key} cx={x(hIdx)} cy={y(v)} r="4" fill={s.color} stroke="#06111d" strokeWidth="2" />;
          })}
        </svg>
        <div className="chartTooltip">
          <b>{String(Math.floor(result.quarterHours[hIdx])).padStart(2, "0")}:{String((hIdx % 4) * 15).padStart(2, "0")}</b>
          <span><i style={{ background: "#38a8ff" }} />Base <strong>{result.baseKw[hIdx].toFixed(1)} kW</strong></span>
          <span><i style={{ background: "#ff9a46" }} />Sem gestão <strong>{result.totalUnmanagedKw[hIdx].toFixed(1)} kW</strong></span>
          <span><i style={{ background: "#30efbd" }} />Com gestão <strong>{result.totalManagedKw[hIdx].toFixed(1)} kW</strong></span>
          <span><i style={{ background: "#ff566b" }} />Limite <strong>{result.demandLimitKw[hIdx].toFixed(1)} kW</strong></span>
        </div>
      </div>
    </div>
  );
}
