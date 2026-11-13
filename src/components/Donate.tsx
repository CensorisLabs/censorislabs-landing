import { useState } from 'react'

const UPI_ID = '9180576313@fam'
const UPI_LINK = `upi://pay?pa=${UPI_ID}&pn=CensorisLabs&cu=INR`

export default function Donate() {
  const [copied, setCopied] = useState(false)

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      const field = document.createElement('textarea')
      field.value = UPI_ID
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      document.execCommand('copy')
      field.remove()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <section className="section donate-page" id="donate" aria-labelledby="donate-title">
      <div className="container donate-layout">
        <div className="donate-copy">
          <p className="eyebrow">SUPPORT CENSORISLABS</p>
          <h1 className="section-title" id="donate-title">
            Keep the tools free.
          </h1>
          <p className="donate-lede">
            Every CensorisLabs app is free, with every feature included. If the
            work is useful to you, you can leave an optional donation directly
            through UPI. No account, subscription or recurring mandate.
          </p>

          <div className="donate-upi" aria-label="UPI payment details">
            <div>
              <span>UPI ID</span>
              <code>{UPI_ID}</code>
            </div>
            <button type="button" className="btn btn--outline" onClick={copyUpiId}>
              {copied ? 'Copied' : 'Copy UPI ID'}
            </button>
          </div>

          <a className="btn btn--primary donate-pay" href={UPI_LINK}>
            Open UPI app
          </a>

          <p className="donate-note">
            Scan the QR or use the ID in any UPI app. Your bank or UPI provider
            handles the transfer; CensorisLabs never receives your payment
            credentials. Donations do not unlock anything because every feature
            is already free.
          </p>
        </div>

        <figure className="donate-qr">
          <img
            src="/donate-upi-qr.svg"
            alt={`UPI QR code for ${UPI_ID}`}
            width="280"
            height="280"
          />
          <figcaption>
            <strong>Scan to donate</strong>
            <span>{UPI_ID}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
