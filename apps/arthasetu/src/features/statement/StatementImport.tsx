import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  CATEGORY_OPTIONS,
  parseStatement,
  transactionKey,
  type ParsedStatement,
  type ParsedTransaction,
} from '../../domain/statement.ts'
import { formatDate } from '../../domain/ledger.ts'

type Props = {
  existing: Array<{ date: string; merchant: string; amount: number; type: 'income' | 'expense' }>
  onClose: () => void
  onImport: (rows: ParsedTransaction[]) => void
}

type Row = ParsedTransaction & { include: boolean; duplicate: boolean }

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export default function StatementImport({ existing, onClose, onImport }: Props) {
  const [statement, setStatement] = useState<ParsedStatement | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const existingKeys = useMemo(() => new Set(existing.map(transactionKey)), [existing])
  const selected = rows.filter(row => row.include)
  const debits = selected.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)
  const credits = selected.filter(row => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
  const suggested = rows.filter(row => row.suggestion !== 'no clear match').length
  const duplicates = rows.filter(row => row.duplicate).length

  async function readFile(file: File) {
    setReading(true)
    setError('')
    setFileName(file.name)
    try {
      const text = await file.text()
      const parsed = parseStatement(text)
      setStatement(parsed)
      setRows(parsed.rows.map(row => ({
        ...row,
        duplicate: existingKeys.has(transactionKey(row)),
        include: !existingKeys.has(transactionKey(row)),
      })))
    } catch (issue) {
      setStatement(null)
      setRows([])
      setError(issue instanceof Error ? issue.message : 'That statement could not be read.')
    } finally {
      setReading(false)
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void readFile(file)
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void readFile(file)
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows(current => current.map((row, position) => position === index ? { ...row, ...patch } : row))
  }

  function importRows() {
    if (!selected.length) return
    onImport(selected.map(({ include: _include, duplicate: _duplicate, ...row }) => row))
    onClose()
  }

  return <div className="modal-backdrop"><div className="modal statement-modal">
    <button className="modal-close" onClick={onClose}>×</button>
    <div className="eyebrow">BANK STATEMENT</div>
    <h2>Import a statement CSV.</h2>
    <p className="subtitle">HDFC, ICICI, SBI, Axis, Kotak and generic exports. Rows are categorised by merchant, and you can change any suggestion before saving.</p>

    <label
      className={`statement-drop${dragging ? ' is-dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <strong>{reading ? 'Reading…' : fileName || 'Choose a statement CSV'}</strong>
      <small>or drop the file here · parsed on this device</small>
      <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
    </label>

    {error && <p className="statement-error">{error}</p>}

    {statement && <div className="statement-summary">
      <div className="statement-counts">
        <span><b>{selected.length}</b> of {rows.length} selected</span>
        <span className="out">{money(debits)} out</span>
        <span className="in">{money(credits)} in</span>
        <span>{statement.bank}{statement.skipped ? ` · ${statement.skipped} rows skipped` : ''}</span>
      </div>
      <p className="statement-hint">{suggested} categorised automatically{duplicates ? ` · ${duplicates} already in your ledger` : ''}. Change a category with the dropdown.</p>

      <div className="statement-table">
        <div className="statement-head"><span /><span>DATE</span><span>MERCHANT</span><span>CATEGORY</span><span>AMOUNT</span></div>
        <div className="statement-body">
          {rows.map((row, index) => <div className={`statement-row${row.duplicate ? ' is-duplicate' : ''}${row.include ? '' : ' is-excluded'}`} key={`${row.date}-${row.merchant}-${row.amount}-${index}`}>
            <input type="checkbox" checked={row.include} onChange={event => updateRow(index, { include: event.target.checked })} aria-label={`Include ${row.merchant}`} />
            <span>{formatDate(row.date)}</span>
            <span className="statement-merchant" title={row.merchant}>{row.merchant}</span>
            <select value={row.category} onChange={event => updateRow(index, { category: event.target.value })} aria-label={`Category for ${row.merchant}`}>
              {CATEGORY_OPTIONS.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <span className={row.type === 'income' ? 'in' : 'out'}>{row.type === 'income' ? '+' : '−'}{money(row.amount)}</span>
          </div>)}
        </div>
      </div>
    </div>}

    <div className="modal-actions">
      <button className="secondary" onClick={onClose}>Cancel</button>
      <button className="add-button" disabled={!selected.length} onClick={importRows}>Import {selected.length || ''} transactions</button>
    </div>
  </div></div>
}
