import './polish.css'

export function mountApp({ appId = 'censoris-tool', version = '', eyebrow = 'CENSORISLABS · PRIVATE TOOLS', title, description, content }) {
  const root = document.querySelector('#app')
  root.innerHTML = `<div class="app-shell" data-app-id="${appId}"><a class="skip-link" href="#main-content">Skip to content</a><header class="app-nav"><a class="brand" href="https://censorislabs.online/#/apps"><span class="brand-mark">C</span><span>CENSORISLABS<small>INDEPENDENT SOFTWARE HOUSE</small></span></a><div class="app-nav-tools"><span class="local-chip">${eyebrow}</span><button class="btn btn--quiet appearance-toggle" type="button" aria-expanded="false">Appearance</button></div></header><div class="appearance-panel" hidden><label>Theme<select data-theme-select><option value="obsidian">Obsidian</option><option value="ocean">Ocean</option><option value="amethyst">Amethyst</option><option value="ember">Ember</option></select></label><label class="switch-label"><input data-performance-toggle type="checkbox"> Low-end mode</label><small>Reduces blur, shadows, motion and decorative effects.</small></div><section class="hero"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></section><main id="main-content" tabindex="-1">${content}</main><footer class="app-foot"><span>Your entries stay on this device.</span><span>Built by CensorisLabs${version ? ` · v${version}` : ''}</span></footer></div>`
  const appearance = root.querySelector('.appearance-panel')
  const themeSelect = root.querySelector('[data-theme-select]')
  const performanceToggle = root.querySelector('[data-performance-toggle]')
  themeSelect.value = localStorage.getItem('censorislabs-theme') || 'obsidian'
  performanceToggle.checked = localStorage.getItem('censorislabs-performance') === 'low'
  const setTheme = () => {
    document.documentElement.dataset.theme = themeSelect.value
    document.documentElement.dataset.performance = performanceToggle.checked ? 'low' : 'full'
  }
  setTheme()
  root.querySelector('.appearance-toggle').addEventListener('click', (event) => {
    const button = event.currentTarget
    const open = button.getAttribute('aria-expanded') === 'true'
    button.setAttribute('aria-expanded', String(!open))
    appearance.hidden = open
  })
  themeSelect.addEventListener('change', () => { localStorage.setItem('censorislabs-theme', themeSelect.value); setTheme() })
  performanceToggle.addEventListener('change', () => { localStorage.setItem('censorislabs-performance', performanceToggle.checked ? 'low' : 'full'); setTheme() })
  return root
}

// Offline shell: each app ships its own service worker. Registration is a
// progressive enhancement, so a failed or unsupported install changes nothing.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline cache is optional */ })
  })
}
