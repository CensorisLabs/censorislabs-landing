// Copies a built app into public/<app> so the site can serve it from a
// same-origin folder. Only the generated bundle is copied: no sources, no
// node_modules, no Electron packaging output.
const fs = require('node:fs')
const path = require('node:path')

const app = process.argv[2]
const safe = process.env.npm_package_scripts ? String(app || '').replace(/^\.\/?/, '') : ''
const slug = safe || path.basename(process.cwd())
if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Pass the app folder name, for example: node ../scripts/publish-web-app.cjs era-almanac')

const repo = path.resolve(__dirname, '../..')
const source = path.join(repo, 'apps', slug, 'dist')
const destination = path.join(repo, 'public', slug)
if (!fs.existsSync(path.join(source, 'index.html'))) throw new Error(`Build ${slug} before publishing its website files.`)
fs.rmSync(destination, { recursive: true, force: true })
fs.mkdirSync(destination, { recursive: true })
fs.cpSync(source, destination, { recursive: true })
console.log(`${slug} web app copied to ${destination}`)
