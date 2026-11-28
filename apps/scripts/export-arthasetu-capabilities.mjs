// Regenerates the website's ArthaSetu feature list from the app's capability
// catalogue, so the app screen and the site card read the same entries.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CAPABILITIES, CAPABILITY_AREAS, HEADLINE_CAPABILITIES } from '../arthasetu/src/domain/capabilities.ts'

const missing = HEADLINE_CAPABILITIES.filter(capability => !capability.siteLabel)
if (missing.length) throw new Error(`Headline capabilities without a siteLabel: ${missing.map(item => item.id).join(', ')}`)

const target = fileURLToPath(new URL('../../src/data/arthasetu-capabilities.ts', import.meta.url))
const quote = value => JSON.stringify(String(value))
const list = values => values.map(value => `  ${quote(value)},`).join('\n')
const header = [
  '/**',
  ' * Generated from apps/arthasetu/src/domain/capabilities.ts by',
  ' * apps/scripts/export-arthasetu-capabilities.mjs.',
  ' * Run `npm run capabilities` inside apps/arthasetu after editing the catalogue.',
  ' */',
  '',
].join('\n')

const body = header + '\n'
  + `export const ARTHASETU_CAPABILITY_COUNT = ${CAPABILITIES.length}\n\n`
  + 'export const ARTHASETU_CAPABILITY_AREAS: string[] = [\n'
  + list(CAPABILITY_AREAS) + '\n]\n\n'
  + 'export const ARTHASETU_HEADLINE_FEATURES: string[] = [\n'
  + list(HEADLINE_CAPABILITIES.map(capability => capability.siteLabel)) + '\n]\n'

writeFileSync(target, body)
console.log(`Wrote ${CAPABILITIES.length} capabilities (${HEADLINE_CAPABILITIES.length} on the site) to ${target}`)
