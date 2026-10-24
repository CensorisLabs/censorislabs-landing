import { useEffect } from 'react'
import './GamePage.css'

const SITE_THEMES = ['obsidian', 'amethyst', 'ocean', 'ember'] as const
type SiteTheme = (typeof SITE_THEMES)[number]

function getSiteTheme(): SiteTheme {
  try {
    const saved = localStorage.getItem('censorislabs-site-theme')
    const theme = saved === 'imperial' ? 'obsidian' : saved === 'violet' ? 'amethyst' : saved
    return SITE_THEMES.includes(theme as SiteTheme) ? theme as SiteTheme : 'obsidian'
  } catch {
    return 'obsidian'
  }
}

export default function GamePage() {
  const theme = getSiteTheme()
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  return (
    <section className="frontier-page" aria-label="Chronicle Frontier browser game">
      <header className="frontier-page__bar">
        <a className="frontier-page__brand" href="#top" aria-label="Return to CensorisLabs home">
          <span aria-hidden="true">C</span>
          <b>CENSORISLABS</b>
        </a>
        <div className="frontier-page__title">
          <strong>CHRONICLE FRONTIER</strong>
          <small>ORIGINAL VOXEL FPS · PLAY IN YOUR BROWSER</small>
        </div>
        <a className="frontier-page__exit" href="#top">BACK TO SITE <span aria-hidden="true">↗</span></a>
      </header>
      <iframe
        className="frontier-page__game"
        src={'/games/chronicle/?siteTheme=' + theme}
        title="Chronicle Frontier, an original browser FPS"
        allow="fullscreen; gamepad; pointer-lock"
        allowFullScreen
      />
    </section>
  )
}