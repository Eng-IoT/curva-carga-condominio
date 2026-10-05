import { jsPDF } from "jspdf";
import type { CurveMetrics, CurveProfile, ElectricalInputs, ElectricalResult, EvInputs, EvSimulationResult, ProjectInfo } from "./types";

type ReportData = {
  project: ProjectInfo;
  curve: CurveProfile;
  curveMetrics: CurveMetrics;
  evInputs: EvInputs;
  simulation: EvSimulationResult;
  electricalInputs: ElectricalInputs;
  electrical: ElectricalResult;
};

const fmt = (v: number, digits = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function generateTechnicalPdf(data: ReportData) {
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
    gray: [85, 101, 111] as [number, number, number],
    light: [239, 245, 248] as [number, number, number]
  };

  function footer() {
    doc.setDrawColor(220);
    doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
    doc.setFontSize(7.5);
    doc.setTextColor(...color.gray);
    doc.text("Curva de Carga para Condomínios V2 • Relatório de apoio ao projeto", margin, pageH - 8);
    doc.text(`Página ${doc.getNumberOfPages()}`, pageW - margin, pageH - 8, { align: "right" });
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
    const lines = doc.splitTextToSize(text, contentW);
    ensure(lines.length * 5 + 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.7 + 2;
  }

  function kv(label: string, value: string, x = margin, valueX = margin + 58, width = contentW) {
    ensure(6);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...color.gray);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color.navy);
    doc.text(doc.splitTextToSize(value, width - (valueX - x)), valueX, y);
    y += 5.3;
  }

  function statusBox(label: string, value: string, ok: boolean) {
    ensure(17);
    doc.setFillColor(ok ? 232 : 255, ok ? 249 : 238, ok ? 244 : 240);
    doc.setDrawColor(...(ok ? color.green : color.red));
    doc.roundedRect(margin, y, contentW, 13, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...color.gray);
    doc.text(label, margin + 4, y + 5);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(ok ? color.green : color.red));
    doc.text(value, margin + 4, y + 10);
    y += 18;
  }

  function row(cells: string[], widths: number[], header = false) {
    const rowH = 7;
    ensure(rowH + 2);
    let x = margin;
    cells.forEach((cell, i) => {
      doc.setFillColor(...(header ? color.navy : [250, 252, 253]));
      doc.setDrawColor(220, 228, 233);
      doc.rect(x, y, widths[i], rowH, "FD");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", header ? "bold" : "normal");
      doc.setTextColor(...(header ? [255, 255, 255] : color.navy));
      const text = doc.splitTextToSize(cell, widths[i] - 3);
      doc.text(text.slice(0, 2), x + 1.5, y + 4.6);
      x += widths[i];
    });
    y += rowH;
  }

  function drawCurve() {
    ensure(80);
    const x0 = margin + 8;
    const y0 = y + 4;
    const w = contentW - 16;
    const h = 57;
    const maxY = Math.ceil(Math.max(
      ...data.simulation.totalUnmanagedKw,
      ...data.simulation.totalManagedKw,
      data.evInputs.demandLimitKw
    ) * 1.12 / 10) * 10;
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
      doc.setDrawColor(...rgb);
      doc.setLineWidth(dashed ? 0.45 : 0.7);
      if (dashed) doc.setLineDashPattern([2, 1.5], 0); else doc.setLineDashPattern([], 0);
      for (let i = 1; i < values.length; i++) {
        const xa = x0 + ((i - 1) / (values.length - 1)) * w;
        const xb = x0 + (i / (values.length - 1)) * w;
        const ya = y0 + h - (values[i - 1] / maxY) * h;
        const yb = y0 + h - (values[i] / maxY) * h;
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
  doc.rect(0, 0, pageW, 297, "F");
  doc.setFillColor(...color.green);
  doc.rect(0, 0, 7, 297, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("PROJETO DE INFRAESTRUTURA", 20, 48);
  doc.text("PARA RECARGA DE VEÍCULOS ELÉTRICOS", 20, 61);
  doc.setTextColor(...color.green);
  doc.setFontSize(17);
  doc.text("Curva de carga • Simulação • Dimensionamento", 20, 76);
  doc.setTextColor(190, 207, 217);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório técnico de apoio ao projeto — V2", 20, 85);
  doc.setDrawColor(47, 75, 92);
  doc.line(20, 104, 190, 104);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  const cover = [
    ["Projeto", data.project.projectName || "Não informado"],
    ["Cliente", data.project.clientName || "Não informado"],
    ["Local", [data.project.address, data.project.city, data.project.state].filter(Boolean).join(" — ") || "Não informado"],
    ["Responsável técnico", data.project.responsible || "Não informado"],
    ["Registro", data.project.registration || "Não informado"],
    ["Data", new Date().toLocaleDateString("pt-BR")]
  ];
  let cy = 119;
  cover.forEach(([l, v]) => {
    doc.setTextColor(140, 163, 176); doc.setFontSize(8); doc.text(l.toUpperCase(), 20, cy);
    doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(doc.splitTextToSize(v, 150), 20, cy + 6);
    doc.setFont("helvetica", "normal"); cy += 20;
  });
  doc.setTextColor(164, 184, 196);
  doc.setFontSize(7.5);
  doc.text("Documento gerado automaticamente. Os resultados dependem dos dados informados e devem ser validados pelo responsável técnico antes da execução.", 20, 276, { maxWidth: 168 });

  doc.addPage(); y = 18;
  title("1. Identificação e objetivo");
  body("Este relatório consolida a análise da curva de carga da edificação, a simulação da inserção de carregadores de veículos elétricos, o pré-dimensionamento dos circuitos elétricos e recomendações para o desenvolvimento do projeto executivo.");
  kv("Projeto", data.project.projectName || "Não informado");
  kv("Cliente", data.project.clientName || "Não informado");
  kv("Endereço", [data.project.address, data.project.city, data.project.state].filter(Boolean).join(" — ") || "Não informado");
  kv("Responsável", data.project.responsible || "Não informado");
  kv("Registro", data.project.registration || "Não informado");

  title("2. Curva de carga");
  kv("Origem dos dados", data.curve.sourceLabel);
  kv("Registros lidos", `${data.curve.pointsRead}`);
  kv("Dias detectados", `${data.curve.measuredDays}`);
  kv("Intervalo estimado", `${data.curve.intervalMinutes} min`);
  kv("Índice qualitativo", data.curve.confidence);
  row(["Indicador", "Resultado"], [80, 98], true);
  row(["Demanda máxima", `${fmt(data.curveMetrics.peakKw)} kW`], [80, 98]);
  row(["Demanda média", `${fmt(data.curveMetrics.meanKw)} kW`], [80, 98]);
  row(["Demanda mínima", `${fmt(data.curveMetrics.minKw)} kW`], [80, 98]);
  row(["Energia diária equivalente", `${fmt(data.curveMetrics.dailyEnergyKwh)} kWh/dia`], [80, 98]);
  row(["Fator de carga", `${fmt(data.curveMetrics.loadFactor * 100)} %`], [80, 98]);
  drawCurve();

  title("3. Simulação da infraestrutura de recarga");
  kv("Quantidade de carregadores", `${data.evInputs.chargerCount}`);
  kv("Potência unitária", `${fmt(data.evInputs.chargerPowerKw)} kW`);
  kv("Energia por veículo/dia", `${fmt(data.evInputs.energyPerVehicleKwh)} kWh`);
  kv("Fator de simultaneidade", fmt(data.evInputs.simultaneity, 2));
  kv("Limite de demanda considerado", `${fmt(data.evInputs.demandLimitKw)} kW`);
  kv("Margem operacional", `${fmt(data.evInputs.reserveMargin * 100)} %`);
  kv("Load balancing", data.evInputs.loadBalancing ? "Ativado" : "Desativado");
  kv("Recarga fora de ponta", data.evInputs.offPeakScheduling ? "Ativada" : "Desativada");
  statusBox("STATUS DA SIMULAÇÃO", data.simulation.managedExceededSlots === 0 ? "DEMANDA GERENCIADA DENTRO DO LIMITE" : "HÁ ULTRAPASSAGEM NO CENÁRIO GERENCIADO", data.simulation.managedExceededSlots === 0);
  row(["Resultado", "Valor"], [90, 88], true);
  row(["Pico sem gerenciamento", `${fmt(data.simulation.unmanagedPeakKw)} kW`], [90, 88]);
  row(["Pico com gerenciamento", `${fmt(data.simulation.managedPeakKw)} kW`], [90, 88]);
  row(["Redução do pico", `${fmt(data.simulation.peakReductionPercent)} %`], [90, 88]);
  row(["Energia EV solicitada", `${fmt(data.simulation.requestedEnergyKwh)} kWh/dia`], [90, 88]);
  row(["Energia EV atendida", `${fmt(data.simulation.deliveredEnergyKwh)} kWh/dia`], [90, 88]);
  row(["Energia não atendida", `${fmt(data.simulation.unmetEnergyKwh)} kWh/dia`], [90, 88]);

  title("4. Pré-dimensionamento elétrico");
  body("O pré-dimensionamento abaixo é calculado com base nos dados informados e em uma tabela técnica interna conservadora. A seleção final deve ser confirmada pela ABNT NBR 5410, ABNT NBR 17019, documentação do EVSE, método real de instalação, temperatura, agrupamento, curto-circuito e requisitos da distribuidora.");
  kv("Circuito EVSE", `${data.electricalInputs.chargerSupplyType === "three" ? "Trifásico" : "Monofásico/bifásico"} — ${fmt(data.electricalInputs.chargerVoltageV, 0)} V`);
  kv("Alimentador QD-EV", `${data.electricalInputs.feederSupplyType === "three" ? "Trifásico" : "Monofásico/bifásico"} — ${fmt(data.electricalInputs.feederVoltageV, 0)} V`);
  kv("Fator de potência", fmt(data.electricalInputs.powerFactor, 2));
  kv("Rendimento", fmt(data.electricalInputs.efficiency, 2));
  kv("Material", data.electricalInputs.conductorMaterial === "copper" ? "Cobre" : "Alumínio");
  kv("Icc disponível informada", `${fmt(data.electricalInputs.availableShortCircuitKa)} kA`);
  kv("Icu do disjuntor informado", `${fmt(data.electricalInputs.breakerIcuKa)} kA`);

  row(["Circuito", "Ib", "Disj.", "Cabo", "Iz corr.", "ΔV", "PE"], [48, 21, 21, 21, 24, 21, 22], true);
  [data.electrical.chargerCircuit, data.electrical.evFeeder].forEach((c) => {
    row([
      c.label,
      `${fmt(c.designCurrentA)} A`,
      `${c.breakerA} A`,
      `${fmt(c.conductorMm2, c.conductorMm2 % 1 ? 1 : 0)} mm²`,
      `${fmt(c.correctedAmpacityA)} A`,
      `${fmt(c.voltageDropPercent, 2)} %`,
      `${fmt(c.peMm2, c.peMm2 % 1 ? 1 : 0)} mm²`
    ], [48, 21, 21, 21, 24, 21, 22]);
  });
  y += 4;
  kv("Proteção diferencial", data.electrical.chargerCircuit.rcdRecommendation, margin, margin + 48, contentW);
  kv("Verificação Icu", data.electrical.chargerCircuit.icuOk && data.electrical.evFeeder.icuOk ? "Adequada para a Icc informada" : "REVISAR — Icu inferior à Icc informada");

  title("5. Recomendações técnicas");
  const recommendations = [
    ...data.curve.notes,
    ...data.electrical.generalNotes,
    ...(data.simulation.unmetEnergyKwh > 0.1 ? ["A energia diária solicitada pelos veículos não foi totalmente atendida no período configurado. Rever janela de recarga, potência disponível, simultaneidade ou número de pontos."] : []),
    ...(data.simulation.managedExceededSlots > 0 ? ["Mesmo com gerenciamento, há intervalos acima do limite de demanda. Reduzir o limite de potência EV ou revisar a infraestrutura de fornecimento."] : []),
    ...(data.curve.source === "estimated" ? ["Executar campanha de medição antes do projeto executivo para substituir a curva estimada por dados reais."] : [])
  ];
  recommendations.forEach((r, i) => body(`${i + 1}. ${r}`, 8.8));

  title("6. Referências e validações necessárias");
  body("Verificar, na versão vigente e aplicável ao empreendimento: ABNT NBR 5410 — instalações elétricas de baixa tensão; ABNT NBR 17019 — alimentação de veículos elétricos; série ABNT NBR IEC 61851 — sistema de carregamento condutivo; NR-10; requisitos da distribuidora local; manual e datasheet do EVSE; critérios de aterramento, DPS, proteção diferencial, seletividade e coordenação.");
  body("O software não substitui responsabilidade técnica, inspeção de campo, avaliação de risco, medição de curto-circuito, projeto executivo ou documentação exigida por concessionária e órgãos competentes.", 8.8);

  footer();
  const safeName = (data.project.projectName || "projeto-ev").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`relatorio-${safeName || "projeto-ev"}.pdf`);
}
