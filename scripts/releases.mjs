/**
 * One build-time snapshot of the latest release, served from the site itself
 * as /releases.json.
 *
 * Download pages used to call api.github.com from the visitor's browser, which
 * meant a shared network could exhaust the anonymous hourly quota and leave
 * every download button showing an error. The snapshot removes the visitor's
 * quota from the path: the build refreshes it, and the committed copy is used
 * whenever GitHub cannot be reached, so a build never fails over a lookup.
 *
 * Set GITHUB_TOKEN in CI to lift the build's own anonymous limit (optional).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.github.com/repos/CensorisLabs/censorislabs-landing/releases/latest'
const out = fileURLToPath(new URL('../public/releases.json', import.meta.url))

const empty = { tag_name: '', published_at: '', body: '', assets: [], fetched_at: '' }

function previousSnapshot() {
  try {
    return JSON.parse(readFileSync(out, 'utf8'))
  } catch {
    return null
  }
}

let snapshot = empty
try {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'censorislabs-build' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const response = await fetch(API, { headers })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const data = await response.json()
  snapshot = {
    tag_name: data.tag_name ?? '',
    published_at: data.published_at ?? '',
    body: data.body ?? '',
    assets: (data.assets ?? []).map((asset) => ({
      name: asset.name,
      size: asset.size,
      browser_download_url: asset.browser_download_url,
    })),
    fetched_at: new Date().toISOString(),
  }
  console.log(`releases: ${snapshot.tag_name || 'no release'} · ${snapshot.assets.length} assets`)
} catch (error) {
  const previous = previousSnapshot()
  snapshot = previous ?? empty
  console.warn(
    `releases: GitHub lookup failed (${error.message}); keeping ${
      previous ? `the existing snapshot from ${previous.fetched_at || 'an earlier build'}` : 'an empty snapshot'
    }`,
  )
}

writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`)
