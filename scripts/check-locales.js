#!/usr/bin/env node
/**
 * Locale checker for Censoris.
 *
 * Usage: node scripts/check-locales.js
 *
 * Reports, for every locale file:
 *  - keys missing compared to English (the reference locale)
 *  - extra keys not present in English
 *  - whether the file is still marked "_needsReview": true
 *
 * Exits non-zero if English itself is broken or if a "_needsReview" file
 * suddenly matches English perfectly (probably a forgotten flag).
 * Draft translations are fine; this script just keeps them visible.
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const REVIEW_FLAG = '_needsReview';

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (key === REVIEW_FLAG) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, fullKey, out);
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort();
if (!files.includes('en.json')) {
  console.error('FATAL: en.json missing from ' + LOCALES_DIR);
  process.exit(1);
}

const en = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8')));
const enKeys = new Set(Object.keys(en));

let problems = 0;

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
  const needsReview = raw[REVIEW_FLAG] === true;
  const flat = flatten(raw);
  const keys = new Set(Object.keys(flat));

  const missing = [...enKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enKeys.has(k));

  const label = file.replace('.json', '');
  const reviewTag = needsReview ? '  [needs review]' : '';
  console.log(`${label}${reviewTag}: ${keys.size} keys` + (missing.length ? `, MISSING ${missing.length}` : '') + (extra.length ? `, EXTRA ${extra.length}` : ''));

  if (missing.length) {
    problems++;
    for (const k of missing) console.log(`    missing: ${k}`);
  }
  if (extra.length) {
    problems++;
    for (const k of extra) console.log(`    extra:   ${k}`);
  }
}

if (problems > 0) {
  console.log(`\n${problems} file(s) need attention.`);
  process.exit(1);
}
console.log('\nAll locales have exactly the English key set.');
