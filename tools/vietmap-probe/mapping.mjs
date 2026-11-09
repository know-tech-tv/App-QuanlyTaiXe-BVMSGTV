// Vietmap field-index profiler v4. Never persist raw response values.
// It intentionally exports only semantic categories, counts and zero-based column indices.
const semantics = {
  latitude: /(?:^|\b|_)(?:latitude|gpslat|lat|vi\s*do|vido|toa\s*do\s*y|toadoy|toado_lat)(?:$|\b|_)/i,
  longitude: /(?:^|\b|_)(?:longitude|gpslng|gpslon|lng|lon|kinh\s*do|kinhdo|toa\s*do\s*x|toadox|toado_lng)(?:$|\b|_)/i,
  speed: /(?:speed|velocity|toc\s*do|tocdo|km\s*\/?\s*h|kmh|vanto[c]?)/i,
  gpsTime: /(?:gps.*(?:time|date)|(?:time|date).*gps|last.*(?:time|date)|thoi\s*gian|thoigian|ngay\s*gio|ngaygio|updatedat)/i,
  plate: /(?:plate|bien\s*(?:so|kiem\s*soat)|bienso|biensoxe|license\s*plate)/i,
  vehicleId: /(?:vehicle\s*id|vehicleid|device\s*id|deviceid|imei|gps\s*id|gpsid|id\s*xe|maxe)/i,
  driver: /(?:driver|taix[eé]|lai\s*xe|nguoi\s*lai)/i,
  ignition: /(?:ignition|acc\b|may\s*no|khoa\s*dien)/i,
}
const countsTemplate = () => ({ latitude: 0, longitude: 0, speed: 0, gpsTime: 0, plate: 0, vehicleId: 0, driver: 0, ignition: 0 })
function isCoordLat(n) { return Number.isFinite(n) && n >= 8 && n <= 24 }
function isCoordLon(n) { return Number.isFinite(n) && n >= 100 && n <= 112 }
function numeric(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim()
  return /^[-+]?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null
}
function coordinatePair(v) {
  if (typeof v !== 'string') return false
  const s = v.trim()
  // Strictly two decimal coordinates, never save their value.
  const match = s.match(/^\s*([-+]?\d{1,3}\.\d{3,})\s*[,;|]\s*([-+]?\d{1,3}\.\d{3,})\s*$/)
  if (!match) return false
  const a = Number(match[1]), b = Number(match[2])
  return (isCoordLon(a) && isCoordLat(b)) || (isCoordLat(a) && isCoordLon(b))
}
function dateTime(v) {
  if (typeof v !== 'string') return false
  const s = v.trim()
  return /^\/?Date\(\d{10,13}(?:[-+]\d{4})?\)\/?$/.test(s)
    || /^\d{4}-\d\d-\d\d[T\s]\d\d:\d\d/.test(s)
    || /^\d\d[/.-]\d\d[/.-]\d{4}\s+\d\d:\d\d/.test(s)
}
function safeSemantics(v) {
  if (typeof v !== 'string' || v.length < 2 || v.length > 48) return []
  // This check only affects aggregation, not text retention.
  if (/password|token|cookie|session|secret|api[_\s-]?key|credential|bearer|auth/i.test(v)) return []
  return Object.entries(semantics).filter(([,re]) => re.test(v)).map(([k])=>k)
}

export class FieldProfiler {
  constructor() {
    this.responses = 0
    this.samples = 0
    this.headerCandidates = 0
    this.categories = new Map()
  }
  add(rows) {
    if (!Array.isArray(rows)) return
    this.responses++
    const sample = rows.filter((x)=>Array.isArray(x)).slice(0,5)
    for (const [rowIdx,row] of sample.entries()) {
      this.samples++
      const headerHint = row.length >= 12 && row.filter(x=>typeof x==='string' && x.length>1 && numeric(x)===null).length >= row.length*0.65
      if (headerHint && rowIdx === 0) this.headerCandidates++
      for (let index=0; index<Math.min(row.length,120); index++) {
        const v=row[index]
        const col=this.categories.get(index) ?? {index,observed:0,headerLabels:countsTemplate(),likelyLatitude:0,likelyLongitude:0,coordinatePair:0,dateTime:0}
        col.observed++
        const n=numeric(v)
        if (n!==null && isCoordLat(n)) col.likelyLatitude++
        if (n!==null && isCoordLon(n)) col.likelyLongitude++
        if (coordinatePair(v)) col.coordinatePair++
        if (dateTime(v)) col.dateTime++
        if (headerHint && rowIdx === 0) for (const sem of safeSemantics(v)) col.headerLabels[sem]++
        this.categories.set(index,col)
      }
    }
  }
  summary() {
    const columns=[...this.categories.values()].sort((a,b)=>a.index-b.index).filter(x=>
      Object.values(x.headerLabels).some(Boolean) || x.likelyLatitude || x.likelyLongitude || x.coordinatePair || x.dateTime)
    return {responses:this.responses,rowsSampled:this.samples,headerCandidates:this.headerCandidates,columns}
  }
}
