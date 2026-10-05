import type { CurveMetrics, CurveProfile, ElectricalInputs, ElectricalResult, EvInputs, EvSimulationResult, ProjectInfo } from "./types";

export type ReportData = {
  project: ProjectInfo;
  curve: CurveProfile;
  curveMetrics: CurveMetrics;
  evInputs: EvInputs;
  simulation: EvSimulationResult;
  electricalInputs: ElectricalInputs;
  electrical: ElectricalResult;
};

const fmt = (v: number, digits = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const safeFileName = (name: string) => (name || "projeto-ev").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projeto-ev";
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch] || ch));

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export async function generateTechnicalPdf(data: ReportData) {
  if (typeof window === "undefined") throw new Error("A geração do PDF deve ser executada no navegador.");
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = 210;
  const pageH = 297;
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 18;

  const color = {
    navy: [5, 18, 31] as [number, number, number],
    green: [21, 200, 154] as [number, number, number],
    blue: [38, 137, 210] as [number, number, number],
    orange: [235, 130, 54] as [number, number, number],
    red: [218, 67, 83] as [number, number, number],
    gray: [85, 101, 111] as [number, number, number]
  };

  function footer() {
    doc.setDrawColor(220);
    doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
    doc.setFontSize(7.5);
    doc.setTextColor(...color.gray);
    doc.text("EV Condo Designer V2.1 - Relatorio de apoio ao projeto", margin, pageH - 8);
    doc.text(`Pagina ${doc.getNumberOfPages()}`, pageW - margin, pageH - 8, { align: "right" });
  }

  function newPage() {
    footer();
    doc.addPage();
    y = 18;
  }

  function ensure(height = 20) {
    if (y + height > pageH - 20) newPage();
  }

  function title(text: string) {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...color.navy);
    doc.text(text, margin, y);
    doc.setDrawColor(...color.green);
    doc.setLineWidth(1.2);
    doc.line(margin, y + 3, margin + 32, y + 3);
    y += 10;
  }

  function body(text: string, size = 9.5) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(45, 57, 66);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    ensure(lines.length * 5 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.7 + 2;
  }

  function kv(label: string, value: string, x = margin, valueX = margin + 58, width = contentW) {
    ensure(8);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...color.gray);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color.navy);
    const text = doc.splitTextToSize(value, width - (valueX - x)) as string[];
    doc.text(text, valueX, y);
    y += Math.max(5.3, text.length * 4.2 + 1);
  }

  function statusBox(label: string, value: string, ok: boolean) {
    ensure(17);
    doc.setFillColor(ok ? 232 : 255, ok ? 249 : 238, ok ? 244 : 240);
    doc.setDrawColor(...(ok ? color.green : color.red));
    doc.roundedRect(margin, y, contentW, 13, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...color.gray);
    doc.text(label, margin + 4, y + 5);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(ok ? color.green : color.red));
    doc.text(value, margin + 4, y + 10);
    y += 18;
  }

  function row(cells: string[], widths: number[], header = false) {
    const rowH = 8;
    ensure(rowH + 2);
    let x = margin;
    cells.forEach((cell, i) => {
      const bg: [number, number, number] = header ? color.navy : [250, 252, 253];
      const fg: [number, number, number] = header ? [255, 255, 255] : color.navy;
      doc.setFillColor(...bg);
      doc.setDrawColor(220, 228, 233);
      doc.rect(x, y, widths[i], rowH, "FD");
      doc.setFontSize(7.2);
      doc.setFont("helvetica", header ? "bold" : "normal");
      doc.setTextColor(...fg);
      const text = doc.splitTextToSize(cell, widths[i] - 3) as string[];
      doc.text(text.slice(0, 2), x + 1.5, y + 4.6);
      x += widths[i];
    });
    y += rowH;
  }

  function drawCurve() {
    ensure(82);
    const x0 = margin + 8;
    const y0 = y + 4;
    const w = contentW - 16;
    const h = 57;
    const maxData = Math.max(1, ...data.simulation.totalUnmanagedKw, ...data.simulation.totalManagedKw, data.evInputs.demandLimitKw);
    const maxY = Math.max(10, Math.ceil((maxData * 1.12) / 10) * 10);
    doc.setFillColor(250, 252, 253);
    doc.setDrawColor(220, 230, 235);
    doc.roundedRect(margin, y, contentW, 69, 2, 2, "FD");
    for (let i = 0; i <= 5; i++) {
      const gy = y0 + h - (i / 5) * h;
      doc.setDrawColor(230, 236, 239);
      doc.line(x0, gy, x0 + w, gy);
      doc.setFontSize(6.5);
      doc.setTextColor(...color.gray);
      doc.text(`${Math.round((maxY / 5) * i)}`, x0 - 2, gy + 1.8, { align: "right" });
    }
    const draw = (values: number[], rgb: [number, number, number], dashed = false) => {
      if (!values.length) return;
      doc.setDrawColor(...rgb);
      doc.setLineWidth(dashed ? 0.45 : 0.7);
      doc.setLineDashPattern(dashed ? [2, 1.5] : [], 0);
      for (let i = 1; i < values.length; i++) {
        const xa = x0 + ((i - 1) / (values.length - 1)) * w;
        const xb = x0 + (i / (values.length - 1)) * w;
        const ya = y0 + h - ((Number.isFinite(values[i - 1]) ? values[i - 1] : 0) / maxY) * h;
        const yb = y0 + h - ((Number.isFinite(values[i]) ? values[i] : 0) / maxY) * h;
        doc.line(xa, ya, xb, yb);
      }
      doc.setLineDashPattern([], 0);
    };
    draw(data.simulation.baseKw, color.blue);
    draw(data.simulation.totalUnmanagedKw, color.orange);
    draw(data.simulation.totalManagedKw, color.green);
    draw(data.simulation.demandLimitKw, color.red, true);
    doc.setFontSize(6.5);
    doc.setTextColor(...color.gray);
    [0, 6, 12, 18, 24].forEach((hour) => doc.text(`${hour}h`, x0 + (hour / 24) * w, y0 + h + 5, { align: "center" }));
    y += 74;
  }

  // Capa
  doc.setFillColor(...color.navy);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...color.green);
  doc.rect(0, 0, 7, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.text("PROJETO DE INFRAESTRUTURA", 20, 48);
  doc.text("PARA RECARGA DE VEICULOS ELETRICOS", 20, 61);
  doc.setTextColor(...color.green);
  doc.setFontSize(17);
  doc.text("Curva de carga - Simulacao - Dimensionamento", 20, 76);
  doc.setTextColor(190, 207, 217);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatorio tecnico de apoio ao projeto - V2.1", 20, 85);
  doc.setDrawColor(47, 75, 92);
  doc.line(20, 104, 190, 104);
  const cover: Array<[string, string]> = [
    ["Projeto", data.project.projectName || "Nao informado"],
    ["Cliente", data.project.clientName || "Nao informado"],
    ["Local", [data.project.address, data.project.city, data.project.state].filter(Boolean).join(" - ") || "Nao informado"],
    ["Responsavel tecnico", data.project.responsible || "Nao informado"],
    ["Registro", data.project.registration || "Nao informado"],
    ["Data", new Date().toLocaleDateString("pt-BR")]
  ];
  let cy = 119;
  cover.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 163, 176);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), 20, cy);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(value, 150) as string[], 20, cy + 6);
    cy += 20;
  });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(164, 184, 196);
  doc.setFontSize(7.5);
  doc.text("Documento gerado automaticamente. Os resultados dependem dos dados informados e devem ser validados pelo responsavel tecnico antes da execucao.", 20, 276, { maxWidth: 168 });

  doc.addPage();
  y = 18;
  title("1. Identificacao e objetivo");
  body("Este relatorio consolida a analise da curva de carga da edificacao, a simulacao da insercao de carregadores de veiculos eletricos, o pre-dimensionamento dos circuitos eletricos e recomendacoes para o desenvolvimento do projeto executivo.");
  kv("Projeto", data.project.projectName || "Nao informado");
  kv("Cliente", data.project.clientName || "Nao informado");
  kv("Endereco", [data.project.address, data.project.city, data.project.state].filter(Boolean).join(" - ") || "Nao informado");
  kv("Responsavel", data.project.responsible || "Nao informado");
  kv("Registro", data.project.registration || "Nao informado");

  title("2. Curva de carga");
  kv("Origem dos dados", data.curve.sourceLabel);
  kv("Registros lidos", `${data.curve.pointsRead}`);
  kv("Dias detectados", `${data.curve.measuredDays}`);
  kv("Intervalo estimado", `${data.curve.intervalMinutes} min`);
  kv("Indice qualitativo", data.curve.confidence);
  row(["Indicador", "Resultado"], [80, 98], true);
  row(["Demanda maxima", `${fmt(data.curveMetrics.peakKw)} kW`], [80, 98]);
  row(["Demanda media", `${fmt(data.curveMetrics.meanKw)} kW`], [80, 98]);
  row(["Demanda minima", `${fmt(data.curveMetrics.minKw)} kW`], [80, 98]);
  row(["Energia diaria equivalente", `${fmt(data.curveMetrics.dailyEnergyKwh)} kWh/dia`], [80, 98]);
  row(["Fator de carga", `${fmt(data.curveMetrics.loadFactor * 100)} %`], [80, 98]);
  drawCurve();

  title("3. Simulacao da infraestrutura de recarga");
  kv("Quantidade de carregadores", `${data.evInputs.chargerCount}`);
  kv("Potencia unitaria", `${fmt(data.evInputs.chargerPowerKw)} kW`);
  kv("Energia por veiculo/dia", `${fmt(data.evInputs.energyPerVehicleKwh)} kWh`);
  kv("Fator de simultaneidade", fmt(data.evInputs.simultaneity, 2));
  kv("Limite de demanda considerado", `${fmt(data.evInputs.demandLimitKw)} kW`);
  kv("Margem operacional", `${fmt(data.evInputs.reserveMargin * 100)} %`);
  kv("Load balancing", data.evInputs.loadBalancing ? "Ativado" : "Desativado");
  kv("Recarga fora de ponta", data.evInputs.offPeakScheduling ? "Ativada" : "Desativada");
  statusBox("STATUS DA SIMULACAO", data.simulation.managedExceededSlots === 0 ? "DEMANDA GERENCIADA DENTRO DO LIMITE" : "HA ULTRAPASSAGEM NO CENARIO GERENCIADO", data.simulation.managedExceededSlots === 0);
  row(["Resultado", "Valor"], [90, 88], true);
  row(["Pico sem gerenciamento", `${fmt(data.simulation.unmanagedPeakKw)} kW`], [90, 88]);
  row(["Pico com gerenciamento", `${fmt(data.simulation.managedPeakKw)} kW`], [90, 88]);
  row(["Reducao do pico", `${fmt(data.simulation.peakReductionPercent)} %`], [90, 88]);
  row(["Energia EV solicitada", `${fmt(data.simulation.requestedEnergyKwh)} kWh/dia`], [90, 88]);
  row(["Energia EV atendida", `${fmt(data.simulation.deliveredEnergyKwh)} kWh/dia`], [90, 88]);
  row(["Energia nao atendida", `${fmt(data.simulation.unmetEnergyKwh)} kWh/dia`], [90, 88]);

  title("4. Pre-dimensionamento eletrico");
  body("O pre-dimensionamento abaixo e calculado com base nos dados informados e em uma tabela tecnica interna conservadora. A selecao final deve ser confirmada pela ABNT NBR 5410, ABNT NBR 17019, documentacao do EVSE, metodo real de instalacao, temperatura, agrupamento, curto-circuito e requisitos da distribuidora.");
  kv("Circuito EVSE", `${data.electricalInputs.chargerSupplyType === "three" ? "Trifasico" : "Monofasico/bifasico"} - ${fmt(data.electricalInputs.chargerVoltageV, 0)} V`);
  kv("Alimentador QD-EV", `${data.electricalInputs.feederSupplyType === "three" ? "Trifasico" : "Monofasico/bifasico"} - ${fmt(data.electricalInputs.feederVoltageV, 0)} V`);
  kv("Fator de potencia", fmt(data.electricalInputs.powerFactor, 2));
  kv("Rendimento", fmt(data.electricalInputs.efficiency, 2));
  kv("Material", data.electricalInputs.conductorMaterial === "copper" ? "Cobre" : "Aluminio");
  kv("Icc disponivel informada", `${fmt(data.electricalInputs.availableShortCircuitKa)} kA`);
  kv("Icu do disjuntor informado", `${fmt(data.electricalInputs.breakerIcuKa)} kA`);

  row(["Circuito", "Ib", "Disj.", "Cabo", "Iz corr.", "dV", "PE"], [48, 21, 21, 21, 24, 21, 22], true);
  [data.electrical.chargerCircuit, data.electrical.evFeeder].forEach((c) => {
    row([
      c.label,
      `${fmt(c.designCurrentA)} A`,
      `${c.breakerA} A`,
      `${fmt(c.conductorMm2, c.conductorMm2 % 1 ? 1 : 0)} mm2`,
      `${fmt(c.correctedAmpacityA)} A`,
      `${fmt(c.voltageDropPercent, 2)} %`,
      `${fmt(c.peMm2, c.peMm2 % 1 ? 1 : 0)} mm2`
    ], [48, 21, 21, 21, 24, 21, 22]);
  });
  y += 4;
  kv("Protecao diferencial", data.electrical.chargerCircuit.rcdRecommendation, margin, margin + 48, contentW);
  kv("Verificacao Icu", data.electrical.chargerCircuit.icuOk && data.electrical.evFeeder.icuOk ? "Adequada para a Icc informada" : "REVISAR - Icu inferior a Icc informada");

  title("5. Recomendacoes tecnicas");
  const recommendations = [
    ...data.curve.notes,
    ...data.electrical.generalNotes,
    ...(data.simulation.unmetEnergyKwh > 0.1 ? ["A energia diaria solicitada pelos veiculos nao foi totalmente atendida no periodo configurado. Rever janela de recarga, potencia disponivel, simultaneidade ou numero de pontos."] : []),
    ...(data.simulation.managedExceededSlots > 0 ? ["Mesmo com gerenciamento, ha intervalos acima do limite de demanda. Reduzir o limite de potencia EV ou revisar a infraestrutura de fornecimento."] : []),
    ...(data.curve.source === "estimated" ? ["Executar campanha de medicao antes do projeto executivo para substituir a curva estimada por dados reais."] : [])
  ];
  recommendations.forEach((r, i) => body(`${i + 1}. ${r}`, 8.8));

  title("6. Referencias e validacoes necessarias");
  body("Verificar, na versao vigente e aplicavel ao empreendimento: ABNT NBR 5410; ABNT NBR 17019; serie ABNT NBR IEC 61851; NR-10; requisitos da distribuidora local; manual e datasheet do EVSE; criterios de aterramento, DPS, protecao diferencial, seletividade e coordenacao.");
  body("O software nao substitui responsabilidade tecnica, inspecao de campo, avaliacao de risco, medicao de curto-circuito, projeto executivo ou documentacao exigida por concessionaria e orgaos competentes.", 8.8);

  footer();
  const filename = `relatorio-${safeFileName(data.project.projectName)}.pdf`;
  const blob = doc.output("blob");
  downloadBlob(blob, filename);
  return filename;
}

function chartSvg(data: ReportData) {
  const width = 900;
  const height = 320;
  const pad = 48;
  const maxData = Math.max(1, ...data.simulation.totalUnmanagedKw, ...data.simulation.totalManagedKw, data.evInputs.demandLimitKw);
  const maxY = Math.max(10, Math.ceil(maxData * 1.12 / 10) * 10);
  const x = (i: number, n: number) => pad + (i / Math.max(1, n - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / maxY) * (height - pad * 2);
  const pts = (values: number[]) => values.map((v, i) => `${x(i, values.length).toFixed(1)},${y(Number.isFinite(v) ? v : 0).toFixed(1)}`).join(" ");
  const grid = Array.from({ length: 6 }, (_, i) => {
    const value = (maxY / 5) * i;
    const yy = y(value);
    return `<line x1="${pad}" y1="${yy}" x2="${width - pad}" y2="${yy}" stroke="#dbe6eb" stroke-width="1"/><text x="${pad - 10}" y="${yy + 4}" text-anchor="end" font-size="12" fill="#647985">${Math.round(value)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva de carga"><rect width="100%" height="100%" rx="18" fill="#f7fafb"/>${grid}<polyline fill="none" stroke="#2689d2" stroke-width="3" points="${pts(data.simulation.baseKw)}"/><polyline fill="none" stroke="#eb8236" stroke-width="3" points="${pts(data.simulation.totalUnmanagedKw)}"/><polyline fill="none" stroke="#15c89a" stroke-width="3" points="${pts(data.simulation.totalManagedKw)}"/><polyline fill="none" stroke="#da4353" stroke-width="2" stroke-dasharray="8 7" points="${pts(data.simulation.demandLimitKw)}"/><text x="${width/2}" y="${height-10}" text-anchor="middle" font-size="12" fill="#647985">Hora do dia</text></svg>`;
}

export function openPrintableTechnicalReport(data: ReportData) {
  if (typeof window === "undefined") throw new Error("O relatório imprimível deve ser aberto no navegador.");
  const win = window.open("", "_blank");
  if (!win) throw new Error("O navegador bloqueou a nova aba. Libere pop-ups para este site e tente novamente.");
  try { win.opener = null; } catch {}

  const okDemand = data.simulation.managedExceededSlots === 0;
  const okIcu = data.electrical.chargerCircuit.icuOk && data.electrical.evFeeder.icuOk;
  const projectLocation = [data.project.address, data.project.city, data.project.state].filter(Boolean).join(" - ") || "Não informado";
  const recommendations = [
    ...data.curve.notes,
    ...data.electrical.generalNotes,
    ...(data.simulation.unmetEnergyKwh > 0.1 ? ["A energia diária solicitada pelos veículos não foi totalmente atendida. Rever janela de recarga, potência disponível, simultaneidade ou número de pontos."] : []),
    ...(data.simulation.managedExceededSlots > 0 ? ["Mesmo com gerenciamento, há intervalos acima do limite de demanda. Revisar potência disponível e infraestrutura."] : []),
    ...(data.curve.source === "estimated" ? ["Executar campanha de medição representativa antes do projeto executivo."] : [])
  ];

  const circuitRows = [data.electrical.chargerCircuit, data.electrical.evFeeder].map((c) => `<tr><td>${esc(c.label)}</td><td>${fmt(c.designCurrentA)} A</td><td>${c.breakerA} A</td><td>${fmt(c.conductorMm2, c.conductorMm2 % 1 ? 1 : 0)} mm²</td><td>${fmt(c.correctedAmpacityA)} A</td><td>${fmt(c.voltageDropPercent, 2)}%</td><td>${fmt(c.peMm2, c.peMm2 % 1 ? 1 : 0)} mm²</td></tr>`).join("");

  win.document.open();
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório técnico - ${esc(data.project.projectName)}</title><style>
  :root{--navy:#071a2a;--green:#15c89a;--blue:#2689d2;--orange:#eb8236;--red:#da4353;--gray:#647985;--line:#dbe6eb;--paper:#fff;--bg:#edf3f6}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:#142836;font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;z-index:9;display:flex;gap:10px;justify-content:flex-end;padding:12px 20px;background:#071a2a}.toolbar button{border:0;border-radius:9px;padding:10px 16px;font-weight:700;cursor:pointer}.toolbar .print{background:var(--green);color:#031b17}.toolbar .close{background:#243c4c;color:white}.report{max-width:980px;margin:24px auto;background:white;box-shadow:0 12px 34px #0b223524;border-radius:18px;overflow:hidden}.cover{min-height:650px;background:linear-gradient(145deg,#071a2a,#0b2d40);color:white;padding:66px 64px;border-left:10px solid var(--green);display:flex;flex-direction:column}.cover .kicker{color:var(--green);font-weight:800;letter-spacing:.12em}.cover h1{font-size:40px;line-height:1.06;margin:18px 0 10px}.cover h2{font-size:20px;color:#a8c3d0;margin:0 0 50px}.cover dl{display:grid;grid-template-columns:180px 1fr;gap:12px 24px;border-top:1px solid #315064;padding-top:26px}.cover dt{color:#8fa9b8;text-transform:uppercase;font-size:12px}.cover dd{margin:0;font-weight:700}.cover .legal{margin-top:auto;color:#9db3bf;font-size:12px;line-height:1.5}.page{padding:46px 64px}.page h2{font-size:24px;margin:0 0 24px;padding-bottom:8px;border-bottom:3px solid var(--green)}.page h3{margin-top:26px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card{border:1px solid var(--line);border-radius:12px;padding:16px;background:#fbfdfe}.card small{color:var(--gray);display:block}.card strong{font-size:22px;display:block;margin-top:6px}.status-ok{color:#0d8d6e}.status-bad{color:#c53849}.kv{display:grid;grid-template-columns:240px 1fr;border-bottom:1px solid #edf2f4;padding:9px 0}.kv span{color:var(--gray)}.kv b{font-weight:700}table{width:100%;border-collapse:collapse;margin:15px 0 24px;font-size:13px}th{background:var(--navy);color:white;text-align:left}th,td{padding:10px;border:1px solid var(--line)}.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;margin:10px 0 4px}.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px}.notes li{margin:8px 0;line-height:1.45}.warn{border-left:5px solid var(--orange);background:#fff7ef;padding:14px 16px;border-radius:8px}.refs{font-size:12px;line-height:1.55;color:#405766}.footer{padding:22px 64px 42px;color:var(--gray);font-size:11px}.chart{margin:16px 0 28px}.chart svg{width:100%;height:auto;display:block}@media(max-width:760px){.report{margin:0;border-radius:0}.cover,.page{padding:34px 22px}.cover h1{font-size:29px}.cover dl{grid-template-columns:1fr}.summary{grid-template-columns:1fr 1fr}.kv{grid-template-columns:1fr}.toolbar{justify-content:center}}@page{size:A4;margin:12mm}@media print{body{background:white}.toolbar{display:none}.report{box-shadow:none;margin:0;max-width:none;border-radius:0}.cover{min-height:270mm;page-break-after:always}.page{padding:0}.page+.page{page-break-before:always}.card,table,.chart,.warn{break-inside:avoid}.footer{padding:20px 0}}
  </style></head><body><div class="toolbar"><button class="print" onclick="window.print()">Salvar / Imprimir PDF</button><button class="close" onclick="window.close()">Fechar</button></div><main class="report">
  <section class="cover"><div class="kicker">EV CONDO DESIGNER V2.1</div><h1>PROJETO DE INFRAESTRUTURA PARA RECARGA DE VEÍCULOS ELÉTRICOS</h1><h2>Curva de carga • Simulação EV • Dimensionamento elétrico</h2><dl><dt>Projeto</dt><dd>${esc(data.project.projectName || "Não informado")}</dd><dt>Cliente</dt><dd>${esc(data.project.clientName || "Não informado")}</dd><dt>Local</dt><dd>${esc(projectLocation)}</dd><dt>Responsável técnico</dt><dd>${esc(data.project.responsible || "Não informado")}</dd><dt>Registro</dt><dd>${esc(data.project.registration || "Não informado")}</dd><dt>Data</dt><dd>${new Date().toLocaleDateString("pt-BR")}</dd></dl><p class="legal">Documento gerado automaticamente. Os resultados dependem dos dados informados e devem ser validados pelo responsável técnico antes da execução.</p></section>
  <section class="page"><h2>1. Resumo executivo</h2><div class="summary"><div class="card"><small>Curva</small><strong>${esc(data.curve.confidence)}</strong><span>${esc(data.curve.sourceLabel)}</span></div><div class="card"><small>Pico gerenciado</small><strong>${fmt(data.simulation.managedPeakKw)} kW</strong><span class="${okDemand ? "status-ok" : "status-bad"}">${okDemand ? "Dentro do limite" : "Revisar"}</span></div><div class="card"><small>Energia EV atendida</small><strong>${fmt(data.simulation.deliveryPercent)}%</strong><span>${fmt(data.simulation.deliveredEnergyKwh)} kWh/dia</span></div><div class="card"><small>Icu x Icc</small><strong class="${okIcu ? "status-ok" : "status-bad"}">${okIcu ? "Adequado" : "Revisar"}</strong><span>Icc ${fmt(data.electricalInputs.availableShortCircuitKa)} kA</span></div></div><div class="kv"><span>Objetivo</span><b>Analisar demanda, inserção de EVs e pré-dimensionar a infraestrutura elétrica de recarga.</b></div><div class="kv"><span>Projeto</span><b>${esc(data.project.projectName || "Não informado")}</b></div><div class="kv"><span>Cliente</span><b>${esc(data.project.clientName || "Não informado")}</b></div><div class="kv"><span>Local</span><b>${esc(projectLocation)}</b></div></section>
  <section class="page"><h2>2. Curva de carga e demanda</h2><div class="kv"><span>Origem</span><b>${esc(data.curve.sourceLabel)}</b></div><div class="kv"><span>Registros</span><b>${data.curve.pointsRead}</b></div><div class="kv"><span>Dias detectados</span><b>${data.curve.measuredDays}</b></div><div class="kv"><span>Intervalo</span><b>${data.curve.intervalMinutes} min</b></div><table><thead><tr><th>Indicador</th><th>Resultado</th></tr></thead><tbody><tr><td>Demanda máxima</td><td>${fmt(data.curveMetrics.peakKw)} kW</td></tr><tr><td>Demanda média</td><td>${fmt(data.curveMetrics.meanKw)} kW</td></tr><tr><td>Demanda mínima</td><td>${fmt(data.curveMetrics.minKw)} kW</td></tr><tr><td>Energia diária equivalente</td><td>${fmt(data.curveMetrics.dailyEnergyKwh)} kWh/dia</td></tr><tr><td>Fator de carga</td><td>${fmt(data.curveMetrics.loadFactor * 100)}%</td></tr></tbody></table><div class="legend"><span><i class="dot" style="background:#2689d2"></i>Carga base</span><span><i class="dot" style="background:#eb8236"></i>Sem gerenciamento</span><span><i class="dot" style="background:#15c89a"></i>Com gerenciamento</span><span><i class="dot" style="background:#da4353"></i>Limite</span></div><div class="chart">${chartSvg(data)}</div></section>
  <section class="page"><h2>3. Simulação dos carregadores</h2><div class="kv"><span>Quantidade</span><b>${data.evInputs.chargerCount} carregadores</b></div><div class="kv"><span>Potência unitária</span><b>${fmt(data.evInputs.chargerPowerKw)} kW</b></div><div class="kv"><span>Potência instalada EV</span><b>${fmt(data.evInputs.chargerCount * data.evInputs.chargerPowerKw)} kW</b></div><div class="kv"><span>Fator de simultaneidade</span><b>${fmt(data.evInputs.simultaneity,2)}</b></div><div class="kv"><span>Limite de demanda</span><b>${fmt(data.evInputs.demandLimitKw)} kW</b></div><div class="kv"><span>Load balancing</span><b>${data.evInputs.loadBalancing ? "Ativado" : "Desativado"}</b></div><table><thead><tr><th>Resultado</th><th>Valor</th></tr></thead><tbody><tr><td>Pico sem gerenciamento</td><td>${fmt(data.simulation.unmanagedPeakKw)} kW</td></tr><tr><td>Pico com gerenciamento</td><td>${fmt(data.simulation.managedPeakKw)} kW</td></tr><tr><td>Redução do pico</td><td>${fmt(data.simulation.peakReductionPercent)}%</td></tr><tr><td>Energia solicitada</td><td>${fmt(data.simulation.requestedEnergyKwh)} kWh/dia</td></tr><tr><td>Energia atendida</td><td>${fmt(data.simulation.deliveredEnergyKwh)} kWh/dia</td></tr><tr><td>Energia não atendida</td><td>${fmt(data.simulation.unmetEnergyKwh)} kWh/dia</td></tr></tbody></table></section>
  <section class="page"><h2>4. Pré-dimensionamento elétrico</h2><div class="warn"><b>Critério de uso:</b> este módulo fornece pré-dimensionamento. A seleção final depende do método real de instalação, condições ambientais, agrupamento, curto-circuito, seletividade, documentação do fabricante e normas vigentes.</div><table><thead><tr><th>Circuito</th><th>Ib</th><th>Disj.</th><th>Cabo</th><th>Iz corr.</th><th>ΔV</th><th>PE</th></tr></thead><tbody>${circuitRows}</tbody></table><div class="kv"><span>Proteção diferencial</span><b>${esc(data.electrical.chargerCircuit.rcdRecommendation)}</b></div><div class="kv"><span>Icc disponível</span><b>${fmt(data.electricalInputs.availableShortCircuitKa)} kA</b></div><div class="kv"><span>Icu informado</span><b>${fmt(data.electricalInputs.breakerIcuKa)} kA</b></div><div class="kv"><span>Verificação Icu</span><b class="${okIcu ? "status-ok" : "status-bad"}">${okIcu ? "Adequada para a Icc informada" : "REVISAR — Icu inferior à Icc informada"}</b></div><h3>Recomendações técnicas</h3><ol class="notes">${recommendations.map((r) => `<li>${esc(r)}</li>`).join("")}</ol></section>
  <section class="page"><h2>5. Referências e validações</h2><p class="refs">Verificar, na versão vigente e aplicável ao empreendimento: ABNT NBR 5410; ABNT NBR 17019; série ABNT NBR IEC 61851; NR-10; requisitos da distribuidora local; manual e datasheet do EVSE; critérios de aterramento, DPS, proteção diferencial, seletividade e coordenação.</p><p class="refs"><b>Ressalva:</b> o software não substitui responsabilidade técnica, inspeção de campo, avaliação de risco, medição de curto-circuito, projeto executivo ou documentação exigida por concessionária e órgãos competentes.</p></section><footer class="footer">EV Condo Designer V2.1 • Relatório gerado em ${new Date().toLocaleString("pt-BR")}</footer></main></body></html>`);
  win.document.close();
  win.focus();
  return true;
}
