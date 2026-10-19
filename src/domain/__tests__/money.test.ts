import {
  MoneyError,
  allocateByWeights,
  assertPaise,
  financialYearFromStartYear,
  financialYearOf,
  formatCompactInr,
  formatInr,
  groupIndianDigits,
  isPaise,
  isValidIsoDate,
  isWithinFinancialYear,
  monthRange,
  monthsOfFinancialYear,
  parseAmountToPaise,
  splitByPercent,
  splitEvenly,
  toIsoDate,
} from '../money';

describe('groupIndianDigits', () => {
  it('leaves small numbers alone', () => {
    expect(groupIndianDigits('0')).toBe('0');
    expect(groupIndianDigits('9')).toBe('9');
    expect(groupIndianDigits('999')).toBe('999');
  });

  it('groups in the Indian 2-2-2 pattern after the first three digits', () => {
    expect(groupIndianDigits('1000')).toBe('1,000');
    expect(groupIndianDigits('99999')).toBe('99,999');
    expect(groupIndianDigits('100000')).toBe('1,00,000');
    expect(groupIndianDigits('1234567')).toBe('12,34,567');
    expect(groupIndianDigits('12345678')).toBe('1,23,45,678');
    expect(groupIndianDigits('123456789')).toBe('12,34,56,789');
    expect(groupIndianDigits('1000000000')).toBe('1,00,00,00,000');
  });

  it('strips leading zeros but keeps a single zero', () => {
    expect(groupIndianDigits('007')).toBe('7');
    expect(groupIndianDigits('00')).toBe('0');
  });

  it('handles negatives', () => {
    expect(groupIndianDigits('-1234567')).toBe('-12,34,567');
  });

  it('rejects non-numeric input', () => {
    expect(() => groupIndianDigits('12a4')).toThrow(MoneyError);
  });
});

describe('formatInr', () => {
  it('formats with Indian grouping and paise', () => {
    expect(formatInr(123456750)).toBe('₹12,34,567.50');
    expect(formatInr(1)).toBe('₹0.01');
    expect(formatInr(99)).toBe('₹0.99');
    expect(formatInr(100)).toBe('₹1');
    expect(formatInr(2500)).toBe('₹25');
    expect(formatInr(100000)).toBe('₹1,000');
    expect(formatInr(10000000)).toBe('₹1,00,000');
  });

  it('handles zero and negatives', () => {
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(-2500)).toBe('-₹25');
    expect(formatInr(-123456750)).toBe('-₹12,34,567.50');
  });

  it('handles very large amounts (crores)', () => {
    expect(formatInr(1234567890123)).toBe('₹12,34,56,78,901.23');
    expect(formatInr(1000000000000)).toBe('₹10,00,00,00,000');
  });

  it('supports forcePaise and symbol-free output', () => {
    expect(formatInr(2500, { forcePaise: true })).toBe('₹25.00');
    expect(formatInr(2500, { symbol: false })).toBe('25');
    expect(formatInr(-2500, { symbol: false })).toBe('-25');
  });

  it('rejects non-integer paise', () => {
    expect(() => formatInr(25.5)).toThrow(MoneyError);
    expect(assertPaise(10)).toBe(10);
    expect(() => assertPaise(1.5)).toThrow(MoneyError);
  });
});

describe('formatCompactInr', () => {
  it('uses lakh and crore suffixes', () => {
    // paise values: 12,50,000 rupees = 12.5 L; 24,00,000 rupees = 24 L;
    // 24,000,000 rupees = 2.4 Cr; 24,00,00,000 rupees = 24 Cr
    expect(formatCompactInr(12500000)).toBe('₹1.25 L');
    expect(formatCompactInr(125000000)).toBe('₹12.5 L');
    expect(formatCompactInr(240000000)).toBe('₹24 L');
    expect(formatCompactInr(2400000000)).toBe('₹2.4 Cr');
    expect(formatCompactInr(24000000000)).toBe('₹24 Cr');
    expect(formatCompactInr(1000000000)).toBe('₹1 Cr');
    expect(formatCompactInr(10000000)).toBe('₹1 L');
  });

  it('falls back to thousands and plain rupees', () => {
    expect(formatCompactInr(125000)).toBe('₹1.25 K');
    expect(formatCompactInr(150000)).toBe('₹1.5 K');
    expect(formatCompactInr(50000)).toBe('₹500');
    expect(formatCompactInr(0)).toBe('₹0');
  });

  it('handles negatives', () => {
    expect(formatCompactInr(-12500000)).toBe('-₹1.25 L');
  });
});

describe('parseAmountToPaise', () => {
  it('parses plain and grouped numbers', () => {
    expect(parseAmountToPaise('1234')).toBe(123400);
    expect(parseAmountToPaise('1,234.50')).toBe(123450);
    expect(parseAmountToPaise('12,34,567.55')).toBe(123456755);
    expect(parseAmountToPaise('₹1234.5')).toBe(123450);
    expect(parseAmountToPaise('Rs. 99')).toBe(9900);
    expect(parseAmountToPaise('.5')).toBe(50);
    expect(parseAmountToPaise('0')).toBe(0);
    expect(parseAmountToPaise('0.05')).toBe(5);
  });

  it('parses negatives', () => {
    expect(parseAmountToPaise('-100')).toBe(-10000);
    expect(parseAmountToPaise('+100')).toBe(10000);
  });

  it('rejects invalid input instead of guessing', () => {
    expect(parseAmountToPaise('')).toBeNull();
    expect(parseAmountToPaise('   ')).toBeNull();
    expect(parseAmountToPaise('abc')).toBeNull();
    expect(parseAmountToPaise('1.234')).toBeNull(); // 3 decimals
    expect(parseAmountToPaise('1,23,4')).toBeNull(); // bad grouping
    expect(parseAmountToPaise('1.2.3')).toBeNull();
    expect(parseAmountToPaise('₹')).toBeNull();
  });

  it('round-trips with formatInr', () => {
    for (const v of [0, 1, 99, 100, 123456750, 999999999999]) {
      const text = formatInr(v, { forcePaise: true, symbol: false });
      expect(parseAmountToPaise(text)).toBe(v);
    }
  });
});

describe('isPaise', () => {
  it('accepts integers only', () => {
    expect(isPaise(0)).toBe(true);
    expect(isPaise(-5)).toBe(true);
    expect(isPaise(1.5)).toBe(false);
    expect(isPaise('5')).toBe(false);
    expect(isPaise(NaN)).toBe(false);
  });
});

describe('splitEvenly', () => {
  it('adds up exactly', () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
    expect(splitEvenly(1, 3)).toEqual([1, 0, 0]);
    expect(splitEvenly(0, 4)).toEqual([0, 0, 0, 0]);
    expect(splitEvenly(100, 1)).toEqual([100]);
    expect(splitEvenly(100, 100)).toEqual(new Array(100).fill(1));
  });

  it('handles negatives (refunds) exactly', () => {
    const parts = splitEvenly(-100, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-100);
    expect(parts).toEqual([-34, -33, -33]);
  });

  it('rejects bad part counts', () => {
    expect(() => splitEvenly(100, 0)).toThrow(MoneyError);
    expect(() => splitEvenly(100, -1)).toThrow(MoneyError);
    expect(() => splitEvenly(100, 2.5)).toThrow(MoneyError);
  });
});

describe('allocateByWeights', () => {
  it('distributes proportionally and sums exactly', () => {
    expect(allocateByWeights(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(allocateByWeights(10000, [50, 50])).toEqual([5000, 5000]);
    expect(allocateByWeights(10000, [1, 2])).toEqual([3333, 6667]);
    expect(allocateByWeights(1000, [0, 1])).toEqual([0, 1000]);
  });

  it('is deterministic for ties', () => {
    const a = allocateByWeights(100, [1, 1, 1, 1]);
    const b = allocateByWeights(100, [1, 1, 1, 1]);
    expect(a).toEqual(b);
    expect(a).toEqual([25, 25, 25, 25]);
  });

  it('handles zero total and negative totals', () => {
    expect(allocateByWeights(0, [1, 2, 3])).toEqual([0, 0, 0]);
    const neg = allocateByWeights(-10000, [1, 1, 1]);
    expect(neg.reduce((a, b) => a + b, 0)).toBe(-10000);
  });

  it('rejects invalid weights', () => {
    expect(() => allocateByWeights(100, [])).toThrow(MoneyError);
    expect(() => allocateByWeights(100, [0, 0])).toThrow(MoneyError);
    expect(() => allocateByWeights(100, [-1, 2])).toThrow(MoneyError);
  });

  it('works with very large amounts', () => {
    const total = 999999999999; // ~10 crore rupees in paise
    const parts = allocateByWeights(total, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
  });
});

describe('splitByPercent', () => {
  it('requires 100 total', () => {
    expect(splitByPercent(10000, [33.33, 33.33, 33.34]).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(() => splitByPercent(10000, [50, 40])).toThrow(MoneyError);
    expect(() => splitByPercent(10000, [-50, 150])).toThrow(MoneyError);
  });
});

describe('financial year (1 April - 31 March)', () => {
  it('maps dates to the right FY', () => {
    expect(financialYearOf('2025-04-01').label).toBe('2025-26');
    expect(financialYearOf('2025-03-31').label).toBe('2024-25');
    expect(financialYearOf('2025-12-31').label).toBe('2025-26');
    expect(financialYearOf('2026-03-31').label).toBe('2025-26');
    expect(financialYearOf('2026-04-01').label).toBe('2026-27');
  });

  it('accepts Date objects', () => {
    expect(financialYearOf(new Date(2025, 3, 1)).label).toBe('2025-26'); // 1 Apr 2025
    expect(financialYearOf(new Date(2025, 2, 31)).label).toBe('2024-25'); // 31 Mar 2025
  });

  it('produces correct bounds and membership', () => {
    const fy = financialYearFromStartYear(2025);
    expect(fy.start).toBe('2025-04-01');
    expect(fy.end).toBe('2026-03-31');
    expect(isWithinFinancialYear('2025-04-01', fy)).toBe(true);
    expect(isWithinFinancialYear('2026-03-31', fy)).toBe(true);
    expect(isWithinFinancialYear('2026-04-01', fy)).toBe(false);
    expect(isWithinFinancialYear('2025-03-31', fy)).toBe(false);
  });

  it('lists its twelve months starting with April', () => {
    const months = monthsOfFinancialYear(financialYearFromStartYear(2025));
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe('2025-04');
    expect(months[11].key).toBe('2026-03');
    expect(months[11].end).toBe('2026-03-31');
  });
});

describe('date helpers', () => {
  it('handles leap days and month ends', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true); // leap year
    expect(isValidIsoDate('2025-02-29')).toBe(false); // not a leap year
    expect(isValidIsoDate('2000-02-29')).toBe(true); // divisible by 400
    expect(isValidIsoDate('2100-02-29')).toBe(false); // divisible by 100, not 400
    expect(isValidIsoDate('2025-04-31')).toBe(false);
    expect(isValidIsoDate('2025-13-01')).toBe(false);
    expect(isValidIsoDate('2025-1-1')).toBe(false);
  });

  it('computes month ranges', () => {
    expect(monthRange(2025, 2).end).toBe('2025-02-28');
    expect(monthRange(2024, 2).end).toBe('2024-02-29');
    expect(monthRange(2025, 12).end).toBe('2025-12-31');
    expect(() => monthRange(2025, 0)).toThrow(MoneyError);
    expect(() => monthRange(2025, 13)).toThrow(MoneyError);
  });

  it('formats ISO dates without timezone drift', () => {
    expect(toIsoDate(new Date(2025, 0, 5))).toBe('2025-01-05');
    expect(toIsoDate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });
});
