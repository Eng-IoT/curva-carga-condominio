export type ProjectInfo = {
  projectName: string;
  clientName: string;
  address: string;
  city: string;
  state: string;
  responsible: string;
  registration: string;
};

export type CurveProfile = {
  hourlyKw: number[];
  source: "estimated" | "manual" | "csv";
  sourceLabel: string;
  pointsRead: number;
  measuredDays: number;
  intervalMinutes: number;
  confidence: "Preliminar" | "Moderada" | "Boa" | "Excelente";
  notes: string[];
};

export type CurveMetrics = {
  peakKw: number;
  minKw: number;
  meanKw: number;
  dailyEnergyKwh: number;
  loadFactor: number;
  peakHour: number;
};

export type EvInputs = {
  chargerCount: number;
  chargerPowerKw: number;
  energyPerVehicleKwh: number;
  simultaneity: number;
  arrivalStart: number;
  arrivalEnd: number;
  departureHour: number;
  demandLimitKw: number;
  reserveMargin: number;
  peakStart: number;
  peakEnd: number;
  loadBalancing: boolean;
  offPeakScheduling: boolean;
};

export type EvSimulationResult = {
  quarterHours: number[];
  baseKw: number[];
  evUnmanagedKw: number[];
  totalUnmanagedKw: number[];
  evManagedKw: number[];
  totalManagedKw: number[];
  demandLimitKw: number[];
  unmanagedPeakKw: number;
  managedPeakKw: number;
  criticalIndex: number;
  requestedEnergyKwh: number;
  deliveredEnergyKwh: number;
  unmetEnergyKwh: number;
  deliveryPercent: number;
  unmanagedExceededSlots: number;
  managedExceededSlots: number;
  peakReductionPercent: number;
  maxManagedEvKw: number;
};

export type SupplyType = "single" | "three";
export type ConductorMaterial = "copper" | "aluminum";

export type ElectricalInputs = {
  chargerSupplyType: SupplyType;
  chargerVoltageV: number;
  feederSupplyType: SupplyType;
  feederVoltageV: number;
  powerFactor: number;
  efficiency: number;
  chargerCircuitLengthM: number;
  feederLengthM: number;
  conductorMaterial: ConductorMaterial;
  temperatureFactor: number;
  groupingFactor: number;
  voltageDropLimitPercent: number;
  availableShortCircuitKa: number;
  breakerIcuKa: number;
  evseHas6mADCDetection: boolean;
};

export type SizedCircuit = {
  label: string;
  powerKw: number;
  designCurrentA: number;
  breakerA: number;
  conductorMm2: number;
  correctedAmpacityA: number;
  voltageDropPercent: number;
  peMm2: number;
  icuOk: boolean;
  rcdRecommendation: string;
  notes: string[];
};

export type ElectricalResult = {
  chargerCircuit: SizedCircuit;
  evFeeder: SizedCircuit;
  maxEvPowerForSizingKw: number;
  diversityApplied: boolean;
  generalNotes: string[];
};
