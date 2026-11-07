const { copyFileSync, existsSync, readFileSync, writeFileSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const appRoot = process.cwd()
// This script lives in the shared apps/scripts folder, while Capacitor is an
// app-local dependency. Resolve from the app being built, not this script's
// directory, so every app can use its own installed Capacitor CLI.
const capacitor = require.resolve('@capacitor/cli/bin/capacitor', { paths: [appRoot] })
const run = (args, cwd = appRoot) => execFileSync(process.execPath, [capacitor, ...args], { cwd, stdio: 'inherit' })

if (!existsSync(path.join(appRoot, 'android'))) run(['add', 'android'])
if (path.basename(appRoot) === 'calorie-calculator') {
  const healthConfig = path.join(appRoot, 'healthfitness.config.json')
  if (!existsSync(healthConfig)) throw new Error('AbsoluteCal Health Connect permissions config is missing.')
  copyFileSync(healthConfig, path.join(appRoot, 'android', 'healthfitness.config.json'))
}
run(['sync', 'android'])

// The walk tracker reads a live GPS position through the WebView. A Capacitor
// WebView can only ask for location when the manifest declares it, so add the
// two location permissions (and mark GPS optional so devices without one can
// still install) before Gradle runs. Existing declarations are left alone.
const manifestPath = path.join(appRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, 'utf8')
  const permissions = ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION']
  const missing = permissions.filter(name => !manifest.includes(name))
  if (missing.length) {
    const lines = missing.map(name => `    <uses-permission android:name="${name}" />`).join('\n')
    const feature = '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />'
    manifest = manifest.replace(/<application/, `${lines}\n${feature}\n\n    <application`)
    writeFileSync(manifestPath, manifest)
    console.log(`Added to AndroidManifest.xml: ${missing.join(', ')} and optional GPS hardware`)
  }
}

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
