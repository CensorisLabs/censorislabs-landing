import { useState, type FormEvent } from 'react'
import { decryptJson, encryptJson, type FinanceData } from '../../domain/vault.ts'
import { ProGate } from '../license/Paywall.tsx'
import type { PlanId } from '../license/useLicense.tsx'

export function SecurityPage({ vaultData, notify, onSetPin, onDisablePin, onLock, onRestore, onCheckout }: {
  vaultData: FinanceData
  notify: (message: string) => void
  onSetPin: (currentPin: string, nextPin: string) => Promise<boolean>
  onDisablePin: (currentPin: string) => Promise<boolean>
  onLock: () => void
  onRestore: (data: FinanceData) => void
  onCheckout: (plan: PlanId) => void
}) {
  const [pinEnabled, setPinEnabled] = useState(Boolean(localStorage.getItem('arthasetu-pin')))
  const [currentPin, setCurrentPin] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [secret, setSecret] = useState('')
  const [backupStatus, setBackupStatus] = useState('')
  const [error, setError] = useState('')

  async function savePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6,8}$/.test(pin) || pin !== confirm) { setError('Use the same 6–8 digit PIN in both fields.'); return }
    const saved = await onSetPin(currentPin, pin)
    if (!saved) { setError('The current PIN did not match.'); return }
    setPinEnabled(true); setCurrentPin(''); setPin(''); setConfirm(''); setError(''); notify('App lock enabled; vault data encrypted on this device')
  }

  async function disablePin() {
    if (!await onDisablePin(currentPin)) { setError('Enter the current PIN to disable app lock.'); return }
    setPinEnabled(false); setCurrentPin(''); setPin(''); setConfirm(''); setError(''); notify('App lock disabled; local data stored without encryption')
  }

  async function makeBackup() {
    if (secret.length < 8) { setBackupStatus('Use a backup password with at least 8 characters.'); return }
    try {
      const value = await encryptJson({ exportedAt: new Date().toISOString(), ...vaultData }, secret)
      const blob = new Blob([value], { type: 'application/json' })
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'arthasetu-encrypted-backup.json'; anchor.click(); URL.revokeObjectURL(url)
      setBackupStatus('Encrypted backup exported. Keep the password separate from the file.'); notify('AES-GCM encrypted backup exported')
    } catch { setBackupStatus('Could not create the encrypted backup on this device.') }
  }

  async function readBackup(file: File) {
    try {
      const data = await decryptJson<FinanceData & { exportedAt?: string }>(await file.text(), secret)
      if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts) || !Array.isArray(data.mandates)) throw Error('invalid')
      onRestore({ transactions: data.transactions, accounts: data.accounts, mandates: data.mandates, planning: data.planning })
      setBackupStatus(`Restored ${data.transactions.length} transactions and ${data.accounts.length} accounts.`); notify('Encrypted backup restored locally')
    } catch { setBackupStatus('Could not decrypt: check the password or file.') }
  }

  return <div className="advanced-stack">
    <section className="budget-banner"><div><div className="eyebrow">LOCAL VAULT SECURITY</div><h2>{pinEnabled ? 'Your vault is protected.' : 'Add a lock to your vault.'}</h2><p>Finance data is encrypted with AES-256-GCM at rest while app lock is enabled. The PIN stays on this device.</p></div><button className="secondary" onClick={onLock} disabled={!pinEnabled}>Lock now</button></section>
    <div className="security-grid">
      <form className="tax-form" onSubmit={savePin}><div className="eyebrow">APP LOCK · PIN FALLBACK</div><h3>{pinEnabled ? 'Change your PIN' : 'Set a PIN'}</h3>{pinEnabled && <label>Current PIN<input type="password" inputMode="numeric" maxLength={8} value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\D/g, ''))} autoComplete="current-password" /></label>}<label>New 6–8 digit PIN<input type="password" inputMode="numeric" minLength={6} maxLength={8} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></label><label>Confirm PIN<input type="password" inputMode="numeric" minLength={6} maxLength={8} value={confirm} onChange={event => setConfirm(event.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></label><div className="modal-actions"><button className="add-button">{pinEnabled ? 'Update PIN' : 'Enable app lock'}</button>{pinEnabled && <button type="button" className="secondary" onClick={disablePin}>Disable lock</button>}</div>{error && <p className="error" role="status">{error}</p>}<small className="security-help">New PINs require 6–8 digits; older 4 digit PINs still unlock and can be upgraded here. The vault uses salted PBKDF2 and AES-GCM. Native biometric key protection requires an installed platform authenticator.</small></form>
      <ProGate feature="encrypted_vault" onCheckout={onCheckout}><div className="tax-form"><div className="eyebrow">AES-GCM BACKUPS · PRO</div><h3>Password-protected transfer</h3><label>Backup password<input type="password" value={secret} onChange={event => setSecret(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /></label><div className="modal-actions"><button className="add-button" onClick={makeBackup}>Export encrypted backup</button><label className="secondary file-picker">Restore<input type="file" accept="application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void readBackup(file); event.currentTarget.value = '' }} /></label></div>{backupStatus && <p className="security-help" role="status">{backupStatus}</p>}</div></ProGate>
    </div>
  </div>
}
