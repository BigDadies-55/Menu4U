// ── Daily working-hours engine ───────────────────────────────────────────────
// Pure, dependency-free functions that turn raw check-in/check-out punches into a
// daily hours breakdown (regular + overtime tiers). This is the basis for any
// payroll calculation, so it is intentionally isolated and easy to unit-test.

export type Punch = { type: string; timestamp: string | Date };

export type HoursOptions = {
  /** Minutes deducted as an unpaid break. Default 30. */
  breakMinutes?: number;
  /** Break is only deducted once gross presence reaches this many hours. Default 6. */
  breakThresholdHours?: number;
  /** Hours paid at 100% before overtime kicks in. Default 9. */
  regularDayHours?: number;
  /** Width (in hours) of the 125% overtime tier, right after the regular tier. Default 2 (i.e. hours 9–11). */
  overtime125Width?: number;
};

export type HoursBreakdown = {
  /** Total time physically present (sum of IN/OUT pairs), before break. */
  grossHours: number;
  /** Break time deducted. */
  breakHours: number;
  /** grossHours − breakHours. */
  netHours: number;
  /** Net hours paid at 100%. */
  regularHours: number;
  /** Net hours paid at 125% (the tier right after the regular day). */
  overtime125Hours: number;
  /** Net hours paid at 150% (everything beyond the 125% tier). */
  overtime150Hours: number;
  /** Net hours expressed as paid units: regular×1 + ot125×1.25 + ot150×1.5. */
  payableUnits: number;
};

export const DEFAULT_HOURS_OPTIONS: Required<HoursOptions> = {
  breakMinutes: 30,
  breakThresholdHours: 6,
  regularDayHours: 9,
  overtime125Width: 2,
};

/**
 * Sum gross presence (in hours) from a day's punches by pairing each IN with the
 * next OUT chronologically. Unmatched punches and non-positive / >24h spans are ignored.
 */
export function grossHoursFromPunches(punches: Punch[]): number {
  const ms = (t: string | Date) => new Date(t).getTime();
  const ins  = punches.filter(p => p.type === "IN").sort((a, b) => ms(a.timestamp) - ms(b.timestamp));
  const outs = punches.filter(p => p.type === "OUT").sort((a, b) => ms(a.timestamp) - ms(b.timestamp));
  let total = 0;
  ins.forEach((inRec, i) => {
    const outRec = outs[i];
    if (!outRec) return;
    const diff = (ms(outRec.timestamp) - ms(inRec.timestamp)) / 3_600_000;
    if (diff > 0 && diff < 24) total += diff;
  });
  return total;
}

/**
 * Split a gross presence figure into break / regular / 125% / 150% tiers.
 *
 *   net      = gross − break
 *   regular  = first `regularDayHours` net hours          (100%)
 *   ot 125%  = next `overtime125Width` net hours           (hours 9–11 by default)
 *   ot 150%  = everything beyond                           (>11h by default)
 */
export function breakdownDailyHours(grossHours: number, options: HoursOptions = {}): HoursBreakdown {
  const o = { ...DEFAULT_HOURS_OPTIONS, ...options };
  const safeGross = grossHours > 0 ? grossHours : 0;

  const breakHours = safeGross >= o.breakThresholdHours ? o.breakMinutes / 60 : 0;
  const netHours = Math.max(0, safeGross - breakHours);

  const regularHours      = Math.min(netHours, o.regularDayHours);
  const overtime125Hours  = Math.min(Math.max(netHours - o.regularDayHours, 0), o.overtime125Width);
  const overtime150Hours  = Math.max(netHours - o.regularDayHours - o.overtime125Width, 0);

  const payableUnits = regularHours + overtime125Hours * 1.25 + overtime150Hours * 1.5;

  return {
    grossHours: safeGross,
    breakHours,
    netHours,
    regularHours,
    overtime125Hours,
    overtime150Hours,
    payableUnits,
  };
}

/** Convenience: punches → full daily breakdown. */
export function computeDailyHours(punches: Punch[], options?: HoursOptions): HoursBreakdown {
  return breakdownDailyHours(grossHoursFromPunches(punches), options);
}

/** Sum several daily breakdowns into a single total (e.g. a week or a month). */
export function sumBreakdowns(items: HoursBreakdown[]): HoursBreakdown {
  return items.reduce<HoursBreakdown>(
    (acc, b) => ({
      grossHours:       acc.grossHours + b.grossHours,
      breakHours:       acc.breakHours + b.breakHours,
      netHours:         acc.netHours + b.netHours,
      regularHours:     acc.regularHours + b.regularHours,
      overtime125Hours: acc.overtime125Hours + b.overtime125Hours,
      overtime150Hours: acc.overtime150Hours + b.overtime150Hours,
      payableUnits:     acc.payableUnits + b.payableUnits,
    }),
    { grossHours: 0, breakHours: 0, netHours: 0, regularHours: 0, overtime125Hours: 0, overtime150Hours: 0, payableUnits: 0 },
  );
}
