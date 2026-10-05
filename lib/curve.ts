import type { CurveMetrics, CurveProfile } from "./types";

const DEFAULT_SHAPE = [
  0.45, 0.42, 0.4, 0.39, 0.4, 0.46, 0.58, 0.69,
  0.79, 0.75, 0.7, 0.67, 0.68, 0.72, 0.78, 0.86,
  0.96, 1.05, 1.1, 1.01, 0.9, 0.77, 0.64, 0.53
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function estimatedProfile(apartments: number, diversifiedUnitKw: number, commonPeakKw: number): CurveProfile {
  const nominalPeak = Math.max(1, apartments * diversifiedUnitKw + commonPeakKw);
  const scale = nominalPeak / Math.max(...DEFAULT_SHAPE);
  return {
    hourlyKw: DEFAULT_SHAPE.map((v) => +(v * scale).toFixed(3)),
    source: "estimated",
    sourceLabel: "Curva estimada pelo perfil residencial interno",
    pointsRead: 24,
    measuredDays: 0,
    intervalMinutes: 60,
    confidence: "Preliminar",
    notes: [
      "Curva estimada para estudo preliminar; substitua por medição real para projeto executivo.",
      "O perfil representa comportamento residencial típico e não substitui campanha de medição."
    ]
  };
}

export function manualProfile(values: number[]): CurveProfile | null {
  if (values.length !== 24 || values.some((v) => !Number.isFinite(v) || v < 0)) return null;
  return {
    hourlyKw: values,
    source: "manual",
    sourceLabel: "24 valores horários informados manualmente",
    pointsRead: 24,
    measuredDays: 1,
    intervalMinutes: 60,
    confidence: "Moderada",
    notes: ["Perfil manual com 24 pontos; valide se o dia representa condição crítica da instalação."]
  };
}

function delimiterFor(line: string) {
  const candidates = [";", ",", "\t"];
  return candidates.sort((a, b) => line.split(b).length - line.split(a).length)[0];
}

function numberBR(raw: string) {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned) return NaN;
  if (cleaned.includes(",") && !cleaned.includes(".")) return Number(cleaned.replace(",", "."));
  if (cleaned.includes(",") && cleaned.includes(".")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(cleaned);
}

function parseHour(raw: string): number | null {
  const v = raw.trim();
  if (/^\d{1,2}(:\d{2})?$/.test(v)) {
    const h = Number(v.split(":")[0]);
    return h >= 0 && h <= 23 ? h : null;
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.getHours();
  return null;
}

function confidence(days: number, points: number) : CurveProfile["confidence"] {
  if (days >= 30 && points >= 720) return "Excelente";
  if (days >= 7 && points >= 168) return "Boa";
  if (days >= 1 && points >= 24) return "Moderada";
  return "Preliminar";
}

export function parseMeasuredCsv(text: string): CurveProfile | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const delimiter = delimiterFor(lines[0]);
  const rows = lines.map((l) => l.split(delimiter).map((c) => c.trim()));

  // Caso simples: 24 números em uma única coluna ou linha.
  const flatNumbers = rows.flat().map(numberBR).filter(Number.isFinite);
  if (flatNumbers.length === 24 && rows.length <= 25) {
    return {
      hourlyKw: flatNumbers,
      source: "csv",
      sourceLabel: "CSV com 24 pontos horários",
      pointsRead: 24,
      measuredDays: 1,
      intervalMinutes: 60,
      confidence: "Moderada",
      notes: ["CSV reconhecido como uma curva diária de 24 pontos."]
    };
  }

  const header = rows[0].map((x) => x.toLowerCase());
  const demandCandidates = ["demanda", "demanda_kw", "kw", "potencia", "potência", "power", "demand"];
  const timeCandidates = ["hora", "timestamp", "datahora", "data_hora", "datetime", "date", "time"];
  let demandIdx = header.findIndex((h) => demandCandidates.some((c) => h.includes(c)));
  let timeIdx = header.findIndex((h) => timeCandidates.some((c) => h.includes(c)));
  const hasHeader = demandIdx >= 0 || timeIdx >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (demandIdx < 0) demandIdx = Math.min(1, rows[0].length - 1);
  if (timeIdx < 0) timeIdx = 0;

  const hourBuckets: number[][] = Array.from({ length: 24 }, () => []);
  const dates = new Set<string>();
  const timestamps: number[] = [];
  let read = 0;

  for (const row of dataRows) {
    if (row.length <= Math.max(timeIdx, demandIdx)) continue;
    const kw = numberBR(row[demandIdx]);
    const h = parseHour(row[timeIdx]);
    if (!Number.isFinite(kw) || kw < 0 || h === null) continue;
    hourBuckets[h].push(kw);
    read++;
    const d = new Date(row[timeIdx]);
    if (!Number.isNaN(d.getTime())) {
      dates.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
      timestamps.push(d.getTime());
    }
  }
  if (read < 12) return null;

  const hourly = hourBuckets.map((bucket) => bucket.length ? bucket.reduce((a, b) => a + b, 0) / bucket.length : NaN);
  // Preenche lacunas por interpolação simples.
  for (let h = 0; h < 24; h++) {
    if (Number.isFinite(hourly[h])) continue;
    let before = h - 1;
    while (before >= 0 && !Number.isFinite(hourly[before])) before--;
    let after = h + 1;
    while (after < 24 && !Number.isFinite(hourly[after])) after++;
    if (before >= 0 && after < 24) hourly[h] = (hourly[before] + hourly[after]) / 2;
    else if (before >= 0) hourly[h] = hourly[before];
    else if (after < 24) hourly[h] = hourly[after];
    else hourly[h] = 0;
  }

  timestamps.sort((a, b) => a - b);
  const diffs = timestamps.slice(1).map((t, i) => (t - timestamps[i]) / 60000).filter((v) => v > 0 && v < 24 * 60);
  const interval = diffs.length ? Math.round(diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)]) : 60;
  const days = dates.size || Math.max(1, Math.round(read / 24));

  return {
    hourlyKw: hourly.map((v) => +v.toFixed(3)),
    source: "csv",
    sourceLabel: `CSV medido • ${read} registros`,
    pointsRead: read,
    measuredDays: days,
    intervalMinutes: clamp(interval, 1, 1440),
    confidence: confidence(days, read),
    notes: [
      `Perfil horário calculado pela média dos registros de cada hora (${days} dia(s) detectado(s)).`,
      "Para projeto executivo, confirme se o período de medição representa a condição de maior solicitação da instalação."
    ]
  };
}

export function parseManualText(text: string): number[] | null {
  const values = text.split(/[;\n\t ]+/).map(numberBR).filter(Number.isFinite);
  return values.length === 24 ? values : null;
}

export function curveMetrics(hourlyKw: number[]): CurveMetrics {
  const values = hourlyKw.length === 24 ? hourlyKw : Array.from({ length: 24 }, (_, h) => hourlyKw[h] ?? 0);
  const peakKw = Math.max(...values);
  const minKw = Math.min(...values);
  const meanKw = values.reduce((a, b) => a + b, 0) / 24;
  const dailyEnergyKwh = values.reduce((a, b) => a + b, 0);
  return {
    peakKw: +peakKw.toFixed(2),
    minKw: +minKw.toFixed(2),
    meanKw: +meanKw.toFixed(2),
    dailyEnergyKwh: +dailyEnergyKwh.toFixed(2),
    loadFactor: peakKw > 0 ? +(meanKw / peakKw).toFixed(3) : 0,
    peakHour: values.indexOf(peakKw)
  };
}

export function hourlyToQuarter(hourly: number[]) {
  const result: number[] = [];
  for (let i = 0; i < 96; i++) {
    const h = Math.floor(i / 4);
    const next = (h + 1) % 24;
    const fraction = (i % 4) / 4;
    result.push(hourly[h] * (1 - fraction) + hourly[next] * fraction);
  }
  return result;
}
