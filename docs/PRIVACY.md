# Censoris privacy notice

Plain language, no legal theatre. **Draft for owner review.**

## The short version

Your financial data stays on your phone. Censoris has no accounts, no
servers, no analytics and no ads. Nothing is uploaded anywhere unless **you**
start an export or a backup.

## What is stored, and where

| What | Where it lives |
| --- | --- |
| Transactions, accounts, categories, bills, goals, festivals, groups | Private app database on your phone (SQLite) |
| Your PIN | Only a salted one-way hash, inside the phone's secure key store (Android Keystore / iOS Keychain). The PIN itself is never stored. |
| Invoice photos (Phase 5) | App-private storage on your phone |
| Settings (language, theme, lock) | The same private database |

## What never leaves the phone

- Amounts, merchants, notes, balances
- SMS messages (SMS import in the direct build is parsed on the device)
- Invoice images and extracted GSTINs
- Anything about who you owe or who owes you

## Internet use

The app works fully offline. It does not call home, track crashes, or measure
usage. The only network use that will ever exist:

1. **Your exports** — files you choose to save or share.
2. **Optional encrypted backup (Pro, later phase)** — to *your own* Google
   Drive app-data folder, encrypted before upload. CensorisLabs cannot read
   it. There is no live sync.

## If you forget your PIN

There is no remote reset (that would require a server and an account). You
must clear the app's data, which deletes everything on the phone. Keep an
encrypted export somewhere safe.

## Deleting everything

Settings → Wipe all data removes the database on this phone. Uninstalling the
app removes the app-private data as well. Backups in your Google Drive must be
deleted by you.

## For the Play "Data safety" form (Play build)

- Collects nothing. Shares nothing. Encrypts nothing in transit because it
  sends nothing.
- No permissions beyond what the chosen features require (biometrics for the
  lock; the Play build has **no** SMS permission).

## Notes for the owner

- India's Digital Personal Data Protection Act, 2023: because data stays on
  device and the app has no users' accounts, obligations are minimal, but the
  privacy policy still needs to be published for Play. **Get legal review
  before release.**
- This document must be kept in sync with actual behaviour whenever a phase
  ships.
