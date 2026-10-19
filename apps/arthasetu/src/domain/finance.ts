export type CashFlow = { date: Date; amount: number }

const DAY_MS = 86_400_000
const yearFraction = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY_MS / 365

export function xnpv(rate: number, flows: CashFlow[]): number {
  if (!Number.isFinite(rate) || rate <= -1 || flows.length === 0) return Number.NaN
  const ordered = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const start = ordered[0].date
  return ordered.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + rate, yearFraction(start, flow.date)), 0)
}

/** Annualized return for dated cash flows, using actual day counts. */
export function xirr(flows: CashFlow[], guess = 0.1): number | null {
  if (flows.length < 2 || flows.some(flow => !Number.isFinite(flow.amount) || !Number.isFinite(flow.date.getTime())) || !flows.some(flow => flow.amount < 0) || !flows.some(flow => flow.amount > 0)) return null
  const ordered = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const start = ordered[0].date
  const valueAndSlope = (rate: number) => ordered.reduce(([value, slope], flow) => {
    const years = yearFraction(start, flow.date)
    const base = Math.pow(1 + rate, years)
    return [value + flow.amount / base, slope - (years * flow.amount) / (base * (1 + rate))] as [number, number]
  }, [0, 0] as [number, number])

  let rate = Number.isFinite(guess) && guess > -1 ? guess : 0.1
  for (let index = 0; index < 80; index += 1) {
    const [value, slope] = valueAndSlope(rate)
    if (Math.abs(value) < 0.01) return rate
    if (!Number.isFinite(slope) || slope === 0) break
    const next = rate - value / slope
    if (!Number.isFinite(next) || next <= -0.9999 || next > 1_000_000) break
    rate = next
  }

  let low = -0.9999
  let high = 10
  let lowValue = xnpv(low, ordered)
  let highValue = xnpv(high, ordered)
  while (lowValue * highValue > 0 && high < 1_000_000) {
    high *= 2
    highValue = xnpv(high, ordered)
  }
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) return null
  for (let index = 0; index < 160; index += 1) {
    const mid = (low + high) / 2
    const midValue = xnpv(mid, ordered)
    if (Math.abs(midValue) < 0.01) return mid
    if (lowValue * midValue <= 0) { high = mid; highValue = midValue } else { low = mid; lowValue = midValue }
  }
  return (low + high) / 2
}

export function cagr(startValue: number, endValue: number, years: number): number | null {
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || !Number.isFinite(years) || startValue <= 0 || endValue < 0 || years <= 0) return null
  return Math.pow(endValue / startValue, 1 / years) - 1
}

export type AmortizationRow = { month: number; payment: number; principal: number; interest: number; balance: number }
export function amortization(principal: number, annualRate: number, months: number, extraMonthly = 0): AmortizationRow[] {
  if (![principal, annualRate, months, extraMonthly].every(Number.isFinite) || principal <= 0 || months <= 0 || annualRate < 0) return []
  const term = Math.min(Math.floor(months), 1200)
  const monthlyRate = annualRate / 12
  const payment = monthlyRate === 0 ? principal / term : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -term))
  let balance = principal
  const rows: AmortizationRow[] = []
  for (let month = 1; month <= term && balance > 0; month += 1) {
    const interest = balance * monthlyRate
    const principalPart = Math.min(payment - interest + Math.max(extraMonthly, 0), balance)
    balance = Math.max(0, balance - principalPart)
    rows.push({ month, payment: Math.min(payment + Math.max(extraMonthly, 0), principalPart + interest), principal: principalPart, interest, balance })
  }
  return rows
}

export type Debt = { id: string; name: string; balance: number; annualRate: number; minimumPayment: number }
export type PayoffRow = { month: number; payment: number; interest: number; balance: number }
export type PayoffResult = { rows: PayoffRow[]; totalInterest: number; totalPaid: number; months: number; paidOff: boolean }

/** Compares payoff order while keeping the starting minimum-payment budget constant. */
export function debtPayoff(debts: Debt[], extraMonthly: number, strategy: 'snowball' | 'avalanche'): PayoffResult {
  const active = debts.filter(debt => [debt.balance, debt.annualRate, debt.minimumPayment].every(Number.isFinite) && debt.balance > 0 && debt.annualRate >= 0 && debt.minimumPayment > 0)
  if (active.length === 0) return { rows: [], totalInterest: 0, totalPaid: 0, months: 0, paidOff: true }
  const openingBudget = active.reduce((sum, debt) => sum + debt.minimumPayment, 0) + Math.max(extraMonthly, 0)
  const balances = new Map(active.map(debt => [debt.id, debt.balance]))
  const order = [...active].sort((a, b) => strategy === 'snowball' ? a.balance - b.balance : b.annualRate - a.annualRate)
  const rows: PayoffRow[] = []
  let totalInterest = 0
  let totalPaid = 0
  for (let month = 1; month <= 1200; month += 1) {
    const interests = new Map<string, number>()
    for (const debt of active) {
      const balance = balances.get(debt.id) || 0
      const interest = balance * debt.annualRate / 12
      interests.set(debt.id, interest)
      balances.set(debt.id, balance + interest)
      totalInterest += interest
    }
    let paidThisMonth = 0
    for (const debt of active) {
      const due = balances.get(debt.id) || 0
      const payment = Math.min(due, debt.minimumPayment)
      balances.set(debt.id, due - payment)
      paidThisMonth += payment
    }
    let available = Math.max(0, openingBudget - paidThisMonth)
    for (const debt of order) {
      if (available <= 0) break
      const due = balances.get(debt.id) || 0
      const payment = Math.min(due, available)
      balances.set(debt.id, due - payment)
      available -= payment
      paidThisMonth += payment
    }
    const remaining = [...balances.values()].reduce((sum, balance) => sum + balance, 0)
    totalPaid += paidThisMonth
    rows.push({ month, payment: paidThisMonth, interest: [...interests.values()].reduce((sum, interest) => sum + interest, 0), balance: remaining })
    if (remaining < 0.01) return { rows, totalInterest, totalPaid, months: month, paidOff: true }
    if (paidThisMonth <= 0) break
  }
  return { rows, totalInterest, totalPaid, months: rows.length, paidOff: false }
}

export type TaxInput = {
  salary: number
  age: number
  resident: boolean
  section80C: number
  healthSelf: number
  healthParents: number
  parentsSenior: boolean
  section24: number
  basicSalary: number
  dearnessAllowance: number
  hraReceived: number
  annualRent: number
  metro: boolean
}
export type TaxResult = { regime: 'old' | 'new'; taxable: number; tax: number; rebate: number; surcharge: number; cess: number; total: number }
const slabTax = (taxable: number, slabs: Array<[number, number]>) => {
  let remaining = Math.max(taxable, 0)
  let lower = 0
  let tax = 0
  for (const [upper, rate] of slabs) {
    const amount = Math.max(0, Math.min(remaining, upper - lower))
    tax += amount * rate
    remaining -= amount
    lower = upper
  }
  if (remaining > 0) tax += remaining * (slabs[slabs.length - 1]?.[1] || 0)
  return tax
}

function applyRebateAndSurcharge(tax: number, taxable: number, regime: 'old' | 'new', resident: boolean, slabs: Array<[number, number]>) {
  const rebateLimit = regime === 'new' ? 12_00_000 : 5_00_000
  const rebateCap = regime === 'new' ? 60_000 : 12_500
  const rebate = resident && taxable <= rebateLimit ? Math.min(tax, rebateCap) : resident && taxable > rebateLimit && taxable - rebateLimit < tax ? Math.max(0, tax - (taxable - rebateLimit)) : 0
  const taxAfterRebate = Math.max(0, tax - rebate)
  const surchargeRate = taxable > 50_00_000 ? taxable > 1_00_00_000 ? taxable > 2_00_00_000 ? regime === 'new' || taxable <= 5_00_00_000 ? 0.25 : 0.37 : 0.15 : 0.10 : 0
  let surcharge = taxAfterRebate * surchargeRate
  const threshold = regime === 'old' && taxable > 5_00_00_000 ? 5_00_00_000 : taxable > 2_00_00_000 && (regime === 'new' || taxable <= 5_00_00_000) ? 2_00_00_000 : taxable > 1_00_00_000 ? 1_00_00_000 : taxable > 50_00_000 ? 50_00_000 : 0
  if (threshold > 0) {
    const taxAtThreshold = slabTax(threshold, slabs)
    const cappedTax = Math.max(0, taxAtThreshold - (resident && threshold <= rebateLimit ? Math.min(taxAtThreshold, rebateCap) : 0))
    surcharge = Math.min(surcharge, Math.max(0, taxable - threshold + cappedTax - taxAfterRebate))
  }
  return { rebate, surcharge, cess: (taxAfterRebate + surcharge) * .04, total: (taxAfterRebate + surcharge) * 1.04 }
}

/** Indicative salaried-individual comparison for Indian Tax Year 2026–27. */
export function estimateTax(input: TaxInput): { old: TaxResult; new: TaxResult } {
  const salary = Number.isFinite(input.salary) ? Math.max(0, input.salary) : 0
  const age = Number.isFinite(input.age) ? Math.max(18, input.age) : 30
  const resident = input.resident === true
  const oldSlabs: Array<[number, number]> = age >= 80
    ? [[5_00_000, 0], [5_00_000, .20], [Infinity, .30]]
    : age >= 60
      ? [[3_00_000, 0], [2_00_000, .05], [5_00_000, .20], [Infinity, .30]]
      : [[2_50_000, 0], [2_50_000, .05], [5_00_000, .20], [Infinity, .30]]
  const newSlabs: Array<[number, number]> = [[4_00_000, 0], [4_00_000, .05], [4_00_000, .10], [4_00_000, .15], [4_00_000, .20], [4_00_000, .25], [Infinity, .30]]
  const basic = Math.max(0, Number(input.basicSalary) || 0) + Math.max(0, Number(input.dearnessAllowance) || 0)
  const hra = Math.max(0, Math.min(
    Number(input.hraReceived) || 0,
    (Number(input.annualRent) || 0) - basic * .10,
    basic * (input.metro ? .50 : .40),
  ))
  const section80C = Math.min(Math.max(0, input.section80C || 0), 1_50_000)
  const healthSelfCap = age >= 60 ? 50_000 : 25_000
  const healthParentsCap = input.parentsSenior ? 50_000 : 25_000
  const healthDeductions = Math.min(Math.max(0, input.healthSelf || 0), healthSelfCap) + Math.min(Math.max(0, input.healthParents || 0), healthParentsCap)
  const oldStandardDeduction = 50_000
  const newStandardDeduction = 75_000
  const oldTaxable = Math.max(0, salary - oldStandardDeduction - section80C - healthDeductions - Math.min(Math.max(0, input.section24 || 0), 2_00_000) - hra)
  const newTaxable = Math.max(0, salary - newStandardDeduction)
  const oldBase = slabTax(oldTaxable, oldSlabs)
  const newBase = slabTax(newTaxable, newSlabs)
  const result = (regime: 'old' | 'new', taxable: number, base: number, slabs: Array<[number, number]>): TaxResult => ({ regime, taxable, tax: base, ...applyRebateAndSurcharge(base, taxable, regime, resident, slabs) })
  return { old: result('old', oldTaxable, oldBase, oldSlabs), new: result('new', newTaxable, newBase, newSlabs) }
}
