// Vietmap structure profiler. ALL raw values stay in volatile process memory.
// Output is only categorical counts/positions; never store or print actual record values.

function textCategory(value) {
  if (value === null || value === undefined || value === '') return 'empty'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'nested-array'
  if (typeof value === 'object') return 'object'
  if (typeof value !== 'string') return 'unknown'
  const s = value.trim()
  if (!s) return 'empty'
  if (/^[-+]?\d+(?:[.,]\d+)?$/.test(s)) return 'numeric-string'
  if (/^\d{4}-\d\d-\d\d[T\s]/.test(s) || /^\d\d[/.-]\d\d[/.-]\d{4}/.test(s)) return 'date-time-like'
  if (/^\d\d:\d\d(?::\d\d)?$/.test(s)) return 'time-like'
  if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(s)) return 'uuid-like'
  if (s.startsWith('{') || s.startsWith('[')) return 'json-like-string'
  if (s.includes('|')) return 'pipe-separated-string'
  if (s.includes(';')) return 'semicolon-separated-string'
  if (s.includes('\t')) return 'tab-separated-string'
  if (s.includes(',')) return 'comma-separated-string'
  return 'plain-string'
}

function numericHint(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(raw)) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return {
    possibleLatitudeVN: n >= 8 && n <= 24,
    possibleLongitudeVN: n >= 100 && n <= 112,
    possibleSpeedKph: n >= 0 && n <= 180,
    possibleUnixTimestamp: n >= 1_500_000_000 && n <= 2_200_000_000,
  }
}

export class RowProfiler {
  constructor() {
    this.responses = 0
    this.totalRows = 0
    this.minColumns = null
    this.maxColumns = 0
    this.columns = new Map()
  }
  add(records) {
    if (!Array.isArray(records)) return
    this.responses++
    // Limit CPU load when a response contains many cars or sensor records.
    for (const row of records.slice(0, 200)) {
      if (!Array.isArray(row)) continue
      this.totalRows++
      this.minColumns = Math.min(this.minColumns ?? row.length, row.length)
      this.maxColumns = Math.max(this.maxColumns, row.length)
      row.slice(0, 120).forEach((value, index) => {
        const col = this.columns.get(index) ?? { index, observed: 0, categories: {}, numericHints: { possibleLatitudeVN: 0, possibleLongitudeVN: 0, possibleSpeedKph: 0, possibleUnixTimestamp: 0 } }
        col.observed++
        const type = textCategory(value)
        col.categories[type] = (col.categories[type] ?? 0) + 1
        const hint = numericHint(value)
        if (hint) for (const [key, match] of Object.entries(hint)) if (match) col.numericHints[key]++
        this.columns.set(index, col)
      })
    }
  }
  getSummary() {
    return {
      inspectedResponses: this.responses,
      inspectedRows: this.totalRows,
      minColumns: this.minColumns ?? 0,
      maxColumns: this.maxColumns,
      columns: [...this.columns.values()].sort((a, b) => a.index - b.index),
    }
  }
}

export function shapeReport(value) {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const out = {}
  for (const key of ['Vehicles', 'Data', 'SensorTypes']) {
    if (!Object.hasOwn(obj, key)) continue
    const profiler = new RowProfiler()
    profiler.add(obj[key])
    out[key] = profiler.getSummary()
  }
  return out
}
