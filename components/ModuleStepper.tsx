const modules = [
  { id: "curve", label: "Curva medida", short: "01" },
  { id: "ev", label: "Simulação EV", short: "02" },
  { id: "electrical", label: "Dimensionamento", short: "03" },
  { id: "report", label: "Relatório PDF", short: "04" }
] as const;

export type ModuleId = (typeof modules)[number]["id"];

export function ModuleStepper({ active, onChange, completed }: {
  active: ModuleId;
  onChange: (id: ModuleId) => void;
  completed: Record<ModuleId, boolean>;
}) {
  return (
    <div className="stepper" aria-label="Módulos da ferramenta">
      {modules.map((m, index) => (
        <button
          type="button"
          key={m.id}
          className={`${active === m.id ? "active" : ""} ${completed[m.id] ? "done" : ""}`}
          onClick={() => onChange(m.id)}
        >
          <span className="stepNo">{completed[m.id] ? "✓" : m.short}</span>
          <span><b>{m.label}</b><small>{index === 0 ? "Medição e perfil" : index === 1 ? "Demanda e load balancing" : index === 2 ? "Cabos e proteções" : "Memória técnica"}</small></span>
        </button>
      ))}
    </div>
  );
}
