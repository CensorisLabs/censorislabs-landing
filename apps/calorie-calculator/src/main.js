import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

mountApp({
  appId: 'calorie-calculator',
  eyebrow: 'HEALTH · CALORIE ESTIMATOR',
  title: 'A clearer daily target.',
  description: 'Estimate maintenance calories and a simple macro split from your own inputs. Calculations run locally and are never medical advice.',
  content: `<div class="content-grid"><section class="panel"><p class="eyebrow">YOUR INPUTS</p><h2>Build an estimate</h2><div class="field-grid three"><div class="field"><label for="age">Age</label><input id="age" type="number" min="18" max="100" placeholder="e.g. 32" inputmode="numeric"></div><div class="field"><label for="sex">Equation setting</label><select id="sex"><option value="female">Female</option><option value="male">Male</option></select></div><div class="field"><label for="height">Height (cm)</label><input id="height" type="number" min="120" max="230" placeholder="e.g. 168" inputmode="decimal"></div><div class="field"><label for="weight">Weight (kg)</label><input id="weight" type="number" min="35" max="250" step=".1" placeholder="e.g. 68" inputmode="decimal"></div><div class="field"><label for="activity">Activity</label><select id="activity"><option value="1.2">Mostly seated</option><option value="1.375">Light activity · 1–3 days/week</option><option value="1.55" selected>Moderate · 3–5 days/week</option><option value="1.725">High · 6–7 days/week</option><option value="1.9">Very high · physical work</option></select></div><div class="field"><label for="goal">Goal</label><select id="goal"><option value="lose">Gradual loss · −500 kcal</option><option value="maintain" selected>Maintain</option><option value="gain">Gradual gain · +300 kcal</option></select></div></div><div class="actions"><button class="btn" id="calculate">Calculate locally</button><button class="btn btn--quiet" id="clear">Clear</button></div><p class="muted-copy" id="status" aria-live="polite"></p></section><aside class="result-card" aria-live="polite"><span class="metric-label">DAILY CALORIE ESTIMATE</span><div class="metric" id="calories">—</div><p class="muted-copy" id="result-copy">Enter your details to see an estimate.</p><div class="metric-list"><div class="metric-row"><span>Basal metabolic rate</span><strong id="bmr">—</strong></div><div class="metric-row"><span>Body mass index</span><strong id="bmi">—</strong></div><div class="metric-row"><span>Protein · estimate</span><strong id="protein">—</strong></div><div class="metric-row"><span>Carbohydrate · estimate</span><strong id="carbs">—</strong></div><div class="metric-row"><span>Fat · estimate</span><strong id="fat">—</strong></div></div></aside></div><section class="panel" style="margin-top:18px"><p class="eyebrow">CENSORISLABS PRO</p><h2>Build a habit around the estimate.</h2><p>Save multiple profiles, compare weekly intake trends, and keep a private meal log on this device.</p><div class="feature-lock"><span><b>Meal log & 7-day nutrition trends</b><small>Premium tracking tools · stored locally</small></span><button class="btn btn--outline" id="pro">Explore Pro</button></div><div class="notice">This is a general estimate using the Mifflin–St Jeor equation. Individual needs vary. For pregnancy, medical conditions, eating-disorder recovery, or dietary treatment, ask a qualified clinician.</div></section>`,
})

const $ = (id) => document.getElementById(id)
const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
function calculate() {
  const age = Number($('age').value), height = Number($('height').value), weight = Number($('weight').value)
  if (!age || !height || !weight || age < 18 || age > 100 || height < 120 || height > 230 || weight < 35 || weight > 250) {
    $('status').textContent = 'Enter age 18–100, height 120–230 cm, and weight 35–250 kg.'
    $('status').className = 'status error'
    return
  }
  const bmr = 10 * weight + 6.25 * height - 5 * age + ($('sex').value === 'male' ? 5 : -161)
  const maintenance = bmr * Number($('activity').value)
  const goalOffset = { lose: -500, maintain: 0, gain: 300 }[$('goal').value]
  const target = Math.round((maintenance + goalOffset) / 10) * 10
  const protein = Math.round(weight * 1.6)
  const fat = Math.round(target * 0.25 / 9)
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4))
  $('calories').textContent = formatter.format(target)
  $('bmr').textContent = `${formatter.format(bmr)} kcal`
  $('bmi').textContent = (weight / ((height / 100) ** 2)).toFixed(1)
  $('protein').textContent = `${protein} g`
  $('carbs').textContent = `${carbs} g`
  $('fat').textContent = `${fat} g`
  $('result-copy').textContent = `Estimated maintenance: ${formatter.format(maintenance)} kcal/day. Goal adjustment: ${goalOffset > 0 ? '+' : ''}${goalOffset} kcal/day.`
  $('status').textContent = 'Estimate calculated on this device.'
  $('status').className = 'status'
}
$('calculate').addEventListener('click', calculate)
$('pro').addEventListener('click', () => showPaywall('meal tracking and trends'))
$('clear').addEventListener('click', () => { document.querySelectorAll('input').forEach(input => { input.value = '' }); ['calories','bmr','bmi','protein','carbs','fat'].forEach(id => { $(id).textContent = '—' }); $('result-copy').textContent = 'Enter your details to see an estimate.'; $('status').textContent = '' })
