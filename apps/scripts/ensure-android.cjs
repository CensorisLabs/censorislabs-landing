const { existsSync } = require('node:fs')
const { execFileSync } = require('node:child_process')

if (!existsSync('android')) {
  execFileSync(process.execPath, [require.resolve('@capacitor/cli/bin/capacitor'), 'add', 'android'], { stdio: 'inherit', cwd: process.cwd() })
}
