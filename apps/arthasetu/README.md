# ArthaSetu

A private, device-first money workspace for Indian households. Every feature is free: there is no Pro tier, no account, no licence key and no payment flow. Data stays in the browser/app storage on the device.

## What it does

- **Ledger** — add expenses and income with a real date picker, choose the account, search the month, and filter the whole ledger by month. Dates are stored as ISO so sorting and month totals are reliable.
- **SMS parsing** — paste a bank or UPI SMS and the amount, direction, date and merchant are read offline. Merchant category rules are remembered, so the next Swiggy message is already filed under Dining.
- **Bank statement import** — CSV import for common Indian bank exports with per-row category suggestions, editable before saving. Imported merchant categories become rules automatically.
- **Budgets** — 50/30/20 view over the selected month.
- **Investments, debt, tax and FIRE tools** — XIRR, loan payoff, tax comparison and long-term planning, all local.
- **Security** — optional PIN lock and an encrypted vault backup.
- **Backups** — JSON export (schema version 2, validated on restore) and encrypted backup.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm test         # node --test tests/*.test.ts
```

The ledger helpers in `src/domain/ledger.ts` (date normalisation, month windows, merchant rules, subscription detection) are pure functions covered by `tests/ledger.test.ts`.

## Data

Everything is local. `src/domain/vault.ts` owns storage and optional AES-GCM encryption. JSON backups include `app` and `version` fields; a newer major version is refused rather than half-restored, and transaction dates are normalised on import.
