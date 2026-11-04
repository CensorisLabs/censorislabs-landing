const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const appRoot = process.cwd()
const capacitor = require.resolve('@capacitor/cli/bin/capacitor', { paths: [appRoot] })
const runCap = args => execFileSync(process.execPath, [capacitor, ...args], { cwd: appRoot, stdio: 'inherit' })
const androidRoot = path.join(appRoot, 'android')

if (!fs.existsSync(androidRoot)) runCap(['add', 'android'])
runCap(['sync', 'android'])

const nativeRoot = path.join(appRoot, 'native')
const javaDestination = path.join(androidRoot, 'app', 'src', 'main', 'java', 'in', 'censorislabs', 'readingtracker')
const resourceDestination = path.join(androidRoot, 'app', 'src', 'main', 'res')
fs.mkdirSync(javaDestination, { recursive: true })

for (const name of ['ReadingWidgetPlugin.java', 'ReadingTrackerWidgetProvider.java']) {
  fs.copyFileSync(path.join(nativeRoot, 'java', 'in', 'censorislabs', 'readingtracker', name), path.join(javaDestination, name))
}
for (const folder of ['layout', 'drawable', 'xml', 'values']) {
  const source = path.join(nativeRoot, 'res', folder)
  if (!fs.existsSync(source)) continue
  const destination = path.join(resourceDestination, folder)
  fs.mkdirSync(destination, { recursive: true })
  for (const name of fs.readdirSync(source)) fs.copyFileSync(path.join(source, name), path.join(destination, name))
}

const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml')
let manifest = fs.readFileSync(manifestPath, 'utf8')
if (!manifest.includes('android.permission.CAMERA')) {
  manifest = manifest.replace(/(<manifest\b[^>]*>)/, '$1\n    <uses-permission android:name="android.permission.CAMERA" />')
}
if (!manifest.includes('ReadingTrackerWidgetProvider')) {
  const receiver = `\n        <receiver android:name=".ReadingTrackerWidgetProvider" android:exported="true" android:label="Reading Tracker">\n            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>\n            <meta-data android:name="android.appwidget.provider" android:resource="@xml/reading_tracker_widget_info" />\n        </receiver>\n`
  if (!manifest.includes('</application>')) throw new Error('Could not find the Android application manifest insertion point.')
  manifest = manifest.replace('</application>', `${receiver}    </application>`)
}
fs.writeFileSync(manifestPath, manifest)

const activityPath = path.join(javaDestination, 'MainActivity.java')
if (!fs.existsSync(activityPath)) throw new Error(`Capacitor did not create MainActivity.java at ${activityPath}`)
let activity = fs.readFileSync(activityPath, 'utf8')
if (!activity.includes('ReadingWidgetPlugin.class')) {
  const packageName = /^package\s+([\w.]+);/m.exec(activity)?.[1]
  if (!packageName) throw new Error('Could not identify the generated Android MainActivity package.')
  activity = `package ${packageName};\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    protected void load() {\n        registerPlugin(ReadingWidgetPlugin.class);\n        super.load();\n    }\n}\n`
  fs.writeFileSync(activityPath, activity)
}

const signingProperties = path.join(androidRoot, 'keystore.properties')
const signedRelease = fs.existsSync(signingProperties) && fs.existsSync(path.join(androidRoot, 'app', 'release-keystore.p12'))
const task = signedRelease ? 'assembleRelease' : 'assembleDebug'
const gradle = path.join(androidRoot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
if (!fs.existsSync(gradle)) throw new Error(`Android Gradle wrapper was not found: ${gradle}`)
if (process.platform === 'win32') {
  execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${gradle}" ${task}"`], { cwd: androidRoot, stdio: 'inherit', windowsVerbatimArguments: true })
} else {
  execFileSync(gradle, [task], { cwd: androidRoot, stdio: 'inherit' })
}
const apk = path.join(androidRoot, 'app', 'build', 'outputs', 'apk', signedRelease ? 'release' : 'debug', `app-${signedRelease ? 'release' : 'debug'}.apk`)
console.log(`Android ${signedRelease ? 'signed release' : 'debug'} APK: ${apk}`)
