# ArthaSetu UPI checkout

These Vercel Node functions create a fixed-amount, UPI-only Razorpay payment link that expires after 10 minutes. The desktop app renders the unique link as a QR code; Android opens the same link in a native browser tab so installed UPI apps can handle the payment.

After payment, the customer enters the 12-digit UPI reference shown by their bank. The server fetches the associated Razorpay payment link and payment record, then checks that the payment is captured, UPI, INR, the exact server-priced amount, and that the reference matches. Only then does it issue an ECDSA-signed offline license. No UTR typed into the client can directly unlock Pro.

## Vercel environment

Configure these values on the Vercel project that serves the CensorisLabs domain and deploy the functions in `api/` at `/api`:

- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`: server-only Razorpay API credentials.
- `CHECKOUT_TOKEN_SECRET`: a random secret of at least 32 bytes, used to authenticate a checkout session without adding a database.
- `LICENSE_PRIVATE_JWK`: private P-256 signing JWK from `node scripts/generate-license-keys.cjs`. Keep it out of Git and out of every app package.
- `VITE_LICENSE_PUBLIC_KEY`: matching public JWK at app build time. It is public, but must match the server key.
- `VITE_PRO_API_BASE`: optional for app builds. Native packages default to `https://censorislabs.online/api`; set this if the API is hosted elsewhere.
- `APP_ALLOWED_ORIGIN`: optional browser origin restriction. Packaged clients also use the API, so leave unset or configure the origins you ship.

The existing CensorisLabs Vercel project must include this `api` directory for packaged APKs and EXEs to reach the payment functions. Razorpay live-mode keys and UPI capability must be enabled on the merchant account. Use test keys for staging.

The server does not store customer UTRs or bank data. The signed checkout token expires after 24 hours; its payment link expires after 10 minutes. Monthly and yearly payments grant 31-day and 366-day access respectively and are renewed manually; automatic UPI mandates are not configured. The app stores the signed license token as AES-GCM ciphertext in local storage and keeps its non-exportable encryption key in IndexedDB, then verifies the token signature with the public key.

## Functions

- `POST /api/checkout` with `{ "planId": "monthly|yearly|early_bird_lifetime|lifetime", "email": "..." }` returns the UPI link, exact amount, expiry and signed checkout token.
- `POST /api/verify-utr` with `{ "checkoutToken": "...", "utr": "12 digits" }` returns `pending`, `not_matched`, or a signed license token after a confirmed capture.

If payment or license configuration is missing, the functions return an error and the app never enables Pro optimistically.
