import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CAPABILITIES, CAPABILITY_AREAS, HEADLINE_CAPABILITIES } from '../src/domain/capabilities.ts'

const appRoot = new URL('../', import.meta.url)
const generatedFile = new URL('../../../src/data/arthasetu-capabilities.ts', import.meta.url)

function readSource(file: string) {
  return readFileSync(fileURLToPath(new URL(file, appRoot)), 'utf8')
}

test('every listed capability is still backed by the code that implements it', () => {
  const problems: string[] = []
  for (const capability of CAPABILITIES) {
    const { file, symbol, text } = capability.anchor
    let code: string
    try {
      code = readSource(file)
    } catch {
      problems.push(`${capability.id}: ${file} does not exist`)
      continue
    }
    if (symbol) {
      const forms = [
        'export function ',
        'export async function ',
        'export const ',
        'export class ',
        'export default function ',
      ].map(prefix => prefix + symbol)
      const declared = forms.some(form => {
        let at = code.indexOf(form)
        while (at !== -1) {
          const next = code[at + form.length] || ''
          if (!/[A-Za-z0-9_$]/.test(next)) return true
          at = code.indexOf(form, at + 1)
        }
        return false
      })
      if (!declared) problems.push(`${capability.id}: ${file} no longer exports ${symbol}`)
    } else if (text) {
      if (!code.includes(text)) problems.push(`${capability.id}: "${text}" is no longer in ${file}`)
    } else {
      problems.push(`${capability.id}: has no implementation anchor`)
    }
  }
  assert.deepEqual(problems, [], 'these capabilities lost their implementation')
})

test('the catalogue itself stays consistent', () => {
  const ids = CAPABILITIES.map(capability => capability.id)
  assert.equal(new Set(ids).size, ids.length, 'capability ids must be unique')
  for (const capability of CAPABILITIES) {
    assert.ok(CAPABILITY_AREAS.includes(capability.area), `${capability.id} uses an area missing from CAPABILITY_AREAS`)
    assert.ok(capability.label.trim().length > 0, `${capability.id} needs a label`)
  }
  for (const area of CAPABILITY_AREAS) {
    assert.ok(CAPABILITIES.some(capability => capability.area === area), `${area} lists no capability`)
  }
  for (const capability of HEADLINE_CAPABILITIES) {
    assert.ok(capability.siteLabel && capability.siteLabel.length > 0, `${capability.id} is on the site without a siteLabel`)
  }
})

test('the website feature list matches the catalogue', () => {
  const generated = readFileSync(generatedFile, 'utf8')
  const declared = Number(generated.match(/ARTHASETU_CAPABILITY_COUNT = (\d+)/)?.[1])
  assert.equal(declared, CAPABILITIES.length, 'the generated site count is stale — run npm run capabilities')
  for (const capability of HEADLINE_CAPABILITIES) {
    assert.ok(generated.includes(JSON.stringify(capability.siteLabel)), `${capability.id} is missing from the generated site list`)
  }
  const listed = generated.match(/^ {2}"/gm)?.length ?? 0
  assert.equal(listed, CAPABILITY_AREAS.length + HEADLINE_CAPABILITIES.length, 'the generated site file has stale entries — run npm run capabilities')
})
