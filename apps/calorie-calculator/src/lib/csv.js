// Shared CSV reader: RFC 4180-style quotes, escaped quotes, CRLF and BOM.
// Kept dependency-free so importers and their tests can use it directly.

export function parseCsv(text) {
  let source = String(text || '')
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1)
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { field += '"'; index += 1 } else quoted = false
      } else {
        field += character
      }
      continue
    }
    if (character === '"') quoted = true
    else if (character === ',') { row.push(field); field = '' }
    else if (character === '\n') {
      row.push(field); field = ''
      if (row.some(cell => String(cell).trim() !== '')) rows.push(row)
      row = []
    } else if (character !== '\r') field += character
  }
  row.push(field)
  if (row.some(cell => String(cell).trim() !== '')) rows.push(row)
  return rows
}
