"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { LoadChart } from "@/components/LoadChart";
import { ModuleStepper, type ModuleId } from "@/components/ModuleStepper";
import { curveMetrics, estimatedProfile, manualProfile, parseManualText, parseMeasuredCsv } from "@/lib/curve";
import { dimensionElectrical } from "@/lib/electrical";
import { simulateEvs } from "@/lib/simulation";
import type { CurveProfile, ElectricalInputs, EvInputs, ProjectInfo } from "@/lib/types";

const DEFAULT_PROJECT: ProjectInfo = {
  projectName: "Condomínio Residencial — Estudo EV",
  clientName: "",
  address: "",
  city: "Rio Branco",
  state: "AC",
  responsible: "",
  registration: ""
};

const DEFAULT_EV: EvInputs = {
  chargerCount: 12,
  chargerPowerKw: 7.4,
  energyPerVehicleKwh: 22,
  simultaneity: 0.55,
  arrivalStart: 17,
  arrivalEnd: 21,
  departureHour: 7,
  demandLimitKw: 90,
  reserveMargin: 0.08,
  peakStart: 17,
  peakEnd: 21,
  loadBalancing: true,
  offPeakScheduling: true
};

const DEFAULT_ELECTRICAL: ElectricalInputs = {
  chargerSupplyType: "single",
  chargerVoltageV: 220,
  feederSupplyType: "three",
  feederVoltageV: 380,
  powerFactor: 0.99,
  efficiency: 1,
  chargerCircuitLengthM: 35,
  feederLengthM: 42,
  conductorMaterial: "copper",
  temperatureFactor: 1,
  groupingFactor: 0.8,
  voltageDropLimitPercent: 3,
  availableShortCircuitKa: 4.5,
  breakerIcuKa: 10,
  evseHas6mADCDetection: true
};

const fmt = (v: number, digits = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "blue" | "orange" | "red" | "gray" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleId>("curve");
  const [project, setProject] = useState<ProjectInfo>(DEFAULT_PROJECT);
  const [apartments, setApartments] = useState(120);
  const [diversifiedUnitKw, setDiversifiedUnitKw] = useState(0.42);
  const [commonPeakKw, setCommonPeakKw] = useState(18);
  const [profile, setProfile] = useState<CurveProfile>(() => estimatedProfile(120, 0.42, 18));
  const [manualText, setManualText] = useState("");
  const [curveMessage, setCurveMessage] = useState("Use a curva estimada para explorar a ferramenta ou carregue medições reais em CSV.");
  const [ev, setEv] = useState<EvInputs>(DEFAULT_EV);
  const [electricalInputs, setElectricalInputs] = useState<ElectricalInputs>(DEFAULT_ELECTRICAL);
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ev-condo-v2-state");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.project) setProject({ ...DEFAULT_PROJECT, ...parsed.project });
      if (parsed.ev) setEv({ ...DEFAULT_EV, ...parsed.ev });
      if (parsed.electricalInputs) setElectricalInputs({ ...DEFAULT_ELECTRICAL, ...parsed.electricalInputs });
      if (typeof parsed.apartments === "number") setApartments(parsed.apartments);
      if (typeof parsed.diversifiedUnitKw === "number") setDiversifiedUnitKw(parsed.diversifiedUnitKw);
      if (typeof parsed.commonPeakKw === "number") setCommonPeakKw(parsed.commonPeakKw);
      if (parsed.profile?.hourlyKw?.length === 24) setProfile(parsed.profile);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ev-condo-v2-state", JSON.stringify({ project, ev, electricalInputs, apartments, diversifiedUnitKw, commonPeakKw, profile }));
    } catch {}
  }, [project, ev, electricalInputs, apartments, diversifiedUnitKw, commonPeakKw, profile]);

  const metrics = useMemo(() => curveMetrics(profile.hourlyKw), [profile]);
  const simulation = useMemo(() => simulateEvs(profile, ev), [profile, ev]);
  const electrical = useMemo(() => dimensionElectrical(ev.chargerPowerKw, simulation.maxManagedEvKw, electricalInputs), [ev.chargerPowerKw, simulation.maxManagedEvKw, electricalInputs]);

  const smartRecommendations = useMemo(() => {
    const recs: { tone: "green" | "orange" | "red" | "blue"; title: string; text: string }[] = [];
    if (profile.source === "estimated") recs.push({ tone: "orange", title: "Curva ainda estimada", text: "Para projeto executivo, importe uma campanha de medição representativa. O relatório marcará esta condição como preliminar." });
    if (simulation.unmanagedExceededSlots > 0 && simulation.managedExceededSlots === 0) recs.push({ tone: "green", title: "Load balancing é eficaz", text: `Sem gestão há ${simulation.unmanagedExceededSlots * 15} min/dia acima do limite; o cenário gerenciado elimina a ultrapassagem.` });
    if (simulation.unmetEnergyKwh > 0.5) recs.push({ tone: "red", title: "Energia de recarga não atendida", text: `Faltam ${fmt(simulation.unmetEnergyKwh)} kWh/dia. Aumente a janela disponível, reduza a energia média por veículo ou reveja o limite de potência.` });
    if (!electrical.evFeeder.icuOk) recs.push({ tone: "red", title: "Capacidade de interrupção insuficiente", text: `A Icc informada (${fmt(electricalInputs.availableShortCircuitKa)} kA) é maior que o Icu informado (${fmt(electricalInputs.breakerIcuKa)} kA).` });
    if (electrical.evFeeder.voltageDropPercent > electricalInputs.voltageDropLimitPercent * 0.8) recs.push({ tone: "orange", title: "Queda de tensão próxima ao limite", text: `O alimentador está em ${fmt(electrical.evFeeder.voltageDropPercent, 2)}%. Considere reserva para expansão futura.` });
    if (simulation.deliveryPercent >= 99.5 && simulation.managedExceededSlots === 0 && electrical.evFeeder.icuOk) recs.push({ tone: "blue", title: "Cenário tecnicamente promissor", text: "A simulação atende a energia diária configurada, respeita o limite de demanda e passou na verificação preliminar de Icu." });
    return recs.slice(0, 4);
  }, [profile.source, simulation, electrical, electricalInputs]);

  const completed: Record<ModuleId, boolean> = {
    curve: profile.hourlyKw.length === 24,
    ev: simulation.requestedEnergyKwh > 0,
    electrical: electrical.chargerCircuit.conductorMm2 > 0,
    report: Boolean(project.projectName)
  };

  const useEstimatedCurve = () => {
    const p = estimatedProfile(apartments, diversifiedUnitKw, commonPeakKw);
    setProfile(p);
    setCurveMessage("Curva estimada recalculada. Para projeto executivo, substitua por medições reais.");
  };

  const applyManualCurve = () => {
    const values = parseManualText(manualText);
    if (!values) {
      setCurveMessage("Informe exatamente 24 valores não negativos, separados por ponto e vírgula, espaço ou quebra de linha.");
      return;
    }
    const p = manualProfile(values);
    if (!p) return;
    setProfile(p);
    setCurveMessage("Curva manual aplicada com 24 pontos horários.");
  };

  const handleCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseMeasuredCsv(await file.text());
    if (!parsed) {
      setCurveMessage("Não consegui interpretar o CSV. Use colunas hora;demanda_kw, timestamp;demanda_kw ou 24 valores horários.");
      return;
    }
    setProfile(parsed);
    setManualText(parsed.hourlyKw.map((v) => fmt(v, 2)).join("; "));
    setCurveMessage(`Arquivo ${file.name} processado: ${parsed.pointsRead} registros, qualidade ${parsed.confidence.toLowerCase()}.`);
  };

  const loadExample = async () => {
    const text = await fetch("/exemplo-curva-24h.csv").then((r) => r.text());
    const parsed = parseMeasuredCsv(text);
    if (parsed) {
      setProfile({ ...parsed, sourceLabel: "Exemplo técnico — 24 pontos horários" });
      setManualText(parsed.hourlyKw.join("; "));
      setCurveMessage("Exemplo carregado. Substitua pelos dados reais do condomínio quando disponíveis.");
    }
  };

  const exportSimulationCsv = () => {
    const rows = [["hora", "carga_base_kw", "ev_sem_gestao_kw", "total_sem_gestao_kw", "ev_com_gestao_kw", "total_com_gestao_kw", "limite_kw"]];
    simulation.quarterHours.forEach((hour, i) => rows.push([
      `${String(Math.floor(hour)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
      simulation.baseKw[i].toFixed(3),
      simulation.evUnmanagedKw[i].toFixed(3),
      simulation.totalUnmanagedKw[i].toFixed(3),
      simulation.evManagedKw[i].toFixed(3),
      simulation.totalManagedKw[i].toFixed(3),
      simulation.demandLimitKw[i].toFixed(3)
    ]));
    const blob = new Blob([rows.map((r) => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simulacao-curva-carga-ev.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePdf = async () => {
    setReportBusy(true);
    try {
      const { generateTechnicalPdf } = await import("@/lib/report");
      generateTechnicalPdf({ project, curve: profile, curveMetrics: metrics, evInputs: ev, simulation, electricalInputs, electrical });
    } finally {
      setReportBusy(false);
    }
  };

  const resetAll = () => {
    setProject(DEFAULT_PROJECT);
    setApartments(120);
    setDiversifiedUnitKw(0.42);
    setCommonPeakKw(18);
    setProfile(estimatedProfile(120, 0.42, 18));
    setEv(DEFAULT_EV);
    setElectricalInputs(DEFAULT_ELECTRICAL);
    setManualText("");
    setCurveMessage("Dados restaurados para o cenário inicial.");
    setActiveModule("curve");
  };

  const fieldNumber = (value: number, setter: (n: number) => void, step = "0.1", min = "0", max?: string) => (
    <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => setter(Number(e.target.value))} />
  );

  const statusOk = simulation.managedExceededSlots === 0 && simulation.deliveryPercent >= 99.5 && electrical.evFeeder.icuOk;

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">EV</div>
          <div><strong>EV Condo Designer</strong><span>Curva de Carga V2</span></div>
        </div>
        <div className="sidebarProject">
          <small>PROJETO ATUAL</small>
          <b>{project.projectName || "Novo projeto"}</b>
          <span>{project.city || "—"} / {project.state || "—"}</span>
        </div>
        <nav>
          <button className={activeModule === "curve" ? "active" : ""} onClick={() => setActiveModule("curve")}><span>01</span>Curva medida</button>
          <button className={activeModule === "ev" ? "active" : ""} onClick={() => setActiveModule("ev")}><span>02</span>Simulação EV</button>
          <button className={activeModule === "electrical" ? "active" : ""} onClick={() => setActiveModule("electrical")}><span>03</span>Dimensionamento</button>
          <button className={activeModule === "report" ? "active" : ""} onClick={() => setActiveModule("report")}><span>04</span>Relatório PDF</button>
        </nav>
        <div className="sidebarFoot">
          <Badge tone={statusOk ? "green" : "orange"}>{statusOk ? "CENÁRIO VIÁVEL" : "REVISÃO NECESSÁRIA"}</Badge>
          <p>Motor determinístico de engenharia. Validação final pelo responsável técnico.</p>
          <button className="linkButton" onClick={resetAll}>Restaurar cenário</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">ENGENHARIA ELÉTRICA • ELETROMOBILIDADE • DEMANDA</span>
            <h1>CURVA <em>DE CARGA</em> PARA CONDOMÍNIOS</h1>
            <p>Da medição ao relatório técnico: simule o impacto dos EVSEs e pré-dimensione a infraestrutura elétrica.</p>
          </div>
          <div className={`globalStatus ${statusOk ? "ok" : "attention"}`}>
            <i>{statusOk ? "✓" : "!"}</i>
            <div><small>Status do estudo</small><strong>{statusOk ? "Dentro dos critérios configurados" : "Há pontos para revisar"}</strong></div>
          </div>
        </header>

        <ModuleStepper active={activeModule} onChange={setActiveModule} completed={completed} />

        <section className="kpiRow">
          <KpiCard label="Pico da curva base" value={`${fmt(metrics.peakKw)} kW`} hint={`às ${String(metrics.peakHour).padStart(2, "0")}:00`} icon="⌁" accent="blue" />
          <KpiCard label="Pico sem gerenciamento" value={`${fmt(simulation.unmanagedPeakKw)} kW`} hint={`${simulation.unmanagedExceededSlots * 15} min acima do limite`} icon="⚡" accent="orange" />
          <KpiCard label="Pico com gerenciamento" value={`${fmt(simulation.managedPeakKw)} kW`} hint={`${fmt(simulation.peakReductionPercent)}% de redução`} icon="◎" accent="green" />
          <KpiCard label="Energia EV atendida" value={`${fmt(simulation.deliveryPercent)}%`} hint={`${fmt(simulation.deliveredEnergyKwh)} de ${fmt(simulation.requestedEnergyKwh)} kWh`} icon="▤" accent={simulation.deliveryPercent >= 99.5 ? "green" : "red"} />
          <KpiCard label="Alimentador QD-EV" value={`${electrical.evFeeder.conductorMm2} mm²`} hint={`${electrical.evFeeder.breakerA} A • ΔV ${fmt(electrical.evFeeder.voltageDropPercent, 2)}%`} icon="⎍" accent="purple" />
        </section>

        {smartRecommendations.length ? (
          <section className="smartPanel">
            <div className="smartHeader"><span>✦</span><div><b>Assistente técnico</b><small>Leitura automática dos resultados atuais</small></div></div>
            <div className="smartGrid">
              {smartRecommendations.map((r, i) => <article key={i} className={`smartItem ${r.tone}`}><b>{r.title}</b><p>{r.text}</p></article>)}
            </div>
          </section>
        ) : null}

        {activeModule === "curve" ? (
          <section className="moduleGrid twoCols">
            <article className="panel mainPanel">
              <div className="panelHead">
                <div><span className="panelIcon">01</span><div><h2>Curva medida / perfil de carga</h2><p>Importe dados reais ou trabalhe com um perfil preliminar de 24 horas.</p></div></div>
                <Badge tone={profile.source === "estimated" ? "orange" : profile.confidence === "Excelente" || profile.confidence === "Boa" ? "green" : "blue"}>{profile.confidence}</Badge>
              </div>

              <div className="curveSummary">
                <div><small>Origem</small><strong>{profile.sourceLabel}</strong></div>
                <div><small>Registros</small><strong>{profile.pointsRead}</strong></div>
                <div><small>Dias detectados</small><strong>{profile.measuredDays || "—"}</strong></div>
                <div><small>Intervalo</small><strong>{profile.intervalMinutes} min</strong></div>
                <div><small>Fator de carga</small><strong>{fmt(metrics.loadFactor * 100)}%</strong></div>
              </div>

              <div className="hourBars" aria-label="Perfil horário em barras">
                {profile.hourlyKw.map((v, h) => {
                  const max = Math.max(...profile.hourlyKw, 1);
                  return <div key={h} title={`${h}:00 — ${fmt(v)} kW`}><i style={{ height: `${Math.max(4, (v / max) * 100)}%` }} /><span>{h % 3 === 0 ? h : ""}</span></div>;
                })}
              </div>

              <div className="metricsGrid">
                <div><small>Demanda máxima</small><strong>{fmt(metrics.peakKw)} kW</strong></div>
                <div><small>Demanda média</small><strong>{fmt(metrics.meanKw)} kW</strong></div>
                <div><small>Demanda mínima</small><strong>{fmt(metrics.minKw)} kW</strong></div>
                <div><small>Energia equivalente</small><strong>{fmt(metrics.dailyEnergyKwh)} kWh/dia</strong></div>
              </div>

              <div className="notice">
                <b>Qualidade do dado</b>
                <p>{profile.notes.join(" ")}</p>
              </div>
            </article>

            <aside className="panel controlPanel">
              <div className="panelHead compact"><div><span className="panelIcon">↥</span><div><h2>Entrada de dados</h2><p>CSV, 24 valores ou estimativa.</p></div></div></div>
              <div className="sectionLabel">IMPORTAR MEDIÇÃO</div>
              <label className="uploadBox">
                <input type="file" accept=".csv,text/csv" onChange={handleCsv} />
                <span>↥</span><b>Selecionar arquivo CSV</b><small>hora;demanda_kw ou timestamp;demanda_kw</small>
              </label>
              <div className="inlineActions"><button className="secondaryBtn" onClick={loadExample}>Carregar exemplo</button><a className="secondaryBtn" href="/exemplo-curva-24h.csv" download>Baixar modelo CSV</a></div>

              <div className="sectionLabel">CURVA MANUAL</div>
              <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={5} placeholder="28; 26; 25; ... até 24 valores" />
              <button className="secondaryBtn full" onClick={applyManualCurve}>Aplicar 24 valores</button>

              <div className="sectionLabel">ESTIMATIVA PRELIMINAR</div>
              <div className="formGrid compactForm">
                <Field label="Apartamentos">{fieldNumber(apartments, setApartments, "1")}</Field>
                <Field label="Demanda por apto (kW)">{fieldNumber(diversifiedUnitKw, setDiversifiedUnitKw, "0.01")}</Field>
                <Field label="Pico áreas comuns (kW)">{fieldNumber(commonPeakKw, setCommonPeakKw)}</Field>
              </div>
              <button className="primaryBtn" onClick={useEstimatedCurve}>Gerar curva estimada</button>
              <p className="helperMessage">{curveMessage}</p>
            </aside>
          </section>
        ) : null}

        {activeModule === "ev" ? (
          <section className="moduleGrid chartAndControls">
            <article className="panel mainPanel">
              <div className="panelHead">
                <div><span className="panelIcon">02</span><div><h2>Simulação dos carregadores</h2><p>Compare a operação livre com a estratégia de gerenciamento dinâmico.</p></div></div>
                <button className="secondaryBtn" onClick={exportSimulationCsv}>Exportar simulação CSV</button>
              </div>
              <LoadChart result={simulation} />
              <div className="chartStats">
                <div><small>Janela crítica sem gestão</small><strong>{simulation.unmanagedExceededSlots ? `${simulation.unmanagedExceededSlots * 15} min acima do limite` : "Sem ultrapassagem"}</strong></div>
                <div><small>Potência EV máxima gerenciada</small><strong>{fmt(simulation.maxManagedEvKw)} kW</strong></div>
                <div><small>Energia não atendida</small><strong className={simulation.unmetEnergyKwh > 0.5 ? "dangerText" : "successText"}>{fmt(simulation.unmetEnergyKwh)} kWh</strong></div>
              </div>
            </article>

            <aside className="panel controlPanel">
              <div className="panelHead compact"><div><span className="panelIcon">⚙</span><div><h2>Parâmetros EV</h2><p>Resultado recalculado em tempo real.</p></div></div></div>
              <div className="formGrid">
                <Field label="Nº de carregadores">{fieldNumber(ev.chargerCount, (n) => setEv((s) => ({ ...s, chargerCount: n })), "1")}</Field>
                <Field label="Potência unitária (kW)">{fieldNumber(ev.chargerPowerKw, (n) => setEv((s) => ({ ...s, chargerPowerKw: n })))}</Field>
                <Field label="Energia por veículo/dia (kWh)">{fieldNumber(ev.energyPerVehicleKwh, (n) => setEv((s) => ({ ...s, energyPerVehicleKwh: n })), "1")}</Field>
                <Field label="Simultaneidade" hint="0 a 1">{fieldNumber(ev.simultaneity, (n) => setEv((s) => ({ ...s, simultaneity: n })), "0.01", "0", "1")}</Field>
                <Field label="Chegadas iniciam às">{fieldNumber(ev.arrivalStart, (n) => setEv((s) => ({ ...s, arrivalStart: n })), "1", "0", "23")}</Field>
                <Field label="Chegadas até">{fieldNumber(ev.arrivalEnd, (n) => setEv((s) => ({ ...s, arrivalEnd: n })), "1", "0", "23")}</Field>
                <Field label="Saída prevista às">{fieldNumber(ev.departureHour, (n) => setEv((s) => ({ ...s, departureHour: n })), "1", "0", "23")}</Field>
                <Field label="Limite de demanda (kW)">{fieldNumber(ev.demandLimitKw, (n) => setEv((s) => ({ ...s, demandLimitKw: n })), "1")}</Field>
                <Field label="Reserva operacional" hint="Ex.: 0,08 = 8%">{fieldNumber(ev.reserveMargin, (n) => setEv((s) => ({ ...s, reserveMargin: n })), "0.01", "0", "0.5")}</Field>
                <Field label="Ponta inicia às">{fieldNumber(ev.peakStart, (n) => setEv((s) => ({ ...s, peakStart: n })), "1", "0", "23")}</Field>
                <Field label="Ponta termina às">{fieldNumber(ev.peakEnd, (n) => setEv((s) => ({ ...s, peakEnd: n })), "1", "0", "23")}</Field>
              </div>
              <div className="toggleRow"><div><b>Load balancing</b><small>Limita EVs pela potência disponível.</small></div><button className={ev.loadBalancing ? "toggle on" : "toggle"} onClick={() => setEv((s) => ({ ...s, loadBalancing: !s.loadBalancing }))}><i /></button></div>
              <div className="toggleRow"><div><b>Recarga fora de ponta</b><small>Prioriza intervalos de menor solicitação.</small></div><button className={ev.offPeakScheduling ? "toggle on" : "toggle"} onClick={() => setEv((s) => ({ ...s, offPeakScheduling: !s.offPeakScheduling }))}><i /></button></div>
              <div className={`resultBox ${simulation.managedExceededSlots === 0 && simulation.unmetEnergyKwh < 0.5 ? "ok" : "warn"}`}>
                <small>RESULTADO DO CENÁRIO</small>
                <b>{simulation.managedExceededSlots === 0 ? "Demanda controlada" : "Limite excedido"}</b>
                <p>{simulation.deliveryPercent >= 99.5 ? "A energia configurada é atendida dentro da janela disponível." : `Apenas ${fmt(simulation.deliveryPercent)}% da energia solicitada é atendida.`}</p>
              </div>
            </aside>
          </section>
        ) : null}

        {activeModule === "electrical" ? (
          <section className="moduleGrid twoColsWide">
            <article className="panel mainPanel">
              <div className="panelHead"><div><span className="panelIcon">03</span><div><h2>Dimensionamento elétrico preliminar</h2><p>Corrente, condutores, proteção, queda de tensão, PE e capacidade de interrupção.</p></div></div><Badge tone={electrical.evFeeder.icuOk ? "green" : "red"}>{electrical.evFeeder.icuOk ? "Icu adequado" : "Revisar Icu"}</Badge></div>

              <div className="circuitCards">
                {[electrical.chargerCircuit, electrical.evFeeder].map((c) => (
                  <article className="circuitCard" key={c.label}>
                    <div className="circuitTitle"><div><small>{c.label}</small><strong>{fmt(c.powerKw)} kW</strong></div><Badge tone={c.icuOk && c.voltageDropPercent <= electricalInputs.voltageDropLimitPercent ? "green" : "orange"}>{c.icuOk ? "VERIFICADO" : "ATENÇÃO"}</Badge></div>
                    <div className="circuitMetrics">
                      <div><small>Ib</small><strong>{fmt(c.designCurrentA)} A</strong></div>
                      <div><small>Disjuntor</small><strong>{c.breakerA} A</strong></div>
                      <div><small>Condutor</small><strong>{c.conductorMm2} mm²</strong></div>
                      <div><small>Iz corrigida</small><strong>{fmt(c.correctedAmpacityA)} A</strong></div>
                      <div><small>Queda ΔV</small><strong>{fmt(c.voltageDropPercent, 2)}%</strong></div>
                      <div><small>PE</small><strong>{c.peMm2} mm²</strong></div>
                    </div>
                    <div className="coordination">
                      <span>Ib {fmt(c.designCurrentA)} A</span><i>≤</i><span>In {c.breakerA} A</span><i>≤</i><span>Iz {fmt(c.correctedAmpacityA)} A</span>
                    </div>
                    <div className="miniNote"><b>DR / corrente residual:</b> {c.rcdRecommendation}</div>
                    {c.notes.filter((n) => !n.startsWith("Seção sugerida")).map((n, i) => <p className="warningLine" key={i}>⚠ {n}</p>)}
                  </article>
                ))}
              </div>

              <div className="calculationPanel">
                <div><h3>Memória de cálculo — circuito do EVSE</h3><p>A ferramenta mostra a lógica usada para o profissional poder auditar o resultado.</p></div>
                <div className="formulaBlock">
                  <b>Corrente de projeto</b>
                  <code>{electricalInputs.chargerSupplyType === "three" ? "Ib = P / (√3 × V × FP × η)" : "Ib = P / (V × FP × η)"}</code>
                  <span>P = {fmt(ev.chargerPowerKw)} kW • V = {fmt(electricalInputs.chargerVoltageV, 0)} V • FP = {fmt(electricalInputs.powerFactor, 2)} • η = {fmt(electricalInputs.efficiency, 2)}</span>
                  <strong>Ib = {fmt(electrical.chargerCircuit.designCurrentA)} A</strong>
                </div>
                <div className="formulaBlock">
                  <b>Queda de tensão</b>
                  <code>{electricalInputs.chargerSupplyType === "three" ? "ΔV% = (√3 × L × I × ρ / S) / V × 100" : "ΔV% = (2 × L × I × ρ / S) / V × 100"}</code>
                  <span>L = {fmt(electricalInputs.chargerCircuitLengthM)} m • S = {electrical.chargerCircuit.conductorMm2} mm² • material = {electricalInputs.conductorMaterial === "copper" ? "cobre" : "alumínio"}</span>
                  <strong>ΔV = {fmt(electrical.chargerCircuit.voltageDropPercent, 2)}%</strong>
                </div>
              </div>
            </article>

            <aside className="panel controlPanel">
              <div className="panelHead compact"><div><span className="panelIcon">⚙</span><div><h2>Dados elétricos</h2><p>Defina as premissas do cálculo.</p></div></div></div>
              <div className="formGrid">
                <Field label="Sistema do EVSE">
                  <select value={electricalInputs.chargerSupplyType} onChange={(e) => setElectricalInputs((s) => ({ ...s, chargerSupplyType: e.target.value as ElectricalInputs["chargerSupplyType"] }))}><option value="single">Monofásico / bifásico</option><option value="three">Trifásico</option></select>
                </Field>
                <Field label="Tensão do EVSE (V)">{fieldNumber(electricalInputs.chargerVoltageV, (n) => setElectricalInputs((s) => ({ ...s, chargerVoltageV: n })), "1")}</Field>
                <Field label="Sistema do QD-EV">
                  <select value={electricalInputs.feederSupplyType} onChange={(e) => setElectricalInputs((s) => ({ ...s, feederSupplyType: e.target.value as ElectricalInputs["feederSupplyType"] }))}><option value="single">Monofásico / bifásico</option><option value="three">Trifásico</option></select>
                </Field>
                <Field label="Tensão do QD-EV (V)">{fieldNumber(electricalInputs.feederVoltageV, (n) => setElectricalInputs((s) => ({ ...s, feederVoltageV: n })), "1")}</Field>
                <Field label="Fator de potência">{fieldNumber(electricalInputs.powerFactor, (n) => setElectricalInputs((s) => ({ ...s, powerFactor: n })), "0.01", "0.1", "1")}</Field>
                <Field label="Rendimento">{fieldNumber(electricalInputs.efficiency, (n) => setElectricalInputs((s) => ({ ...s, efficiency: n })), "0.01", "0.1", "1")}</Field>
                <Field label="Distância circuito EVSE (m)">{fieldNumber(electricalInputs.chargerCircuitLengthM, (n) => setElectricalInputs((s) => ({ ...s, chargerCircuitLengthM: n })), "1")}</Field>
                <Field label="Distância alimentador QD-EV (m)">{fieldNumber(electricalInputs.feederLengthM, (n) => setElectricalInputs((s) => ({ ...s, feederLengthM: n })), "1")}</Field>
                <Field label="Condutor">
                  <select value={electricalInputs.conductorMaterial} onChange={(e) => setElectricalInputs((s) => ({ ...s, conductorMaterial: e.target.value as ElectricalInputs["conductorMaterial"] }))}><option value="copper">Cobre</option><option value="aluminum">Alumínio</option></select>
                </Field>
                <Field label="Fator temperatura">{fieldNumber(electricalInputs.temperatureFactor, (n) => setElectricalInputs((s) => ({ ...s, temperatureFactor: n })), "0.01", "0.1", "1.2")}</Field>
                <Field label="Fator agrupamento">{fieldNumber(electricalInputs.groupingFactor, (n) => setElectricalInputs((s) => ({ ...s, groupingFactor: n })), "0.01", "0.1", "1")}</Field>
                <Field label="Limite ΔV (%)">{fieldNumber(electricalInputs.voltageDropLimitPercent, (n) => setElectricalInputs((s) => ({ ...s, voltageDropLimitPercent: n })), "0.1")}</Field>
                <Field label="Icc disponível (kA)">{fieldNumber(electricalInputs.availableShortCircuitKa, (n) => setElectricalInputs((s) => ({ ...s, availableShortCircuitKa: n })), "0.1")}</Field>
                <Field label="Icu disjuntor (kA)">{fieldNumber(electricalInputs.breakerIcuKa, (n) => setElectricalInputs((s) => ({ ...s, breakerIcuKa: n })), "0.1")}</Field>
              </div>
              <div className="toggleRow"><div><b>EVSE detecta 6 mA CC</b><small>Usado apenas para orientar a recomendação de DR.</small></div><button className={electricalInputs.evseHas6mADCDetection ? "toggle on" : "toggle"} onClick={() => setElectricalInputs((s) => ({ ...s, evseHas6mADCDetection: !s.evseHas6mADCDetection }))}><i /></button></div>
              <div className="notice warning"><b>Critério de uso</b><p>O motor faz pré-dimensionamento. A seção final deve ser validada pelo método real de instalação, tabelas da NBR 5410, fabricante, curto-circuito, seletividade e demais condições do projeto.</p></div>
            </aside>
          </section>
        ) : null}

        {activeModule === "report" ? (
          <section className="moduleGrid reportGrid">
            <article className="panel mainPanel">
              <div className="panelHead"><div><span className="panelIcon">04</span><div><h2>Relatório técnico PDF</h2><p>Consolidação automática da curva, simulação, memória de cálculo e recomendações.</p></div></div><Badge tone="green">PDF pronto para gerar</Badge></div>

              <div className="reportPreview">
                <div className="reportCover">
                  <small>PROJETO DE INFRAESTRUTURA</small>
                  <h3>RECARGA DE VEÍCULOS ELÉTRICOS</h3>
                  <p>Curva de carga • Simulação EV • Dimensionamento elétrico</p>
                  <div><span>Projeto</span><b>{project.projectName || "Não informado"}</b></div>
                  <div><span>Cliente</span><b>{project.clientName || "Não informado"}</b></div>
                  <div><span>Local</span><b>{[project.city, project.state].filter(Boolean).join(" / ") || "Não informado"}</b></div>
                  <div><span>Responsável</span><b>{project.responsible || "Não informado"}</b></div>
                </div>
                <div className="reportIndex">
                  <h3>Conteúdo do relatório</h3>
                  {[
                    "1. Identificação e objetivo",
                    "2. Origem e qualidade da curva de carga",
                    "3. Indicadores da demanda existente",
                    "4. Simulação dos carregadores",
                    "5. Load balancing e energia atendida",
                    "6. Pré-dimensionamento elétrico",
                    "7. Correntes, cabos, queda de tensão e PE",
                    "8. Verificação de Icu × Icc",
                    "9. Proteção diferencial — orientação",
                    "10. Recomendações e ressalvas técnicas",
                    "11. Referências para validação"
                  ].map((t) => <div key={t}><span>✓</span>{t}</div>)}
                </div>
              </div>

              <div className="reportResultGrid">
                <div><small>Curva</small><strong>{profile.confidence}</strong><p>{profile.sourceLabel}</p></div>
                <div><small>Demanda</small><strong>{simulation.managedExceededSlots === 0 ? "Dentro do limite" : "Revisar"}</strong><p>Pico gerenciado: {fmt(simulation.managedPeakKw)} kW</p></div>
                <div><small>Energia EV</small><strong>{fmt(simulation.deliveryPercent)}%</strong><p>{fmt(simulation.deliveredEnergyKwh)} kWh/dia atendidos</p></div>
                <div><small>Proteção</small><strong>{electrical.evFeeder.icuOk ? "Icu adequado" : "Icu insuficiente"}</strong><p>Icc: {fmt(electricalInputs.availableShortCircuitKa)} kA</p></div>
              </div>
            </article>

            <aside className="panel controlPanel">
              <div className="panelHead compact"><div><span className="panelIcon">▤</span><div><h2>Identificação do projeto</h2><p>Dados impressos na capa.</p></div></div></div>
              <div className="formStack">
                <Field label="Nome do projeto"><input value={project.projectName} onChange={(e) => setProject((s) => ({ ...s, projectName: e.target.value }))} /></Field>
                <Field label="Cliente / condomínio"><input value={project.clientName} onChange={(e) => setProject((s) => ({ ...s, clientName: e.target.value }))} /></Field>
                <Field label="Endereço"><input value={project.address} onChange={(e) => setProject((s) => ({ ...s, address: e.target.value }))} /></Field>
                <div className="formGrid">
                  <Field label="Cidade"><input value={project.city} onChange={(e) => setProject((s) => ({ ...s, city: e.target.value }))} /></Field>
                  <Field label="UF"><input value={project.state} maxLength={2} onChange={(e) => setProject((s) => ({ ...s, state: e.target.value.toUpperCase() }))} /></Field>
                </div>
                <Field label="Responsável técnico"><input value={project.responsible} onChange={(e) => setProject((s) => ({ ...s, responsible: e.target.value }))} /></Field>
                <Field label="CREA / CFT / registro"><input value={project.registration} onChange={(e) => setProject((s) => ({ ...s, registration: e.target.value }))} /></Field>
              </div>
              <button className="primaryBtn pdfBtn" onClick={generatePdf} disabled={reportBusy}>{reportBusy ? "Gerando PDF..." : "▤ Gerar relatório técnico PDF"}</button>
              <div className="notice"><b>Rastreabilidade</b><p>O PDF registra premissas, resultados, notas técnicas e ressalvas de validação. Isso reduz o risco de apresentar um dimensionamento sem contexto.</p></div>
            </aside>
          </section>
        ) : null}

        <footer>
          <b>V2 — Curva Medida → Simulação dos EVs → Dimensionamento Elétrico → Relatório PDF</b>
          <span>Ferramenta de apoio ao projeto. Não substitui inspeção de campo, responsabilidade técnica, normas vigentes, documentação do fabricante ou requisitos da distribuidora.</span>
        </footer>
      </section>
    </main>
  );
}
