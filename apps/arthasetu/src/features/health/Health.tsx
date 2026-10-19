import { useMemo, useState, type FormEvent } from 'react'
import { ProGate } from '../license/Paywall.tsx'
import type { PlanId } from '../license/useLicense.tsx'
import type { PlanningState } from '../../domain/planning.ts'

const money = (n: number) => `₹${Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`
export type Account = { id: string; name: string; kind: string; balance: number; lastFour: string; tone: 'green' | 'blue' }
export type Mandate = { id: string; name: string; amount: number; nextRenewal: string; frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly' }

type TiltCardProps = { balance: number; label: string; lastFour: string; tone: 'green' | 'blue'; kind: string }
function TiltCard({ balance, label, lastFour, tone, kind }: TiltCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  return <div className={`tilt-wrap ${tone}`} onMouseMove={event => { const box = event.currentTarget.getBoundingClientRect(); setTilt({ x: (event.clientY - box.top - box.height / 2) / 13, y: -(event.clientX - box.left - box.width / 2) / 13 }) }} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
    <div className="credit-card" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}><div className="card-shine" /><div className="card-top"><b>ArthaSetu</b><span>{tone === 'blue' ? 'VISA' : 'BANK'}</span></div><div className="chip"><i /><i /><i /></div><div className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; {lastFour}</div><div className="card-bottom"><span>{kind} · {label}<b>{money(balance)}</b></span><span className="contactless">)))</span></div></div>
  </div>
}

function dateDistance(dateText: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateText}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function nextMonth(dateText: string) {
  const date = new Date(`${dateText}T12:00:00`)
  const day = date.getDate()
  date.setDate(1); date.setMonth(date.getMonth() + 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function nextRenewalDate(dateText: string, frequency: NonNullable<Mandate['frequency']>) {
  if (frequency === 'monthly') return nextMonth(dateText)
  const date = new Date(`${dateText}T12:00:00`)
  const oldMonth = date.getMonth()
  const oldDay = date.getDate()
  if (frequency === 'weekly') date.setDate(date.getDate() + 7)
  if (frequency === 'quarterly') date.setMonth(date.getMonth() + 3)
  if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1)
  if (date.getDate() !== oldDay && (frequency === 'quarterly' || frequency === 'yearly')) date.setDate(0)
  if (frequency === 'quarterly' && date.getMonth() === oldMonth) date.setDate(oldDay)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthlyAmount(item: Mandate) {
  const frequency = item.frequency || 'monthly'
  return item.amount * (frequency === 'weekly' ? 52 / 12 : frequency === 'quarterly' ? 1 / 3 : frequency === 'yearly' ? 1 / 12 : 1)
}

export function HealthPage({ income, expenses, notify, onCheckout, accounts, mandates, onAccountsChange, onMandatesChange, settings, onSettingsChange }: { income: number; expenses: number; notify: (message: string) => void; onCheckout: (plan: PlanId) => void; accounts: Account[]; mandates: Mandate[]; onAccountsChange: (accounts: Account[]) => void; onMandatesChange: (mandates: Mandate[]) => void; settings: PlanningState['health']; onSettingsChange: (settings: PlanningState['health']) => void }) {
  const accountLiquidity = accounts.filter(account => !account.kind.toLowerCase().includes('credit')).reduce((sum, account) => sum + account.balance, 0)
  const liquid = settings.liquidBalance ?? accountLiquidity
  const essential = settings.essentialMonthlySpend
  const monthlyDebtPayment = settings.monthlyDebtPayments
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountBalance, setAccountBalance] = useState('')
  const [accountKind, setAccountKind] = useState('Bank account')
  const [accountLastFour, setAccountLastFour] = useState('')
  const survival = essential > 0 ? liquid / essential : 0
  const savingsRate = income > 0 ? Math.max(0, Math.min(1, (income - expenses) / income)) : 0
  const debtRatio = income > 0 ? monthlyDebtPayment / income : 1
  const score = Math.min(100, Math.round(Math.min(survival / 6, 1) * 40 + Math.min(savingsRate / .2, 1) * 35 + Math.max(0, 1 - debtRatio / .4) * 25))
  const scoreColor = score > 80 ? '#2e9b78' : score > 60 ? '#d18b45' : '#d96758'
  const categories = useMemo(() => [{ name: 'Food & Dining', color: '#d96758', icon: '◉' }, { name: 'Wellness', color: '#2e9b78', icon: '✦' }, { name: 'Travel', color: '#4f91a1', icon: '↗' }], [])

  function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = [...accounts, { id: crypto.randomUUID(), name: accountName.trim().toUpperCase(), kind: accountKind, balance: Number(accountBalance), lastFour: accountLastFour, tone: accounts.length % 2 === 0 ? 'green' as const : 'blue' as const }]
    onAccountsChange(next); setShowAccountForm(false); setAccountName(''); setAccountBalance(''); setAccountLastFour(''); notify('Account added to this device')
  }

  return <div className="health-stack">
    <section className="section-head compact"><div><div className="eyebrow">FINANCIAL HEALTH INDEX</div><h2>A clearer picture of your resilience.</h2><p className="subtitle">A private score from your cash buffer, ledger savings rate and debt payments.</p></div><button className="secondary" onClick={() => notify('Health score recalculated locally')}>↻ Recalculate</button></section>
    <ProGate feature="fire_forecast" onCheckout={onCheckout}><div className="health-grid"><div className="score-card"><div className="score-ring" style={{ background: `conic-gradient(${scoreColor} ${score * 3.6}deg, #dce9df 0)` }}><div><strong>{score}</strong><small>/ 100</small></div></div><div><div className="eyebrow">YOUR INDEX</div><h3>{score > 80 ? 'Strong resilience' : score > 60 ? 'Building momentum' : 'Build your buffer'}</h3><p>{survival.toFixed(1)} months of essential expenses are covered. Your savings rate from the ledger is {(savingsRate * 100).toFixed(0)}%.</p></div></div>
      <div className="survival-card"><div className="card-title"><span>EMERGENCY FUND</span><small>{survival.toFixed(1)} survival months</small></div><div className="meter"><i style={{ width: `${Math.min(survival / 12 * 100, 100)}%`, background: survival >= 6 ? '#2e9b78' : survival >= 3 ? '#d18b45' : '#d96758' }} /></div><div className="meter-labels"><span>Unsafe</span><span>Healthy at 6 months</span><span>12 months</span></div><div className="form-row health-inputs"><label>Liquid balance<input type="number" min="0" value={liquid} onChange={event => onSettingsChange({ ...settings, liquidBalance: Math.max(0, Number(event.target.value)) })} /></label><label>Essential monthly spend<input type="number" min="0" value={essential} onChange={event => onSettingsChange({ ...settings, essentialMonthlySpend: Math.max(0, Number(event.target.value)) })} /></label><label>Monthly debt payments<input type="number" min="0" value={monthlyDebtPayment} onChange={event => onSettingsChange({ ...settings, monthlyDebtPayments: Math.max(0, Number(event.target.value)) })} /></label></div></div>
    </div></ProGate>
    <section className="health-section"><div className="section-head compact"><div><div className="eyebrow">CARDS & ACCOUNTS</div><h2>Your accounts at a glance.</h2></div>{accounts.length < 2 ? <button className="text-button" onClick={() => setShowAccountForm(true)}>+ Add account</button> : <ProGate feature="account_limit" onCheckout={onCheckout}><button className="text-button" onClick={() => setShowAccountForm(true)}>+ Add account</button></ProGate>}</div>
      <div className="cards-3 tilt-cards">{accounts.map(account => <TiltCard key={account.id} balance={account.balance} label={account.name} lastFour={account.lastFour} tone={account.tone} kind={account.kind} />)}{accounts.length === 0 && <div className="empty-card">Add your first account to see its local balance here.</div>}</div>
      {showAccountForm && <form className="inline-create account-create" onSubmit={saveAccount}><label>Account name<input required value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="e.g. ICICI Savings" /></label><label>Type<select value={accountKind} onChange={event => setAccountKind(event.target.value)}><option>Bank account</option><option>Credit card</option><option>Wallet</option><option>Investment account</option></select></label><label>Balance<input required type="number" min="0" value={accountBalance} onChange={event => setAccountBalance(event.target.value)} /></label><label>Last four digits<input required inputMode="numeric" maxLength={4} value={accountLastFour} onChange={event => setAccountLastFour(event.target.value.replace(/\D/g, ''))} /></label><div><button className="secondary" type="button" onClick={() => setShowAccountForm(false)}>Cancel</button><button className="add-button">Save account</button></div></form>}
    </section>
    <section className="health-modules"><MandateTracker mandates={mandates} onMandatesChange={onMandatesChange} onCheckout={onCheckout} notify={notify} /></section>
    <section className="category-section"><div className="section-head compact"><div><div className="eyebrow">PERSONAL SYSTEM</div><h2>Custom categories</h2></div><button className="add-button" onClick={() => notify('Custom category editor is planned for a later release')}>+ Add category</button></div><div className="category-pills">{categories.map(category => <span key={category.name} style={{ borderColor: category.color, color: category.color }}><b style={{ background: category.color }}>{category.icon}</b>{category.name}</span>)}</div></section>
  </div>
}

function MandateTracker({ mandates, onMandatesChange, onCheckout, notify }: { mandates: Mandate[]; onMandatesChange: (mandates: Mandate[]) => void; onCheckout: (plan: PlanId) => void; notify: (message: string) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [renewal, setRenewal] = useState('')
  const [frequency, setFrequency] = useState<NonNullable<Mandate['frequency']>>('monthly')
  const monthlyTotal = mandates.reduce((sum, item) => sum + monthlyAmount(item), 0)
  const dueSoon = mandates.filter(item => dateDistance(item.nextRenewal) >= 0 && dateDistance(item.nextRenewal) <= 7)

  function update(next: Mandate[]) { onMandatesChange(next) }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || Number(amount) <= 0 || !renewal) return
    update([...mandates, { id: crypto.randomUUID(), name: name.trim(), amount: Number(amount), nextRenewal: renewal, frequency }])
    setName(''); setAmount(''); setRenewal(''); setShowForm(false); notify('Recurring bill saved locally')
  }
  function markPaid(item: Mandate) {
    let nextDate = nextRenewalDate(item.nextRenewal, item.frequency || 'monthly')
    while (dateDistance(nextDate) < 0) nextDate = nextRenewalDate(nextDate, item.frequency || 'monthly')
    update(mandates.map(entry => entry.id === item.id ? { ...entry, nextRenewal: nextDate } : entry))
    notify(`${item.name} reminder moved to ${nextDate}`)
  }

  return <ProGate feature="mandate_tracker" onCheckout={onCheckout}><div className="survival-card mandate-card"><div className="card-title"><span>SUBSCRIPTIONS & BILLS</span><small>{money(monthlyTotal)} / month</small></div><p className="module-subtitle">Renewal dates and reminders are stored on this device.</p>{dueSoon.length > 0 && <div className="renewal-alert">{dueSoon.length} bill{dueSoon.length === 1 ? '' : 's'} due in the next 7 days · {money(dueSoon.reduce((sum, item) => sum + item.amount, 0))}</div>}
    <div className="mandate-list">{mandates.map(item => { const days = dateDistance(item.nextRenewal); return <div className="subscription" key={item.id}><i className="sub-icon blue-icon">{item.name.slice(0, 1).toUpperCase()}</i><span><b>{item.name}</b><small>{days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Renews today' : `Renews in ${days} days`} · {item.nextRenewal} · {item.frequency || 'monthly'}</small></span><strong>{money(item.amount)}</strong><button className="text-button" onClick={() => markPaid(item)}>Mark paid</button></div> })}</div>
    <button className="text-button mandate-add" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add bill or subscription'}</button>
    {showForm && <form className="inline-create mandate-create" onSubmit={add}><label>Name<input required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Electricity" /></label><label>Amount<input required type="number" min="1" value={amount} onChange={event => setAmount(event.target.value)} /></label><label>Frequency<select value={frequency} onChange={event => setFrequency(event.target.value as NonNullable<Mandate['frequency']>)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label><label>Next renewal<input required type="date" value={renewal} onChange={event => setRenewal(event.target.value)} /></label><button className="add-button">Save reminder</button></form>}
  </div></ProGate>
}
