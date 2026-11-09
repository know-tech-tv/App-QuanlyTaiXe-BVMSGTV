// Never retain raw response values or save HTTP headers, cookies, token, request payloads.
const FIELD_RE = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/
const SENSITIVE_FIELD_RE = /password|passwd|secret|token|auth|cookie|session|apikey|api_key|private|bearer|credential|keycode|accesskey/i

function safeFieldName(key) {
  if (!FIELD_RE.test(key)) return '[dynamic-field]'
  if (SENSITIVE_FIELD_RE.test(key)) return '[sensitive-field]'
  return key
}

export function schemaOf(value, depth = 0) {
  if (depth >= 6) return '[depth-limit]'
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (!value.length) return ['empty-array']
    // Only derive types/field names; no individual records are retained.
    return [schemaOf(value[0], depth + 1)]
  }
  if (typeof value !== 'object') return typeof value
  const result = {}
  for (const [key, val] of Object.entries(value).slice(0, 100)) {
    const safe = safeFieldName(key)
    if (safe === '[sensitive-field]') {
      result[safe] = 'redacted'
      continue
    }
    result[safe] = schemaOf(val, depth + 1)
  }
  return result
}

export function unwrapAspNet(value) {
  let data = value
  for (let i = 0; i < 3; i++) {
    if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 1 && Object.hasOwn(data, 'd')) {
      data = data.d
      continue
    }
    if (typeof data === 'string') {
      try { data = JSON.parse(data); continue } catch { break }
    }
    break
  }
  return data
}
