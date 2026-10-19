const { readdirSync, statSync } = require('node:fs')
const path = require('node:path')
const root = process.argv[2] || 'release-assets'
const limit = 100 * 1024 * 1024
const files = readdirSync(root).filter(name => /\.(apk|exe)$/i.test(name))
if (!files.length) throw new Error('No APK or EXE installers were created.')
const failures = []
for (const name of files) {
  const bytes = statSync(path.join(root, name)).size
  console.log(`${name}: ${(bytes / 1024 / 1024).toFixed(2)} MB`)
  if (bytes > limit) failures.push(name)
}
if (failures.length) throw new Error(`Installers exceed 100 MB: ${failures.join(', ')}`)
