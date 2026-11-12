// Bank statement CSV parsing and category suggestions.
//
// Indian bank exports rarely share a shape: HDFC uses "Narration / Withdrawal
// Amt. / Deposit Amt.", ICICI uses "Transaction Remarks / Withdrawal Amount
// (INR)", SBI uses "Description / Debit / Credit", Axis uses "Particulars /
// DR / CR". This module finds the header row (statements often start with an
// account summary), maps the columns it recognises, and reads each row into a
// ledger transaction. Nothing is uploaded; the file stays in the browser.

export type TxType = 'income' | 'expense'

export type ParsedTransaction = {
  date: string
  merchant: string
  amount: number
  type: TxType
  category: string
  suggestion: string
  account: string
}

export type ParsedStatement = {
  bank: string
  rows: ParsedTransaction[]
  skipped: number
  header: string[]
}

export const CATEGORY_OPTIONS = [
  'Dining',
  'Groceries',
  'Transport',
  'Travel',
  'Utilities',
  'Health',
  'Shopping',
  'Entertainment',
  'Education',
  'Investments',
  'Home',
  'Taxes',
  'Transfers',
  'Daily life',
  'Income',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDisplayDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Parses dd/mm/yyyy, dd-mm-yy, ISO and "10 Nov 2026" into a display date. */
export function parseStatementDate(value: string): string | null {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (!text) return null

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]))

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (match) {
    let day = Number(match[1])
    let month = Number(match[2])
    let year = Number(match[3])
    if (year < 100) year += 2000
    if (day > 12 && month <= 12) return validDate(year, month, day)
    if (month > 12 && day <= 12) { const swap = day; day = month; month = swap; return validDate(year, month, day) }
    return validDate(year, month, day)
  }

  match = text.match(/^(\d{1,2})[ -]([A-Za-z]{3,})[ -](\d{2,4})/)
  if (match) {
    const month = MONTHS.findIndex(name => name.toLowerCase() === match![2].slice(0, 3).toLowerCase()) + 1
    let year = Number(match[3])
    if (year < 100) year += 2000
    return month ? validDate(year, month, Number(match[1])) : null
  }

  match = text.match(/^([A-Za-z]{3,})[ -](\d{1,2}),?[ -](\d{4})/)
  if (match) {
    const month = MONTHS.findIndex(name => name.toLowerCase() === match![1].slice(0, 3).toLowerCase()) + 1
    return month ? validDate(Number(match[3]), month, Number(match[2])) : null
  }

  return null
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  return formatDisplayDate(year, month, day)
}

/** Reads 1,250.50, ₹1,250, (450) and 450.00 Dr. */
export function parseStatementAmount(value: string): number {
  const text = String(value || '').replace(/[₹$€£]/g, '').trim()
  if (!text) return 0
  const negative = /^\(.*\)$/.test(text) || /\bdr\b/i.test(text)
  const digits = text.replace(/[^\d.,-]/g, '')
  if (!digits) return 0
  const cleaned = digits.replace(/,/g, '')
  const amount = Math.abs(Number(cleaned))
  if (!Number.isFinite(amount)) return 0
  return negative ? -amount : amount
}

function splitDelimited(text: string): { rows: string[][]; delimiter: string } {
  const firstLine = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).find(line => line.trim()) || ''
  const counts: Array<[string, number]> = [',', ';', '\t'].map(delimiter => [delimiter, firstLine.split(delimiter).length - 1])
  counts.sort((a, b) => b[1] - a[1])
  const delimiter = counts[0][1] > 0 ? counts[0][0] : ','
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1 } else quoted = false
      } else field += character
      continue
    }
    if (character === '"') quoted = true
    else if (character === delimiter) { row.push(field); field = '' }
    else if (character === '\n') {
      row.push(field); field = ''
      if (row.some(cell => cell.trim() !== '')) rows.push(row)
      row = []
    } else if (character !== '\r') field += character
  }
  row.push(field)
  if (row.some(cell => cell.trim() !== '')) rows.push(row)
  return { rows, delimiter }
}

type Role = 'date' | 'merchant' | 'debit' | 'credit' | 'amount' | 'type' | 'balance'

function roleOf(rawHeader: string): Role | null {
  const header = rawHeader.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!header) return null
  if (/^(transaction date|txn date|tran date|date|posting date|book date|value date)$/.test(header)) return 'date'
  if (/(narration|particular|description|remark|remark|detail|narrative|transaction name)/.test(header)) return 'merchant'
  if (/(withdrawal|debit|^dr( amount)?$|paid out)/.test(header)) return 'debit'
  if (/(deposit|credit|^cr( amount)?$|paid in)/.test(header)) return 'credit'
  if (/^(dr ?\/ ?cr|cr ?\/ ?dr|debit ?\/ ?credit|credit ?\/ ?debit|type|txn type|transaction type)$/.test(header)) return 'type'
  if (/(amount|transaction amount|amt)/.test(header)) return 'amount'
  if (/(balance|closing balance|running balance)/.test(header)) return 'balance'
  return null
}

const CHANNEL_WORDS = new Set(['upi', 'pos', 'neft', 'imps', 'rtgs', 'ach', 'nach', 'atm', 'ref', 'refno', 'txn', 'trf', 'transfer', 'dr', 'cr', 'mob', 'ib', 'netbanking', 'payment', 'pymt', 'txnid'])

/** Turns "UPI/SWIGGY/1234567890" into "Swiggy". */
export function cleanMerchant(narration: string): string {
  const raw = String(narration || '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'Bank transaction'
  const wasUpper = raw === raw.toUpperCase()
  const tokens = raw.split(/[\/|,;:*\-]+|\s+/).filter(Boolean)
  const useful = tokens.filter(token => {
    const plain = token.replace(/[^A-Za-z0-9]/g, '')
    if (!plain) return false
    if (CHANNEL_WORDS.has(plain.toLowerCase())) return false
    if (/^\d+$/.test(plain)) return false
    if (/^[A-Za-z]{4}\d{6,}$/.test(plain)) return false
    if (plain.length >= 10 && /\d/.test(plain)) return false
    if (plain.length >= 8 && (plain.match(/\d/g) || []).length >= plain.length / 2) return false
    return /[A-Za-z]{2,}/.test(plain)
  })
  let name = (useful.length ? useful : tokens).slice(0, 7).join(' ').replace(/\s+/g, ' ').trim()
  if (!name) name = raw
  if (wasUpper) name = name.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase())
  return name.slice(0, 70)
}

type Rule = { category: string; label: string; pattern: RegExp }

const EXPENSE_RULES: Rule[] = [
  { category: 'Investments', label: 'investment or SIP', pattern: /(zerodha|groww|upstox|angel ?one|mutual fund|\bsip\b|\bnps\b|\bppf\b|\belss\b|\bdemat\b|\bstock\b|\betf\b|\bsgb\b|\bcoin\b|smallcase|indmoney|kuvera|gold bond)/i },
  { category: 'Home', label: 'rent or housing', pattern: /(rent\b|landlord|housing society|society maintenance|maintenance|nobroker|mygate|urban ?company)/i },
  { category: 'Utilities', label: 'utility bill', pattern: /(electricity|bescom|mseb|tata power|adani electricity|torrent power|water bill|gas bill|indane|hp gas|bharat gas|broadband|fibernet|airtel|jio|vodafone|dth|tata play|dish ?tv|recharge|postpaid|bill ?pay|bbps|insurance|policybazaar|lic\b)/i },
  { category: 'Groceries', label: 'grocery', pattern: /(bigbasket|blinkit|zepto|instamart|dmart|d-mart|reliance fresh|more supermarket|spencer|jiomart|licious|country delight|milk basket|amul|grocery|kirana|supermarket|provision)/i },
  { category: 'Dining', label: 'food or dining', pattern: /(swiggy|zomato|eatfit|faasos|behrouz|domino|pizza|kfc|mcdonald|burger king|subway|starbucks|chai|cafe|restaurant|biryani|barbeque|bbq|haldiram|bakery|food court|juice|ice cream|baskin)/i },
  { category: 'Transport', label: 'transport', pattern: /(uber|ola\b|rapido|namma metro|metro card|metro\b|irctc|redbus|abhibus|fastag|toll|parking|petrol|diesel|fuel|hpcl|bpcl|iocl|indian oil|shell|nayara|cng|auto ?rickshaw|cab\b)/i },
  { category: 'Travel', label: 'travel booking', pattern: /(makemytrip|goibibo|cleartrip|ixigo|yatra|indigo|air india|vistara|spicejet|akasa|emirates|oyo|airbnb|booking\.com|resort|holiday|passport)/i },
  { category: 'Health', label: 'health or pharmacy', pattern: /(apollo|medplus|pharmeasy|netmeds|1mg|wellness forever|hospital|clinic|doctor|diagnostic|pathology|practo|dentist|dental|optical|lens|gym|cult ?fit|healthifyme|pharmacy|medical)/i },
  { category: 'Education', label: 'education', pattern: /(school|college|university|tuition|coaching|udemy|coursera|unacademy|byju|vedantu|books?\b|library|exam fee|admission)/i },
  { category: 'Entertainment', label: 'entertainment', pattern: /(netflix|spotify|prime video|hotstar|sonyliv|zee5|bookmyshow|pvr|inox|cinepolis|gaming|playstation|xbox|steam|youtube premium|gaana|wynk)/i },
  { category: 'Shopping', label: 'shopping', pattern: /(amazon|flipkart|myntra|ajio|meesho|nykaa|tatacliq|croma|reliance digital|decathlon|ikea|lifestyle|shoppers stop|pantaloons|westside|zudio|firstcry|pepperfry|urban ladder|fabindia)/i },
  { category: 'Taxes', label: 'tax', pattern: /(income tax|advance tax|tds\b|gst\b|challan|property tax|municipal)/i },
  { category: 'Transfers', label: 'transfer or repayment', pattern: /(atm\b|cash withdrawal|self transfer|credit card payment|card payment|loan emi|emi\b|neft|imps|rtgs|transfer to|transfer from|to a\/c|cheque|chq\b|fd\b|rd\b)/i },
]

/** A deterministic keyword categoriser, tuned to Indian statement narrations. */
export function suggestCategory(merchant: string, type: TxType, narration = ''): { category: string; suggestion: string } {
  const text = `${merchant} ${narration}`.trim()
  if (type === 'income') {
    if (/salary|stipend|payroll/i.test(text)) return { category: 'Income', suggestion: 'salary credit' }
    if (/interest|dividend|refund|cashback|reversal|reward/i.test(text)) return { category: 'Income', suggestion: 'credit or refund' }
    return { category: 'Income', suggestion: 'money received' }
  }
  for (const rule of EXPENSE_RULES) {
    if (rule.pattern.test(text)) return { category: rule.category, suggestion: rule.label }
  }
  return { category: 'Daily life', suggestion: 'no clear match' }
}

function detectBank(headerLine: string, header: string[]): string {
  const text = `${headerLine} ${header.join(' ')}`.toLowerCase()
  if (/withdrawal amt|narration/.test(text)) return 'HDFC Bank'
  if (/transaction remarks|withdrawal amount/.test(text)) return 'ICICI Bank'
  if (/particulars/.test(text)) return 'Axis Bank'
  if (/description/.test(text) && /debit/.test(text) && /credit/.test(text)) return 'SBI'
  if (/dr \/ cr|dr\/cr/.test(text)) return 'Kotak Bank'
  return 'Bank'
}

/** Parse a statement export into ledger rows with suggested categories. */
export function parseStatement(text: string): ParsedStatement {
  const { rows } = splitDelimited(text)
  if (rows.length < 2) throw new Error('That file has no transactions to read.')

  let headerIndex = -1
  let roles: Array<Role | null> = []
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const candidate = rows[index].map(roleOf)
    const hasMerchant = candidate.includes('merchant')
    const hasMoney = candidate.includes('debit') || candidate.includes('credit') || candidate.includes('amount')
    const hasDate = candidate.includes('date')
    if (hasMerchant && hasMoney && hasDate) { headerIndex = index; roles = candidate; break }
  }
  if (headerIndex < 0) throw new Error('Could not find a statement header row. Export a CSV with date, description and debit/credit (or amount) columns.')

  const header = rows[headerIndex].map(cell => cell.trim())
  const column = (role: Role) => roles.findIndex(item => item === role)
  const dateColumns = roles.reduce<number[]>((list, role, index) => role === 'date' ? [...list, index] : list, [])
  const preferredDate = dateColumns.find(index => /(transaction|txn|tran|^date$)/i.test(header[index])) ?? dateColumns[0] ?? -1
  const merchantIndex = column('merchant')
  const debitIndex = column('debit')
  const creditIndex = column('credit')
  const amountIndex = column('amount')
  const typeIndex = column('type')
  const bank = detectBank(rows[headerIndex].join(','), header)

  const parsed: ParsedTransaction[] = []
  let skipped = 0

  for (const row of rows.slice(headerIndex + 1)) {
    const cell = (index: number) => index >= 0 ? String(row[index] ?? '').trim() : ''
    const date = parseStatementDate(cell(preferredDate))
    if (!date) { skipped += 1; continue }

    const debit = debitIndex >= 0 ? Math.abs(parseStatementAmount(cell(debitIndex))) : 0
    const credit = creditIndex >= 0 ? Math.abs(parseStatementAmount(cell(creditIndex))) : 0
    const typeCell = cell(typeIndex).toLowerCase()
    let rawAmount = debit || credit
    let type: TxType = credit > 0 ? 'income' : 'expense'

    if (!rawAmount && amountIndex >= 0) {
      const signed = parseStatementAmount(cell(amountIndex))
      rawAmount = Math.abs(signed)
      if (/cr|credit/.test(typeCell)) type = 'income'
      else if (/dr|debit/.test(typeCell)) type = 'expense'
      else type = signed < 0 ? 'expense' : 'income'
    }
    if (!rawAmount || !Number.isFinite(rawAmount)) { skipped += 1; continue }

    const narration = cell(merchantIndex)
    const merchant = cleanMerchant(narration)
    const { category, suggestion } = suggestCategory(merchant, type, narration)
    parsed.push({
      date,
      merchant,
      amount: Math.round(rawAmount * 100) / 100,
      type,
      category,
      suggestion,
      account: `${bank} CSV`,
    })
  }

  if (!parsed.length) throw new Error('No rows with a readable date and amount were found in that statement.')
  return { bank, rows: parsed, skipped, header }
}

export function transactionKey(item: { date: string; merchant: string; amount: number; type: TxType }) {
  return `${item.date}|${item.merchant.toLowerCase()}|${Math.round(item.amount * 100)}|${item.type}`
}
