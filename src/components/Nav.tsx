import { useState } from 'react'

const LINKS = [
  { href: '#ecosystem', label: 'Ecosystem' },
  { href: '#products', label: 'Products' },
  { href: '#sovereignty', label: 'Sovereignty' },
  { href: '#legal', label: 'Legal' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)

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

        <a className="btn btn--outline nav__cta" href="#ecosystem">
          Launch Censoris (Local v0.1)
        </a>

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
          <a className="btn btn--primary" href="#ecosystem" onClick={() => setOpen(false)}>
            Launch Censoris (Local v0.1)
          </a>
        </nav>
      </div>
    </header>
  )
}
