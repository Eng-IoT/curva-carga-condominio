import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "green"
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  accent?: "green" | "blue" | "orange" | "purple" | "red";
}) {
  return (
    <article className={`kpi accent-${accent}`}>
      <div className="kpiIcon">{icon}</div>
      <div>
        <span className="kpiLabel">{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </article>
  );
}
