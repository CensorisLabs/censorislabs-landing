/**
 * Money utilities for Censoris.
 *
 * Rules (non-negotiable):
 * - All money is integer paise. Never use floating point for amounts or splits.
 * - Indian digit grouping is implemented here by hand (not Intl, which differs
 *   between Android devices): last three digits, then groups of two.
 *   e.g. 123456750 paise -> ₹12,34,567.50
 * - This module is pure TypeScript: no React, no platform APIs. Reusable on
 *   iOS/desktop later and fully unit-testable.
 */

/** An amount of money in paise (1/100 rupee). Always an integer. */
export type Paise = number;

export const PAISE_PER_RUPEE = 100;
export const PAISE_PER_THOUSAND = 100_000;
export const PAISE_PER_LAKH = 100_000 * PAISE_PER_RUPEE; // 1,00,000 rupees
export const PAISE_PER_CRORE = 10_000_000 * PAISE_PER_RUPEE; // 1,00,00,000 rupees

/** Largest amount we accept anywhere: 9,00,71,99,25,47,409.99 rupees
 *  (beyond Number.MAX_SAFE_INTEGER paise precision is lost). */
export const MAX_PAISE = Number.MAX_SAFE_INTEGER;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function assertPaise(value: number, label = 'amount'): Paise {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of paise, got ${value}`);
  }
  if (Math.abs(value) > MAX_PAISE) {
    throw new MoneyError(`${label} is too large to store safely`);
  }
  return value;
}

export function isPaise(value: unknown): value is Paise {
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_PAISE;
}

// ---------------------------------------------------------------------------
// Indian digit grouping
// ---------------------------------------------------------------------------

/** Group an integer string in Indian style: 1234567 -> "12,34,567". */
export function groupIndianDigits(intDigits: string): string {
  // Tolerate a leading minus so negatives group correctly.
  const negative = intDigits.startsWith('-');
  const digits = negative ? intDigits.slice(1) : intDigits;
  if (!/^\d*$/.test(digits)) {
    throw new MoneyError(`not an integer string: ${intDigits}`);
  }
  const trimmed = digits.replace(/^0+(?=\d)/, ''); // keep a single 0
  let result: string;
  if (trimmed.length <= 3) {
    result = trimmed;
  } else {
    const lastThree = trimmed.slice(-3);
    let rest = trimmed.slice(0, -3);
    const groups: string[] = [];
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length > 0) groups.unshift(rest);
    result = groups.join(',') + ',' + lastThree;
  }
  return negative ? '-' + result : result;
}

export interface FormatInrOptions {
  /** Show the ₹ symbol. Default true. */
  symbol?: boolean;
  /** Show paise (two decimals) when non-zero, or when forcePaise. Default true. */
  showPaise?: boolean;
  /** Always show two decimals even for round amounts. Default false. */
  forcePaise?: boolean;
  /** Render the minus sign before the symbol (-₹100) instead of after (₹-100). Default true. */
  leadingMinus?: boolean;
}

/**
 * Format paise as a full Indian-grouped rupee string.
 * formatInr(123456750) -> "₹12,34,567.50"
 * formatInr(100000)   -> "₹1,000"
 * formatInr(-2500)    -> "-₹25"
 */
export function formatInr(paise: Paise, options: FormatInrOptions = {}): string {
  assertPaise(paise);
  const { symbol = true, showPaise = true, forcePaise = false, leadingMinus = true } = options;

  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const fraction = abs % PAISE_PER_RUPEE;

  const rupeePart = groupIndianDigits(String(rupees));
  let body = rupeePart;
  if (fraction !== 0 && showPaise) {
    body += '.' + String(fraction).padStart(2, '0');
  } else if (forcePaise && showPaise) {
    body += '.00';
  }

  const sign = negative ? '-' : '';
  if (!symbol) return sign + body;
  return leadingMinus ? `${sign}₹${body}` : `${sign ? '₹' + sign : ''}₹${body}`.replace('₹₹', '₹');
}

/**
 * Compact Indian money form used in tight UI spots: ₹1.25 L, ₹2.4 Cr.
 * Falls back to thousands below one lakh, and plain rupees below one thousand.
 * Trailing zeros are trimmed (2.40 Cr -> 2.4 Cr).
 */
export function formatCompactInr(paise: Paise, options: { symbol?: boolean } = {}): string {
  assertPaise(paise);
  const { symbol = true } = options;
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const sign = negative ? '-' : '';
  const prefix = symbol ? '₹' : '';

  // Work in hundredths of the unit to stay in integer math.
  const hundredths = (unitPaise: number): { value100: number; unit: string } => {
    if (abs >= PAISE_PER_CRORE) return { value100: Math.round((abs * 100) / PAISE_PER_CRORE), unit: 'Cr' };
    if (abs >= PAISE_PER_LAKH) return { value100: Math.round((abs * 100) / PAISE_PER_LAKH), unit: 'L' };
    if (abs >= PAISE_PER_THOUSAND) return { value100: Math.round((abs * 100) / PAISE_PER_THOUSAND), unit: 'K' };
    return { value100: Math.round((abs * 100) / PAISE_PER_RUPEE), unit: '' };
  };

  const { value100, unit } = hundredths(abs);
  const rupeesScaled = value100; // hundredths of the unit
  const whole = Math.floor(rupeesScaled / 100);
  const hundredthsPart = rupeesScaled % 100;

  let num = String(whole);
  if (hundredthsPart !== 0) {
    const frac = String(hundredthsPart).padStart(2, '0').replace(/0$/, '');
    num += '.' + frac;
  }
  const spacer = unit === '' ? '' : ' ';
  return `${sign}${prefix}${num}${spacer}${unit}`;
}

// ---------------------------------------------------------------------------
// Parsing user input
// ---------------------------------------------------------------------------

/**
 * Parse a user-typed amount into integer paise.
 * Accepts: "1234", "1,234.50", "₹1234.5", "1234.5 INR", ".5"
 * Rejects: "", "abc", "1.234", "1,23,4" and anything with more than 2 decimals.
 * Returns null for invalid input (never throws on user input).
 */
export function parseAmountToPaise(input: string): Paise | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (s === '') return null;

  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  // Strip currency hints and spaces
  s = s.replace(/₹|rs\.?|inr/gi, '').replace(/\s/g, '');
  if (s.startsWith('.')) s = '0' + s; // ".5" means half a rupee
  // Allow Indian or western grouping commas, but require sane grouping on the integer part
  const match = s.match(/^(\d{1,3}(?:,\d{2,3})*|\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const intDigits = match[1].replace(/,/g, '');
  const fractionDigits = match[2] ?? '';

  if (fractionDigits.length > 2) return null;
  const rupees = Number(intDigits);
  const paise = Number(fractionDigits.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(rupees)) return null;

  const total = rupees * PAISE_PER_RUPEE + paise;
  if (total > MAX_PAISE) return null;
  return negative ? -total : total;
}

// ---------------------------------------------------------------------------
// Splits (exact, deterministic)
// ---------------------------------------------------------------------------

/**
 * Split `total` as evenly as possible across `parts` people.
 * Any leftover paise go to the earliest people, one paise each, so the parts
 * always add up to exactly `total`.
 * splitEvenly(100, 3) -> [34, 33, 33]
 */
export function splitEvenly(total: Paise, parts: number): Paise[] {
  assertPaise(total);
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new MoneyError('parts must be a positive integer');
  }
  const base = Math.trunc(total / parts); // trunc toward zero for negatives
  const remainder = total - base * parts; // 0 <= remainder < parts
  const result: Paise[] = new Array(parts).fill(base);
  const step = remainder > 0 ? 1 : -1;
  let left = Math.abs(remainder);
  for (let i = 0; left > 0; i++, left--) {
    result[i] += step;
  }
  return result;
}

/**
 * Allocate `total` across `weights` using the largest-remainder method.
 * - Parts are proportional to weights.
 * - Leftover paise are handed out one at a time, largest fractional part
 *   first; ties break on the lower index. Fully deterministic.
 * - The returned parts always sum to exactly `total`.
 * allocateByWeights(10000, [1, 1, 1]) -> [3334, 3333, 3333]
 * allocateByWeights(10000, [50, 50])  -> [5000, 5000]
 */
export function allocateByWeights(total: Paise, weights: number[]): Paise[] {
  assertPaise(total);
  if (weights.length === 0) throw new MoneyError('weights must not be empty');
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new MoneyError('weights must be non-negative finite numbers');
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) throw new MoneyError('weights must not sum to zero');

  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);

  const exact = weights.map((w) => (absTotal * w) / weightSum);
  const floors = exact.map((v) => Math.floor(v));
  let leftover = absTotal - floors.reduce((a, b) => a + b, 0);

  // Rank by fractional part (desc), tie-break by index (asc).
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));

  const result = floors.slice();
  for (let k = 0; leftover > 0; k = (k + 1) % order.length, leftover--) {
    result[order[k].i] += 1;
  }
  return result.map((v) => v * sign);
}

/**
 * Split by percentage points (must total 100). Convenience wrapper.
 * splitByPercent(10000, [33.33, 33.33, 33.34]) -> sums to 10000 exactly.
 */
export function splitByPercent(total: Paise, percent: number[]): Paise[] {
  if (percent.some((p) => !Number.isFinite(p) || p < 0)) {
    throw new MoneyError('percentages must be non-negative numbers');
  }
  const sum = percent.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 1e-9) {
    throw new MoneyError('percentages must add up to 100');
  }
  return allocateByWeights(total, percent);
}

// ---------------------------------------------------------------------------
// Financial year (1 April to 31 March)
// ---------------------------------------------------------------------------

export interface FinancialYear {
  /** Year the FY starts in, e.g. 2025 for FY 2025-26. */
  startYear: number;
  /** First day, inclusive, as YYYY-MM-DD. */
  start: string;
  /** Last day, inclusive, as YYYY-MM-DD. */
  end: string;
  /** Display label, e.g. "2025-26". */
  label: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate(); // month 0 of next month, minus one day
  return d >= 1 && d <= daysInMonth;
}

function parseIsoDate(s: string): { year: number; month: number; day: number } {
  if (!isValidIsoDate(s)) throw new MoneyError(`invalid date: ${s}`);
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}

/** The financial year containing the given date. Accepts a Date or YYYY-MM-DD. */
export function financialYearOf(date: Date | string): FinancialYear {
  const iso = typeof date === 'string' ? date : toIsoDate(date);
  const { year, month } = parseIsoDate(iso);
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    startYear,
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
    label: `${startYear}-${pad(endYear % 100)}`,
  };
}

/** Build an FY from its start year: financialYearFromStartYear(2025) -> FY 2025-26. */
export function financialYearFromStartYear(startYear: number): FinancialYear {
  const endYear = startYear + 1;
  return {
    startYear,
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
    label: `${startYear}-${pad(endYear % 100)}`,
  };
}

export function isWithinFinancialYear(isoDate: string, fy: FinancialYear): boolean {
  return isoDate >= fy.start && isoDate <= fy.end; // ISO strings compare lexicographically
}

/** Calendar month key "YYYY-MM" and its day bounds. */
export interface MonthRange {
  key: string; // YYYY-MM
  start: string; // first day YYYY-MM-DD
  end: string; // last day YYYY-MM-DD
}

export function monthRange(year: number, month: number): MonthRange {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new MoneyError('month must be 1-12');
  }
  const lastDay = new Date(year, month, 0).getDate();
  return {
    key: `${year}-${pad(month)}`,
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** All calendar months of a financial year, in order (April first). */
export function monthsOfFinancialYear(fy: FinancialYear): MonthRange[] {
  const months: MonthRange[] = [];
  for (let i = 0; i < 12; i++) {
    const month = 4 + i; // April..March of the next year
    const year = fy.startYear + (month > 12 ? 1 : 0);
    const calendarMonth = month > 12 ? month - 12 : month;
    months.push(monthRange(year, calendarMonth));
  }
  return months;
}
