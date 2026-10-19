const { existsSync, readFileSync, writeFileSync } = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = process.cwd()
const capacitor = require.resolve('@capacitor/cli/bin/capacitor', { paths: [root] })
if (!existsSync(path.join(root, 'android'))) execFileSync(process.execPath, [capacitor, 'add', 'android'], { cwd: root, stdio: 'inherit' })
const encoded = process.env.ANDROID_KEYSTORE_BASE64
const alias = process.env.ANDROID_KEY_ALIAS
const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD
const keyPassword = process.env.ANDROID_KEY_PASSWORD
if (![encoded, alias, storePassword, keyPassword].every(Boolean)) throw new Error('Set ANDROID_KEYSTORE_BASE64, ANDROID_KEY_ALIAS, ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_PASSWORD in repository secrets before publishing APKs.')

const androidRoot = path.join(root, 'android')
const appRoot = path.join(androidRoot, 'app')
writeFileSync(path.join(appRoot, 'release-keystore.p12'), Buffer.from(encoded, 'base64'))
const escapeProperty = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([:=#!])/g, '\\$1')
const properties = [
  'storeFile=app/release-keystore.p12',
  'storeType=PKCS12',
  `keyAlias=${escapeProperty(alias)}`,
  `storePassword=${escapeProperty(storePassword)}`,
  `keyPassword=${escapeProperty(keyPassword)}`,
].join('\n') + '\n'
writeFileSync(path.join(androidRoot, 'keystore.properties'), properties)

const gradlePath = path.join(appRoot, 'build.gradle')
let gradle = readFileSync(gradlePath, 'utf8')
if (!gradle.includes('CENSORISLABS_RELEASE_SIGNING')) {
  const signingBlock = `\n    // CENSORISLABS_RELEASE_SIGNING\n    def signingProperties = new Properties()\n    def signingPropertiesFile = rootProject.file("keystore.properties")\n    if (signingPropertiesFile.exists()) signingProperties.load(new FileInputStream(signingPropertiesFile))\n    signingConfigs {\n        release {\n            storeFile rootProject.file(signingProperties["storeFile"])
            storeType signingProperties["storeType"]
            storePassword signingProperties["storePassword"]
            keyAlias signingProperties["keyAlias"]
            keyPassword signingProperties["keyPassword"]
        }
    }
`
  if (!/android\s*\{/.test(gradle)) throw new Error(`Could not find Android Gradle configuration in ${gradlePath}`)
  gradle = gradle.replace(/android\s*\{/, match => `${match}${signingBlock}`)
  const releaseBuild = /(buildTypes\s*\{\s*release\s*\{)/
  if (!releaseBuild.test(gradle)) throw new Error('Could not find the release build type in Android app/build.gradle')
  gradle = gradle.replace(releaseBuild, '$1\n            signingConfig signingConfigs.release')
  writeFileSync(gradlePath, gradle)
}
console.log('Android release signing configured from CI secrets.')
