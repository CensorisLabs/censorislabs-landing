import type { LegalDocId } from './Legal'

interface FooterProps {
  onOpenLegal: (doc: LegalDocId) => void
}

export default function Footer({ onOpenLegal }: FooterProps) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__inner">
          <div className="footer__brand">
            <a className="brand" href="#top" aria-label="CensorisLabs home">
              <span className="brand__mark" aria-hidden="true">
                C
              </span>
              <span className="brand__name">CENSORISLABS</span>
            </a>
            <p>
              An independent software house building local-first systems for
              people who would rather own their data than rent it back.
            </p>
          </div>

          <div className="footer__cols">
            <div className="footer__col">
              <h4>Products</h4>
              <ul>
                <li>
                  <a href="#ecosystem">Censoris</a>
                </li>
                <li>
                  <a href="https://github.com/chudling445/vesper" target="_blank" rel="noreferrer noopener">Vesper</a>
                </li>
                <li>
                  <a href="#products">Specifications</a>
                </li>
              </ul>
            </div>

            <div className="footer__col">
              <h4>Studio</h4>
              <ul>
                <li>
                  <a href="#/about">About me</a>
                </li>
                <li>
                  <a href="#/reviews">Reviews</a>
                </li>
                <li>
                  <a href="#/request">Request software</a>
                </li>
                <li>
                  <a href="#sovereignty">Sovereignty</a>
                </li>
                <li>
                  <a
                    href="https://github.com/censorislabs"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@censorislabs.online">Contact</a>
                </li>
              </ul>
            </div>

            <div className="footer__col">
              <h4>Legal</h4>
              <ul>
                <li>
                  <button type="button" onClick={() => onOpenLegal('terms')}>
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onOpenLegal('privacy')}>
                    Privacy Notice
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onOpenLegal('disclaimer')}>
                    Liability & Disclaimer
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer__base">
          <span>© {new Date().getFullYear()} CensorisLabs. All rights reserved.</span>
          <span>Zero telemetry · No cookies · Fonts self-hosted</span>
        </div>
      </div>
    </footer>
  )
}
