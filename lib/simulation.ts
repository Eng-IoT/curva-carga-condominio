import { hourlyToQuarter } from "./curve";
import type { CurveProfile, EvInputs, EvSimulationResult } from "./types";

function slotHour(index: number) {
  return index / 4;
}

function inWindow(hour: number, start: number, end: number) {
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function afterArrivalScore(hour: number, start: number) {
  const delta = (hour - start + 24) % 24;
  if (delta < 1) return 1;
  if (delta < 2) return 0.92;
  if (delta < 4) return 0.78;
  if (delta < 6) return 0.58;
  if (delta < 9) return 0.38;
  return 0.22;
}

function allocateWeightedEnergy(weights: number[], maxPowerKw: number, energyKwh: number) {
  const power = Array(weights.length).fill(0);
  const dt = 0.25;
  let remaining = Math.max(0, energyKwh);
  let active = weights.map((w, i) => ({ w, i })).filter((x) => x.w > 0);

  // Distribuição iterativa sem aleatoriedade, limitada pela potência máxima agregada.
  for (let pass = 0; pass < 8 && remaining > 0.01 && active.length; pass++) {
    const totalWeight = active.reduce((sum, x) => sum + x.w, 0) || 1;
    const nextActive: typeof active = [];
    for (const x of active) {
      const shareEnergy = remaining * (x.w / totalWeight);
      const requestedPower = shareEnergy / dt;
      const headroom = Math.max(0, maxPowerKw - power[x.i]);
      const addPower = Math.min(headroom, requestedPower);
      power[x.i] += addPower;
      if (power[x.i] < maxPowerKw - 0.001) nextActive.push(x);
    }
    const delivered = power.reduce((sum, p) => sum + p * dt, 0);
    remaining = Math.max(0, energyKwh - delivered);
    active = nextActive;
  }
  return power;
}

export function simulateEvs(profile: CurveProfile, inputs: EvInputs): EvSimulationResult {
  const baseKw = hourlyToQuarter(profile.hourlyKw);
  const slots = Array.from({ length: 96 }, (_, i) => i / 4);
  const requestedEnergyKwh = Math.max(0, inputs.chargerCount * inputs.energyPerVehicleKwh);
  const maxAggregatePowerKw = Math.max(0, inputs.chargerCount * inputs.chargerPowerKw * Math.min(1, Math.max(0, inputs.simultaneity)));

  const unmanagedWeights = slots.map((hour) => {
    if (!inWindow(hour, inputs.arrivalStart, inputs.departureHour)) return 0;
    // Entre chegada inicial e final há maior concentração de sessões iniciando.
    const arrivalWindowBoost = inWindow(hour, inputs.arrivalStart, inputs.arrivalEnd) ? 1.25 : 1;
    return afterArrivalScore(hour, inputs.arrivalStart) * arrivalWindowBoost;
  });
  const evUnmanagedKw = allocateWeightedEnergy(unmanagedWeights, maxAggregatePowerKw, requestedEnergyKwh);

  const effectiveLimit = Math.max(0, inputs.demandLimitKw * (1 - Math.min(0.5, Math.max(0, inputs.reserveMargin))));
  const managedAvailability = baseKw.map((base, i) => {
    const hour = slotHour(i);
    if (!inWindow(hour, inputs.arrivalStart, inputs.departureHour)) return 0;
    const headroom = inputs.loadBalancing ? Math.max(0, effectiveLimit - base) : maxAggregatePowerKw;
    return Math.min(maxAggregatePowerKw, headroom);
  });

  const priority = managedAvailability.map((available, i) => {
    const hour = slotHour(i);
    if (available <= 0) return { i, score: -Infinity };
    let score = available * 10 - baseKw[i];
    if (inputs.offPeakScheduling) {
      const isPeak = inWindow(hour, inputs.peakStart, inputs.peakEnd);
      score += isPeak ? -10000 : 1000;
      // Horários de madrugada ganham um pequeno bônus para reduzir pico noturno tardio.
      if (hour >= 0 && hour < 6) score += 150;
    } else {
      score -= ((hour - inputs.arrivalStart + 24) % 24) * 0.01;
    }
    return { i, score };
  }).sort((a, b) => b.score - a.score);

  const evManagedKw = Array(96).fill(0);
  let remaining = requestedEnergyKwh;
  const dt = 0.25;
  for (const slot of priority) {
    if (remaining <= 0.001 || slot.score === -Infinity) break;
    const p = Math.min(managedAvailability[slot.i], remaining / dt);
    evManagedKw[slot.i] = p;
    remaining -= p * dt;
  }

  if (!inputs.loadBalancing && !inputs.offPeakScheduling) {
    for (let i = 0; i < 96; i++) evManagedKw[i] = evUnmanagedKw[i];
    remaining = Math.max(0, requestedEnergyKwh - evManagedKw.reduce((sum, p) => sum + p * dt, 0));
  }

  const totalUnmanagedKw = baseKw.map((b, i) => b + evUnmanagedKw[i]);
  const totalManagedKw = baseKw.map((b, i) => b + evManagedKw[i]);
  const demandLimitKw = Array(96).fill(inputs.demandLimitKw);
  const unmanagedPeakKw = Math.max(...totalUnmanagedKw);
  const managedPeakKw = Math.max(...totalManagedKw);
  const criticalIndex = totalUnmanagedKw.indexOf(unmanagedPeakKw);
  const deliveredEnergyKwh = evManagedKw.reduce((sum, p) => sum + p * dt, 0);
  const unmetEnergyKwh = Math.max(0, requestedEnergyKwh - deliveredEnergyKwh);

  return {
    quarterHours: slots,
    baseKw: baseKw.map((v) => +v.toFixed(3)),
    evUnmanagedKw: evUnmanagedKw.map((v) => +v.toFixed(3)),
    totalUnmanagedKw: totalUnmanagedKw.map((v) => +v.toFixed(3)),
    evManagedKw: evManagedKw.map((v) => +v.toFixed(3)),
    totalManagedKw: totalManagedKw.map((v) => +v.toFixed(3)),
    demandLimitKw,
    unmanagedPeakKw: +unmanagedPeakKw.toFixed(2),
    managedPeakKw: +managedPeakKw.toFixed(2),
    criticalIndex,
    requestedEnergyKwh: +requestedEnergyKwh.toFixed(2),
    deliveredEnergyKwh: +deliveredEnergyKwh.toFixed(2),
    unmetEnergyKwh: +unmetEnergyKwh.toFixed(2),
    deliveryPercent: requestedEnergyKwh > 0 ? +((deliveredEnergyKwh / requestedEnergyKwh) * 100).toFixed(1) : 100,
    unmanagedExceededSlots: totalUnmanagedKw.filter((v) => v > inputs.demandLimitKw).length,
    managedExceededSlots: totalManagedKw.filter((v) => v > inputs.demandLimitKw).length,
    peakReductionPercent: unmanagedPeakKw > 0 ? +((1 - managedPeakKw / unmanagedPeakKw) * 100).toFixed(1) : 0,
    maxManagedEvKw: +Math.max(...evManagedKw).toFixed(2)
  };
}
