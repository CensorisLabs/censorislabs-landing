import { useEffect, useRef, type ReactElement } from 'react'

export type LegalDocId = 'terms' | 'privacy' | 'disclaimer'

const DOC_META: Record<LegalDocId, { title: string; kicker: string }> = {
  terms: { title: 'Terms of Service', kicker: 'Website & software use' },
  privacy: { title: 'Privacy Notice', kicker: 'What we do and do not collect' },
  disclaimer: { title: 'Liability & Disclaimer', kicker: 'No professional advice' },
}

const CONTACT = 'hello@censorislabs.online'

function Terms() {
  return (
    <>
      <p>
        These terms govern your use of the CensorisLabs website at
        censorislabs.online and the information published on it. By using this
        site you agree to these terms. If you do not agree, please stop using
        the site.
      </p>

      <h3>1. Software is licensed, not sold</h3>
      <p>
        Censoris, Vesper and any other CensorisLabs software are governed by the
        licence terms shipped with each release. Where a release does not ship
        separate terms, you receive a limited, revocable, non-exclusive licence
        to install and use the software for its intended purpose. Site text,
        branding and the CensorisLabs wordmark remain the property of
        CensorisLabs.
      </p>

      <h3>2. Pre-release and beta software</h3>
      <p>
        Some downloads may be labelled alpha, beta or pre-release. They may
        contain defects, may change without notice, and should not be relied on
        as the only copy of important data. Keep independent backups.
      </p>

      <h3>3. Acceptable use</h3>
      <p>You agree not to:</p>
      <ul>
        <li>use the site or software to break any applicable law;</li>
        <li>attempt to disrupt, overload or gain unauthorised access to the site or hosting infrastructure;</li>
        <li>misrepresent CensorisLabs software as your own product or as officially endorsed by another party.</li>
      </ul>

      <h3>4. No professional advice</h3>
      <p>
        Content on this site, and output produced by CensorisLabs software, is
        general information and software functionality — not financial, tax,
        legal or investment advice. You are responsible for verifying figures
        and decisions with a qualified professional.
      </p>

      <h3>5. Downloads and third-party links</h3>
      <p>
        Download links point to builds published by CensorisLabs. Links to
        third-party services such as GitHub are provided for convenience; those
        services have their own terms and privacy practices, and CensorisLabs
        does not control them.
      </p>

      <h3>6. Disclaimer of warranties</h3>
      <p>
        To the maximum extent permitted by law, this site and all software are
        provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
        warranties of any kind, express or implied, including merchantability,
        fitness for a particular purpose, accuracy and non-infringement. We do
        not warrant that the site or software will be uninterrupted or
        error-free.
      </p>

      <h3>7. Limitation of liability</h3>
      <p>
        To the maximum extent permitted by law, CensorisLabs, its founding
        team, directors, employees, contributors and software maintainers will
        not be liable for indirect, incidental, special, consequential or
        punitive damages, or for loss of data, profits, revenue or goodwill,
        arising from use of or inability to use the site or software, even if
        advised of the possibility. Where liability cannot be excluded, our
        aggregate liability arising from your use of the site will not exceed
        the greater of the amount you paid CensorisLabs in the twelve months
        before the claim, or one thousand Indian rupees.
      </p>

      <h3>8. Changes, severability, governing law</h3>
      <p>
        We may update these terms; the revised version takes effect when
        published on this page. If a provision is found unenforceable, the rest
        remains in effect. These terms are intended to be governed by the laws
        of India, with courts at the operator&rsquo;s place of business having
        jurisdiction, subject to any mandatory consumer protections that apply
        to you.
      </p>

      <h3>9. Contact</h3>
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </>
  )
}

function Privacy() {
  return (
    <>
      <p>
        This notice explains what happens to information when you visit
        censorislabs.online and when you use CensorisLabs software. It is written
        to be read, not to be survived.
      </p>

      <h3>1. This website</h3>
      <ul>
        <li>No analytics, advertising, fingerprinting or tracking scripts are loaded.</li>
        <li>No cookies are set by this site.</li>
        <li>Fonts and assets are served from this domain — no third-party font or CDN requests.</li>
        <li>
          Our hosting provider may keep standard server logs (such as IP
          address, timestamp and requested path) for security and operations,
          under its own retention policy.
        </li>
      </ul>

      <h3>2. Our software</h3>
      <p>
        CensorisLabs products are designed to work without an account and
        without a CensorisLabs backend. Financial records, invoices, notes and
        settings you enter are stored on your own device. They are not uploaded
        to us, and we cannot read them.
      </p>
      <p>
        Exports and backups happen only when you start them. Backups are
        encrypted before leaving the device, and you choose the destination.
      </p>

      <h3>3. What we never do</h3>
      <ul>
        <li>No selling or sharing of personal data.</li>
        <li>No advertising identifiers or cross-site profiling.</li>
        <li>No silent crash reporting that uploads your content.</li>
      </ul>

      <h3>4. Your choices and deletion</h3>
      <p>
        Because we hold no account or server-side copy of your product data,
        deletion is in your hands: removing the app and its data, and deleting
        any backups you created. If you email us, we keep that correspondence
        only as long as needed to respond and meet legal obligations.
      </p>

      <h3>5. Contact</h3>
      <p>
        Privacy questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </>
  )
}

function Disclaimer() {
  return (
    <>
      <p>
        CensorisLabs publishes software and technical writing. Nothing on this
        site or in our products constitutes financial, tax, legal, accounting or
        investment advice, and no advisory or fiduciary relationship is created
        by using them.
      </p>

      <h3>1. Your decisions remain yours</h3>
      <p>
        Calculations, categories, tax tags, projections and reminders produced
        by our software are tools, not recommendations. Verify every figure that
        matters — especially tax positions — with a qualified professional and
        the current official sources before acting.
      </p>

      <h3>2. Data responsibility</h3>
      <p>
        Products store data locally by design. You are responsible for keeping
        backups. If a device is lost, damaged or wiped, CensorisLabs cannot
        recover your data because we never had it.
      </p>

      <h3>3. No financial product distribution</h3>
      <p>
        CensorisLabs does not distribute, recommend, broker or earn commission
        on insurance, mutual funds, deposits, digital gold or any other
        financial product. Any future feature in this area would be separated
        and clearly disclosed.
      </p>

      <h3>4. Forward-looking statements</h3>
      <p>
        Descriptions of features in development (such as Vesper) describe
        intent, not a commitment to ship. Roadmaps may change.
      </p>

      <h3>5. Contact</h3>
      <p>
        Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </>
  )
}

const DOC_BODY: Record<LegalDocId, () => ReactElement> = {
  terms: Terms,
  privacy: Privacy,
  disclaimer: Disclaimer,
}

interface LegalDialogProps {
  doc: LegalDocId | null
  onClose: () => void
}

export function LegalDialog({ doc, onClose }: LegalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!doc) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus()
    }
  }, [doc, onClose])

  if (!doc) return null

  const meta = DOC_META[doc]
  const Body = DOC_BODY[doc]

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-dialog-title"
        ref={dialogRef}
      >
        <div className="dialog__head">
          <div>
            <h2 className="dialog__title" id="legal-dialog-title">
              {meta.title}
            </h2>
            <p className="dialog__sub">{meta.kicker}</p>
          </div>
          <button
            type="button"
            className="dialog__close"
            onClick={onClose}
            aria-label="Close"
            ref={closeRef}
          >
            ✕
          </button>
        </div>

        <div className="dialog__body">
          <p className="draft-banner">
            Draft for launch review. These notices must be checked by qualified
            legal counsel for the governing jurisdiction before this site goes
            live.
          </p>
          <Body />
        </div>
      </div>
    </div>
  )
}

interface LegalSectionProps {
  onOpen: (doc: LegalDocId) => void
}

export function LegalSection({ onOpen }: LegalSectionProps) {
  return (
    <section className="section" id="legal" aria-labelledby="legal-title">
      <div className="container">
        <p className="eyebrow">Legal framework</p>
        <h2 className="section-title" id="legal-title">
          Clear terms, stated plainly
        </h2>
        <p className="section-lede">
          Software that handles money should be equally clear about
          responsibility. Read the terms, the privacy notice and the liability
          disclaimer in full.
        </p>

        <div className="legal__panel">
          <div className="legal__docs">
            {(
              [
                ['terms', 'Terms of Service', 'Reading time · 4 min'],
                ['privacy', 'Privacy Notice', 'Reading time · 2 min'],
                ['disclaimer', 'Liability & Disclaimer', 'Reading time · 2 min'],
              ] as const
            ).map(([id, label, note]) => (
              <button
                key={id}
                type="button"
                className="legal__doc-btn"
                onClick={() => onOpen(id)}
              >
                <span>{label}</span>
                <span aria-hidden="true">{note.split('·').pop()?.trim()}</span>
              </button>
            ))}
          </div>

          <p className="legal__note">
            CensorisLabs does not provide financial, tax or investment advice.
            No accounts. No telemetry. No server-side copy of your data.
          </p>
        </div>
      </div>
    </section>
  )
}
