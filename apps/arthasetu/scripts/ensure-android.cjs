const { existsSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

if (!existsSync('android')) {
  const capacitorCli = path.resolve(__dirname, '../node_modules/@capacitor/cli/bin/capacitor')
  execFileSync(process.execPath, [capacitorCli, 'add', 'android'], { stdio: 'inherit' })
}
