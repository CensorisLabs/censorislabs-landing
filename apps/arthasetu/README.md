
## Free and Pro licensing

The app includes a centralized `LicenseProvider` with these local statuses: `FREE`, `PRO_MONTHLY`, `PRO_YEARLY`, and `PRO_LIFETIME`. Free users retain manual transactions, standard budgets, up to two-account workflow, basic tax estimation, and ordinary JSON backup/restore.

The following are Pro-gated: SMS parsing, advanced investment/XIRR analytics, loan planning, tax optimization, FIRE forecasting, encrypted vault/security, custom rules, and financial reports. The paywall shows:

- ₹69/month
- ₹299/year
- ₹499 early-bird lifetime for the first 1,000 users
- ₹999 standard lifetime after the early-bird period

Offline keys use the format `ARTHASETU-PRO_<STATUS>-<16-character SHA-256 checksum>`, validated locally with Web Crypto and stored only as the license status. `makeOfflineLicenseKey()` is available for a controlled activation service or developer tooling. The checkout callback is ready to connect to Razorpay, UPI Intent, or Cashfree; this plain-local build deliberately does not collect payment or claim a successful purchase.
