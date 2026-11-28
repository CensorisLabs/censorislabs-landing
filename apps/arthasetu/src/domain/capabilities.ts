/**
 * The single source of truth for what ArthaSetu ships today.
 *
 * Every entry names the file plus the exported symbol (or the literal UI string
 * for behaviour rendered inline) that implements it, so
 * `tests/capabilities.test.ts` fails when a claim loses its implementation.
 * The website's ArthaSetu feature card is generated from the headline entries
 * by `apps/scripts/export-arthasetu-capabilities.mjs`; nothing is typed twice.
 */

export type CapabilityArea =
  | 'Ledger & accounts'
  | 'Import & reconciliation'
  | 'Budgets & cash flow'
  | 'Investments'
  | 'Tax'
  | 'Debt & planning'
  | 'Financial health'
  | 'Privacy & controls'

export type CapabilityAnchor = {
  /** Path from the app folder. */
  file: string
  /** Exported function or component that does the work. */
  symbol?: string
  /** Literal string in the file, for behaviour that lives inline in App.tsx. */
  text?: string
}

export type Capability = {
  id: string
  area: CapabilityArea
  label: string
  /** Shorter wording for the website card. Required on headline entries. */
  siteLabel?: string
  headline?: boolean
  anchor: CapabilityAnchor
}

export const CAPABILITY_AREAS: CapabilityArea[] = [
  'Ledger & accounts',
  'Import & reconciliation',
  'Budgets & cash flow',
  'Investments',
  'Tax',
  'Debt & planning',
  'Financial health',
  'Privacy & controls',
]

export const CAPABILITIES: Capability[] = [
  // Ledger & accounts
  { id: 'add-transaction', area: 'Ledger & accounts', label: 'Add an expense or income with date, type and account', siteLabel: 'Manual ledger with date, type, account and month filters', headline: true, anchor: { file: 'src/App.tsx', text: 'Add transaction' } },
  { id: 'ledger-month', area: 'Ledger & accounts', label: 'Switch the ledger month and totals together', anchor: { file: 'src/App.tsx', text: 'aria-label="Ledger month"' } },
  { id: 'duplicate-row', area: 'Ledger & accounts', label: 'Duplicate a ledger row in one click', anchor: { file: 'src/App.tsx', text: 'title="Duplicate"' } },
  { id: 'delete-row', area: 'Ledger & accounts', label: 'Delete a ledger row after confirming', anchor: { file: 'src/App.tsx', text: 'title="Delete"' } },
  { id: 'split-expense', area: 'Ledger & accounts', label: 'Split one expense across two categories with a balance check', anchor: { file: 'src/App.tsx', text: 'Split across two categories' } },
  { id: 'recurring-entry', area: 'Ledger & accounts', label: 'Repeat a transaction monthly and materialise it each month', anchor: { file: 'src/domain/ledger.ts', symbol: 'materializeRecurring' } },
  { id: 'merchant-rules', area: 'Ledger & accounts', label: 'Remember a merchant category rule and apply it on import', anchor: { file: 'src/domain/ledger.ts', symbol: 'applyRule' } },
  { id: 'category-suggestion', area: 'Ledger & accounts', label: 'Suggest a category from the merchant and narration', anchor: { file: 'src/domain/statement.ts', symbol: 'suggestCategory' } },
  { id: 'search-ledger', area: 'Ledger & accounts', label: 'Search by merchant, category or account', anchor: { file: 'src/App.tsx', text: 'Search merchant, category, account' } },
  { id: 'ledger-csv', area: 'Ledger & accounts', label: 'Export the ledger as CSV, including splits', anchor: { file: 'src/domain/ledger.ts', symbol: 'ledgerCsv' } },
  { id: 'accounts', area: 'Ledger & accounts', label: 'Keep local accounts with balances, type and last four digits', siteLabel: 'Local accounts with balances, type and last-four labels', headline: true, anchor: { file: 'src/features/health/Health.tsx', symbol: 'HealthPage' } },

  // Import & reconciliation
  { id: 'statement-import', area: 'Import & reconciliation', label: 'Import a bank statement CSV with bank detection', siteLabel: 'Bank statement CSV import with a row review and category edit', headline: true, anchor: { file: 'src/domain/statement.ts', symbol: 'parseStatement' } },
  { id: 'import-review', area: 'Import & reconciliation', label: 'Choose which parsed rows to import and edit each category', anchor: { file: 'src/features/statement/StatementImport.tsx', symbol: 'StatementImport' } },
  { id: 'skip-duplicates', area: 'Import & reconciliation', label: 'Skip rows already recorded in the ledger', anchor: { file: 'src/domain/statement.ts', symbol: 'transactionKey' } },
  { id: 'sms-paste', area: 'Import & reconciliation', label: 'Draft a transaction by pasting a bank or UPI SMS', siteLabel: 'Draft a transaction by pasting a bank or UPI SMS', headline: true, anchor: { file: 'src/App.tsx', text: 'Paste a bank or UPI SMS' } },
  { id: 'skipped-rows', area: 'Import & reconciliation', label: 'Report rows the parser could not read', anchor: { file: 'src/features/statement/StatementImport.tsx', text: 'rows skipped' } },

  // Budgets & cash flow
  { id: 'budget-503020', area: 'Budgets & cash flow', label: 'Track a 50/30/20 budget against recorded income', siteLabel: '50/30/20 budget calculated from your recorded ledger', headline: true, anchor: { file: 'src/App.tsx', text: '50 / 30 / 20' } },
  { id: 'category-totals', area: 'Budgets & cash flow', label: 'Total spending by category, splits included', anchor: { file: 'src/domain/ledger.ts', symbol: 'categoryTotals' } },
  { id: 'spend-change', area: 'Budgets & cash flow', label: 'Compare this month with last month', anchor: { file: 'src/domain/ledger.ts', symbol: 'spendChange' } },
  { id: 'subscription-detection', area: 'Budgets & cash flow', label: 'Flag merchants charged across several months', anchor: { file: 'src/domain/ledger.ts', symbol: 'detectSubscriptions' } },
  { id: 'recurring-commitment', area: 'Budgets & cash flow', label: 'Total the monthly recurring commitment', anchor: { file: 'src/domain/ledger.ts', symbol: 'recurringCommitment' } },
  { id: 'transfer-exclusion', area: 'Budgets & cash flow', label: 'Keep internal transfers out of income, spending and budgets', anchor: { file: 'src/domain/ledger.ts', symbol: 'migrateLegacyTransfers' } },

  // Investments
  { id: 'xirr', area: 'Investments', label: 'XIRR from dated contributions and a current value', siteLabel: 'XIRR for irregular dated contributions, computed locally', headline: true, anchor: { file: 'src/domain/finance.ts', symbol: 'xirr' } },
  { id: 'cagr', area: 'Investments', label: 'CAGR from a starting value, ending value and period', anchor: { file: 'src/domain/finance.ts', symbol: 'cagr' } },
  { id: 'allocation', area: 'Investments', label: 'Allocation across equity, retirement, gold and cash', anchor: { file: 'src/features/advanced/Advanced.tsx', text: 'PORTFOLIO · CURRENT VALUE' } },
  { id: 'fire-forecast', area: 'Investments', label: 'FIRE forecast on real returns and monthly savings', anchor: { file: 'src/features/advanced/Advanced.tsx', text: 'FIRE FORECAST · REAL RETURNS' } },

  // Tax
  { id: 'tax-regime-compare', area: 'Tax', label: 'Old vs new regime estimate for Tax Year 2026–27', siteLabel: 'Old vs new regime tax estimate with HRA and deduction caps', headline: true, anchor: { file: 'src/domain/finance.ts', symbol: 'estimateTax' } },
  { id: 'hra-exemption', area: 'Tax', label: 'HRA exemption from the lowest of the three limits', anchor: { file: 'src/features/advanced/Advanced.tsx', text: 'Eligible HRA exemption estimate' } },
  { id: 'tax-deduction-inputs', area: 'Tax', label: 'Deduction inputs for 80C, health cover, home loan and senior parents', anchor: { file: 'src/features/advanced/Advanced.tsx', text: 'Parent is a senior citizen' } },

  // Debt & planning
  { id: 'emi-amortization', area: 'Debt & planning', label: 'EMI amortisation with extra monthly payments', siteLabel: 'EMI amortisation with extra payments', headline: true, anchor: { file: 'src/domain/finance.ts', symbol: 'amortization' } },
  { id: 'debt-strategy', area: 'Debt & planning', label: 'Snowball and avalanche payoff ordering with interest totals', siteLabel: 'Snowball and avalanche payoff ordering with interest totals', headline: true, anchor: { file: 'src/domain/finance.ts', symbol: 'debtPayoff' } },

  // Financial health
  { id: 'emergency-fund', area: 'Financial health', label: 'Emergency fund measured in months of essential spending', anchor: { file: 'src/features/health/Health.tsx', text: 'EMERGENCY FUND' } },
  { id: 'health-index', area: 'Financial health', label: 'Financial health index from buffer, savings rate and debt ratio', anchor: { file: 'src/features/health/Health.tsx', text: 'FINANCIAL HEALTH INDEX' } },
  { id: 'bills-tracker', area: 'Financial health', label: 'Track bills and subscriptions with renewal dates and mark-paid', anchor: { file: 'src/features/health/Health.tsx', text: 'SUBSCRIPTIONS & BILLS' } },

  // Privacy & controls
  { id: 'encrypted-vault', area: 'Privacy & controls', label: 'AES-GCM encrypted vault stored on this device', siteLabel: 'AES-GCM encrypted local vault with a PIN', headline: true, anchor: { file: 'src/domain/vault.ts', symbol: 'encryptJson' } },
  { id: 'pin-lock', area: 'Privacy & controls', label: 'PIN lock with salted PBKDF2 hashing', anchor: { file: 'src/domain/vault.ts', symbol: 'hashPin' } },
  { id: 'lock-control', area: 'Privacy & controls', label: 'Lock the vault on demand', anchor: { file: 'src/features/security/Security.tsx', text: 'Lock now' } },
  { id: 'encrypted-backup', area: 'Privacy & controls', label: 'Password-protected encrypted backup and restore', anchor: { file: 'src/features/security/Security.tsx', text: 'AES-GCM BACKUPS' } },
  { id: 'json-backup', area: 'Privacy & controls', label: 'Plain JSON backup and restore from the footer', anchor: { file: 'src/App.tsx', text: 'Export backup' } },
  { id: 'low-end-mode', area: 'Privacy & controls', label: 'Low-end mode and four themes, saved locally', anchor: { file: 'src/App.tsx', text: 'Low-end' } },
  { id: 'stays-local', area: 'Privacy & controls', label: 'No network request for finance data', anchor: { file: 'src/App.tsx', text: 'Your data never leaves this device.' } },
]

export const HEADLINE_CAPABILITIES: Capability[] = CAPABILITIES.filter(capability => capability.headline)
