import { useMemo, useState } from 'react'
import { amortization, cagr, debtPayoff, estimateTax, xirr, type CashFlow, type Debt } from '../../domain/finance.ts'
import type { PlanningState } from '../../domain/planning.ts'

const money = (n: number) => `₹${Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`
const percent = (n: number | null) => n === null ? '—' : `${(n * 100).toFixed(1)}%`
function toDateInput(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) }
function todayInput() { return toDateInput(new Date()) }

export function AdvancedPage({ notify, planning, onPlanningChange }: { notify: (message: string) => void; planning: PlanningState; onPlanningChange: (update: Partial<PlanningState>) => void }) {
  const flows = planning.flows
  const [flowDate, setFlowDate] = useState(todayInput)
  const [flowAmount, setFlowAmount] = useState('')
  const [flowType, setFlowType] = useState<'contribution' | 'valuation'>('contribution')
  const { equity, retirement, gold, cash } = planning.portfolio
  const flowObjects: Array<CashFlow & { id: string }> = flows.map(flow => ({ ...flow, date: new Date(`${flow.date}T12:00:00`) }))
  const xirrValue = xirr(flowObjects)
  const cagrValue = cagr(planning.cagr.startValue, planning.cagr.endValue, planning.cagr.years)
  const total = equity + retirement + gold + cash
  const allocations = [['Equity & funds', equity, '#7564b8'], ['EPF / PPF / NPS', retirement, '#4f91a1'], ['Gold', gold, '#d18b45'], ['Liquid cash', cash, '#20a77b']] as const
  const totalBase = Math.max(total, 1)

  function updateFlow(id: string, changes: Partial<{ date: string; amount: number }>) {
    onPlanningChange({ flows: flows.map(flow => flow.id === id ? { ...flow, ...changes } : flow) })
  }
  function addFlow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(flowAmount)
    if (!Number.isFinite(amount) || amount <= 0 || !flowDate) return
    const date = new Date(`${flowDate}T12:00:00`)
    const next = [...flows, { id: crypto.randomUUID(), date: toDateInput(date), amount: flowType === 'contribution' ? -amount : amount }].sort((a, b) => a.date.localeCompare(b.date))
    onPlanningChange({ flows: next })
    setFlowAmount('')
    notify('Investment cash flow added locally')
  }

  return <div className="advanced-stack">
    <section className="section-head compact"><div><div className="eyebrow">ADVANCED ANALYTICS</div><h2>Know the rate behind the story.</h2></div><button className="text-button" onClick={() => notify('All calculations run locally in your browser')}>ⓘ Offline calculations</button></section>
    <div className="advanced-grid">
      <div className="advanced-card xirr-card"><div className="eyebrow">TRUE XIRR · IRREGULAR CASH FLOWS</div><h3>{percent(xirrValue)}</h3><p>Annualized from your dated contributions and current portfolio value using actual day counts.</p>
        <form className="cashflow-form" onSubmit={addFlow}><label>Cash flow date<input type="date" value={flowDate} onChange={event => setFlowDate(event.target.value)} /></label><label>Amount<input type="number" min="1" value={flowAmount} onChange={event => setFlowAmount(event.target.value)} placeholder="₹ amount" /></label><label>Type<select value={flowType} onChange={event => setFlowType(event.target.value as 'contribution' | 'valuation')}><option value="contribution">Contribution</option><option value="valuation">Portfolio value / redemption</option></select></label><button className="secondary">Add flow</button></form>
        {flows.length === 0 && <p className="tax-note">Add contributions and a current portfolio value or redemption to calculate XIRR.</p>}
        <div className="cashflow-list">{flows.map(flow => <div key={flow.id}><input aria-label="Cash flow date" type="date" value={flow.date} onChange={event => { if (event.target.value) updateFlow(flow.id, { date: event.target.value }) }} /><span className={flow.amount < 0 ? 'muted' : 'green'}>{flow.amount < 0 ? '−' : '+'}{money(Math.abs(flow.amount))}</span><button className="icon-button" aria-label="Remove cash flow" onClick={() => onPlanningChange({ flows: flows.filter(item => item.id !== flow.id) })}>×</button></div>)}</div>
      </div>
      <div className="allocation-card"><div className="card-title"><span>PORTFOLIO · CURRENT VALUE</span><small>Saved in your local vault</small></div><div className="allocation-body"><div className="allocation-donut" style={{ background: `conic-gradient(#7564b8 0 ${equity / totalBase * 100}%, #4f91a1 ${equity / totalBase * 100}% ${(equity + retirement) / totalBase * 100}%, #d18b45 ${(equity + retirement) / totalBase * 100}% ${(equity + retirement + gold) / totalBase * 100}%, #20a77b ${(equity + retirement + gold) / totalBase * 100}% 100%)` }}><b>{money(total)}</b></div><div className="allocation-legend">{allocations.map(([name, value, color], index) => <label key={name}><span><i style={{ background: color }} />{name}</span><input aria-label={`${name} value`} type="number" min="0" value={value} onChange={event => { const keys = ['equity', 'retirement', 'gold', 'cash'] as const; onPlanningChange({ portfolio: { ...planning.portfolio, [keys[index]]: Math.max(0, Number(event.target.value)) } }) }} /><b>{Math.round(value / totalBase * 100)}%</b></label>)}</div></div></div>
    </div>
    <section className="advanced-card cagr-card"><div><div className="eyebrow">CAGR · LUMP-SUM GROWTH</div><h3>{percent(cagrValue)}</h3><p>Use CAGR for one start value and one end value over the chosen period. For SIPs, use XIRR above.</p></div><div className="form-row"><label>Starting value<input type="number" min="0" value={planning.cagr.startValue} onChange={event => onPlanningChange({ cagr: { ...planning.cagr, startValue: Math.max(0, Number(event.target.value)) } })} /></label><label>Ending value<input type="number" min="0" value={planning.cagr.endValue} onChange={event => onPlanningChange({ cagr: { ...planning.cagr, endValue: Math.max(0, Number(event.target.value)) } })} /></label><label>Years<input type="number" min=".01" step=".01" value={planning.cagr.years} onChange={event => onPlanningChange({ cagr: { ...planning.cagr, years: Math.max(.01, Number(event.target.value)) } })} /></label></div></section>
    <FireForecast currentPortfolio={equity + retirement + gold} value={planning.fire} onChange={fire => onPlanningChange({ fire })} />
  </div>
}

function FireForecast({ currentPortfolio, value, onChange }: { currentPortfolio: number; value: PlanningState['fire']; onChange: (value: PlanningState['fire']) => void }) {
  const { monthlySaving: monthlySave, monthlyExpenses: monthlySpend, annualReturn: returnRate, annualInflation: inflation } = value
  const fireCorpus = monthlySpend * 12 * 25
  const realReturn = (1 + returnRate / 100) / (1 + inflation / 100) - 1
  const monthlyReal = Math.pow(1 + realReturn, 1 / 12) - 1
  let monthsToFire: number | null = null
  if (currentPortfolio >= fireCorpus) monthsToFire = 0
  else if (monthlySave > 0 && realReturn > -1) {
    const future = (months: number) => currentPortfolio * Math.pow(1 + monthlyReal, months) + monthlySave * (monthlyReal === 0 ? months : (Math.pow(1 + monthlyReal, months) - 1) / monthlyReal)
    let low = 0; let high = 12 * 100
    if (future(high) >= fireCorpus) { while (low + 1 < high) { const mid = Math.floor((low + high) / 2); if (future(mid) >= fireCorpus) high = mid; else low = mid } monthsToFire = high }
  }
  const yearsToFire = monthsToFire === null ? null : monthsToFire / 12
  return <section className="fire-card fire-forecast"><div className="fire-copy"><div className="eyebrow">FIRE FORECAST · REAL RETURNS</div><h3>{monthlySpend <= 0 ? 'Enter your expenses' : yearsToFire === null ? 'Increase monthly savings' : yearsToFire === 0 ? 'Your target is reached' : `${yearsToFire.toFixed(1)} years`}</h3><p>Estimated time to a 25× annual-spend corpus, adjusted for inflation and the invested balance entered above.</p><div className="fire-note">Target corpus: <b>{money(fireCorpus)}</b> · Real return assumption: <b>{(realReturn * 100).toFixed(1)}%</b></div></div><div className="form-row"><label>Monthly saving<input type="number" min="0" value={monthlySave} onChange={event => onChange({ ...value, monthlySaving: Math.max(0, Number(event.target.value)) })} /></label><label>Monthly expenses<input type="number" min="0" value={monthlySpend} onChange={event => onChange({ ...value, monthlyExpenses: Math.max(0, Number(event.target.value)) })} /></label><label>Annual return %<input type="number" step=".1" value={returnRate} onChange={event => onChange({ ...value, annualReturn: Number(event.target.value) })} /></label><label>Annual inflation %<input type="number" step=".1" value={inflation} onChange={event => onChange({ ...value, annualInflation: Number(event.target.value) })} /></label></div></section>
}

export function TaxCompare({ value, onChange }: { value: PlanningState['tax']; onChange: (value: PlanningState['tax']) => void }) {
  const result = estimateTax({ ...value })
  const hraBase = value.basicSalary + value.dearnessAllowance
  const hraExemption = Math.max(0, Math.min(value.hraReceived, value.annualRent - hraBase * .1, hraBase * (value.metro ? .5 : .4)))
  const numberInput = (label: string, key: keyof PlanningState['tax']) => <label>{label}<input type="number" min="0" value={Number(value[key]) || 0} onChange={event => onChange({ ...value, [key]: Math.max(0, Number(event.target.value)) })} /></label>
  return <>
    <div className="form-row tax-inputs">
      {numberInput('Annual gross salary', 'salary')}
      <label>Age at tax-year end<input type="number" min="18" max="100" value={value.age} onChange={event => onChange({ ...value, age: Math.max(18, Math.min(100, Number(event.target.value) || 18)) })} /></label>
      <label>Residential status<select value={value.resident ? 'resident' : 'nonresident'} onChange={event => onChange({ ...value, resident: event.target.value === 'resident' })}><option value="resident">Resident</option><option value="nonresident">Non-resident</option></select></label>
      {numberInput('Section 123 · old 80C (up to ₹1.5L)', 'section80C')}
      {numberInput('Health cover · self/family', 'healthSelf')}
      {numberInput('Health cover · parents', 'healthParents')}
      <label className="switch-label"><input type="checkbox" checked={value.parentsSenior} onChange={event => onChange({ ...value, parentsSenior: event.target.checked })} /> Parent is a senior citizen</label>
      {numberInput('Self-occupied home loan interest · Sec 24(b)', 'section24')}
      {numberInput('Basic salary', 'basicSalary')}
      {numberInput('Dearness allowance', 'dearnessAllowance')}
      {numberInput('HRA received in the year', 'hraReceived')}
      {numberInput('Rent paid in the year', 'annualRent')}
      <label className="switch-label"><input type="checkbox" checked={value.metro} onChange={event => onChange({ ...value, metro: event.target.checked })} /> Metro HRA city (50% cap)</label>
    </div>
    <p className="tax-note light">Eligible HRA exemption estimate: <b>{money(hraExemption)}</b>. It is the lowest of HRA received, rent less 10% of basic + DA, and 40% or 50% of basic + DA.</p>
    <div className="regime-results"><div><span>OLD REGIME</span><b>{money(result.old.total)}</b><small>Taxable {money(result.old.taxable)} · rebate {money(result.old.rebate)} · cess included</small></div><div className={result.new.total <= result.old.total ? 'recommended' : ''}><span>NEW REGIME · {result.new.total <= result.old.total ? 'LOWER ESTIMATE' : 'COMPARISON'}</span><b>{money(result.new.total)}</b><small>Taxable {money(result.new.taxable)} · rebate {money(result.new.rebate)} · cess included</small></div></div>
    <p className="tax-note light">Indicative salaried-person estimate for Tax Year 2026–27. It uses ₹50,000 old-regime and ₹75,000 new-regime standard deductions, age-based old-regime slabs, resident 87A rebate and 4% cess. It does not cover capital gains, business income, employer NPS or detailed house-property loss rules. Confirm with the Income Tax Department or a tax professional before filing.</p>
  </>
}

export function DebtPage({ notify, planning, onPlanningChange }: { notify: (message: string) => void; planning: PlanningState; onPlanningChange: (update: Partial<PlanningState>) => void }) {
  const { debts, debtExtra: extra, debtStrategy: selected, emi } = planning
  const snowball = useMemo(() => debtPayoff(debts, extra, 'snowball'), [debts, extra])
  const avalanche = useMemo(() => debtPayoff(debts, extra, 'avalanche'), [debts, extra])
  const active = selected === 'snowball' ? snowball : avalanche
  const totalBalance = debts.reduce((sum, debt) => sum + Math.max(0, debt.balance), 0)
  const minimums = debts.reduce((sum, debt) => sum + Math.max(0, debt.minimumPayment), 0)
  function updateDebt(id: string, changes: Partial<Debt>) { onPlanningChange({ debts: debts.map(debt => debt.id === id ? { ...debt, ...changes } : debt) }) }
  function addDebt() { onPlanningChange({ debts: [...debts, { id: crypto.randomUUID(), name: '', balance: 0, annualRate: 0, minimumPayment: 0 }] }); notify('Add your actual loan details; no sample debt is included') }
  const hasUsableDebts = debts.some(debt => debt.balance > 0 && debt.minimumPayment > 0)

  return <div className="advanced-stack">
    <section className="budget-banner"><div><div className="eyebrow">DEBT CONTROL · LOCAL PLANNER</div><h2>Choose a payoff order you can stick with.</h2><p>Compare smallest-balance-first snowball with highest-rate-first avalanche. Your balances stay in the local vault.</p></div><button className="add-button" onClick={addDebt}>+ Add loan</button></section>
    {debts.length === 0 && <p className="tax-note">Add your loans to calculate payoff schedules. No sample balances are shown.</p>}
    <div className="debt-list">{debts.map(debt => <div className="debt-row" key={debt.id}><label>Loan name<input value={debt.name} onChange={event => updateDebt(debt.id, { name: event.target.value })} /></label><label>Outstanding balance<input type="number" min="0" value={debt.balance} onChange={event => updateDebt(debt.id, { balance: Math.max(0, Number(event.target.value)) })} /></label><label>Interest rate %<input type="number" min="0" step=".1" value={debt.annualRate} onChange={event => updateDebt(debt.id, { annualRate: Math.max(0, Number(event.target.value)) })} /></label><label>Minimum monthly payment<input type="number" min="0" value={debt.minimumPayment} onChange={event => updateDebt(debt.id, { minimumPayment: Math.max(0, Number(event.target.value)) })} /></label><button className="icon-button" onClick={() => onPlanningChange({ debts: debts.filter(item => item.id !== debt.id) })} aria-label={`Remove ${debt.name || 'loan'}`}>×</button></div>)}</div>
    <div className="strategy-grid"><button className={`strategy-card${selected === 'avalanche' ? ' active' : ''}`} onClick={() => onPlanningChange({ debtStrategy: 'avalanche' })}><span>AVALANCHE · HIGHEST RATE FIRST</span><b>{money(avalanche.totalInterest)} interest</b><small>{hasUsableDebts ? avalanche.paidOff ? `${avalanche.months} months to debt-free` : 'At current budget, payoff is not progressing' : 'Enter balances and minimum payments'}</small></button><button className={`strategy-card${selected === 'snowball' ? ' active' : ''}`} onClick={() => onPlanningChange({ debtStrategy: 'snowball' })}><span>SNOWBALL · SMALLEST BALANCE FIRST</span><b>{money(snowball.totalInterest)} interest</b><small>{hasUsableDebts ? snowball.paidOff ? `${snowball.months} months to debt-free` : 'At current budget, payoff is not progressing' : 'Enter balances and minimum payments'}</small></button></div>
    <div className="payoff-summary"><div><small>OUTSTANDING DEBT</small><b>{money(totalBalance)}</b></div><div><small>MONTHLY PAYMENT BUDGET</small><b>{money(minimums + extra)}</b></div><div><small>{selected.toUpperCase()} TOTAL INTEREST</small><b>{money(active.totalInterest)}</b></div><label>Extra each month<input type="number" min="0" value={extra} onChange={event => onPlanningChange({ debtExtra: Math.max(0, Number(event.target.value)) })} /></label></div>
    <section className="loan-card"><div className="card-title"><span>{selected.toUpperCase()} PAYOFF PROJECTION</span><small>{hasUsableDebts && active.paidOff ? `${active.months} months` : 'Projection needs complete loan inputs'}</small></div><div className="schedule-preview debt-schedule">{active.rows.slice(0, 12).map(row => <div key={row.month}><span>Month {row.month}</span><i style={{ width: `${Math.max(2, row.interest / Math.max(row.payment, 1) * 100)}%` }} /><b>{money(row.balance)}</b></div>)}</div></section>
    <AmortizationCard value={emi} onChange={value => onPlanningChange({ emi: value })} />
  </div>
}

function AmortizationCard({ value, onChange }: { value: PlanningState['emi']; onChange: (value: PlanningState['emi']) => void }) {
  const { principal, annualRate: rate, months, extraMonthly: extra } = value
  const schedule = useMemo(() => amortization(principal, rate / 100, months, extra), [principal, rate, months, extra])
  const payment = principal > 0 && months > 0 ? amortization(principal, rate / 100, months)[0]?.payment || 0 : 0
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0)
  return <section className="loan-card"><div className="card-title"><span>SINGLE-LOAN EMI AMORTIZATION</span><small>Monthly reducing balance</small></div><div className="form-row"><label>Principal<input type="number" min="0" value={principal} onChange={event => onChange({ ...value, principal: Math.max(0, Number(event.target.value)) })} /></label><label>APR %<input type="number" min="0" step=".1" value={rate} onChange={event => onChange({ ...value, annualRate: Math.max(0, Number(event.target.value)) })} /></label><label>Months<input type="number" min="1" max="1200" value={months} onChange={event => onChange({ ...value, months: Math.max(1, Math.min(1200, Number(event.target.value))) })} /></label><label>Extra monthly<input type="number" min="0" value={extra} onChange={event => onChange({ ...value, extraMonthly: Math.max(0, Number(event.target.value)) })} /></label></div><div className="loan-result"><div><small>BASE EMI</small><b>{money(payment)}</b></div><div><small>INTEREST WITH EXTRA</small><b>{money(totalInterest)}</b></div><div><small>PAYOFF TIME</small><b>{schedule.length ? `${schedule.length} months` : '—'}</b></div></div>{principal === 0 ? <p className="tax-note">Enter a principal amount to see the principal-versus-interest schedule.</p> : <div className="schedule-preview">{schedule.slice(0, 6).map(row => <div key={row.month}><span>Month {row.month}</span><i style={{ width: `${Math.min(row.interest / Math.max(row.payment, 1) * 100, 100)}%` }} /><b>{money(row.balance)}</b></div>)}</div>}</section>
}
