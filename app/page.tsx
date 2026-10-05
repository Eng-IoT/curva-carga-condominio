"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { LoadChart } from "@/components/LoadChart";
import { parseCsvProfile, parseProfileText, simulate, type SimulationInputs } from "@/lib/simulation";

const DEFAULT_INPUTS: SimulationInputs = {
  apartments: 120,
  commonPeakKw: 10,
  diversifiedUnitKw: 0.35,
  contractedDemandKw: 60,
  chargerPowerKw: 7.4,
  chargerCount: 12,
  simultaneity: 0.25,
  reserveMargin: 0.05,
  peakStart: 17,
  peakEnd: 21,
  loadBalancing: true,
  offPeakScheduling: true,
  manualBaseProfile: null
};

function Icon({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [inputs, setInputs] = useState<SimulationInputs>(DEFAULT_INPUTS);
  const [profileText, setProfileText] = useState("");
  const [profileMessage, setProfileMessage] = useState("Perfil estimado ativo");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("condo-load-curve-inputs");
      if (saved) setInputs({ ...DEFAULT_INPUTS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("condo-load-curve-inputs", JSON.stringify(inputs)); } catch {}
  }, [inputs]);

  const result = useMemo(() => simulate(inputs), [inputs]);

  type NumericKey = Exclude<keyof SimulationInputs, "loadBalancing" | "offPeakScheduling" | "manualBaseProfile">;

  const setNumber = (key: NumericKey, value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setInputs((s) => ({ ...s, [key]: parsed }));
  };

  const applyManualProfile = () => {
    const parsed = parseProfileText(profileText);
    if (!parsed) {
      setProfileMessage("Informe exatamente 24 valores de demanda (0h a 23h).");
      return;
    }
    setInputs((s) => ({ ...s, manualBaseProfile: parsed }));
    setProfileMessage("Perfil manual aplicado com 24 pontos.");
  };

  const useEstimatedProfile = () => {
    setInputs((s) => ({ ...s, manualBaseProfile: null }));
    setProfileText("");
    setProfileMessage("Perfil estimado ativo");
  };

  const handleCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsvProfile(text);
    if (!parsed) {
      setProfileMessage("CSV inválido. Use 24 valores ou colunas hora;demanda.");
      return;
    }
    setInputs((s) => ({ ...s, manualBaseProfile: parsed }));
    setProfileText(parsed.join("; "));
    setProfileMessage(`CSV carregado: ${file.name}`);
  };

  const exportCsv = () => {
    const rows = [
      ["hora", "carga_base_kw", "ev_sem_gerenciamento_kw", "total_sem_gerenciamento_kw", "ev_com_gerenciamento_kw", "total_com_gerenciamento_kw", "demanda_contratada_kw"],
      ...result.hours.map((h) => [h, result.base[h], result.evUnmanaged[h], result.totalUnmanaged[h], result.evManaged[h], result.totalManaged[h], result.contracted[h]])
    ];
    const blob = new Blob([rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "curva-carga-condominio.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setInputs(DEFAULT_INPUTS);
    setProfileText("");
    setProfileMessage("Perfil estimado ativo");
  };

  const statusClass = result.withinLimit ? "ok" : "risk";
  const demandUsage = inputs.contractedDemandKw > 0 ? Math.round((result.managedPeak / inputs.contractedDemandKw) * 100) : 0;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandIcon">▥</div>
          <div><strong>Curva de Carga</strong><span>para Condomínios</span></div>
        </div>
        <nav>
          <a className="active" href="#dashboard">▦ <span>Dashboard</span></a>
          <a href="#dados">▥ <span>Dados do condomínio</span></a>
          <a href="#curva">⌁ <span>Curva de carga</span></a>
          <a href="#carregadores">⚡ <span>Carregadores</span></a>
          <a href="#simulacao">☷ <span>Simulação</span></a>
          <a href="#relatorio">▤ <span>Relatório</span></a>
        </nav>
        <div className="sidebarNote"><b>Importante</b><p>O perfil estimado é uma ferramenta de estudo. Para projeto executivo, use medições reais da instalação e critérios da distribuidora.</p></div>
      </aside>

      <section className="content" id="dashboard">
        <header className="hero">
          <div>
            <span className="eyebrow">ELETROMOBILIDADE • DEMANDA • LOAD BALANCING</span>
            <h1>CURVA <em>DE CARGA</em> PARA CONDOMÍNIOS</h1>
            <p>Descubra a demanda base, simule carregadores de veículos elétricos e avalie o impacto do gerenciamento inteligente.</p>
          </div>
          <div className={`statusBadge ${statusClass}`}>
            <span>{result.withinLimit ? "✓" : "!"}</span>
            <div><small>Status da demanda</small><strong>{result.withinLimit ? "Dentro do limite" : "Risco de ultrapassagem"}</strong></div>
          </div>
        </header>

        <section className="kpis">
          <KpiCard label="Demanda contratada" value={`${inputs.contractedDemandKw.toFixed(1)} kW`} hint="Limite informado" icon={<Icon>▥</Icon>} />
          <KpiCard label="Pico base" value={`${result.basePeak.toFixed(1)} kW`} hint="Antes dos carregadores" icon={<Icon>↗</Icon>} accent="blue" />
          <KpiCard label="Pico sem gerenciamento" value={`${result.unmanagedPeak.toFixed(1)} kW`} hint={`${result.unmanagedExceededHours.length} h acima do limite`} icon={<Icon>⚡</Icon>} accent="orange" />
          <KpiCard label="Pico com gerenciamento" value={`${result.managedPeak.toFixed(1)} kW`} hint={`${demandUsage}% da demanda contratada`} icon={<Icon>◎</Icon>} />
          <KpiCard label="Carregadores" value={`${inputs.chargerCount}`} hint={`${inputs.chargerPowerKw} kW por ponto`} icon={<Icon>⌁</Icon>} accent="purple" />
        </section>

        <section className="gridMain">
          <article className="panel chartPanel" id="curva">
            <div className="panelTitle"><div><span>⌁</span><div><h2>Curva de carga diária</h2><p>Comparação entre a carga base e os cenários de recarga.</p></div></div><button onClick={exportCsv} className="ghostBtn">Exportar CSV</button></div>
            <LoadChart result={result} />
            <div className="chartFooter">
              <span><b>Hora crítica:</b> {String(result.criticalHour).padStart(2, "0")}:00</span>
              <span><b>Redução de pico:</b> {result.peakReductionPercent}%</span>
              <span><b>Energia EV solicitada:</b> {result.evEnergyRequestedKwh} kWh/dia</span>
              <span><b>Energia atendida:</b> {result.evEnergyDeliveredKwh} kWh/dia</span>
            </div>
          </article>

          <aside className="panel controls" id="simulacao">
            <div className="panelTitle"><div><span>⚙</span><div><h2>Parâmetros e simulação</h2><p>Ajuste os dados e veja o resultado em tempo real.</p></div></div></div>
            <div className="formGrid">
              <label>Apartamentos<input type="number" min="0" value={inputs.apartments} onChange={(e) => setNumber("apartments", e.target.value)} /></label>
              <label>Pico áreas comuns (kW)<input type="number" min="0" step="0.1" value={inputs.commonPeakKw} onChange={(e) => setNumber("commonPeakKw", e.target.value)} /></label>
              <label>Demanda diversificada por apto (kW)<input type="number" min="0" step="0.01" value={inputs.diversifiedUnitKw} onChange={(e) => setNumber("diversifiedUnitKw", e.target.value)} /></label>
              <label>Demanda contratada (kW)<input type="number" min="0" step="1" value={inputs.contractedDemandKw} onChange={(e) => setNumber("contractedDemandKw", e.target.value)} /></label>
              <label>Potência por carregador (kW)<input type="number" min="0" step="0.1" value={inputs.chargerPowerKw} onChange={(e) => setNumber("chargerPowerKw", e.target.value)} /></label>
              <label>Quantidade de carregadores<input type="number" min="0" step="1" value={inputs.chargerCount} onChange={(e) => setNumber("chargerCount", e.target.value)} /></label>
              <label>Fator de simultaneidade<input type="number" min="0" max="1" step="0.01" value={inputs.simultaneity} onChange={(e) => setNumber("simultaneity", e.target.value)} /><small>0 a 1</small></label>
              <label>Margem de reserva<input type="number" min="0" max="0.5" step="0.01" value={inputs.reserveMargin} onChange={(e) => setNumber("reserveMargin", e.target.value)} /><small>Ex.: 0,05 = 5%</small></label>
              <label>Início da ponta<input type="number" min="0" max="23" value={inputs.peakStart} onChange={(e) => setNumber("peakStart", e.target.value)} /></label>
              <label>Fim da ponta<input type="number" min="0" max="23" value={inputs.peakEnd} onChange={(e) => setNumber("peakEnd", e.target.value)} /></label>
            </div>
            <div className="switchRow"><div><b>Load balancing</b><small>Limita a recarga conforme a capacidade disponível.</small></div><button className={inputs.loadBalancing ? "switch on" : "switch"} onClick={() => setInputs((s) => ({ ...s, loadBalancing: !s.loadBalancing }))}><i /></button></div>
            <div className="switchRow"><div><b>Recarga fora de ponta</b><small>Realoca energia para os horários de menor demanda.</small></div><button className={inputs.offPeakScheduling ? "switch on" : "switch"} onClick={() => setInputs((s) => ({ ...s, offPeakScheduling: !s.offPeakScheduling }))}><i /></button></div>
            <button className="primaryBtn" onClick={() => document.getElementById("curva")?.scrollIntoView({ behavior: "smooth" })}>Calcular / atualizar curva →</button>
            <button className="resetBtn" onClick={reset}>Restaurar valores padrão</button>
          </aside>
        </section>

        <section className="analysisGrid" id="relatorio">
          <article className="panel statCard"><span className="bigIcon">⚡</span><div><small>Pico evitado</small><strong>{Math.max(0, result.unmanagedPeak - result.managedPeak).toFixed(1)} kW</strong><p>{result.peakReductionPercent}% de redução no pico do cenário simulado.</p></div></article>
          <article className="panel statCard"><span className="bigIcon">⌚</span><div><small>Janela crítica</small><strong>{String(result.criticalHour).padStart(2, "0")}:00</strong><p>{result.unmanagedExceededHours.length ? `${result.unmanagedExceededHours.length} hora(s) acima da demanda sem gestão.` : "Sem ultrapassagem no cenário sem gestão."}</p></div></article>
          <article className="panel statCard"><span className="bigIcon">▣</span><div><small>Máximo simultâneo seguro</small><strong>{result.maxSafeSimultaneousChargers} carregadores</strong><p>Considerando a margem de reserva e o pico da carga base.</p></div></article>
          <article className="panel statCard"><span className="bigIcon">%</span><div><small>Simultaneidade segura estimada</small><strong>{Math.round(result.maxSafeSimultaneity * 100)}%</strong><p>Referência calculada sobre a quantidade total instalada.</p></div></article>
          <article className={`panel statCard ${result.curtailedEnergyKwh > 0 ? "warningCard" : ""}`}><span className="bigIcon">◴</span><div><small>Energia não atendida</small><strong>{result.curtailedEnergyKwh} kWh/dia</strong><p>{result.curtailedEnergyKwh > 0 ? "A infraestrutura atual não consegue deslocar toda a energia solicitada." : "Toda a energia de recarga simulada foi atendida."}</p></div></article>
        </section>

        <section className="gridBottom" id="dados">
          <article className="panel profilePanel">
            <div className="panelTitle"><div><span>▥</span><div><h2>Perfil base do condomínio</h2><p>Use a estimativa automática ou carregue 24 valores medidos.</p></div></div></div>
            <div className="profileInfo">
              <div><small>Modo atual</small><strong>{inputs.manualBaseProfile ? "Perfil medido/manual" : "Perfil estimado"}</strong></div>
              <div><small>Pico base</small><strong>{result.basePeak} kW</strong></div>
              <div><small>Capacidade livre no pico</small><strong>{result.availableAtBasePeak} kW</strong></div>
            </div>
            <textarea value={profileText} onChange={(e) => setProfileText(e.target.value)} placeholder="Cole 24 valores, de 0h a 23h. Ex.: 18; 17; 16; ..." rows={4} />
            <div className="profileActions">
              <button className="ghostBtn" onClick={applyManualProfile}>Aplicar 24 valores</button>
              <label className="fileBtn">Importar CSV<input type="file" accept=".csv,text/csv" onChange={handleCsv} /></label>
              <button className="ghostBtn" onClick={useEstimatedProfile}>Usar perfil estimado</button>
            </div>
            <p className="profileMessage">{profileMessage}</p>
          </article>

          <article className={`panel recommendation ${statusClass}`} id="carregadores">
            <div className="shield">{result.withinLimit ? "✓" : "!"}</div>
            <div>
              <small>Diagnóstico</small>
              <h2>{result.withinLimit ? "Demanda gerenciada dentro do limite" : "Revisar estratégia ou infraestrutura"}</h2>
              <p>{result.withinLimit ? "O cenário com gerenciamento mantém o pico abaixo da demanda contratada informada." : "Mesmo com gerenciamento, a curva simulada ultrapassa a demanda contratada. Avalie redução de simultaneidade, potência, programação ou aumento de capacidade."}</p>
              <ul>
                <li>Demanda necessária sem gestão: <b>{result.requiredDemandNoManagement} kW</b></li>
                <li>Pico gerenciado: <b>{result.managedPeak} kW</b></li>
                <li>Margem de reserva: <b>{Math.round(inputs.reserveMargin * 100)}%</b></li>
              </ul>
            </div>
          </article>
        </section>

        <footer>
          <p><b>Nota técnica:</b> esta aplicação gera estimativas de engenharia para estudo de viabilidade. Curvas reais devem ser obtidas por medição (analisador de energia, medidor inteligente ou dados da concessionária) e validadas conforme projeto, instalação existente, normas aplicáveis e requisitos da distribuidora.</p>
        </footer>
      </section>
    </main>
  );
}
