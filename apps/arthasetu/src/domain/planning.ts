import type { Debt } from './finance.ts'

export type InvestmentFlow = { id: string; date: string; amount: number }
export type PlanningState = {
  flows: InvestmentFlow[]
  portfolio: { equity: number; retirement: number; gold: number; cash: number }
  cagr: { startValue: number; endValue: number; years: number }
  fire: { monthlySaving: number; monthlyExpenses: number; annualReturn: number; annualInflation: number }
  debts: Debt[]
  debtExtra: number
  debtStrategy: 'snowball' | 'avalanche'
  emi: { principal: number; annualRate: number; months: number; extraMonthly: number }
  health: { liquidBalance: number | null; essentialMonthlySpend: number; monthlyDebtPayments: number }
  tax: {
    salary: number
    age: number
    resident: boolean
    parentsSenior: boolean
    section80C: number
    healthSelf: number
    healthParents: number
    section24: number
    basicSalary: number
    dearnessAllowance: number
    hraReceived: number
    annualRent: number
    metro: boolean
  }
}

export const DEFAULT_PLANNING: PlanningState = {
  flows: [],
  portfolio: { equity: 0, retirement: 0, gold: 0, cash: 0 },
  cagr: { startValue: 0, endValue: 0, years: 1 },
  fire: { monthlySaving: 0, monthlyExpenses: 0, annualReturn: 7, annualInflation: 6 },
  debts: [],
  debtExtra: 0,
  debtStrategy: 'avalanche',
  emi: { principal: 0, annualRate: 0, months: 180, extraMonthly: 0 },
  health: { liquidBalance: null, essentialMonthlySpend: 0, monthlyDebtPayments: 0 },
  tax: {
    salary: 0,
    age: 30,
    resident: true,
    parentsSenior: false,
    section80C: 0,
    healthSelf: 0,
    healthParents: 0,
    section24: 0,
    basicSalary: 0,
    dearnessAllowance: 0,
    hraReceived: 0,
    annualRent: 0,
    metro: false,
  },
}

const finiteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export function readPlanningState(value: unknown): PlanningState {
  if (!value || typeof value !== 'object') return DEFAULT_PLANNING
  const raw = value as Partial<PlanningState>
  const portfolio = raw.portfolio || DEFAULT_PLANNING.portfolio
  const cagr = raw.cagr || DEFAULT_PLANNING.cagr
  const fire = raw.fire || DEFAULT_PLANNING.fire
  const health = raw.health || DEFAULT_PLANNING.health
  const tax = raw.tax || DEFAULT_PLANNING.tax
  const numbers = [portfolio.equity, portfolio.retirement, portfolio.gold, portfolio.cash, cagr.startValue, cagr.endValue, cagr.years, fire.monthlySaving, fire.monthlyExpenses, fire.annualReturn, fire.annualInflation, raw.debtExtra, raw.emi?.principal, raw.emi?.annualRate, raw.emi?.months, raw.emi?.extraMonthly, health.essentialMonthlySpend, health.monthlyDebtPayments, tax.salary, tax.age, tax.section80C, tax.healthSelf, tax.healthParents, tax.section24, tax.basicSalary, tax.dearnessAllowance, tax.hraReceived, tax.annualRent]
  if (!numbers.every(Number.isFinite)) return DEFAULT_PLANNING
  const flows = Array.isArray(raw.flows) ? raw.flows.filter(flow => flow && typeof flow.id === 'string' && typeof flow.date === 'string' && Number.isFinite(Date.parse(flow.date)) && Number.isFinite(flow.amount)) : []
  const debts = Array.isArray(raw.debts) ? raw.debts.filter(debt => debt && typeof debt.id === 'string' && typeof debt.name === 'string' && finiteNonNegative(debt.balance) && finiteNonNegative(debt.annualRate) && finiteNonNegative(debt.minimumPayment)) : []
  return {
    flows,
    portfolio: { equity: Math.max(0, portfolio.equity), retirement: Math.max(0, portfolio.retirement), gold: Math.max(0, portfolio.gold), cash: Math.max(0, portfolio.cash) },
    cagr: { startValue: Math.max(0, cagr.startValue), endValue: Math.max(0, cagr.endValue), years: Math.max(.01, cagr.years) },
    fire: { monthlySaving: Math.max(0, fire.monthlySaving), monthlyExpenses: Math.max(0, fire.monthlyExpenses), annualReturn: fire.annualReturn, annualInflation: fire.annualInflation },
    debts,
    debtExtra: Math.max(0, Number(raw.debtExtra) || 0),
    debtStrategy: raw.debtStrategy === 'snowball' ? 'snowball' : 'avalanche',
    emi: { principal: Math.max(0, raw.emi?.principal || 0), annualRate: Math.max(0, raw.emi?.annualRate || 0), months: Math.max(1, Math.min(1200, Math.floor(raw.emi?.months || 180))), extraMonthly: Math.max(0, raw.emi?.extraMonthly || 0) },
    health: { liquidBalance: health.liquidBalance === null || health.liquidBalance === undefined ? null : Math.max(0, health.liquidBalance), essentialMonthlySpend: Math.max(0, health.essentialMonthlySpend), monthlyDebtPayments: Math.max(0, health.monthlyDebtPayments) },
    tax: { salary: Math.max(0, tax.salary), age: Math.max(18, Math.min(100, Math.floor(tax.age))), resident: tax.resident !== false, parentsSenior: tax.parentsSenior === true, section80C: Math.max(0, tax.section80C), healthSelf: Math.max(0, tax.healthSelf), healthParents: Math.max(0, tax.healthParents), section24: Math.max(0, tax.section24), basicSalary: Math.max(0, tax.basicSalary), dearnessAllowance: Math.max(0, tax.dearnessAllowance), hraReceived: Math.max(0, tax.hraReceived), annualRent: Math.max(0, tax.annualRent), metro: tax.metro === true },
  }
}
