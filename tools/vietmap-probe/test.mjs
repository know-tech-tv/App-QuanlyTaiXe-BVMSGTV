import assert from 'node:assert/strict'
import {FieldProfiler} from './mapping.mjs'
const profiler=new FieldProfiler()
profiler.add([
 ['VehicleId','Latitude','Longitude','Speed','GPSTime','Plate','Driver','Ignored',...Array.from({length:8},()=> 'field')],
 [42,9.9342,106.3238,30,'17/10/2026 10:20','SENSITIVEPLATE','NAME','106.3238,9.9342',...Array.from({length:8},()=> 0)]
])
const summary=profiler.summary()
assert.equal(summary.headerCandidates,1)
assert.equal(summary.columns.find(x=>x.index===1).headerLabels.latitude,1)
assert.equal(summary.columns.find(x=>x.index===2).headerLabels.longitude,1)
assert.equal(summary.columns.find(x=>x.index===7).coordinatePair,1)
const serialized=JSON.stringify(summary)
assert.ok(!serialized.includes('SENSITIVEPLATE'))
assert.ok(!serialized.includes('NAME'))
assert.ok(!serialized.includes('106.3238'))
console.log('PASS: headers, lat/lon, coordinate pair, no raw values leaked')
