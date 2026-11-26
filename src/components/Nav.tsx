import { useEffect, useState } from 'react'

const LINKS = [
  { href: '#ecosystem', label: 'Ecosystem' },
  { href: '/apps', label: 'Apps' },
  { href: '/puffwork', label: 'Puffwork' },
  { href: '/game', label: 'Play' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/request', label: 'Request code' },
  { href: '/about', label: 'About me' },
  { href: '#products', label: 'Products' },
  { href: '#sovereignty', label: 'Sovereignty' },
  { href: '#legal', label: 'Legal' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [lowPerformance, setLowPerformance] = useState(() => localStorage.getItem('censorislabs-site-performance') === 'low')

  useEffect(() => {
    document.documentElement.dataset.performance = lowPerformance ? 'low' : 'full'
    localStorage.setItem('censorislabs-site-performance', lowPerformance ? 'low' : 'full')
  }, [lowPerformance])

  return (
    <header className="nav">
      <div className="nav__inner">
        <a className="brand" href="#top" aria-label="CensorisLabs home">
          <span className="brand__mark" aria-hidden="true">
            C
          </span>
          <span className="brand__name">CENSORISLABS</span>
        </a>

        <nav aria-label="Primary">
          <ul className="nav__links">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a className="nav__link" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <a className="btn btn--outline nav__cta" href="/apps">
          Explore apps
        </a>

        <details className="nav__appearance">
          <summary>Display</summary>
          <div className="nav__appearance-panel">
            <label className="nav__performance">
              <input type="checkbox" checked={lowPerformance} onChange={event => setLowPerformance(event.target.checked)} /> Low-end mode
            </label>
            <small>Reduces 3D, blur, shadows and motion. The site is always monochrome.</small>
          </div>
        </details>

        <button
          type="button"
          className="nav__menu-btn"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      <div className="nav__mobile" id="mobile-menu" hidden={!open}>
        <nav aria-label="Mobile">
          <ul>
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a className="btn btn--primary" href="/apps" onClick={() => setOpen(false)}>
            Explore apps
          </a>
        </nav>
        <details className="nav__mobile-appearance">
          <summary>Display</summary>
          <div className="nav__appearance-panel nav__appearance-panel--mobile">
            <label className="nav__performance">
              <input type="checkbox" checked={lowPerformance} onChange={event => setLowPerformance(event.target.checked)} /> Low-end mode
            </label>
            <small>Reduces 3D, blur, shadows and motion. The site is always monochrome.</small>
          </div>
        </details>
      </div>
    </header>
  )
}
