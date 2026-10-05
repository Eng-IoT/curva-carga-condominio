import type { ElectricalInputs, ElectricalResult, SizedCircuit, SupplyType } from "./types";

const STANDARD_BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];
const SECTIONS = [2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

// Referência interna conservadora para pré-dimensionamento. O relatório exige validação
// pela ABNT NBR 5410, método real de instalação e dados do fabricante.
const COPPER_2 = [21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239, 272, 310, 364];
const COPPER_3 = [18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188, 216, 245, 286];
const AL_FACTOR = 0.78;

function designCurrent(powerKw: number, supplyType: SupplyType, voltageV: number, inputs: ElectricalInputs) {
  const denom = voltageV * Math.max(0.1, inputs.powerFactor) * Math.max(0.1, inputs.efficiency);
  return supplyType === "three"
    ? (powerKw * 1000) / (Math.sqrt(3) * denom)
    : (powerKw * 1000) / denom;
}

function peSection(phaseSection: number) {
  if (phaseSection <= 16) return phaseSection;
  if (phaseSection <= 35) return 16;
  return Math.max(16, phaseSection / 2);
}

function voltageDropPercent(currentA: number, lengthM: number, sectionMm2: number, supplyType: SupplyType, voltageV: number, inputs: ElectricalInputs) {
  const rho = inputs.conductorMaterial === "copper" ? 0.0175 : 0.0282;
  const multiplier = supplyType === "three" ? Math.sqrt(3) : 2;
  const dropV = multiplier * lengthM * currentA * rho / sectionMm2;
  return (dropV / voltageV) * 100;
}

function baseAmpacity(sectionIndex: number, supplyType: SupplyType, inputs: ElectricalInputs) {
  const arr = supplyType === "three" ? COPPER_3 : COPPER_2;
  const materialFactor = inputs.conductorMaterial === "copper" ? 1 : AL_FACTOR;
  return arr[sectionIndex] * materialFactor;
}

function nextBreaker(currentA: number) {
  return STANDARD_BREAKERS.find((v) => v >= currentA) ?? STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];
}

function sizeCircuit(label: string, powerKw: number, lengthM: number, supplyType: SupplyType, voltageV: number, inputs: ElectricalInputs): SizedCircuit {
  const ib = designCurrent(powerKw, supplyType, voltageV, inputs);
  const breaker = nextBreaker(ib);
  const correction = Math.max(0.1, inputs.temperatureFactor) * Math.max(0.1, inputs.groupingFactor);
  let chosen = SECTIONS[SECTIONS.length - 1];
  let iz = baseAmpacity(SECTIONS.length - 1, supplyType, inputs) * correction;
  let vd = voltageDropPercent(ib, lengthM, chosen, supplyType, voltageV, inputs);

  for (let i = 0; i < SECTIONS.length; i++) {
    const corrected = baseAmpacity(i, supplyType, inputs) * correction;
    const drop = voltageDropPercent(ib, lengthM, SECTIONS[i], supplyType, voltageV, inputs);
    if (corrected >= breaker && drop <= inputs.voltageDropLimitPercent) {
      chosen = SECTIONS[i];
      iz = corrected;
      vd = drop;
      break;
    }
  }

  const icuOk = inputs.breakerIcuKa >= inputs.availableShortCircuitKa;
  const rcdRecommendation = inputs.evseHas6mADCDetection
    ? "DR tipo A ≤ 30 mA, condicionado à detecção CC ≥ 6 mA integrada ao EVSE e à validação do fabricante/norma aplicável."
    : "Avaliar DR tipo B ≤ 30 mA ou solução equivalente prevista pelo fabricante/norma para componente CC residual.";

  const notes: string[] = [];
  if (vd > inputs.voltageDropLimitPercent) notes.push("Queda de tensão acima do limite informado: ampliar seção ou rever comprimento/arquitetura.");
  if (iz < breaker) notes.push("Capacidade de condução corrigida inferior à proteção: revisar seção e fatores de correção.");
  if (!icuOk) notes.push("Icu informado é inferior à corrente de curto-circuito disponível no ponto.");
  notes.push("Seção sugerida é pré-dimensionamento; validar método real de instalação, temperatura, agrupamento e tabela aplicável da ABNT NBR 5410/fabricante.");

  return {
    label,
    powerKw: +powerKw.toFixed(2),
    designCurrentA: +ib.toFixed(2),
    breakerA: breaker,
    conductorMm2: chosen,
    correctedAmpacityA: +iz.toFixed(1),
    voltageDropPercent: +vd.toFixed(2),
    peMm2: +peSection(chosen).toFixed(1),
    icuOk,
    rcdRecommendation,
    notes
  };
}

export function dimensionElectrical(chargerPowerKw: number, maxManagedEvKw: number, inputs: ElectricalInputs): ElectricalResult {
  const feederPower = Math.max(chargerPowerKw, maxManagedEvKw);
  const chargerCircuit = sizeCircuit("Circuito individual do EVSE", chargerPowerKw, inputs.chargerCircuitLengthM, inputs.chargerSupplyType, inputs.chargerVoltageV, inputs);
  const evFeeder = sizeCircuit("Alimentador do QD-EV", feederPower, inputs.feederLengthM, inputs.feederSupplyType, inputs.feederVoltageV, inputs);

  return {
    chargerCircuit,
    evFeeder,
    maxEvPowerForSizingKw: +feederPower.toFixed(2),
    diversityApplied: maxManagedEvKw > 0,
    generalNotes: [
      "O circuito individual e o alimentador do QD-EV podem operar em sistemas/tensões diferentes; a V2 calcula cada trecho separadamente.",
      "O alimentador do QD-EV foi pré-dimensionado pela potência máxima simultânea resultante da simulação gerenciada.",
      "Icu representa a capacidade de interrupção do dispositivo e não a corrente de curto-circuito disponível da instalação.",
      "Proteção diferencial, DPS, seccionamento, aterramento e equipotencialização devem ser confirmados conforme EVSE, esquema de aterramento e documentação do projeto.",
      "Resultados destinam-se ao apoio ao projeto e exigem validação pelo responsável técnico antes da execução."
    ]
  };
}
