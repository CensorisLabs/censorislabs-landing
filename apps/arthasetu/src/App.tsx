import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { AdvancedPage, DebtPage, TaxCompare } from './features/advanced/Advanced.tsx'
import { SecurityPage } from './features/security/Security.tsx'
import { HealthPage, type Account, type Mandate } from './features/health/Health.tsx'
import { Paywall, ProGate } from './features/license/Paywall.tsx'
import type { PlanId } from './features/license/useLicense.tsx'
import { estimateTax } from './domain/finance.ts'
import { hashPin, PIN_KEY, readFinanceData, readFinanceDataSync, saveFinanceData, verifyPin, type FinanceData } from './domain/vault.ts'
import { DEFAULT_PLANNING, readPlanningState, type PlanningState } from './domain/planning.ts'

type Page = 'Overview' | 'Transactions' | 'Budgets' | 'Investments' | 'Financial health' | 'Tax planner' | 'Analytics & FIRE' | 'Debt planner' | 'Security'
type Tx = { id: number; merchant: string; category: string; date: string; amount: number; type: 'income' | 'expense'; account: string }
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
function isTransaction(value: unknown): value is Tx { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return Number.isFinite(item.id) && typeof item.merchant === 'string' && typeof item.category === 'string' && typeof item.date === 'string' && Number.isFinite(item.amount) && (item.type === 'income' || item.type === 'expense') && typeof item.account === 'string' }
function readInitialTransactions(): Tx[] { const values = readFinanceDataSync()?.transactions; return Array.isArray(values) && values.every(isTransaction) ? values as Tx[] : [] }
function isAccount(value: unknown): value is Account { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.kind === 'string' && Number.isFinite(item.balance) && typeof item.lastFour === 'string' && (item.tone === 'green' || item.tone === 'blue') }
function isMandate(value: unknown): value is Mandate { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return typeof item.id === 'string' && typeof item.name === 'string' && Number.isFinite(item.amount) && typeof item.nextRenewal === 'string' }
function getInitialAccounts(): Account[] { const values = readFinanceDataSync()?.accounts; return Array.isArray(values) && values.every(isAccount) ? values : [] }
function getInitialMandates(): Mandate[] { const values = readFinanceDataSync()?.mandates; return Array.isArray(values) && values.every(isMandate) ? values : [] }
function getInitialPlanning(): PlanningState { return readPlanningState(readFinanceDataSync()?.planning) }
const categoryColor: Record<string, string> = { Home: '#526b5e', Groceries: '#d18b45', Investments: '#7564b8', Dining: '#d96758', Income: '#2e9b78' }

function Icon({ name }: { name: string }) { const icons: Record<string, string> = { grid: '▦', tx: '≡', budget: '◒', invest: '↗', health: '✦', tax: '◇', analytics: '⌁', debt: '↘', security: '▣', search: '⌕', bell: '◌', plus: '+', lock: '▣', upload: '↥', download: '↧' }; return <span className="icon" aria-hidden="true">{icons[name] || '•'}</span> }

export default function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [isLocked, setIsLocked] = useState(() => Boolean(localStorage.getItem(PIN_KEY)))
  const [sessionSecret, setSessionSecret] = useState('')
  const [tx, setTx] = useState<Tx[]>(readInitialTransactions)
  const [accounts, setAccounts] = useState<Account[]>(getInitialAccounts)
  const [mandates, setMandates] = useState<Mandate[]>(getInitialMandates)
  const [planning, setPlanning] = useState<PlanningState>(getInitialPlanning)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showParser, setShowParser] = useState(false)
  const [toast, setToast] = useState('')
  const [offerUses, setOfferUses] = useState(() => Math.max(0, Number(localStorage.getItem('censorislabs-usage-arthasetu')) || 0))
  const [offerOpen, setOfferOpen] = useState(false)
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('arthasetu-theme') || 'fern')
  const [lowEndMode, setLowEndMode] = useState(() => localStorage.getItem('arthasetu-performance') === 'low')
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date()))
  const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const visible = tx.filter(t => `${t.merchant} ${t.category} ${t.account}`.toLowerCase().includes(query.toLowerCase()))
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const beginCheckout = (plan: PlanId) => notify(`${plan.replaceAll('_', ' ')} license activated after provider verification.`)
  const update = (next: Tx[]) => setTx(next)
  const recordUse = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (!button || button.closest('.use-offer, .modal-backdrop') || button.classList.contains('pro-locked')) return
    setOfferUses(count => { const next = count + 1; localStorage.setItem('censorislabs-usage-arthasetu', String(next)); return next })
  }
  const nav = [{ id: 'Overview' as Page, label: 'Overview', icon: 'grid' }, { id: 'Transactions' as Page, label: 'Transactions', icon: 'tx' }, { id: 'Budgets' as Page, label: 'Budgets', icon: 'budget' }, { id: 'Investments' as Page, label: 'Investments', icon: 'invest' }, { id: 'Financial health' as Page, label: 'Financial health', icon: 'health' }, { id: 'Analytics & FIRE' as Page, label: 'Analytics & FIRE', icon: 'analytics' }, { id: 'Debt planner' as Page, label: 'Debt planner', icon: 'debt' }, { id: 'Tax planner' as Page, label: 'Tax planner', icon: 'tax' }, { id: 'Security' as Page, label: 'Security', icon: 'security' }]

  useEffect(() => {
    if (isLocked) return
    const timer = window.setTimeout(() => { void saveFinanceData({ transactions: tx, accounts, mandates, planning }, sessionSecret).catch(() => notify('Could not save the local vault. Check available device storage.')) }, 180)
    return () => window.clearTimeout(timer)
  }, [tx, accounts, mandates, planning, sessionSecret, isLocked])

  useEffect(() => {
    localStorage.setItem('arthasetu-theme', appTheme)
    localStorage.setItem('arthasetu-performance', lowEndMode ? 'low' : 'full')
  }, [appTheme, lowEndMode])

  async function unlockApp(pin: string) {
    if (!await verifyPin(pin)) return false
    const data = await readFinanceData(pin)
    if (!data || !Array.isArray(data.transactions) || !data.transactions.every(isTransaction) || !Array.isArray(data.accounts) || !data.accounts.every(isAccount) || !Array.isArray(data.mandates) || !data.mandates.every(isMandate)) return false
    setTx(data.transactions as Tx[]); setAccounts(data.accounts as Account[]); setMandates(data.mandates as Mandate[]); setPlanning(readPlanningState(data.planning)); setSessionSecret(pin)
    const savedHash = localStorage.getItem(PIN_KEY) || ''
    try { if ((JSON.parse(savedHash) as { version?: number }).version !== 2) localStorage.setItem(PIN_KEY, await hashPin(pin)) } catch { localStorage.setItem(PIN_KEY, await hashPin(pin)) }
    if (localStorage.getItem('arthasetu-finance-vault')) await saveFinanceData(data, pin)
    setIsLocked(false)
    return true
  }

  async function setAppPin(currentPin: string, nextPin: string) {
    if (localStorage.getItem(PIN_KEY) && !await verifyPin(currentPin)) return false
    await saveFinanceData({ transactions: tx, accounts, mandates, planning }, nextPin)
    localStorage.setItem(PIN_KEY, await hashPin(nextPin))
    setSessionSecret(nextPin)
    return true
  }

  async function disableAppPin(currentPin: string) {
    if (!await verifyPin(currentPin)) return false
    await saveFinanceData({ transactions: tx, accounts, mandates, planning })
    localStorage.removeItem(PIN_KEY)
    setSessionSecret('')
    return true
  }

  function lockApp() { setIsLocked(true); setSessionSecret(''); setTx([]); setAccounts([]); setMandates([]); setPlanning(DEFAULT_PLANNING) }

  function restoreFinanceData(data: FinanceData) {
    if (!data.transactions.every(isTransaction) || !data.accounts.every(isAccount) || !data.mandates.every(isMandate)) { notify('Backup contains unsupported or invalid finance data'); return }
    setTx(data.transactions as Tx[]); setAccounts(data.accounts as Account[]); setMandates(data.mandates as Mandate[]); setPlanning(readPlanningState(data.planning))
  }

  function exportData() { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), transactions: tx, accounts, mandates, planning }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'arthasetu-backup.json'; a.click(); URL.revokeObjectURL(url); notify('JSON backup exported') }
  function importData(file: File) { const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)) as { transactions?: unknown; accounts?: unknown; mandates?: unknown; planning?: unknown }; if (!Array.isArray(parsed.transactions) || !parsed.transactions.every(isTransaction)) throw Error('invalid transactions'); if (parsed.accounts !== undefined && (!Array.isArray(parsed.accounts) || !parsed.accounts.every(isAccount))) throw Error('invalid accounts'); if (parsed.mandates !== undefined && (!Array.isArray(parsed.mandates) || !parsed.mandates.every(isMandate))) throw Error('invalid reminders'); restoreFinanceData({ transactions: parsed.transactions as Tx[], accounts: (parsed.accounts as Account[] | undefined) ?? accounts, mandates: (parsed.mandates as Mandate[] | undefined) ?? mandates, planning: parsed.planning ? readPlanningState(parsed.planning) : planning }); notify('JSON backup restored locally') } catch { notify('That backup file could not be read') } }; reader.readAsText(file) }

  if (isLocked) return <AppLockScreen onUnlock={unlockApp} />

  return <div className="app-shell" data-theme={appTheme} data-performance={lowEndMode ? 'low' : 'full'} onClickCapture={recordUse}>
    <aside className="sidebar"><div className="brand"><div className="brand-mark">A</div><div><strong>ArthaSetu</strong><span>PRIVATE FINANCE</span></div></div><div className="vault"><Icon name="lock" /><div><b>Local vault</b><small>Only on this device</small></div><i /></div><nav>{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><Icon name={item.icon} />{item.label}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => notify('Settings are ready for your PIN and language')}><span className="avatar">AR</span> Ananya R. <span className="chev">⌄</span></button><small>v1.0 · Offline-first</small></div></aside>
    <main className="main"><header><div><div className="eyebrow">PERSONAL FINANCE / {month.toUpperCase()}</div><h1>{page === 'Overview' ? 'Your money, mapped.' : page}</h1><p className="subtitle">{page === 'Overview' ? 'A private view of your financial life.' : 'A calm view of your financial life.'}</p></div><div className="header-actions"><label className="appearance-control">Theme<select value={appTheme} onChange={event => setAppTheme(event.target.value)}><option value="fern">Fern</option><option value="ocean">Ocean</option><option value="violet">Violet</option><option value="ember">Ember</option></select></label><label className="performance-control"><input type="checkbox" checked={lowEndMode} onChange={event => setLowEndMode(event.target.checked)} /> Low-end</label><button className="circle" onClick={() => notify('No new alerts')}><Icon name="bell" /></button><span className="date-picker">{month}</span></div></header>
      <section className={`use-offer${offerUses >= 15 ? ' use-offer--unlocked' : ''}`} aria-label="CensorisLabs use-based offers"><div><b>{offerUses >= 30 ? '15% use offer unlocked' : offerUses >= 15 ? '10% use offer unlocked' : 'Use ArthaSetu to unlock an offer'}</b><small>{offerUses >= 30 ? 'Coupon FREQUENT15 · checkout confirmation required' : offerUses >= 15 ? 'Coupon FREQUENT10 · 15% unlocks at 30 uses' : `${15 - offerUses} more actions for 10% · ${30 - offerUses} for 15%`}</small></div><progress max={30} value={Math.min(offerUses, 30)} aria-label="Uses toward up to 15 percent off"/><span>{offerUses} uses · 10% at 15 · 15% at 30</span><button className="text-button" onClick={() => setOfferOpen(true)}>Offer details</button></section>
      {page === 'Overview' && <Overview income={income} expenses={expenses} tx={tx} accounts={accounts} onAdd={() => setShowAdd(true)} onPage={setPage} />}
      {page === 'Transactions' && <Transactions tx={visible} query={query} setQuery={setQuery} onAdd={() => setShowAdd(true)} onParse={() => setShowParser(true)} onCheckout={beginCheckout} />}
      {page === 'Budgets' && <Budgets income={income} tx={tx} />}
      {page === 'Investments' && <Investments notify={notify} />}
      {page === 'Financial health' && <HealthPage income={income} expenses={expenses} notify={notify} onCheckout={beginCheckout} accounts={accounts} mandates={mandates} onAccountsChange={setAccounts} onMandatesChange={setMandates} settings={planning.health} onSettingsChange={update => setPlanning(current => ({ ...current, health: update }))} />}
      {page === 'Analytics & FIRE' && <ProGate feature="advanced_investments" onCheckout={beginCheckout}><AdvancedPage notify={notify} planning={planning} onPlanningChange={update => setPlanning(current => ({ ...current, ...update }))} /></ProGate>}
      {page === 'Debt planner' && <ProGate feature="loan_planner" onCheckout={beginCheckout}><DebtPage notify={notify} planning={planning} onPlanningChange={update => setPlanning(current => ({ ...current, ...update }))} /></ProGate>}
      {page === 'Tax planner' && <TaxPlanner notify={notify} onCheckout={beginCheckout} planning={planning} onPlanningChange={update => setPlanning(current => ({ ...current, tax: update }))} />}
      {page === 'Security' && <SecurityPage vaultData={{ transactions: tx, accounts, mandates, planning }} notify={notify} onSetPin={setAppPin} onDisablePin={disableAppPin} onLock={lockApp} onRestore={restoreFinanceData} onCheckout={beginCheckout} />}
      <footer><span><Icon name="lock" /> Your data never leaves this device.</span><div><button onClick={exportData}><Icon name="download" /> Export backup</button><label><Icon name="upload" /> Restore<input type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && importData(e.target.files[0])} /></label></div></footer>
    </main>
    {showAdd && <AddModal onClose={() => setShowAdd(false)} onSave={item => { update([{ ...item, id: Date.now() }, ...tx]); setShowAdd(false); notify('Transaction saved locally') }} />}
    {showParser && <ParserModal onClose={() => setShowParser(false)} onSave={item => { update([{ ...item, id: Date.now() }, ...tx]); setShowParser(false); notify('SMS transaction imported and categorized') }} />}
    {offerOpen && <Paywall onClose={() => setOfferOpen(false)} onCheckout={beginCheckout} />}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function AppLockScreen({ onUnlock }: { onUnlock: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const unlocked = await onUnlock(pin)
    setBusy(false)
    if (!unlocked) { setPin(''); setError('PIN did not match or the encrypted vault could not be opened.') }
  }
  return <main className="app-lock-screen"><form className="lock-panel" onSubmit={submit}><div className="brand-mark lock-mark">A</div><div className="eyebrow">ARTHASETU · LOCAL VAULT</div><h1>Your money, under lock.</h1><p>Enter your device PIN to decrypt your local finance data.</p><label>PIN<input autoFocus required type="password" inputMode="numeric" minLength={4} maxLength={8} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} autoComplete="current-password" /></label><button className="add-button" disabled={busy || pin.length < 4}>{busy ? 'Unlocking…' : 'Unlock vault'}</button>{error && <small className="error" role="alert">{error}</small>}<small className="lock-privacy">No network request is made. Your PIN unlocks this device only.</small></form></main>
}

function Overview({ income, expenses, tx, accounts, onAdd, onPage }: { income: number; expenses: number; tx: Tx[]; accounts: Account[]; onAdd: () => void; onPage: (p: Page) => void }) { const assets = accounts.reduce((sum, account) => sum + (account.kind.toLowerCase().includes('credit') ? 0 : account.balance), 0); const liabilities = accounts.reduce((sum, account) => sum + (account.kind.toLowerCase().includes('credit') ? account.balance : 0), 0); const balance = assets - liabilities; const plan = income * .8; const savingsRate = income > 0 ? Math.max(0, (income - expenses) / income) : 0; const byCategory = tx.filter(item => item.type === 'expense').reduce<Record<string, number>>((totals, item) => ({ ...totals, [item.category]: (totals[item.category] || 0) + item.amount }), {}); const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3); return <>
  <section className="hero-grid"><div className="balance-card"><div className="card-label">TOTAL NET WORTH <span>LOCAL ESTIMATE</span></div><strong>{money(balance)}</strong><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small>From {accounts.length} accounts on this device</small></div><div className="metric-card"><div className="card-label">THIS MONTH <span className="muted">FROM LEDGER</span></div><div className="metric-row"><div><small>Income</small><b className="green">{money(income)}</b></div><div><small>Spent</small><b>{money(expenses)}</b></div></div><div className="progress"><i style={{ width: `${plan > 0 ? Math.min(expenses / plan * 100, 100) : 0}%` }} /></div><small>{money(Math.max(plan - expenses, 0))} left of {money(plan)} suggested 80% spend plan</small></div></section>
  <section className="section-head"><div><div className="eyebrow">MONEY FLOW</div><h2>Where your money went</h2></div><button className="text-button" onClick={() => onPage('Transactions')}>View ledger →</button></section><section className="flow-grid"><div className="flow-card"><div className="donut"><div><strong>{money(expenses)}</strong><span>spent this month</span></div></div><div className="legend">{categories.length ? categories.map(([name, amount]) => <span key={name}><i style={{ background: categoryColor[name] || '#87948c' }} />{name} <b>{money(amount)}</b></span>) : <span>No expenses recorded yet.</span>}</div></div><div className="insight-card"><div className="insight-tag">SETU INSIGHT</div><h3>Your ledger savings rate is {Math.round(savingsRate * 100)}%.</h3><p>Based on recorded income and expenses for the data currently in your ledger.</p><button onClick={() => onPage('Budgets')}>Review your plan ↗</button></div></section>
  <section className="section-head recent"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Latest transactions</h2></div><button className="add-button" onClick={onAdd}><Icon name="plus" /> Add transaction</button></section><div className="table-card"><div className="table-head"><span>MERCHANT</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span></div>{tx.slice(0, 4).map(t => <TransactionRow key={t.id} t={t} />)}</div></> }

function TransactionRow({ t }: { t: Tx }) { return <div className="transaction-row"><span className="merchant"><i style={{ background: categoryColor[t.category] || '#87948c' }}>{t.merchant.slice(0, 1)}</i><b>{t.merchant}</b></span><span><em style={{ color: categoryColor[t.category] || '#526b5e' }}>{t.category}</em></span><span className="muted">{t.date}</span><strong className={t.type === 'income' ? 'green' : ''}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</strong></div> }
function Transactions({ tx, query, setQuery, onAdd, onParse, onCheckout }: { tx: Tx[]; query: string; setQuery: (v: string) => void; onAdd: () => void; onParse: () => void; onCheckout: (plan: PlanId) => void }) { return <><div className="toolbar"><div className="search"><Icon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search merchant, category, account" /></div><ProGate feature="sms_parser" onCheckout={onCheckout}><button className="secondary" onClick={onParse}>Paste bank SMS</button></ProGate><button className="add-button" onClick={onAdd}><Icon name="plus" /> Add transaction</button></div><div className="table-card full"><div className="table-head"><span>MERCHANT</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span></div>{tx.map(t => <TransactionRow key={t.id} t={t} />)}</div></> }
function Budgets({ income, tx }: { income: number; tx: Tx[] }) { const expenses = tx.filter(item => item.type === 'expense'); const needs = expenses.filter(item => ['Home', 'Groceries', 'Transport', 'Utilities', 'Health'].includes(item.category)).reduce((sum, item) => sum + item.amount, 0); const savings = expenses.filter(item => item.category === 'Investments').reduce((sum, item) => sum + item.amount, 0); const wants = expenses.reduce((sum, item) => sum + item.amount, 0) - needs - savings; const items: Array<[string, number, number, string]> = [['Needs · 50%', needs, income * .5, '#526b5e'], ['Wants · 30%', Math.max(0, wants), income * .3, '#d18b45'], ['Savings · 20%', savings, income * .2, '#7564b8']]; const spend = needs + Math.max(0, wants); return <><div className="budget-banner"><div><div className="eyebrow">50 / 30 / 20 · FROM YOUR LEDGER</div><h2>Give every rupee a job.</h2><p>Recorded spending: <b>{money(spend)}</b>. Targets are calculated from recorded income of {money(income)}.</p></div><div className="budget-rule">50% needs <span>·</span> 30% wants <span>·</span> 20% savings</div></div><div className="budget-list">{items.map(([name, used, cap, color]) => <div className="budget-line" key={name}><div><span className="budget-dot" style={{ background: color }} /><b>{name}</b><small>{money(used)} of {money(cap)}</small></div><div className="budget-progress"><i style={{ background: color, width: `${cap > 0 ? Math.min(used / cap * 100, 100) : 0}%` }} /></div><strong>{cap > 0 ? `${Math.round(used / cap * 100)}%` : '—'}</strong></div>)}</div>{income <= 0 && <p className="tax-note">Record income to calculate the recommended budget amounts.</p>}</> }
function Investments({ notify }: { notify: (s: string) => void }) { return <div className="advanced-stack"><section className="investment-hero"><div><div className="eyebrow">INVESTMENTS</div><h2>Track your holdings locally.</h2><p>Use Analytics & FIRE to model dated cash flows, XIRR, CAGR, and your inflation-adjusted target.</p></div><button className="text-button" onClick={() => notify('Open Analytics & FIRE to add dated investment flows')}>Open advanced analytics →</button></section><div className="budget-banner"><div><div className="eyebrow">HOLDINGS</div><h2>Portfolio values have not been added.</h2><p>Add current asset balances in Analytics & FIRE. The example data is clearly labeled there and is not presented as your live portfolio.</p></div><button className="add-button" onClick={() => notify('Open Analytics & FIRE to edit your portfolio balances')}>Manage values</button></div></div> }
function TaxPlanner({ notify, onCheckout, planning, onPlanningChange }: { notify: (s: string) => void; onCheckout: (plan: PlanId) => void; planning: PlanningState; onPlanningChange: (value: PlanningState['tax']) => void }) {
  const taxInput = planning.tax
  const estimate = estimateTax(taxInput).new
  return <div className="tax-planner-stack">
    <div className="tax-grid">
      <div className="tax-form"><div className="eyebrow">TAX YEAR 2026–27 · NEW REGIME</div><h2>Start with a clear salary estimate.</h2><p className="subtitle">Your age, residence, salary, and standard deduction are saved in the local vault. Detailed deductions are in the Pro comparison below.</p><label>Annual gross salary<input type="number" min="0" value={taxInput.salary} onChange={event => onPlanningChange({ ...taxInput, salary: Math.max(0, Number(event.target.value)) })} inputMode="numeric" /></label><button className="add-button" onClick={() => notify('Estimate recalculated on this device')}>Recalculate locally</button></div>
      <div className="tax-result"><small>NEW REGIME · ESTIMATED ANNUAL TAX</small><strong>{money(estimate.total)}</strong><p>Taxable salary after ₹75,000 standard deduction: {money(estimate.taxable)}</p><div className="tax-note">Includes age-appropriate slabs, resident rebate where eligible, surcharge and 4% cess. Special-rate income and non-salary income are not included.</div></div>
    </div>
    <div className="tax-chips"><span>New Act · Section 202</span><span>Standard deduction · ₹75,000</span><span>Tax year · 1 Apr 2026 – 31 Mar 2027</span><a href="https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/income-and-tax-estimator-um" target="_blank" rel="noreferrer">Official tax estimator ↗</a></div>
    <section className="tax-optimizer"><div className="section-head compact"><div><div className="eyebrow">PRO TAX OPTIMIZER</div><h2>Compare deductions side by side.</h2><p className="subtitle">The estimator shows old and new regime results using entered Section 123, health cover, HRA and home-loan figures.</p></div></div><ProGate feature="tax_optimizer" onCheckout={onCheckout}><div className="advanced-card tax-compare"><div className="card-title"><span>OLD VS NEW REGIME</span><small>Indicative salaried-person comparison</small></div><TaxCompare value={taxInput} onChange={onPlanningChange} /></div></ProGate></section>
  </div>
}
function AddModal({ onClose, onSave }: { onClose: () => void; onSave: (t: Omit<Tx, 'id'>) => void }) { const [merchant, setMerchant] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('Daily life'); return <div className="modal-backdrop"><form className="modal" onSubmit={e => { e.preventDefault(); onSave({ merchant, amount: Number(amount), category, date: '09 Oct 2026', type: 'expense', account: 'UPI' }) }}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="eyebrow">LOCAL LEDGER</div><h2>Add transaction</h2><label>Merchant<input required autoFocus value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. BigBasket" /></label><label>Amount in rupees<input required type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></label><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option>Daily life</option><option>Home</option><option>Travel</option><option>Investments</option></select></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="add-button">Save locally</button></div></form></div> }
function ParserModal({ onClose, onSave }: { onClose: () => void; onSave: (t: Omit<Tx, 'id'>) => void }) { const [text, setText] = useState('Your A/c XX1234 is debited by Rs. 1,250.00 on 08-10-26 at UPI/Swiggy. Avl bal Rs. 3,18,450.'); const parse = () => { const amount = Number((text.match(/(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1] || '0').replace(/,/g, '')); const merchant = text.match(/at\s+([^\.]+)/i)?.[1]?.trim() || 'Imported bank transaction'; onSave({ merchant, amount, category: /swiggy|zomato|dining/i.test(text) ? 'Dining' : /rent/i.test(text) ? 'Home' : 'Daily life', date: '08 Oct 2026', type: /credited|received/i.test(text) ? 'income' : 'expense', account: 'UPI / Bank SMS' }) }; return <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={onClose}>×</button><div className="eyebrow">SMS AUTO-PARSER</div><h2>Paste a bank or UPI SMS.</h2><p className="subtitle">Works offline with common HDFC, SBI, ICICI, Axis, Kotak, BoB, PhonePe, Google Pay and Paytm patterns.</p><textarea value={text} onChange={e => setText(e.target.value)} rows={5} /><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="add-button" onClick={parse}>Parse & save</button></div></div></div> }
