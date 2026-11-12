import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AdvancedPage, DebtPage, TaxCompare } from './features/advanced/Advanced.tsx'
import { SecurityPage } from './features/security/Security.tsx'
import { HealthPage, type Account, type Mandate } from './features/health/Health.tsx'
import { estimateTax } from './domain/finance.ts'
import type { ParsedTransaction } from './domain/statement.ts'
import { CATEGORY_OPTIONS, suggestCategory } from './domain/statement.ts'
import { applyRule, detectSubscriptions, formatDate, materializeRecurring, recurringCommitment, monthKey, monthLabel, nextId, saveRule, spendChange, toIsoDate, todayIso } from './domain/ledger.ts'
import StatementImport from './features/statement/StatementImport.tsx'
import { hashPin, PIN_KEY, readFinanceData, readFinanceDataSync, saveFinanceData, verifyPin, type FinanceData } from './domain/vault.ts'
import { DEFAULT_PLANNING, readPlanningState, type PlanningState } from './domain/planning.ts'

type Page = 'Overview' | 'Transactions' | 'Budgets' | 'Investments' | 'Financial health' | 'Tax planner' | 'Analytics & FIRE' | 'Debt planner' | 'Security'
type Tx = { id: number; merchant: string; category: string; date: string; amount: number; type: 'income' | 'expense'; account: string; recurring?: 'monthly'; recurrenceOf?: number }
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
function isTransaction(value: unknown): value is Tx { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return Number.isFinite(item.id) && typeof item.merchant === 'string' && typeof item.category === 'string' && typeof item.date === 'string' && Number.isFinite(item.amount) && (item.type === 'income' || item.type === 'expense') && typeof item.account === 'string' }
function readInitialTransactions(): Tx[] { const values = readFinanceDataSync()?.transactions; return Array.isArray(values) && values.every(isTransaction) ? (values as Tx[]).map(item => ({ ...item, date: toIsoDate(item.date) })) : [] }
function isAccount(value: unknown): value is Account { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.kind === 'string' && Number.isFinite(item.balance) && typeof item.lastFour === 'string' && (item.tone === 'green' || item.tone === 'blue') }
function isMandate(value: unknown): value is Mandate { if (!value || typeof value !== 'object') return false; const item = value as Record<string, unknown>; return typeof item.id === 'string' && typeof item.name === 'string' && Number.isFinite(item.amount) && typeof item.nextRenewal === 'string' }
function getInitialAccounts(): Account[] { const values = readFinanceDataSync()?.accounts; return Array.isArray(values) && values.every(isAccount) ? values : [] }
function getInitialMandates(): Mandate[] { const values = readFinanceDataSync()?.mandates; return Array.isArray(values) && values.every(isMandate) ? values : [] }
function getInitialPlanning(): PlanningState { return readPlanningState(readFinanceDataSync()?.planning) }
const categoryColor: Record<string, string> = { Home: '#526b5e', Groceries: '#d18b45', Investments: '#7564b8', Dining: '#d96758', Income: '#2e9b78', Transport: '#4f91a1', Travel: '#4f91a1', Utilities: '#8a7a45', Health: '#c0605c', Shopping: '#a06a4f', Entertainment: '#7a6a9b', Education: '#5b7f9b', Taxes: '#8b6a5a', Transfers: '#87948c', 'Daily life': '#87948c' }

function Icon({ name }: { name: string }) { const icons: Record<string, string> = { grid: '▦', tx: '≡', budget: '◒', invest: '↗', health: '✦', tax: '◇', analytics: '⌁', debt: '↘', security: '▣', search: '⌕', bell: '◌', plus: '+', lock: '▣', upload: '↥', download: '↧' }; return <span className="icon" aria-hidden="true">{icons[name] || '•'}</span> }

export default function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [isLocked, setIsLocked] = useState(() => Boolean(localStorage.getItem(PIN_KEY)))
  const [sessionSecret, setSessionSecret] = useState('')
  const [tx, setTx] = useState<Tx[]>(() => materializeRecurring(readInitialTransactions()))
  const [accounts, setAccounts] = useState<Account[]>(getInitialAccounts)
  const [mandates, setMandates] = useState<Mandate[]>(getInitialMandates)
  const [planning, setPlanning] = useState<PlanningState>(getInitialPlanning)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showParser, setShowParser] = useState(false)
  const [showStatement, setShowStatement] = useState(false)
  const [toast, setToast] = useState('')
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('arthasetu-theme') || 'fern')
  const [lowEndMode, setLowEndMode] = useState(() => localStorage.getItem('arthasetu-performance') === 'low')
  const [month, setMonth] = useState(() => monthKey())
  const monthTx = tx.filter(t => t.date.startsWith(month))
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const visible = monthTx.filter(t => `${t.merchant} ${t.category} ${t.account}`.toLowerCase().includes(query.toLowerCase()))
  const spend = spendChange(tx, month)
  const subscriptions = detectSubscriptions(tx)
  const commitment = recurringCommitment(tx)
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const update = (next: Tx[]) => setTx(next)
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

  function duplicateTransaction(item: Tx) { update([{ ...item, id: nextId() }, ...tx]); notify(`${item.merchant} duplicated`) }
  function exportCsv() {
    const escape = (value: string | number) => { const text = String(value); const needsQuotes = text.includes(',') || text.includes('"') || text.includes(String.fromCharCode(10)); return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text }
    const rows = [['date', 'merchant', 'category', 'type', 'account', 'amount'], ...tx.map(item => [item.date, item.merchant, item.category, item.type, item.account, item.amount])]
    const csv = rows.map(row => row.map(escape).join(',')).join(String.fromCharCode(10))
    const blob = new Blob([String.fromCharCode(65279) + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `arthasetu-ledger-${month}.csv`; anchor.click(); URL.revokeObjectURL(url)
    notify(`${tx.length} transactions exported`)
  }
  function exportData() { const blob = new Blob([JSON.stringify({ app: 'arthasetu', version: 2, exportedAt: new Date().toISOString(), transactions: tx, accounts, mandates, planning }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'arthasetu-backup.json'; a.click(); URL.revokeObjectURL(url); notify('JSON backup exported') }
  function importStatement(rows: ParsedTransaction[]) { rows.forEach(row => { if (row.type === 'expense') saveRule(row.merchant, row.category) }); const base = nextId(); const next: Tx[] = rows.map((row, index) => ({ id: base + index, merchant: row.merchant, category: row.category, date: row.date, amount: row.amount, type: row.type, account: row.account })); update([...next, ...tx]); notify(`${next.length} bank transactions imported and categorised`) }
  function importData(file: File) { const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)) as { version?: number; transactions?: unknown; accounts?: unknown; mandates?: unknown; planning?: unknown }; if (typeof parsed.version === 'number' && parsed.version > 2) throw Error('newer backup'); if (!Array.isArray(parsed.transactions) || !parsed.transactions.every(isTransaction)) throw Error('invalid transactions'); if (parsed.accounts !== undefined && (!Array.isArray(parsed.accounts) || !parsed.accounts.every(isAccount))) throw Error('invalid accounts'); if (parsed.mandates !== undefined && (!Array.isArray(parsed.mandates) || !parsed.mandates.every(isMandate))) throw Error('invalid reminders'); restoreFinanceData({ transactions: (parsed.transactions as Tx[]).map(item => ({ ...item, date: toIsoDate(item.date) })), accounts: (parsed.accounts as Account[] | undefined) ?? accounts, mandates: (parsed.mandates as Mandate[] | undefined) ?? mandates, planning: parsed.planning ? readPlanningState(parsed.planning) : planning }); notify('JSON backup restored locally') } catch { notify('That backup file could not be read') } }; reader.readAsText(file) }

  if (isLocked) return <AppLockScreen onUnlock={unlockApp} />

  return <div className="app-shell" data-theme={appTheme} data-performance={lowEndMode ? 'low' : 'full'}>
    <aside className="sidebar"><div className="brand"><div className="brand-mark">A</div><div><strong>ArthaSetu</strong><span>PRIVATE FINANCE</span></div></div><div className="vault"><Icon name="lock" /><div><b>Local vault</b><small>Only on this device</small></div><i /></div><nav>{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><Icon name={item.icon} />{item.label}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => notify('Settings are ready for your PIN and language')}><span className="avatar">AR</span> Ananya R. <span className="chev">⌄</span></button><small>v1.1 · Offline-first</small></div></aside>
    <main className="main"><header><div><div className="eyebrow">PERSONAL FINANCE / {monthLabel(month).toUpperCase()}</div><h1>{page === 'Overview' ? 'Your money, mapped.' : page}</h1><p className="subtitle">{page === 'Overview' ? 'A private view of your financial life.' : 'A calm view of your financial life.'}</p></div><div className="header-actions"><label className="appearance-control">Theme<select value={appTheme} onChange={event => setAppTheme(event.target.value)}><option value="fern">Fern</option><option value="ocean">Ocean</option><option value="violet">Violet</option><option value="ember">Ember</option></select></label><label className="performance-control"><input type="checkbox" checked={lowEndMode} onChange={event => setLowEndMode(event.target.checked)} /> Low-end</label><button className="circle" onClick={() => notify('No new alerts')}><Icon name="bell" /></button><label className="date-picker">Month<input type="month" value={month} onChange={event => setMonth(event.target.value)} aria-label="Ledger month" /></label></div></header>
      
      {page === 'Overview' && <Overview income={income} expenses={expenses} tx={monthTx} accounts={accounts} monthName={monthLabel(month)} spend={spend} subscriptions={subscriptions} commitment={commitment} onAdd={() => setShowAdd(true)} onPage={setPage} />}
      {page === 'Transactions' && <Transactions tx={visible} query={query} setQuery={setQuery} onAdd={() => setShowAdd(true)} onParse={() => setShowParser(true)} onImport={() => setShowStatement(true)} onExport={exportCsv} onDuplicate={duplicateTransaction} />}
      {page === 'Budgets' && <Budgets income={income} tx={tx} />}
      {page === 'Investments' && <Investments notify={notify} />}
      {page === 'Financial health' && <HealthPage income={income} expenses={expenses} notify={notify} accounts={accounts} mandates={mandates} onAccountsChange={setAccounts} onMandatesChange={setMandates} settings={planning.health} onSettingsChange={update => setPlanning(current => ({ ...current, health: update }))} />}
      {page === 'Analytics & FIRE' && <><AdvancedPage notify={notify} planning={planning} onPlanningChange={update => setPlanning(current => ({ ...current, ...update }))} /></>}
      {page === 'Debt planner' && <><DebtPage notify={notify} planning={planning} onPlanningChange={update => setPlanning(current => ({ ...current, ...update }))} /></>}
      {page === 'Tax planner' && <TaxPlanner notify={notify} planning={planning} onPlanningChange={update => setPlanning(current => ({ ...current, tax: update }))} />}
      {page === 'Security' && <SecurityPage vaultData={{ transactions: tx, accounts, mandates, planning }} notify={notify} onSetPin={setAppPin} onDisablePin={disableAppPin} onLock={lockApp} onRestore={restoreFinanceData} />}
      <footer><span><Icon name="lock" /> Your data never leaves this device.</span><div><button onClick={exportData}><Icon name="download" /> Export backup</button><label><Icon name="upload" /> Restore<input type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && importData(e.target.files[0])} /></label></div></footer>
    </main>
    {showAdd && <AddModal accounts={accounts} onClose={() => setShowAdd(false)} onSave={item => { if (item.type === 'expense') saveRule(item.merchant, item.category); update([{ ...item, id: nextId() }, ...tx]); setShowAdd(false); notify('Transaction saved locally') }} />}
    {showStatement && <StatementImport existing={tx} onClose={() => setShowStatement(false)} onImport={importStatement} />}
    {showParser && <ParserModal onClose={() => setShowParser(false)} onSave={item => { saveRule(item.merchant, item.category); update([{ ...item, id: nextId() }, ...tx]); setShowParser(false); notify('SMS transaction imported and categorized') }} />}
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

function Overview({ income, expenses, tx, accounts, monthName, spend, subscriptions, commitment, onAdd, onPage }: { income: number; expenses: number; tx: Tx[]; accounts: Account[]; monthName: string; spend: { current: number; previous: number; percent: number }; subscriptions: Array<{ merchant: string; amount: number; months: number }>; commitment: { count: number; monthly: number; merchants: string[] }; onAdd: () => void; onPage: (p: Page) => void }) { const assets = accounts.reduce((sum, account) => sum + (account.kind.toLowerCase().includes('credit') ? 0 : account.balance), 0); const liabilities = accounts.reduce((sum, account) => sum + (account.kind.toLowerCase().includes('credit') ? account.balance : 0), 0); const balance = assets - liabilities; const plan = income * .8; const savingsRate = income > 0 ? Math.max(0, (income - expenses) / income) : 0; const byCategory = tx.filter(item => item.type === 'expense').reduce<Record<string, number>>((totals, item) => ({ ...totals, [item.category]: (totals[item.category] || 0) + item.amount }), {}); const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3); return <>
  <section className="hero-grid"><div className="balance-card"><div className="card-label">TOTAL NET WORTH <span>LOCAL ESTIMATE</span></div><strong>{money(balance)}</strong><div className="sparkline"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small>From {accounts.length} accounts on this device</small></div><div className="metric-card"><div className="card-label">THIS MONTH <span className="muted">FROM LEDGER</span></div><div className="metric-row"><div><small>Income</small><b className="green">{money(income)}</b></div><div><small>Spent</small><b>{money(expenses)}</b></div></div><div className="progress"><i style={{ width: `${plan > 0 ? Math.min(expenses / plan * 100, 100) : 0}%` }} /></div><small>{money(Math.max(plan - expenses, 0))} left of {money(plan)} suggested 80% spend plan</small></div></section>
  <section className="section-head"><div><div className="eyebrow">MONEY FLOW</div><h2>Where your money went</h2></div><button className="text-button" onClick={() => onPage('Transactions')}>View ledger →</button></section><section className="flow-grid"><div className="flow-card"><div className="donut"><div><strong>{money(expenses)}</strong><span>spent this month</span></div></div><div className="legend">{categories.length ? categories.map(([name, amount]) => <span key={name}><i style={{ background: categoryColor[name] || '#87948c' }} />{name} <b>{money(amount)}</b></span>) : <span>No expenses recorded yet.</span>}</div></div><div className="insight-card"><div className="insight-tag">SETU INSIGHT</div><h3>Your ledger savings rate is {Math.round(savingsRate * 100)}%.</h3><p>{monthName} spending is {spend.percent === 0 ? 'level with' : spend.percent > 0 ? `up ${spend.percent}% on` : `down ${Math.abs(spend.percent)}% on`} last month ({money(spend.previous)}).</p>{commitment.count ? <p className="insight-sub"><b>Recurring:</b> {money(commitment.monthly)}/month across {commitment.count} rule{commitment.count === 1 ? '' : 's'} ({commitment.merchants.slice(0, 3).join(', ')}).</p> : null}{subscriptions.length ? <p className="insight-sub"><b>Possible subscriptions:</b> {subscriptions.map(item => `${item.merchant} ${money(item.amount)}`).join(' · ')}</p> : null}<button onClick={() => onPage('Budgets')}>Review your plan ↗</button></div></section>
  <section className="section-head recent"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Latest transactions</h2></div><button className="add-button" onClick={onAdd}><Icon name="plus" /> Add transaction</button></section><div className="table-card"><div className="table-head"><span>MERCHANT</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span></div>{tx.slice(0, 4).map(t => <TransactionRow key={t.id} t={t} />)}</div></> }

function TransactionRow({ t, onDuplicate }: { t: Tx; onDuplicate?: (t: Tx) => void }) { return <div className="transaction-row"><span className="merchant"><i style={{ background: categoryColor[t.category] || '#87948c' }}>{t.merchant.slice(0, 1)}</i><b>{t.merchant}</b>{onDuplicate ? <button type="button" className="row-action" onClick={() => onDuplicate(t)} aria-label={`Duplicate ${t.merchant}`} title="Duplicate">⧉</button> : null}</span><span><em style={{ color: categoryColor[t.category] || '#526b5e' }}>{t.category}</em></span><span className="muted">{t.recurring === 'monthly' ? '↻ ' : t.recurrenceOf ? '↻ auto · ' : ''}{formatDate(t.date)}</span><strong className={t.type === 'income' ? 'green' : ''}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</strong></div> }
function Transactions({ tx, query, setQuery, onAdd, onParse, onImport, onExport, onDuplicate }: { tx: Tx[]; query: string; setQuery: (v: string) => void; onAdd: () => void; onParse: () => void; onImport: () => void; onExport: () => void; onDuplicate: (t: Tx) => void; }) { return <><div className="toolbar"><div className="search"><Icon name="search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search merchant, category, account" /></div><><button className="secondary" onClick={onParse}>Paste bank SMS</button><button className="secondary" onClick={onImport}>Import bank CSV</button><button className="secondary" onClick={onExport}>Export CSV</button></><button className="add-button" onClick={onAdd}><Icon name="plus" /> Add transaction</button></div><div className="table-card full"><div className="table-head"><span>MERCHANT</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span></div>{tx.map(t => <TransactionRow key={t.id} t={t} onDuplicate={onDuplicate} />)}</div></> }
function Budgets({ income, tx }: { income: number; tx: Tx[] }) { const expenses = tx.filter(item => item.type === 'expense'); const needs = expenses.filter(item => ['Home', 'Groceries', 'Transport', 'Utilities', 'Health'].includes(item.category)).reduce((sum, item) => sum + item.amount, 0); const savings = expenses.filter(item => item.category === 'Investments').reduce((sum, item) => sum + item.amount, 0); const wants = expenses.reduce((sum, item) => sum + item.amount, 0) - needs - savings; const items: Array<[string, number, number, string]> = [['Needs · 50%', needs, income * .5, '#526b5e'], ['Wants · 30%', Math.max(0, wants), income * .3, '#d18b45'], ['Savings · 20%', savings, income * .2, '#7564b8']]; const spend = needs + Math.max(0, wants); return <><div className="budget-banner"><div><div className="eyebrow">50 / 30 / 20 · FROM YOUR LEDGER</div><h2>Give every rupee a job.</h2><p>Recorded spending: <b>{money(spend)}</b>. Targets are calculated from recorded income of {money(income)}.</p></div><div className="budget-rule">50% needs <span>·</span> 30% wants <span>·</span> 20% savings</div></div><div className="budget-list">{items.map(([name, used, cap, color]) => <div className="budget-line" key={name}><div><span className="budget-dot" style={{ background: color }} /><b>{name}</b><small>{money(used)} of {money(cap)}</small></div><div className="budget-progress"><i style={{ background: color, width: `${cap > 0 ? Math.min(used / cap * 100, 100) : 0}%` }} /></div><strong>{cap > 0 ? `${Math.round(used / cap * 100)}%` : '—'}</strong></div>)}</div>{income <= 0 && <p className="tax-note">Record income to calculate the recommended budget amounts.</p>}</> }
function Investments({ notify }: { notify: (s: string) => void }) { return <div className="advanced-stack"><section className="investment-hero"><div><div className="eyebrow">INVESTMENTS</div><h2>Track your holdings locally.</h2><p>Use Analytics & FIRE to model dated cash flows, XIRR, CAGR, and your inflation-adjusted target.</p></div><button className="text-button" onClick={() => notify('Open Analytics & FIRE to add dated investment flows')}>Open advanced analytics →</button></section><div className="budget-banner"><div><div className="eyebrow">HOLDINGS</div><h2>Portfolio values have not been added.</h2><p>Add current asset balances in Analytics & FIRE. The example data is clearly labeled there and is not presented as your live portfolio.</p></div><button className="add-button" onClick={() => notify('Open Analytics & FIRE to edit your portfolio balances')}>Manage values</button></div></div> }
function TaxPlanner({ notify, planning, onPlanningChange }: { notify: (s: string) => void; planning: PlanningState; onPlanningChange: (value: PlanningState['tax']) => void }) {
  const taxInput = planning.tax
  const estimate = estimateTax(taxInput).new
  return <div className="tax-planner-stack">
    <div className="tax-grid">
      <div className="tax-form"><div className="eyebrow">TAX YEAR 2026–27 · NEW REGIME</div><h2>Start with a clear salary estimate.</h2><p className="subtitle">Your age, residence, salary, and standard deduction are saved in the local vault. Detailed deductions are in the comparison below.</p><label>Annual gross salary<input type="number" min="0" value={taxInput.salary} onChange={event => onPlanningChange({ ...taxInput, salary: Math.max(0, Number(event.target.value)) })} inputMode="numeric" /></label><button className="add-button" onClick={() => notify('Estimate recalculated on this device')}>Recalculate locally</button></div>
      <div className="tax-result"><small>NEW REGIME · ESTIMATED ANNUAL TAX</small><strong>{money(estimate.total)}</strong><p>Taxable salary after ₹75,000 standard deduction: {money(estimate.taxable)}</p><div className="tax-note">Includes age-appropriate slabs, resident rebate where eligible, surcharge and 4% cess. Special-rate income and non-salary income are not included.</div></div>
    </div>
    <div className="tax-chips"><span>New Act · Section 202</span><span>Standard deduction · ₹75,000</span><span>Tax year · 1 Apr 2026 – 31 Mar 2027</span><a href="https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/income-and-tax-estimator-um" target="_blank" rel="noreferrer">Official tax estimator ↗</a></div>
    <section className="tax-optimizer"><div className="section-head compact"><div><div className="eyebrow">TAX OPTIMIZER</div><h2>Compare deductions side by side.</h2><p className="subtitle">The estimator shows old and new regime results using entered Section 123, health cover, HRA and home-loan figures.</p></div></div><><div className="advanced-card tax-compare"><div className="card-title"><span>OLD VS NEW REGIME</span><small>Indicative salaried-person comparison</small></div><TaxCompare value={taxInput} onChange={onPlanningChange} /></div></></section>
  </div>
}
function AddModal({ accounts, onClose, onSave }: { accounts: Account[]; onClose: () => void; onSave: (t: Omit<Tx, 'id'>) => void }) {
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Daily life')
  const [date, setDate] = useState(todayIso())
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [account, setAccount] = useState(accounts[0]?.name || 'UPI')
  const [recurring, setRecurring] = useState(false)
  return <div className="modal-backdrop"><form className="modal" onSubmit={e => { e.preventDefault(); onSave({ merchant, amount: Number(amount), category: type === 'income' ? 'Income' : category, date, type, account, recurring: recurring && type === 'expense' ? 'monthly' : undefined }) }}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="eyebrow">LOCAL LEDGER</div><h2>Add transaction</h2><label>Merchant<input required autoFocus value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. BigBasket" /></label><label>Amount in rupees<input required type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></label><div className="inline-create-row"><label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><label>Type<select value={type} onChange={e => setType(e.target.value as 'expense' | 'income')}><option value="expense">Expense</option><option value="income">Income</option></select></label></div><label className="check-line"><input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} /> Repeat monthly</label><div className="inline-create-row"><label>Category<select value={category} disabled={type === 'income'} onChange={e => setCategory(e.target.value)}>{CATEGORY_OPTIONS.filter(name => name !== 'Income').map(name => <option key={name}>{name}</option>)}</select></label><label>Account<input value={account} onChange={e => setAccount(e.target.value)} list="account-names" placeholder="UPI / HDFC" /><datalist id="account-names">{accounts.map(item => <option key={item.id} value={item.name} />)}</datalist></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="add-button">Save locally</button></div></form></div>
}
function ParserModal({ onClose, onSave }: { onClose: () => void; onSave: (t: Omit<Tx, 'id'>) => void }) {
  const [text, setText] = useState('Your A/c XX1234 is debited by Rs. 1,250.00 on 08-10-26 at UPI/Swiggy. Avl bal Rs. 3,18,450.')
  const parse = () => {
    const amount = Number((text.match(/(?:Rs[.]?|INR)[ ]*([0-9,]+(?:[.][0-9]{1,2})?)/i)?.[1] || '0').replace(/,/g, ''))
    const merchant = text.match(/at[ ]+([^.]+)/i)?.[1]?.trim() || 'Imported bank transaction'
    const type = /credited|received/i.test(text) ? 'income' : 'expense'
    const dateMatch = text.match(/on[ ]+([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i)
    const date = dateMatch ? toIsoDate(dateMatch[1]) : todayIso()
    const suggested = suggestCategory(merchant, type, text).category
    onSave({ merchant, amount, category: applyRule(merchant, type === 'income' ? 'Income' : suggested), date, type, account: 'UPI / Bank SMS' })
  }
  return <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={onClose}>×</button><div className="eyebrow">SMS AUTO-PARSER</div><h2>Paste a bank or UPI SMS.</h2><p className="subtitle">Works offline with common HDFC, SBI, ICICI, Axis, Kotak, BoB, PhonePe, Google Pay and Paytm patterns. The date and direction are read from the message.</p><textarea value={text} onChange={e => setText(e.target.value)} rows={5} /><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="add-button" onClick={parse}>Parse & save</button></div></div></div>
}
