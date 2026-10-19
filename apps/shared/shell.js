import './polish.css'

export function mountApp({ appId = 'censoris-tool', eyebrow = 'CENSORISLABS · PRIVATE TOOLS', title, description, content }) {
  const root = document.querySelector('#app')
  const key = `censorislabs-usage-${appId}`
  const savedCount = Number(localStorage.getItem(key))
  let count = Number.isFinite(savedCount) && savedCount >= 0 ? savedCount : 0
  root.innerHTML = `<div class="app-shell" data-app-id="${appId}"><header class="app-nav"><a class="brand" href="https://censorislabs.online/#/apps"><span class="brand-mark">C</span><span>CENSORISLABS<small>INDEPENDENT SOFTWARE HOUSE</small></span></a><div class="app-nav-tools"><span class="local-chip">${eyebrow}</span><button class="btn btn--quiet appearance-toggle" type="button" aria-expanded="false">Appearance</button></div></header><div class="appearance-panel" hidden><label>Theme<select data-theme-select><option value="obsidian">Obsidian</option><option value="ocean">Ocean</option><option value="amethyst">Amethyst</option><option value="ember">Ember</option></select></label><label class="switch-label"><input data-performance-toggle type="checkbox"> Low-end mode</label><small>Reduces blur, shadows, motion and decorative effects.</small></div><section class="offer-meter" aria-label="Use-based discount progress"><div class="offer-meter__copy"><b>Suite offer progress</b><span data-offer-copy></span></div><progress max="30" value="${Math.min(count, 30)}" aria-label="Uses toward up to 15 percent off"></progress><div class="offer-meter__foot"><span data-offer-count>${count} uses</span><span>10% at 15 · 15% at 30</span><button type="button" class="offer-more" data-offer-more>Offer details</button></div></section><section class="hero"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></section><main>${content}</main><footer class="app-foot"><span>Your entries stay on this device.</span><span>Built by CensorisLabs</span></footer></div>`
  const meter = root.querySelector('.offer-meter')
  const copy = root.querySelector('[data-offer-copy]')
  const progress = root.querySelector('progress')
  const countLabel = root.querySelector('[data-offer-count]')
  const updateMeter = () => {
    progress.value = Math.min(count, 30)
    countLabel.textContent = `${count} use${count === 1 ? '' : 's'}`
    copy.textContent = count >= 30 ? '15% use offer unlocked · checkout confirmation required.' : count >= 15 ? '10% use offer unlocked · 15% at 30 uses.' : `${15 - count} more to unlock 10% · ${30 - count} to unlock 15%.`
    meter.classList.toggle('offer-meter--unlocked', count >= 15)
  }
  const incrementUse = () => {
    count += 1
    localStorage.setItem(key, String(count))
    updateMeter()
  }
  updateMeter()
  root.addEventListener('click', (event) => {
    const target = event.target.closest('button')
    if (!target || target.matches('.appearance-toggle,[data-theme-select],[data-performance-toggle],[data-offer-more],#pro,[data-pro],.paywall-continue,.activate-license,.paywall-close') || target.closest('.paywall-backdrop,.appearance-panel')) return
    incrementUse()
  }, true)
  window.addEventListener('censorislabs:record-use', incrementUse)
  root.querySelector('[data-offer-more]').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('censorislabs:show-paywall', { detail: { feature: 'suite offers' } }))
  })
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
