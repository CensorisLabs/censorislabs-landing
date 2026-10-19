const { existsSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const appRoot = process.cwd()
// This script lives in the shared apps/scripts folder, while Capacitor is an
// app-local dependency. Resolve from the app being built, not this script's
// directory, so every app can use its own installed Capacitor CLI.
const capacitor = require.resolve('@capacitor/cli/bin/capacitor', { paths: [appRoot] })
const run = (args, cwd = appRoot) => execFileSync(process.execPath, [capacitor, ...args], { cwd, stdio: 'inherit' })

if (!existsSync(path.join(appRoot, 'android'))) run(['add', 'android'])
run(['sync', 'android'])

const androidRoot = path.join(appRoot, 'android')
const signedRelease = existsSync(path.join(androidRoot, 'app', 'release-keystore.p12')) && existsSync(path.join(androidRoot, 'keystore.properties'))
const task = signedRelease ? 'assembleRelease' : 'assembleDebug'
const gradle = path.join(androidRoot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
if (process.platform === 'win32') {
  // cmd.exe must receive the wrapper path as one quoted command when the app
  // lives in a directory containing spaces or shell metacharacters (such as #).
  execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${gradle}" ${task}"`], {
    cwd: androidRoot,
    stdio: 'inherit',
    windowsVerbatimArguments: true,
  })
} else {
  execFileSync(gradle, [task], { cwd: androidRoot, stdio: 'inherit' })
}
console.log(`Android ${signedRelease ? 'signed release' : 'debug'} APK: android/app/build/outputs/apk/${signedRelease ? 'release' : 'debug'}/app-${signedRelease ? 'release' : 'debug'}.apk`)
