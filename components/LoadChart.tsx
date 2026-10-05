"use client";

import type { SimulationResult } from "@/lib/simulation";

type Props = { result: SimulationResult };

type Series = { values: number[]; stroke: string; dash?: string; label: string };

export function LoadChart({ result }: Props) {
  const width = 920;
  const height = 390;
  const pad = { left: 58, right: 18, top: 34, bottom: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxValue = Math.max(10, Math.ceil(Math.max(...result.totalUnmanaged, ...result.totalManaged, ...result.contracted) / 10) * 10);
  const x = (i: number) => pad.left + (i / 23) * plotW;
  const y = (v: number) => pad.top + plotH - (v / maxValue) * plotH;
  const points = (values: number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  const series: Series[] = [
    { values: result.base, stroke: "#42a5ff", label: "Carga base" },
    { values: result.totalUnmanaged, stroke: "#ff923d", label: "Sem gerenciamento" },
    { values: result.totalManaged, stroke: "#27f2c1", label: "Com gerenciamento" },
    { values: result.contracted, stroke: "#ff4f64", dash: "9 7", label: "Demanda contratada" }
  ];

  const yTicks = Array.from({ length: 6 }, (_, i) => (maxValue / 5) * i);
  const xTicks = [0, 4, 8, 12, 16, 20, 23];

  return (
    <div className="chartWrap">
      <div className="legend">
        {series.map((s) => (
          <span key={s.label}><i style={{ background: s.stroke }} />{s.label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Curva de carga diária">
        <rect x="0" y="0" width={width} height={height} rx="20" fill="transparent" />
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="rgba(111,160,190,.17)" />
            <text x={pad.left - 12} y={y(tick) + 4} fill="#91a9ba" fontSize="13" textAnchor="end">{Math.round(tick)}</text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={x(tick)} x2={x(tick)} y1={pad.top} y2={height - pad.bottom} stroke="rgba(111,160,190,.10)" />
            <text x={x(tick)} y={height - 15} fill="#91a9ba" fontSize="13" textAnchor="middle">{tick === 23 ? "23h" : `${tick}h`}</text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.label}
            points={points(s.values)}
            fill="none"
            stroke={s.stroke}
            strokeWidth="4"
            strokeDasharray={s.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <circle cx={x(result.criticalHour)} cy={y(result.unmanagedPeak)} r="6" fill="#ff923d" stroke="#fff" strokeWidth="2" />
        <text x="16" y={height / 2} fill="#b9cfdd" fontSize="13" transform={`rotate(-90 16 ${height / 2})`} textAnchor="middle">Demanda (kW)</text>
        <text x={pad.left + plotW / 2} y={height - 2} fill="#b9cfdd" fontSize="13" textAnchor="middle">Hora do dia</text>
      </svg>
    </div>
  );
}
