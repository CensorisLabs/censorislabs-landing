/**
 * Ecosystem: the two flagship products.
 *
 * Download actions are deliberately inert until signed builds exist. The
 * owner supplies real .exe/.apk URLs before launch; we do not ship dead
 * links that pretend a binary is available.
 */
import type { MouseEvent } from 'react'

const GH = 'https://github.com/censorislabs'
const VESPER_REPO = 'https://github.com/chudling445/vesper'

/** Scrolls to the app directory on this page, independent of the hash router. */
function openAppSuite(event: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById('apps')
  if (!target) return
  event.preventDefault()
  const top = target.getBoundingClientRect().top + window.scrollY - 96
  window.scrollTo({ top, behavior: 'smooth' })
  window.history.replaceState(null, '', '#apps')
}

export default function Ecosystem() {
  return (
    <section className="section" id="ecosystem" aria-labelledby="ecosystem-title">
      <div className="container">
        <div className="ecosystem__head">
          <div>
            <p className="eyebrow">The ecosystem</p>
            <h2 className="section-title" id="ecosystem-title">
              Two instruments of digital independence
            </h2>
          </div>
          <p className="section-lede">
            Every CensorisLabs product shares one doctrine: computation happens
            on your hardware, storage belongs to you, and the network is
            optional. No accounts, no shadow profiles, no rented intelligence.
          </p>
        </div>

        <div className="product-grid">
          {/* Censoris */}
          <article className="product product--apps" aria-labelledby="censoris-title">
            <a
              className="product__open"
              href="#apps"
              aria-label="Open the CensorisLabs app suite"
              onClick={openAppSuite}
            />
            <div className="product__head">
              <div>
                <h3 className="product__name" id="censoris-title">
                  Censoris
                </h3>
                <p className="product__kind">Personal finance · Android first</p>
              </div>
              <span className="product__badge">Flagship</span>
            </div>

            <p className="product__desc">
              A monthly expense, income and tax tracker built for how Indian
              households actually handle money — cash, UPI, festivals, GST and
              savings schemes. Fully usable in airplane mode, on a low-end
              phone, with no account.
            </p>

            <p className="product__suite-copy">
              Censoris is one window onto a larger suite: ArthaSetu for money, Nur
              Companion for daily practice, PC Part Picker for builds, Where to Watch,
              Offline Arcade and more — ten apps sharing one offline engine and the same
              refusal to profile you.
            </p>

            <a className="product__suite-link" href="#apps" data-cursor="APPS" onClick={openAppSuite}>
              Open the app suite <span aria-hidden="true">→</span>
            </a>

            <ul className="spec-list">
              <li>100% local-first engine on encrypted on-device SQLite</li>
              <li>Zero cloud sync — your data never leaves the phone</li>
              <li>On-device OCR for receipt and GST invoice parsing</li>
              <li>Multi-currency aware, GST and tax-season ready</li>
              <li>Eight Indian languages, cash reconciliation, group splitting</li>
            </ul>

            <div className="product__actions">
              <button
                type="button"
                className="btn btn--outline"
                disabled
                aria-describedby="censoris-download-note"
              >
                Windows (.exe)
              </button>
              <button
                type="button"
                className="btn btn--outline"
                disabled
                aria-describedby="censoris-download-note"
              >
                Android (.apk)
              </button>
              <a
                className="btn btn--ghost"
                href={GH}
                target="_blank"
                rel="noreferrer noopener"
              >
                Source
              </a>
            </div>
            <p className="download-note" id="censoris-download-note">
              Download buttons activate when the first signed Windows .exe and
              Android .apk builds are published. Until then, source and specs
              are available above.
            </p>
          </article>

          {/* Vesper */}
          <article className="product" aria-labelledby="vesper-title">
            <div className="product__head">
              <div>
                <h3 className="product__name" id="vesper-title">
                  Vesper
                </h3>
                <p className="product__kind">Developer tools · CLI + GUI</p>
              </div>
              <span className="product__badge">In development</span>
            </div>

            <p className="product__desc">
              Command-line and desktop tooling for engineers who build
              local-first systems: manage encrypted local databases, inspect
              schemas, and synchronise workspaces through Git instead of a
              hosted service.
            </p>

            <ul className="spec-list">
              <li>Encrypted local database management and migrations</li>
              <li>Git-native workspace sync — no proprietary backend</li>
              <li>Schema inspection, diffing and integrity checks</li>
              <li>Scriptable CLI plus a focused desktop GUI</li>
            </ul>

            <div className="product__actions">
              <a
                className="btn btn--ghost"
                href={VESPER_REPO}
                target="_blank"
                rel="noreferrer noopener"
              >
                Follow development
              </a>
            </div>
            <p className="download-note">
              Vesper is in private development. Public builds and documentation
              will be announced through the GitHub organisation.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
