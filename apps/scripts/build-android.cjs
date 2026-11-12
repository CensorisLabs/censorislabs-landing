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

// Scheduled reminders need Android 13's runtime notification permission, exact
// alarms so a nudge is not batched hours late, and the boot permission so the
// schedule survives a restart. The plugin supplies its own receivers; these are
// only the manifest permissions Gradle merges from the app.
const reminderPermissions = ['android.permission.POST_NOTIFICATIONS', 'android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.RECEIVE_BOOT_COMPLETED']
if (existsSync(manifestPath)) {
  let reminderManifest = readFileSync(manifestPath, 'utf8')
  const missingReminder = reminderPermissions.filter(name => !reminderManifest.includes(name))
  if (missingReminder.length) {
    const reminderLines = missingReminder.map(name => `    <uses-permission android:name="${name}" />`).join('\n')
    reminderManifest = reminderManifest.replace(/<application/, reminderLines + '\n\n    <application')
    writeFileSync(manifestPath, reminderManifest)
    console.log(`Added to AndroidManifest.xml: ${missingReminder.join(', ')}`)
  }
}

// The Health Connect plugin writes its notification strings into strings.xml
// itself, sometimes several elements on one line and without XML/Android
// escaping. aapt2 rejects that ("Invalid unicode escape sequence in string"),
// so rewrite the file deterministically with one escaped element per line.
const stringsPath = path.join(appRoot, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml')
if (existsSync(stringsPath)) {
  const escapeValue = value => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
  const entries = []
  const pattern = /<string\s+name="([^"]+)"\s*(?:\/>|>([\s\S]*?)<\/string>)/g
  let match
  const original = readFileSync(stringsPath, 'utf8')
  while ((match = pattern.exec(original))) entries.push([match[1], match[2]])
  const overrides = {}
  if (path.basename(appRoot) === 'calorie-calculator') {
    const healthConfig = JSON.parse(readFileSync(path.join(appRoot, 'healthfitness.config.json'), 'utf8'))
    if (healthConfig.backgroundNotificationTitle) overrides.background_notification_title = healthConfig.backgroundNotificationTitle
    if (healthConfig.backgroundNotificationDescription) overrides.background_notification_description = healthConfig.backgroundNotificationDescription
    if (healthConfig.privacyPolicyUrl) overrides.privacy_policy_url = healthConfig.privacyPolicyUrl
  }
  const merged = new Map(entries)
  for (const [name, value] of Object.entries(overrides)) merged.set(name, value)
  const body = [...merged].map(([name, value]) => value === undefined
    ? `    <string name="${name}" />`
    : `    <string name="${name}">${escapeValue(value)}</string>`).join('\n')
  writeFileSync(stringsPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${body}\n</resources>\n`)
  console.log(`Normalised Android string resources (${merged.size} entries).`)
}

const androidRoot = path.join(appRoot, 'android')
const signedRelease = existsSync(path.join(androidRoot, 'app', 'release-keystore.p12')) && existsSync(path.join(androidRoot, 'keystore.properties'))
const task = signedRelease ? 'assembleRelease' : 'assembleDebug'
// The Health Connect library ships a minSdk of 26, while the Capacitor template
// still scaffolds 24, so the manifest merger rejects the release build. Raise it
// only when the project asks for something lower. Android 8.0 is the floor for
// every app built from this script.
const variablesPath = path.join(androidRoot, 'variables.gradle')
if (existsSync(variablesPath)) {
  const variables = readFileSync(variablesPath, 'utf8')
  const updated = variables.replace(/minSdkVersion\s*=\s*(\d+)/, (line, version) => Number(version) < 26 ? 'minSdkVersion = 26' : line)
  if (updated !== variables) {
    writeFileSync(variablesPath, updated)
    console.log('Raised minSdkVersion to 26 for the Health Connect library.')
  }
}

if (process.env.CAPACITOR_SKIP_GRADLE === '1') {
  console.log('Skipping Gradle because CAPACITOR_SKIP_GRADLE=1.')
  process.exit(0)
}

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
