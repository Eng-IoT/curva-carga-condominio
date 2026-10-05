export type SimulationInputs = {
  apartments: number;
  commonPeakKw: number;
  diversifiedUnitKw: number;
  contractedDemandKw: number;
  chargerPowerKw: number;
  chargerCount: number;
  simultaneity: number;
  reserveMargin: number;
  peakStart: number;
  peakEnd: number;
  loadBalancing: boolean;
  offPeakScheduling: boolean;
  manualBaseProfile: number[] | null;
};

export type SimulationResult = {
  hours: number[];
  base: number[];
  evUnmanaged: number[];
  totalUnmanaged: number[];
  evManaged: number[];
  totalManaged: number[];
  contracted: number[];
  basePeak: number;
  unmanagedPeak: number;
  managedPeak: number;
  requiredDemandNoManagement: number;
  criticalHour: number;
  unmanagedExceededHours: number[];
  managedExceededHours: number[];
  peakReductionPercent: number;
  availableAtBasePeak: number;
  maxSafeSimultaneousChargers: number;
  maxSafeSimultaneity: number;
  evEnergyRequestedKwh: number;
  evEnergyDeliveredKwh: number;
  curtailedEnergyKwh: number;
  withinLimit: boolean;
};

const BASE_SHAPE = [
  0.30, 0.27, 0.25, 0.24, 0.25, 0.30,
  0.45, 0.62, 0.70, 0.68, 0.64, 0.61,
  0.60, 0.62, 0.66, 0.73, 0.84, 0.94,
  1.00, 0.93, 0.82, 0.70, 0.56, 0.42
];

const EV_ARRIVAL_SHAPE = [
  0.18, 0.15, 0.12, 0.09, 0.07, 0.06,
  0.07, 0.10, 0.12, 0.10, 0.08, 0.08,
  0.10, 0.14, 0.20, 0.30, 0.46, 0.68,
  1.00, 0.95, 0.82, 0.65, 0.48, 0.30
];

const round = (v: number, digits = 2) => Number(v.toFixed(digits));

function normalizeManual(profile: number[] | null): number[] | null {
  if (!profile || profile.length !== 24 || profile.some((v) => !Number.isFinite(v) || v < 0)) return null;
  return profile.map((v) => round(v));
}

function isPeakHour(hour: number, start: number, end: number) {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function simulate(inputs: SimulationInputs): SimulationResult {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const manual = normalizeManual(inputs.manualBaseProfile);

  const estimatedPeak = Math.max(0, inputs.commonPeakKw + inputs.apartments * inputs.diversifiedUnitKw);
  const base = manual ?? BASE_SHAPE.map((f) => round(estimatedPeak * f));

  const maxConcurrentEvKw = Math.max(0, inputs.chargerCount * inputs.chargerPowerKw * inputs.simultaneity);
  const evUnmanaged = EV_ARRIVAL_SHAPE.map((f) => round(maxConcurrentEvKw * f));
  const totalUnmanaged = base.map((v, i) => round(v + evUnmanaged[i]));

  const reserveLimit = Math.max(0, inputs.contractedDemandKw * (1 - inputs.reserveMargin));
  const evManaged = Array(24).fill(0) as number[];
  const requestedEnergy = evUnmanaged.reduce((acc, v) => acc + v, 0);

  if (!inputs.loadBalancing) {
    evUnmanaged.forEach((v, i) => (evManaged[i] = v));
  } else if (!inputs.offPeakScheduling) {
    hours.forEach((h) => {
      const available = Math.max(0, reserveLimit - base[h]);
      evManaged[h] = round(Math.min(evUnmanaged[h], available));
    });
  } else {
    let remaining = requestedEnergy;
    const priority = [...hours].sort((a, b) => {
      const aOff = isPeakHour(a, inputs.peakStart, inputs.peakEnd) ? 1 : 0;
      const bOff = isPeakHour(b, inputs.peakStart, inputs.peakEnd) ? 1 : 0;
      if (aOff !== bOff) return aOff - bOff;
      const aNightBonus = a <= 6 || a >= 22 ? -1 : 0;
      const bNightBonus = b <= 6 || b >= 22 ? -1 : 0;
      if (aNightBonus !== bNightBonus) return aNightBonus - bNightBonus;
      return base[a] - base[b];
    });

    for (const h of priority) {
      if (remaining <= 0.001) break;
      const available = Math.max(0, reserveLimit - base[h]);
      const hourCap = Math.min(maxConcurrentEvKw, available);
      const allocated = Math.min(hourCap, remaining);
      evManaged[h] = round(allocated);
      remaining -= allocated;
    }
  }

  const totalManaged = base.map((v, i) => round(v + evManaged[i]));
  const contracted = hours.map(() => inputs.contractedDemandKw);
  const basePeak = Math.max(...base);
  const unmanagedPeak = Math.max(...totalUnmanaged);
  const managedPeak = Math.max(...totalManaged);
  const criticalHour = totalUnmanaged.indexOf(unmanagedPeak);
  const unmanagedExceededHours = hours.filter((h) => totalUnmanaged[h] > inputs.contractedDemandKw + 1e-9);
  const managedExceededHours = hours.filter((h) => totalManaged[h] > inputs.contractedDemandKw + 1e-9);
  const peakReductionPercent = unmanagedPeak > 0 ? ((unmanagedPeak - managedPeak) / unmanagedPeak) * 100 : 0;
  const availableAtBasePeak = Math.max(0, inputs.contractedDemandKw - basePeak);
  const maxSafeSimultaneousChargers = inputs.chargerPowerKw > 0
    ? Math.max(0, Math.floor((reserveLimit - basePeak) / inputs.chargerPowerKw))
    : 0;
  const maxSafeSimultaneity = inputs.chargerCount > 0
    ? Math.max(0, Math.min(1, maxSafeSimultaneousChargers / inputs.chargerCount))
    : 0;
  const delivered = evManaged.reduce((acc, v) => acc + v, 0);
  const curtailed = Math.max(0, requestedEnergy - delivered);

  return {
    hours,
    base,
    evUnmanaged,
    totalUnmanaged,
    evManaged,
    totalManaged,
    contracted,
    basePeak: round(basePeak),
    unmanagedPeak: round(unmanagedPeak),
    managedPeak: round(managedPeak),
    requiredDemandNoManagement: round(unmanagedPeak),
    criticalHour,
    unmanagedExceededHours,
    managedExceededHours,
    peakReductionPercent: round(peakReductionPercent, 1),
    availableAtBasePeak: round(availableAtBasePeak),
    maxSafeSimultaneousChargers,
    maxSafeSimultaneity: round(maxSafeSimultaneity, 2),
    evEnergyRequestedKwh: round(requestedEnergy),
    evEnergyDeliveredKwh: round(delivered),
    curtailedEnergyKwh: round(curtailed),
    withinLimit: managedExceededHours.length === 0
  };
}

function extractNumbers(raw: string): number[] {
  const matches = raw.match(/[-+]?\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((v) => Number(v.replace(",", "."))).filter(Number.isFinite);
}

export function parseProfileText(raw: string): number[] | null {
  const numbers = extractNumbers(raw);
  return numbers.length === 24 ? numbers : null;
}

export function parseCsvProfile(raw: string): number[] | null {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const pairs: Array<{ hour: number; demand: number }> = [];

  for (const line of lines) {
    const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
    const cols = line.split(delimiter).map((c) => c.trim());
    const nums = cols.map((c) => Number(c.replace(",", "."))).filter(Number.isFinite);
    if (nums.length >= 2) pairs.push({ hour: Math.round(nums[0]), demand: nums[1] });
  }

  if (pairs.length >= 24) {
    const profile = Array(24).fill(NaN) as number[];
    for (const p of pairs) if (p.hour >= 0 && p.hour <= 23) profile[p.hour] = p.demand;
    if (profile.every(Number.isFinite)) return profile;
  }

  const allNumbers = extractNumbers(raw);
  return allNumbers.length === 24 ? allNumbers : null;
}
