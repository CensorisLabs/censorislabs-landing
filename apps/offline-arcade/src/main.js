import '../../shared/base.css'
import { mountApp } from '../../shared/shell.js'
import { showPaywall } from '../../shared/paywall.js'

mountApp({
  appId: 'offline-arcade', eyebrow: 'PLAY ANYWHERE · OFFLINE', title: 'A little fun, no signal needed.',
  description: 'Quick games that run entirely on this device. No account, ads, downloads, or connection required after install.',
  content: `<section class="panel"><div class="section-heading"><div><p class="eyebrow">THE ARCADE</p><h2 id="game-title">2048</h2></div><button class="btn btn--quiet" id="pro">More game packs · Pro</button></div><div class="game-tabs"><button class="btn" data-game="2048">2048</button><button class="btn btn--outline" data-game="memory">Memory match</button><button class="btn btn--outline" data-game="ttt">Tic-tac-toe</button></div><div class="actions"><span class="pill">Score <b id="score">0</b></span><span class="pill">Best <b id="best">0</b></span><button class="btn btn--quiet" id="restart">New game</button></div><p class="status" id="game-status" aria-live="polite">Use arrow keys, swipe, or the direction buttons.</p><div id="board" class="game-board game-board--2048" tabindex="0" aria-label="Game board"></div><div id="direction-controls" class="actions" style="justify-content:center"><button class="btn btn--quiet" data-direction="up">↑</button><button class="btn btn--quiet" data-direction="left">←</button><button class="btn btn--quiet" data-direction="down">↓</button><button class="btn btn--quiet" data-direction="right">→</button></div><p class="source-credit">All game state and best scores are stored locally in this browser profile.</p></section>`
})

const $ = (id) => document.getElementById(id)
const bestKey = 'censorislabs-arcade-best'
let game = '2048', grid = [], score = 0, cells = [], turn = 'X', locked = false, startTouch = null
let bests = {}
try { const stored = JSON.parse(localStorage.getItem(bestKey) || '{}'); if (stored && typeof stored === 'object' && !Array.isArray(stored)) bests = stored } catch { localStorage.removeItem(bestKey) }
function addTile(board) { const open = board.map((value, index) => value ? -1 : index).filter(index => index >= 0); if (open.length) board[open[Math.floor(Math.random() * open.length)]] = Math.random() < .9 ? 2 : 4 }
function new2048() { grid = Array(16).fill(0); score = 0; addTile(grid); addTile(grid); paint2048(); $('game-status').textContent = 'Use arrow keys, swipe, or the direction buttons.' }
function updateScore(value) { score = value; $('score').textContent = value; const old = Number(bests[game] || 0); if (value > old) { bests[game] = value; localStorage.setItem(bestKey, JSON.stringify(bests)) }; $('best').textContent = bests[game] || 0 }
function paint2048() { $('game-title').textContent = '2048'; $('board').className = 'game-board game-board--2048'; $('board').innerHTML = grid.map((n) => `<div class="game-card" style="background:${n ? `hsl(${35 + Math.log2(n) * 11} 46% ${Math.max(27, 64 - Math.log2(n) * 5)}%)` : '#22242a'};color:${n > 4 ? '#fff' : '#f2d9b7'}" aria-label="${n || 'empty'}">${n || ''}</div>`).join(''); $('direction-controls').hidden = false; $('score').textContent = score; $('best').textContent = bests[game] || 0 }
function slide(direction) {
  if (game !== '2048') return
  const before = grid.join(','); let gained = 0
  for (let row = 0; row < 4; row++) {
    let indices = Array.from({ length: 4 }, (_, col) => direction === 'left' || direction === 'right' ? row * 4 + col : col * 4 + row)
    if (direction === 'right' || direction === 'down') indices.reverse()
    const values = indices.map(i => grid[i]).filter(Boolean); const next = []
    for (let i = 0; i < values.length; i++) { if (values[i] === values[i + 1]) { next.push(values[i] * 2); gained += values[i] * 2; i++ } else next.push(values[i]) }
    indices.forEach((index, i) => { grid[index] = next[i] || 0 })
  }
  if (before !== grid.join(',')) { addTile(grid); updateScore(score + gained); paint2048(); if (grid.includes(2048)) $('game-status').textContent = 'You made 2048! Keep going or start another game.'; else if (grid.every(Boolean) && !canMove()) $('game-status').textContent = 'No moves left. Start a new game.' }
}
function canMove() { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const i = r * 4 + c; if (!grid[i] || (c < 3 && grid[i] === grid[i + 1]) || (r < 3 && grid[i] === grid[i + 4])) return true }; return false }
function newMemory() { const deck = ['🍊','🌙','🌿','🪷','🎈','⭐','🍉','🪁', '🍊','🌙','🌿','🪷','🎈','⭐','🍉','🪁'].sort(() => Math.random() - .5); cells = deck.map((symbol, index) => ({ symbol, index, matched: false })); locked = false; updateScore(0); paintMemory() }
function paintMemory() { $('game-title').textContent = 'Memory match'; $('board').className = 'game-board game-board--memory'; $('board').innerHTML = cells.map(cell => `<button class="game-card" data-card="${cell.index}" aria-label="${cell.matched ? cell.symbol : 'Hidden card'}">${cell.matched ? cell.symbol : '✦'}</button>`).join(''); $('direction-controls').hidden = true; $('board').querySelectorAll('[data-card]').forEach(button => button.addEventListener('click', () => flip(Number(button.dataset.card)))); $('best').textContent = bests[game] || 0 }
function flip(index) { if (locked || cells[index].matched || $('board').querySelectorAll('.is-open').length >= 2) return; const card = cells[index]; const button = $('board').querySelector(`[data-card="${index}"]`); button.textContent = card.symbol; button.classList.add('is-open'); const open = [...$('board').querySelectorAll('.is-open')]; if (open.length === 2) { locked = true; setTimeout(() => { const [a, b] = open.map(el => cells[Number(el.dataset.card)]); if (a.symbol === b.symbol) { a.matched = b.matched = true; updateScore(score + 1) }; locked = false; paintMemory(); if (cells.every(c => c.matched)) $('game-status').textContent = 'All pairs found. Start a new game to play again.' }, 650) } }
function newTtt() { cells = Array(9).fill(''); turn = 'X'; updateScore(0); paintTtt() }
function paintTtt() { $('game-title').textContent = 'Tic-tac-toe'; $('board').className = 'game-board game-board--ttt'; $('board').innerHTML = cells.map((mark, index) => `<button class="game-card" data-ttt="${index}" aria-label="Cell ${index + 1}${mark ? ` ${mark}` : ''}">${mark}</button>`).join(''); $('direction-controls').hidden = true; $('best').textContent = bests[game] || 0; $('board').querySelectorAll('[data-ttt]').forEach(button => button.addEventListener('click', () => { const i = Number(button.dataset.ttt); if (cells[i] || $('game-status').dataset.over === 'true') return; cells[i] = turn; const line = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; if (line.some(([a,b,c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c])) { $('game-status').textContent = `${turn} wins!`; $('game-status').dataset.over = 'true'; updateScore(score + 1) } else if (cells.every(Boolean)) { $('game-status').textContent = 'It’s a draw.'; $('game-status').dataset.over = 'true' } else { turn = turn === 'X' ? 'O' : 'X'; $('game-status').textContent = `${turn}’s turn` }; paintTtt() })) }
function start(next) { game = next; $('game-status').dataset.over = 'false'; if (game === '2048') new2048(); else if (game === 'memory') { $('game-status').textContent = 'Find all eight pairs.'; newMemory() } else { $('game-status').textContent = 'X goes first.'; newTtt() } }
document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => start(button.dataset.game)))
$('restart').addEventListener('click', () => start(game))
document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => slide(button.dataset.direction)))
window.addEventListener('keydown', event => { const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }; if (directions[event.key] && game === '2048') { event.preventDefault(); slide(directions[event.key]); window.dispatchEvent(new CustomEvent('censorislabs:record-use')) } })
$('board').addEventListener('touchstart', event => { const touch = event.changedTouches[0]; startTouch = [touch.clientX, touch.clientY] }, { passive: true })
$('board').addEventListener('touchend', event => { if (!startTouch || game !== '2048') return; const touch = event.changedTouches[0]; const dx = touch.clientX - startTouch[0], dy = touch.clientY - startTouch[1]; if (Math.max(Math.abs(dx), Math.abs(dy)) > 28) { slide(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'); window.dispatchEvent(new CustomEvent('censorislabs:record-use')) }; startTouch = null }, { passive: true })
$('pro').addEventListener('click', () => showPaywall('additional game packs'))
window.addEventListener('censorislabs:show-paywall', (event) => showPaywall(event.detail?.feature || 'suite offers'))
start('2048')
