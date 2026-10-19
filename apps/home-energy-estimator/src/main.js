import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

const safeRead = () => { try { return JSON.parse(localStorage.getItem('censoris-energy-data') || 'null') } catch { return null } }
const saved = safeRead() || {}
let appliances = Array.isArray(saved.appliances) ? saved.appliances : []
let days = Number(saved.days) || 30
let tariff = Number(saved.tariff) || 8
let fixed = Number(saved.fixed) || 0

mountApp({
  appId: 'home-energy-estimator',
  eyebrow: 'HOUSEHOLD · ENERGY ESTIMATOR',
  title: 'Know what each appliance costs.',
  description: 'Estimate monthly electricity use from appliance wattage, hours, and your local tariff. All calculations and entries stay on this device.',
  content: `<div class="content-grid"><section class="panel"><p class="eyebrow">YOUR BILL ASSUMPTIONS</p><h2>Set your billing details</h2><div class="field-grid three"><div class="field"><label for="days">Days in billing period</label><input id="days" type="number" min="1" max="62" value="${days}"></div><div class="field"><label for="tariff">Rate per kWh (₹)</label><input id="tariff" type="number" min="0" step=".01" value="${tariff}"></div><div class="field"><label for="fixed">Fixed charges (₹)</label><input id="fixed" type="number" min="0" step="1" value="${fixed}"></div></div><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:28px"><div><p class="eyebrow" style="margin-bottom:4px">APPLIANCE LIST</p><h2 style="margin:0">Add what you use</h2></div><button class="btn btn--outline" id="add">+ Add appliance</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Appliance</th><th>Watts</th><th>Hours/day</th><th>Quantity</th><th></th></tr></thead><tbody id="rows"></tbody></table></div><div class="empty" id="empty" hidden>Add an appliance to estimate your monthly use.</div></section><aside class="result-card"><span class="metric-label">ESTIMATED MONTHLY BILL</span><div class="metric" id="bill">₹0</div><div class="metric-list"><div class="metric-row"><span>Energy use per day</span><strong id="daily">0 kWh</strong></div><div class="metric-row"><span>Energy use per billing period</span><strong id="period">0 kWh</strong></div><div class="metric-row"><span>Energy charges</span><strong id="energy-charge">₹0</strong></div><div class="metric-row"><span>Fixed charges</span><strong id="fixed-charge">₹0</strong></div></div><p class="notice">Estimate excludes slab pricing, fuel adjustments, taxes, rebates, and time-of-use rates. Enter your effective average rate for a closer estimate.</p></aside></div><section class="panel" style="margin-top:18px"><p class="eyebrow">CENSORISLABS PRO</p><h2>Compare changes before the next bill.</h2><p>Save household scenarios, compare seasonal use, and export an appliance-by-appliance report.</p><div class="feature-lock"><span><b>Multiple scenarios & bill history</b><small>Stored locally · no utility account needed</small></span><button class="btn btn--outline" id="pro">Explore Pro</button></div></section>`,
})

const $ = (id) => document.getElementById(id)
const money = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`
const number = (value, decimals = 1) => Number(value.toFixed(decimals)).toLocaleString('en-IN')
function save() { localStorage.setItem('censoris-energy-data', JSON.stringify({ appliances, days, tariff, fixed })) }
function calculate() {
  days = Math.max(1, Math.min(62, Number($('days').value) || 30))
  tariff = Math.max(0, Number($('tariff').value) || 0)
  fixed = Math.max(0, Number($('fixed').value) || 0)
  const daily = appliances.reduce((sum, item) => sum + item.watts * item.hours * item.quantity / 1000, 0)
  const period = daily * days
  const charge = period * tariff
  $('daily').textContent = `${number(daily)} kWh`
  $('period').textContent = `${number(period)} kWh`
  $('energy-charge').textContent = money(charge)
  $('fixed-charge').textContent = money(fixed)
  $('bill').textContent = money(charge + fixed)
  $('empty').hidden = appliances.length > 0
  save()
}
function renderRows() {
  $('rows').innerHTML = appliances.map((item, index) => `<tr><td><input aria-label="Appliance name" data-field="name" data-index="${index}" value="${escapeHtml(item.name)}" placeholder="e.g. Ceiling fan"></td><td><input aria-label="Watts" type="number" min="0" data-field="watts" data-index="${index}" value="${item.watts}"></td><td><input aria-label="Hours per day" type="number" min="0" max="24" step=".25" data-field="hours" data-index="${index}" value="${item.hours}"></td><td><input aria-label="Quantity" type="number" min="1" data-field="quantity" data-index="${index}" value="${item.quantity}"></td><td><button class="btn btn--quiet" data-remove="${index}" aria-label="Remove ${escapeHtml(item.name)}">×</button></td></tr>`).join('')
  document.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', event => { const index = Number(event.currentTarget.dataset.index), field = event.currentTarget.dataset.field; appliances[index][field] = field === 'name' ? event.currentTarget.value : Math.max(0, Number(event.currentTarget.value) || 0); calculate() }))
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => { appliances.splice(Number(event.currentTarget.dataset.remove), 1); renderRows(); calculate() }))
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]) }
$('add').addEventListener('click', () => { appliances.push({ name: '', watts: 0, hours: 0, quantity: 1 }); renderRows(); calculate(); const inputs = document.querySelectorAll('[data-field="name"]'); inputs[inputs.length - 1]?.focus() })
;['days','tariff','fixed'].forEach(id => $(id).addEventListener('input', calculate))
$('pro').addEventListener('click', () => showPaywall('scenarios and bill history'))
renderRows(); calculate()
